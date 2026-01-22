"""
tree_graph.py - Numba-optimized tree construction from tskit tables.

This module provides:
- TreeGraph: Numpy-based tree representation with CSR children and x,y coordinates
- construct_tree: Build a single tree from tables (Numba-optimized)
- construct_trees_batch: Build multiple trees efficiently
"""

import numpy as np
import pyarrow as pa
from numba import njit
from dataclasses import dataclass
from typing import List, Optional, Tuple


@njit(cache=True)
def _compute_x_postorder(children_indptr, children_data, roots, num_nodes):
    """
    Numba-compiled post-order traversal for computing x (layout) coordinates.

    Tips get sequential x values (0, 1, 2, ...), internal nodes get average of children.

    Args: 
        children_indptr: CSR indptr array
        children_data: CSR data array (flattened children)
        roots: Array of root node IDs
        num_nodes: Total number of nodes

    Returns:
        (x, tip_counter): x coordinates array and number of tips
    """
    x = np.full(num_nodes, -1.0, dtype=np.float32)
    tip_counter = 0

    # Pre-allocated stack arrays (avoid Python list)
    stack_nodes = np.empty(num_nodes, dtype=np.int32)
    stack_visited = np.empty(num_nodes, dtype=np.uint8)  # 0=False, 1=True

    for i in range(len(roots)):
        root = roots[i]
        stack_ptr = 0

        stack_nodes[stack_ptr] = root
        stack_visited[stack_ptr] = 0
        stack_ptr += 1

        while stack_ptr > 0:
            stack_ptr -= 1
            node = stack_nodes[stack_ptr]
            visited = stack_visited[stack_ptr]

            start = children_indptr[node]
            end = children_indptr[node + 1]
            num_children = end - start

            if visited == 0 and num_children > 0:
                # Push node back as visited
                stack_nodes[stack_ptr] = node
                stack_visited[stack_ptr] = 1
                stack_ptr += 1

                # Push children
                for j in range(start, end):
                    stack_nodes[stack_ptr] = children_data[j]
                    stack_visited[stack_ptr] = 0
                    stack_ptr += 1
            else:
                # Post-order processing
                if num_children == 0:
                    x[node] = tip_counter
                    tip_counter += 1
                else:
                    # Inline mean calculation (avoid np.mean overhead)
                    total = 0.0
                    for j in range(start, end):
                        total += x[children_data[j]]
                    x[node] = total / num_children

    return x, tip_counter


@dataclass
class TreeGraph:
    """
    Graph representation using numpy arrays with CSR format for children.

    Attributes:
        parent: int32 array where parent[node_id] = parent_id (-1 for root)
        time: float32 array of raw node times
        children_indptr: int32 CSR row pointers (length = num_nodes + 1)
        children_data: int32 flattened children array
        x: float32 layout position [0,1] (tips spread, internal=avg of children)
        y: float32 normalized time [0,1] (min_time=0, max_time=1)
        in_tree: bool array indicating which nodes are in this tree
    """
    parent: np.ndarray
    time: np.ndarray
    children_indptr: np.ndarray
    children_data: np.ndarray
    x: np.ndarray
    y: np.ndarray
    in_tree: np.ndarray

    def children(self, node_id: int) -> np.ndarray:
        """Get children of a node as numpy array slice (zero-copy)."""
        return self.children_data[self.children_indptr[node_id]:self.children_indptr[node_id + 1]]

    def is_tip(self, node_id: int) -> bool:
        """Check if a node is a tip (no children)."""
        return self.children_indptr[node_id + 1] == self.children_indptr[node_id]

    def to_pyarrow(self, tree_idx: int = 0) -> bytes:
        """
        Serialize TreeGraph to PyArrow IPC format for frontend rendering.

        Note: Coordinates are swapped to match backend convention:
        - Backend x = self.y (time)
        - Backend y = self.x (layout)

        Args:
            tree_idx: Tree index to include in output (for multi-tree rendering)

        Returns:
            bytes: PyArrow IPC binary data ready to send to frontend
        """
        # Get nodes that are in this tree
        indices = np.where(self.in_tree)[0].astype(np.int32)
        n = len(indices)

        if n == 0:
            # Return empty table
            table = pa.table({
                'node_id': pa.array([], type=pa.int32()),
                'parent_id': pa.array([], type=pa.int32()),
                'is_tip': pa.array([], type=pa.bool_()),
                'tree_idx': pa.array([], type=pa.int32()),
                'x': pa.array([], type=pa.float32()),
                'y': pa.array([], type=pa.float32()),
            })
        else:
            # Derive is_tip from CSR: nodes with no children
            child_counts = np.diff(self.children_indptr)
            is_tip = child_counts[indices] == 0

            # Build PyArrow table (swap x<->y for backend convention)
            table = pa.table({
                'node_id': pa.array(indices, type=pa.int32()),
                'parent_id': pa.array(self.parent[indices], type=pa.int32()),
                'is_tip': pa.array(is_tip, type=pa.bool_()),
                'tree_idx': pa.array(np.full(n, tree_idx, dtype=np.int32), type=pa.int32()),
                'x': pa.array(self.y[indices], type=pa.float32()),  # SWAP: time -> x
                'y': pa.array(self.x[indices], type=pa.float32()),  # SWAP: layout -> y
            })

        # Serialize to IPC format
        sink = pa.BufferOutputStream()
        writer = pa.ipc.new_stream(sink, table.schema)
        writer.write_table(table)
        writer.close()

        return sink.getvalue().to_pybytes()


