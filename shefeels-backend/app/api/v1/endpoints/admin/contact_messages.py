"""Admin endpoints for managing contact messages."""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from app.core.database import get_db
from app.models.contact_message import ContactMessage
from app.api.v1.deps import require_admin

router = APIRouter()


class ContactMessageResponse(BaseModel):
    id: str
    name: str
    email: str
    interest: str | None
    subject: str | None
    message: str
    status: str
    admin_notes: str | None
    resolved_by: str | None
    resolved_at: str | None
    created_at: str

    class Config:
        from_attributes = True


class ContactMessageUpdate(BaseModel):
    status: str | None = None
    admin_notes: str | None = None
    resolved_by: str | None = None


class ContactMessagesListResponse(BaseModel):
    messages: List[ContactMessageResponse]
    total: int
    page: int
    page_size: int


@router.get("/contact-messages", dependencies=[Depends(require_admin)])
async def list_contact_messages(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    List all contact messages with pagination and filters.
    - status: filter by status (pending, in_progress, resolved, closed)
    - search: search in name, email, subject, or message
    """
    # Build query
    query = select(ContactMessage)

    # Apply filters
    filters = []
    if status:
        filters.append(ContactMessage.status == status)
    if search:
        search_pattern = f"%{search}%"
        filters.append(
            or_(
                ContactMessage.name.ilike(search_pattern),
                ContactMessage.email.ilike(search_pattern),
                ContactMessage.subject.ilike(search_pattern),
                ContactMessage.message.ilike(search_pattern),
            )
        )

    if filters:
        query = query.where(*filters)

    # Get total count
    count_query = select(func.count()).select_from(ContactMessage)
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(desc(ContactMessage.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Serialize
    messages_data = []
    for msg in messages:
        messages_data.append(
            {
                "id": msg.id,
                "name": msg.name,
                "email": msg.email,
                "interest": msg.interest,
                "subject": msg.subject,
                "message": msg.message,
                "status": msg.status,
                "admin_notes": msg.admin_notes,
                "resolved_by": msg.resolved_by,
                "resolved_at": msg.resolved_at.isoformat() if msg.resolved_at else None,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            }
        )

    return ContactMessagesListResponse(
        messages=messages_data,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/contact-messages/{message_id}", dependencies=[Depends(require_admin)])
async def get_contact_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single contact message by ID."""
    query = select(ContactMessage).where(ContactMessage.id == message_id)
    result = await db.execute(query)
    msg = result.scalar_one_or_none()

    if not msg:
        raise HTTPException(status_code=404, detail="Contact message not found")

    return ContactMessageResponse(
        id=msg.id,
        name=msg.name,
        email=msg.email,
        interest=msg.interest,
        subject=msg.subject,
        message=msg.message,
        status=msg.status,
        admin_notes=msg.admin_notes,
        resolved_by=msg.resolved_by,
        resolved_at=msg.resolved_at.isoformat() if msg.resolved_at else None,
        created_at=msg.created_at.isoformat() if msg.created_at else None,
    )


@router.patch("/contact-messages/{message_id}", dependencies=[Depends(require_admin)])
async def update_contact_message(
    message_id: str,
    payload: ContactMessageUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update contact message status and admin notes."""
    query = select(ContactMessage).where(ContactMessage.id == message_id)
    result = await db.execute(query)
    msg = result.scalar_one_or_none()

    if not msg:
        raise HTTPException(status_code=404, detail="Contact message not found")

    # Update fields
    if payload.status is not None:
        msg.status = payload.status
        # Auto-set resolved_at when status changes to resolved/closed
        if payload.status in ("resolved", "closed") and not msg.resolved_at:
            msg.resolved_at = datetime.utcnow()

    if payload.admin_notes is not None:
        msg.admin_notes = payload.admin_notes

    if payload.resolved_by is not None:
        msg.resolved_by = payload.resolved_by

    try:
        await db.commit()
        await db.refresh(msg)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))

    return ContactMessageResponse(
        id=msg.id,
        name=msg.name,
        email=msg.email,
        interest=msg.interest,
        subject=msg.subject,
        message=msg.message,
        status=msg.status,
        admin_notes=msg.admin_notes,
        resolved_by=msg.resolved_by,
        resolved_at=msg.resolved_at.isoformat() if msg.resolved_at else None,
        created_at=msg.created_at.isoformat() if msg.created_at else None,
    )


@router.get("/contact-messages-stats", dependencies=[Depends(require_admin)])
async def get_contact_messages_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get statistics about contact messages."""
    # Count by status
    query = select(
        ContactMessage.status, func.count(ContactMessage.id).label("count")
    ).group_by(ContactMessage.status)

    result = await db.execute(query)
    status_counts = {row.status: row.count for row in result}

    # Total messages
    total_query = select(func.count()).select_from(ContactMessage)
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    return {
        "total": total,
        "by_status": status_counts,
        "pending": status_counts.get("pending", 0),
        "in_progress": status_counts.get("in_progress", 0),
        "resolved": status_counts.get("resolved", 0),
        "closed": status_counts.get("closed", 0),
    }
