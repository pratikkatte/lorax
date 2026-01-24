import os
import json
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from http.cookies import SimpleCookie

from fastapi.responses import JSONResponse

from lorax.context import session_manager, IS_VM, BUCKET_NAME, disk_cache_manager
from lorax.constants import (
    UPLOADS_DIR, ERROR_SESSION_NOT_FOUND, ERROR_MISSING_SESSION, ERROR_NO_FILE_LOADED,
    ERROR_CONNECTION_REPLACED, ENFORCE_CONNECTION_LIMITS,
)
from lorax.cloud.gcs_utils import download_gcs_file, download_gcs_file_cached

# Handlers
from lorax.handlers import (
    handle_upload, handle_details,
    handle_tree_graph_query,
    get_or_load_ts, get_metadata_for_key, search_samples_by_metadata,
    get_metadata_array_for_key,
    get_mutations_in_window, search_mutations_by_position, mutations_to_arrow_buffer,
    search_nodes_in_trees, get_highlight_positions
)
from lorax.loaders.loader import get_or_load_config

UPLOAD_DIR = Path(UPLOADS_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)

def register_socket_events(sio):
    
    def _is_csv_session_file(file_path: str | None) -> bool:
        return bool(file_path) and str(file_path).lower().endswith(".csv")
    
    async def require_session(lorax_sid: str, socket_sid: str):
        """Get session or emit error to client. Returns None if session not found."""
        session = await session_manager.get_session(lorax_sid)
        if not session:
            await sio.emit("error", {
                "code": ERROR_SESSION_NOT_FOUND,
                "message": "Session expired. Please refresh the page."
            }, to=socket_sid)
            return None
        return session

    # Mapping from socket_sid to lorax_sid for disconnect handling
    _socket_to_session: dict = {}

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

        # Validate session exists
        session = await session_manager.get_session(session_id)
        if not session:
            print(f"⚠️ Session not found: {session_id}")
            await sio.emit("error", {"code": ERROR_SESSION_NOT_FOUND, "message": "Session expired. Please refresh the page."}, to=sid)
            return

        # Track this socket connection
        replaced_socket_sid = session.add_socket(sid)
        await session_manager.save_session(session)

        # Store mapping for disconnect handling
        _socket_to_session[sid] = session_id

        # If we replaced an old connection, notify it
        if replaced_socket_sid:
            print(f"🔄 Replacing old socket {replaced_socket_sid} with new socket {sid}")
            await sio.emit("connection-replaced", {
                "code": ERROR_CONNECTION_REPLACED,
                "message": "This connection was replaced by a newer tab. Please use the new tab.",
            }, to=replaced_socket_sid)
            # Disconnect the old socket
            try:
                await sio.disconnect(replaced_socket_sid)
            except Exception as e:
                print(f"Warning: Failed to disconnect old socket: {e}")

        # Send session state
        if session.file_path:
            await sio.emit("session-restored", {
                "lorax_sid": session_id,
                "file_path": session.file_path
            }, to=sid)
        else:
            await sio.emit("status", {"message": "Connected", "lorax_sid": session_id}, to=sid)

    @sio.event
    async def disconnect(sid):
        print(f"🔌 Socket.IO disconnected: {sid}")

        # Remove socket from session tracking
        session_id = _socket_to_session.pop(sid, None)
        if session_id:
            session = await session_manager.get_session(session_id)
            if session:
                session.remove_socket(sid)
                await session_manager.save_session(session)

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

            session = await session_manager.get_session(lorax_sid)
            if not session:
                print(f"⚠️ Unknown sid {lorax_sid}")
                await sio.emit("error", {"code": ERROR_SESSION_NOT_FOUND, "message": "Session expired. Please refresh the page."}, to=sid)
                return

            project = str(data.get("project"))
            filename = str(data.get("file"))

            # Extract genomic coordinates from client if provided
            genomiccoordstart = data.get("genomiccoordstart")
            genomiccoordend = data.get("genomiccoordend")
            print("lorax_sid", lorax_sid, project, filename)
            if not filename:
                # Note: returning JSONResponse in a background task doesn't send it to HTTP client.
                # But existing code has this return. Might be a bug in original code or intended for debugging?
                # We'll keep logic but emit error makes more sense for socket.
                print("Missing file param")
                return 
        
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
                 # Same ignore return
                 print("File not found")
                 return

            session.file_path = str(file_path)
            await session_manager.save_session(session)
        
            print("loading file", file_path, os.getpid())
            ts = await handle_upload(str(file_path), UPLOAD_DIR)
            
            await sio.emit("status", {"status": "processing-file", "message": "Processing file...", "filename": filename, "project": project}, to=sid)

            config = await asyncio.to_thread(get_or_load_config, ts, str(file_path), UPLOAD_DIR)

            if config is None:
                await sio.emit("error", {"message": "Failed to load file configuration"}, to=sid)
                return

            # Override initial_position if client provided genomic coordinates
            if genomiccoordstart is not None and genomiccoordend is not None:
                try:
                    config['initial_position'] = [int(genomiccoordstart), int(genomiccoordend)]
                    print(f"Using client-provided coordinates: [{genomiccoordstart}, {genomiccoordend}]")
                except (ValueError, TypeError) as e:
                    print(f"Invalid coordinates, using computed: {e}")

            owner_sid = share_sid if share_sid else lorax_sid
            await sio.emit("load-file-result", {"message": "File loaded", "sid": sid, "filename": filename, "config": config, "owner_sid": owner_sid}, to=sid)

        except Exception as e:
            print(f"Load file error: {e}")
            # Note: original code returned JSONResponse here too. 
            # We should probably emit an error event instead or as well.
            # Original code: return JSONResponse(...)
            # I will emit error to user.
            await sio.emit("error", {"message": str(e)}, to=sid)

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
            
            if _is_csv_session_file(session.file_path):
                await sio.emit("details-result", {"data": {"error": "Details are not supported for CSV yet."}}, to=sid)
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
    async def process_postorder_layout(sid, data):
        """Socket event to get post-order tree traversal for efficient rendering.

        Returns PyArrow IPC binary data with post-order node arrays.
        Frontend computes layout using stack-based reconstruction.

        Uses Socket.IO acknowledgement callback pattern - returns result directly
        instead of emitting to ensure request-response correlation.
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid)
            if not session:
                return {"error": "Session not found", "request_id": data.get("request_id")}

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                return {"error": "No file loaded for session", "request_id": data.get("request_id")}

            display_array = data.get("displayArray", [])
            sparsification = data.get("sparsification", False)
            request_id = data.get("request_id")

            # handle_tree_graph_query returns dict with PyArrow buffer (Numba-optimized)
            result = await handle_tree_graph_query(
                session.file_path,
                display_array,
                sparsification=sparsification
            )

            if "error" in result:
                return {"error": result["error"], "request_id": request_id}
            else:
                # Return result directly - Socket.IO sends as acknowledgement callback
                return {
                    "buffer": result["buffer"],  # Binary PyArrow IPC data
                    "global_min_time": result["global_min_time"],
                    "global_max_time": result["global_max_time"],
                    "tree_indices": result["tree_indices"],
                    "request_id": request_id
                }
        except Exception as e:
            print(f"❌ Postorder layout query error: {e}")
            return {"error": str(e), "request_id": data.get("request_id")}


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
            
            if _is_csv_session_file(session.file_path):
                await sio.emit("metadata-key-result", {"error": "Metadata is not supported for CSV yet."}, to=sid)
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
            
            if _is_csv_session_file(session.file_path):
                await sio.emit("search-result", {"error": "Metadata search is not supported for CSV yet."}, to=sid)
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
            
            if _is_csv_session_file(session.file_path):
                await sio.emit("metadata-array-result", {"error": "Metadata arrays are not supported for CSV yet."}, to=sid)
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
            
            if _is_csv_session_file(session.file_path):
                await sio.emit("mutations-window-result", {"error": "Mutations are not supported for CSV yet."}, to=sid)
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
            
            if _is_csv_session_file(session.file_path):
                await sio.emit("mutations-search-result", {"error": "Mutations search is not supported for CSV yet."}, to=sid)
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
            
            if _is_csv_session_file(session.file_path):
                await sio.emit("search-nodes-result", {"highlights": {}, "lineage": {}}, to=sid)
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


    @sio.event
    async def get_highlight_positions_event(sid, data):
        """Socket event to get positions for all tip nodes matching a metadata value.

        Returns positions for ALL matching nodes, ignoring sparsification.
        Used for highlighting nodes that may not be currently rendered.

        data: {
            lorax_sid: str,
            metadata_key: str,      # Metadata key to filter by
            metadata_value: str,    # Metadata value to match
            tree_indices: [int]     # Tree indices to compute positions for
        }

        Returns: {
            positions: [{node_id, tree_idx, x, y}, ...]
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

            if _is_csv_session_file(session.file_path):
                await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                return

            metadata_key = data.get("metadata_key")
            metadata_value = data.get("metadata_value")
            tree_indices = data.get("tree_indices", [])

            if not metadata_key or metadata_value is None:
                await sio.emit("highlight-positions-result", {"error": "Missing metadata_key or metadata_value"}, to=sid)
                return

            if not tree_indices:
                await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                return

            ts = await get_or_load_ts(session.file_path)
            if ts is None:
                await sio.emit("highlight-positions-result", {"error": "Failed to load tree sequence"}, to=sid)
                return

            result = await asyncio.to_thread(
                get_highlight_positions,
                ts,
                session.file_path,
                metadata_key,
                metadata_value,
                tree_indices
            )

            await sio.emit("highlight-positions-result", result, to=sid)
        except Exception as e:
            print(f"❌ Get highlight positions error: {e}")
            await sio.emit("highlight-positions-result", {"error": str(e)}, to=sid)
