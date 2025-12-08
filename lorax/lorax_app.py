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

from lorax.handlers import LoraxHandler, handle_upload, handle_query, get_projects, cache_status, handle_details

# Setup

app = FastAPI(title="Lorax Backend", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)

UPLOAD_DIR = Path("UPLOADS")

IS_VM = os.getenv("IS_VM", False)

UPLOAD_DIR.mkdir(exist_ok=True)

BUCKET_NAME = os.getenv("BUCKET_NAME", 'lorax_projects')

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
]
print("ALLOWED_ORIGINS:", ALLOWED_ORIGINS)

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


SESSION_COOKIE = "lorax_sid"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60

class Session:
    """Per-user session."""
    def __init__(self, sid, file_path=None):
        self.sid = sid
        self.file_path = file_path
        self.created_at = datetime.utcnow().isoformat()
        self.handler = LoraxHandler()

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

            response.set_cookie(key=SESSION_COOKIE, value=sid, httponly=True, samesite="Lax", max_age=COOKIE_MAX_AGE, secure=False) # HARDCODED FALSE. FIX IT LATER. 
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
        ping_timeout=60, 
        ping_interval=25,
        max_http_buffer_size=50_000_000
    )
else:
    
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
        logger=False,
        engineio_logger=False,
        ping_timeout=60, 
        ping_interval=25,
        max_http_buffer_size=50_000_000
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

lorax_handler_global = LoraxHandler()

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
):
    sid, session = await get_or_create_session(request, response)
    if file and file != "" and file != "ucgb":
        file_path = UPLOAD_DIR / (project or "") / file
    else:
        file = "1kg_chr20.trees.tsz"
        file_path = UPLOAD_DIR / (project or "1000Genomes") / file
    try:
 
        viz_config, chat_config = await handle_upload(str(file_path))
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

    # file_path = user_dir / file.filename if IS_VM else user_dir / file.filename
    file_path = user_dir / file.filename

    print("file_path", file_path)
    try:
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                await f.write(chunk)

        # Upload to GCS asynchronously
        if IS_VM:
            gcs_url = await upload_to_gcs(BUCKET_NAME, file_path, sid)
        
        # viz_config, _ = await handle_upload(str(file_path))
        return JSONResponse(
            status_code=200,
            content={"message": "File uploaded", "sid": sid, "filename": file.filename}
        )
    except Exception as e:
        print("❌ Upload error:", e)
        return JSONResponse(status_code=500, content={"error": "Upload error"})

# @app.post('/load_file')
# async def load_file(request: Request, response: Response):
#     """Reload an existing file for this session."""
#     start = time.time()
#     sid, session = await get_or_create_session(request, response)
#     data = await request.json()
#     project = data.get("project")
#     filename = data.get("file")

#     if not filename:
#         return JSONResponse(status_code=400, content={"error": "Missing 'file'."})

    
#     print("project", project, filename, IS_VM)
#     if project == 'Uploads' and IS_VM:
#         file_path = UPLOAD_DIR / project /  sid / filename
#     else:
#         file_path = UPLOAD_DIR / project / filename

#         print("file_path", file_path)
#         if BUCKET_NAME:
#             if file_path.exists():
#                 print(f"File {file_path} already exists, skipping download.")
#             else:
#                 print(f"Downloading file {project}/{filename} from {BUCKET_NAME}")
#                 await download_gcs_file(BUCKET_NAME, f"{file_path}", str(file_path))
#         else:
#             print("using gcs mount point")
#             file_path = UPLOAD_DIR / project / filename

#     if not file_path.exists():
#         return JSONResponse(status_code=404, content={"error": "File not found."})

#     session.file_path = str(file_path)
#     await save_session(session)
    
#     print("loading file", file_path, os.getpid())
#     viz_config, chat_config = await handle_upload(str(file_path))


#     end = time.time()
#     print(f"Time taken to load file: {end - start} seconds")

#     return {"message": "File loaded", "sid": sid, "filename": filename, "config": viz_config}

@sio.event
async def connect(sid, environ, auth=None):
    print(f"🔌 Socket.IO connected: {sid}")

    cookie = environ.get("HTTP_COOKIE", "")

    cookies = SimpleCookie()
    cookies.load(cookie)

    print("cookie", cookies.get("lorax_sid"))

    session_id = cookies.get("lorax_sid").value
       
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
        if not lorax_sid:
            print(f"⚠️ Missing lorax_sid")
            return
        # session = sessions[lorax_sid]

        if USE_REDIS:
            raw = await redis_client.get(f"sessions:{lorax_sid}")
            print("raw", raw)
            if not raw:
                print(f"⚠️ Unknown sid {lorax_sid}")
                return
            session = Session.from_dict(json.loads(raw))
        else:
            session = sessions.get(lorax_sid)

        project = str(data.get("project"))
        filename = str(data.get("file"))
        print("lorax_sid", lorax_sid, project, filename)
        if not filename:
            return JSONResponse(status_code=400, content={"error": "Missing 'file'."})
    
        if project == 'Uploads' and IS_VM:
            file_path = UPLOAD_DIR / project / lorax_sid / filename
            blob_path = f"{project}/{lorax_sid}/{filename}"
        else:
            file_path = UPLOAD_DIR / project / filename
            blob_path = f"{project}/{filename}"

        print("file_path", file_path)
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
        viz_config, chat_config = await handle_upload(str(file_path))

        await sio.emit("load-file-result", {"message": "File loaded", "sid": sid, "filename": filename, "config": viz_config}, to=sid)

    except Exception as e:
        print(f"Load file error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@sio.event
async def load_file(sid, data):
        asyncio.create_task(background_load_file(sid, data))

@sio.event
async def query(sid, data):
    try:
        lorax_sid = data.get("lorax_sid")
        if not lorax_sid:
            print(f"⚠️ Missing lorax_sid")
            return

        # Retrieve session from Redis or memory
        if USE_REDIS:
            raw = await redis_client.get(f"sessions:{lorax_sid}")
            if not raw:
                print(f"⚠️ Unknown sid {lorax_sid}")
                return
            session = Session.from_dict(json.loads(raw))
        else:
            session = sessions.get(lorax_sid)

        if not session or not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            return

        print("fetch query in ", session.sid, os.getpid())
        result = await handle_query(session.file_path, data.get("localTrees"))
        print("sending data to", sid)
        await sio.emit("query-result", {"data": json.loads(result)}, to=sid)
    except Exception as e:
        print(f"❌ Query error: {e}")
        await sio.emit("query-result", {"error": str(e)}, to=sid)

@sio.event
async def details(sid, data):
    try:
        lorax_sid = data.get("lorax_sid")
        if USE_REDIS:
            raw = await redis_client.get(f"sessions:{lorax_sid}")
            if not raw:
                print(f"⚠️ Unknown sid {lorax_sid}")
                return

            session = Session.from_dict(json.loads(raw))
        else:
            session = sessions.get(lorax_sid)

        if not session or not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            return
        
        print("fetch details in ", session.sid, os.getpid())

        result = await handle_details(session.file_path, data)
        await sio.emit("details-result", {"data": json.loads(result)}, to=sid)
    except Exception as e:
        print(f"❌ Details error: {e}")
        await sio.emit("details-result", {"error": str(e)}, to=sid)