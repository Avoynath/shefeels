#!/usr/bin/env python3
"""Utility: Reassign media uploaded via chats to the correct CharacterMedia.character_id.

Usage:
  ./tools/reassign_chat_media.py [--dry-run]

This script will:
 - scan ChatMessage.ai_message for __IMAGES__: and __VIDEOS__: markers
 - parse the JSON arrays following those markers
 - normalize entries (extract s3 key from presigned URL when possible)
 - find or create CharacterMedia rows and ensure their character_id matches the chat message's character_id
 - print a concise report of changes (or would-be changes in dry-run)
"""
import asyncio
import json
import re
import sys
from typing import Optional

from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.models.chat import ChatMessage
from app.models.character_media import CharacterMedia


PRESIGNED_S3_REGEX = re.compile(r"https?://[^/]+/(.+)\?" )


def extract_s3_key(maybe_url: str) -> str:
    """Try to extract an S3 key from a presigned URL or return input if it looks like a key already."""
    if not maybe_url:
        return maybe_url
    # If it already looks like a key (no scheme), assume it's a key
    if not maybe_url.startswith('http'):
        return maybe_url
    m = PRESIGNED_S3_REGEX.search(maybe_url)
    if m:
        return m.group(1)
    # fallback: try to strip protocol + host
    try:
        parts = maybe_url.split('/', 3)
        if len(parts) >= 4:
            return parts[3].split('?', 1)[0]
    except Exception:
        pass
    return maybe_url


async def main(dry_run: bool = True):
    async with AsyncSessionLocal() as db:
        # Fetch recent chat messages that include image/video markers
        stmt = text(
            "SELECT id, user_id, character_id, ai_message FROM chat_messages WHERE ai_message IS NOT NULL AND (ai_message LIKE '%__IMAGES__:%' OR ai_message LIKE '%__VIDEOS__:%') ORDER BY id DESC LIMIT 1000"
        )
        q = await db.execute(stmt)
        rows = q.fetchall()
        print(f"Found {len(rows)} chat messages with media markers (scanning up to 1000).")

        created = 0
        updated = 0
        skipped = 0
        notfound = 0

        for r in rows:
            msg_id, user_id, character_id, ai_message = r
            if not ai_message:
                continue
            # find both markers
            for marker in ('__IMAGES__:', '__VIDEOS__:'):
                idx = ai_message.find(marker)
                if idx == -1:
                    continue
                json_part = ai_message[idx + len(marker):].strip()
                # try to find JSON array
                try:
                    arr = json.loads(json_part)
                except Exception:
                    # attempt to extract the first balanced array substring
                    start = json_part.find('[')
                    if start == -1:
                        continue
                    # find matching bracket
                    depth = 0
                    end = -1
                    for i, ch in enumerate(json_part[start:], start):
                        if ch == '[':
                            depth += 1
                        elif ch == ']':
                            depth -= 1
                            if depth == 0:
                                end = i + 1
                                break
                    if end == -1:
                        continue
                    try:
                        arr = json.loads(json_part[start:end])
                    except Exception:
                        continue

                if not isinstance(arr, list):
                    continue

                for entry in arr:
                    key = extract_s3_key(entry)
                    # Try to find an existing CharacterMedia
                    res = await db.execute(text("SELECT id, character_id, user_id FROM character_media WHERE s3_path = :p"), {"p": key})
                    fm = res.fetchone()
                    if fm:
                        cm_id, cm_char_id, cm_user_id = fm
                        if cm_char_id != character_id:
                            print(f"Message {msg_id}: media {key} has character_id {cm_char_id} -> should be {character_id}")
                            if not dry_run:
                                await db.execute(text("UPDATE character_media SET character_id = :cid WHERE id = :id"), {"cid": character_id, "id": cm_id})
                                await db.commit()
                                updated += 1
                            else:
                                updated += 1
                        else:
                            skipped += 1
                    else:
                        print(f"Message {msg_id}: media {key} not found in CharacterMedia. Will create entry with character_id={character_id} user_id={user_id}")
                        if not dry_run:
                            await db.execute(text(
                                "INSERT INTO character_media (character_id, user_id, media_type, s3_path, mime_type, created_at) VALUES (:cid, :uid, :mt, :p, :mtm, now())"
                            ), {"cid": character_id, "uid": user_id, "mt": ('image' if marker.startswith('__IMAGES__') else 'video'), "p": key, "mtm": ('image/png' if marker.startswith('__IMAGES__') else 'video/mp4')} )
                            await db.commit()
                            created += 1
                        else:
                            notfound += 1

        print("--- Report ---")
        print(f"{'Updated' if not dry_run else 'Would update'}: {updated}")
        print(f"{'Created' if not dry_run else 'Would create'}: {created if not dry_run else notfound}")
        print(f"Skipped (already correct): {skipped}")


if __name__ == '__main__':
    dry = True
    if '--apply' in sys.argv or '--no-dry-run' in sys.argv:
        dry = False
    asyncio.run(main(dry_run=dry))