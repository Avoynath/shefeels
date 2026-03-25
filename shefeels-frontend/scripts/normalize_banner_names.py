import os
from pathlib import Path

def normalize_banner_filenames():
    """
    Normalize banner filenames to a consistent format:
    - Format: {category}_{type}_{gender}_{device}.{ext}
    Examples:
      top_anime_men_desktop.webp
      middle_real_women_mobile.png
    """
    banners_root = Path("src/assets/Banner")
    
    if not banners_root.exists():
        print(f"Error: Directory not found: {banners_root}")
        return

    print(f"Normalizing filenames in: {banners_root}\n")

    renames = []

    # Iterate through all files in the Banner directory recursively
    for file_path in banners_root.rglob("*"):
        if not file_path.is_file():
            continue
            
        # Skip the scripts themselves if they happen to be in there (unlikely)
        if file_path.suffix == '.py':
            continue

        filename = file_path.name
        parent_str = str(file_path.parent)
        
        # 1. Determine category (top or middle)
        if "Top Banner" in parent_str:
            category = "top"
        elif "Middle Banner" in parent_str:
            category = "middle"
        else:
            continue

        # 2. Determine type (anime or real)
        if "Anime Banner" in parent_str or "anime" in filename.lower():
            banner_type = "anime"
        elif "Real Banner" in parent_str or "real" in parent_str.lower():
            banner_type = "real"
        else:
            # For Real Banner, sometimes the parent is just "Men" or "Women" inside "Real Banner"
            if "Real Banner" in parent_str:
                banner_type = "real"
            else:
                banner_type = "real" # Default to real if not explicit anime

        # 3. Determine gender (check women/female/girl first)
        clean_lower = filename.lower().replace("copie de ", "")
        if "women" in clean_lower or "female" in clean_lower or "girl" in clean_lower:
            gender = "women"
        elif "men" in clean_lower or "male" in clean_lower:
            gender = "men"
        elif "trans" in clean_lower:
            gender = "trans"
        else:
            # Try to infer from parent directory if filename is vague
            if "Women" in parent_str:
                gender = "women"
            elif "Men" in parent_str:
                gender = "men"
            else:
                print(f"Warning: Could not determine gender for {file_path}")
                continue
        
        # 4. Determine device
        if "mobile" in clean_lower:
            device = "mobile"
        else:
            # If not mobile, it's desktop (common for banners)
            device = "desktop"
        
        # 5. Create new filename
        ext = file_path.suffix.lower()
        new_filename = f"{category}_{banner_type}_{gender}_{device}{ext}"
        new_path = file_path.parent / new_filename
        
        # Skip if already normalized
        if file_path.name == new_filename:
            continue
        
        renames.append((file_path, new_path))

    if not renames:
        print("No files need renaming. All filenames are already normalized.")
        return
    
    print(f"Found {len(renames)} files to rename.")
    
    # Execute renames
    for old_path, new_path in renames:
        try:
            # If target exists (maybe from a previous failed run or conflicting names), 
            # we should handle it. For now, let's print and rename if possible.
            if new_path.exists():
                print(f"⚠ Target already exists, skipping: {new_path.name}")
                continue
                
            old_path.rename(new_path)
            print(f"✓ {old_path.name} -> {new_path.name}")
        except Exception as e:
            print(f"✗ Error renaming {old_path.name}: {e}")

if __name__ == "__main__":
    normalize_banner_filenames()
