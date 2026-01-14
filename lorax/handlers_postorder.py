# handlers_postorder.py
"""
Post-order tree traversal handler for efficient tree rendering.

This module provides an alternative to the edge-based approach in handlers.py.
For each tree index, it returns a post-order traversal array with parent pointers
and pre-computed x,y coordinates, allowing the frontend to render directly without
recomputing layout.

Optimized version:
- Uses NumPy vectorized operations instead of Python loops
- Pre-allocates arrays for O(1) amortized appends
- Uses ts.nodes_time for O(1) batch time lookups
- Removes redundant 'time' field (derivable from x coordinate)
- Uses int32 for tree_idx (supports large tree sequences)
- Uses compact bit flags for is_tip
"""
import asyncio
import numpy as np
import pyarrow as pa

from lorax.handlers import get_or_load_ts


def compute_tree_coordinates_vectorized(tree, node_times, min_time, max_time):
    """
    Compute x,y coordinates for all nodes in a tree using vectorized operations.

    Args:
        tree: tskit Tree object
        node_times: numpy array of all node times from ts.nodes_time
        min_time: global minimum time
        max_time: global maximum time

    Returns:
        tuple of (node_ids, parent_ids, x_coords, y_coords, is_tip) numpy arrays
        All arrays are aligned by index.
        - x: time-based, root=0, tips=1
        - y: genealogy-based, normalized post-order position
    """
    # Get postorder as numpy array
    postorder = np.array(list(tree.nodes(order="postorder")), dtype=np.int32)
    n = len(postorder)

    if n == 0:
        return (np.array([], dtype=np.int32),
                np.array([], dtype=np.int32),
                np.array([], dtype=np.float32),
                np.array([], dtype=np.float32),
                np.array([], dtype=np.bool_))

    time_range = max_time - min_time if max_time > min_time else 1.0

    # Pre-allocate arrays
    x = np.empty(n, dtype=np.float32)
    y = np.empty(n, dtype=np.float32)
    parent_ids = np.empty(n, dtype=np.int32)
    is_tip = np.empty(n, dtype=np.bool_)

    # Build node_id -> array index mapping
    node_to_idx = np.empty(postorder.max() + 1, dtype=np.int32)
    node_to_idx.fill(-1)
    node_to_idx[postorder] = np.arange(n)

    # Compute x coordinates (vectorized)
    times = node_times[postorder]
    x[:] = (max_time - times) / time_range

    # First pass: assign tip y values, collect parent info and is_tip flags
    tip_counter = 0

    for i, node_id in enumerate(postorder):
        parent_ids[i] = tree.parent(node_id)

        if tree.is_leaf(node_id):
            y[i] = tip_counter
            tip_counter += 1
            is_tip[i] = True
        else:
            is_tip[i] = False

    # Second pass: compute internal node y as average of children
    # Process in postorder (children before parents guaranteed)
    for i in range(n):
        if not is_tip[i]:
            # Sum children y values (children already processed in postorder)
            node_id = postorder[i]
            children = list(tree.children(node_id))
            if children:
                total_y = sum(y[node_to_idx[c]] for c in children if node_to_idx[c] >= 0)
                y[i] = total_y / len(children)
            else:
                y[i] = 0

    # Normalize y to [0, 1]
    max_y = max(tip_counter - 1, 1)
    y /= max_y

    return postorder, parent_ids, x, y, is_tip


def sparsify_vectorized(node_ids, x, y, is_tip, parent_ids, resolution=None, precision=None):
    """
    Sparsify nodes using vectorized grid-cell approach.

    Args:
        node_ids: numpy array of node IDs
        x, y: numpy arrays of coordinates
        is_tip: numpy array of tip flags
        parent_ids: numpy array of parent IDs
        resolution: grid resolution (e.g., 100 = 100x100 grid)
        precision: decimal precision (e.g., 2 = round to 0.01)

    Returns:
        boolean mask of nodes to keep, or None if no sparsification
    """
    if resolution is None and precision is None:
        return None

    n = len(node_ids)
    if n == 0:
        return None

    # Compute grid cells
    if precision is not None:
        factor = 10 ** precision
        cx = np.floor(x * factor).astype(np.int32)
        cy = np.floor(y * factor).astype(np.int32)
    else:
        cx = np.minimum((x * resolution).astype(np.int32), resolution - 1)
        cy = np.minimum((y * resolution).astype(np.int32), resolution - 1)

    # Create unique cell keys
    # Combine cx and cy into a single key (assumes reasonable resolution)
    max_coord = max(cx.max(), cy.max()) + 1 if n > 0 else 1
    cell_keys = cx.astype(np.int64) * (max_coord + 1) + cy

    # For each unique cell, keep one node (prefer tips over internal)
    keep = np.zeros(n, dtype=np.bool_)
    seen_cells = {}

    # Process in postorder - tips come before their ancestors
    for i in range(n):
        key = cell_keys[i]
        if key not in seen_cells:
            seen_cells[key] = i
            keep[i] = True
        elif is_tip[i] and not is_tip[seen_cells[key]]:
            # Replace internal node with tip
            keep[seen_cells[key]] = False
            keep[i] = True
            seen_cells[key] = i

    # Ensure connectivity: trace path to root for each kept node
    # Build node_id -> index mapping
    max_node_id = node_ids.max() + 1
    node_to_idx = np.full(max_node_id, -1, dtype=np.int32)
    node_to_idx[node_ids] = np.arange(n)

    # Trace ancestors for kept nodes
    for i in range(n):
        if keep[i]:
            parent = parent_ids[i]
            while parent != -1:
                parent_idx = node_to_idx[parent]
                if parent_idx < 0:
                    break
                if keep[parent_idx]:
                    break  # Already kept
                keep[parent_idx] = True
                parent = parent_ids[parent_idx]

    return keep


