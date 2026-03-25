"""
Upload banner images to S3 and update the database with actual content.
"""

import asyncio
import boto3
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update, text
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.hero_banner import HeroBanner, BannerCategoryEnum
from app.core.config import settings

# We'll read AWS config from settings directly

# Banner content based on HeroSection.tsx
BANNER_CONFIG = {
    "default": {
        "heading": "Your Dream Girl Is Waiting… Free to Start",
        "subheading": "Choose her look, set her mood and start a honey conversation. No drama, no judgement",
        "cta_text": "Get GF Now!",
        "cta_link": "/create-character",
        "image_path": "hl-frontend/src/assets/home/female/main_banner-1920.avif",
        "mobile_image_path": "hl-frontend/src/assets/home/female/main_banner-768.avif",
    },
    "female": {
        "heading": "Create AI Girlfriend with Soul & Emotions",
        "subheading": "Build an AI girlfriend who talks, reacts, and connects the way you always wished someone would.",
        "cta_text": "Get Your GF Now!",
        "cta_link": "/create-character",
        "image_path": "hl-frontend/src/assets/home/female/main_banner-1920.avif",  # Same as default
        "mobile_image_path": "hl-frontend/src/assets/home/female/main_banner-768.avif",
    },
    "male": {
        "heading": "Experience Romance With Your Own AI Boyfriend",
        "subheading": "Create an AI boyfriend in seconds. He's here for the fun, the feelings, and everything in between.",
        "cta_text": "Get Your AI BF",
        "cta_link": "/create-character",
        "image_path": "hl-frontend/src/assets/home/male/main_banner-1920.avif",
        "mobile_image_path": "hl-frontend/src/assets/home/male/main_banner-768.avif",
    },
    "trans": {
        "heading": "AI Transgender Generator for Realistic, Custom Characters",
        "subheading": "Honey Love gives you the freedom to build the exact trans character you imagine. Design your perfect trans character in just a few taps",
        "cta_text": "Get Your AI companion",
        "cta_link": "/create-character",
        "image_path": "hl-frontend/src/assets/home/female/main_banner-1920.avif",  # Use default/female banner
        "mobile_image_path": "hl-frontend/src/assets/home/female/main_banner-768.avif",
    },
}


async def upload_image_to_s3(file_path: str, category: str) -> str:
    """Upload image to S3 and return the public URL."""

    # Get S3 configuration from settings and environment
    aws_region = os.getenv("AWS_REGION", "eu-north-1")
    bucket_name = os.getenv("AWS_BUCKET_NAME", "aichat-pronily")

    s3_client = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=aws_region,
    )

    # Resolve file path relative to project root
    project_root = Path(__file__).parent.parent.parent
    full_path = project_root / file_path

    if not full_path.exists():
        raise FileNotFoundError(f"Banner image not found: {full_path}")

    def _do_upload():
        # Read file
        with open(full_path, "rb") as f:
            content = f.read()

        # Generate S3 key
        file_extension = full_path.suffix.lstrip(".")
        s3_key = f"banners/{category}_main_banner.{file_extension}"

        # Upload to S3
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=content,
            ContentType="image/avif",
            ACL="public-read",
        )

        # Return public URL
        s3_url = f"https://{bucket_name}.s3.{aws_region}.amazonaws.com/{s3_key}"
        return s3_url

    result = await asyncio.to_thread(_do_upload)
    print(f"✓ Uploaded {category} banner to: {result}")
    return result


async def update_database():
    """Update database with banner content and images."""

    # Create async engine
    engine = create_async_engine(
        str(settings.DATABASE_URL),
        echo=False,
    )

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for category_str, config in BANNER_CONFIG.items():
            print(f"\n📝 Processing {category_str} banner...")

            # Upload image to S3
            try:
                image_url = await upload_image_to_s3(config["image_path"], category_str)
            except Exception as e:
                print(f"✗ Failed to upload {category_str} banner: {e}")
                continue

            # Update database using raw SQL to avoid enum issues
            # Optionally upload mobile image
            mobile_image_url = None
            mobile_path = config.get("mobile_image_path")
            if mobile_path:
                try:
                    mobile_image_url = await upload_image_to_s3(
                        mobile_path, category_str + "_mobile"
                    )
                except Exception as e:
                    print(f"✗ Failed to upload mobile image for {category_str}: {e}")

            await session.execute(
                text(
                    """
                    UPDATE hero_banners 
                    SET image_url = :image_url,
                        mobile_image_url = :mobile_image_url,
                        heading = :heading,
                        subheading = :subheading,
                        cta_text = :cta_text,
                        cta_link = :cta_link,
                        is_active = TRUE
                    WHERE category = CAST(:category AS banner_category_enum)
                """
                ),
                {
                    "image_url": image_url,
                    "mobile_image_url": mobile_image_url,
                    "heading": config["heading"],
                    "subheading": config["subheading"],
                    "cta_text": config["cta_text"],
                    "cta_link": config["cta_link"],
                    "category": category_str,
                },
            )
            print(f"✓ Updated {category_str} banner in database")

        await session.commit()
        print("\n✅ All banners updated successfully!")


if __name__ == "__main__":
    print("🚀 Starting banner upload and database update...\n")
    asyncio.run(update_database())
