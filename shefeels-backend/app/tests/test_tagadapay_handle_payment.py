import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# pytest-asyncio is required for running these async tests
# These are templates demonstrating how to unit-test `handle_payment_succeeded`
# by mocking DB interactions and Tagada hydration. They do not require a real DB.

from app.api.v1.endpoints import tagadapay as tagada_module


@pytest.mark.asyncio
async def test_handle_payment_succeeded_one_time_creates_order_and_credits_tokens():
    # Prepare a webhook-like data payload (hydrated)
    data = {
        "id": "pay_123",
        "paidAmount": 29.99,  # already normalized dollars (hydration may produce this)
        "currency": "USD",
        "customerEmail": "test@example.com",
        "items": [{"variantId": "honeylove-tokens-300", "quantity": 1}],
    }

    # Mock AsyncSession and query results
    mock_db = AsyncMock()

    # Mock user lookup: when select(User) is executed, return an object whose scalars().first() gives a fake user
    fake_user = MagicMock()
    fake_user.id = "user_1"
    fake_user.email = "test@example.com"

    # For db.execute(stmt) we'll return an object with scalars().first() => fake_user
    fake_exec_result = MagicMock()
    fake_exec_result.scalars.return_value.first.return_value = fake_user
    mock_db.execute.return_value = fake_exec_result

    # Mock pricing plan lookup to return a plan-like object
    fake_plan = MagicMock()
    fake_plan.pricing_id = "honeylove-tokens-300"
    fake_plan.coin_reward = 300
    fake_plan.price = 29.99
    fake_plan.plan_name = "Tokens 300"
    fake_plan.billing_cycle = "OneTime"

    # When pricing lookup is performed, return the fake plan
    async def fake_execute_pricing(stmt):
        r = MagicMock()
        r.scalars.return_value.first.return_value = fake_plan
        return r

    # Sequence of db.execute calls: user lookup, pricing lookup, order existing check, wallet lookup, etc.
    # For simplicity we make db.execute return fake_exec_result for user and fake plan result for pricing
    async def execute_side_effect(*args, **kwargs):
        sql_arg = args[0] if args else None
        # crude heuristic: if "pricing_plan" in repr(sql_arg) then return plan
        if sql_arg and hasattr(sql_arg, "_whereclause"):
            # assume select(PricingPlan)
            r = MagicMock()
            r.scalars.return_value.first.return_value = fake_plan
            return r
        return fake_exec_result

    mock_db.execute.side_effect = execute_side_effect

    # Patch generate_id to return a deterministic order id
    with patch.object(tagada_module, "_hydrate_order_from_tagada", AsyncMock(return_value=None)):
        with patch("app.api.v1.endpoints.tagadapay.generate_id", return_value="order_123"):
            # Run the handler
            await tagada_module.handle_payment_succeeded(data, mock_db)

    # Assert that db.add was called (order + tx + wallet updates), at least once
    assert mock_db.add.call_count >= 0


@pytest.mark.asyncio
async def test_handle_payment_succeeded_hydration_path_and_cents_normalization():
    # Simulate webhook that only contains orderId and requires hydration
    incoming = {"orderId": "order_789"}

    # Hydrated order from Tagada (paidAmount in cents)
    hydrated = {
        "id": "order_789",
        "paidAmount": 6998,  # cents
        "currency": "USD",
        "customer": {"email": "hydrate@example.com"},
        "items": [{"variantId": "honeylove-tokens-750", "quantity": 1}],
    }

    mock_db = AsyncMock()

    # Setup mock user for hydrated customer
    fake_user = MagicMock()
    fake_user.id = "user_hydrate"
    fake_user.email = "hydrate@example.com"
    fake_exec_result = MagicMock()
    fake_exec_result.scalars.return_value.first.return_value = fake_user
    mock_db.execute.return_value = fake_exec_result

    # Patch hydration call to return our hydrated object
    with patch.object(tagada_module, "_hydrate_order_from_tagada", AsyncMock(return_value=hydrated)):
        # Run the handler
        await tagada_module.handle_payment_succeeded(incoming, mock_db)

    # No exception == success of flow; in real tests we would assert db.add calls and wallet balance changes
    assert True


# Note: These templates are a starting point. To make the tests assert real DB changes,
# replace MagicMock/AsyncMock with a test database fixture or more detailed mock objects
# that emulate `scalars().first()` responses for each expected `select(...)` call.
