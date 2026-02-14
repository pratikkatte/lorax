"""
Lineage Operations for TreeGraph-based ancestry and descendant tracing.

Provides efficient operations using cached TreeGraph objects:
- Ancestor tracing: Path from node to root
- Descendant finding: All nodes below a given node
- Node search: Filter nodes by metadata/attributes
"""

import numpy as np
from typing import List, Dict, Optional, Any, TYPE_CHECKING
from collections import deque

if TYPE_CHECKING:
    from lorax.tree_graph import TreeGraph
    from lorax.tree_graph_cache import TreeGraphCache


async def get_ancestors(
    tree_graph_cache: "TreeGraphCache",
    session_id: str,
    tree_index: int,
    node_id: int
) -> Dict[str, Any]:
    """
    Get all ancestors of a node (path from node to root).

    Uses the parent array from the cached TreeGraph to trace the ancestry path.

    Args:
        tree_graph_cache: The TreeGraph cache instance
        session_id: Session identifier
        tree_index: Tree index to query
        node_id: Node ID to trace ancestors for

    Returns:
        Dict with:
        - ancestors: List of node IDs from node to root (excluding the query node)
        - path: List of {node_id, time, x, y} for visualization (x=layout, y=time)
        - error: Error message if tree not cached
    """
    tg = await tree_graph_cache.get(session_id, tree_index)
    if tg is None:
        return {
            "error": f"Tree {tree_index} not cached. Request tree layout first.",
            "ancestors": [],
            "path": []
        }

    # Validate node_id
    if node_id < 0 or node_id >= len(tg.parent):
        return {
            "error": f"Invalid node_id {node_id}",
            "ancestors": [],
            "path": []
        }

    # Check if node is in this tree
    if not tg.in_tree[node_id]:
        return {
            "error": f"Node {node_id} is not in tree {tree_index}",
            "ancestors": [],
            "path": []
        }

    ancestors = []
    path = []

    # Include starting node in path
    path.append({
        "node_id": int(node_id),
        "time": float(tg.time[node_id]),
        "x": float(tg.x[node_id]),
        "y": float(tg.y[node_id])
    })

    current = node_id
    while True:
        parent = tg.parent[current]
        if parent == -1:
            # Reached root
            break
        ancestors.append(int(parent))
        path.append({
            "node_id": int(parent),
            "time": float(tg.time[parent]),
            "x": float(tg.x[parent]),
            "y": float(tg.y[parent])
        })
        current = parent

    return {
        "ancestors": ancestors,
        "path": path,
        "tree_index": tree_index,
        "query_node": node_id
    }


async def get_descendants(
    tree_graph_cache: "TreeGraphCache",
    session_id: str,
    tree_index: int,
    node_id: int,
    include_tips_only: bool = False
) -> Dict[str, Any]:
    """
    Get all descendants of a node (BFS traversal down the tree).

    Uses the CSR children structure from the cached TreeGraph.

    Args:
        tree_graph_cache: The TreeGraph cache instance
        session_id: Session identifier
        tree_index: Tree index to query
        node_id: Node ID to find descendants for
        include_tips_only: If True, only return tip (leaf) nodes

    Returns:
        Dict with:
        - descendants: List of node IDs that are descendants
        - tips: List of tip node IDs (always included for convenience)
        - error: Error message if tree not cached
    """
    tg = await tree_graph_cache.get(session_id, tree_index)
    if tg is None:
        return {
            "error": f"Tree {tree_index} not cached. Request tree layout first.",
            "descendants": [],
            "tips": []
        }

    # Validate node_id
    if node_id < 0 or node_id >= len(tg.parent):
        return {
            "error": f"Invalid node_id {node_id}",
            "descendants": [],
            "tips": []
        }

    # Check if node is in this tree
    if not tg.in_tree[node_id]:
        return {
            "error": f"Node {node_id} is not in tree {tree_index}",
            "descendants": [],
            "tips": []
        }

    descendants = []
    tips = []

    # BFS traversal using deque for efficiency
    queue = deque(tg.children(node_id).tolist())

    while queue:
        child = queue.popleft()
        descendants.append(int(child))

        # Check if tip (no children)
        if tg.is_tip(child):
            tips.append(int(child))
        else:
            # Add children to queue
            queue.extend(tg.children(child).tolist())

    result = {
        "tips": tips,
        "tree_index": tree_index,
        "query_node": node_id,
        "total_descendants": len(descendants)
    }

    if include_tips_only:
        result["descendants"] = tips
    else:
        result["descendants"] = descendants

    return result


