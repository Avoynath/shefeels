"""
Admin API endpoints for Hero Banner management.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, text
import logging

from app.api.v1.deps import get_db, require_admin
from app.models.hero_banner import HeroBanner, BannerCategoryEnum
from app.models.user import User
from app.schemas.hero_banner import (
    HeroBannerRead,
    HeroBannerCreate,
    HeroBannerUpdate,
)
from app.core.aws_s3 import get_s3_client
from app.services.app_config import get_config_value_from_cache, generate_id
import asyncio
from botocore.exceptions import ClientError

router = APIRouter()
logger = logging.getLogger(__name__)


import io
from PIL import Image
import json
from app.services.redis_cache import get_cached, set_cached, del_cached

async def upload_banner_to_s3(file: UploadFile, category: str) -> str:
    """Upload banner image to S3 and return the S3 key."""
    try:
        # Read file content
        content = await file.read()

        # Get S3 client and bucket
        s3_client = await get_s3_client()
        bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")
        
        # Generate ID for the file
        file_id = generate_id()

        # Define operation to run in thread
        def _process_and_upload():
            # Convert to WebP
            try:
                img = Image.open(io.BytesIO(content))
                
                # Convert to RGB if strictly necessary, but WebP handles RGBA (transparency) fine.
                # However, some formats like Palette-based might need conversion. 
                # Doing nothing usually works for WebP unless it's a weird mode.
                
                output = io.BytesIO()
                img.save(output, format="WEBP", quality=80, optimize=True)
                output.seek(0)
                webp_content = output.getvalue()
                
                s3_key = f"banners/{category}_{file_id}.webp"
                
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=s3_key,
                    Body=webp_content,
                    ContentType="image/webp",
                    ACL="public-read",
                )
                return s3_key
            except Exception as e:
                logger.error(f"Error processing image for banner: {e}")
                # Fallback to original if conversion fails? 
                # The user specifically requested WebP because PNG is heavy.
                # If conversion fails, it's better to fail the upload or fallback.
                # Let's fallback to original as a safety mechanism, but log error.
                # Actually, user wants WebP. Let's raise error if conversion fails to alert.
                raise e

        # Run conversion and upload in thread pool
        s3_key = await asyncio.to_thread(_process_and_upload)

        # Return public S3 URL
        region = await get_config_value_from_cache("AWS_REGION")
        s3_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"

        return s3_url

    except Exception as e:
        logger.error(f"Failed to upload banner to S3: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@router.get(
    "/banners",
    response_model=List[HeroBannerRead],
    dependencies=[Depends(require_admin)],
)
async def get_all_banners(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get all hero banners."""
    # Use raw SQL to avoid enum binding issues
    stmt = text(
        "SELECT id, category, image_url, mobile_image_url, heading, subheading, cta_text, cta_link, is_active, created_at, updated_at"
        " FROM hero_banners ORDER BY category"
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [dict(row._mapping) for row in rows]


@router.get(
    "/banners/{category}",
    response_model=HeroBannerRead,
    dependencies=[Depends(require_admin)],
)
async def get_banner_by_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get hero banner by category."""
    # Use raw SQL to avoid enum binding issues
    stmt = text(
        "SELECT id, category, image_url, mobile_image_url, heading, subheading, cta_text, cta_link, is_active, created_at, updated_at"
        " FROM hero_banners WHERE category = CAST(:cat AS banner_category_enum) LIMIT 1"
    )
    result = await db.execute(stmt, {"cat": category})
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=404, detail=f"Banner not found for category: {category}"
        )

    return dict(row._mapping)


@router.post(
    "/banners", response_model=HeroBannerRead, dependencies=[Depends(require_admin)]
)
async def create_banner(
    category: str = Form(...),
    heading: str = Form(...),
    subheading: Optional[str] = Form(None),
    cta_text: Optional[str] = Form(None),
    cta_link: Optional[str] = Form(None),
    is_active: bool = Form(True),
    image: UploadFile = File(...),
    mobile_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new hero banner with image upload."""

    # Validate category
    if category not in ["default", "male", "female", "trans", "middle", "middle_default", "middle_male", "middle_female", "middle_trans"]:
        raise HTTPException(status_code=400, detail="Invalid category")

    # Check if banner already exists for this category using raw SQL to avoid enum mapping issues
    check_stmt = text(
        "SELECT id FROM hero_banners WHERE category = CAST(:cat AS banner_category_enum) LIMIT 1"
    )
    result = await db.execute(check_stmt, {"cat": category})
    existing = result.first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Banner already exists for category: {category}. Use PUT to update.",
        )

    # Upload image to S3
    image_url = await upload_banner_to_s3(image, category)

    # Optionally upload a mobile-specific image
    mobile_image_url = None
    if mobile_image:
        mobile_image_url = await upload_banner_to_s3(mobile_image, category)

    # Create banner in database using raw SQL
    banner_id = generate_id()
    insert_stmt = text(
        "INSERT INTO hero_banners (id, category, image_url, mobile_image_url, heading, subheading, cta_text, cta_link, is_active, created_at, updated_at) "
        "VALUES (:id, CAST(:cat AS banner_category_enum), :image_url, :mobile_image_url, :heading, :subheading, :cta_text, :cta_link, :is_active, NOW(), NOW()) "
        "RETURNING id, category, image_url, mobile_image_url, heading, subheading, cta_text, cta_link, is_active, created_at, updated_at"
    )
    
    result = await db.execute(
        insert_stmt,
        {
            "id": banner_id,
            "cat": category,
            "image_url": image_url,
            "mobile_image_url": mobile_image_url,
            "heading": heading,
            "subheading": subheading,
            "cta_text": cta_text,
            "cta_link": cta_link,
            "is_active": is_active,
        },
    )
    await db.commit()
    banner = result.first()

    # Invalidate cache
    await del_cached(f"banner:public:{category}")

    return dict(banner._mapping)


