from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Form, HTTPException
from fastapi import Request
from fastapi.responses import Response, JSONResponse
import aiohttp, uuid, os
from app.services.voice import store_voice_to_s3
from app.services.image_jobs import image_job_store
from app.services.voice_chat import process_voice_chat, generate_voice_chat_image
from app.api.v1.deps import get_current_user
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.services.subscription import check_user_wallet, deduhl_user_coins
router = APIRouter()


@router.post("/voice", response_class=Response)
async def voice():
    # TwiML response to record voice input
    return Response(content="""
    <Response>
        <Say voice="Polly.Joanna">Welcome to the AI assistant. Please speak after the beep. We will process your message shortly.</Say>
        <Record action="/process_recording" method="POST" maxLength="20" timeout="3" playBeep="true" />
        <Say>I didn’t receive anything. Goodbye.</Say>
    </Response>
    """, media_type="application/xml")


@router.post("/process_recording")
async def process_recording(request: Request):
    form = await request.form()
    recording_url = form.get("RecordingUrl")
    call_sid = form.get("CallSid")

    # 1. Download Twilio-recorded audio file
    audio_path = f"/tmp/{uuid.uuid4()}.mp3"
    async with aiohttp.ClientSession() as session:
        async with session.get(recording_url + ".mp3") as resp:
            with open(audio_path, "wb") as f:
                f.write(await resp.read())

    # 2. Transcribe audio using your own API
    # placeholder - left for legacy Twilio flow
    return Response(content="<Response><Say>Thank you. Goodbye.</Say></Response>", media_type="application/xml")



@router.post("/chat")
async def voice_chat_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    character_id: str | None = Form(None),
    session_id: str | None = Form(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Receive an audio file from the client, transcribe it, generate chat reply, synthesize cloned voice,
    store audio in S3 and persist chat message.
    Returns voice-to-voice response plus optional image job id.
    """
    await check_user_wallet(db, user.id, "voice")
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Failed to read uploaded file")
    try:
        result, image_request = await process_voice_chat(
            user, content, character_id, session_id
        )
        if not result:
            # Unexpected empty result -> return structured error
            return JSONResponse(status_code=502, content={"error": "voice_processing_failed", "message": "Voice chat processing returned empty result"})
        voice_output_url = result.get("output_url", None)
        # Deduct coins only after successful processing
        print("Deducting coins for voice chat...")
        print("voice_output_url:", voice_output_url)
        image_job_id = None
        if voice_output_url:
            await deduhl_user_coins(request, db, user.id, character_id, "voice")
        wants_image = bool(image_request.get("wants_image"))
        message_id = image_request.get("message_id")
        if wants_image and character_id and message_id:
            try:
                job = await image_job_store.create_job(
                    user_id=str(user.id),
                    character_id=str(character_id),
                    message_id=message_id,
                )
                image_job_id = job.job_id
                background_tasks.add_task(
                    generate_voice_chat_image,
                    job_id=job.job_id,
                    user_id=str(user.id),
                    character_id=str(character_id),
                    message_id=message_id,
                    user_query=image_request.get("user_query") or "",
                    chat_response_text=image_request.get("chat_response_text") or "",
                    transcript=image_request.get("transcript"),
                    user_role=user.role if user else "USER",
                )
                await deduhl_user_coins(request, db, user.id, character_id, "chat_image")
            except Exception as e:
                print(f"Failed to queue voice chat image job: {e}")
        return JSONResponse(
            content={
                "error": None,
                "text": None,
                "audio": result,
                "image_job_id": image_job_id,
            }
        )
    except HTTPException as he:
        # Surface upstream/known errors with richer JSON body so frontend can fallback
        code = getattr(he, 'status_code', 502)
        detail = he.detail if hasattr(he, 'detail') else str(he)
        # Map detail to an error key if possible
        err_key = 'unknown_error'
        if isinstance(detail, str):
            if 'stt_failed' in detail:
                err_key = 'stt_failed'
            elif 'chat_backend' in detail:
                err_key = 'chat_failed'
            elif 'tts' in detail:
                err_key = 'tts_failed'
        return JSONResponse(status_code=code, content={"error": err_key, "message": detail})
    except Exception as e:
        # unexpected error -> 500
        return JSONResponse(status_code=500, content={"error": "internal_error", "message": str(e)})