def construct_tree(
    ts,
    edges,
    nodes,
    breakpoints,
    index: int,
    min_time: Optional[float] = None,
    max_time: Optional[float] = None
) -> TreeGraph:
    """
    Construct tree with x,y coordinates using Numba-optimized post-order traversal.

    Args:
        ts: tskit TreeSequence object
        edges: ts.tables.edges (pre-extracted for reuse)
        nodes: ts.tables.nodes (pre-extracted for reuse)
        breakpoints: list/array of breakpoints (pre-extracted for reuse)
        index: Tree index
        min_time: Optional global min time (default: ts.min_time)
        max_time: Optional global max time (default: ts.max_time)

    Returns:
        TreeGraph with CSR children and x,y coordinates in [0,1].
    """
    if index < 0 or index >= ts.num_trees:
        raise ValueError(f"Tree index {index} out of range [0, {ts.num_trees - 1}]")

    interval_left = breakpoints[index]
    num_nodes = len(nodes.time)
    node_times = nodes.time

    # Use provided min/max or compute from ts
    if min_time is None:
        min_time = ts.min_time
    if max_time is None:
        max_time = ts.max_time

    # === Edge filtering & parent array ===
    active_mask = (edges.left <= interval_left) & (edges.right > interval_left)
    active_parents = edges.parent[active_mask]
    active_children = edges.child[active_mask]

    parent = np.full(num_nodes, -1, dtype=np.int32)
    parent[active_children] = active_parents

    # === CSR children structure ===
    child_counts = np.bincount(active_parents, minlength=num_nodes).astype(np.int32)
    children_indptr = np.zeros(num_nodes + 1, dtype=np.int32)
    children_indptr[1:] = np.cumsum(child_counts)
    sort_idx = np.argsort(active_parents, kind='stable')
    children_data = active_children[sort_idx].astype(np.int32)

    # === Track which nodes are in this tree ===
    in_tree = np.zeros(num_nodes, dtype=np.bool_)
    in_tree[active_children] = True
    in_tree[active_parents] = True

    # === Y coordinate: normalized time (vectorized) ===
    # Inverted: max_time → 0, min_time → 1 (root at left, tips at right)
    time_range = max_time - min_time if max_time > min_time else 1.0
    y = ((max_time - node_times) / time_range).astype(np.float32)

    # === X coordinate: Numba-optimized post-order traversal ===
    roots = np.where(in_tree & (parent == -1))[0].astype(np.int32)
    x, tip_counter = _compute_x_postorder(children_indptr, children_data, roots, num_nodes)

    # Normalize x to [0, 1]
    if tip_counter > 1:
        x[in_tree] /= (tip_counter - 1)

    return TreeGraph(
        parent=parent,
        time=node_times.astype(np.float32),
        children_indptr=children_indptr,
        children_data=children_data,
        x=x,
        y=y,
        in_tree=in_tree
    )


