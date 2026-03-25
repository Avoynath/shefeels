import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://127.0.0.1:8000/api/v1"
ADMIN_EMAIL = "admin@tripleminds.co"
ADMIN_PASSWORD = "admin1234" # Try this first

async def get_token():
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if resp.status_code == 200:
            return resp.json()["access_token"]
        # Fallback
        resp = await client.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": "admin"})
        if resp.status_code == 200:
            return resp.json()["access_token"]
    return None

async def list_bad_characters():
    token = await get_token()
    if not token:
        print("Login failed")
        return

    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        # Assuming there's a list endpoint with some limit
        resp = await client.get(f"{BASE_URL}/characters/explore?limit=200", headers=headers)
        if resp.status_code != 200:
            print(f"Failed to fetch characters: {resp.status_code}")
            return
        
        characters = resp.json()
        if "items" in characters:
            characters = characters["items"]

        bad_chars = []
        for char in characters:
            name = char.get("name", "")
            # Check if name contains numbers (fallback pattern)
            if any(c.isdigit() for c in name):
                bad_chars.append(char)
        
        print(f"Found {len(bad_chars)} characters with bad names.")
        for char in bad_chars:
            print(f"ID: {char['id']}, Name: {char['name']}, Username: {char['username']}")

if __name__ == "__main__":
    asyncio.run(list_bad_characters())
