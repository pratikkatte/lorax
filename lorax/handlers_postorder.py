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


async def handle_postorder_query(file_path, tree_indices):
    """
    For each tree index, get post-order traversal using tskit's native tree.nodes(order="postorder").

    Args:
        file_path: Path to tree sequence file
        tree_indices: List of tree indices to process

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

            # Get post-order traversal - this is the key tskit call
            postorder_nodes = list(tree.nodes(order="postorder"))

            for node_id in postorder_nodes:
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
