"""
Metadata event handlers for Lorax Socket.IO.

Handles search_metadata and fetch_metadata_array events.
"""

import asyncio

from lorax.constants import ERROR_NO_FILE_LOADED
from lorax.metadata.loader import (
    search_samples_by_metadata, get_metadata_array_for_key
)
from lorax.cache import get_file_context
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file


def register_metadata_events(sio):
    """Register metadata-related socket events."""

    @sio.event
    async def search_metadata(sid, data):
        """Socket event to search for samples matching a metadata value."""
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
                key = data.get("key")
                value = data.get("value")
                if key == "sample":
                    ctx = await get_file_context(session.file_path)
                    if ctx is None:
                        await sio.emit("search-result", {"error": "Failed to load CSV"}, to=sid)
                        return
                    sample_names = ctx.config.get("sample_names", {})
                    # Return matching sample names (exact match)
                    matching = [name for name in sample_names.keys() if name == value]
                    await sio.emit("search-result", {"key": key, "value": value, "samples": matching}, to=sid)
                    return
                else:
                    await sio.emit("search-result", {
                        "error": f"Metadata key '{key}' is not supported for CSV files."
                    }, to=sid)
                    return

            key = data.get("key")
            value = data.get("value")

            if not key or value is None:
                await sio.emit("search-result", {
                    "error": "Missing 'key' or 'value' parameter"
                }, to=sid)
                return

            ctx = await get_file_context(session.file_path)
            if ctx is None:
                await sio.emit("search-result", {
                    "error": "Failed to load tree sequence"
                }, to=sid)
                return

            # Pass FileContext to metadata function
            result = await asyncio.to_thread(
                search_samples_by_metadata, ctx, key, value
            )
            await sio.emit("search-result", {
                "key": key,
                "value": value,
                "samples": result
            }, to=sid)
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
                key = data.get("key")
                if key == "sample":
                    ctx = await get_file_context(session.file_path)
                    if ctx is None:
                        await sio.emit("metadata-array-result", {"error": "Failed to load CSV"}, to=sid)
                        return

                    sample_names = ctx.config.get("sample_names", {})
                    names_list = list(sample_names.keys())

                    # Build PyArrow array where each sample maps to its own unique index
                    import numpy as np
                    import pyarrow as pa

                    unique_values = names_list
                    indices = np.arange(len(names_list), dtype=np.uint32)

                    # Create Arrow IPC buffer
                    table = pa.table({'idx': pa.array(indices, type=pa.uint32())})
                    sink = pa.BufferOutputStream()
                    writer = pa.ipc.new_stream(sink, table.schema)
                    writer.write_table(table)
                    writer.close()

                    await sio.emit("metadata-array-result", {
                        "key": key,
                        "unique_values": unique_values,
                        "sample_node_ids": list(range(len(names_list))),  # Sequential indices for CSV
                        "buffer": sink.getvalue().to_pybytes()
                    }, to=sid)
                    return
                else:
                    await sio.emit("metadata-array-result", {
                        "error": f"Metadata key '{key}' is not supported for CSV files."
                    }, to=sid)
                    return

            key = data.get("key")
            if not key:
                await sio.emit("metadata-array-result", {
                    "error": "Missing 'key' parameter"
                }, to=sid)
                return

            ctx = await get_file_context(session.file_path)
            if ctx is None:
                await sio.emit("metadata-array-result", {
                    "error": "Failed to load tree sequence"
                }, to=sid)
                return

            # Pass FileContext to metadata function
            result = await asyncio.to_thread(
                get_metadata_array_for_key, ctx, key
            )

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
