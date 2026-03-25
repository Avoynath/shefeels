from __future__ import annotations
from typing import Any, Dict, Optional
import httpx
import hmac
import hashlib
from app.core.config import settings


API_BASE = ""  # will use settings.TAGADA_BASE_URL at runtime


async def process_payment(
    amount: float,
    currency: str,
    card: Dict[str, str],
    customer: Dict[str, Any],
    metadata: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Process a card payment via TagadaPay payments/process endpoint.

    This is a thin wrapper that forwards a JSON payload to TagadaPay. The
    exact field names used here are intentionally generic — adjust them if you
    have a more specific contract with TagadaPay or a plugin.
    """
    base = settings.TAGADA_BASE_URL.rstrip("/")
    url = f"{base}/api/public/v1/payments/process"
    headers = {"Authorization": f"Bearer {settings.TAGADA_API_KEY}"}

    body: Dict[str, Any] = {
        "amount": f"{amount:.2f}",
        "currency": currency,
        "paymentMethod": {"type": "card", "card": card},
        "customer": customer,
    }
    if settings.TAGADA_STORE_ID:
        body["storeId"] = settings.TAGADA_STORE_ID
    if metadata:
        body["metadata"] = metadata

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=body, headers=headers)
        try:
            resp.raise_for_status()
        except Exception:
            # bubble up response content for better error messages
            raise RuntimeError(f"TagadaPay error: {resp.status_code} {resp.text}")
        return resp.json()


def verify_webhook_signature(
    payload: bytes, signature_header: Optional[str], secret: str
) -> bool:
    """Verify TagadaPay webhook signature using HMAC-SHA256.

    TagadaPay may send a signature header; we support headers named
    `X-Tagada-Signature` or `Tagada-Signature`. The header may be the raw hex
    digest or prefixed like `sha256=...`. We compute HMAC-SHA256 of the raw
    payload using the provided secret and compare using constant-time compare.
    """
    if not signature_header or not secret:
        return False
    sig = signature_header
    if sig.startswith("sha256="):
        sig = sig.split("=", 1)[1]
    computed = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, sig)


"""
TagadaPay API client for subscription management and payments.

Provides async methods to:
- Create subscriptions (recurring billing)
- Cancel subscriptions (immediate or at period end)
- Get subscription details
- Create customers
- Process one-time payments (for token purchases)

Documentation: https://docs.tagadapay.com/
"""

import httpx
import logging
from typing import Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class TagadaPayError(Exception):
    """Base exception for TagadaPay API errors."""

    pass


class TagadaPayClient:
    """Async client for TagadaPay API operations."""

    def __init__(self):
        if not settings.TAGADA_API_KEY:
            raise ValueError("TAGADA_API_KEY is not configured in environment")
        if not settings.TAGADA_STORE_ID:
            logger.warning(
                "TAGADA_STORE_ID is not configured - some operations may fail"
            )

        self.base_url = settings.TAGADA_BASE_URL
        self.api_key = settings.TAGADA_API_KEY
        self.store_id = settings.TAGADA_STORE_ID
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """
        Make an HTTP request to TagadaPay API.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path (without base URL)
            json_data: Request body for POST/PUT
            timeout: Request timeout in seconds

        Returns:
            Response JSON as dictionary

        Raises:
            TagadaPayError: If request fails or returns non-2xx status
        """
        url = f"{self.base_url}{endpoint}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self.headers,
                    json=json_data,
                    timeout=timeout,
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            error_detail = exc.response.text
            logger.error(
                f"TagadaPay API error: {exc.response.status_code} - {error_detail}",
                extra={"endpoint": endpoint, "method": method},
            )
            raise TagadaPayError(
                f"TagadaPay API returned {exc.response.status_code}: {error_detail}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error(
                f"TagadaPay request failed: {str(exc)}",
                extra={"endpoint": endpoint, "method": method},
            )
            raise TagadaPayError(f"Failed to connect to TagadaPay: {str(exc)}") from exc
        except Exception as exc:
            logger.exception("Unexpected error calling TagadaPay API")
            raise TagadaPayError(f"Unexpected error: {str(exc)}") from exc

    async def create_customer(
        self,
        email: str,
        name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a new customer in TagadaPay.

        Args:
            email: Customer email address
            name: Customer name (optional)
            metadata: Additional metadata to attach to customer

        Returns:
            Customer object with id, email, etc.
        """
        payload = {
            "email": email,
            "storeId": self.store_id,
        }
        if name:
            payload["name"] = name
        if metadata:
            payload["metadata"] = metadata

        result = await self._request("POST", "/api/public/v1/customers/create", payload)
        return result.get("customer", result)

    async def create_subscription(
        self,
        customer_id: str,
        price_id: str,
        payment_instrument_id: Optional[str] = None,
        currency: str = "USD",
        quantity: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a recurring subscription for a customer.

        Args:
            customer_id: TagadaPay customer ID
            price_id: Price/plan ID from TagadaPay dashboard
            payment_instrument_id: Saved payment method ID (optional)
            currency: Currency code (default: USD)
            quantity: Quantity of subscription (default: 1)
            metadata: Additional metadata

        Returns:
            Subscription object with id, status, currentPeriodEnd, etc.
        """
        payload = {
            "customerId": customer_id,
            "priceId": price_id,
            "storeId": self.store_id,
            "quantity": quantity,
            "currency": currency,
            "initiatePayment": True,
        }

        if payment_instrument_id:
            payload["defaultPaymentInstrumentId"] = payment_instrument_id

        if metadata:
            payload["metadata"] = metadata

        result = await self._request(
            "POST", "/api/public/v1/subscriptions/create", payload
        )
        return result.get("subscription", result)

    async def cancel_subscription(
        self,
        subscription_id: str,
        cancel_at_period_end: bool = True,
    ) -> Dict[str, Any]:
        """
        Cancel a subscription.

        Args:
            subscription_id: TagadaPay subscription ID
            cancel_at_period_end: If True, cancel at end of billing period.
                                 If False, cancel immediately.

        Returns:
            Dictionary mapping subscription ID to cancellation result
        """
        payload = {
            "subscriptionIds": [subscription_id],
            "cancelAtPeriodEnd": cancel_at_period_end,
        }

        return await self._request(
            "POST", "/api/public/v1/subscriptions/cancel", payload
        )

    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """
        Get details of a specific subscription.

        Args:
            subscription_id: TagadaPay subscription ID

        Returns:
            Subscription object with current status, period, etc.
        """
        return await self._request(
            "GET", f"/api/public/v1/subscriptions/{subscription_id}"
        )

    async def process_payment(
        self,
        customer_id: str,
        amount: float,
        currency: str = "USD",
        payment_instrument_id: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process a one-time payment (for token purchases, etc.).

        Args:
            customer_id: TagadaPay customer ID
            amount: Amount to charge (in major currency units)
            currency: Currency code (default: USD)
            payment_instrument_id: Payment method ID
            description: Payment description
            metadata: Additional metadata

        Returns:
            Payment result with transaction details
        """
        payload = {
            "customerId": customer_id,
            "amount": amount,
            "currency": currency,
            "storeId": self.store_id,
        }

        if payment_instrument_id:
            payload["paymentInstrumentId"] = payment_instrument_id
        if description:
            payload["description"] = description
        if metadata:
            payload["metadata"] = metadata

        return await self._request("POST", "/api/public/v1/payments/process", payload)


# Singleton instance
_tagada_client: Optional[TagadaPayClient] = None


def get_tagada_client() -> TagadaPayClient:
    """
    Get or create the singleton TagadaPay client instance.

    Returns:
        TagadaPayClient instance

    Raises:
        TagadaPayError: If client cannot be initialized
    """
    global _tagada_client
    if _tagada_client is None:
        _tagada_client = TagadaPayClient()
    return _tagada_client
