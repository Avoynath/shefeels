from pydantic import ValidationError
import sys

payload = {
    "name": "My AI Girl",
    "username": None,
    "bio": "",
    "gender": "Female",
    "style": "Realistic",
    "ethnicity": None,
    "age": 21,
    "eye_colour": None,
    "hair_style": None,
    "hair_colour": None,
    "body_type": None,
    "breast_size": None,
    "butt_size": None,
    "dick_size": None,
    "personality": "Libido: 50%, Kink Openness: 50%, Comfort with Nudity: 50%, Kinks: , Scenarios: , Spicy Photos: No, Voice Messages: No, Special Videos: No",
    "voice_type": None,
    "relationship_type": "Girlfriend",
    "privacy": None,
    "clothing": None,
    "picture_shot_type": "Upper Body",
    "special_features": None,
    "hobbies": None,
    "background": None,
    "enhanced_prompt": None,
    "looking_for": None
}

try:
    # Need to append the current directory to sys.path to import app
    sys.path.append('d:/Documents/GitHub/honeylove/hl-backend')
    from app.schemas.character import CharacterCreate
    CharacterCreate(**payload)
    print("Schema Validation Success")
except ValidationError as e:
    print("VALIDATION ERROR:")
    print(e.json())
except Exception as e:
    print("OTHER ERROR:", e)
