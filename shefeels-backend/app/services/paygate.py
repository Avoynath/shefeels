# """Lightweight PayGate helper for wallet creation and parsing responses.

# This module centralizes the HTTP call to PayGate so it can be mocked in tests.
# """
# from typing import Any, Dict
# import httpx

# PAYGATE_CONTROL_URL = "https://api.paygate.to/control/wallet.php"

# async def create_wallet(merchant_address: str, callback_url: str, timeout: float = 10.0) -> Dict[str, Any]:
#     # Validate inputs early to avoid making an invalid request to PayGate
#     if not merchant_address:
#         raise ValueError('merchant_address is required to create a PayGate wallet')

#     params = {
#         'address': merchant_address,
#         'callback': callback_url,
#     }
#     async with httpx.AsyncClient(timeout=timeout) as client:
#         r = await client.get(PAYGATE_CONTROL_URL, params=params)
#     r.raise_for_status()
#     return r.json()



"""
Robust PayGate client:
- Correct params: wallet.php expects `wallet` + `callback`
- Normalizes response keys (encrypted address, ipn token)
- Retries with exponential backoff
- Small helpers to build checkout URL and (optionally) convert to USD
"""

from __future__ import annotations
from typing import Any, Dict, Optional, Tuple
import asyncio
import logging
from urllib.parse import urlencode

import httpx

#logger = logging.getLogger(__name__)

PAYGATE_CONTROL_BASE = "https://api.paygate.to/control"
PAYGATE_WALLET_URL = f"{PAYGATE_CONTROL_BASE}/wallet.php"
PAYGATE_CONVERT_URL = f"{PAYGATE_CONTROL_BASE}/convert.php"
PAYGATE_CHECK_PAYMENT_URL = f"{PAYGATE_CONTROL_BASE}/payment-status.php"
PAYGATE_CHECKOUT_URL = "https://checkout.paygate.to/process-payment.php"

DEFAULT_TIMEOUT = httpx.Timeout(10.0)
MAX_RETRIES = 3
BACKOFF_BASE = 0.5  # seconds


class PayGateError(RuntimeError):
    pass


async def _get_with_retries(url: str, params: Dict[str, Any], timeout: httpx.Timeout = DEFAULT_TIMEOUT) -> httpx.Response:
    last_exc: Optional[BaseException] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp
        except (httpx.RequestError, httpx.HTTPStatusError) as exc:
            last_exc = exc
            # Don’t retry 4xx except 408; do retry network / 5xx
            status = getattr(getattr(exc, "response", None), "status_code", None)
            should_retry = status is None or status >= 500 or status == 408
            print(
                "PayGate GET failed",
                {"url": url, "params": {k: ("<redacted>" if "token" in k else v) for k, v in params.items()},
                 "attempt": attempt, "status": status}
            )
            if attempt == MAX_RETRIES or not should_retry:
                break
            await asyncio.sleep(BACKOFF_BASE * (2 ** (attempt - 1)))
    assert last_exc is not None
    raise last_exc


