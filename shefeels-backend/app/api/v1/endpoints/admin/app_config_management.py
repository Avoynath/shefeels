from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from app.core.database import get_db
from app.api.v1.deps import require_admin
from app.models.app_config import AppConfig
from app.schemas.app_config import (
    AppConfigUpdateRequest,
    AppConfigCreateRequest,
    AppConfigEditRequest,
    AppConfigResponse
)
from typing import List
import logging

from app.services.app_config import invalidate_config_cache

logger = logging.getLogger(__name__)

router = APIRouter()

# GET /admin/configs - List all configs
@router.get("/", response_model=List[AppConfigResponse], dependencies=[Depends(require_admin)])
async def list_configs(db: AsyncSession = Depends(get_db)):
    """List all application configurations"""
    result = await db.execute(select(AppConfig).order_by(AppConfig.category, AppConfig.parameter_name))
    configs = result.scalars().all()
    return [AppConfigResponse.model_validate(config) for config in configs]

# POST /admin/configs/create - Create a new config
@router.post("/create", response_model=AppConfigResponse, dependencies=[Depends(require_admin)])
async def create_config(payload: AppConfigCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create a new application configuration"""
    logger.info(f"Starting create_config with payload: {payload}")
    try:
        # Check if parameter_name already exists
        logger.info(f"Checking for existing parameter: {payload.parameter_name}")
        existing_query = select(AppConfig).where(AppConfig.parameter_name == payload.parameter_name)
        existing_config = (await db.execute(existing_query)).scalar_one_or_none()
        logger.info(f"Existing config check result: {existing_config}")
        
        if existing_config:
            raise HTTPException(
                status_code=400,
                detail=f"Configuration parameter '{payload.parameter_name}' already exists"
            )
        
        # Create new config
        new_config = AppConfig(
            category=payload.category,
            parameter_name=payload.parameter_name,
            parameter_value=payload.parameter_value,
            parameter_description=payload.parameter_description
        )
        
        db.add(new_config)
        logger.info("About to commit transaction...")
        await db.commit()
        logger.info("Transaction committed successfully")
        
        logger.info("About to refresh new_config...")
        await db.refresh(new_config)
        logger.info(f"Refresh completed. Config ID: {new_config.id}")

        # Ensure other requests/workers notice the new config immediately
        await invalidate_config_cache(new_config.parameter_name)
        
        try:
            logger.info(f"Attempting to validate config: id={new_config.id}, category={new_config.category}, created_at={new_config.created_at}, updated_at={new_config.updated_at}")
            result = AppConfigResponse.model_validate(new_config)
            logger.info(f"Validation successful: {result}")
            return result
        except Exception as validation_error:
            logger.error(f"Validation failed: {validation_error}")
            logger.error(f"Config object attributes: {vars(new_config)}")
            # Don't rollback here to see the actual error
            raise HTTPException(
                status_code=500,
                detail=f"Failed to validate response: {str(validation_error)}"
            )
        
    except IntegrityError as ie:
        logger.error(f"IntegrityError caught: {ie}")
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Configuration parameter '{payload.parameter_name}' already exists"
        )
    except Exception as e:
        logger.error(f"General exception caught: {e}")
        logger.error(f"Exception type: {type(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create configuration: {str(e)}")

# PUT /admin/configs/edit/{id} - Edit specific fields of a config
@router.put("/edit/{id}", response_model=AppConfigResponse, dependencies=[Depends(require_admin)])
async def edit_config(id: int, payload: AppConfigEditRequest, db: AsyncSession = Depends(get_db)):
    """Edit parameter_value and parameter_description of a configuration"""
    try:
        result = await db.execute(select(AppConfig).where(AppConfig.id == id))
        config = result.scalar_one_or_none()
        
        if not config:
            raise HTTPException(status_code=404, detail=f"Configuration with id {id} not found")
        
        # Update only the provided fields
        if payload.parameter_value is not None:
            config.parameter_value = payload.parameter_value
            
        if payload.parameter_description is not None:
            config.parameter_description = payload.parameter_description
        
        await db.commit()
        await db.refresh(config)

        # Ensure other requests/workers don't keep serving stale cached values
        await invalidate_config_cache(config.parameter_name)
        
        try:
            return AppConfigResponse.model_validate(config)
        except Exception as validation_error:
            await db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to validate response: {str(validation_error)}"
            )
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to edit configuration: {str(e)}")

# DELETE /admin/configs/delete/{id} - Delete a config
@router.delete("/delete/{id}", dependencies=[Depends(require_admin)])
async def delete_config(id: int, db: AsyncSession = Depends(get_db)):
    """Delete an application configuration"""
    try:
        result = await db.execute(select(AppConfig).where(AppConfig.id == id))
        config = result.scalar_one_or_none()
        
        if not config:
            raise HTTPException(status_code=404, detail=f"Configuration with id {id} not found")
        
        config_name = config.parameter_name
        await db.delete(config)
        await db.commit()

        await invalidate_config_cache(config_name)
        
        return {"detail": f"Configuration '{config_name}' (id: {id}) has been deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration: {str(e)}")

# PUT /admin/configs/{id} - Update a specific config (legacy endpoint, kept for backward compatibility)
@router.put("/{id}", dependencies=[Depends(require_admin)], status_code=status.HTTP_200_OK)
async def update_config(id: int, payload: AppConfigUpdateRequest, db: AsyncSession = Depends(get_db)):
    """Legacy endpoint: Update a specific config with arbitrary fields"""
    result = await db.execute(select(AppConfig).where(AppConfig.id == id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"Config with id {id} not found")
    
    for key, value in payload.updates.items():
        if hasattr(config, key):
            setattr(config, key, value)
    
    await db.commit()
    await db.refresh(config)

    await invalidate_config_cache(config.parameter_name)
    
    return {
        "detail": f"Config {id} updated",
        "config": AppConfigResponse.model_validate(config).model_dump()
    }

