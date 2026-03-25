import asyncio
import os
import pandas as pd
import httpx
import logging
import random
import traceback
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# --- Configuration ---
BASE_URL = "http://localhost:8000/api/v1"
LOGIN_URL = f"{BASE_URL}/auth/login"
CREATE_CHAR_URL = f"{BASE_URL}/characters/create"
TOGETHER_API_KEY = os.getenv("TOGETHER_AI_API_KEY")

# Admin Credentials
ADMIN_EMAIL = "admin@tripleminds.co"
ADMIN_PASSWORD = "admin@1234" # Using admin as per user script, or fallback logic

EXCEL_FILE = "characters.xlsx"
LIMIT = None  # None for all characters

def safe_str(val):
    if pd.isna(val) or val == "":
        return ""
    return str(val).strip()

def safe_int(val):
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

async def generate_name_with_llm(client: httpx.AsyncClient, ethnicity: str, gender: str, age: str, existing_first_names: set, existing_last_names: set) -> str:
    """Generates a culturally appropriate First Name and Last Name using Together AI."""
    if not TOGETHER_API_KEY:
        logger.warning("TOGETHER_AI_API_KEY not found. Using random name fallback.")
        return f"{ethnicity} {gender} {random.randint(100, 999)}"

    seed = random.randint(1, 100000)
    prompt = f"""
    Generate a unique, culturally appropriate full name (Firstname Lastname) for a {age} year old {ethnicity} {gender} character.
    Output ONLY THE NAME (First Last), nothing else. No punctuation, no explanation.
    Be very creative and unique. Avoid common or generic names.
    Creativity Seed: {seed}
    Avoid these first names: {list(existing_first_names)[-40:]}
    Avoid these last names: {list(existing_last_names)[-40:]}
    """
    
    for _ in range(5): # Retry more times for strictness
        try:
            response = await client.post(
                "https://api.together.xyz/v1/chat/completions",
                json={
                    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 1.0, # High temp for variety
                    "max_tokens": 30
                },
                headers={"Authorization": f"Bearer {TOGETHER_API_KEY}"},
                timeout=10.0
            )
            if response.status_code == 200:
                content = response.json()['choices'][0]['message']['content'].strip()
                # Clean up: remove quotes, periods, newlines
                name = content.split('\n')[0].replace('"', '').replace('.', '').replace("'", "").strip()
                
                parts = name.split()
                if len(parts) >= 2:
                    first = parts[0]
                    last = parts[-1]
                    
                    # Validation: Both names must be unique
                    if first not in existing_first_names and last not in existing_last_names:
                        return f"{first} {last}"
                    else:
                        logger.warning(f"Generated part of '{name}' is duplicate. Retrying...")

        except Exception as e:
            logger.error(f"LLM Name Gen Failed: {e}")
            await asyncio.sleep(1)
    
    # Fallback to random if retries fail
    fallback_first = f"{ethnicity}{random.randint(100, 999)}"
    fallback_last = f"{gender}{random.randint(100, 999)}"
    return f"{fallback_first} {fallback_last}"

async def login(client):
    """Logs in and returns the access token."""
    logger.info(f"Logging in as {ADMIN_EMAIL}...")
    
    try:
        # Try admin1234 first
        response = await client.post(
            LOGIN_URL,
            json={"email": ADMIN_EMAIL, "password": "admin@1234"},
        )
        if response.status_code == 200:
            logger.info("Login successful (json/admin1234).")
            return response.json()["access_token"]
        
        # Try 'admin' as fallback
        if response.status_code == 401:
            logger.info("Retrying with password 'admin'...")
            response = await client.post(
                LOGIN_URL,
                json={"email": ADMIN_EMAIL, "password": "admin"},
            )
            if response.status_code == 200:
                logger.info("Login successful (json/admin).")
                return response.json()["access_token"]
        
        logger.error(f"Login failed: {response.status_code} - {response.text}")

    except Exception as e:
         logger.error(f"Login error: {e}")
         traceback.print_exc()

    logger.error(f"All login attempts failed.")
    return None

