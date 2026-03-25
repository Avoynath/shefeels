from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.contact_message import ContactMessage
from app.services.email import send_email
from app.core.config import settings

router = APIRouter()


class ContactCreate(BaseModel):
    interest: str | None = None
    email: EmailStr
    name: str
    subject: str | None = None
    message: str


@router.post("/contact")
async def create_contact(
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
):
    # persist to DB
    cm = ContactMessage(
        name=payload.name,
        email=payload.email,
        interest=payload.interest,
        subject=payload.subject,
        message=payload.message,
    )
    db.add(cm)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))

    # Send notification email to admin
    admin_to = [settings.SMTP_USER]
    subject_admin = f"[Contact] {payload.subject or 'New message'} from {payload.name}"
    html = f"<p><strong>Interest:</strong> {payload.interest or ''}</p>"
    html += f"<p><strong>Name:</strong> {payload.name}</p>"
    html += f"<p><strong>Email:</strong> {payload.email}</p>"
    html += f"<p><strong>Subject:</strong> {payload.subject or ''}</p>"
    html += f"<p><strong>Message:</strong><br/>{payload.message}</p>"

    try:
        await send_email(subject=subject_admin, to=admin_to, html=html)
    except Exception:
        # do not fail the request if email sending fails; log and continue
        pass

    # Optionally send acknowledgement to user
    try:
        ack_subject = "Thanks for contacting HoneyLove"
        ack_html = f"<p>Hi {payload.name},</p><p>Thanks for contacting HoneyLove. We'll get back to you shortly.</p>"
        await send_email(subject=ack_subject, to=[payload.email], html=ack_html)
    except Exception:
        pass

    return JSONResponse(status_code=201, content={"message": "received"})
