from datetime import datetime, timezone
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.tagadapay import verify_webhook_signature
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.email import send_email
from app.core.templates import templates
from app.services.app_config import get_config_value_from_cache
import json

router = APIRouter()


@router.post("/webhooks/tagadapay")
async def tagadapay_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_tagada_signature: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Receive TagadaPay webhooks and verify signature.

    This endpoint expects TagadaPay to POST JSON and include a signature header
    (commonly `X-Tagada-Signature` or similar). The shared secret should be set
    in `TAGADA_WEBHOOK_SECRET` environment variable.
    """
    raw = await request.body()
    secret = settings.__dict__.get("TAGADA_WEBHOOK_SECRET") or None
    # Try the commonly used header first; FastAPI will populate x_tagada_signature
    sig_header = x_tagada_signature or request.headers.get("Tagada-Signature")
    if not secret:
        raise HTTPException(status_code=400, detail="Webhook secret not configured")

    verified = verify_webhook_signature(raw, sig_header, secret)
    if not verified:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(raw.decode("utf-8") or "{}")

    # Basic event handling: log or acknowledge. Extend to update DB as needed.
    event_type = payload.get("event") or payload.get("type") or "unknown"
    data = payload.get("data", {})

    # Handle payment succeeded events
    if event_type == "payment.succeeded":
        print(f"[DEBUG] Payment succeeded webhook received: {data}")
        try:
            # 1. Extract metadata and user_id
            metadata = data.get("metadata", {})
            user_id = metadata.get("user_id") or metadata.get("app_user_id")
            
            # If no user_id in metadata, try to find user by customer email (less reliable but fallback)
            user = None
            if user_id:
                user = await db.get(User, user_id)
            else:
                customer_email = data.get("customer", {}).get("email")
                if customer_email:
                    stmt = select(User).where(User.email == customer_email.lower())
                    user = (await db.execute(stmt)).scalar_one_or_none()
            
            if user:
                # 2. Prepare email details
                amount = f"{data.get('amount', 0)} {data.get('currency', 'USD')}"
                transaction_id = data.get("id") or data.get("paymentId") or "N/A"
                order_id = data.get("orderId") or metadata.get("order_id")
                date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
                
                # Determine product name
                product_name = "Purchase"
                description = data.get("description")
                if description:
                    product_name = description
                elif "tokens" in metadata:
                    product_name = f"{metadata['tokens']} Tokens"
                
                support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
                company_address = await get_config_value_from_cache("ADDRESS")
                app_name = await get_config_value_from_cache("APP_NAME")
                dashboard_url = await get_config_value_from_cache("FRONTEND_URL") or settings.FRONTEND_URL

                # 3. Render template
                html = templates.get_template("purchase_success.html").render(
                    full_name=(user.full_name or "Valued Customer"),
                    product_name=product_name,
                    amount=amount,
                    transaction_id=transaction_id,
                    order_id=order_id,
                    date=date_str,
                    dashboard_url=dashboard_url,
                    year=datetime.now(timezone.utc).year,
                    app_name=app_name,
                    app_name=app_name,
                    support_email=support_email,
                    company_address=company_address,
                    backend_url=(await get_config_value_from_cache("BACKEND_URL") or settings.BACKEND_URL),
                )

                # 4. Schedule email
                background_tasks.add_task(
                    send_email,
                    subject=f"Receipt for your purchase at {app_name}",
                    to=[user.email],
                    html=html,
                )
                print(f"[INFO] Purchase confirmation email scheduled for user {user.id}")
            else:
                print(f"[WARNING] Could not identify user for payment {data.get('id')}")

        except Exception as e:
            print(f"[ERROR] Failed to process payment webhook: {e}")
            import traceback
            traceback.print_exc()

    # Handle payment failed events
    elif event_type == "payment.failed":
        print(f"[DEBUG] Payment failed webhook received: {data}")
        try:
            metadata = data.get("metadata", {})
            user_id = metadata.get("user_id") or metadata.get("app_user_id")
            
            user = None
            if user_id:
                user = await db.get(User, user_id)
            else:
                customer_email = data.get("customer", {}).get("email")
                if customer_email:
                    stmt = select(User).where(User.email == customer_email.lower())
                    user = (await db.execute(stmt)).scalar_one_or_none()

            if user:
                product_name = data.get("description") or "Subscription/Tokens"
                
                support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
                company_address = await get_config_value_from_cache("ADDRESS")
                app_name = await get_config_value_from_cache("APP_NAME")
                dashboard_url = await get_config_value_from_cache("FRONTEND_URL") or settings.FRONTEND_URL

                html = templates.get_template("payment_failed.html").render(
                    full_name=(user.full_name or "Valued Customer"),
                    product_name=product_name,
                    dashboard_url=dashboard_url,
                    year=datetime.now(timezone.utc).year,
                    app_name=app_name,
                    app_name=app_name,
                    support_email=support_email,
                    company_address=company_address,
                    backend_url=(await get_config_value_from_cache("BACKEND_URL") or settings.BACKEND_URL),
                )

                background_tasks.add_task(
                    send_email,
                    subject=f"Action Required: Payment Failed for {app_name}",
                    to=[user.email],
                    html=html,
                )
                print(f"[INFO] Payment failed email scheduled for user {user.id}")
        except Exception as e:
            print(f"[ERROR] Failed to process payment failure webhook: {e}")


    return {"status": "ok", "event": event_type}

