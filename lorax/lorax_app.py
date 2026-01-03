"""
Socket.IO version of the Lorax backend (single-process, no Gunicorn).

Run with:
    uvicorn lorax_socketio_app:sio_app --host 0.0.0.0 --port 8080 --reload
"""

"""

TODO
1. write all the combination test cases for testing upload and download from GCS and local directory. in local and production.
2. remove the need for key and folder name in the get_projects dict. 
3. change Uploads to LORAX_UPLOADS. 
"""
import os
import json
import asyncio
from uuid import uuid4
from pathlib import Path
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
from lorax.utils.gcs_utils import download_gcs_file, BUCKET_NAME, get_public_gcs_dict, upload_to_gcs
import time
load_dotenv()

from http.cookies import SimpleCookie

import aiofiles
import socketio
from fastapi import FastAPI, Request, Response, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware

from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from lorax.handlers import handle_upload, handle_edges_query, get_projects, cache_status, handle_details, get_or_load_config
from lorax.constants import (
    SESSION_COOKIE, COOKIE_MAX_AGE, UPLOADS_DIR,
    SOCKET_PING_TIMEOUT, SOCKET_PING_INTERVAL, MAX_HTTP_BUFFER_SIZE,
    ERROR_SESSION_NOT_FOUND, ERROR_MISSING_SESSION, ERROR_NO_FILE_LOADED
)



# Setup

app = FastAPI(title="Lorax Backend", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)

UPLOAD_DIR = Path("UPLOADS")

IS_VM = os.getenv("IS_VM", False)

print("Running in VM:", IS_VM)

UPLOAD_DIR.mkdir(exist_ok=True)

BUCKET_NAME = os.getenv("BUCKET_NAME", 'lorax_projects')

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USE_REDIS = False
REDIS_URL = os.getenv("REDIS_URL", None)
redis_client = None

if REDIS_URL:
    import redis.asyncio as aioredis
    USE_REDIS = True
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    print(f"Using Redis at {REDIS_URL}")
else:
    print("Running without Redis (in-memory mode)")


# Session constants imported from lorax.constants

class Session:
    """Per-user session."""
    def __init__(self, sid, file_path=None):
        self.sid = sid
        self.file_path = file_path
        self.created_at = datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "sid": self.sid,
            "file_path": self.file_path,
            "created_at": self.created_at,
        }

    @staticmethod
    def from_dict(data):
        return Session(
            sid=data["sid"],
            file_path=data.get("file_path"),
        )

sessions = {}  # sid → Session


async def get_or_create_session(request: Request, response: Response):
    sid = request.cookies.get(SESSION_COOKIE)
    secure = request.url.scheme == "https"
        
    if USE_REDIS:
        if not sid:
            sid = str(uuid4())
            session = Session(sid)
            await redis_client.setex(f"sessions:{sid}", COOKIE_MAX_AGE, json.dumps(session.to_dict()))

            response.set_cookie(key=SESSION_COOKIE, value=sid, httponly=True, samesite="Lax", max_age=COOKIE_MAX_AGE, secure=secure) 
            return sid, session

        data = await redis_client.get(f"sessions:{sid}")
        if data:
            session = Session.from_dict(json.loads(data))
        else:
            session = Session(sid)
            await redis_client.setex(f"sessions:{sid}", COOKIE_MAX_AGE, json.dumps(session.to_dict()))
        return sid, session

    # ── In-memory mode ────────────────────────
    if not sid or sid not in sessions:
        sid = str(uuid4())
        sessions[sid] = Session(sid)
        response.set_cookie(key=SESSION_COOKIE, value=sid, httponly=True, samesite="Lax", max_age=COOKIE_MAX_AGE, secure=secure)
    return sid, sessions[sid]

async def save_session(session: Session):
    """Persist session (no-op in in-memory mode)."""
    if USE_REDIS:
        await redis_client.setex(f"sessions:{session.sid}", COOKIE_MAX_AGE, json.dumps(session.to_dict()))
    else:
        sessions[session.sid] = session


if USE_REDIS:
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
        client_manager=socketio.AsyncRedisManager(REDIS_URL),
        logger=False,
        engineio_logger=False,
        ping_timeout=SOCKET_PING_TIMEOUT,
        ping_interval=SOCKET_PING_INTERVAL,
        max_http_buffer_size=MAX_HTTP_BUFFER_SIZE
    )