def _normalize_wallet_response(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize inconsistent keys from PayGate wallet API responses.
    Returns:
      {
        "encrypted_address": "...",   # required for checkout "address" param
        "address_in": "...",          # plain temp wallet (used for callback verify)
        "ipn_token": "...",           # optional but recommended to match in callback
        "raw": {...}                  # original payload for diagnostics
      }
    """
    # Encrypted temp wallet used on checkout link
    encrypted_address = (
        raw.get("address") or
        raw.get("encrypted_address") or
        raw.get("wallet_encrypted")
    )

    # Plain input wallet (appears in callback as address_in)
    address_in = (
        raw.get("address_in") or
        raw.get("polygon_address_in") or
        raw.get("wallet_in")
    )

    # IPN token (various spellings)
    ipn_token = raw.get("ipn_token") or raw.get("ipn") or raw.get("ipnToken")

    if not encrypted_address:
        raise PayGateError("Missing encrypted address in PayGate wallet response")
    if not address_in:
        # Some docs always provide plain address for verification. Treat as required.
        raise PayGateError("Missing plain address_in in PayGate wallet response")

    return {
        "encrypted_address": encrypted_address,
        "address_in": address_in,
        "ipn_token": ipn_token,
        "raw": raw,
    }


# async def create_temp_wallet(payout_wallet: str, callback_url: str, timeout: httpx.Timeout = DEFAULT_TIMEOUT) -> Dict[str, Any]:
#     """
#     Calls wallet.php with the CORRECT params:
#       wallet=<payout polygon address>
#       callback=<absolute callback URL>

#     Returns normalized dict with encrypted_address, address_in, ipn_token.
#     """
#     if not payout_wallet:
#         raise ValueError("payout_wallet is required")
#     if not callback_url:
#         raise ValueError("callback_url is required")

#     params = {"wallet": payout_wallet, "callback": callback_url}
#     resp = await _get_with_retries(PAYGATE_WALLET_URL, params, timeout=timeout)

#     try:
#         data = resp.json()
#     except ValueError as e:
#         raise PayGateError(f"Non-JSON response from PayGate wallet: {e}") from e

#     normalized = _normalize_wallet_response(data)
#     print("Created PayGate temp wallet", {"has_ipn": bool(normalized.get("ipn_token"))})
#     return normalized
import httpx
import logging
from urllib.parse import urlencode

logger = logging.getLogger("paygate")

PAYGATE_WALLET_URL = "https://api.paygate.to/control/wallet.php"

# app/services/paygate.py
import httpx
import logging

logger = logging.getLogger("paygate")

PAYGATE_WALLET_URL = "https://api.paygate.to/control/wallet.php"

async def create_temp_wallet(merchant_address: str, callback_url: str) -> dict:
    params = {
        "address": merchant_address,   # <-- was 'wallet'
        "callback": callback_url,      # keep as-is
    }

    async with httpx.AsyncClient(timeout=15.0, headers={"Accept": "application/json"}) as client:
        resp = await client.get(PAYGATE_WALLET_URL, params=params)   # <-- GET (not POST)
        body = resp.text[:2000]
        print("PayGate wallet response:", body)
        if resp.status_code >= 400:
            logger.error("PayGate wallet request failed",
                         extra={"status": resp.status_code,
                                "request": {"url": PAYGATE_WALLET_URL, "params": params},
                                "response": body})
            try:
                detail = resp.json()
            except Exception:
                detail = {"error": body}
            raise RuntimeError(f"PayGate {resp.status_code}: {detail}")

        # Try JSON parse even if server sets text/html
        try:
            data = resp.json()
        except Exception:
            logger.error("PayGate returned non-JSON body", extra={"body": body})
            raise RuntimeError("Unexpected PayGate response format")

        # Validate expected keys from Postman result
        required = ["address_in", "ipn_token"]
        missing = [k for k in required if k not in data]
        if missing:
            logger.error("PayGate response missing keys", extra={"missing": missing, "data": data})
            raise RuntimeError(f"PayGate response missing keys: {missing}")

        return data

def build_checkout_url(
    encrypted_address: str,
    *,
    amount: float,                 # <-- renamed
    currency: str = "USD",
    order: Optional[str] = None,
    email: Optional[str] = None,
    provider: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Build GET URL for https://checkout.paygate.to/process-payment.php

    Required:
      - address  : decoded `address_in` from wallet.php response
      - amount   : decimal string (e.g., "103.78")
      - currency : e.g., "USD"
    Optional:
      - order, email, provider
    """
    if not encrypted_address:
        raise ValueError("encrypted_address is required")
    if amount is None or amount <= 0:
        raise ValueError("amount must be positive")

    params = {
        "address": encrypted_address,
        "amount": f"{amount:.2f}",       # <-- was value
        "currency": currency or "USD",
    }
    if order:
        params["order"] = str(order)
    if email:
        params["email"] = email
    if provider:
        params["provider"] = provider
    if extra:
        params.update(extra)

    return f"{PAYGATE_CHECKOUT_URL}?{urlencode(params)}"


async def convert_to_usd(from_currency: str, value: float) -> Tuple[float, float]:
    """
    Uses convert.php to convert an arbitrary currency to USD.
    Returns: (converted_value_usd, exchange_rate)
    """
    params = {"from": from_currency, "value": f"{value:.8f}"}
    resp = await _get_with_retries(PAYGATE_CONVERT_URL, params)
    data = resp.json()
    status = data.get("status")
    if status != "success":
        raise PayGateError(f"Currency conversion failed: {data}")
    try:
        usd_value = float(data["value_coin"])
        rate = float(data["exchange_rate"])
    except Exception as e:
        raise PayGateError(f"Unexpected convert.php payload: {data}") from e
    return usd_value, rate


def extract_callback_fields(qs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes callback fields from query string.
    Expected from docs:
      value_coin, coin, txid_in, txid_out, address_in
      plus your original query params (e.g., order or order_id)
    """
    return {
        "order": qs.get("order") or qs.get("order_id"),
        "value_coin": qs.get("value_coin"),
        "coin": qs.get("coin"),
        "txid_in": qs.get("txid_in"),
        "txid_out": qs.get("txid_out"),
        "address_in": qs.get("address_in"),
        "ipn_token": qs.get("ipn_token") or qs.get("ipn") or qs.get("ipnToken") or "",
    }
