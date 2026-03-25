from datetime import datetime
from app.core.config import settings
from io import BytesIO
from app.services.app_config import get_config_value_from_cache
import boto3
import urllib.parse
from botocore.exceptions import ClientError
from app.core.config import settings  # or wherever your settings are
import asyncio
from app.services import redis_cache
import logging
import subprocess
import tempfile
import os
from botocore.config import Config
logger = logging.getLogger("app.aws_s3")


async def get_s3_client():
    """
    Create and return an S3 client using credentials from settings.
    """
    aws_region = settings.AWS_REGION
    # boto3 client creation is fast; calls below will be wrapped in threads.
    s3_client = boto3.client("s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=aws_region,
        config=Config(signature_version='s3v4')
    )
    return s3_client

# async def generate_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
#     """
#     Generate a pre-signed URL for accessing an S3 object.
#     """
#     s3_client = await get_s3_client()
#     bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")

#     try:
#         presigned_url = s3_client.generate_presigned_url(
#             ClientMethod="get_object",
#             Params={"Bucket": bucket_name, "Key": s3_key},
#             ExpiresIn=expires_in
#         )
#     except ClientError as e:
#         raise RuntimeError(f"Failed to generate pre-signed URL: {e}")

#     return presigned_url


async def generate_presigned_url(
    s3_key: str, 
    expires_in: int | None = None,
    client: any = None,
    bucket_name: str | None = None
) -> str:
    """
    Generate a pre-signed URL for accessing an S3 object.
    """
    # If no key provided, return None early so callers can handle missing images.
    # This prevents botocore from raising when Key is None.
    if not s3_key:
        return None
    # Determine expiry (allow callers to override; otherwise use configured default)
    if expires_in is None:
        expires_in = settings.S3_PRESIGNED_EXPIRES

    # Check Redis cache first
    try:
        cached = await redis_cache.get_presigned(s3_key)
        if cached:
            return cached
    except Exception as e:
        logger.debug("Presigned cache lookup failed: %s", e)

    try:
        if client is None:
            s3_client = await get_s3_client()
        else:
            s3_client = client

        if bucket_name is None:
            bucket_nm = await get_config_value_from_cache("AWS_BUCKET_NAME") or settings.AWS_BUCKET_NAME
        else:
            bucket_nm = bucket_name

        # Removed asyncio.to_thread as per optimization request; URL signing is fast and CPU-bound but light.
        url = s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket_nm, "Key": s3_key},
            ExpiresIn=expires_in,
        )

        # cache the presigned url (shorter than expiry to be safe). Cap the
        # cache ttl to a reasonable maximum so cached entries don't stay
        # indefinitely. Use 1 day (86400s) cap for long expiries.
        try:
            await redis_cache.set_presigned(s3_key, url, ttl=min(max(expires_in - 60, 0), 86400))
        except Exception:
            logger.debug("Failed to set presigned url in cache")

        return url
    except ClientError as e:
        raise RuntimeError(f"Failed to generate pre-signed URL: {e}")


async def generate_public_s3_url(s3_key: str, bucket_name: str | None = None) -> str | None:
    """
    Generate a public S3 URL for an object with public-read ACL.
    This is faster than presigning and works for publicly accessible objects like GIFs.
    Returns None if s3_key is None/empty.
    """
    if not s3_key:
        return None
    if bucket_name is None:
        bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME") or settings.AWS_BUCKET_NAME
    # URL-encode the key but preserve slashes
    encoded_key = urllib.parse.quote(s3_key, safe='/')
    return f"https://{bucket_name}.s3.amazonaws.com/{encoded_key}"
    

async def get_file_from_s3_url(s3_url: str, s3_client=None) -> BytesIO:
    """
    Download a file from S3 using a public or known S3 URL.
    Returns the file content as a BytesIO object.
    """

    if s3_client is None:
        s3_client = await get_s3_client()

    # Parse bucket name and key from the URL
    parsed_url = urllib.parse.urlparse(s3_url)
    
    if not parsed_url.netloc.endswith("s3.amazonaws.com"):
        raise ValueError("Invalid S3 URL format.")

    # Extract bucket name and key
    bucket_name = parsed_url.netloc.split('.')[0]  # e.g., my-bucket
    s3_key = parsed_url.path.lstrip('/')  # Remove leading slash

    try:
        buffer = BytesIO()

        def _download():
            s3_client.download_fileobj(Bucket=bucket_name, Key=s3_key, Fileobj=buffer)

        await asyncio.to_thread(_download)
        buffer.seek(0)  # Reset pointer before returning
        return buffer
    except ClientError as e:
        raise RuntimeError(f"Failed to download file from S3: {e}")


