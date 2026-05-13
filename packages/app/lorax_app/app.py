from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import socketio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.gzip import GZipMiddleware

from lorax.constants import (
    MAX_HTTP_BUFFER_SIZE,
    SOCKET_PING_INTERVAL,
    SOCKET_PING_TIMEOUT,
    UPLOADS_DIR,
)
from lorax.context import REDIS_CLUSTER_URL, REDIS_CLUSTER
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


# Built-in assembly configs that mirror the lorax-plugin dev config.
# Each entry follows the JBrowse assembly schema with remote hosted FASTA files.
_BUILTIN_ASSEMBLIES: dict[str, dict] = {
    "hg19": {
        "name": "hg19",
        "aliases": ["GRCh37"],
        "sequence": {
            "type": "ReferenceSequenceTrack",
            "trackId": "hg19-ref",
            "adapter": {
                "type": "BgzipFastaAdapter",
                "fastaLocation": {"uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"},
                "faiLocation": {"uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai"},
                "gziLocation": {"uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi"},
            },
        },
        "refNameAliases": {
            "adapter": {
                "type": "RefNameAliasAdapter",
                "location": {"uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt"},
            }
        },
    },
    "hg38": {
        "name": "hg38",
        "aliases": ["GRCh38"],
        "sequence": {
            "type": "ReferenceSequenceTrack",
            "trackId": "hg38-ref",
            "adapter": {
                "type": "BgzipFastaAdapter",
                "fastaLocation": {"uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz"},
                "faiLocation": {"uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai"},
                "gziLocation": {"uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi"},
            },
        },
        "refNameAliases": {
            "adapter": {
                "type": "RefNameAliasAdapter",
                "location": {"uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"},
            }
        },
    },
    "mm10": {
        "name": "mm10",
        "aliases": ["GRCm38"],
        "sequence": {
            "type": "ReferenceSequenceTrack",
            "trackId": "mm10-ref",
            "adapter": {
                "type": "BgzipFastaAdapter",
                "fastaLocation": {"uri": "https://jbrowse.org/genomes/GRCm38/fasta/mm10.fa.gz"},
                "faiLocation": {"uri": "https://jbrowse.org/genomes/GRCm38/fasta/mm10.fa.gz.fai"},
                "gziLocation": {"uri": "https://jbrowse.org/genomes/GRCm38/fasta/mm10.fa.gz.gzi"},
            },
        },
    },
}


def create_fastapi_app(
    static_dir: Optional[Path] = None,
    jbrowse: bool = False,
    filename: Optional[str] = None,
    assembly: Optional[str] = None,
) -> FastAPI:
    static_dir = static_dir or _get_static_dir()

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

    if jbrowse:
        jbrowse_dir = static_dir / "jbrowse"
        jbrowse_index = jbrowse_dir / "index.html"
        if not jbrowse_index.exists():
            raise RuntimeError(
                "JBrowse assets not found.\n\n"
                "Run the build script first:\n"
                "  python packages/app/scripts/sync_jbrowse_assets.py\n"
            )

        assembly_name = assembly or "hg19"
        assembly_cfg = _BUILTIN_ASSEMBLIES.get(assembly_name)

        @app.get("/config.json")
        async def jbrowse_config(request: Request):
            base = str(request.base_url).rstrip("/")

            tracks = []
            print(f"filename: {filename}")
            if filename:
                uploads_path = str(Path(UPLOADS_DIR) / "Uploads" / filename)
                tracks = [{
                    "type": "LoraxTrack",
                    "trackId": "lorax_track",
                    "name": filename,
                    "assemblyNames": [assembly_name],
                    "category": ["uploads"],
                    "adapter": {
                        "type": "LoraxAdapter",
                        "apiBase": f"{base}/api",
                        "filePath": uploads_path,
                        "isProd": True,
                    },
                }]

            # defaultSession skips the JBrowse landing page and opens a
            # LinearGenomeView directly. The Lorax track is visible in the
            # track selector; it is NOT pre-opened to avoid triggering a
            # data load before the user picks a region.
            default_session = {
                "name": "Lorax Session",
                "views": [{
                    "id": "lorax-lgv",
                    "type": "LinearGenomeView",
                }],
            } if assembly_cfg else None

            return JSONResponse({
                "plugins": [{"name": "Lorax", "url": f"{base}/lorax-plugin.js"}],
                "configuration": {"rpc": {"defaultDriver": "MainThreadRpcDriver"}},
                "assemblies": [assembly_cfg] if assembly_cfg else [],
                "tracks": tracks,
                **({"defaultSession": default_session} if default_session else {}),
            })

        @app.get("/")
        async def jbrowse_root():
            return _serve_file(jbrowse_index)

        @app.get("/{path:path}")
        async def jbrowse_spa(path: str, request: Request):
            if path.startswith("api/") or path == "api":
                raise HTTPException(status_code=404, detail="Not found")

            # Check JBrowse static dir first
            candidate = (jbrowse_dir / path).resolve()
            try:
                candidate.relative_to(jbrowse_dir.resolve())
                if candidate.exists() and candidate.is_file():
                    return _serve_file(candidate)
            except ValueError:
                pass

            # Then check root static dir (e.g. lorax-plugin.js)
            root_candidate = (static_dir / path).resolve()
            try:
                root_candidate.relative_to(static_dir.resolve())
                if root_candidate.exists() and root_candidate.is_file():
                    return _serve_file(root_candidate)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid path")

            return _serve_file(jbrowse_index)

    else:
        index_html = static_dir / "index.html"
        if not index_html.exists():
            raise RuntimeError(
                "Lorax UI assets not found.\n\n"
                "If you are running from source, build the website and point the app to it:\n"
                "  npm ci && VITE_API_BASE=/api npm --workspace packages/website run build\n"
                "  export LORAX_APP_STATIC_DIR=packages/website/dist\n\n"
                "If you are installing from PyPI, use an official wheel that includes UI assets."
            )

        @app.get("/")
        async def spa_root():
            return _serve_file(index_html)

        @app.get("/{path:path}")
        async def spa_fallback(path: str, request: Request):
            if path.startswith("api/") or path == "api":
                raise HTTPException(status_code=404, detail="Not found")

            candidate = (static_dir / path).resolve()
            try:
                candidate.relative_to(static_dir.resolve())
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid path")

            if candidate.exists() and candidate.is_file():
                return _serve_file(candidate)

            return _serve_file(index_html)

    return app


def create_asgi_app(
    jbrowse: bool = False,
    filename: Optional[str] = None,
    assembly: Optional[str] = None,
) -> socketio.ASGIApp:
    """
    Create the combined ASGI app.

    - UI served by FastAPI routes (Lorax SPA or JBrowse Web depending on jbrowse flag).
    - Backend router mounted at /api.
    - Socket.IO served at /api/socket.io/.
    """
    fastapi_app = create_fastapi_app(jbrowse=jbrowse, filename=filename, assembly=assembly)

    client_manager = None
    if REDIS_CLUSTER_URL and not REDIS_CLUSTER:
        client_manager = socketio.AsyncRedisManager(REDIS_CLUSTER_URL)
    elif REDIS_CLUSTER_URL and REDIS_CLUSTER:
        print("Warning: Socket.IO Redis manager does not support Redis Cluster; running without shared manager.")

    if client_manager:
        sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            client_manager=client_manager,
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
# When launched via CLI with --jbrowse, the CLI constructs the app directly
# and passes it to uvicorn.run() instead of using this string reference.
asgi_app = create_asgi_app()

