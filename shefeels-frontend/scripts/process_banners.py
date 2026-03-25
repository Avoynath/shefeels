import os
from PIL import Image
from pathlib import Path

def process_banners():
    base_dir = Path("src/assets/Banner/Top Banner")
    
    if not base_dir.exists():
        print(f"Error: Directory not found: {base_dir}")
        return

    print(f"Processing images in: {base_dir}")

    # Desktop target dimensions
    DESKTOP_WIDTH = 1780
    DESKTOP_HEIGHT = 315
    DESKTOP_RATIO = DESKTOP_WIDTH / DESKTOP_HEIGHT

    for file_path in base_dir.rglob("*"):
        if file_path.suffix.lower() not in ['.png', '.jpg', '.jpeg']:
            continue
            
        filename = file_path.name
        stem = file_path.stem
        # Skip if already webp (though we look for png/jpg) or if it's a backup/copy we don't want?
        # User said "as they are in png".
        
        try:
            with Image.open(file_path) as img:
                # Convert to RGB if needed (e.g. RGBA for PNG to WebP is fine, but some modes issue)
                # WebP supports transparency, so keep RGBA if present.
                if img.mode == 'P':
                    img = img.convert('RGBA')
                
                original_width, original_height = img.size
                processed_img = None
                
                # Determine type based on filename
                is_desktop = "desktop" in filename.lower()
                is_mobile = "mobile" in filename.lower()

                if is_desktop:
                    print(f"Processing Desktop: {filename} ({original_width}x{original_height})")
                    
                    # Target: 1780x315
                    # Strategy: 
                    # 1. Resize so height = 315 (preserving ratio)
                    # 2. If width > 1780, crop from right.
                    # 3. If width < 1780, this is an issue. We might need to resize width to 1780 and crop height?
                    
                    current_ratio = original_width / original_height
                    
                    if current_ratio >= DESKTOP_RATIO:
                        # Image is wider or equal ratio. Resize by height.
                        new_height = DESKTOP_HEIGHT
                        new_width = int(original_width * (DESKTOP_HEIGHT / original_height))
                        resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                        
                        # Crop from right (keep left)
                        # Box: (left, upper, right, lower)
                        processed_img = resized.crop((0, 0, DESKTOP_WIDTH, DESKTOP_HEIGHT))
                        
                    else:
                        # Image is narrower/taller. Resize by width to cover 1780.
                        new_width = DESKTOP_WIDTH
                        new_height = int(original_height * (DESKTOP_WIDTH / original_width))
                        resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                        
                        # Crop height? Center ideally, or top?
                        # User said "crop ... from the right side". No instruction for vertical crop.
                        # Assuming center crop for vertical if needed, but to be safe and standard for banners,
                        # I'll center vertically.
                        top = (new_height - DESKTOP_HEIGHT) // 2
                        processed_img = resized.crop((0, top, DESKTOP_WIDTH, top + DESKTOP_HEIGHT))
                        print(f"  Warning: Image {filename} had to be cropped vertically.")

                elif is_mobile:
                    print(f"Processing Mobile: {filename} ({original_width}x{original_height})")
                    
                    # Target: 2:1 ratio (Width = Height * 2)
                    # Crop from right.
                    
                    target_width = original_height * 2
                    
                    if original_width >= target_width:
                        # Crop width from right
                        processed_img = img.crop((0, 0, target_width, original_height))
                    else:
                        # Width is too small for 2:1 height.
                        # Ex: 500x500. Target width 1000. Can't crop width to get 2:1.
                        # Check if we should crop height instead?
                        # Target height = width / 2
                        target_height = original_width // 2
                        # User said "crop ... only from the right side".
                        # If we assume "right side" constraint applies when we have excess width.
                        # If we have excess height, we crop bottom?
                        # I will assume "resolution of 2:1" is strict.
                        print(f"  Warning: Mobile image {filename} is too tall for 2:1 crop from width. Cropping height.")
                        processed_img = img.crop((0, 0, original_width, target_height))

                else:
                    print(f"Skipping {filename}: Not identified as Desktop or Mobile.")
                    continue

                if processed_img:
                    # Save as WebP
                    output_path = file_path.with_suffix('.webp')
                    processed_img.save(output_path, 'WEBP', quality=80)
                    print(f"  Saved to {output_path} ({processed_img.size})")

        except Exception as e:
            print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    process_banners()
