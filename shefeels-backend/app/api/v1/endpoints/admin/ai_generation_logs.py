"""
Admin endpoints for viewing and managing AI generation logs
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, desc, and_, or_

from app.api.v1.deps import get_db, require_admin
from app.models.ai_generation_log import AiGenerationLog
from app.models.user import User, UserProfile
from app.models.character import Character
from app.core.aws_s3 import generate_presigned_url

router = APIRouter()


@router.get("/ai-generations/logs", dependencies=[Depends(require_admin)])
async def get_ai_generation_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    user_id: Optional[str] = Query(None),
    character_id: Optional[str] = Query(None),
    generation_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_compliant: Optional[bool] = Query(None),
    source_context: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    search_prompt: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated list of AI generation logs with filtering options.

    Query Parameters:
    - page: Page number (default: 1)
    - page_size: Items per page (default: 50, max: 500)
    - user_id: Filter by user ID
    - character_id: Filter by character ID
    - generation_type: Filter by type (image, video, voice, etc.)
    - status: Filter by status (pending, success, failed)
    - is_compliant: Filter by compliance (true/false)
    - source_context: Filter by source (chat, character_creation, etc.)
    - start_date: Filter logs from this date (ISO format)
    - end_date: Filter logs until this date (ISO format)
    - search_prompt: Search in prompt text
    """

    # Build base query
    query = select(AiGenerationLog)

    # Apply filters
    conditions = []

    if user_id:
        conditions.append(AiGenerationLog.user_id == user_id)

    if character_id:
        conditions.append(AiGenerationLog.character_id == character_id)

    if generation_type:
        conditions.append(AiGenerationLog.generation_type == generation_type)

    if status:
        conditions.append(AiGenerationLog.status == status)

    if is_compliant is not None:
        conditions.append(AiGenerationLog.is_compliant == is_compliant)

    if source_context:
        conditions.append(AiGenerationLog.source_context == source_context)

    if start_date:
        try:
            # Handle both YYYY-MM-DD and ISO datetime formats
            if "T" in start_date or "Z" in start_date:
                start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            else:
                # Just a date, set to start of day
                start_dt = datetime.fromisoformat(start_date + "T00:00:00")
            conditions.append(AiGenerationLog.created_at >= start_dt)
        except ValueError as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid start_date format: {e}"
            )

    if end_date:
        try:
            # Handle both YYYY-MM-DD and ISO datetime formats
            if "T" in end_date or "Z" in end_date:
                end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            else:
                # Just a date, set to end of day
                end_dt = datetime.fromisoformat(end_date + "T23:59:59")
            conditions.append(AiGenerationLog.created_at <= end_dt)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid end_date format: {e}")

    if search_prompt:
        conditions.append(AiGenerationLog.prompt_text.ilike(f"%{search_prompt}%"))

    if conditions:
        query = query.where(and_(*conditions))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total_count = total_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(desc(AiGenerationLog.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    # Execute query
    result = await db.execute(query)
    logs = result.scalars().all()

    # Format response with user and character details
    logs_data = []
    for log in logs:
        # Get user details
        user_query = (
            select(User, UserProfile)
            .join(UserProfile, User.id == UserProfile.user_id, isouter=True)
            .where(User.id == log.user_id)
        )
        user_result = await db.execute(user_query)
        user_row = user_result.first()

        user_info = None
        if user_row:
            user_obj, profile_obj = user_row
            user_info = {
                "id": user_obj.id,
                "email": user_obj.email,
                "full_name": user_obj.full_name
                or (profile_obj.full_name if profile_obj else None),
                "role": user_obj.role.value if user_obj.role else "user",
            }

        # Get character details if applicable
        character_info = None
        if log.character_id:
            char_query = select(Character).where(Character.id == log.character_id)
            char_result = await db.execute(char_query)
            character = char_result.scalar_one_or_none()
            if character:
                character_info = {
                    "id": character.id,
                    "name": character.name,
                    "username": character.username,
                }

        # Generate presigned URLs for generated content
        presigned_urls = []
        if log.generated_s3_keys:
            for s3_key in log.generated_s3_keys:
                try:
                    presigned_url = await generate_presigned_url(s3_key)
                    presigned_urls.append(presigned_url)
                except Exception as e:
                    print(f"Error generating presigned URL for {s3_key}: {e}")
                    presigned_urls.append(None)

        log_data = {
            "id": log.id,
            "user": user_info,
            "character": character_info,
            "generation_type": log.generation_type,
            "prompt_text": log.prompt_text,
            "prompt_metadata": log.prompt_metadata,
            "ai_model": log.ai_model,
            "num_generations": log.num_generations,
            "size_orientation": log.size_orientation,
            "status": log.status,
            "error_message": log.error_message,
            "face_swap_applied": log.face_swap_applied,
            "is_compliant": log.is_compliant,
            "moderation_notes": log.moderation_notes,
            "source_context": log.source_context,
            "generated_s3_keys": log.generated_s3_keys,
            "generated_content_urls": presigned_urls,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "updated_at": log.updated_at.isoformat() if log.updated_at else None,
        }
        logs_data.append(log_data)

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size,
        "logs": logs_data,
    }


@router.get("/ai-generations/logs/{log_id}", dependencies=[Depends(require_admin)])
async def get_ai_generation_log_detail(
    log_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed information about a specific AI generation log.
    """
    log = await db.get(AiGenerationLog, log_id)

    if not log:
        raise HTTPException(status_code=404, detail="AI generation log not found")

    # Get user details
    user_query = (
        select(User, UserProfile)
        .join(UserProfile, User.id == UserProfile.user_id, isouter=True)
        .where(User.id == log.user_id)
    )
    user_result = await db.execute(user_query)
    user_row = user_result.first()

    user_info = None
    if user_row:
        user_obj, profile_obj = user_row
        user_info = {
            "id": user_obj.id,
            "email": user_obj.email,
            "full_name": user_obj.full_name
            or (profile_obj.full_name if profile_obj else None),
            "role": user_obj.role.value if user_obj.role else "user",
        }

    # Get character details if applicable
    character_info = None
    if log.character_id:
        char_query = select(Character).where(Character.id == log.character_id)
        char_result = await db.execute(char_query)
        character = char_result.scalar_one_or_none()
        if character:
            character_info = {
                "id": character.id,
                "name": character.name,
                "username": character.username,
                "bio": character.bio,
            }

    # Generate presigned URLs for all content
    presigned_urls = []
    if log.generated_s3_keys:
        for s3_key in log.generated_s3_keys:
            try:
                presigned_url = await generate_presigned_url(s3_key)
                presigned_urls.append(presigned_url)
            except Exception as e:
                print(f"Error generating presigned URL for {s3_key}: {e}")
                presigned_urls.append(None)

    initial_image_url = None
    if log.initial_image_s3_key:
        try:
            initial_image_url = await generate_presigned_url(log.initial_image_s3_key)
        except Exception as e:
            print(f"Error generating presigned URL for initial image: {e}")

    face_swap_source_url = None
    if log.face_swap_source_s3_key:
        try:
            face_swap_source_url = await generate_presigned_url(
                log.face_swap_source_s3_key
            )
        except Exception as e:
            print(f"Error generating presigned URL for face swap source: {e}")

    return {
        "id": log.id,
        "user": user_info,
        "character": character_info,
        "generation_type": log.generation_type,
        "prompt_text": log.prompt_text,
        "prompt_metadata": log.prompt_metadata,
        "ai_model": log.ai_model,
        "num_generations": log.num_generations,
        "size_orientation": log.size_orientation,
        "initial_image_s3_key": log.initial_image_s3_key,
        "initial_image_url": initial_image_url,
        "status": log.status,
        "error_message": log.error_message,
        "face_swap_applied": log.face_swap_applied,
        "face_swap_source_s3_key": log.face_swap_source_s3_key,
        "face_swap_source_url": face_swap_source_url,
        "is_compliant": log.is_compliant,
        "moderation_notes": log.moderation_notes,
        "source_context": log.source_context,
        "generated_s3_keys": log.generated_s3_keys,
        "generated_content_urls": presigned_urls,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "updated_at": log.updated_at.isoformat() if log.updated_at else None,
    }


@router.get("/ai-generations/stats", dependencies=[Depends(require_admin)])
async def get_ai_generation_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregate statistics about AI generations.
    """

    # Build base query
    conditions = []

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            conditions.append(AiGenerationLog.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            conditions.append(AiGenerationLog.created_at <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    # Total generations
    total_query = select(func.count(AiGenerationLog.id))
    if conditions:
        total_query = total_query.where(and_(*conditions))
    total_result = await db.execute(total_query)
    total_generations = total_result.scalar() or 0

    # By status
    status_query = select(
        AiGenerationLog.status, func.count(AiGenerationLog.id).label("count")
    ).group_by(AiGenerationLog.status)
    if conditions:
        status_query = status_query.where(and_(*conditions))
    status_result = await db.execute(status_query)
    by_status = {row[0]: row[1] for row in status_result.all()}

    # By generation type
    type_query = select(
        AiGenerationLog.generation_type, func.count(AiGenerationLog.id).label("count")
    ).group_by(AiGenerationLog.generation_type)
    if conditions:
        type_query = type_query.where(and_(*conditions))
    type_result = await db.execute(type_query)
    by_type = {row[0]: row[1] for row in type_result.all()}

    # By source context
    context_query = select(
        AiGenerationLog.source_context, func.count(AiGenerationLog.id).label("count")
    ).group_by(AiGenerationLog.source_context)
    if conditions:
        context_query = context_query.where(and_(*conditions))
    context_result = await db.execute(context_query)
    by_source = {row[0]: row[1] for row in context_result.all()}

    # By AI model
    model_query = select(
        AiGenerationLog.ai_model, func.count(AiGenerationLog.id).label("count")
    ).group_by(AiGenerationLog.ai_model)
    if conditions:
        model_query = model_query.where(and_(*conditions))
    model_result = await db.execute(model_query)
    by_model = {row[0]: row[1] for row in model_result.all()}

    # Compliance stats
    compliance_query = select(
        AiGenerationLog.is_compliant, func.count(AiGenerationLog.id).label("count")
    ).group_by(AiGenerationLog.is_compliant)
    if conditions:
        compliance_query = compliance_query.where(and_(*conditions))
    compliance_result = await db.execute(compliance_query)
    compliance_data = {row[0]: row[1] for row in compliance_result.all()}

    # Face swap stats
    face_swap_query = select(
        AiGenerationLog.face_swap_applied, func.count(AiGenerationLog.id).label("count")
    ).group_by(AiGenerationLog.face_swap_applied)
    if conditions:
        face_swap_query = face_swap_query.where(and_(*conditions))
    face_swap_result = await db.execute(face_swap_query)
    face_swap_data = {row[0]: row[1] for row in face_swap_result.all()}

    return {
        "total_generations": total_generations,
        "by_status": by_status,
        "by_generation_type": by_type,
        "by_source_context": by_source,
        "by_ai_model": by_model,
        "compliance": {
            "compliant": compliance_data.get(True, 0),
            "non_compliant": compliance_data.get(False, 0),
        },
        "face_swap": {
            "applied": face_swap_data.get(True, 0),
            "not_applied": face_swap_data.get(False, 0),
        },
    }


@router.post(
    "/ai-generations/logs/{log_id}/moderate", dependencies=[Depends(require_admin)]
)
async def moderate_ai_generation_log(
    log_id: str,
    is_compliant: bool,
    moderation_notes: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Add moderation notes and update compliance status for an AI generation log.
    """
    from app.services.ai_generation_logging import add_moderation_notes

    try:
        await add_moderation_notes(
            db=db,
            log_id=log_id,
            moderation_notes=moderation_notes,
            is_compliant=is_compliant,
        )
        return {"message": "Moderation notes added successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to add moderation notes: {str(e)}"
        )


@router.delete(
    "/ai-generations/logs/{log_id}/delete", dependencies=[Depends(require_admin)]
)
async def delete_ai_generation_content(
    log_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete generated content from S3 and mark log as deleted.
    This permanently removes illegal/unwanted content from the platform.
    """
    from app.core.aws_s3 import delete_s3_object
    from app.models.character_media import CharacterMedia
    from sqlalchemy import delete as sql_delete

    # Get log entry
    log = await db.get(AiGenerationLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="AI generation log not found")

    # Track deletion results
    deleted_keys = []
    failed_keys = []

    # Delete all generated S3 objects
    if log.generated_s3_keys:
        for s3_key in log.generated_s3_keys:
            try:
                await delete_s3_object(s3_key)
                deleted_keys.append(s3_key)
            except Exception as e:
                print(f"Failed to delete S3 object {s3_key}: {e}")
                failed_keys.append(s3_key)

    # Delete associated CharacterMedia records (if content was saved to gallery)
    if deleted_keys:
        try:
            delete_media_stmt = sql_delete(CharacterMedia).where(
                CharacterMedia.s3_path.in_(deleted_keys)
            )
            await db.execute(delete_media_stmt)
        except Exception as e:
            print(f"Failed to delete CharacterMedia records: {e}")

    # Mark log as deleted with timestamp
    log.status = "deleted"
    deletion_note = f"\n[DELETED by admin at {datetime.utcnow().isoformat()}]"
    log.moderation_notes = (log.moderation_notes or "") + deletion_note

    await db.commit()

    return {
        "message": "Content deleted successfully",
        "log_id": log_id,
        "deleted_s3_keys": deleted_keys,
        "failed_s3_keys": failed_keys,
        "deleted_media_records": len(deleted_keys),
    }
