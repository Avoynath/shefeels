
import asyncio
import os
import pandas as pd
import httpx
import logging
import random
import json
import traceback
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# --- Configuration ---
BASE_URL = "http://127.0.0.1:8000/api/v1"
LOGIN_URL = f"{BASE_URL}/auth/login"
CREATE_CHAR_URL = f"{BASE_URL}/characters/create"
TOGETHER_API_KEY = os.getenv("TOGETHER_AI_API_KEY")

# Admin Credentials
ADMIN_EMAIL = "admin@tripleminds.co"
# In a real script, use env vars or prompt. Using the credential that worked.
ADMIN_PASSWORD = "admin" 

EXCEL_FILE = "characters.xlsx"
LIMIT = 2  # Number of characters to import

def safe_str(val):
    if pd.isna(val) or val == "":
        return ""
    return str(val).strip()

def safe_int(val):
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

async def generate_name_with_llm(client: httpx.AsyncClient, ethnicity: str, gender: str, age: str) -> str:
    """Generates a culturally appropriate name using Together AI."""
    if not TOGETHER_API_KEY:
        logger.warning("TOGETHER_AI_API_KEY not found. Using random name fallback.")
        return f"{ethnicity} {gender} {random.randint(100, 999)}"

    # Prompt for the LLM
    prompt = f"""
    Generate a single, culturally appropriate name for a {age} year old {ethnicity} {gender} character.
    Output ONLY the name, nothing else. No punctuation, no explanation.
    """
    
    try:
        response = await client.post(
            "https://api.together.xyz/v1/chat/completions",
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 20
            },
            headers={"Authorization": f"Bearer {TOGETHER_API_KEY}"},
            timeout=10.0
        )
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content'].strip()
            # Clean up: remove quotes, periods, newlines
            name = content.split('\n')[0].replace('"', '').replace('.', '').replace("'", "").strip()
            # Ensure it's not empty or too long
            if name and len(name) < 20: 
                return name
    except Exception as e:
        logger.error(f"LLM Name Gen Failed: {e}")
    
    # Fallback
    return f"{ethnicity} {random.randint(100, 999)}"

async def login(client):
    """Logs in and returns the access token."""
    logger.info(f"Logging in as {ADMIN_EMAIL}...")
    
    # Validated: Backend uses @router.post("/login") with LoginRequest model (JSON)
    # It attempts to find user by email: stmt = select(User).where(User.email == req.email.lower())
    
    try:
        response = await client.post(
            LOGIN_URL,
            json={"email": ADMIN_EMAIL, "password": "admin1234"},
        )
        if response.status_code == 200:
            logger.info("Login successful (json/admin1234).")
            return response.json()["access_token"]
        else:
             logger.error(f"Login failed: {response.status_code} - {response.text}")
             
             # Fallback: Try 'admin' just in case
             if response.status_code == 401:
                logger.info("Retrying with password 'admin'...")
                response = await client.post(
                    LOGIN_URL,
                    json={"email": ADMIN_EMAIL, "password": "admin"},
                )
                if response.status_code == 200:
                    logger.info("Login successful (json/admin).")
                    return response.json()["access_token"]

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
    
    # Process only the top N rows
    df_subset = df.head(LIMIT)
    logger.info(f"Processing {len(df_subset)} characters.")

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
            
            logger.info(f"[{index+1}/{LIMIT}] Generating name for {ethnicity} {gender}...")
            name = await generate_name_with_llm(client, ethnicity, gender, age)
            
            username = f"{name.lower()}_{random.randint(1000, 9999)}"

            # Construct Bio if missing
            bio = safe_str(row.get("Bio"))
            personality = safe_str(row.get("Personality", ""))
            if not bio:
                bio = f"A {age}-year-old {ethnicity} {gender}. {personality}."

            payload = {
                "name": name,
                "username": username,
                "gender": gender,
                "age": safe_int(age),
                "ethnicity": ethnicity,
                "hair_style": safe_str(row.get("Hair Style")),
                "hair_colour": safe_str(row.get("Hair Colour")),
                "eye_colour": safe_str(row.get("Eye Colour")),
                "body_type": safe_str(row.get("Body Type")),
                "breast_size": safe_str(row.get("Breast Size")),
                "butt_size": safe_str(row.get("Butt Size")),
                "personality": personality,
                "bio": bio,
                "clothing": safe_str(row.get("Clothing")),
                "special_features": safe_str(row.get("Special Features")),
                "is_public": True,
                "enhanced_prompt": True 
            }

            logger.info(f"  Creating: {name} ({ethnicity}) - Username: {username}")
            
            try:
                # 60s timeout for image gen
                response = await client.post(CREATE_CHAR_URL, json=payload, headers=headers, timeout=60.0)
                
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

if __name__ == "__main__":
    if asyncio.get_event_loop_policy().__class__.__name__ == 'WindowsProactorEventLoopPolicy':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(import_characters())
