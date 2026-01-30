import json
from typing import Any, AsyncGenerator, Dict, List

import httpx

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


def build_system_prompt(context: Dict[str, Any]) -> str:
    """
    Build a system prompt that injects the current UI context.
    """
    context_str = "{}"
    try:
        context_str = json.dumps(context or {}, ensure_ascii=True, default=str)
    except Exception:
        context_str = "{}"

    return (
        "You are a helpful assistant for the Lorax genome visualization app. "
        "Use the provided UI context to answer questions about the current view. "
        "If something is missing, say so.\n\n"
        f"UI_CONTEXT_JSON: {context_str}"
    )


async def stream_openai_chat(
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    context: Dict[str, Any],
) -> AsyncGenerator[str, None]:
    """
    Stream chat completions from OpenAI and yield SSE payloads.
    """
    system_prompt = build_system_prompt(context)
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}] + (messages or []),
        "stream": True,
        "temperature": 0.2,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", OPENAI_CHAT_URL, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                text = await resp.aread()
                error_msg = text.decode("utf-8", errors="ignore") or "Upstream error"
                yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
                yield "data: {\"type\": \"done\"}\n\n"
                return

            async for line in resp.aiter_lines():
                if not line:
                    continue
                if not line.startswith("data: "):
                    continue
                data = line[len("data: "):].strip()
                if data == "[DONE]":
                    yield "data: {\"type\": \"done\"}\n\n"
                    return

                try:
                    payload = json.loads(data)
                except json.JSONDecodeError:
                    continue

                choices = payload.get("choices") or []
                if not choices:
                    continue

                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield f"data: {json.dumps({'type': 'delta', 'delta': content})}\n\n"

    yield "data: {\"type\": \"done\"}\n\n"
