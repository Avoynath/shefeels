from fastapi import APIRouter, BackgroundTasks, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import uuid
import asyncio
import json
from typing import Dict, Any
from app.services import redis_cache

router = APIRouter()


async def _set_job_state(job_id: str, state: Dict[str, Any]):
    key = f"job:{job_id}"
    try:
        await redis_cache.set_cached(key, json.dumps(state), ttl=3600)
    except Exception:
        # fallback: store in-memory via redis_cache's fallback (already handled)
        await redis_cache.set_cached(key, json.dumps(state), ttl=3600)


async def _get_job_state(job_id: str) -> Dict[str, Any] | None:
    key = f"job:{job_id}"
    val = await redis_cache.get_cached(key)
    if not val:
        return None
    try:
        return json.loads(val)
    except Exception:
        return None


async def _run_report_job(job_id: str, params: Dict[str, Any]):
    # This function should run the real work. Keep it non-blocking and report progress.
    # For safety, do small steps and update state in Redis so clients can stream progress.
    try:
        await _set_job_state(job_id, {"status": "started", "percent": 0})
        # Simulate work with incremental progress updates. Replace with real work.
        for p in range(1, 6):
            await asyncio.sleep(0.5)  # simulate chunk
            await _set_job_state(job_id, {"status": "running", "percent": p * 20})

        # produce a small report JSON stored at /reports/{job_id}.json
        report = {"report": {"generatedAt": asyncio.get_event_loop().time(), "rows": []}, "params": params}
        # Store report payload
        await redis_cache.set_cached(f"report:{job_id}", json.dumps(report), ttl=3600)
        await _set_job_state(job_id, {"status": "ready", "percent": 100, "url": f"/reports/{job_id}.json"})
    except Exception:
        await _set_job_state(job_id, {"status": "failed"})


@router.post("/prepare-report")
async def prepare_report(request: Request, background_tasks: BackgroundTasks):
    """
    Kick off an async report generation job. Returns 202 with jobId.
    Client should connect to `/report-status?jobId=...` to receive SSE progress and ready event.
    """
    body = await request.json()
    job_id = uuid.uuid4().hex
    # initial job state
    await _set_job_state(job_id, {"status": "queued", "percent": 0})
    # schedule background worker
    background_tasks.add_task(_run_report_job, job_id, body or {})
    return JSONResponse(status_code=202, content={"jobId": job_id, "eta": 5})


@router.get("/report-status")
async def report_status(request: Request):
    """
    SSE endpoint that streams progress events for a jobId query param. Long-poll friendly.
    Example events: progress (percent), ready (url).
    """
    params = dict(request.query_params)
    job_id = params.get("jobId")
    if not job_id:
        raise HTTPException(status_code=400, detail="missing jobId")

    async def event_generator():
            last_state = None
            keepalive_interval = 15.0
            last_keepalive = 0.0
            # Immediately send current state if available so client doesn't wait
            state = await _get_job_state(job_id)
            if state is not None:
                last_state = state
                if state.get("status") in ("running", "queued"):
                    payload = json.dumps({"percent": state.get("percent", 0)})
                    yield f"event: progress\ndata: {payload}\n\n"
                elif state.get("status") == "ready":
                    payload = json.dumps({"url": state.get("url")})
                    yield f"event: ready\ndata: {payload}\n\n"
                    return
                elif state.get("status") == "failed":
                    payload = json.dumps({"error": "job failed"})
                    yield f"event: error\ndata: {payload}\n\n"
                    return

            # Poll loop with keepalive comments to avoid proxy timeouts
            while True:
                if await request.is_disconnected():
                    break
                now = asyncio.get_event_loop().time()
                state = await _get_job_state(job_id)
                if state is not None and state != last_state:
                    last_state = state
                    if state.get("status") in ("running", "queued"):
                        payload = json.dumps({"percent": state.get("percent", 0)})
                        yield f"event: progress\ndata: {payload}\n\n"
                    elif state.get("status") == "ready":
                        payload = json.dumps({"url": state.get("url")})
                        yield f"event: ready\ndata: {payload}\n\n"
                        return
                    elif state.get("status") == "failed":
                        payload = json.dumps({"error": "job failed"})
                        yield f"event: error\ndata: {payload}\n\n"
                        return

                # send a keepalive comment every keepalive_interval seconds
                if now - last_keepalive > keepalive_interval:
                    last_keepalive = now
                    # SSE comment to keep connection alive
                    yield ": keepalive\n\n"

                await asyncio.sleep(0.25)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/reports/{job_id}.json")
async def get_report(job_id: str):
    val = await redis_cache.get_cached(f"report:{job_id}")
    if not val:
        raise HTTPException(status_code=404, detail="report not found")
    return JSONResponse(content=json.loads(val))
