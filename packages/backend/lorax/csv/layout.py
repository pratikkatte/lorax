from __future__ import annotations

import struct
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import pyarrow as pa


def build_empty_tree_layout_arrow_ipc() -> bytes:
    """Return a valid (possibly empty) PyArrow IPC stream for tree layout.

    Frontend expects a table with these columns:
    - node_id:int32
    - parent_id:int32
    - is_tip:bool
    - tree_idx:int32
    - x:float32
    - y:float32
    """
    empty_table = pa.table(
        {
            "node_id": pa.array([], type=pa.int32()),
            "parent_id": pa.array([], type=pa.int32()),
            "is_tip": pa.array([], type=pa.bool_()),
            "tree_idx": pa.array([], type=pa.int32()),
            "x": pa.array([], type=pa.float32()),
            "y": pa.array([], type=pa.float32()),
            "name": pa.array([], type=pa.string()),
        }
    )
    sink = pa.BufferOutputStream()
    writer = pa.ipc.new_stream(sink, empty_table.schema)
    writer.write_table(empty_table)
    writer.close()
    return sink.getvalue().to_pybytes()


def build_empty_layout_response(tree_indices: List[int] | None = None) -> Dict[str, Any]:
    """Build the response shape returned by `handle_tree_graph_query` for CSV."""
    return {
        "buffer": build_empty_tree_layout_arrow_ipc(),
        "global_min_time": 0.0,
        "global_max_time": 0.0,
        "tree_indices": tree_indices or [],
    }


def build_csv_layout_response(
    df: pd.DataFrame,
    tree_indices: List[int],
    max_branch_length: float,
    samples_order: List[str] | None = None,
    pre_parsed_graphs: Dict[int, Any] | None = None,
    shift_tips_to_one: bool = False,
) -> Dict[str, Any]:
    """Build PyArrow IPC buffer for CSV trees.

    Parses Newick strings from the DataFrame and generates the same buffer format
    as construct_trees_batch() for tskit files.

    Args:
        df: DataFrame with 'newick' column containing Newick tree strings
        tree_indices: List of row indices (global_index) to process
        max_branch_length: From config times.values[1], for y normalization

    Returns:
        Same format as construct_trees_batch():
        {buffer, global_min_time, global_max_time, tree_indices}
    """
    from lorax.csv.newick_tree import parse_newick_to_tree

    # Collect all nodes from all trees
    all_node_ids: List[np.ndarray] = []
    all_parent_ids: List[np.ndarray] = []
    all_is_tip: List[np.ndarray] = []
    all_tree_idx: List[np.ndarray] = []
    all_x: List[np.ndarray] = []
    all_y: List[np.ndarray] = []
    all_names: List[np.ndarray] = []

    processed_indices: List[int] = []

    for tree_idx in tree_indices:
        tree_idx = int(tree_idx)
        if tree_idx < 0 or tree_idx >= len(df):
            continue

        newick_str = df.iloc[tree_idx].get("newick")
        if pd.isna(newick_str):
            continue

        tree_max_branch_length = None
        if "max_branch_length" in df.columns:
            try:
                v = df.iloc[tree_idx].get("max_branch_length")
                if v is not None and not (isinstance(v, float) and pd.isna(v)) and str(v).strip() != "":
                    tree_max_branch_length = float(v)
            except Exception:
                tree_max_branch_length = None

        graph = pre_parsed_graphs.get(tree_idx) if pre_parsed_graphs else None
        if graph is None:
            try:
                graph = parse_newick_to_tree(
                    str(newick_str),
                    max_branch_length,
                    samples_order=samples_order,
                    tree_max_branch_length=tree_max_branch_length,
                    shift_tips_to_one=shift_tips_to_one,
                )
            except Exception as e:
                # Log error but continue with other trees
                print(f"Failed to parse Newick for tree {tree_idx}: {e}")
                continue

        n = len(graph.node_id)
        if n == 0:
            continue

        # Collect nodes for this tree using canonical x/y semantics.
        # x = layout/horizontal, y = time/vertical
        all_node_ids.append(graph.node_id)
        all_parent_ids.append(graph.parent_id)
        all_is_tip.append(graph.is_tip)
        all_tree_idx.append(np.full(n, tree_idx, dtype=np.int32))
        all_x.append(graph.x.astype(np.float32))
        all_y.append(graph.y.astype(np.float32))
        all_names.append(np.array(graph.name, dtype=object))

        processed_indices.append(tree_idx)

    # Build PyArrow table
    if not all_node_ids:
        # Return empty buffer
        return build_empty_layout_response(list(tree_indices))

    # Concatenate all arrays
    node_table = pa.table(
        {
            "node_id": pa.array(np.concatenate(all_node_ids), type=pa.int32()),
            "parent_id": pa.array(np.concatenate(all_parent_ids), type=pa.int32()),
            "is_tip": pa.array(np.concatenate(all_is_tip), type=pa.bool_()),
            "tree_idx": pa.array(np.concatenate(all_tree_idx), type=pa.int32()),
            "x": pa.array(np.concatenate(all_x), type=pa.float32()),
            "y": pa.array(np.concatenate(all_y), type=pa.float32()),
            "name": pa.array(np.concatenate(all_names), type=pa.string()),
        }
    )

    # Empty mutation table (CSV has no mutations)
    mut_table = pa.table(
        {
            "mut_x": pa.array([], type=pa.float32()),
            "mut_y": pa.array([], type=pa.float32()),
            "mut_tree_idx": pa.array([], type=pa.int32()),
        }
    )

    # Serialize to IPC format (same as tree_graph.py)
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

    # Combine with length prefix (same format as tree_graph.py:559)
    combined = struct.pack("<I", len(node_bytes)) + node_bytes + mut_bytes

    return {
        "buffer": combined,
        "global_min_time": 0.0,
        "global_max_time": float(max_branch_length),
        "tree_indices": processed_indices,
    }