def construct_trees_batch(
    ts,
    tree_indices: List[int],
    sparsity_resolution: Optional[int] = None,
    sparsity_precision: Optional[int] = None
) -> Tuple[bytes, float, float, List[int]]:
    """
    Construct multiple trees and return combined PyArrow buffer.

    This is the main entry point for the backend handler.

    Args:
        ts: tskit TreeSequence object
        tree_indices: List of tree indices to process
        sparsity_resolution: Optional grid resolution for sparsification
        sparsity_precision: Optional decimal precision for sparsification

    Returns:
        Tuple of (buffer, global_min_time, global_max_time, tree_indices)
    """
    # Pre-extract tables for reuse
    edges = ts.tables.edges
    nodes = ts.tables.nodes
    breakpoints = list(ts.breakpoints())

    min_time = float(ts.min_time)
    max_time = float(ts.max_time)

    if len(tree_indices) == 0:
        # Return empty buffer
        table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32()),
            'x': pa.array([], type=pa.float32()),
            'y': pa.array([], type=pa.float32())
        })
        sink = pa.BufferOutputStream()
        writer = pa.ipc.new_stream(sink, table.schema)
        writer.write_table(table)
        writer.close()
        return sink.getvalue().to_pybytes(), min_time, max_time, []

    # Estimate total nodes for pre-allocation
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

    for tree_idx in tree_indices:
        tree_idx = int(tree_idx)

        if tree_idx < 0 or tree_idx >= ts.num_trees:
            continue

        # Construct tree using optimized function
        graph = construct_tree(ts, edges, nodes, breakpoints, tree_idx, min_time, max_time)

        # Get nodes in tree
        indices = np.where(graph.in_tree)[0].astype(np.int32)
        n = len(indices)

        if n == 0:
            continue

        # Derive is_tip
        child_counts = np.diff(graph.children_indptr)
        is_tip = child_counts[indices] == 0

        # Get coordinates (swap for backend convention)
        node_ids = indices
        parent_ids = graph.parent[indices]
        x = graph.y[indices]  # SWAP: time -> x
        y = graph.x[indices]  # SWAP: layout -> y

        # Apply sparsification if requested
        if sparsity_precision is not None or sparsity_resolution is not None:
            keep_mask = _sparsify_vectorized(
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
            new_size = len(all_node_ids) * 2
            all_node_ids.resize(new_size, refcheck=False)
            all_parent_ids.resize(new_size, refcheck=False)
            all_is_tip.resize(new_size, refcheck=False)
            all_tree_idx.resize(new_size, refcheck=False)
            all_x.resize(new_size, refcheck=False)
            all_y.resize(new_size, refcheck=False)

        # Copy data
        all_node_ids[offset:offset+n] = node_ids
        all_parent_ids[offset:offset+n] = parent_ids
        all_is_tip[offset:offset+n] = is_tip
        all_tree_idx[offset:offset+n] = tree_idx
        all_x[offset:offset+n] = x
        all_y[offset:offset+n] = y

        offset += n

    # Trim to actual size
    all_node_ids = all_node_ids[:offset]
    all_parent_ids = all_parent_ids[:offset]
    all_is_tip = all_is_tip[:offset]
    all_tree_idx = all_tree_idx[:offset]
    all_x = all_x[:offset]
    all_y = all_y[:offset]

    if offset == 0:
        table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32()),
            'x': pa.array([], type=pa.float32()),
            'y': pa.array([], type=pa.float32())
        })
    else:
        table = pa.table({
            'node_id': pa.array(all_node_ids, type=pa.int32()),
            'parent_id': pa.array(all_parent_ids, type=pa.int32()),
            'is_tip': pa.array(all_is_tip, type=pa.bool_()),
            'tree_idx': pa.array(all_tree_idx, type=pa.int32()),
            'x': pa.array(all_x, type=pa.float32()),
            'y': pa.array(all_y, type=pa.float32())
        })

    # Serialize to IPC
    sink = pa.BufferOutputStream()
    writer = pa.ipc.new_stream(sink, table.schema)
    writer.write_table(table)
    writer.close()

    return sink.getvalue().to_pybytes(), min_time, max_time, [int(i) for i in tree_indices]


def _sparsify_vectorized(node_ids, x, y, is_tip, parent_ids, resolution=None, precision=None):
    """
    Sparsify nodes using vectorized grid-cell approach.

    Keeps one node per grid cell, preferring tips over internal nodes.
    Ensures connectivity by tracing paths to root.
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
    max_coord = max(cx.max(), cy.max()) + 1 if n > 0 else 1
    cell_keys = cx.astype(np.int64) * (max_coord + 1) + cy

    # For each unique cell, keep one node (prefer tips over internal)
    keep = np.zeros(n, dtype=np.bool_)
    seen_cells = {}

    for i in range(n):
        key = cell_keys[i]
        if key not in seen_cells:
            seen_cells[key] = i
            keep[i] = True
        elif is_tip[i] and not is_tip[seen_cells[key]]:
            keep[seen_cells[key]] = False
            keep[i] = True
            seen_cells[key] = i

    # Ensure connectivity: trace path to root for each kept node
    max_node_id = node_ids.max() + 1
    node_to_idx = np.full(max_node_id, -1, dtype=np.int32)
    node_to_idx[node_ids] = np.arange(n)

    for i in range(n):
        if keep[i]:
            parent = parent_ids[i]
            while parent != -1:
                parent_idx = node_to_idx[parent]
                if parent_idx < 0:
                    break
                if keep[parent_idx]:
                    break
                keep[parent_idx] = True
                parent = parent_ids[parent_idx]

    return keep