async def search_nodes_by_criteria(
    tree_graph_cache: "TreeGraphCache",
    session_id: str,
    tree_index: int,
    criteria: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Search for nodes matching specified criteria.

    Supported criteria:
    - min_time: Minimum node time
    - max_time: Maximum node time
    - is_tip: True for tips only, False for internal nodes only
    - has_children: True for nodes with children, False for tips
    - node_ids: List of specific node IDs to filter to

    Args:
        tree_graph_cache: The TreeGraph cache instance
        session_id: Session identifier
        tree_index: Tree index to search
        criteria: Dict of filter criteria

    Returns:
        Dict with:
        - matches: List of matching node IDs
        - positions: List of {node_id, x, y, time} for each match (x=layout, y=time)
        - error: Error message if tree not cached
    """
    tg = await tree_graph_cache.get(session_id, tree_index)
    if tg is None:
        return {
            "error": f"Tree {tree_index} not cached. Request tree layout first.",
            "matches": [],
            "positions": []
        }

    matches = []
    positions = []

    # Get all nodes in this tree
    in_tree_indices = np.where(tg.in_tree)[0]

    # Optional: filter to specific node IDs first
    node_id_filter = criteria.get("node_ids")
    if node_id_filter is not None:
        node_id_set = set(node_id_filter)
        in_tree_indices = [n for n in in_tree_indices if n in node_id_set]

    for node_id in in_tree_indices:
        if _matches_criteria(tg, node_id, criteria):
            matches.append(int(node_id))
            positions.append({
                "node_id": int(node_id),
                "x": float(tg.x[node_id]),
                "y": float(tg.y[node_id]),
                "time": float(tg.time[node_id])
            })

    return {
        "matches": matches,
        "positions": positions,
        "tree_index": tree_index,
        "criteria": criteria,
        "total_matches": len(matches)
    }


def _matches_criteria(tg: "TreeGraph", node_id: int, criteria: Dict[str, Any]) -> bool:
    """
    Check if a node matches all specified criteria.

    Args:
        tg: TreeGraph object
        node_id: Node ID to check
        criteria: Dict of filter criteria

    Returns:
        True if node matches all criteria
    """
    # Time range filters
    if "min_time" in criteria:
        if tg.time[node_id] < criteria["min_time"]:
            return False

    if "max_time" in criteria:
        if tg.time[node_id] > criteria["max_time"]:
            return False

    # Tip/internal filter
    if "is_tip" in criteria:
        is_tip = tg.is_tip(node_id)
        if criteria["is_tip"] != is_tip:
            return False

    # Has children filter (inverse of is_tip)
    if "has_children" in criteria:
        has_children = not tg.is_tip(node_id)
        if criteria["has_children"] != has_children:
            return False

    # Y (time) position range
    if "min_y" in criteria:
        if tg.y[node_id] < criteria["min_y"]:
            return False

    if "max_y" in criteria:
        if tg.y[node_id] > criteria["max_y"]:
            return False

    return True


async def get_subtree(
    tree_graph_cache: "TreeGraphCache",
    session_id: str,
    tree_index: int,
    root_node_id: int
) -> Dict[str, Any]:
    """
    Get the complete subtree rooted at a given node.

    Returns all nodes in the subtree with their structure preserved.

    Args:
        tree_graph_cache: The TreeGraph cache instance
        session_id: Session identifier
        tree_index: Tree index to query
        root_node_id: Root of the subtree

    Returns:
        Dict with:
        - nodes: List of {node_id, parent_id, x, y, time, is_tip} (x=layout, y=time)
        - edges: List of {parent, child} pairs
        - error: Error message if tree not cached
    """
    tg = await tree_graph_cache.get(session_id, tree_index)
    if tg is None:
        return {
            "error": f"Tree {tree_index} not cached. Request tree layout first.",
            "nodes": [],
            "edges": []
        }

    # Validate node_id
    if root_node_id < 0 or root_node_id >= len(tg.parent):
        return {
            "error": f"Invalid node_id {root_node_id}",
            "nodes": [],
            "edges": []
        }

    if not tg.in_tree[root_node_id]:
        return {
            "error": f"Node {root_node_id} is not in tree {tree_index}",
            "nodes": [],
            "edges": []
        }

    nodes = []
    edges = []

    # BFS to collect all nodes and edges
    queue = deque([root_node_id])
    visited = set()

    while queue:
        node_id = queue.popleft()
        if node_id in visited:
            continue
        visited.add(node_id)

        nodes.append({
            "node_id": int(node_id),
            "parent_id": int(tg.parent[node_id]),
            "x": float(tg.x[node_id]),
            "y": float(tg.y[node_id]),
            "time": float(tg.time[node_id]),
            "is_tip": tg.is_tip(node_id)
        })

        children = tg.children(node_id)
        for child in children:
            edges.append({
                "parent": int(node_id),
                "child": int(child)
            })
            queue.append(child)

    return {
        "nodes": nodes,
        "edges": edges,
        "tree_index": tree_index,
        "root_node": root_node_id,
        "total_nodes": len(nodes)
    }


async def get_mrca(
    tree_graph_cache: "TreeGraphCache",
    session_id: str,
    tree_index: int,
    node_ids: List[int]
) -> Dict[str, Any]:
    """
    Find the Most Recent Common Ancestor (MRCA) of a set of nodes.

    Uses ancestor tracing and intersection to find the MRCA.

    Args:
        tree_graph_cache: The TreeGraph cache instance
        session_id: Session identifier
        tree_index: Tree index to query
        node_ids: List of node IDs to find MRCA for

    Returns:
        Dict with:
        - mrca: Node ID of the MRCA, or None if not found
        - mrca_time: Time of the MRCA node
        - mrca_position: {x, y} of the MRCA (x=layout, y=time)
        - error: Error message if tree not cached
    """
    if not node_ids or len(node_ids) < 2:
        return {
            "error": "Need at least 2 nodes to find MRCA",
            "mrca": None
        }

    tg = await tree_graph_cache.get(session_id, tree_index)
    if tg is None:
        return {
            "error": f"Tree {tree_index} not cached. Request tree layout first.",
            "mrca": None
        }

    # Validate all nodes
    for node_id in node_ids:
        if node_id < 0 or node_id >= len(tg.parent):
            return {"error": f"Invalid node_id {node_id}", "mrca": None}
        if not tg.in_tree[node_id]:
            return {"error": f"Node {node_id} not in tree {tree_index}", "mrca": None}

    # Get ancestor sets for each node
    ancestor_sets = []
    for node_id in node_ids:
        ancestors = set()
        current = node_id
        while current != -1:
            ancestors.add(current)
            current = tg.parent[current]
        ancestor_sets.append(ancestors)

    # Find intersection (common ancestors)
    common_ancestors = ancestor_sets[0]
    for ancestor_set in ancestor_sets[1:]:
        common_ancestors = common_ancestors.intersection(ancestor_set)

    if not common_ancestors:
        return {
            "error": "No common ancestor found",
            "mrca": None,
            "tree_index": tree_index
        }

    # MRCA is the common ancestor with the highest time (most recent)
    mrca = max(common_ancestors, key=lambda n: tg.time[n])

    return {
        "mrca": int(mrca),
        "mrca_time": float(tg.time[mrca]),
        "mrca_position": {
            "x": float(tg.x[mrca]),
            "y": float(tg.y[mrca])
        },
        "tree_index": tree_index,
        "query_nodes": node_ids
    }
