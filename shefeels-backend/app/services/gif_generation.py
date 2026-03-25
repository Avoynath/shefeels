"""
Background video generation service for characters using Kie.ai Wan 2.5 API.
"""

import os
import logging
import asyncio
import requests
import json
from app.core.aws_s3 import get_s3_client, generate_presigned_url, upload_to_s3_file
from io import BytesIO
from app.services.kie_client import kie_client

logger = logging.getLogger("app.video_generation")

# Model configuration
KIE_MODEL = "wan/2-5-image-to-video"

def _find_first_url(json_str: str) -> str | None:
    """Parse resultJson to find the first URL."""
    try:
        if not json_str:
            return None
        data = json.loads(json_str)
        if isinstance(data, dict):
             # Check for common result keys
             if "resultUrls" in data:
                 urls = data["resultUrls"]
                 if isinstance(urls, list) and len(urls) > 0:
                     return urls[0]
             # Fallback: scan values
             for v in data.values():
                 if isinstance(v, str) and v.startswith("http"):
                     return v
                 if isinstance(v, list) and len(v) > 0 and isinstance(v[0], str) and v[0].startswith("http"):
                     return v[0]
    except Exception as e:
        logger.error(f"Error parsing resultJson: {e}")
    return None

async def generate_gif_for_character(
    character_id: str, 
    image_s3_key: str, 
    bucket_name: str,
    video_prompt: str
) -> str | None:
    """
    Generate MP4 video for a character using Kie.ai (Wan 2.5).
    
    Returns:
        mp4_key (str): S3 key for the uploaded MP4 file.
    """
    if not kie_client.api_key:
        logger.error("[VIDEO] KIE_API_KEY not available")
        return None

    try:
        logger.info(f"[VIDEO] Starting generation for character {character_id} using Kie.ai")

        # Generate presigned URL for input image (valid for 1 hour)
        image_url = await generate_presigned_url(s3_key=image_s3_key, expires_in=3600)
        
        # Prepare input data for Kie.ai
        input_data = {
            "prompt": video_prompt,
            "image_url": image_url,
            "duration": "5",
            "resolution": "1080p", # User requested "properly", defaulting to high quality
            "enable_prompt_expansion": True
        }

        logger.info(f"[VIDEO] Calling Kie.ai for character {character_id} with prompt: {video_prompt[:50]}...")
        
        # Create Task
        # Not using a callback URL for now, relying on polling as per current architecture
        response = await kie_client.create_task(KIE_MODEL, input_data)
        task_id = response['data']['taskId']
        logger.info(f"[VIDEO] Task created. Task ID: {task_id}")
        
        # Poll for completion
        result = await kie_client.wait_for_completion(task_id)
        
        # Extract video URL from resultJson
        result_json = result.get("resultJson")
        video_url = _find_first_url(result_json)
        
        if not video_url:
            raise RuntimeError(f"Could not find video URL in result: {result_json}")
            
        logger.info(f"[VIDEO] Got video URL: {video_url[:100]}...")

        # Download video
        def download_video():
            r = requests.get(video_url, timeout=180)
            r.raise_for_status()
            return r.content

        mp4_bytes = await asyncio.to_thread(download_video)
        logger.info(f"[VIDEO] Downloaded MP4: {len(mp4_bytes)} bytes")

        # Upload MP4 to S3 directly
        mp4_key = f"character_videos/{character_id}.mp4"
        
        file_obj = BytesIO(mp4_bytes)
        
        uploaded_key, _ = await upload_to_s3_file(
            file_obj=file_obj,
            s3_key=mp4_key,
            content_type="video/mp4",
            bucket_name=bucket_name
        )
        
        logger.info(f"[VIDEO] Uploaded MP4 to s3://{bucket_name}/{uploaded_key}")
        return uploaded_key

    except Exception as e:
        logger.error(
            f"[VIDEO] Generation failed for character {character_id}: {e}", exc_info=True
        )
        return None
