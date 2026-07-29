"""
Mutation event handlers for Lorax Socket.IO.

Handles query_mutations_window and search_mutations events.
"""

import asyncio

from lorax.artifacts.csr_reader import CSRArtifactCapabilityError
from lorax.artifacts.features import artifact_mutation_search
from lorax.artifacts.runtime import context_for_session, is_artifact_session
from lorax.constants import ERROR_NO_FILE_LOADED
from lorax.metadata.mutations import (
    get_mutations_in_window, search_mutations_by_position
)
from lorax.buffer import mutations_to_arrow_buffer
from lorax.cache import get_file_context
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file


def register_mutations_events(sio):
    """Register mutation-related socket events."""

    @sio.event
    async def query_mutations_window(sid, data):
        """Socket event to fetch mutations within a genomic window.

        Returns PyArrow IPC binary data with mutations in the specified range.
        Supports pagination via offset and limit parameters.
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return

            if is_csv_session_file(session.file_path):
                await sio.emit("mutations-window-result", {
                    "error": "Mutations are not supported for CSV yet."
                }, to=sid)
                return

            start = data.get("start", 0)
            end = data.get("end", 0)
            offset = data.get("offset", 0)
            limit = data.get("limit", 1000)

            if is_artifact_session(session):
                try:
                    context = await asyncio.to_thread(context_for_session, session)
                    result = await asyncio.to_thread(
                        context.reader.mutations_in_range,
                        start,
                        end,
                        offset=offset,
                        limit=limit,
                    )
                except CSRArtifactCapabilityError as exc:
                    await sio.emit(
                        "mutations-window-result",
                        {"error": str(exc), "code": exc.code},
                        to=sid,
                    )
                    return
            else:
                ctx = await get_file_context(session.file_path)
                if ctx is None:
                    await sio.emit("mutations-window-result", {
                        "error": "Failed to load tree sequence"
                    }, to=sid)
                    return
                result = await asyncio.to_thread(
                    get_mutations_in_window,
                    ctx.tree_sequence,
                    start,
                    end,
                    offset,
                    limit,
                )

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
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return

            if is_csv_session_file(session.file_path):
                await sio.emit("mutations-search-result", {
                    "error": "Mutations search is not supported for CSV yet."
                }, to=sid)
                return

            position = data.get("position")
            if position is None:
                await sio.emit("mutations-search-result", {
                    "error": "Missing 'position' parameter"
                }, to=sid)
                return

            range_bp = data.get("range_bp", 5000)
            offset = data.get("offset", 0)
            limit = data.get("limit", 1000)

            if is_artifact_session(session):
                try:
                    context = await asyncio.to_thread(context_for_session, session)
                    result = await asyncio.to_thread(
                        artifact_mutation_search,
                        context.reader,
                        position,
                        range_bp,
                        offset,
                        limit,
                    )
                except CSRArtifactCapabilityError as exc:
                    await sio.emit(
                        "mutations-search-result",
                        {"error": str(exc), "code": exc.code},
                        to=sid,
                    )
                    return
            else:
                ctx = await get_file_context(session.file_path)
                if ctx is None:
                    await sio.emit("mutations-search-result", {
                        "error": "Failed to load tree sequence"
                    }, to=sid)
                    return
                result = await asyncio.to_thread(
                    search_mutations_by_position,
                    ctx.tree_sequence,
                    position,
                    range_bp,
                    offset,
                    limit,
                )

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