async def handle_postorder_query(file_path, tree_indices, sparsity_resolution=None, sparsity_precision=None):
    """
    For each tree index, get post-order traversal with pre-computed x,y coordinates.
    
    Args:
        file_path: Path to tree sequence file
        tree_indices: List of tree indices to process
        sparsity_resolution: Optional grid resolution for sparsification
        sparsity_precision: Optional decimal precision for sparsification

    Returns:
        dict with:
        - buffer: PyArrow IPC binary data containing:
            - node_id: int32 (tskit node ID)
            - parent_id: int32 (-1 for roots)
            - is_tip: bool
            - tree_idx: int32 (which tree this node belongs to)
            - x: float32 (time-based coordinate [0,1])
            - y: float32 (genealogy-based coordinate [0,1])
        - global_min_time: float
        - global_max_time: float
        - tree_indices: list[int]
    """
    ts = await get_or_load_ts(file_path)
    if ts is None:
        return {"error": "Tree sequence not loaded. Please load a file first."}

    # Pre-fetch times array once (vectorized access)
    node_times = ts.nodes_time
    min_time = float(ts.min_time)
    max_time = float(ts.max_time)

    if len(tree_indices) == 0:
        empty_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
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
            "global_min_time": min_time,
            "global_max_time": max_time,
            "tree_indices": []
        }

    # Estimate total nodes for pre-allocation
    # Use first tree as estimate, with 2x buffer for safety
    sample_tree = ts.at_index(int(tree_indices[0]) if tree_indices else 0)
    estimated_nodes_per_tree = sample_tree.num_nodes
    total_estimated = estimated_nodes_per_tree * len(tree_indices) * 2

    # Pre-allocate arrays
    all_node_ids = np.empty(total_estimated, dtype=np.int32)
    all_parent_ids = np.empty(total_estimated, dtype=np.int32)
    all_is_tip = np.empty(total_estimated, dtype=np.bool_)
    all_tree_idx = np.empty(total_estimated, dtype=np.int32)
    all_x = np.empty(total_estimated, dtype=np.float32)
    all_y = np.empty(total_estimated, dtype=np.float32)

    offset = 0

    def process_trees():
        nonlocal offset

        for tree_idx in tree_indices:
            tree_idx = int(tree_idx)

            if tree_idx < 0 or tree_idx >= ts.num_trees:
                continue

            tree = ts.at_index(tree_idx)

            # Compute coordinates using vectorized function
            node_ids, parent_ids, x, y, is_tip = compute_tree_coordinates_vectorized(
                tree, node_times, min_time, max_time
            )

            n = len(node_ids)
            if n == 0:
                continue

            # Apply sparsification
            if sparsity_precision is not None or sparsity_resolution is not None:
                keep_mask = sparsify_vectorized(
                    node_ids, x, y, is_tip, parent_ids,
                    resolution=sparsity_resolution,
                    precision=sparsity_precision
                )
                if keep_mask is not None:
                    node_ids = node_ids[keep_mask]
                    parent_ids = parent_ids[keep_mask]
                    x = x[keep_mask]
                    y = y[keep_mask]
                    is_tip = is_tip[keep_mask]
                    n = len(node_ids)

            if n == 0:
                continue

            # Ensure capacity
            while offset + n > len(all_node_ids):
                # Double array sizes
                new_size = len(all_node_ids) * 2
                all_node_ids.resize(new_size, refcheck=False)
                all_parent_ids.resize(new_size, refcheck=False)
                all_is_tip.resize(new_size, refcheck=False)
                all_tree_idx.resize(new_size, refcheck=False)
                all_x.resize(new_size, refcheck=False)
                all_y.resize(new_size, refcheck=False)

            # Copy data using numpy slicing (vectorized)
            all_node_ids[offset:offset+n] = node_ids
            all_parent_ids[offset:offset+n] = parent_ids
            all_is_tip[offset:offset+n] = is_tip
            all_tree_idx[offset:offset+n] = tree_idx
            all_x[offset:offset+n] = x
            all_y[offset:offset+n] = y

            offset += n

    # Run in thread pool to avoid blocking
    await asyncio.to_thread(process_trees)

    # Trim to actual size
    all_node_ids = all_node_ids[:offset]
    all_parent_ids = all_parent_ids[:offset]
    all_is_tip = all_is_tip[:offset]
    all_tree_idx = all_tree_idx[:offset]
    all_x = all_x[:offset]
    all_y = all_y[:offset]

    if offset == 0:
        empty_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
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
            "global_min_time": min_time,
            "global_max_time": max_time,
            "tree_indices": [int(i) for i in tree_indices]
        }

    # Build PyArrow table directly from numpy arrays (zero-copy where possible)
    table = pa.table({
        'node_id': pa.array(all_node_ids, type=pa.int32()),
        'parent_id': pa.array(all_parent_ids, type=pa.int32()),
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
        "global_min_time": min_time,
        "global_max_time": max_time,
        "tree_indices": [int(i) for i in tree_indices]
    }
