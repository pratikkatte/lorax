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

from lorax.handlers import (
    handle_upload, handle_edges_query, get_projects, cache_status,
    handle_details, get_or_load_config,
    get_or_load_ts, get_metadata_for_key, search_samples_by_metadata,
    get_metadata_array_for_key,
    get_mutations_in_window, search_mutations_by_position, mutations_to_arrow_buffer,
    search_nodes_in_trees
)
from lorax.handlers_postorder import handle_postorder_query
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


@sio.event
async def process_postorder_layout(sid, data):
    """Socket event to get post-order tree traversal for efficient rendering.

    Returns PyArrow IPC binary data with post-order node arrays.
    Frontend computes layout using stack-based reconstruction.
    """
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        display_array = data.get("displayArray", [])

        # handle_postorder_query returns dict with PyArrow buffer
        result = await handle_postorder_query(session.file_path, display_array)

        if "error" in result:
            await sio.emit("postorder-layout-result", {"error": result["error"]}, to=sid)
        else:
            # Send binary buffer with metadata
            await sio.emit("postorder-layout-result", {
                "buffer": result["buffer"],  # Binary PyArrow IPC data
                "global_min_time": result["global_min_time"],
                "global_max_time": result["global_max_time"],
                "tree_indices": result["tree_indices"]
            }, to=sid)
    except Exception as e:
        print(f"❌ Postorder layout query error: {e}")
        await sio.emit("postorder-layout-result", {"error": str(e)}, to=sid)


@sio.event
async def fetch_metadata_for_key(sid, data):
    """Socket event to fetch metadata mapping for a specific key."""
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        key = data.get("key")
        if not key:
            await sio.emit("metadata-key-result", {"error": "Missing 'key' parameter"}, to=sid)
            return

        ts = await get_or_load_ts(session.file_path)
        if ts is None:
            await sio.emit("metadata-key-result", {"error": "Failed to load tree sequence"}, to=sid)
            return

        result = await asyncio.to_thread(get_metadata_for_key, ts, session.file_path, key)
        await sio.emit("metadata-key-result", {"key": key, "data": result}, to=sid)
    except Exception as e:
        print(f"❌ Metadata fetch error: {e}")
        await sio.emit("metadata-key-result", {"error": str(e)}, to=sid)


@sio.event
async def search_metadata(sid, data):
    """Socket event to search for samples matching a metadata value."""
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        key = data.get("key")
        value = data.get("value")

        if not key or value is None:
            await sio.emit("search-result", {"error": "Missing 'key' or 'value' parameter"}, to=sid)
            return

        ts = await get_or_load_ts(session.file_path)
        if ts is None:
            await sio.emit("search-result", {"error": "Failed to load tree sequence"}, to=sid)
            return

        result = await asyncio.to_thread(search_samples_by_metadata, ts, session.file_path, key, value)
        await sio.emit("search-result", {"key": key, "value": value, "samples": result}, to=sid)
    except Exception as e:
        print(f"❌ Search error: {e}")
        await sio.emit("search-result", {"error": str(e)}, to=sid)


@sio.event
async def fetch_metadata_array(sid, data):
    """Socket event to fetch metadata as efficient PyArrow array format.

    This is optimized for large tree sequences (1M+ samples) where JSON
    serialization would be too slow/large. Returns binary Arrow IPC data
    with indices that map node_id -> value index.
    """
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        key = data.get("key")
        if not key:
            await sio.emit("metadata-array-result", {"error": "Missing 'key' parameter"}, to=sid)
            return

        ts = await get_or_load_ts(session.file_path)
        if ts is None:
            await sio.emit("metadata-array-result", {"error": "Failed to load tree sequence"}, to=sid)
            return

        result = await asyncio.to_thread(get_metadata_array_for_key, ts, session.file_path, key)

        # Send metadata with Arrow buffer as binary
        await sio.emit("metadata-array-result", {
            "key": key,
            "unique_values": result['unique_values'],
            "sample_node_ids": result['sample_node_ids'],
            "buffer": result['arrow_buffer']  # Binary data
        }, to=sid)

    except Exception as e:
        print(f"❌ Metadata array fetch error: {e}")
        await sio.emit("metadata-array-result", {"error": str(e)}, to=sid)


