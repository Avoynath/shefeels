import asyncio
import sys
from types import SimpleNamespace
import pytest

# Ensure imports find the app package by adding backend to sys.path when running tests
if 'backend' not in sys.path:
    sys.path.insert(0, 'backend')

from app.api.v1.endpoints import chats as chats_module
from app.schemas.chat import ChatCreate
from app.models.chat import ChatMessage


class FakeResult:
    def __init__(self, obj):
        self._obj = obj

    def scalar_one_or_none(self):
        return self._obj

    def scalars(self):
        class S:
            def __init__(self, v):
                self._v = v
            def all(self):
                return self._v
            def first(self):
                return self._v
        return S(self._obj)


class FakeDB:
    def __init__(self, character_obj, should_have_chat_messages=False):
        self.character = character_obj
        self.added = []
        self._messages = []

    async def execute(self, stmt):
        # The endpoint first queries for the character by id
        return FakeResult(self.character)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return True

    async def refresh(self, obj):
        return None


class FakeUser:
    def __init__(self, id):
        self.id = id


@pytest.mark.asyncio
async def test_owner_can_start_chat():
    # Arrange: character owned by user id 10 (use plain object to avoid SQLAlchemy mapper init)
    from types import SimpleNamespace as SN
    char = SN(id=1, user_id=10, name="Alice", bio="", gender="Female", image_url_s3=None, style=None, ethnicity=None, age=None, eye_colour=None, hair_style=None, hair_colour=None, body_type=None, breast_size=None, butt_size=None, dick_size=None, personality=None, voice_type=None, relationship_type=None, clothing=None, special_features=None)

    fake_db = FakeDB(char)
    user = SimpleNamespace(id=10)
    chat_payload = ChatCreate(session_id="sess_test", character_id=1, user_query="Hello")

    # Act: should not raise HTTPException
    # Monkeypatch external dependencies to be no-ops / safe values
    async def fake_get_headers_api():
        return {"API-Key": "test"}
    chats_module.get_headers_api = fake_get_headers_api

    async def fake_get_config(key):
        # Return small values to avoid heavy processing
        return 5 if key == "CHAT_HISTORY_LIMIT" else ""
    chats_module.get_config_value_from_cache = fake_get_config

    # Stub image generation and deduction as async functions
    async def fake_generate_image(*a, **k):
        return SimpleNamespace(status_code=200, json=lambda: {"data": {"images_data": [""]}})
    chats_module.generate_image = fake_generate_image

    async def fake_deduhl_user_coins(db, user_id, media_type='chat'):
        return True
    chats_module.deduhl_user_coins = fake_deduhl_user_coins

    # Avoid wallet/admin DB checks in subscription service for this unit test by patching the name used in module
    async def fake_check_user_wallet(db, user_id, media_type='chat'):
        return True
    chats_module.check_user_wallet = fake_check_user_wallet

    # Invoke the endpoint
    resp = await chats_module.start_chat(chat_payload, user=user, db=fake_db)

    # Assert: response should be a JSONResponse-like object with status_code 200
    assert resp.status_code == 200
