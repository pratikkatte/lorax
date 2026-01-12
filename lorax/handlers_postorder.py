# handlers_postorder.py
"""
Post-order tree traversal handler for efficient tree rendering.

This module provides an alternative to the edge-based approach in handlers.py.
For each tree index, it returns a post-order traversal array with parent pointers
and pre-computed x,y coordinates, allowing the frontend to render directly without
recomputing layout.
"""
import asyncio
import numpy as np
import pyarrow as pa

from lorax.handlers import get_or_load_ts


def compute_tree_coordinates(tree, ts):
    """
    Compute x,y coordinates for all nodes in a tree.

    Args:
        tree: tskit Tree object
        ts: tskit TreeSequence

    Returns:
        tuple of (x_coords, y_coords) dicts mapping node_id -> coordinate [0,1]
        - x: time-based, root=0, tips=1
        - y: genealogy-based, normalized post-order position
    """
    postorder = list(tree.nodes(order="postorder"))
    min_time = ts.min_time
    max_time = ts.max_time
    time_range = max_time - min_time if max_time > min_time else 1.0

    x = {}
    y = {}
    tip_counter = 0

    for node_id in postorder:
        # X: time-based [0,1], root=0, tips=1
        t = ts.node(node_id).time
        x[node_id] = (max_time - t) / time_range

        # Y: genealogy-based [0,1]
        if tree.is_leaf(node_id):
            y[node_id] = tip_counter
            tip_counter += 1
        else:
            children = list(tree.children(node_id))
            y[node_id] = sum(y[c] for c in children) / len(children) if children else 0

    # Normalize y to [0, 1]
    max_y = max(tip_counter - 1, 1)
    for node_id in y:
        y[node_id] /= max_y

    return x, y


def sparsify_with_coords(tree, x, y, precision=None, resolution=None):
    """
    Sparsify a tree using pre-computed coordinates.

    Args:
        tree: tskit Tree object
        x: dict mapping node_id -> x coordinate [0,1]
        y: dict mapping node_id -> y coordinate [0,1]
        precision: Optional decimal precision for rounding (e.g., 2 = 0.01 granularity)
        resolution: Optional grid resolution (e.g., 100 = 100x100 grid)

    Returns:
        set of node_ids to keep, or None if no sparsification
    """
    if precision is not None:
        # Precision-based: round coordinates to N decimal places
        buckets = {}
        for node_id in tree.nodes(order="postorder"):
            key = (round(x[node_id], precision), round(y[node_id], precision))
            if key not in buckets:
                buckets[key] = node_id
            elif tree.is_leaf(node_id) and not tree.is_leaf(buckets[key]):
                buckets[key] = node_id
        keep = set(buckets.values())

    elif resolution is not None:
        # Grid-based: floor coordinates to grid cells
        grid = {}
        for node_id in tree.nodes(order="postorder"):
            cx = min(int(x[node_id] * resolution), resolution - 1)
            cy = min(int(y[node_id] * resolution), resolution - 1)
            key = (cx, cy)
            if key not in grid:
                grid[key] = node_id
            elif tree.is_leaf(node_id) and not tree.is_leaf(grid[key]):
                grid[key] = node_id
        keep = set(grid.values())

    else:
        return None

    # Ensure connectivity: trace path to root for each kept node
    for node_id in list(keep):
        current = node_id
        while True:
            parent = tree.parent(current)
            if parent == -1:
                break
            keep.add(parent)
            current = parent

    return keep


async def handle_postorder_query(file_path, tree_indices, sparsity_resolution=None, sparsity_precision=None):
    """
    For each tree index, get post-order traversal with pre-computed x,y coordinates.

    Args:
        file_path: Path to tree sequence file
        tree_indices: List of tree indices to process
        sparsity_resolution: Optional grid resolution for sparsification (e.g., 100 = 100x100 grid).
        sparsity_precision: Optional decimal precision for sparsification (e.g., 2 = round to 0.01).
                           Takes precedence over sparsity_resolution.

    Returns:
        dict with:
        - buffer: PyArrow IPC binary data containing:
            - node_id: int32 (tskit node ID)
            - parent_id: int32 (-1 for roots)
            - time: float64 (coalescent time)
            - is_tip: bool
            - tree_idx: int32 (which tree this node belongs to)
            - x: float32 (time-based coordinate [0,1])
            - y: float32 (genealogy-based coordinate [0,1])
        - global_min_time: float
        - global_max_time: float
        - tree_indices: list[int] (the requested tree indices)
    """
    ts = await get_or_load_ts(file_path)
    if ts is None:
        return {"error": "Tree sequence not loaded. Please load a file first."}

    if len(tree_indices) == 0:
        # Return empty PyArrow buffer with new schema
        empty_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'time': pa.array([], type=pa.float64()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32()),
            'x': pa.array([], type=pa.float32()),
            'y': pa.array([], type=pa.float32())
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
    all_x = []
    all_y = []

    # Process each tree
    def process_trees():
        for tree_idx in tree_indices:
            tree_idx = int(tree_idx)  # Ensure Python int

            if tree_idx < 0 or tree_idx >= ts.num_trees:
                continue  # Skip invalid indices

            tree = ts.at_index(tree_idx)

            # Compute coordinates for ALL nodes first (single computation)
            x_coords, y_coords = compute_tree_coordinates(tree, ts)

            # Apply sparsification using pre-computed coordinates
            if sparsity_precision is not None:
                keep_nodes = sparsify_with_coords(tree, x_coords, y_coords, precision=sparsity_precision)
            elif sparsity_resolution is not None:
                keep_nodes = sparsify_with_coords(tree, x_coords, y_coords, resolution=sparsity_resolution)
            else:
                keep_nodes = None  # Keep all

            # Get post-order traversal
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

                # Include pre-computed coordinates
                all_x.append(float(x_coords[node_id]))
                all_y.append(float(y_coords[node_id]))

    # Run tree processing in thread pool to avoid blocking
    await asyncio.to_thread(process_trees)

    # Handle empty result
    if len(all_node_ids) == 0:
        empty_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'time': pa.array([], type=pa.float64()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32()),
            'x': pa.array([], type=pa.float32()),
            'y': pa.array([], type=pa.float32())
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

    # Build PyArrow table with x,y coordinates
    table = pa.table({
        'node_id': pa.array(all_node_ids, type=pa.int32()),
        'parent_id': pa.array(all_parent_ids, type=pa.int32()),
        'time': pa.array(all_times, type=pa.float64()),
        'is_tip': pa.array(all_is_tip, type=pa.bool_()),
        'tree_idx': pa.array(all_tree_idx, type=pa.int32()),
        'x': pa.array(all_x, type=pa.float32()),
        'y': pa.array(all_y, type=pa.float32())
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
