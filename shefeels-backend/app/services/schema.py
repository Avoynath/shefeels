# ---------------------------
# JSON Schema for structured output
# ---------------------------
SCHEMA_CHAT = {
    "type": "object",
    "properties": {
        "chat_output": {
            "type": "string",
            "description": "A short AI character response (1–2 sentences).",
        },
        "generate_image": {
            "type": "string",
            "enum": ["true", "false"],
            "description": "true if the user explicitly requests an image, otherwise false.",
        }
    },
    "required": ["chat_output", "generate_image"],
    "additionalProperties": False,
}






SCHEMA_TEXT_TO_IMAGE_PROMPT_ENHANCE = {
    "type": "object",
    "properties": {
        "identity": {
            "type": "string",
            "description": "identity(name, age, gender) description of the image to generate",
        },
        "appearance": {
            "type": "string",
            "description": "appearance(body type, skin tone, hair style/color, breast/butt/dick size) description of the image to generate",
        },
        "clothing": {
            "type": "string",
            "description": "clothing/outfit description of the image to generate",
        },
        "settings": {
            "type": "string",
            "description": "background and scene description of the image to generate",
        },
    },
    "required": ["clothing", "settings"],
    "additionalProperties": False,
}


SCHEMA_CHARACTER_CREATION_SDXL = {
    "type": "object",
    "properties": {
        "sdxl_prompt": {
            "type": "string",
            "description": "A highly detailed, descriptive natural language prompt for Flux image generation. Do NOT use weights. Write in full sentences. Describe the character with seductive, hot, and attractive vibes. MANDATORY: The character must be CLOTHED (NO nudity in this base image), but can be sexy.",
        },
        "video_prompt": {
            "type": "string",
            "description": "A 50-60 word description for generating a video of the character. Focus on seductive movements, expressions, and ambience. MUST be enticing, hot, and NSFW. Describe slow, sensual motions.",
        },
        "name": {"type": "string", "description": "Character's name"},
        "age": {"type": "integer", "description": "Character's age in years"},
        "gender": {"type": "string", "description": "Character's gender"},
        "ethnicity": {
            "type": "string",
            "description": "Expanded ethnicity description with visual traits"
        },
        "realism_score": {
            "type": "string",
            "description": "Realism descriptor, e.g. 'photorealistic', 'cinematic', 'anime style'"
        },
        "physique": {
            "type": "string",
            "description": "Complete physical description including body type, features, proportions"
        },
        "clothing": {
            "type": "string",
            "description": "Stylish, hot, and attractive clothing. Seductive but MUST BE CLOTHED (No Nudity)."
        },
        "personality": {
            "type": "string",
            "description": "Personality traits and behavioral characteristics"
        },
        "bio": {
            "type": "string",
            "description": "Character biography - EXACTLY 50-60 words, concise and descriptive."
        },
        "looking_for": {
            "type": "string",
            "description": "A short phrase (3-6 words) describing what the user is 'looking for' in this character (e.g., 'A safe, non-judgemental space', 'Thrilling late-night adventures')."
        },
    },
    "required": [
        "sdxl_prompt",
        "video_prompt",
        "name",
        "age",
        "gender",
        "ethnicity",
        "realism_score",
        "physique",
        "clothing",
        "personality",
        "bio",
        "looking_for",
    ],
    "additionalProperties": False,
}

SCHEMA_CHARACTER_CREATION_IMAGE_ONLY = {
    "type": "object",
    "properties": {
        "sdxl_prompt": {
            "type": "string",
            "description": "A highly detailed, descriptive natural language prompt for Flux image generation. Do NOT use weights. Write in full sentences. Describe the character with seductive, hot, and attractive vibes. MANDATORY: The character must be CLOTHED (NO nudity in this base image), but can be sexy.",
        },
         "clothing": {
            "type": "string",
            "description": "Stylish, hot, and attractive clothing. Seductive but MUST BE CLOTHED (No Nudity)."
        },
        "settings": {
            "type": "string",
            "description": "Background, scene, environment, and lighting details for the new image"
        }
    },
    "required": ["sdxl_prompt", "clothing", "settings"],
    "additionalProperties": False,
}

SCHEMA_CHARACTER_CREATION_METADATA_ONLY = {
    "type": "object",
    "properties": {
        "character_names": {
            "type": "array",
            "items": {"type": "string"},
            "description": "A list of 10 creative, fitting first names for the character based on their ethnicity, gender, and personality. Should be a realistic human name, 1-2 words max.",
            "minItems": 10,
            "maxItems": 10
        },
        "video_prompt": {
            "type": "string",
            "description": "A 50-60 word description for generating a video. Focus on seductive movements: pressing breasts together, touching neck/body, very sensual but clothed.",
        },
        "bio": {
            "type": "string",
            "description": "Character biography - EXACTLY 50-60 words, concise and descriptive."
        },
        "personality": {
            "type": "string",
            "description": "Personality traits and behavioral characteristics"
        },
        "looking_for": {
            "type": "string",
            "description": "A short phrase (3-6 words) describing what the user is 'looking for' in this character (e.g., 'A safe, non-judgemental space', 'Thrilling late-night adventures')."
        }
    },
    "required": ["character_names", "video_prompt", "bio", "personality", "looking_for"],
    "additionalProperties": False,
}


SCHEMA_PROMPT_GENERATION = {
    "type": "object",
    "properties": {
        "prompt": {
            "type": "string",
            "description": "The generated highly detailed image generation prompt.",
        }
    },
    "required": ["prompt"],
    "additionalProperties": False,
}

SCHEMA_PROMPT_MODEL_WORKFLOW_GENERATION = {
    "type": "object",
    "properties": {
        "prompt": {
            "type": "string",
            "description": "The generated highly detailed image generation prompt.",
        },
        "mode": {
            "type": "string",
            "enum": ["PRO", "ESSENTIAL"],
            "description": "The classification mode (PRO or ESSENTIAL) based on content scanning."
        }
    },
    "required": ["prompt", "mode"],
    "additionalProperties": False,
}


SCHEMA_CHARACTER_TO_IMAGE_GEN_PROMPT_IN_CHAT = {
    "type": "object",
    "properties": {
        "prompt": {"type": "string", "description": "Prompt for generating an image."},
        "mode": {
            "type": "string",
            "enum": ["PRO", "ESSENTIAL"],
            "description": "The classification mode (PRO or ESSENTIAL) based on content scanning."
        }
    },
    "required": ["prompt", "mode"],
    "additionalProperties": False,
}

SCHEMA_EXTRACT_CHAT_IMAGE_PARAMS = {
    "type": "object",
    "properties": {
        "outfit": {
            "type": "string",
            "description": "Description of the character's outfit. If not specified, return 'default'.",
        },
        "pose": {
            "type": "string",
            "description": "Description of the character's pose. If not specified, return 'default'.",
        },
        "action": {
            "type": "string",
            "description": "Description of the character's action. If not specified, return 'default'.",
        },
        "accessories": {
            "type": "string",
            "description": "Description of accessories. If not specified, return 'default'.",
        },
        "background": {
            "type": "string",
            "description": "Description of the background/setting. If not specified, return 'default'.",
        },
        "settings": {
            "type": "string",
            "description": "A concise description of the overall scene settings (background + environment). If not specified, return 'default'.",
        },
        "mode": {
            "type": "string",
            "enum": ["PRO", "ESSENTIAL"],
            "description": "The classification mode (PRO or ESSENTIAL) based on content scanning."
        }
    },
    "required": ["outfit", "pose", "action", "accessories", "background", "settings", "mode"],
    "additionalProperties": False,
}
