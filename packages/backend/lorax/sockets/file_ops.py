"""
File operation event handlers for Lorax Socket.IO.

Handles load_file, details, and query events.
"""

import os
import json
import asyncio
from pathlib import Path

from lorax.context import session_manager, BUCKET_NAME, tree_graph_cache, csv_tree_graph_cache
from lorax.modes import CURRENT_MODE
from lorax.constants import (
    UPLOADS_DIR, ERROR_SESSION_NOT_FOUND, ERROR_MISSING_SESSION, ERROR_NO_FILE_LOADED,
)
from lorax.cloud.gcs_utils import download_gcs_file
from lorax.handlers import handle_upload, handle_details
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file

UPLOAD_DIR = Path(UPLOADS_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)

DEV_MODE = CURRENT_MODE == "development"


def dev_print(*args, **kwargs):
    """Print only when running in development mode."""
    if DEV_MODE:
        print(*args, **kwargs)


def register_file_events(sio):
    """Register file operation socket events."""

    async def background_load_file(sid, data):
        try:
            lorax_sid = data.get("lorax_sid")
            share_sid = data.get("share_sid")

            if not lorax_sid:
                dev_print(f"⚠️ Missing lorax_sid")
                await sio.emit("error", {
                    "code": ERROR_MISSING_SESSION,
                    "message": "Session ID is missing."
                }, to=sid)
                return

            session = await session_manager.get_session(lorax_sid)
            if not session:
                dev_print(f"⚠️ Unknown sid {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_SESSION_NOT_FOUND,
                    "message": "Session expired. Please refresh the page."
                }, to=sid)
                return

            if share_sid and share_sid != lorax_sid:
                dev_print(f"⚠️ share_sid denied for sid={lorax_sid} target={share_sid}")
                await sio.emit("error", {
                    "code": "share_sid_denied",
                    "message": "Access denied for shared upload."
                }, to=sid)
                return

            project = str(data.get("project"))
            filename = str(data.get("file"))

            # Extract genomic coordinates from client if provided
            genomiccoordstart = data.get("genomiccoordstart")
            genomiccoordend = data.get("genomiccoordend")
            dev_print("lorax_sid", lorax_sid, project, filename)
            if not filename:
                dev_print("Missing file param")
                return

            gcs_allowed = True
            if project == 'Uploads':
                target_sid = share_sid if share_sid else lorax_sid
                if CURRENT_MODE == "local":
                    # Local mode keeps uploads flat and does not pull uploads from GCS
                    file_path = UPLOAD_DIR / project / filename
                    blob_path = f"{project}/{filename}"
                    gcs_allowed = False
                else:
                    file_path = UPLOAD_DIR / project / target_sid / filename
                    blob_path = f"{project}/{target_sid}/{filename}"
            else:
                file_path = UPLOAD_DIR / project / filename
                blob_path = f"{project}/{filename}"

            if BUCKET_NAME and gcs_allowed:
                if file_path.exists():
                    dev_print(f"File {file_path} already exists, skipping download.")
                else:
                    dev_print(f"Downloading file {file_path} from {BUCKET_NAME}")
                    print(f"[Lorax] Downloading gs://{BUCKET_NAME}/{blob_path} -> {file_path}")
                    await download_gcs_file(BUCKET_NAME, f"{blob_path}", str(file_path))
            else:
                dev_print("using local files (GCS disabled for this request)")

            if not file_path.exists():
                dev_print("File not found")
                return

            # Clear TreeGraph cache when loading a new file
            await tree_graph_cache.clear_session(lorax_sid)
            await csv_tree_graph_cache.clear_session(lorax_sid)

            session.file_path = str(file_path)
            await session_manager.save_session(session)

            dev_print("loading file", file_path, os.getpid())
            ctx = await handle_upload(str(file_path), str(UPLOAD_DIR))

            await sio.emit("status", {
                "status": "processing-file",
                "message": "Processing file...",
                "filename": filename,
                "project": project
            }, to=sid)

            # Config is already computed and cached in FileContext
            config = ctx.config

            if config is None:
                await sio.emit("error", {"message": "Failed to load file configuration"}, to=sid)
                return

            # Override initial_position if client provided genomic coordinates
            if genomiccoordstart is not None and genomiccoordend is not None:
                try:
                    config['initial_position'] = [int(genomiccoordstart), int(genomiccoordend)]
                    dev_print(f"Using client-provided coordinates: [{genomiccoordstart}, {genomiccoordend}]")
                except (ValueError, TypeError) as e:
                    dev_print(f"Invalid coordinates, using computed: {e}")

            owner_sid = share_sid if share_sid else lorax_sid
            await sio.emit("load-file-result", {
                "message": "File loaded",
                "sid": sid,
                "filename": filename,
                "config": config,
                "owner_sid": owner_sid
            }, to=sid)

        except Exception as e:
            dev_print(f"Load file error: {e}")
            await sio.emit("error", {"message": str(e)}, to=sid)

    @sio.event
    async def load_file(sid, data):
        asyncio.create_task(background_load_file(sid, data))

    @sio.event
    async def details(sid, data):
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return

            if not session.file_path:
                dev_print(f"⚠️ No file loaded for session {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return

            if is_csv_session_file(session.file_path):
                await sio.emit("details-result", {
                    "data": {"error": "Details are not supported for CSV yet."}
                }, to=sid)
                return

            dev_print("fetch details in ", session.sid, os.getpid())

            result = await handle_details(session.file_path, data)
            await sio.emit("details-result", {"data": json.loads(result)}, to=sid)
        except Exception as e:
            dev_print(f"❌ Details error: {e}")
            await sio.emit("details-result", {"error": str(e)}, to=sid)

    @sio.event
    async def query(sid, data):
        """Socket event to query tree nodes."""
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return

            if not session.file_path:
                dev_print(f"⚠️ No file loaded for session {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return

            value = data.get("value")
            local_trees = data.get("localTrees", [])

            # Acknowledge the query - the actual tree data is processed by the frontend worker
            await sio.emit("query-result", {
                "data": {"value": value, "localTrees": local_trees}
            }, to=sid)
        except Exception as e:
            dev_print(f"❌ Query error: {e}")
            await sio.emit("query-result", {"error": str(e)}, to=sid)
