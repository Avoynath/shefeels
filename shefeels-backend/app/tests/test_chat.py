"""
Unit tests for chat service and streaming endpoint.
"""
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_stream_message(monkeypatch):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/chats/1/messages/stream?content=hello")
        assert resp.status_code == 200
        # Should stream chunked response
        body = b"".join([chunk async for chunk in resp.aiter_bytes()])
        assert b"AI reply" in body
