import asyncio
import pytest
from types import SimpleNamespace

import app.services.paygate as paygate


class DummyResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def json(self):
        return self._json

    def raise_for_status(self):
        if not (200 <= self.status_code < 300):
            raise Exception(f'status {self.status_code}')


class DummyClient:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        return self._response


@pytest.mark.asyncio
async def test_create_wallet_monkeypatch(monkeypatch):
    sample = {
        'address_in': 'encrypted_addr',
        'polygon_address_in': '0x123',
        'ipn_token': 'token123'
    }

    async def fake_acreate(*args, **kwargs):
        return DummyResponse(sample)

    # monkeypatch httpx.AsyncClient to our dummy
    class FakeAsyncClient:
        def __init__(self, timeout=None):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params=None):
            return DummyResponse(sample)

    monkeypatch.setattr('app.services.paygate.httpx.AsyncClient', FakeAsyncClient)

    res = await paygate.create_wallet('0xME', 'https://example.com/cb')
    assert res['address_in'] == 'encrypted_addr'
    assert res['ipn_token'] == 'token123'