@sio.event
async def query_mutations_window(sid, data):
    """Socket event to fetch mutations within a genomic window.

    Returns PyArrow IPC binary data with mutations in the specified range.
    Supports pagination via offset and limit parameters.
    """
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
        offset = data.get("offset", 0)
        limit = data.get("limit", 1000)

        ts = await get_or_load_ts(session.file_path)
        if ts is None:
            await sio.emit("mutations-window-result", {"error": "Failed to load tree sequence"}, to=sid)
            return

        # Get mutations in the window
        result = await asyncio.to_thread(get_mutations_in_window, ts, start, end, offset, limit)

        # Convert to PyArrow buffer
        buffer = await asyncio.to_thread(mutations_to_arrow_buffer, result)

        await sio.emit("mutations-window-result", {
            "buffer": buffer,
            "total_count": result['total_count'],
            "has_more": result['has_more'],
            "start": start,
            "end": end,
            "offset": offset,
            "limit": limit
        }, to=sid)

    except Exception as e:
        print(f"❌ Mutations window query error: {e}")
        await sio.emit("mutations-window-result", {"error": str(e)}, to=sid)


@sio.event
async def search_mutations(sid, data):
    """Socket event to search mutations by position with configurable range.

    Returns PyArrow IPC binary data with mutations sorted by distance from position.
    Supports pagination via offset and limit parameters.
    """
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        position = data.get("position")
        if position is None:
            await sio.emit("mutations-search-result", {"error": "Missing 'position' parameter"}, to=sid)
            return

        range_bp = data.get("range_bp", 5000)
        offset = data.get("offset", 0)
        limit = data.get("limit", 1000)

        ts = await get_or_load_ts(session.file_path)
        if ts is None:
            await sio.emit("mutations-search-result", {"error": "Failed to load tree sequence"}, to=sid)
            return

        # Search mutations around the position
        result = await asyncio.to_thread(search_mutations_by_position, ts, position, range_bp, offset, limit)

        # Convert to PyArrow buffer
        buffer = await asyncio.to_thread(mutations_to_arrow_buffer, result)

        await sio.emit("mutations-search-result", {
            "buffer": buffer,
            "total_count": result['total_count'],
            "has_more": result['has_more'],
            "search_start": result['search_start'],
            "search_end": result['search_end'],
            "position": position,
            "range_bp": range_bp,
            "offset": offset,
            "limit": limit
        }, to=sid)

    except Exception as e:
        print(f"❌ Mutations search error: {e}")
        await sio.emit("mutations-search-result", {"error": str(e)}, to=sid)


@sio.event
async def search_nodes(sid, data):
    """Socket event to search for nodes matching metadata values in trees.

    This is used for highlighting nodes when searching/filtering by metadata.
    Returns node_ids for matching samples in each tree, and optionally lineage paths.
    Frontend computes positions using the post-order layout data.

    data: {
        lorax_sid: str,
        sample_names: [str],    # Sample names to search for
        tree_indices: [int],    # Tree indices to search in
        show_lineages: bool,    # Whether to compute lineage paths
        sample_colors: dict     # Optional {sample_name: [r,g,b,a]}
    }

    Returns: {
        highlights: {tree_idx: [{node_id, name}]},
        lineage: {tree_idx: [{path_node_ids: [int], color}]}
    }
    """
    try:
        lorax_sid = data.get("lorax_sid")
        session = await require_session(lorax_sid, sid)
        if not session:
            return

        if not session.file_path:
            print(f"⚠️ No file loaded for session {lorax_sid}")
            await sio.emit("error", {"code": ERROR_NO_FILE_LOADED, "message": "No file loaded. Please load a file first."}, to=sid)
            return

        sample_names = data.get("sample_names", [])
        tree_indices = data.get("tree_indices", [])
        show_lineages = data.get("show_lineages", False)
        sample_colors = data.get("sample_colors", {})

        if not sample_names or not tree_indices:
            await sio.emit("search-nodes-result", {"highlights": {}, "lineage": {}}, to=sid)
            return

        ts = await get_or_load_ts(session.file_path)
        if ts is None:
            await sio.emit("search-nodes-result", {"error": "Failed to load tree sequence"}, to=sid)
            return

        result = await asyncio.to_thread(
            search_nodes_in_trees,
            ts,
            sample_names,
            tree_indices,
            show_lineages,
            sample_colors
        )

        await sio.emit("search-nodes-result", result, to=sid)

    except Exception as e:
        print(f"❌ Search nodes error: {e}")
        await sio.emit("search-nodes-result", {"error": str(e)}, to=sid)