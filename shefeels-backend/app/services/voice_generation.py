"""
Voice generation service for creating unique character voices using ElevenLabs.
"""

import logging
import json
import base64
from typing import Optional
from elevenlabs.client import ElevenLabs
from together import Together
from app.services.app_config import get_config_value_from_cache
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Together client for voice prompt generation
together_client = None
if settings.TOGETHER_AI_API_KEY:
    together_client = Together(api_key=settings.TOGETHER_AI_API_KEY)


async def generate_voice_prompt_from_character_data(
    prompt_enhanced: Optional[str],
    character_name: str,
    character_age: int,
    character_gender: str,
    personality: str,
    voice_type: str,
    bio: Optional[str] = None,
) -> str:
    """
    Generate ElevenLabs voice description using LLM with structured output.

    Args:
        prompt_enhanced: AI-enhanced character prompt (can be JSON string or text)
        character_name: Character's name
        character_age: Character's age
        character_gender: Character's gender (Male/Female/Other)
        personality: Character's personality traits
        voice_type: User-selected voice type (Naughty, Flirty, etc.)
        bio: Character's bio/background

    Returns:
        Detailed voice description string for ElevenLabs API
    """
    logger.info(f"[VOICE GEN] Generating voice prompt for character: {character_name}")

    # Use Together AI to generate voice description with structured output
    if not together_client:
        logger.error("[VOICE GEN] Together AI client not available")
        raise ValueError(
            "Together AI client not initialized. Cannot generate voice prompt."
        )

    try:
        chat_model_id = await get_config_value_from_cache("CHAT_GEN_MODEL")

        # JSON Schema for voice description
        schema = {
            "type": "object",
            "properties": {
                "voice_description": {
                    "type": "string",
                    "description": "A detailed voice description for ElevenLabs API including tone, pitch, pace, accent, emotional qualities, and character essence. Must be 150-300 characters.",
                }
            },
            "required": ["voice_description"],
            "additionalProperties": False,
        }

        # Build context for LLM
        context = f"""Character: {character_name}
Age: {character_age}
Gender: {character_gender}
Personality: {personality}
Voice Type: {voice_type}
Bio: {bio or 'Not provided'}"""

        if prompt_enhanced:
            # Extract first 300 chars of enhanced prompt
            enhanced_snippet = (
                prompt_enhanced[:300] if isinstance(prompt_enhanced, str) else ""
            )
            context += f"\nEnhanced Prompt: {enhanced_snippet}"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a voice-description expert for ElevenLabs text-to-voice API. "
                    "Your task: generate deeply expressive, natural-sounding voice descriptions tailored for "
                    "characters engaging in intimate, one-on-one conversations. The descriptions should cover: "
                    "age, gender, ethnicity/accent, vocal timbre, pitch range, pacing, emotional tone, speech style, "
                    "and whispery/soft delivery if suited. Be vivid and evocative — like stage directions for a voice actor."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Generate a voice description for this character:\n\n"
                    f"{context}\n\n"
                    "The description should be 150–300 characters long, "
                    "suitable as a prompt to ElevenLabs Voice Design to create a unique voice that matches the character "
                    "for deep, intimate conversation scenes."
                ),
            },
        ]

        logger.info(f"[VOICE GEN] Calling Together AI for voice description")

        response = together_client.chat.completions.create(
            model=chat_model_id,
            messages=messages,
            temperature=0.7,
            response_format={"type": "json_schema", "schema": schema},
        )

        llm_output = response.choices[0].message.content
        logger.info(f"[VOICE GEN] Together AI response: {llm_output[:100]}...")

        # Parse JSON response
        result = json.loads(llm_output)
        voice_description = result.get("voice_description", "")

        if not voice_description or len(voice_description) < 50:
            logger.error(f"[VOICE GEN] LLM returned invalid description")
            raise ValueError("LLM returned empty or too short voice description")

        logger.info(
            f"[VOICE GEN] Generated voice prompt (length: {len(voice_description)})"
        )
        return voice_description.strip()

    except Exception as e:
        logger.exception(f"[VOICE GEN] Failed to generate voice prompt with LLM: {e}")
        raise


async def create_elevenlabs_voice(
    voice_description: str,
    voice_name: str,
    sample_text: str = "Hello! It's wonderful to meet you. I'm so excited to chat with you today and get to know you better. This is a sample text to preview how my voice sounds when I speak. I hope you enjoy our conversation together and find my voice pleasant to listen to. Let me know what you think!",
) -> Optional[str]:
    """
    Create a permanent voice on ElevenLabs using text-to-voice API with SDK.

    Args:
        voice_description: Detailed description of desired voice characteristics
        voice_name: Name to assign to the voice
        sample_text: Text for voice preview generation

    Returns:
        voice_id (string) if successful, None if failed
    """
    try:
        api_key = await get_config_value_from_cache("ELEVENLABS_API_KEY")
        if not api_key or api_key.startswith("sk_example"):
            logger.warning(
                "[VOICE GEN] ⚠️ ElevenLabs API key not configured, skipping voice generation"
            )
            return None

        logger.info(f"[VOICE GEN] Creating ElevenLabs voice: {voice_name}")

        # Initialize ElevenLabs client
        client = ElevenLabs(api_key=api_key)

        # Step 1: Design voice with preview
        logger.info(
            f"[VOICE GEN] Calling ElevenLabs design API with description: {voice_description[:100]}..."
        )

        design = client.text_to_voice.design(
            model_id="eleven_multilingual_ttv_v2",
            voice_description=voice_description,
            text=sample_text,
        )

        if not design.previews or len(design.previews) == 0:
            logger.error("[VOICE GEN] ❌ No voice previews returned from ElevenLabs")
            return None

        preview = design.previews[0]
        generated_voice_id = preview.generated_voice_id

        if not generated_voice_id:
            logger.error("[VOICE GEN] ❌ No generated_voice_id in preview response")
            return None

        logger.info(
            f"[VOICE GEN] Voice preview generated with ID: {generated_voice_id}"
        )

        # Step 2: Create permanent voice
        logger.info(f"[VOICE GEN] Creating permanent voice with name: {voice_name}")

        voice = client.text_to_voice.create(
            voice_name=voice_name,
            voice_description=voice_description,
            generated_voice_id=generated_voice_id,
        )

        voice_id = voice.voice_id

        if not voice_id:
            logger.error("[VOICE GEN] ❌ No voice_id returned from create endpoint")
            return None

        logger.info(f"[VOICE GEN] ✅ Successfully created ElevenLabs voice: {voice_id}")
        return voice_id

    except Exception as e:
        # Check for voice limit reached error
        err_str = str(e).lower()
        if "voice_limit_reached" in err_str or "maximum amount of custom voices" in err_str:
            logger.warning(
                f"[VOICE GEN] ⚠️ ElevenLabs custom voice limit reached (10/10). Skipping custom voice creation for {voice_name}."
            )
            # We return None, and the caller (finalize_character_background) will keep the random stock voice assigned during creation.
            return None
            
        logger.exception(f"[VOICE GEN] ❌ Failed to create ElevenLabs voice: {e}")
        return None
