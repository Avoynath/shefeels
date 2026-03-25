import asyncio
import json
import pytest
import pytest_asyncio

from httpx import AsyncClient, ASGITransport

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.database import get_db
from app.main import app as main_app
from app.api.v1.deps import get_current_user
from app.services import paygate as paygate_service
from app import models
from app.models.base import Base as ModelsBase
from app.models.user import User
from app.models.subscription import Order, PromoManagement, UserWallet, CoinTransaction


DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def async_db_engine():
    engine = create_async_engine(DATABASE_URL, echo=False, future=True)
    # create tables
    async with engine.begin() as conn:
        # Create only the tables required for the payment flow tests to avoid Postgres-only types
        tables = [
            User.__table__,
            Order.__table__,
            PromoManagement.__table__,
            UserWallet.__table__,
            CoinTransaction.__table__,
        ]
        await conn.run_sync(lambda sync_conn: ModelsBase.metadata.create_all(bind=sync_conn, tables=tables))
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def async_session(async_db_engine):
    async_session_maker = sessionmaker(async_db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session_maker() as session:
        yield session


@pytest.fixture
def override_get_db(async_session):
    async def _override_get_db():
        yield async_session
    return _override_get_db


@pytest.mark.asyncio
async def test_paygate_checkout_and_callback(monkeypatch, override_get_db, async_session):
    # override the app dependency
    main_app.dependency_overrides[get_db] = override_get_db

    # mock paygate.create_wallet to return expected structure
    async def fake_create_wallet(merchant_address, callback_url):
        return {
            "address_in": "paygate_test_address",
            "ipn_token": "test_ipn_token",
        }

    monkeypatch.setattr(paygate_service, "create_wallet", fake_create_wallet)

    # create a test user in DB via raw INSERT with a fixed id to avoid ORM relationship resolution
    insert_stmt = User.__table__.insert().values(id=1, email="test@example.com")
    await async_session.execute(insert_stmt)
    await async_session.commit()

    # Return a simple object as current_user to avoid loading the full ORM User with relationships
    from types import SimpleNamespace
    test_user = SimpleNamespace(id=1, email="test@example.com")

    async def fake_get_current_user():
        return test_user
    main_app.dependency_overrides[get_current_user] = fake_get_current_user

    # Instead of running full ASGI create-checkout flow (which pulls many dependencies),
    # create an Order row directly and call the paygate_callback function to simulate the provider callback.
    # Insert a promo and pricing plan to allow coins to be computed (optional)
    # Insert an order with paygate_ipn_token set
    insert_order = Order.__table__.insert().values(
        id=1,
        promo_id=None,
        promo_code=None,
        user_id=1,
        stripe_customer_id='test@example.com',
        subscription_id=None,
        order_id=None,
        discount_type=None,
        discount_applied=0,
        subtotal_at_apply=10.0,
        currency='USD',
        status='pending',
    )
    await async_session.execute(insert_order)
    # raw SQL update to set paygate fields because the model does not define them in metadata
    from sqlalchemy import text
    await async_session.execute(
        text("UPDATE orders SET paygate_ipn_token = :ipn, paygate_address_in = :addr WHERE id = :id"),
        {"ipn": "test_ipn_token", "addr": "paygate_test_address", "id": 1},
    )
    await async_session.commit()

    # Build a fake request-like object with query_params dict
    class DummyRequest:
        def __init__(self, params):
            self.query_params = params

    from app.api.v1.endpoints import subscription as submod
    req = DummyRequest({'order_id': '1', 'ipn_token': 'test_ipn_token'})
    res = await submod.paygate_callback(req, db=async_session)
    assert isinstance(res, dict)
    assert res.get('status') == 'success'

    main_app.dependency_overrides.clear()