async def import_characters():
    if not os.path.exists(EXCEL_FILE):
        logger.error(f"File not found: {EXCEL_FILE}")
        return

    logger.info(f"Reading Excel: {EXCEL_FILE}")
    df = pd.read_excel(EXCEL_FILE)
    df = df.loc[(df['Type'] == 'Realistic') & (df['Gender'] == 'Male')]
    #df = df.iloc[2:]
    # Process all rows if LIMIT is None
    LIMIT = 30
    if LIMIT:
        df_subset = df.head(LIMIT)
    else:
        df_subset = df

    logger.info(f"Processing {len(df_subset)} characters.")

    existing_first_names = set()
    existing_last_names = set()

    async with httpx.AsyncClient(timeout=60.0) as client:
        token = await login(client)
        if not token:
            return

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        for index, row in df_subset.iterrows():
            ethnicity = safe_str(row.get("Ethnicity", "Unknown"))
            gender = safe_str(row.get("Gender", "Female"))
            age = safe_str(row.get("Age", "25"))
            
            logger.info(f"[{index+1}/{len(df_subset)}] Generating name for {ethnicity} {gender}...")
            name = await generate_name_with_llm(client, ethnicity, gender, age, existing_first_names, existing_last_names)
            
            parts = name.split()
            existing_first_names.add(parts[0])
            existing_last_names.add(parts[-1])
            
            # Username: firstname_lastname (lowercase, no spaces, no numbers)
            username = name.lower().replace(" ", "_")
            # If username exists in batch (unlikely with full names but possible), append slight var
            # check logic isn't strictly needed if names are unique, but for safety:
            # We trust generate_name_with_llm to give unique names mostly.

            # Construct Bio if missing
            bio = safe_str(row.get("Bio"))
            personality = safe_str(row.get("Personality", ""))
            if not bio:
                bio = f"A {age}-year-old {ethnicity} {gender}. {personality}."

            # Map fields correctly based on inspection
            # Excel: Clothes, Special Feature
            # Schema: clothing, special_features
            
            payload = {
                "name": name,
                "username": username,
                "gender": gender,
                "age": safe_int(age),
                "ethnicity": ethnicity,
                "style": safe_str(row.get("Type", "Realistic")), # Added style
                "hair_style": safe_str(row.get("Hair Style")),
                "hair_colour": safe_str(row.get("Hair Colour")),
                "eye_colour": safe_str(row.get("Eye Colour")),
                "body_type": safe_str(row.get("Body Type")),
                "breast_size": safe_str(row.get("Breast Size")),
                "butt_size": safe_str(row.get("Butt Size")),
                "dick_size": safe_str(row.get("Dick Size")), # Added dick size
                "personality": personality,
                "bio": bio,
                "clothing": safe_str(row.get("Clothes")), # Fixed mapping
                "special_features": safe_str(row.get("Special Feature")), # Fixed mapping
                "privacy": "public", # Correct field name
                "enhanced_prompt": True,
                "voice_type": safe_str(row.get("Voice")), # Added voice
                "relationship_type": safe_str(row.get("Relationship")), # Added relationship
                "background": safe_str(row.get("Background")), # Added background
                "hobbies": safe_str(row.get("Hobbies")) # Added hobbies
            }
            
            # Remove empty keys to let defaults handle it or validation pass
            payload = {k: v for k, v in payload.items() if v is not None and v != ""}

            logger.info(f"  Creating: {name} ({ethnicity}) - Username: {username}")
            
            try:
                # 60s timeout for image gen
                response = await client.post(CREATE_CHAR_URL, json=payload, headers=headers, timeout=120.0)
                
                if response.status_code in [200, 201]:
                    char_data = response.json()
                    char_id = char_data.get("id") or char_data.get("data", {}).get("id")
                    logger.info(f"  [SUCCESS] Created {name} (ID: {char_id})")
                else:
                    logger.error(f"  [FAILED] {response.status_code} - {response.text}")

            except httpx.ReadTimeout:
                logger.warning("  [TIMEOUT] Request timed out (likely generating image in background).")
            except Exception as e:
                logger.error(f"  [ERROR] {e}")
            
            # Small delay
            await asyncio.sleep(2)

if __name__ == "__main__":
    if asyncio.get_event_loop_policy().__class__.__name__ == 'WindowsProactorEventLoopPolicy':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(import_characters())