else:
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
        logger=False,
        engineio_logger=False,
        ping_timeout=SOCKET_PING_TIMEOUT,
        ping_interval=SOCKET_PING_INTERVAL,
        max_http_buffer_size=MAX_HTTP_BUFFER_SIZE
    )

sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

@app.get("/health")
async def healthz():
    if USE_REDIS:
        redis_ok = await redis_client.ping()
        return {"ok": True, "redis": redis_ok}
    return {"ok": True, "sessions": len(sessions)}

@app.get("/fevicon.ico")
async def favicon():
    return Response(content="", media_type="image/x-icon")

@app.get("/")
async def root():
    return Response(content="Lorax Backend is running", media_type="text/html")

@app.post("/init-session")
async def init_session(request: Request, response: Response):
    sid, session = await get_or_create_session(request, response)
    print("init-session:", sid)
    return {"sid": sid}


@app.get("/projects")
async def projects(request: Request, response: Response):
    
    sid, session = await get_or_create_session(request, response)
    projects = {}
    if IS_VM:
        projects = get_public_gcs_dict(BUCKET_NAME, sid=sid, projects=projects)
    else:
        projects = await get_projects(UPLOAD_DIR, BUCKET_NAME)
    return {"projects": projects}

@app.get("/memory_status")
async def memory_status():
    print("cache-status")
    return await cache_status()

@app.get("/{file}")
async def get_file(
    request: Request,
    response: Response,
    file: Optional[str] = None,
    project: Optional[str] = Query(None),
    genomiccoordstart: Optional[int] = Query(None),
    genomiccoordend: Optional[int] = Query(None),
    share_sid: Optional[str] = Query(None),
):
    sid, session = await get_or_create_session(request, response)
    if file and file != "" and file != "ucgb":
        if project == 'Uploads' and IS_VM:
            target_sid = share_sid if share_sid else sid
            file_path = UPLOAD_DIR / project / target_sid / file
        else:
            file_path = UPLOAD_DIR / (project or "") / file
    else:
        file = "1kg_chr20.trees.tsz"
        file_path = UPLOAD_DIR / (project or "1000Genomes") / file
    try:
 
        viz_config, chat_config = await handle_upload(str(file_path), UPLOAD_DIR)

        # Update session with loaded file path
        session.file_path = str(file_path)
        await save_session(session)

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

@app.post("/upload")
async def upload(request: Request, response: Response, file: UploadFile = File(...)):
    """
    Upload a file to the server. 

    ## TODO for local uploads, we need to upload the file to the local directory and not upload it to GCS. 
    """
    sid, session = await get_or_create_session(request, response)

    user_dir = UPLOAD_DIR /"Uploads"/sid if IS_VM else UPLOAD_DIR /"Uploads"
    user_dir.mkdir(parents=True, exist_ok=True)

    file_path = user_dir / file.filename

    try:
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                await f.write(chunk)

        # Upload to GCS asynchronously
        if IS_VM:
            gcs_url = await upload_to_gcs(BUCKET_NAME, file_path, sid)
        
        return JSONResponse(
            status_code=200,
            content={"message": "File uploaded", "sid": sid, "owner_sid": sid, "filename": file.filename}
        )
    except Exception as e:
        print("❌ Upload error:", e)
        return JSONResponse(status_code=500, content={"error": "Upload error"})

async def get_session(lorax_sid: str):
    """Get session from Redis or memory, with proper error handling."""
    if not lorax_sid:
        return None

    if USE_REDIS:
        raw = await redis_client.get(f"sessions:{lorax_sid}")
        if not raw:
            return None
        return Session.from_dict(json.loads(raw))
    else:
        return sessions.get(lorax_sid)


async def require_session(lorax_sid: str, socket_sid: str):
    """Get session or emit error to client. Returns None if session not found."""
    session = await get_session(lorax_sid)
    if not session:
        await sio.emit("error", {
            "code": ERROR_SESSION_NOT_FOUND,
            "message": "Session expired. Please refresh the page."
        }, to=socket_sid)
        return None
    return session


@sio.event
async def connect(sid, environ, auth=None):
    print(f"🔌 Socket.IO connected: {sid}")

    cookie = environ.get("HTTP_COOKIE", "")
    cookies = SimpleCookie()
    cookies.load(cookie)

    lorax_sid_cookie = cookies.get("lorax_sid")
    session_id = lorax_sid_cookie.value if lorax_sid_cookie else None

    if not session_id:
        print(f"⚠️ No lorax_sid cookie found for socket {sid}")
        await sio.emit("error", {"code": ERROR_SESSION_NOT_FOUND, "message": "Session not found. Please refresh the page."}, to=sid)
        return

    # Validate session exists and send appropriate event
    session = await get_session(session_id)
    if session and session.file_path:
        await sio.emit("session-restored", {
            "lorax_sid": session_id,
            "file_path": session.file_path
        }, to=sid)
    else:
        await sio.emit("status", {"message": "Connected", "lorax_sid": session_id}, to=sid)

