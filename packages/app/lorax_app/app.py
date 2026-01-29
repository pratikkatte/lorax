from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import socketio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware

from lorax.constants import (
    MAX_HTTP_BUFFER_SIZE,
    SOCKET_PING_INTERVAL,
    SOCKET_PING_TIMEOUT,
)
from lorax.context import REDIS_URL
from lorax.routes import router as backend_router
from lorax.sockets import register_socket_events


def _get_static_dir() -> Path:
    """
    Resolve the directory containing the built website assets.

    Precedence:
    1) `LORAX_APP_STATIC_DIR` env var (useful for local/dev without copying assets)
    2) Packaged `static/` directory (included in the wheel for pip installs)
    """
    override = os.getenv("LORAX_APP_STATIC_DIR")
    if override:
        return Path(override).expanduser().resolve()

    # In a built wheel, `static/` is shipped as package data.
    return Path(__file__).resolve().parent / "static"


def _serve_file(path: Path) -> FileResponse:
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)


def create_fastapi_app(static_dir: Optional[Path] = None) -> FastAPI:
    static_dir = static_dir or _get_static_dir()
    index_html = static_dir / "index.html"
    if not index_html.exists():
        raise RuntimeError(
            "Lorax UI assets not found.\n\n"
            "If you are running from source, build the website and point the app to it:\n"
            "  npm ci && VITE_API_BASE=/api npm --workspace packages/website run build\n"
            "  export LORAX_APP_STATIC_DIR=packages/website/dist\n\n"
            "If you are installing from PyPI, use an official wheel that includes UI assets."
        )

    app = FastAPI(title="Lorax App", version="0.1.0")
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    allowed_origins = [
        o.strip()
        for o in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
        ).split(",")
        if o.strip()
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Backend API under /api
    app.include_router(backend_router, prefix="/api")

    # Static files + SPA fallback
    @app.get("/")
    async def spa_root():
        return _serve_file(index_html)

    @app.get("/{path:path}")
    async def spa_fallback(path: str, request: Request):
        # Let /api/* be handled by the mounted backend router; if we got here,
        # it wasn't a backend match, so treat it as 404.
        if path.startswith("api/") or path == "api":
            raise HTTPException(status_code=404, detail="Not found")

        # Serve built asset directly if it exists (e.g. /assets/*.js, /logo.png).
        candidate = (static_dir / path).resolve()
        try:
            candidate.relative_to(static_dir.resolve())
        except ValueError:
            # Prevent path traversal.
            raise HTTPException(status_code=400, detail="Invalid path")

        if candidate.exists() and candidate.is_file():
            return _serve_file(candidate)

        # SPA route (e.g. /<file>?project=Uploads)
        return _serve_file(index_html)

    return app


def create_asgi_app() -> socketio.ASGIApp:
    """
    Create the combined ASGI app.

    - UI served by FastAPI routes.
    - Backend router mounted at /api.
    - Socket.IO served at /api/socket.io/.
    """
    fastapi_app = create_fastapi_app()

    if REDIS_URL:
        sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            client_manager=socketio.AsyncRedisManager(REDIS_URL),
            logger=False,
            engineio_logger=False,
            ping_timeout=SOCKET_PING_TIMEOUT,
            ping_interval=SOCKET_PING_INTERVAL,
            max_http_buffer_size=MAX_HTTP_BUFFER_SIZE,
        )
    else:
        sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            logger=False,
            engineio_logger=False,
            ping_timeout=SOCKET_PING_TIMEOUT,
            ping_interval=SOCKET_PING_INTERVAL,
            max_http_buffer_size=MAX_HTTP_BUFFER_SIZE,
        )

    register_socket_events(sio)

    # Expose socket endpoint under /api/socket.io
    return socketio.ASGIApp(
        sio,
        other_asgi_app=fastapi_app,
        socketio_path="api/socket.io",
    )


# Default importable app for uvicorn: `uvicorn lorax_app.app:asgi_app`
asgi_app = create_asgi_app()

