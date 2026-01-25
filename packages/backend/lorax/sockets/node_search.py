"""
Node search event handlers for Lorax Socket.IO.

Handles search_nodes and get_highlight_positions_event events.
"""

import asyncio

from lorax.context import tree_graph_cache
from lorax.constants import ERROR_NO_FILE_LOADED
from lorax.handlers import search_nodes_in_trees, get_highlight_positions
from lorax.cache import get_file_context
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file


def register_node_search_events(sio):
    """Register node search socket events."""

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
                await sio.emit("search-nodes-result", {
                    "highlights": {},
                    "lineage": {}
                }, to=sid)
                return

            sample_names = data.get("sample_names", [])
            tree_indices = data.get("tree_indices", [])
            show_lineages = data.get("show_lineages", False)
            sample_colors = data.get("sample_colors", {})

            # Check cache and warn if trees not found (they should be cached from layout)
            if tree_indices:
                uncached = []
                for tree_idx in tree_indices:
                    cached = await tree_graph_cache.get(lorax_sid, int(tree_idx))
                    if cached is None:
                        uncached.append(tree_idx)
                if uncached:
                    print(f"⚠️ WARNING: Trees {uncached} not in cache for session {lorax_sid[:8]}... "
                          f"(expected from layout render)")

            if not sample_names or not tree_indices:
                await sio.emit("search-nodes-result", {
                    "highlights": {},
                    "lineage": {}
                }, to=sid)
                return

            ctx = await get_file_context(session.file_path)
            if ctx is None:
                await sio.emit("search-nodes-result", {
                    "error": "Failed to load tree sequence"
                }, to=sid)
                return

            ts = ctx.tree_sequence

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
                await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                return

            metadata_key = data.get("metadata_key")
            metadata_value = data.get("metadata_value")
            tree_indices = data.get("tree_indices", [])

            if not metadata_key or metadata_value is None:
                await sio.emit("highlight-positions-result", {
                    "error": "Missing metadata_key or metadata_value"
                }, to=sid)
                return

            if not tree_indices:
                await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                return

            ctx = await get_file_context(session.file_path)
            if ctx is None:
                await sio.emit("highlight-positions-result", {
                    "error": "Failed to load tree sequence"
                }, to=sid)
                return

            ts = ctx.tree_sequence

            result = await get_highlight_positions(
                ts,
                session.file_path,
                metadata_key,
                metadata_value,
                tree_indices,
                lorax_sid,
                tree_graph_cache
            )

            await sio.emit("highlight-positions-result", result, to=sid)
        except Exception as e:
            print(f"❌ Get highlight positions error: {e}")
            await sio.emit("highlight-positions-result", {"error": str(e)}, to=sid)
