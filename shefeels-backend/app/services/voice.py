import boto3
from botocore.exceptions import ClientError
from datetime import datetime
from app.core.config import settings
from app.services.app_config import get_config_value_from_cache
from app.core.aws_s3 import get_s3_client
# Optional: helper to upload MP3 to S3 or return public path
async def store_voice_to_s3(
    voice_type: str,  # "call" or "voice"
    name: str,
    mp3_bytes: bytes,
    user_id: str,
    folder_date: str,
    io_type: str,  # "input" or "output"
    bucket_name: str,
    s3_client=None
) -> str:
    """
    Save mp3 to S3 in the structure:
    voice-data/yyyy-mm-dd/user_id/input|output/<name>.mp3
    """
    if s3_client is None:
        s3_client = await get_s3_client()

    s3_key = f"{voice_type}/{folder_date}/{user_id}/{io_type}/{name}.mp3"

    try:
        s3_client.put_object(Bucket=bucket_name, Key=s3_key, Body=mp3_bytes, ContentType="audio/mpeg")
    except ClientError as e:
        raise RuntimeError(f"Failed to upload mp3 to S3: {e}")

    # Adjust the URL as per your S3 bucket's public access settings
    s3_url = f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"
    return s3_url