"""
Debug event handlers for Lorax Socket.IO.

Handles cache statistics and debugging events.
"""

from lorax.context import tree_graph_cache
from lorax.sockets.decorators import require_session


def register_debug_events(sio):
    """Register debug-related socket events."""

    @sio.event
    async def get_cache_stats(sid, data):
        """Socket event to get TreeGraph cache statistics for debugging.

        data: {
            lorax_sid: str
        }

        Returns: {
            mode: str,
            session_trees: int,  # Trees cached for this session
            stats: dict          # Additional stats
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found"}

            # Get session-specific stats
            cached_trees = await tree_graph_cache.get_all_for_session(lorax_sid)

            # Get global stats
            global_stats = tree_graph_cache.get_stats()

            return {
                "session_trees": len(cached_trees),
                "cached_tree_indices": list(cached_trees.keys()),
                "stats": global_stats
            }
        except Exception as e:
            print(f"❌ Get cache stats error: {e}")
            return {"error": str(e)}