@router.put(
    "/banners/{category}",
    response_model=HeroBannerRead,
    dependencies=[Depends(require_admin)],
)
async def update_banner(
    category: str,
    heading: Optional[str] = Form(None),
    subheading: Optional[str] = Form(None),
    cta_text: Optional[str] = Form(None),
    cta_link: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    image: Optional[UploadFile] = File(None),
    mobile_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update an existing hero banner."""

    # Find existing banner using raw SQL
    stmt = text(
        "SELECT id, category, image_url, mobile_image_url, heading, subheading, cta_text, cta_link, is_active, created_at, updated_at"
        " FROM hero_banners WHERE category = CAST(:cat AS banner_category_enum) LIMIT 1"
    )
    result = await db.execute(stmt, {"cat": category})
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=404, detail=f"Banner not found for category: {category}"
        )

    # Build update values
    update_values = {}
    if heading is not None:
        update_values["heading"] = heading
    if subheading is not None:
        update_values["subheading"] = subheading
    if cta_text is not None:
        update_values["cta_text"] = cta_text
    if cta_link is not None:
        update_values["cta_link"] = cta_link
    if is_active is not None:
        update_values["is_active"] = is_active

    # Upload new image if provided
    if image:
        image_url = await upload_banner_to_s3(image, category)
        update_values["image_url"] = image_url

    # Upload mobile image if provided
    if mobile_image:
        mobile_image_url = await upload_banner_to_s3(mobile_image, category)
        update_values["mobile_image_url"] = mobile_image_url

    # Perform update if there are changes
    if update_values:
        set_clauses = ", ".join([f"{key} = :{key}" for key in update_values.keys()])
        update_stmt = text(
            f"UPDATE hero_banners SET {set_clauses}, updated_at = NOW() "
            f"WHERE category = CAST(:cat AS banner_category_enum) RETURNING id, category, image_url, mobile_image_url, heading, subheading, cta_text, cta_link, is_active, created_at, updated_at"
        )
        update_values["cat"] = category
        result = await db.execute(update_stmt, update_values)
        await db.commit()
        updated_row = result.first()
        
        # Invalidate cache
        await del_cached(f"banner:public:{category}")
        
        return dict(updated_row._mapping)

    # No changes, return existing
    return dict(row._mapping)


@router.delete("/banners/{category}", dependencies=[Depends(require_admin)])
async def delete_banner(
    category: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete a hero banner by category."""

    # Use raw SQL to avoid enum issues
    stmt = text(
        "DELETE FROM hero_banners WHERE category = CAST(:cat AS banner_category_enum) RETURNING id"
    )
    result = await db.execute(stmt, {"cat": category})
    await db.commit()
    deleted_row = result.first()
    
    # Invalidate cache
    await del_cached(f"banner:public:{category}")

    if not deleted_row:
        raise HTTPException(
            status_code=404, detail=f"Banner not found for category: {category}"
        )

    return {"message": f"Banner for category '{category}' deleted successfully"}


# Public endpoint for frontend to fetch active banners
@router.get("/banners/public/{category}", response_model=HeroBannerRead)
async def get_public_banner(
    category: str,
    db: AsyncSession = Depends(get_db),
):
    """Get active hero banner by category (public endpoint)."""
    # Use raw SQL with explicit enum casting to avoid SQLAlchemy enum-name/value binding issues
    # Check Redis cache first
    cache_key = f"banner:public:{category}"
    cached_data = await get_cached(cache_key)
    if cached_data:
        return json.loads(cached_data)

    stmt = text(
        "SELECT id, category, image_url, mobile_image_url, heading, subheading, cta_text, cta_link, is_active, created_at, updated_at"
        " FROM hero_banners WHERE category = CAST(:cat AS banner_category_enum) AND is_active = true LIMIT 1"
    )
    result = await db.execute(stmt, {"cat": category})
    row = result.first()

    # REMOVED FALLBACK LOGIC to ensure we don't show default banner when specific one is missing
    # if not row: ...
    
    if not row:
        raise HTTPException(status_code=404, detail="No active banner found")

    # row is a RowMapping; convert to dict for response_model
    banner = dict(row._mapping)
    
    # Cache result (convert datetimes to str)
    banner_cache = banner.copy()
    if banner_cache.get('created_at'):
        banner_cache['created_at'] = banner_cache['created_at'].isoformat()
    if banner_cache.get('updated_at'):
        banner_cache['updated_at'] = banner_cache['updated_at'].isoformat()

    await set_cached(cache_key, json.dumps(banner_cache), ttl=600)
    
    return banner
