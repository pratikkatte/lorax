"""Parse Newick strings and compute x,y layout coordinates.

This module provides tree layout computation for CSV files containing Newick strings.
It mirrors the approach in tree_graph/tree_graph.py but sources data from Newick parsing
instead of tskit tables.

Coordinate system:
- y (time): anchored time in [0,1] where tips are always 1.0 and the root is
  1 - (tree_height / global_max_height)
- x (layout): tips get sequential x, internal nodes get (min+max)/2 of children
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import numpy as np

# ete3 is used for Newick parsing
from ete3 import Tree


def prune_outgroup_sample(tree: Tree, outgroup: str = "etal") -> None:
    """Prune an outgroup leaf from an ete3 Tree (best-effort).

    This is a temporary compatibility workaround for CSV Newick inputs that include
    a known outgroup sample (e.g. "etal") that should not be displayed.

    Behavior:
    - If outgroup is missing, do nothing.
    - Otherwise, reroot on outgroup, delete it, and clear the root branch lengths
    """
    try:
        leaf_names = tree.get_leaf_names()
        if not leaf_names:
            return

        # Match case-insensitively (e.g. "etal" vs "Etal")
        target = None
        out_l = str(outgroup).lower()
        for name in leaf_names:
            if str(name).lower() == out_l:
                target = str(name)
                break
        if target is None:
            return

        tree.set_outgroup(target)
        (tree & target).delete()

        # Remove root branch distortion after rerooting/pruning
        tree.dist = 0.0
        for child in tree.get_children():
            child.dist = 0.0
    except Exception:
        # Best-effort: CSV loading should remain resilient.
        return


@dataclass
class NewickTreeGraph:
    """Tree structure from parsed Newick with layout coordinates.

    Attributes:
        node_id: Sequential node IDs assigned via post-order traversal
        parent_id: Parent node ID (-1 for root)
        is_tip: Boolean array indicating leaf nodes
        name: Leaf names from the Newick string
        branch_length: Distance to parent
        x: Layout position [0,1] - tips spread, internal = (min+max)/2 of children
        y: Normalized time [0,1] - cumulative distance from root
    """

    node_id: np.ndarray  # int32
    parent_id: np.ndarray  # int32
    is_tip: np.ndarray  # bool
    name: List[str]  # leaf names
    branch_length: np.ndarray  # float32
    x: np.ndarray  # float32, layout position
    y: np.ndarray  # float32, normalized time


def shift_tree_tips_to_one(y: np.ndarray, is_tip: np.ndarray) -> np.ndarray:
    """Shift y so the maximum tip height is exactly 1.0 (clipped to [0,1])."""
    if y.size == 0:
        return y
    if is_tip is None or is_tip.size == 0:
        return y
    tip_max = float(y[is_tip].max()) if np.any(is_tip) else 1.0
    if not np.isfinite(tip_max) or tip_max == 1.0:
        return y
    return np.clip(y + (1.0 - tip_max), 0.0, 1.0)


def parse_newick_to_tree(
    newick_str: str,
    max_branch_length: float,
    samples_order: Optional[List[str]] = None,
    *,
    tree_max_branch_length: float | None = None,
    shift_tips_to_one: bool = False,
) -> NewickTreeGraph:
    """Parse Newick string and compute x,y coordinates.

    Uses ete3 to parse the Newick string, then computes layout coordinates
    using the same algorithm as tree_graph.py:
    - y: cumulative distance from root, normalized by max_branch_length
    - x: post-order layout where tips get sequential x, internals get (min+max)/2

    Args:
        newick_str: Newick format tree string
        max_branch_length: Global max height for y anchoring (from config times.values[1])
        tree_max_branch_length: Optional per-tree max height. If provided, this is
            used to anchor the root at 1 - (tree_height / global_max). If omitted,
            tree height is derived from the parsed tree (max cumulative root distance).

    Returns:
        NewickTreeGraph with layout coordinates normalized to [0,1]
    """
    # Parse with ete3 - format=1 includes branch lengths and internal node names
    tree = Tree(newick_str, format=1)
    # Prune the outgroup before any layout or time computation.
    # TODO: remove in feature.
    prune_outgroup_sample(tree, outgroup="etal")

    # Assign traversal order via post-order traversal (after pruning)
    nodes = list(tree.traverse("postorder"))
    if not nodes:
        empty_i32 = np.array([], dtype=np.int32)
        empty_bool = np.array([], dtype=np.bool_)
        empty_f32 = np.array([], dtype=np.float32)
        return NewickTreeGraph(
            node_id=empty_i32,
            parent_id=empty_i32,
            is_tip=empty_bool,
            name=[],
            branch_length=empty_f32,
            x=empty_f32,
            y=empty_f32,
        )
    node_index = {node: idx for idx, node in enumerate(nodes)}

    num_nodes = len(nodes)

    # Build arrays
    node_id = np.arange(num_nodes, dtype=np.int32)
    parent_id = np.full(num_nodes, -1, dtype=np.int32)
    is_tip = np.zeros(num_nodes, dtype=np.bool_)
    branch_length = np.zeros(num_nodes, dtype=np.float32)
    name = [""] * num_nodes

    assigned_ids = {}
    next_id = 0
    if samples_order:
        sample_id_map = {str(name): idx for idx, name in enumerate(samples_order)}
        for node in nodes:
            if node.is_leaf():
                node_name = node.name if node.name else ""
                if node_name not in sample_id_map:
                    raise ValueError(
                        f"Leaf sample name '{node_name}' not found in samples_order. "
                        "Ensure CSV config provides a complete, file-level samples list."
                    )
                assigned_ids[node] = sample_id_map[node_name]
        next_id = len(samples_order)
        for node in nodes:
            if not node.is_leaf():
                assigned_ids[node] = next_id
                next_id += 1
    else:
        for node in nodes:
            assigned_ids[node] = next_id
            next_id += 1

    for node in nodes:
        idx = node_index[node]
        if node.up is not None:
            parent_id[idx] = assigned_ids[node.up]
        is_tip[idx] = node.is_leaf()
        branch_length[idx] = node.dist if node.dist else 0.0
        name[idx] = node.name if node.name else ""
        node_id[idx] = assigned_ids[node]

    # Compute y_raw (time): cumulative distance from root
    # Root at 0, tips at tree_height
    y_raw = np.zeros(num_nodes, dtype=np.float32)
    for node in tree.traverse("preorder"):  # Root first
        idx = node_index[node]
        if node.up is not None:
            parent_idx = node_index[node.up]
            y_raw[idx] = y_raw[parent_idx] + branch_length[idx]

    # Anchor time so tips are always 1.0 and the root is 1 - tree_height/global_max.
    #
    # If the per-tree max height is known (e.g. CSV 'max_branch_length' column), use
    # it; otherwise derive it from the parsed tree.
    tree_height = float(tree_max_branch_length) if (tree_max_branch_length or 0.0) > 0 else float(y_raw.max())
    if max_branch_length > 0:
        y = 1.0 - (tree_height - y_raw) / float(max_branch_length)
        y = np.clip(y, 0.0, 1.0)
    else:
        # Degenerate case: no global height information. Keep tips at 1.
        y = np.ones(num_nodes, dtype=np.float32)

    if shift_tips_to_one:
        y = shift_tree_tips_to_one(y, is_tip)

    # Compute x (layout): tips get sequential x, internals = (min+max)/2
    x = np.zeros(num_nodes, dtype=np.float32)
    tip_counter = 0

    for node in tree.traverse("postorder"):
        idx = node_index[node]
        if node.is_leaf():
            x[idx] = tip_counter
            tip_counter += 1
        else:
            child_xs = [x[node_index[child]] for child in node.children]
            x[idx] = (min(child_xs) + max(child_xs)) / 2.0

    # Normalize x to [0,1]
    if tip_counter > 1:
        x = x / (tip_counter - 1)

    return NewickTreeGraph(
        node_id=node_id,
        parent_id=parent_id,
        is_tip=is_tip,
        name=name,
        branch_length=branch_length,
        x=x,
        y=y,
    )
