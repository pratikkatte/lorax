"""
tree_graph.py - Numba-optimized tree construction from tskit tables.

This module provides:
- TreeGraph: Numpy-based tree representation with CSR children and x,y coordinates
- construct_tree: Build a single tree from tables (Numba-optimized)
- construct_trees_batch: Build multiple trees efficiently (includes mutation extraction)
"""

import struct
import numpy as np
import pyarrow as pa
from numba import njit
from numba.typed import Dict
from numba import types
from dataclasses import dataclass
from typing import List, Optional, Tuple

# Default cell size for sparsification (0.2% of normalized [0,1] space)
DEFAULT_SPARSIFY_CELL_SIZE = 0.00002


@njit(cache=True)
def _compute_x_postorder(children_indptr, children_data, roots, num_nodes):
    """
    Numba-compiled post-order traversal for computing x (layout) coordinates.

    Tips get sequential x values (0, 1, 2, ...), internal nodes get (min + max) / 2 of children.

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
                    # Compute (min + max) / 2 of children (matches jstree.js)
                    min_x = x[children_data[start]]
                    max_x = x[children_data[start]]
                    for j in range(start + 1, end):
                        child_x = x[children_data[j]]
                        if child_x < min_x:
                            min_x = child_x
                        if child_x > max_x:
                            max_x = child_x
                    x[node] = (min_x + max_x) / 2.0

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
        x: float32 layout position [0,1] (tips spread, internal=(min+max)/2 of children)
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

    def get_node_x(self, node_id: int) -> float:
        """Get the x (layout) coordinate for a node."""
        return self.x[node_id] if node_id >= 0 and node_id < len(self.x) else 0.5

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
    sparsification: bool = False,
    sparsify_mutations: bool = True,
    include_mutations: bool = True,
    pre_cached_graphs: Optional[dict] = None
) -> Tuple[bytes, float, float, List[int], dict]:
    """
    Construct multiple trees and return combined PyArrow buffer.

    This is the main entry point for the backend handler.

    Args:
        ts: tskit TreeSequence object
        tree_indices: List of tree indices to process
        sparsification: Enable sparsification (default False). Uses edge-midpoint grid deduplication.
        sparsify_mutations: When True, grid-deduplicate mutations by (x,y) per tree. Default follows sparsification.
        include_mutations: Whether to include mutation data in buffer
        pre_cached_graphs: Optional dict mapping tree_idx -> TreeGraph for cache hits

    Returns:
        Tuple of (buffer, global_min_time, global_max_time, tree_indices, newly_built_graphs)
        where newly_built_graphs is a dict mapping tree_idx -> TreeGraph for trees constructed
    """
    # Pre-extract tables for reuse
    edges = ts.tables.edges
    nodes = ts.tables.nodes
    breakpoints = list(ts.breakpoints())

    min_time = float(ts.min_time)
    max_time = float(ts.max_time)

    # Check if tree sequence has mutations
    has_mutations = include_mutations and ts.num_mutations > 0

    # Pre-extract mutation tables and positions (avoid repeated lookups in loop)
    if has_mutations:
        sites = ts.tables.sites
        mutations = ts.tables.mutations
        mutation_positions = sites.position[mutations.site]
    else:
        sites = None
        mutations = None
        mutation_positions = None

    if len(tree_indices) == 0:
        # Return empty buffer with separate node and mutation tables
        node_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32()),
            'x': pa.array([], type=pa.float32()),
            'y': pa.array([], type=pa.float32()),
        })
        mut_table = pa.table({
            'mut_x': pa.array([], type=pa.float32()),
            'mut_y': pa.array([], type=pa.float32()),
            'mut_tree_idx': pa.array([], type=pa.int32()),
        })

        node_sink = pa.BufferOutputStream()
        node_writer = pa.ipc.new_stream(node_sink, node_table.schema)
        node_writer.write_table(node_table)
        node_writer.close()
        node_bytes = node_sink.getvalue().to_pybytes()

        mut_sink = pa.BufferOutputStream()
        mut_writer = pa.ipc.new_stream(mut_sink, mut_table.schema)
        mut_writer.write_table(mut_table)
        mut_writer.close()
        mut_bytes = mut_sink.getvalue().to_pybytes()

        combined = struct.pack('<I', len(node_bytes)) + node_bytes + mut_bytes
        return combined, min_time, max_time, [], {}

    # Estimate total nodes for pre-allocation
    sample_tree = ts.at_index(int(tree_indices[0]) if tree_indices else 0)
    estimated_nodes_per_tree = sample_tree.num_nodes
    total_estimated = estimated_nodes_per_tree * len(tree_indices) * 2

    # Pre-allocate node arrays
    all_node_ids = np.empty(total_estimated, dtype=np.int32)
    all_parent_ids = np.empty(total_estimated, dtype=np.int32)
    all_is_tip = np.empty(total_estimated, dtype=np.bool_)
    all_tree_idx = np.empty(total_estimated, dtype=np.int32)
    all_x = np.empty(total_estimated, dtype=np.float32)
    all_y = np.empty(total_estimated, dtype=np.float32)

    # Pre-allocate mutation arrays (estimate based on mutation density)
    # Simplified: only x, y, tree_idx needed
    estimated_mutations = max(1000, ts.num_mutations // max(1, ts.num_trees) * len(tree_indices) * 2)
    all_mut_tree_idx = np.empty(estimated_mutations, dtype=np.int32) if has_mutations else None
    all_mut_x = np.empty(estimated_mutations, dtype=np.float32) if has_mutations else None
    all_mut_y = np.empty(estimated_mutations, dtype=np.float32) if has_mutations else None
    all_mut_node_id = np.empty(estimated_mutations, dtype=np.int32) if has_mutations else None

    offset = 0
    mut_offset = 0
    processed_indices = []

    # Initialize cache tracking
    pre_cached_graphs = pre_cached_graphs or {}
    newly_built_graphs = {}

    for tree_idx in tree_indices:
        tree_idx = int(tree_idx)

        if tree_idx < 0 or tree_idx >= ts.num_trees:
            continue

        # Check pre-cached first, then construct if needed
        if tree_idx in pre_cached_graphs:
            graph = pre_cached_graphs[tree_idx]
        else:
            graph = construct_tree(ts, edges, nodes, breakpoints, tree_idx, min_time, max_time)
            newly_built_graphs[tree_idx] = graph  # Track for caching

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

        # Apply sparsification if requested (edge-midpoint grid deduplication)
        if sparsification:
            resolution = int(1.0 / DEFAULT_SPARSIFY_CELL_SIZE)
            keep_mask = _sparsify_edges(
                node_ids.astype(np.int32),
                x.astype(np.float32),
                y.astype(np.float32),
                is_tip,
                parent_ids.astype(np.int32),
                resolution
            )
            node_ids = node_ids[keep_mask]
            parent_ids = parent_ids[keep_mask]
            x = x[keep_mask]
            y = y[keep_mask]
            is_tip = is_tip[keep_mask]
            n = len(node_ids)

            if n > 0:
                # Preserve original tip status before collapse (for correct is_tip after recompute)
                original_is_tip = is_tip.copy()
                # Collapse unary internal nodes (keep roots even if unary).
                order = np.argsort(node_ids)
                sorted_ids = node_ids[order]
                pos = np.searchsorted(sorted_ids, parent_ids)
                parent_local = np.full(n, -1, dtype=np.int32)
                valid = (parent_ids != -1) & (pos < n) & (sorted_ids[pos] == parent_ids)
                parent_local[valid] = order[pos[valid]]
                child_counts = np.bincount(parent_local[parent_local >= 0], minlength=n)
                collapse_mask = child_counts != 1

                if not np.all(collapse_mask):
                    new_parent_ids = parent_ids.copy()
                    for i in range(n):
                        if not collapse_mask[i]:
                            continue
                        parent = new_parent_ids[i]
                        while parent != -1:
                            pos = np.searchsorted(sorted_ids, parent)
                            if pos >= n or sorted_ids[pos] != parent:
                                parent = -1
                                break
                            parent_idx = order[pos]
                            if collapse_mask[parent_idx]:
                                break
                            parent = new_parent_ids[parent_idx]
                        new_parent_ids[i] = parent

                    node_ids = node_ids[collapse_mask]
                    parent_ids = new_parent_ids[collapse_mask]
                    x = x[collapse_mask]
                    y = y[collapse_mask]
                    n = len(node_ids)

                    if n > 0:
                        order = np.argsort(node_ids)
                        sorted_ids = node_ids[order]
                        pos = np.searchsorted(sorted_ids, parent_ids)
                        parent_local = np.full(n, -1, dtype=np.int32)
                        valid = (parent_ids != -1) & (pos < n) & (sorted_ids[pos] == parent_ids)
                        parent_local[valid] = order[pos[valid]]
                        child_counts = np.bincount(parent_local[parent_local >= 0], minlength=n)
                        is_tip = (child_counts == 0) & original_is_tip[collapse_mask]
                    else:
                        is_tip = is_tip[:0]

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

        # Copy node data
        all_node_ids[offset:offset+n] = node_ids
        all_parent_ids[offset:offset+n] = parent_ids
        all_is_tip[offset:offset+n] = is_tip
        all_tree_idx[offset:offset+n] = tree_idx
        all_x[offset:offset+n] = x
        all_y[offset:offset+n] = y

        offset += n

        # Collect mutations for this tree interval (inline computation)
        if has_mutations:
            interval_left = breakpoints[tree_idx]
            interval_right = breakpoints[tree_idx + 1]

            # Filter mutations by genomic position (using pre-extracted mutation_positions)
            mask = (mutation_positions >= interval_left) & (mutation_positions < interval_right)
            mut_indices = np.where(mask)[0]

            n_muts = len(mut_indices)
            if n_muts > 0:
                # Extract mutation data (simplified: only x, y, tree_idx)
                mut_node_ids = mutations.node[mut_indices].astype(np.int32)
                mut_times = mutations.time[mut_indices]
                mut_parent_ids = graph.parent[mut_node_ids].astype(np.int32)

                # Reuse graph.x for layout position (aligned with node horizontally)
                mut_layout = graph.x[mut_node_ids].astype(np.float32)

                # Time normalization (same formula as nodes)
                time_range = max_time - min_time if max_time > min_time else 1.0

                # Compute normalized time for valid times
                mut_time_norm = (max_time - mut_times) / time_range

                # Handle NaN times: use midpoint between node and parent in normalized y space
                nan_mask = np.isnan(mut_times)
                if np.any(nan_mask):
                    node_y = graph.y[mut_node_ids[nan_mask]]
                    parent_ids_for_nan = mut_parent_ids[nan_mask]
                    # For roots (parent=-1), use 0.0 (corresponds to max_time)
                    parent_y = np.where(
                        parent_ids_for_nan >= 0,
                        graph.y[np.maximum(parent_ids_for_nan, 0)],
                        0.0
                    )
                    mut_time_norm[nan_mask] = (node_y + parent_y) / 2.0

                mut_time_norm = mut_time_norm.astype(np.float32)

                # SWAP for backend convention (same as nodes)
                mut_x = mut_time_norm  # time -> x
                mut_y = mut_layout     # layout -> y

                # Ensure mutation buffer capacity
                while mut_offset + n_muts > len(all_mut_tree_idx):
                    new_size = len(all_mut_tree_idx) * 2
                    all_mut_tree_idx.resize(new_size, refcheck=False)
                    all_mut_x.resize(new_size, refcheck=False)
                    all_mut_y.resize(new_size, refcheck=False)
                    all_mut_node_id.resize(new_size, refcheck=False)

                # Copy mutation data (only essential fields)
                all_mut_tree_idx[mut_offset:mut_offset+n_muts] = tree_idx
                all_mut_x[mut_offset:mut_offset+n_muts] = mut_x
                all_mut_y[mut_offset:mut_offset+n_muts] = mut_y
                all_mut_node_id[mut_offset:mut_offset+n_muts] = mut_node_ids

                mut_offset += n_muts

        processed_indices.append(tree_idx)

    # Trim node arrays to actual size
    all_node_ids = all_node_ids[:offset]
    all_parent_ids = all_parent_ids[:offset]
    all_is_tip = all_is_tip[:offset]
    all_tree_idx = all_tree_idx[:offset]
    all_x = all_x[:offset]
    all_y = all_y[:offset]

    # Trim mutation arrays to actual size
    if has_mutations and mut_offset > 0:
        all_mut_tree_idx = all_mut_tree_idx[:mut_offset]
        all_mut_x = all_mut_x[:mut_offset]
        all_mut_y = all_mut_y[:mut_offset]
        all_mut_node_id = all_mut_node_id[:mut_offset]

        # Apply mutation sparsification when requested (grid-deduplicate by x,y per tree)
        if sparsify_mutations:
            resolution = int(1.0 / DEFAULT_SPARSIFY_CELL_SIZE)
            keep_mask = _sparsify_mutations(
                all_mut_x, all_mut_y, all_mut_tree_idx, all_mut_node_id, resolution
            )
            all_mut_tree_idx = all_mut_tree_idx[keep_mask]
            all_mut_x = all_mut_x[keep_mask]
            all_mut_y = all_mut_y[keep_mask]
            all_mut_node_id = all_mut_node_id[keep_mask]

    # Build separate node table
    if offset == 0:
        node_table = pa.table({
            'node_id': pa.array([], type=pa.int32()),
            'parent_id': pa.array([], type=pa.int32()),
            'is_tip': pa.array([], type=pa.bool_()),
            'tree_idx': pa.array([], type=pa.int32()),
            'x': pa.array([], type=pa.float32()),
            'y': pa.array([], type=pa.float32()),
        })
    else:
        node_table = pa.table({
            'node_id': pa.array(all_node_ids, type=pa.int32()),
            'parent_id': pa.array(all_parent_ids, type=pa.int32()),
            'is_tip': pa.array(all_is_tip, type=pa.bool_()),
            'tree_idx': pa.array(all_tree_idx, type=pa.int32()),
            'x': pa.array(all_x, type=pa.float32()),
            'y': pa.array(all_y, type=pa.float32()),
        })

    # Build separate mutation table (simplified: only x, y, tree_idx, node_id)
    if has_mutations and mut_offset > 0:
        mut_table = pa.table({
            'mut_x': pa.array(all_mut_x, type=pa.float32()),
            'mut_y': pa.array(all_mut_y, type=pa.float32()),
            'mut_tree_idx': pa.array(all_mut_tree_idx, type=pa.int32()),
            'mut_node_id': pa.array(all_mut_node_id, type=pa.int32()),
        })
    else:
        mut_table = pa.table({
            'mut_x': pa.array([], type=pa.float32()),
            'mut_y': pa.array([], type=pa.float32()),
            'mut_tree_idx': pa.array([], type=pa.int32()),
            'mut_node_id': pa.array([], type=pa.int32()),
        })

    # Serialize node table to IPC
    node_sink = pa.BufferOutputStream()
    node_writer = pa.ipc.new_stream(node_sink, node_table.schema)
    node_writer.write_table(node_table)
    node_writer.close()
    node_bytes = node_sink.getvalue().to_pybytes()

    # Serialize mutation table to IPC
    mut_sink = pa.BufferOutputStream()
    mut_writer = pa.ipc.new_stream(mut_sink, mut_table.schema)
    mut_writer.write_table(mut_table)
    mut_writer.close()
    mut_bytes = mut_sink.getvalue().to_pybytes()

    # Combine with 4-byte length prefix for node buffer
    # Format: [4-byte node_len (little-endian)][node_bytes][mut_bytes]
    combined = struct.pack('<I', len(node_bytes)) + node_bytes + mut_bytes

    return combined, min_time, max_time, processed_indices, newly_built_graphs


@njit(cache=True)
def _sparsify_mutations(mut_x, mut_y, mut_tree_idx, mut_node_id, resolution):
    """
    Grid-deduplicate mutations by (mut_x, mut_y) per tree.

    Mutations in the same grid cell keep one representative. Preserves spatial
    distribution while reducing payload when many mutations cluster.

    Args:
        mut_x: float32 array of x coordinates (time, normalized [0,1])
        mut_y: float32 array of y coordinates (layout, normalized [0,1])
        mut_tree_idx: int32 array of tree indices
        mut_node_id: int32 array of node IDs (unused for dedup, kept for output)
        resolution: Grid resolution (e.g., 500 for cell_size=0.002)

    Returns:
        keep: bool array indicating which mutations to keep
    """
    n = len(mut_x)
    keep = np.zeros(n, dtype=np.bool_)

    if n == 0:
        return keep

    seen_cells = Dict.empty(key_type=types.int64, value_type=types.int32)
    stride = resolution + 1

    for i in range(n):
        cx = min(int(mut_x[i] * resolution), resolution - 1)
        cy = min(int(mut_y[i] * resolution), resolution - 1)
        tree_idx = mut_tree_idx[i]
        key = tree_idx * stride * stride + cx * stride + cy

        if key not in seen_cells:
            seen_cells[key] = np.int32(i)
            keep[i] = True

    return keep


@njit(cache=True)
def _sparsify_edges(node_ids, x, y, is_tip, parent_ids, resolution):
    """
    Edge-centric sparsification: grid-deduplicate edges by midpoint position.

    Algorithm:
    1. Always keep root nodes
    2. For each non-root node (= edge to parent), compute edge midpoint
    3. Grid-dedupe by midpoint: first edge per cell survives
    4. Trace path to root for each kept node

    Long root-level edges have midpoints spread across the x range,
    occupying unique cells. Short tip-level edges cluster near x≈1
    and get deduplicated. This naturally preserves visually significant
    edges based on their length and position.

    Args:
        node_ids: int32 array of node IDs
        x: float32 array of x coordinates (normalized [0,1])
        y: float32 array of y coordinates (normalized [0,1])
        is_tip: bool array indicating tip nodes
        parent_ids: int32 array of parent IDs (-1 for roots)
        resolution: Grid resolution (e.g., 500 for cell_size=0.002)

    Returns:
        keep: bool array indicating which nodes to keep
    """
    n = len(node_ids)
    keep = np.zeros(n, dtype=np.bool_)

    if n == 0:
        return keep

    # Build node_to_idx mapping
    max_node_id = 0
    for i in range(n):
        if node_ids[i] > max_node_id:
            max_node_id = node_ids[i]

    node_to_idx = np.full(max_node_id + 1, -1, dtype=np.int32)
    for i in range(n):
        node_to_idx[node_ids[i]] = i

    seen_cells = Dict.empty(key_type=types.int64, value_type=types.int32)

    # Always keep root nodes
    for i in range(n):
        if parent_ids[i] == -1:
            keep[i] = True

    # Grid-dedupe edges by midpoint position
    for i in range(n):
        if parent_ids[i] == -1:
            continue  # Root — no edge to parent
        if parent_ids[i] > max_node_id:
            continue
        parent_idx = node_to_idx[parent_ids[i]]
        if parent_idx < 0:
            continue

        mid_x = (x[i] + x[parent_idx]) / 2.0
        mid_y = (y[i] + y[parent_idx]) / 2.0
        cx = min(int(mid_x * resolution), resolution - 1)
        cy = min(int(mid_y * resolution), resolution - 1)
        key = cx * (resolution + 1) + cy

        if key not in seen_cells:
            seen_cells[key] = i
            keep[i] = True

    # Trace ancestors for connectivity
    for i in range(n):
        if keep[i]:
            parent = parent_ids[i]
            while parent != -1:
                if parent > max_node_id:
                    break
                parent_idx = node_to_idx[parent]
                if parent_idx < 0:
                    break
                if keep[parent_idx]:
                    break
                keep[parent_idx] = True
                parent = parent_ids[parent_idx]

    return keep
