import requests
from app.services.app_config import get_config_value_from_cache
from app.core.config import settings
from typing import Any, Union
from together import Together

# Initialize Together client only if API key is provided
client = None
if settings.TOGETHER_AI_API_KEY:
    client = Together(api_key=settings.TOGETHER_AI_API_KEY)

async def generate_llm_response(messages: list) -> str | None:
    """
    Generate a simple text response from the LLM.
    """
    if not client:
        print("Together AI client not initialized.")
        return None

    try:
        chat_model_id = await get_config_value_from_cache("CHAT_GEN_MODEL")
        if not chat_model_id:
            chat_model_id = "meta-llama/Llama-3.3-70B-Instruct-Turbo" # Fallback

        response = client.chat.completions.create(
            model=chat_model_id,
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            frequency_penalty=0.5,
            presence_penalty=0.5,
        )

        return response.choices[0].message.content
    except Exception as e:
        print(f"Error in generate_llm_response: {e}")
        return None

async def generate_structured_llm_response(
    messages: list, schema: Union[dict, None] = None
) -> Any:
    if not client:
        raise ValueError(
            "Together AI client not initialized. Please set TOGETHER_AI_API_KEY in environment."
        )

    chat_model_id = await get_config_value_from_cache("CHAT_GEN_MODEL")
    if not chat_model_id:
         chat_model_id = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

    try:
        response = client.chat.completions.create(
            model=chat_model_id,  # JSON-mode supported
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            frequency_penalty=0.5,
            presence_penalty=0.5,
            response_format={"type": "json_schema", "schema": schema},
        )

        llm_output = response.choices[0].message.content
        return llm_output
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        return None
    except Exception as err:
        print(f"Other error occurred: {err}")
        return None
