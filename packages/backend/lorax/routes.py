import os
import json
from pathlib import Path
from typing import Optional
import aiofiles

from fastapi import APIRouter, Request, Response, UploadFile, File, Query
from fastapi.responses import JSONResponse

from lorax.context import session_manager, BUCKET_NAME
from lorax.modes import CURRENT_MODE
from lorax.constants import UPLOADS_DIR
from lorax.cloud.gcs_utils import upload_to_gcs
from lorax.handlers import (
    handle_upload,
    get_projects,
    cache_status,
)

router = APIRouter()
UPLOAD_DIR = Path(UPLOADS_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)

@router.get("/health")
async def healthz():
    redis_ok = await session_manager.health_check()
    return {"ok": True, "redis": redis_ok}

@router.get("/fevicon.ico")
async def favicon():
    return Response(content="", media_type="image/x-icon")

@router.get("/")
async def root():
    return Response(content="Lorax Backend is running...", media_type="text/html")

@router.post("/init-session")
async def init_session(request: Request, response: Response):
    sid, session = await session_manager.get_or_create_session(request, response)
    print("init-session:", sid)
    return {"sid": sid}

@router.get("/projects")
async def projects(request: Request, response: Response):
    sid, session = await session_manager.get_or_create_session(request, response)
    projects = await get_projects(UPLOAD_DIR, BUCKET_NAME, sid=sid)
    return {"projects": projects}

@router.get("/memory_status")
async def memory_status():
    print("cache-status")
    return await cache_status()

@router.get("/{file}")
async def get_file(
    request: Request,
    response: Response,
    file: Optional[str] = None,
    project: Optional[str] = Query(None),
    genomiccoordstart: Optional[int] = Query(None),
    genomiccoordend: Optional[int] = Query(None),
    share_sid: Optional[str] = Query(None),
):
    sid, session = await session_manager.get_or_create_session(request, response)
    if project == "Uploads" and share_sid and share_sid != sid:
        print(f"⚠️ share_sid denied for sid={sid} target={share_sid}")
        return JSONResponse(
            status_code=403,
            content={"error": "Access denied for shared upload."},
        )
    if file and file != "" and file != "ucgb":
        if project == 'Uploads':
            target_sid = share_sid if share_sid else sid
            file_path = UPLOAD_DIR / project / target_sid / file
        else:
            file_path = UPLOAD_DIR / (project or "") / file
    else:
        file = "1kg_chr20.trees.tsz"
        file_path = UPLOAD_DIR / (project or "1000Genomes") / file
    try:
        ctx = await handle_upload(str(file_path), str(UPLOAD_DIR))
        viz_config = ctx.config

        # Override initial_position if client provided genomic coordinates
        if genomiccoordstart is not None and genomiccoordend is not None:
            viz_config['initial_position'] = [genomiccoordstart, genomiccoordend]

        # Update session with loaded file path
        session.file_path = str(file_path)
        await session_manager.save_session(session)

    except Exception as e:
        print(f"❌ Error loading file: {e}")
        return {"error": str(e)}

    return {
        "sid": sid,
        "file": file,
        "project": project,
        "config": viz_config,
        "genomiccoordstart": genomiccoordstart,
        "genomiccoordend": genomiccoordend,
    }

@router.post("/upload")
async def upload(request: Request, response: Response, file: UploadFile = File(...)):
    """
    Upload a file to the server. Stores locally for all modes; uploads to GCS
    only when not running in local mode.
    """
    sid, session = await session_manager.get_or_create_session(request, response)

    # Local mode: flat under Uploads; Non-local: session-scoped folder
    if CURRENT_MODE == "local":
        user_dir = UPLOAD_DIR / "Uploads"
    else:
        user_dir = UPLOAD_DIR / "Uploads" / sid
    user_dir.mkdir(parents=True, exist_ok=True)

    file_path = user_dir / file.filename

    try:
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                await f.write(chunk)

        # Upload to GCS asynchronously when allowed
        if CURRENT_MODE != "local" and BUCKET_NAME:
            await upload_to_gcs(BUCKET_NAME, file_path, sid)
        
        return JSONResponse(
            status_code=200,
            content={"message": "File uploaded", "sid": sid, "owner_sid": sid, "filename": file.filename}
        )
    except Exception as e:
        print("❌ Upload error:", e)
        return JSONResponse(status_code=500, content={"error": "Upload error"})
