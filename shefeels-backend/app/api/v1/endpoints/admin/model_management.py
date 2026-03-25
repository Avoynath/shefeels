from fastapi import APIRouter, Depends
from app.api.v1.deps import require_admin
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.model_config import ChatModel, ImageModel, SpeechModel
from app.schemas.app_config import ChatModelUpdateRequest
from fastapi import status

router = APIRouter()

@router.get("/get_chat_models", dependencies=[Depends(require_admin)], status_code=status.HTTP_200_OK)
async def get_chat_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatModel))
    models = result.scalars().all()
    # Convert SQLAlchemy models to dicts for JSON response
    return {"chat_models": [model.as_dict() if hasattr(model, "as_dict") else {c.name: getattr(model, c.name) for c in model.__table__.columns} for model in models]}

@router.get("/get_all_models", dependencies=[Depends(require_admin)], status_code=status.HTTP_200_OK)
async def get_all_models(db: AsyncSession = Depends(get_db)):
    chat_models = await db.execute(select(ChatModel))
    image_models = await db.execute(select(ImageModel))
    speech_models = await db.execute(select(SpeechModel))
    return {
        "chat_models": [model.as_dict() if hasattr(model, "as_dict") else {c.name: getattr(model, c.name) for c in model.__table__.columns} for model in chat_models.scalars().all()],
        "image_models": [model.as_dict() if hasattr(model, "as_dict") else {c.name: getattr(model, c.name) for c in model.__table__.columns} for model in image_models.scalars().all()],
        "speech_models": [model.as_dict() if hasattr(model, "as_dict") else {c.name: getattr(model, c.name) for c in model.__table__.columns} for model in speech_models.scalars().all()],
    }

@router.put("/update_chat_model/{model_id}", dependencies=[Depends(require_admin)], status_code=status.HTTP_200_OK)
async def update_chat_model(model_id: int, payload: ChatModelUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatModel).where(ChatModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        return {"detail": f"Chat Model with id {model_id} not found"}
    for key, value in payload.updates.items():
        if hasattr(model, key):
            setattr(model, key, value)
    await db.commit()
    await db.refresh(model)
    return {"detail": f"Chat Model {model_id} updated", "chat_model": model.as_dict() if hasattr(model, "as_dict") else {c.name: getattr(model, c.name) for c in model.__table__.columns}}

@router.put("/update_image_model/{model_id}", dependencies=[Depends(require_admin)], status_code=status.HTTP_200_OK)
async def update_image_model(model_id: int, payload: ChatModelUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ImageModel).where(ImageModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        return {"detail": f"Image Model with id {model_id} not found"}
    for key, value in payload.updates.items():
        if hasattr(model, key):
            setattr(model, key, value)
    await db.commit()
    await db.refresh(model)
    return {"detail": f"Image Model {model_id} updated", "image_model": model.as_dict() if hasattr(model, "as_dict") else {c.name: getattr(model, c.name) for c in model.__table__.columns}}



@router.put("/update_speech_model/{model_id}", dependencies=[Depends(require_admin)], status_code=status.HTTP_200_OK)
async def update_speech_model(model_id: int, payload: ChatModelUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpeechModel).where(SpeechModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        return {"detail": f"Speech Model with id {model_id} not found"}
    for key, value in payload.updates.items():
        if hasattr(model, key):
            setattr(model, key, value)
    await db.commit()
    await db.refresh(model)
    return {"detail": f"Speech Model {model_id} updated", "speech_model": model.as_dict() if hasattr(model, "as_dict") else {c.name: getattr(model, c.name) for c in model.__table__.columns}}