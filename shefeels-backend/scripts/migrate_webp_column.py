#!/usr/bin/env python3
"""
Migrate existing WebP data:
- Move WebP keys from image_url_s3 to webp_image_url_s3
- Restore PNG keys to image_url_s3 (by inferring from WebP path)
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
import sys
from dotenv import load_dotenv

load_dotenv()

def main():
    auto_yes = '--yes' in sys.argv or '-y' in sys.argv
    
    db_url = os.getenv('DATABASE_URL').replace('postgresql+asyncpg://', 'postgresql://')
    
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    cur = conn.cursor()
    
    # Get all characters with WebP in image_url_s3
    cur.execute("""
        SELECT id, name, image_url_s3 
        FROM characters 
        WHERE image_url_s3 LIKE '%.webp'
    """)
    
    characters = cur.fetchall()
    print(f"Found {len(characters)} characters with WebP in image_url_s3")
    print()
    
    if not characters:
        print("Nothing to migrate!")
        return
    
    # Ask for confirmation
    print("This will:")
    print("  1. Move WebP keys from image_url_s3 → webp_image_url_s3")
    print("  2. Restore PNG keys in image_url_s3")
    print()
    
    if not auto_yes:
        response = input("Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted.")
            return
    else:
        print("Auto-confirmed with --yes flag")
        print()
    
    migrated = 0
    errors = 0
    
    for char in characters:
        char_id = char['id']
        name = char['name']
        webp_key = char['image_url_s3']
        
        # Infer PNG key (replace .webp with .png)
        if webp_key.endswith('.webp'):
            png_key = webp_key[:-5] + '.png'
        else:
            print(f"  ✗ {char_id[:8]}... {name:30s} - Invalid WebP path")
            errors += 1
            continue
        
        try:
            # Update: move webp to new column, restore png to original column
            cur.execute("""
                UPDATE characters 
                SET image_url_s3 = %s, webp_image_url_s3 = %s 
                WHERE id = %s
            """, (png_key, webp_key, char_id))
            
            print(f"  ✓ {char_id[:8]}... {name:30s}")
            migrated += 1
            
        except Exception as e:
            print(f"  ✗ {char_id[:8]}... {name:30s} - Error: {e}")
            errors += 1
    
    conn.commit()
    conn.close()
    
    print()
    print("=" * 80)
    print(f"Migration complete!")
    print(f"  Migrated: {migrated}")
    print(f"  Errors: {errors}")
    print("=" * 80)

if __name__ == '__main__':
    main()
