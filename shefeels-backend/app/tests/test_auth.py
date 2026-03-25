"""
Unit tests for signup and login endpoints.
"""
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_signup(monkeypatch):
    async def mock_create_user(*args, **kwargs):
        return {"id": 1, "email": "test@example.com", "is_active": True, "role": "user"}
    monkeypatch.setattr("app.services.auth.AuthService.create_user", mock_create_user)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/signup", json={"email": "test@example.com", "password": "pw"})
        assert resp.status_code in (200, 201)
        assert resp.json()["email"] == "test@example.com"

@pytest.mark.asyncio
async def test_login(monkeypatch):
    async def mock_login(*args, **kwargs):
        return {"access_token": "abc", "refresh_token": "def", "token_type": "bearer"}
    monkeypatch.setattr("app.services.auth.AuthService.login", mock_login)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "pw"})
        assert resp.status_code == 200
        assert "access_token" in resp.json()
