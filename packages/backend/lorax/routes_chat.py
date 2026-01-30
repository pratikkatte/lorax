from typing import Any, Dict, List

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, JSONResponse

from lorax.chat import stream_openai_chat

router = APIRouter(prefix="/chat")


@router.post("/stream")
async def chat_stream(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON body"})

    api_key = None
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        api_key = auth_header.split(" ", 1)[1].strip()
    if not api_key:
        api_key = body.get("apiKey")

    if not api_key:
        return JSONResponse(status_code=400, content={"error": "Missing OpenAI API key"})

    model = body.get("model") or "gpt-4o-mini"
    messages: List[Dict[str, str]] = body.get("messages") or []
    context: Dict[str, Any] = body.get("context") or {}

    async def event_stream():
        async for chunk in stream_openai_chat(api_key, model, messages, context):
            yield chunk

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
