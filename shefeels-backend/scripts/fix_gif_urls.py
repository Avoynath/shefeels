#!/usr/bin/env python3
"""Fix gif_url_s3 and animated_webp_url_s3 to store S3 keys instead of full URLs.

This script converts existing full URLs like:
  https://aichat-pronily.s3.amazonaws.com/character_gifs/123.gif
to just the S3 key:
  character_gifs/123.gif
"""
import os
import sys
from urllib.parse import urlparse
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load env
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, os.pardir))
env_path = os.path.join(root, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print('DATABASE_URL not set')
    sys.exit(1)

# normalize for psycopg2
db_url = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')


def extract_s3_key(url):
    """Extract S3 key from a full URL like https://bucket.s3.amazonaws.com/path/to/file"""
    if not url or not isinstance(url, str):
        return url
    url = url.strip()
    # if it doesn't start with http, assume it's already a key
    if not url.startswith('http'):
        return url
    try:
        parsed = urlparse(url)
        # path starts with /, remove it
        key = parsed.path.lstrip('/')
        # also handle URL-encoded paths like https%3A//...
        if key.startswith('https%3A') or key.startswith('http%3A'):
            # this is double-encoded, try to extract the inner key
            # example: https://bucket/https%3A//bucket/character_gifs/123.gif
            # we want: character_gifs/123.gif
            inner_parts = key.split('character_gifs/')
            if len(inner_parts) > 1:
                return 'character_gifs/' + inner_parts[-1].split('?')[0]
        return key.split('?')[0]  # remove query params
    except Exception as e:
        print(f'Could not parse URL {url}: {e}')
        return url


def main():
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    cur = conn.cursor()

    # Find all characters with gif_url_s3 or animated_webp_url_s3 that start with http
    cur.execute("""
        SELECT id, gif_url_s3, animated_webp_url_s3 
        FROM characters 
        WHERE gif_url_s3 LIKE 'http%' OR animated_webp_url_s3 LIKE 'http%'
    """)
    rows = cur.fetchall()

    print(f'Found {len(rows)} characters with full URLs in gif_url_s3 or animated_webp_url_s3')

    for row in rows:
        id = row['id']
        gif_url = row.get('gif_url_s3')
        webp_url = row.get('animated_webp_url_s3')

        new_gif_key = extract_s3_key(gif_url) if gif_url else gif_url
        new_webp_key = extract_s3_key(webp_url) if webp_url else webp_url

        updates = []
        params = []

        if gif_url and gif_url.startswith('http') and new_gif_key != gif_url:
            updates.append('gif_url_s3 = %s')
            params.append(new_gif_key)
            print(f'  id={id[:8]}... gif_url_s3: {gif_url[:60]}... -> {new_gif_key}')

        if webp_url and webp_url.startswith('http') and new_webp_key != webp_url:
            updates.append('animated_webp_url_s3 = %s')
            params.append(new_webp_key)
            print(f'  id={id[:8]}... animated_webp_url_s3: {webp_url[:60]}... -> {new_webp_key}')

        if updates:
            params.append(id)
            update_stmt = f"UPDATE characters SET {', '.join(updates)} WHERE id = %s"
            cur.execute(update_stmt, params)

    conn.commit()
    print(f'\nUpdated {len(rows)} character records')
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