@sio.event
async def disconnect(sid):
    print(f"🔌 Socket.IO disconnected: {sid}")

@sio.event
async def ping(sid, data):
    await sio.emit("pong", {"type": "pong", "time": datetime.utcnow().isoformat()}, to=sid)

async def background_load_file(sid, data):
    try:
        lorax_sid = data.get("lorax_sid")
        share_sid = data.get("share_sid")

        if not lorax_sid:
            print(f"⚠️ Missing lorax_sid")
            await sio.emit("error", {"code": ERROR_MISSING_SESSION, "message": "Session ID is missing."}, to=sid)
            return

        session = await get_session(lorax_sid)
        if not session:
            print(f"⚠️ Unknown sid {lorax_sid}")
            await sio.emit("error", {"code": ERROR_SESSION_NOT_FOUND, "message": "Session expired. Please refresh the page."}, to=sid)
            return

        project = str(data.get("project"))
        filename = str(data.get("file"))
        print("lorax_sid", lorax_sid, project, filename)
        if not filename:
            return JSONResponse(status_code=400, content={"error": "Missing 'file'."})
    
        if project == 'Uploads' and IS_VM:
            target_sid = share_sid if share_sid else lorax_sid
            file_path = UPLOAD_DIR / project / target_sid / filename
            blob_path = f"{project}/{target_sid}/{filename}"
        else:

            file_path = UPLOAD_DIR / project / filename
            blob_path = f"{project}/{filename}"

        if BUCKET_NAME:
            if file_path.exists():
                print(f"File {file_path} already exists, skipping download.")
            else:
                print(f"Downloading file {file_path} from {BUCKET_NAME}")

                await download_gcs_file(BUCKET_NAME, f"{blob_path}", str(file_path))
        else:
            print("using gcs mount point")
            file_path = UPLOAD_DIR / project / filename

        if not file_path.exists():
            return JSONResponse(status_code=404, content={"error": "File not found."})

        session.file_path = str(file_path)
        await save_session(session)
    
        print("loading file", file_path, os.getpid())
        ts = await handle_upload(str(file_path), UPLOAD_DIR)
        
        await sio.emit("status", {"status": "processing-file", "message": "Processing file...", "filename": filename, "project": project}, to=sid)

        config = await asyncio.to_thread(get_or_load_config, ts, str(file_path), UPLOAD_DIR)
    
        owner_sid = share_sid if share_sid else lorax_sid
        await sio.emit("load-file-result", {"message": "File loaded", "sid": sid, "filename": filename, "config": config, "owner_sid": owner_sid}, to=sid)

    except Exception as e:
        print(f"Load file error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@sio.event
async def load_file(sid, data):
        asyncio.create_task(background_load_file(sid, data))

@sio.event
async def details(sid, data):
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        print("fetch details in ", session.sid, os.getpid())

        result = await handle_details(session.file_path, data)
        await sio.emit("details-result", {"data": json.loads(result)}, to=sid)
    except Exception as e:
        print(f"❌ Details error: {e}")
        await sio.emit("details-result", {"error": str(e)}, to=sid)


@sio.event
async def query(sid, data):
    """Socket event to query tree nodes."""
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        value = data.get("value")
        local_trees = data.get("localTrees", [])

        # Acknowledge the query - the actual tree data is processed by the frontend worker
        # This handler ensures the session is valid and the file is loaded
        await sio.emit("query-result", {"data": {"value": value, "localTrees": local_trees}}, to=sid)
    except Exception as e:
        print(f"❌ Query error: {e}")
        await sio.emit("query-result", {"error": str(e)}, to=sid)


@sio.event
async def query_edges(sid, data):
    """Socket event to fetch edges for a genomic interval."""
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        start = data.get("start", 0)
        end = data.get("end", 0)

        result = await handle_edges_query(session.file_path, start, end)
        await sio.emit("edges-result", {"data": json.loads(result)}, to=sid)
    except Exception as e:
        print(f"❌ Edges query error: {e}")
        await sio.emit("edges-result", {"error": str(e)}, to=sid)