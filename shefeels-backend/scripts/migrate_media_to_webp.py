import asyncio
import logging
import os
import sys

# Add the parent directory to sys.path to make the app module importable
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import select
from app.core.database import async_session_maker

# Import ALL models to ensure SQLAlchemy registry is fully populated
from app.models.ai_generation_log import AiGenerationLog
from app.models.app_config import AppConfig
from app.models.base import Base # Base is usually not a model but good to have if needed
from app.models.character import Character
from app.models.character_media import CharacterMedia
from app.models.chat import ChatMessage
from app.models.contact_message import ContactMessage
from app.models.email_verification import EmailVerification
from app.models.geo import IpLocationCache, UserIpHistory, VisitSession, RequestEvent
from app.models.hero_banner import HeroBanner
from app.models.model_config import ChatModel, ImageModel, SpeechModel
from app.models.oauth_identity import OAuthIdentity
from app.models.password_reset import PasswordReset
from app.models.private_content import MediaPack, MediaPackMedia, UserMediaPackAccess, CharacterMediaLike
from app.models.refresh_token import RefreshToken
from app.models.subscription import Subscription, PromoManagement, PricingPlan, Order, UserWallet, CoinTransaction, TokenTopUp
from app.models.usage_metrics import UsageMetrics
from app.models.user import User, UserProfile, UserActivation

from app.core.aws_s3 import convert_and_upload_webp, delete_s3_object

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate_character_images(session):
    """
    Migrate Character.image_url_s3 and Character.webp_image_url_s3 to proper WebP.
    """
    logger.info("Migrating Character table images...")
    
    # Process all characters
    stmt = select(Character)
    result = await session.execute(stmt)
    characters = result.scalars().all()

    for char in characters:
        original_s3_key = char.image_url_s3
        
        # We only care if:
        # 1. There IS an image
        # 2. It is NOT already webp (check extension)
        # 3. OR webp_image_url_s3 is missing (we can generate it)
        
        if not original_s3_key:
            continue
            
        is_original_webp = original_s3_key.lower().endswith('.webp')
        
        if is_original_webp and char.webp_image_url_s3:
            logger.info(f"Skipping Character {char.id} (already WebP)")
            continue

        logger.info(f"Processing Character {char.id}: {original_s3_key}")
        
        try:
            # If original is NOT webp, convert it
            new_webp_key = None
            if not is_original_webp:
                new_webp_key = await convert_and_upload_webp(original_s3_key)
                
                if new_webp_key:
                    # Update DB records
                    char.image_url_s3 = new_webp_key
                    char.webp_image_url_s3 = new_webp_key
                    session.add(char)
                    await session.commit()
                    
                    # Delete the old file
                    logger.info(f"Deleting old S3 file: {original_s3_key}")
                    await delete_s3_object(original_s3_key)
                else:
                    logger.error(f"Failed to convert Character {char.id} image")
            
            # If original WAS webp but webp_url was missing, just fix the column
            elif is_original_webp and not char.webp_image_url_s3:
                 char.webp_image_url_s3 = original_s3_key
                 session.add(char)
                 await session.commit()
                 
        except Exception as e:
            logger.error(f"Error processing Character {char.id}: {e}")
            await session.rollback()

async def migrate_character_media(session):
    """
    Migrate CharacterMedia.s3_path to WebP.
    """
    logger.info("Migrating CharacterMedia table images...")
    
    stmt = select(CharacterMedia).where(CharacterMedia.media_type == 'image')
    result = await session.execute(stmt)
    medias = result.scalars().all()
    
    for media in medias:
        s3_path = media.s3_path
        
        if not s3_path:
            continue
            
        if s3_path.lower().endswith('.webp'):
            # Just ensure mime_type is correct
            if media.mime_type != 'image/webp':
                media.mime_type = 'image/webp'
                session.add(media)
                await session.commit()
            continue
            
        logger.info(f"Processing CharacterMedia {media.id}: {s3_path}")
        
        try:
            new_webp_key = await convert_and_upload_webp(s3_path)
            
            if new_webp_key:
                media.s3_path = new_webp_key
                media.mime_type = 'image/webp'
                session.add(media)
                await session.commit()
                
                logger.info(f"Deleting old S3 file: {s3_path}")
                await delete_s3_object(s3_path)
            else:
                 logger.error(f"Failed to convert CharacterMedia {media.id}")
                 
        except Exception as e:
            logger.error(f"Error processing CharacterMedia {media.id}: {e}")
            await session.rollback()

from app.services.app_config import ensure_config_loaded

async def main():
    logger.info("Starting migration to WebP...")
    
    async with async_session_maker() as session:
        # Initialize config cache so aws_s3 can find bucket name
        await ensure_config_loaded(session)
        
        await migrate_character_images(session)
        await migrate_character_media(session)
        
    logger.info("Migration completed.")

if __name__ == "__main__":
    asyncio.run(main())
