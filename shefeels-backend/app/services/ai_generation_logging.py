"""
Service for logging AI-generated content for moderation and evaluation
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.ai_generation_log import AiGenerationLog
from app.services.app_config import generate_id
import datetime


async def create_ai_generation_log(
    db: AsyncSession,
    user_id: str,
    generation_type: str,
    prompt_text: str,
    ai_model: Optional[str] = None,
    character_id: Optional[str] = None,
    prompt_metadata: Optional[Dict[str, Any]] = None,
    num_generations: int = 1,
    size_orientation: Optional[str] = None,
    initial_image_s3_key: Optional[str] = None,
    source_context: Optional[str] = None,
    is_compliant: bool = True,
) -> AiGenerationLog:
    """
    Create a new AI generation log entry.
    
    Args:
        db: Database session
        user_id: ID of the user requesting generation
        generation_type: Type of generation (image, video, voice, etc.)
        prompt_text: The actual prompt used for generation
        ai_model: AI model used (e.g., 'xl_pornai', 'xl_anime')
        character_id: Optional character ID if generation is character-related
        prompt_metadata: Additional metadata (clothing, settings, etc.)
        num_generations: Number of generations requested
        size_orientation: Image orientation (portrait, landscape, etc.)
        initial_image_s3_key: S3 key of initial image if image-to-image
        source_context: Where generation was triggered (chat, character_creation, etc.)
        is_compliant: Whether generation passed compliance check
        
    Returns:
        Created AiGenerationLog instance
    """
    log_entry = AiGenerationLog(
        id=generate_id(),
        user_id=user_id,
        character_id=character_id,
        generation_type=generation_type,
        prompt_text=prompt_text,
        prompt_metadata=prompt_metadata,
        ai_model=ai_model,
        num_generations=num_generations,
        size_orientation=size_orientation,
        initial_image_s3_key=initial_image_s3_key,
        source_context=source_context,
        is_compliant=is_compliant,
        status="pending"
    )
    
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    
    return log_entry


async def update_ai_generation_log_success(
    db: AsyncSession,
    log_id: str,
    generated_s3_keys: List[str],
    generated_content_urls: Optional[List[str]] = None,
    face_swap_applied: bool = False,
    face_swap_source_s3_key: Optional[str] = None,
) -> None:
    """
    Update AI generation log after successful generation.
    
    Args:
        db: Database session
        log_id: ID of the log entry to update
        generated_s3_keys: List of S3 keys for generated content
        generated_content_urls: Optional list of presigned URLs
        face_swap_applied: Whether face swap was applied
        face_swap_source_s3_key: S3 key of source image for face swap
    """
    log_entry = await db.get(AiGenerationLog, log_id)
    if log_entry:
        log_entry.status = "success"
        log_entry.generated_s3_keys = generated_s3_keys
        log_entry.generated_content_urls = generated_content_urls
        log_entry.face_swap_applied = face_swap_applied
        log_entry.face_swap_source_s3_key = face_swap_source_s3_key
        log_entry.updated_at = datetime.datetime.now(datetime.timezone.utc)
        
        await db.commit()


async def update_ai_generation_log_failure(
    db: AsyncSession,
    log_id: str,
    error_message: str,
) -> None:
    """
    Update AI generation log after failed generation.
    
    Args:
        db: Database session
        log_id: ID of the log entry to update
        error_message: Error message describing the failure
    """
    log_entry = await db.get(AiGenerationLog, log_id)
    if log_entry:
        log_entry.status = "failed"
        log_entry.error_message = error_message
        log_entry.updated_at = datetime.datetime.now(datetime.timezone.utc)
        
        await db.commit()


async def add_moderation_notes(
    db: AsyncSession,
    log_id: str,
    moderation_notes: str,
    is_compliant: Optional[bool] = None,
) -> None:
    """
    Add moderation notes to an AI generation log.
    
    Args:
        db: Database session
        log_id: ID of the log entry to update
        moderation_notes: Notes from content moderation
        is_compliant: Optional update to compliance status
    """
    log_entry = await db.get(AiGenerationLog, log_id)
    if log_entry:
        log_entry.moderation_notes = moderation_notes
        if is_compliant is not None:
            log_entry.is_compliant = is_compliant
        log_entry.updated_at = datetime.datetime.now(datetime.timezone.utc)
        
        await db.commit()
