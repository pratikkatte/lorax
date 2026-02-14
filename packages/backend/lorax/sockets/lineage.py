"""
Lineage event handlers for Lorax Socket.IO.

Handles ancestry and descendant operations:
- get_ancestors_event
- get_descendants_event
- search_nodes_by_criteria_event
- get_subtree_event
- get_mrca_event
"""

from lorax.context import tree_graph_cache
from lorax.handlers import get_or_construct_tree_graph
from lorax.lineage import (
    get_ancestors, get_descendants, search_nodes_by_criteria,
    get_subtree, get_mrca
)
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file


def register_lineage_events(sio):
    """Register lineage-related socket events."""

    @sio.event
    async def get_ancestors_event(sid, data):
        """Socket event to get ancestors (path to root) for a node.

        Requires the tree to be cached first (call cache_trees or process a layout).

        data: {
            lorax_sid: str,
            tree_index: int,
            node_id: int
        }

        Returns: {
            ancestors: [int],           # Node IDs from node to root
            path: [{node_id, time, x, y}],  # x=layout, y=time
            tree_index: int,
            query_node: int
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "ancestors": [], "path": []}

            if not session.file_path:
                return {"error": "No file loaded", "ancestors": [], "path": []}

            if is_csv_session_file(session.file_path):
                return {"error": "Lineage not supported for CSV", "ancestors": [], "path": []}

            tree_index = data.get("tree_index")
            node_id = data.get("node_id")

            if tree_index is None or node_id is None:
                return {"error": "Missing tree_index or node_id", "ancestors": [], "path": []}

            # Ensure tree is cached
            await get_or_construct_tree_graph(
                session.file_path,
                int(tree_index),
                lorax_sid,
                tree_graph_cache
            )

            result = await get_ancestors(
                tree_graph_cache,
                lorax_sid,
                int(tree_index),
                int(node_id)
            )
            return result
        except Exception as e:
            print(f"❌ Get ancestors error: {e}")
            return {"error": str(e), "ancestors": [], "path": []}

    @sio.event
    async def get_descendants_event(sid, data):
        """Socket event to get all descendants of a node.

        data: {
            lorax_sid: str,
            tree_index: int,
            node_id: int,
            include_tips_only: bool  # Optional, default False
        }

        Returns: {
            descendants: [int],
            tips: [int],
            total_descendants: int,
            tree_index: int,
            query_node: int
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "descendants": [], "tips": []}

            if not session.file_path:
                return {"error": "No file loaded", "descendants": [], "tips": []}

            if is_csv_session_file(session.file_path):
                return {"error": "Lineage not supported for CSV", "descendants": [], "tips": []}

            tree_index = data.get("tree_index")
            node_id = data.get("node_id")
            include_tips_only = data.get("include_tips_only", False)

            if tree_index is None or node_id is None:
                return {"error": "Missing tree_index or node_id", "descendants": [], "tips": []}

            # Ensure tree is cached
            await get_or_construct_tree_graph(
                session.file_path,
                int(tree_index),
                lorax_sid,
                tree_graph_cache
            )

            result = await get_descendants(
                tree_graph_cache,
                lorax_sid,
                int(tree_index),
                int(node_id),
                include_tips_only=include_tips_only
            )
            return result
        except Exception as e:
            print(f"❌ Get descendants error: {e}")
            return {"error": str(e), "descendants": [], "tips": []}

    @sio.event
    async def search_nodes_by_criteria_event(sid, data):
        """Socket event to search nodes by criteria (time, tip status, etc).

        data: {
            lorax_sid: str,
            tree_index: int,
            criteria: {
                min_time: float,      # Optional
                max_time: float,      # Optional
                is_tip: bool,         # Optional: True for tips, False for internal
                has_children: bool,   # Optional: inverse of is_tip
                node_ids: [int]       # Optional: filter to these nodes
            }
        }

        Returns: {
            matches: [int],
            positions: [{node_id, x, y, time}],  # x=layout, y=time
            total_matches: int
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "matches": [], "positions": []}

            if not session.file_path:
                return {"error": "No file loaded", "matches": [], "positions": []}

            if is_csv_session_file(session.file_path):
                return {"error": "Search not supported for CSV", "matches": [], "positions": []}

            tree_index = data.get("tree_index")
            criteria = data.get("criteria", {})

            if tree_index is None:
                return {"error": "Missing tree_index", "matches": [], "positions": []}

            # Ensure tree is cached
            await get_or_construct_tree_graph(
                session.file_path,
                int(tree_index),
                lorax_sid,
                tree_graph_cache
            )

            result = await search_nodes_by_criteria(
                tree_graph_cache,
                lorax_sid,
                int(tree_index),
                criteria
            )
            return result
        except Exception as e:
            print(f"❌ Search nodes error: {e}")
            return {"error": str(e), "matches": [], "positions": []}

    @sio.event
    async def get_subtree_event(sid, data):
        """Socket event to get the complete subtree rooted at a node.

        data: {
            lorax_sid: str,
            tree_index: int,
            root_node_id: int
        }

        Returns: {
            nodes: [{node_id, parent_id, x, y, time, is_tip}],  # x=layout, y=time
            edges: [{parent, child}],
            total_nodes: int
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "nodes": [], "edges": []}

            if not session.file_path:
                return {"error": "No file loaded", "nodes": [], "edges": []}

            if is_csv_session_file(session.file_path):
                return {"error": "Subtree not supported for CSV", "nodes": [], "edges": []}

            tree_index = data.get("tree_index")
            root_node_id = data.get("root_node_id")

            if tree_index is None or root_node_id is None:
                return {"error": "Missing tree_index or root_node_id", "nodes": [], "edges": []}

            # Ensure tree is cached
            await get_or_construct_tree_graph(
                session.file_path,
                int(tree_index),
                lorax_sid,
                tree_graph_cache
            )

            result = await get_subtree(
                tree_graph_cache,
                lorax_sid,
                int(tree_index),
                int(root_node_id)
            )
            return result
        except Exception as e:
            print(f"❌ Get subtree error: {e}")
            return {"error": str(e), "nodes": [], "edges": []}

    @sio.event
    async def get_mrca_event(sid, data):
        """Socket event to find the Most Recent Common Ancestor of multiple nodes.

        data: {
            lorax_sid: str,
            tree_index: int,
            node_ids: [int]  # At least 2 nodes
        }

        Returns: {
            mrca: int,              # Node ID of MRCA
            mrca_time: float,
            mrca_position: {x, y},  # x=layout, y=time
            tree_index: int,
            query_nodes: [int]
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "mrca": None}

            if not session.file_path:
                return {"error": "No file loaded", "mrca": None}

            if is_csv_session_file(session.file_path):
                return {"error": "MRCA not supported for CSV", "mrca": None}

            tree_index = data.get("tree_index")
            node_ids = data.get("node_ids", [])

            if tree_index is None:
                return {"error": "Missing tree_index", "mrca": None}

            if len(node_ids) < 2:
                return {"error": "Need at least 2 nodes", "mrca": None}

            # Ensure tree is cached
            await get_or_construct_tree_graph(
                session.file_path,
                int(tree_index),
                lorax_sid,
                tree_graph_cache
            )

            result = await get_mrca(
                tree_graph_cache,
                lorax_sid,
                int(tree_index),
                [int(n) for n in node_ids]
            )
            return result
        except Exception as e:
            print(f"❌ Get MRCA error: {e}")
            return {"error": str(e), "mrca": None}
