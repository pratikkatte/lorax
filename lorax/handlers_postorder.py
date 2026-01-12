# handlers_postorder.py
"""
Post-order tree traversal handler for efficient tree rendering.

This module provides an alternative to the edge-based approach in handlers.py.
For each tree index, it returns a post-order traversal array with parent pointers,
allowing the frontend to reconstruct trees using a simple stack-based algorithm.
"""
import asyncio
import numpy as np
import pyarrow as pa

from lorax.handlers import get_or_load_ts


def sparsify_tree(tree, ts, resolution):
    """
    Sparsify a tree based on x,y coordinate proximity using grid-based filtering.

    Args:
        tree: tskit Tree object
        ts: tskit TreeSequence
        resolution: Grid resolution (e.g., 100 = 100x100 cells)

    Returns:
        set of node_ids to keep
    """
    postorder = list(tree.nodes(order="postorder"))
    min_time = ts.min_time
    max_time = ts.max_time
    time_range = max_time - min_time if max_time > min_time else 1.0

    # Compute x (time-based) for all nodes
    x = {}
    for node_id in postorder:
        t = ts.node(node_id).time
        x[node_id] = (max_time - t) / time_range

    # Compute y (post-order based) - same algorithm as frontend
    y = {}
    tip_counter = 0
    for node_id in postorder:
        if tree.is_leaf(node_id):
            y[node_id] = tip_counter
            tip_counter += 1
        else:
            children = list(tree.children(node_id))
            if children:
                y[node_id] = sum(y[c] for c in children) / len(children)
            else:
                y[node_id] = 0

    # Normalize y to [0, 1]
    max_y = max(tip_counter - 1, 1)
    for node_id in y:
        y[node_id] /= max_y

    # Grid-based selection: keep one representative per cell
    grid = {}  # (cell_x, cell_y) -> best_node_id
    for node_id in postorder:
        cell_x = min(int(x[node_id] * resolution), resolution - 1)
        cell_y = min(int(y[node_id] * resolution), resolution - 1)
        cell = (cell_x, cell_y)

        if cell not in grid:
            grid[cell] = node_id
        else:
            # Prefer tips over internal nodes for better visual representation
            existing = grid[cell]
            if tree.is_leaf(node_id) and not tree.is_leaf(existing):
                grid[cell] = node_id

    keep = set(grid.values())

    # Ensure connectivity: for each kept node, trace path to root
    for node_id in list(keep):
        current = node_id
        while True:
            parent = tree.parent(current)
            if parent == -1:
                break
            keep.add(parent)
            current = parent

    return keep


async def handle_postorder_query(file_path, tree_indices, sparsity_resolution=None):
    """
    For each tree index, get post-order traversal using tskit's native tree.nodes(order="postorder").

    Args:
        file_path: Path to tree sequence file
        tree_indices: List of tree indices to process
        sparsity_resolution: Optional grid resolution for sparsification (e.g., 100 = 100x100 grid).
                            If None, no sparsification is applied.

    Returns:
        dict with:
        - buffer: PyArrow IPC binary data containing:
            - node_id: int32 (tskit node ID)
            - parent_id: int32 (-1 for roots)
            - time: float64 (coalescent time)
            - is_tip: bool
            - tree_idx: int32 (which tree this node belongs to)
        - global_min_time: float
        - global_max_time: float
        - tree_indices: list[int] (the requested tree indices)
    """
    ts = await get_or_load_ts(file_path)
    if ts is None:
        return {"error": "Tree sequence not loaded. Please load a file first."}

    if len(tree_indices) == 0:
        # Return empty PyArrow buffer
        empty_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'time': pa.array([], type=pa.float64()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32())
        })
        sink = pa.BufferOutputStream()
        writer = pa.ipc.new_stream(sink, empty_table.schema)
        writer.write_table(empty_table)
        writer.close()
        return {
            "buffer": sink.getvalue().to_pybytes(),
            "global_min_time": float(ts.min_time),
            "global_max_time": float(ts.max_time),
            "tree_indices": []
        }

    # Collect all nodes from all requested trees
    all_node_ids = []
    all_parent_ids = []
    all_times = []
    all_is_tip = []
    all_tree_idx = []

    # Process each tree
    def process_trees():
        for tree_idx in tree_indices:
            tree_idx = int(tree_idx)  # Ensure Python int

            if tree_idx < 0 or tree_idx >= ts.num_trees:
                continue  # Skip invalid indices

            tree = ts.at_index(tree_idx)

            # Get nodes to keep (all nodes if no sparsification)
            if sparsity_resolution is not None:
                keep_nodes = sparsify_tree(tree, ts, sparsity_resolution)
            else:
                keep_nodes = None  # Keep all

            # Get post-order traversal - this is the key tskit call
            postorder_nodes = list(tree.nodes(order="postorder"))

            for node_id in postorder_nodes:
                # Skip nodes not in keep set (if sparsification is enabled)
                if keep_nodes is not None and node_id not in keep_nodes:
                    continue

                all_node_ids.append(node_id)

                # Get parent (-1 for roots)
                parent = tree.parent(node_id)
                all_parent_ids.append(parent if parent != -1 else -1)

                # Get time from the node table
                all_times.append(float(ts.node(node_id).time))

                # Check if tip (leaf)
                all_is_tip.append(tree.is_leaf(node_id))

                # Store which tree this node belongs to
                all_tree_idx.append(tree_idx)

    # Run tree processing in thread pool to avoid blocking
    await asyncio.to_thread(process_trees)

    # Handle empty result
    if len(all_node_ids) == 0:
        empty_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'time': pa.array([], type=pa.float64()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32())
        })
        sink = pa.BufferOutputStream()
        writer = pa.ipc.new_stream(sink, empty_table.schema)
        writer.write_table(empty_table)
        writer.close()
        return {
            "buffer": sink.getvalue().to_pybytes(),
            "global_min_time": float(ts.min_time),
            "global_max_time": float(ts.max_time),
            "tree_indices": [int(i) for i in tree_indices]
        }

    # Build PyArrow table
    table = pa.table({
        'node_id': pa.array(all_node_ids, type=pa.int32()),
        'parent_id': pa.array(all_parent_ids, type=pa.int32()),
        'time': pa.array(all_times, type=pa.float64()),
        'is_tip': pa.array(all_is_tip, type=pa.bool_()),
        'tree_idx': pa.array(all_tree_idx, type=pa.int32())
    })

    # Serialize to IPC format
    sink = pa.BufferOutputStream()
    writer = pa.ipc.new_stream(sink, table.schema)
    writer.write_table(table)
    writer.close()

    return {
        "buffer": sink.getvalue().to_pybytes(),
        "global_min_time": float(ts.min_time),
        "global_max_time": float(ts.max_time),
        "tree_indices": [int(i) for i in tree_indices]
    }
