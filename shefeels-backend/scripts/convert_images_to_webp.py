#!/usr/bin/env python3
"""Convert character PNG images to WebP format for faster loading.

This script:
1. Downloads existing PNG images from S3
2. Converts them to WebP format (lossy compression for smaller size)
3. Uploads WebP versions to S3
4. Updates database to use WebP images instead of PNGs

Usage:
  python convert_images_to_webp.py --all
  python convert_images_to_webp.py --ids 1,2,5
  python convert_images_to_webp.py --limit 10
  python convert_images_to_webp.py --dry-run
"""
import os
import sys
import argparse
import tempfile
import subprocess
import concurrent.futures
from urllib.parse import urlparse

import boto3
from botocore.config import Config
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import requests

# Load env
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, os.pardir))
env_path = os.path.join(root, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')
AWS_BUCKET = os.environ.get('S3_BUCKET') or os.environ.get('AWS_S3_BUCKET') or 'aichat-pronily'


def norm_db_url(url: str) -> str:
    if not url:
        raise RuntimeError('DATABASE_URL not set')
    return url.replace('postgresql+asyncpg://', 'postgresql://')


def convert_to_webp(input_bytes: bytes, quality: int = 85) -> bytes:
    """Convert image bytes to WebP format using ffmpeg.
    
    Args:
        input_bytes: Input image bytes (PNG, JPEG, etc.)
        quality: WebP quality (0-100, higher = better quality but larger size)
                 85 is a good balance between quality and file size
    """
    in_path = None
    out_path = None
    try:
        # Write input to temp file
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as in_f:
            in_f.write(input_bytes)
            in_path = in_f.name

        # Create output temp file
        fd, out_path = tempfile.mkstemp(suffix='.webp')
        os.close(fd)

        # Convert using ffmpeg
        cmd = [
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-i', in_path,
            '-c:v', 'libwebp',
            '-quality', str(quality),
            '-preset', 'default',
            out_path,
        ]
        try:
            result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        except FileNotFoundError:
            raise RuntimeError('ffmpeg not found. Install ffmpeg to enable WebP conversion.')
        except subprocess.TimeoutExpired:
            raise RuntimeError('ffmpeg conversion timed out after 30 seconds')

        # Read converted file
        with open(out_path, 'rb') as f:
            webp_bytes = f.read()
        
        return webp_bytes
    finally:
        # Cleanup temp files
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


def download_s3_object(s3_client, bucket: str, key: str) -> bytes:
    """Download an object from S3 and return its bytes."""
    import io
    buffer = io.BytesIO()
    s3_client.download_fileobj(Bucket=bucket, Key=key, Fileobj=buffer)
    buffer.seek(0)
    return buffer.read()


def upload_to_s3_bytes(s3_client, bucket: str, key: str, data: bytes, content_type: str = 'image/webp') -> str:
    """Upload bytes to S3 and return the S3 key."""
    s3_client.put_object(Bucket=bucket, Key=key, Body=data, ACL='public-read', ContentType=content_type)
    return key


def extract_s3_key(url_or_key: str) -> str:
    """Extract S3 key from a full URL or return the key if already a key."""
    if not url_or_key or not isinstance(url_or_key, str):
        return url_or_key
    url_or_key = url_or_key.strip()
    
    # If it doesn't start with http, assume it's already a key
    if not url_or_key.startswith('http'):
        return url_or_key
    
    try:
        parsed = urlparse(url_or_key)
        key = parsed.path.lstrip('/')
        return key.split('?')[0]  # Remove query params
    except Exception:
        return url_or_key


def convert_character_image(row, db_url, bucket, quality=85, dry_run=False):
    """Convert a single character's PNG image to WebP.
    
    Returns tuple: (character_id, old_size_bytes, new_size_bytes, webp_key)
    """
    char_id = row['id']
    image_s3 = row.get('image_url_s3')
    
    if not image_s3:
        print(f"  Skipping {char_id[:8]}... (no image)")
        return None
    
    # Extract S3 key
    s3_key = extract_s3_key(image_s3)
    
    # Skip if already WebP
    if s3_key.lower().endswith('.webp'):
        print(f"  Skipping {char_id[:8]}... (already WebP)")
        return None
    
    # Skip if not PNG/JPG
    if not (s3_key.lower().endswith('.png') or s3_key.lower().endswith('.jpg') or s3_key.lower().endswith('.jpeg')):
        print(f"  Skipping {char_id[:8]}... (unsupported format: {s3_key})")
        return None
    
    try:
        # Create S3 client
        s3_region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION')
        s3_cfg = Config(signature_version='s3v4')
        if s3_region:
            s3_client = boto3.client('s3', config=s3_cfg, region_name=s3_region)
        else:
            s3_client = boto3.client('s3', config=s3_cfg)
        
        # Download original image
        print(f"  Processing {char_id[:8]}... {s3_key}")
        original_bytes = download_s3_object(s3_client, bucket, s3_key)
        original_size = len(original_bytes)
        
        # Convert to WebP
        webp_bytes = convert_to_webp(original_bytes, quality=quality)
        webp_size = len(webp_bytes)
        
        # Calculate savings
        savings_pct = ((original_size - webp_size) / original_size * 100) if original_size > 0 else 0
        
        # Generate new S3 key (replace extension with .webp)
        base_key = s3_key.rsplit('.', 1)[0]
        webp_key = f"{base_key}.webp"
        
        print(f"    Original: {original_size / 1024:.1f}KB -> WebP: {webp_size / 1024:.1f}KB (saved {savings_pct:.1f}%)")
        
        if dry_run:
            print(f"    [DRY RUN] Would upload to s3://{bucket}/{webp_key}")
            return (char_id, original_size, webp_size, webp_key)
        
        # Upload WebP to S3
        upload_to_s3_bytes(s3_client, bucket, webp_key, webp_bytes)
        print(f"    ✓ Uploaded to s3://{bucket}/{webp_key}")
        
        # Update database - store WebP in separate column, keep original PNG
        conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        with conn.cursor() as cur:
            cur.execute('UPDATE characters SET webp_image_url_s3 = %s WHERE id = %s', (webp_key, char_id))
        conn.commit()
        conn.close()
        print(f"    ✓ Updated database")
        
        return (char_id, original_size, webp_size, webp_key)
        
    except Exception as e:
        print(f"    ✗ Error processing {char_id[:8]}...: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description='Convert character PNG images to WebP')
    parser.add_argument('--all', action='store_true', help='Process all characters')
    parser.add_argument('--ids', help='Comma-separated character IDs to process')
    parser.add_argument('--limit', type=int, default=0, help='Limit number of characters to process')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality (0-100, default: 85)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    args = parser.parse_args()

    if not DATABASE_URL:
        print('ERROR: DATABASE_URL not set in environment')
        sys.exit(1)

    db_url = norm_db_url(DATABASE_URL)
    
    # Connect and fetch characters
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    cur = conn.cursor()

    if args.all:
        query = "SELECT id, image_url_s3 FROM characters WHERE image_url_s3 IS NOT NULL ORDER BY id ASC"
        if args.limit > 0:
            query += f" LIMIT {args.limit}"
        cur.execute(query)
    elif args.ids:
        ids = [i.strip() for i in args.ids.split(',') if i.strip()]
        cur.execute(
            "SELECT id, image_url_s3 FROM characters WHERE id = ANY(%s) ORDER BY id ASC",
            (ids,)
        )
    else:
        print('ERROR: Specify --all or --ids')
        cur.close()
        conn.close()
        sys.exit(1)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    print(f"\n{'='*70}")
    print(f"Converting {len(rows)} character images to WebP")
    print(f"Quality: {args.quality}, Workers: {args.workers}")
    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")
    print(f"{'='*70}\n")

    # Process in parallel
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = []
        for row in rows:
            future = executor.submit(convert_character_image, row, db_url, AWS_BUCKET, args.quality, args.dry_run)
            futures.append(future)
        
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
                if result:
                    results.append(result)
            except Exception as e:
                print(f"  ✗ Worker exception: {e}")

    # Print summary
    if results:
        total_original = sum(r[1] for r in results)
        total_webp = sum(r[2] for r in results)
        total_savings = total_original - total_webp
        savings_pct = (total_savings / total_original * 100) if total_original > 0 else 0
        
        print(f"\n{'='*70}")
        print(f"SUMMARY")
        print(f"{'='*70}")
        print(f"Processed: {len(results)} images")
        print(f"Original size: {total_original / (1024*1024):.2f} MB")
        print(f"WebP size: {total_webp / (1024*1024):.2f} MB")
        print(f"Total savings: {total_savings / (1024*1024):.2f} MB ({savings_pct:.1f}%)")
        print(f"{'='*70}\n")
    else:
        print("\nNo images were processed.")


if __name__ == '__main__':
    main()
