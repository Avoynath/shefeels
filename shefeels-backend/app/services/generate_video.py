from app.services.app_config import get_config_value_from_cache
from app.core.config import settings
import httpx


async def generate_video(prompt, duration, image_url=None, negative_prompt=None):
    """Generate video using SugarLab's img2video API (wan-2-2-i2v model).

    Returns the job ID for async polling via get_job().
    """
    model_workflow = "wan-2-2-i2v"
    url = f"https://api.beta.apimarketplace.com/v1/generators/img2video/{model_workflow}"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": settings.SUGARLAB_API_KEY,
    }
    data = {
        "prompt": prompt,
        "duration": duration,
        "sync": False,
    }
    # Include image_url only when present (image-to-video).
    if image_url:
        data["firstFrame"] = image_url
    if negative_prompt:
        data["negativePrompt"] = negative_prompt

    print(f"Final prompt: {prompt}")
    print(f"API URL: {url}")
    print(f"Payload: {data}")

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers=headers, json=data)

        print(f"✅ API Response Status: {response.status_code}")
        if response.status_code not in [200, 201]:
            print(f"❌ API Error Response: {response.text}")
            raise Exception(f"Video generation API failed: {response.text}")
        else:
            print(f"✅ API Success Response: {response.text[:200]}...")

        return response.json()["id"]
    except Exception as e:
        print(f"❌ Unexpected error during video generation: {e}")
        raise
