import asyncio
import os
import httpx
import random
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://127.0.0.1:8000/api/v1"
ADMIN_EMAIL = "admin@tripleminds.co"
TOGETHER_API_KEY = os.getenv("TOGETHER_AI_API_KEY")

async def login(client):
    for pwd in ["admin1234", "admin"]:
        resp = await client.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": pwd})
        if resp.status_code == 200:
            return resp.json()["access_token"]
    return None

async def generate_name(client, ethnicity, gender, age, existing_first, existing_last):
    if not TOGETHER_API_KEY:
        return f"{ethnicity} {gender} {random.randint(100, 999)}"
    
    seed = random.randint(1, 100000)
    prompt = f"""
    Generate a unique, culturally appropriate full name (Firstname Lastname) for a {age} year old {ethnicity} {gender} character.
    Output ONLY THE NAME (First Last), nothing else. No punctuation, no explanation.
    Be very creative and unique. Avoid common names.
    Creativity Seed: {seed}
    Known names to avoid: {list(existing_first)[-40:]} / {list(existing_last)[-40:]}
    """
    
    try:
        response = await client.post(
            "https://api.together.xyz/v1/chat/completions",
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 1.0,
                "max_tokens": 30
            },
            headers={"Authorization": f"Bearer {TOGETHER_API_KEY}"},
            timeout=10.0
        )
        if response.status_code == 200:
            name = response.json()['choices'][0]['message']['content'].strip().split('\n')[0].replace('"', '').replace('.', '').strip()
            parts = name.split()
            if len(parts) >= 2:
                first = parts[0]
                last = parts[-1]
                if first not in existing_first and last not in existing_last:
                    return name
    except:
        pass
    return f"{ethnicity} {gender} {random.randint(100, 999)}"

async def repair():
    async with httpx.AsyncClient(timeout=60.0) as client:
        token = await login(client)
        if not token:
            print("Login failed")
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        
        print("Fetching characters...")
        all_characters = []
        page = 1
        while True:
            resp = await client.get(f"{BASE_URL}/characters/fetch-default?limit=100&page={page}", headers=headers)
            if resp.status_code != 200:
                print(f"Fetch failed on page {page}: {resp.status_code}")
                break
            
            data = resp.json()
            items = data.get("items", [])
            if not items:
                break
            
            all_characters.extend(items)
            if len(all_characters) >= data.get("total", 0):
                break
            page += 1

        existing_first = set()
        existing_last = set()
        for char in all_characters:
            name = char.get('name', '')
            parts = name.split()
            if len(parts) >= 2 and not any(c.isdigit() for c in name):
                existing_first.add(parts[0])
                existing_last.add(parts[-1])

        bad_chars = [c for c in all_characters if any(char.isdigit() for char in c.get('name', ''))]
        print(f"Found {len(bad_chars)} characters needing repair.")

        for char in bad_chars:
            print(f"Repairing character {char['id']} (Current: {char.get('name')})...")
            
            detail_resp = await client.get(f"{BASE_URL}/characters/fetch-by-id/{char['id']}", headers=headers)
            if detail_resp.status_code != 200:
                print(f"  Failed to fetch details for {char['id']}: {detail_resp.status_code}")
                continue
            
            detail_data = detail_resp.json()
            # The response is {"character": {...}}
            data = detail_data.get("character", {})
            ethnicity = data.get("ethnicity", "Unknown")
            gender = data.get("gender", "Female")
            age = data.get("age", 25)

            new_name = await generate_name(client, ethnicity, gender, age, existing_first, existing_last)
            new_username = new_name.lower().replace(" ", "_")
            
            parts = new_name.split()
            existing_first.add(parts[0])
            existing_last.add(parts[-1])

            update_payload = {
                "character_id": char['id'],
                "name": new_name,
                "username": new_username
            }
            
            update_resp = await client.post(f"{BASE_URL}/characters/edit-by-id", json=update_payload, headers=headers)
            if update_resp.status_code == 200:
                print(f"  [SUCCESS] Updated to: {new_name} (@{new_username})")
            else:
                print(f"  [FAILED] {update_resp.status_code} - {update_resp.text}")
            
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(repair())
