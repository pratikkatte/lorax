"""
Tree layout event handlers for Lorax Socket.IO.

Handles process_postorder_layout and cache_trees events.
"""

from lorax.context import tree_graph_cache
from lorax.handlers import handle_tree_graph_query, ensure_trees_cached
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file


def register_tree_layout_events(sio):
    """Register tree layout socket events."""

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
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "request_id": data.get("request_id")}

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                return {"error": "No file loaded for session", "request_id": data.get("request_id")}

            display_array = data.get("displayArray", [])
            actual_display_array = data.get("actualDisplayArray", display_array)
            sparsification = data.get("sparsification", False)
            request_id = data.get("request_id")

            # handle_tree_graph_query returns dict with PyArrow buffer (Numba-optimized)
            # Pass session_id and tree_graph_cache for caching TreeGraph objects
            # actual_display_array contains all visible trees for cache eviction
            result = await handle_tree_graph_query(
                session.file_path,
                display_array,
                sparsification=sparsification,
                session_id=lorax_sid,
                tree_graph_cache=tree_graph_cache,
                actual_display_array=actual_display_array
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
    async def cache_trees(sid, data):
        """Socket event to pre-cache TreeGraph objects for lineage operations.

        Call this after process_postorder_layout to enable subsequent lineage queries.

        data: {
            lorax_sid: str,
            tree_indices: [int]  # Tree indices to cache
        }

        Returns: {
            cached_count: int,  # Number of trees newly cached
            total_cached: int   # Total trees now in cache for session
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "cached_count": 0}

            if not session.file_path:
                return {"error": "No file loaded", "cached_count": 0}

            if is_csv_session_file(session.file_path):
                return {"error": "Lineage not supported for CSV", "cached_count": 0}

            tree_indices = data.get("tree_indices", [])
            if not tree_indices:
                return {"cached_count": 0, "total_cached": 0}

            newly_cached = await ensure_trees_cached(
                session.file_path,
                tree_indices,
                lorax_sid,
                tree_graph_cache
            )

            # Get total cached
            all_cached = await tree_graph_cache.get_all_for_session(lorax_sid)

            return {
                "cached_count": newly_cached,
                "total_cached": len(all_cached)
            }
        except Exception as e:
            print(f"❌ Cache trees error: {e}")
            return {"error": str(e), "cached_count": 0}
