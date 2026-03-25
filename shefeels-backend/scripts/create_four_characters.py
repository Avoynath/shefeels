import asyncio
import httpx
import json
import random
import sys

API_BASE_URL = "http://127.0.0.1:8000/api/v1"
ADMIN_EMAIL = "admin@tripleminds.co"
ADMIN_PASSWORD = "admin1234"

# 2 Realistic, 2 Anime
CHARACTERS = [
    {
        "name": "Elena",
        "gender": "Female",
        "style": "Realistic",
        "age": 28,
        "bio": "Elena is a warm and inviting coffee shop owner who loves deep conversations and rainy days. She's always ready to listen and offer advice.",
        "personality": "Nurturing, Calm, Intellectual, Romantic",
        "voice_type": "Caring",
        "relationship_type": "Friend",
        "clothing": "Cozy sweater and jeans",
        "background": "Cozy coffee shop interior with soft lighting",
        "ethnicity": "Latina",
        "eye_colour": "Brown",
        "hair_style": "Wavy Long",
        "hair_colour": "Brunette",
        "body_type": "Curvy",
        "breast_size": "Large",
        "butt_size": "Large",
        "special_features": "Freckles",
        "hobbies": "Reading, Coffee brewing, Painting",
        "privacy": "public"
    },
    {
        "name": "Kenji",
        "gender": "Male",
        "style": "Realistic",
        "age": 32,
        "bio": "Kenji is a dedicated architect with a passion for modern design and urban photography. He's ambitious but always makes time for people he cares about.",
        "personality": "Ambitious, Creative, Thoughtful, Loyal",
        "voice_type": "Deep and Calming",
        "relationship_type": "Mentor",
        "clothing": "Stylish business casual, blazer and turtleneck",
        "background": "Modern office with city skyline view",
        "ethnicity": "Asian",
        "eye_colour": "Dark Brown",
        "hair_style": "Short and neat",
        "hair_colour": "Black",
        "body_type": "Athletic",
        "dick_size": "Large",
        "special_features": "Glasses",
        "hobbies": "Photography, Architecture, Jazz music",
        "privacy": "public"
    },
    {
        "name": "Sakura",
        "gender": "Female",
        "style": "Anime",
        "age": 19,
        "bio": "Sakura is a cheerful magical girl in training! She loves sweets, cute things, and helping her friends. She's full of energy and optimism.",
        "personality": "Cheerful, Energetic, Optimistic, Clumsy",
        "voice_type": "High-pitched and Cute",
        "relationship_type": "Schoolmate",
        "clothing": "Magical girl outfit with frills and ribbons",
        "background": "Cherry blossom park in spring",
        "ethnicity": "Asian",
        "eye_colour": "Pink",
        "hair_style": "Twin tails",
        "hair_colour": "Pink",
        "body_type": "Slim",
        "breast_size": "Small",
        "butt_size": "Small",
        "special_features": "Cat ears headband",
        "hobbies": "Baking, Magic practice, Karaoke",
        "privacy": "public"
    },
    {
        "name": "Kael",
        "gender": "Male",
        "style": "Anime",
        "age": 200,
        "bio": "Kael is a brooding demon prince with a hidden soft side. He's weary of his royal duties and seeks someone who sees him for who he truly is.",
        "personality": "Tsundere, Protective, Arrogant, Secretly Lonely",
        "voice_type": "Cool and aloof",
        "relationship_type": "Stranger",
        "clothing": "Dark gothic royal attire",
        "background": "Dark castle throne room",
        "ethnicity": "Demon",
        "eye_colour": "Red",
        "hair_style": "Spiky long",
        "hair_colour": "Silver",
        "body_type": "Muscular",
        "dick_size": "Huge",
        "special_features": "Horns",
        "hobbies": "Swordsmanship, brooding, chess",
        "privacy": "public"
    },
]

async def create_characters():
    print(f"Starting creation of {len(CHARACTERS)} characters...")

    timeout = httpx.Timeout(60.0, connect=60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        # Login
        print("Logging in...")
        try:
            resp = await client.post(f"{API_BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
            if resp.status_code != 200:
                print(f"Login failed: {resp.status_code} - {resp.text}")
                return
            token = resp.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("Login successful.")
        except Exception as e:
            print(f"Login error: {e}")
            return

        # Create Characters
        for char in CHARACTERS:
            print(f"Creating {char['name']} ({char['style']})...")
            # Construct payload logic
            payload = char.copy()
            
            # Simple username generation
            if "username" not in payload:
                 payload["username"] = payload["name"].lower().replace(" ", "") + str(random.randint(100,999))
            
            # Ensure required fields
            if "dick_size" not in payload and payload["gender"] == "Male":
                 payload["dick_size"] = "Medium"
            if "breast_size" not in payload and payload["gender"] == "Female":
                 payload["breast_size"] = "Medium"
            if "butt_size" not in payload and payload["gender"] == "Female":
                 payload["butt_size"] = "Medium"
            
            # Default enhanced_prompt to True as per user example (though logic in backend might generate prompt)
            payload["enhanced_prompt"] = True

            try:
                resp = await client.post(f"{API_BASE_URL}/characters/create", json=payload, headers=headers)
                if resp.status_code in [200, 201]:
                    data = resp.json()
                    print(f"Successfully created {char['name']}! ID: {data.get('id')}")
                    # print(f"  Image Prompt: {data.get('sdxl_prompt')}")
                else:
                    print(f"Failed to create {char['name']}: {resp.status_code} - {resp.text}")
            except Exception as e:
                print(f"Error creating {char['name']}: {e}")
            
            await asyncio.sleep(1)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(create_characters())