async def upload_to_s3_file(
    file_obj,                 # file-like object (e.g., from request.files['audio'])
    s3_key: str,        
    content_type: str,
    bucket_name: str,
    s3_client=None
) -> str:
    """
    Upload a file-like object to S3 and return a pre-signed URL for access.
    """
    if s3_client is None:
        s3_client = await get_s3_client()

    logger.info(f"Uploading to S3: {s3_key}")

    try:
        def _upload():
            s3_client.upload_fileobj(
                Fileobj=file_obj,
                Bucket=bucket_name,
                Key=s3_key,
                ExtraArgs={"ContentType": content_type}
            )

        await asyncio.to_thread(_upload)
    except ClientError as e:
        raise RuntimeError(f"Failed to upload file to S3: {e}")
    presigned_url = await generate_presigned_url(s3_key)
    return s3_key, presigned_url


async def delete_s3_object(s3_key: str, s3_client=None) -> None:
    """
    Delete a single S3 object specified by its key.
    This runs the blocking boto3 call in a thread to avoid blocking the event loop.
    """
    if not s3_key:
        return
    if s3_client is None:
        s3_client = await get_s3_client()

    bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME") or settings.AWS_BUCKET_NAME

    def _delete():
        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)

    try:
        await asyncio.to_thread(_delete)
        logger.info("Deleted S3 object: %s", s3_key)
    except ClientError as e:
        # Log but do not raise to avoid leaving DB in inconsistent state
        logger.warning("Failed to delete S3 object %s: %s", s3_key, e)



def convert_image_to_webp(input_file, quality: int = 85) -> BytesIO:
    """
    Convert an image file object to WebP format.
    Returns a BytesIO object containing the WebP data.
    """
    from PIL import Image
    
    # Ensure we're at the start of the file
    if hasattr(input_file, 'seek'):
        input_file.seek(0)
    
    with Image.open(input_file) as img:
        out_buffer = BytesIO()
        # Convert to RGB if necessary (e.g. for RGBA pngs checking alpha or just safety)
        # WebP handles transparency, so RGBA is fine.
        img.save(out_buffer, format="WEBP", quality=quality)
        out_buffer.seek(0)
        return out_buffer

async def convert_and_upload_webp(
    png_s3_key: str,
    quality: int = 85,
    bucket_name: str = None,
    s3_client = None
) -> str | None:
    """
    Download an image (PNG/JPG/etc) from S3, convert it to WebP, and upload the WebP version.
    Returns the WebP S3 key or None if conversion fails.
    This runs as a background task.
    """
    try:
        if s3_client is None:
            s3_client = await get_s3_client()
        if bucket_name is None:
            bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME") or settings.AWS_BUCKET_NAME

        logger.info(f"[WEBP] Starting background WebP conversion for {png_s3_key}")

        # Download image from S3
        img_data_io = BytesIO()
        
        def _download():
            s3_client.download_fileobj(bucket_name, png_s3_key, img_data_io)
        
        await asyncio.to_thread(_download)
        
        # Determine new key
        base_name = png_s3_key.rsplit('.', 1)[0]
        webp_s3_key = f"{base_name}.webp"
        
        def _convert():
            return convert_image_to_webp(img_data_io, quality)

        webp_buffer = await asyncio.to_thread(_convert)
        
        # Upload WebP to S3
        def _upload():
            s3_client.upload_fileobj(
                Fileobj=webp_buffer,
                Bucket=bucket_name,
                Key=webp_s3_key,
                ExtraArgs={"ContentType": "image/webp"}
            )
        
        await asyncio.to_thread(_upload)
        
        logger.info(f"[WEBP] ✅ Successfully converted and uploaded WebP: {webp_s3_key}")
        return webp_s3_key

    except Exception as e:
        logger.error(f"[WEBP] ❌ Failed to convert {png_s3_key} to WebP: {e}")
        return None


