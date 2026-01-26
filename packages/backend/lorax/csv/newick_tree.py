"""Parse Newick strings and compute x,y layout coordinates.

This module provides tree layout computation for CSV files containing Newick strings.
It mirrors the approach in tree_graph/tree_graph.py but sources data from Newick parsing
instead of tskit tables.

Coordinate system:
- y (time): cumulative distance from root, normalized to [0,1]
- x (layout): tips get sequential x, internal nodes get (min+max)/2 of children
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np

# ete3 is used for Newick parsing
from ete3 import Tree


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


def parse_newick_to_tree(newick_str: str, max_branch_length: float) -> NewickTreeGraph:
    """Parse Newick string and compute x,y coordinates.

    Uses ete3 to parse the Newick string, then computes layout coordinates
    using the same algorithm as tree_graph.py:
    - y: cumulative distance from root, normalized by max_branch_length
    - x: post-order layout where tips get sequential x, internals get (min+max)/2

    Args:
        newick_str: Newick format tree string
        max_branch_length: Global max for y normalization (from config times.values[1])

    Returns:
        NewickTreeGraph with layout coordinates normalized to [0,1]
    """
    # Parse with ete3 - format=1 includes branch lengths and internal node names
    tree = Tree(newick_str, format=1)

    # Assign sequential node IDs via post-order traversal
    nodes = []
    for node in tree.traverse("postorder"):
        node.add_feature("node_id", len(nodes))
        nodes.append(node)

    num_nodes = len(nodes)

    # Build arrays
    node_id = np.arange(num_nodes, dtype=np.int32)
    parent_id = np.full(num_nodes, -1, dtype=np.int32)
    is_tip = np.zeros(num_nodes, dtype=np.bool_)
    branch_length = np.zeros(num_nodes, dtype=np.float32)
    name = [""] * num_nodes

    for node in nodes:
        idx = node.node_id
        if node.up is not None:
            parent_id[idx] = node.up.node_id
        is_tip[idx] = node.is_leaf()
        branch_length[idx] = node.dist if node.dist else 0.0
        name[idx] = node.name if node.name else ""

    # Compute y (time): cumulative distance from root, normalized
    # Root at y=0, tips at y=max_cumulative_distance
    y = np.zeros(num_nodes, dtype=np.float32)
    for node in tree.traverse("preorder"):  # Root first
        idx = node.node_id
        if node.up is not None:
            parent_idx = node.up.node_id
            y[idx] = y[parent_idx] + branch_length[idx]

    # Normalize y to [0,1] using max_branch_length
    # This matches the tskit convention where max_time maps to x=0, min_time to x=1
    # But for CSV we have branch lengths, so root=0, tips=max
    if max_branch_length > 0:
        y = y / max_branch_length
    # Clamp to [0, 1] in case individual tree exceeds global max
    y = np.clip(y, 0.0, 1.0)

    # Compute x (layout): tips get sequential x, internals = (min+max)/2
    x = np.zeros(num_nodes, dtype=np.float32)
    tip_counter = 0

    for node in tree.traverse("postorder"):
        idx = node.node_id
        if node.is_leaf():
            x[idx] = tip_counter
            tip_counter += 1
        else:
            child_xs = [x[child.node_id] for child in node.children]
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
