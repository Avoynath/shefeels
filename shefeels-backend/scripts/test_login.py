
import httpx
import asyncio

LOGIN_URL = "http://127.0.0.1:8000/api/v1/auth/login"
ADMIN_EMAIL = "admin@tripleminds.co"
PASSWORD = "admin"

async def test_login():
    async with httpx.AsyncClient() as client:
        print(f"Testing login to {LOGIN_URL}")
        
        # Method 1: Form Data (Standard OAuth2)
        print("\n--- Method 1: Form Data (username/password) ---")
        try:
            resp = await client.post(
                LOGIN_URL,
                data={"username": ADMIN_EMAIL, "password": PASSWORD},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Error: {e}")

        # Method 2: JSON (Email/Password)
        print("\n--- Method 2: JSON (email/password) ---")
        try:
            resp = await client.post(
                LOGIN_URL,
                json={"email": ADMIN_EMAIL, "password": PASSWORD}
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Error: {e}")

        # Method 3: JSON (Username/Password)
        print("\n--- Method 3: JSON (username/password) ---")
        try:
            resp = await client.post(
                LOGIN_URL,
                json={"username": ADMIN_EMAIL, "password": PASSWORD}
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_login())
