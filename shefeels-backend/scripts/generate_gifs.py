#!/usr/bin/env python3
"""Generate looping GIFs for characters, upload to S3, and update `gif_url_s3`.

Usage:
  python generate_gifs.py --all
  python generate_gifs.py --ids 1,2,5

Notes:
- Expects a `.env` file at the repo root or `hl-backend/.env` with DB and AWS creds.
- Uses Kie.ai Wan 2.5 API via `app.services.kie_client`.
"""
import os
import sys
import argparse
import time
import concurrent.futures
import base64
import tempfile
import json
import asyncio
from urllib.parse import urlparse, quote

import requests
import subprocess
import boto3
from botocore.config import Config
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load env
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, os.pardir))
sys.path.append(root)

# Import app modules after sys.path update
try:
    from app.core.config import settings
    from app.services.kie_client import kie_client
except ImportError:
    # If running directly from scripts folder without app context, might need adjustments
    pass

env_path = os.path.join(root, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')
AWS_BUCKET = os.environ.get('S3_BUCKET') or os.environ.get('AWS_S3_BUCKET') or 'aichat-pronily'

PROMPT_TEMPLATE = (
    "Animate this base image into a seamless looping GIF. Add light movements such as blinking, "
    "small body motion, or gentle background effects while preserving the exact style and proportions "
    "of the original. Loop should be smooth and continuous."
)

KIE_MODEL = "wan/2-5-image-to-video"


def norm_db_url(url: str) -> str:
    # psycopg2 doesn't accept the SQLAlchemy async driver prefix
    if not url:
        raise RuntimeError('DATABASE_URL not set')
    return url.replace('postgresql+asyncpg://', 'postgresql://')


def guess_image_column(cursor) -> str:
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='characters';")
    cols = [r['column_name'] for r in cursor.fetchall()]
    candidates = ['image_url', 'avatar_url', 'image', 'image_path', 'character_image', 'image_s3', 'image_url_s3', 'avatar']
    for c in candidates:
        if c in cols:
            return c
    # fallback to first col containing 'image'
    for c in cols:
        if 'image' in c:
            return c
    raise RuntimeError('Could not find an image column in public.characters; columns: ' + ','.join(cols))


def convert_mp4_to_gif(mp4_bytes: bytes) -> bytes:
    """Convert mp4 bytes to gif bytes using ffmpeg (requires ffmpeg installed)."""
    in_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as in_f:
            in_f.write(mp4_bytes)
            in_path = in_f.name

        fd, out_path = tempfile.mkstemp(suffix='.gif')
        os.close(fd)

        # Basic ffmpeg conversion. Use fps/scale for reasonable size.
        cmd = [
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-i', in_path,
            '-vf', 'fps=15,scale=480:-1:flags=lanczos',
            '-loop', '0',
            out_path,
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except FileNotFoundError:
            raise RuntimeError('ffmpeg not found on PATH. Install ffmpeg to enable mp4->gif conversion.')

        with open(out_path, 'rb') as f:
            gif_bytes = f.read()
        return gif_bytes
    finally:
        try:
            if in_path and os.path.exists(in_path):
                os.remove(in_path)
        except Exception:
            pass
        try:
            if out_path and os.path.exists(out_path):
                os.remove(out_path)
        except Exception:
            pass


def upload_to_s3_bytes(s3_client, bucket: str, key: str, data: bytes) -> str:
    # content type will be provided via key extension; default to octet-stream if unknown
    content_type = 'application/octet-stream'
    if key.lower().endswith('.gif'):
        content_type = 'image/gif'
    elif key.lower().endswith('.webp'):
        content_type = 'image/webp'
    elif key.lower().endswith('.mp4'):
        content_type = 'video/mp4'
    s3_client.put_object(Bucket=bucket, Key=key, Body=data, ACL='public-read', ContentType=content_type)
    # Return just the S3 key (not full URL) so the backend can presign it
    return key


def convert_to_webp(input_bytes: bytes, input_fmt: str = 'gif') -> bytes:
    """Convert input bytes (gif or mp4) to animated webp using ffmpeg."""
    in_path = None
    out_path = None
    try:
        suffix = '.gif' if input_fmt == 'gif' else '.mp4'
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as in_f:
            in_f.write(input_bytes)
            in_path = in_f.name

        fd, out_path = tempfile.mkstemp(suffix='.webp')
        os.close(fd)

        # Use ffmpeg to convert to animated webp; adjust scale/fps for size
        cmd = [
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-i', in_path,
            '-vf', 'fps=15,scale=480:-1:flags=lanczos',
            '-lossless', '0',
            '-compression_level', '6',
            '-q:v', '50',
            '-preset', 'default',
            out_path,
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except FileNotFoundError:
            raise RuntimeError('ffmpeg not found on PATH. Install ffmpeg to enable webp conversion.')

        with open(out_path, 'rb') as f:
            webp_bytes = f.read()
        return webp_bytes
    finally:
        try:
            if in_path and os.path.exists(in_path):
                os.remove(in_path)
        except Exception:
            pass
        try:
            if out_path and os.path.exists(out_path):
                os.remove(out_path)
        except Exception:
            pass
            
def _find_first_url(json_str: str) -> str | None:
    """Parse resultJson to find the first URL."""
    try:
        if not json_str: 
            return None
        data = json.loads(json_str)
        if isinstance(data, dict):
             if "resultUrls" in data:
                 urls = data["resultUrls"]
                 if isinstance(urls, list) and len(urls) > 0:
                     return urls[0]
             for v in data.values():
                 if isinstance(v, str) and v.startswith("http"):
                     return v
                 if isinstance(v, list) and len(v) > 0 and isinstance(v[0], str) and v[0].startswith("http"):
                     return v[0]
    except Exception as e:
        print(f"Error parsing resultJson: {e}")
    return None

async def run_kie_generation(image_url: str):
    """Async wrapper to run Kie generation."""
    try:
        # We need a proper URL for Kie.ai
        input_data = {
            "prompt": PROMPT_TEMPLATE,
            "image_url": image_url,
            "duration": "5",
            "resolution": "1080p",
            "enable_prompt_expansion": True
        }
        
        print(f"Starting Kie.ai task for image: {image_url[:50]}...")
        # Assuming kie_client is available via import
        # Create Task
        response = await kie_client.create_task(KIE_MODEL, input_data)
        task_id = response['data']['taskId']
        print(f"Task created. Task ID: {task_id}")
        
        # Poll for completion
        result = await kie_client.wait_for_completion(task_id)
        
        # Extract video URL
        result_json = result.get("resultJson")
        video_url = _find_first_url(result_json)
        
        if not video_url:
            raise RuntimeError(f"Could not find video URL in result: {result_json}")
            
        print(f"Got video URL: {video_url[:100]}...")
        
        # Download
        r = requests.get(video_url, timeout=180)
        r.raise_for_status()
        return r.content, "video/mp4"
        
    except Exception as e:
        print(f"Kie.ai generation failed: {e}")
        return None, None

def run_async(coro):
    return asyncio.run(coro)

def generate_for_row(row, image_col, db_url, bucket, dry_run=False):
    """Process one DB row: call Kie.ai, convert/upload gif, update DB."""
    id = row['id']
    image_url = row.get(image_col)
    if not image_url:
        print(f"Skipping id={id}: no image at column {image_col}")
        return None

    print(f"Generating GIF for id={id}, image={image_url}")

    # create s3 client early so we can presign image URLs if needed
    try:
        s3_region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION')
        s3_cfg = Config(signature_version='s3v4')
        if s3_region:
            s3_for_input = boto3.client('s3', config=s3_cfg, region_name=s3_region)
        else:
            s3_for_input = boto3.client('s3', config=s3_cfg)
    except Exception as e:
        print('Could not create S3 client for presign:', e)
        s3_for_input = None

    presign_expires = int(os.environ.get('S3_PRESIGNED_EXPIRES', '3600'))

    def make_full_image_url(img_url, bucket_name, s3_client=None, expires=3600):
        if not img_url:
            return img_url
        img_url = img_url.strip()
        if img_url.startswith('http://') or img_url.startswith('https://') or img_url.startswith('data:'):
            return img_url
        # assume it's an S3 key or relative path
        key = img_url.lstrip('/')
        
        if s3_client is not None:
            try:
                return s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket_name, 'Key': key},
                    ExpiresIn=int(expires),
                )
            except Exception:
                pass
        # quote the key but keep slashes
        key_quoted = quote(key, safe='/:')
        return f'https://{bucket_name}.s3.amazonaws.com/{key_quoted}'

    # ensure image_url is a full HTTPS URL
    full_image_url = make_full_image_url(image_url, bucket, s3_for_input, presign_expires)

    if dry_run:
        print(f"[dry-run] would call Kie.ai with image {full_image_url}")
        return None

    # Call Kie.ai (Sync wrapper around async)
    data, content_type = run_async(run_kie_generation(full_image_url))
    
    if not data:
        return None

    # If result is a video (mp4), convert to gif
    is_video = False
    if content_type and content_type.startswith('video'):
        is_video = True
    elif isinstance(data, (bytes, bytearray)) and b'ftyp' in data[:200]:
        is_video = True

    if is_video:
        try:
            gif_bytes = convert_mp4_to_gif(data)
        except Exception as e:
            print('Failed to convert mp4 to gif:', e)
            return None
    else:
        gif_bytes = data

    key = f'character_gifs/{id}.gif'
    
    # create per-thread s3 client and db connection
    try:
        s3_region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION')
        s3_cfg = Config(signature_version='s3v4')
        if s3_region:
            s3_client = boto3.client('s3', config=s3_cfg, region_name=s3_region)
        else:
            s3_client = boto3.client('s3', config=s3_cfg)
    except Exception as e:
        print('Could not create S3 client:', e)
        return None

    try:
        s3_key = upload_to_s3_bytes(s3_client, bucket, key, gif_bytes)
        print(f'Uploaded GIF to s3://{bucket}/{s3_key}')
    except Exception as e:
        print('S3 upload failed for id=', id, e)
        return None

    # update DB
    try:
        conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        with conn.cursor() as cur:
             cur.execute('UPDATE public.characters SET gif_url_s3 = %s WHERE id = %s', (s3_key, id))
        conn.commit()
        conn.close()
        print(f'Updated DB id={id} gif_url_s3={s3_key}')
    except Exception as e:
        print('DB update failed for id=', id, e)
        return None

    # Also create an animated WebP
    try:
        webp_bytes = None
        try:
            webp_bytes = convert_to_webp(gif_bytes, input_fmt='gif')
        except Exception as e:
             # if gif conversion failed, maybe we can convert directly from mp4 bytes if available? 
             # For now just use gif_bytes
             print('WebP conversion failed for id=', id, e)
             webp_bytes = None

        if webp_bytes:
            webp_key = f'character_gifs/{id}.webp'
            try:
                webp_s3_key = upload_to_s3_bytes(s3_client, bucket, webp_key, webp_bytes)
                print(f'Uploaded WebP to s3://{bucket}/{webp_s3_key}')
                # update DB
                conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
                with conn.cursor() as cur:
                    cur.execute('UPDATE public.characters SET animated_webp_url_s3 = %s WHERE id = %s', (webp_s3_key, id))
                conn.commit()
                conn.close()
                print(f'Updated DB id={id} animated_webp_url_s3={webp_s3_key}')
            except Exception as e:
                print('S3 webp upload or DB update failed for id=', id, e)
    except Exception:
        pass

    return s3_key


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ids', help='Comma separated character ids to process')
    parser.add_argument('--names', help='Comma separated character names to process (exact match)')
    parser.add_argument('--all', action='store_true', help='Process all characters')
    parser.add_argument('--limit', type=int, default=0, help='Limit number processed')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    args = parser.parse_args()

    if not DATABASE_URL:
        print('DATABASE_URL not set in env (.env)')
        sys.exit(1)

    db_url = norm_db_url(DATABASE_URL)
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    cur = conn.cursor()

    image_col = guess_image_column(cur)
    cur.close()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    if args.all:
        q = f'SELECT * FROM public.characters ORDER BY id ASC'
        if args.limit and args.limit > 0:
            q += f' LIMIT {int(args.limit)}'
        cur.execute(q)
        rows = cur.fetchall()
    elif args.ids:
        ids = [int(i.strip()) for i in args.ids.split(',') if i.strip()]
        cur.execute('SELECT * FROM public.characters WHERE id = ANY(%s) ORDER BY id ASC', (ids,))
        rows = cur.fetchall()
    elif args.names:
        names = [i.strip() for i in args.names.split(',') if i.strip()]
        cur.execute('SELECT * FROM public.characters WHERE name = ANY(%s) ORDER BY id ASC', (names,))
        rows = cur.fetchall()
    else:
        print('Provide --all or --ids')
        sys.exit(1)

    # Run concurrently
    workers = max(1, int(args.workers))
    db_url = norm_db_url(DATABASE_URL)
    bucket = AWS_BUCKET

    processed = 0
    futures = []
    # Use ThreadPoolExecutor for concurrency
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as exe:
        for r in rows:
            if args.limit and args.limit > 0 and processed >= args.limit:
                break
            futures.append(exe.submit(generate_for_row, r, image_col, db_url, bucket, args.dry_run))
            processed += 1

        for fut in concurrent.futures.as_completed(futures):
            try:
                res = fut.result()
            except Exception as e:
                print('Worker exception:', e)
    time.sleep(0.5)

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
