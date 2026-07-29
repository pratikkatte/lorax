"""Render compact CSR genealogies into Lorax's existing frontend Arrow contract."""

from __future__ import annotations

import struct
from typing import Iterable

import numpy as np
import pyarrow as pa

from lorax.artifacts.csr_reader import GenealogyCSR
from lorax.tree_graph.time_scale import normalize_time_scale, times_to_y
from lorax.tree_graph.tree_graph import (
    LOW_COVERAGE_NO_INSIDE_SPARSIFY_MULTIPLIER,
    _build_parent_local,
    _collapse_degree1_nodes,
    _empty_mutation_table,
    _force_keep_unary_nodes_and_anchors,
    _resolve_adaptive_inside_cell_size,
    _resolve_sparsify_cell_size,
    _sparsify_edges,
    _sparsify_edges_adaptive,
    _sparsify_mutations,
    _sparsify_mutations_adaptive,
)


def _filter_tuple(values: tuple[str, ...], mask: np.ndarray) -> list[str]:
    return [value for value, keep in zip(values, mask) if bool(keep)]


def _process_genealogy(
    genealogy: GenealogyCSR,
    *,
    min_time: float,
    max_time: float,
    time_scale: str,
    sparsification: bool,
    sparsify_cell_size_multiplier: float | None,
    adaptive_sparsify_bbox: dict | None,
    adaptive_target_tree_idx: int | None,
) -> tuple[dict[str, np.ndarray], dict[str, object]]:
    node_ids = np.asarray(genealogy.node_ids, dtype=np.int32)
    parent_ids = np.asarray(genealogy.parent_ids, dtype=np.int32)
    x = np.asarray(genealogy.layout_x, dtype=np.float32)
    y = times_to_y(
        np.asarray(genealogy.node_times, dtype=np.float64),
        min_time,
        max_time,
        time_scale,
    ).astype(np.float32)
    child_counts = np.diff(genealogy.child_offsets)
    is_tip = (child_counts == 0).astype(np.bool_)
    original_unary_mask = (child_counts == 1) & (parent_ids != -1)
    n = len(node_ids)

    base_cell_size = _resolve_sparsify_cell_size(
        num_nodes=n,
        sparsify_cell_size=None,
        sparsify_cell_size_multiplier=(
            None
            if adaptive_sparsify_bbox is not None
            and adaptive_target_tree_idx == genealogy.tree_index
            else sparsify_cell_size_multiplier
        ),
    )
    outside_resolution = int(1.0 / base_cell_size)
    inside_resolution = outside_resolution
    disable_inside_sparsification = False
    adaptive_for_tree = (
        isinstance(adaptive_sparsify_bbox, dict)
        and adaptive_target_tree_idx == genealogy.tree_index
    )

    if sparsification and n:
        parent_local = _build_parent_local(node_ids, parent_ids, n)
        tip_x = x[is_tip]
        all_tips_at_x1 = len(tip_x) > 0 and np.all(tip_x > 0.999999)
        use_midpoint_only = not all_tips_at_x1
        if adaptive_for_tree:
            inside_cell_size = _resolve_adaptive_inside_cell_size(
                num_nodes=n,
                outside_cell_size=base_cell_size,
                inside_multiplier=sparsify_cell_size_multiplier,
            )
            inside_resolution = int(1.0 / inside_cell_size)
            disable_inside_sparsification = bool(
                np.isclose(
                    float(sparsify_cell_size_multiplier or 1.0),
                    LOW_COVERAGE_NO_INSIDE_SPARSIFY_MULTIPLIER,
                    rtol=0.0,
                    atol=1e-12,
                )
            )
            keep_mask = _sparsify_edges_adaptive(
                x,
                y,
                parent_local,
                outside_resolution,
                inside_resolution,
                float(adaptive_sparsify_bbox["min_x"]),
                float(adaptive_sparsify_bbox["max_x"]),
                float(adaptive_sparsify_bbox["min_y"]),
                float(adaptive_sparsify_bbox["max_y"]),
                use_midpoint_only,
                disable_inside_sparsification,
            )
        else:
            keep_mask = _sparsify_edges(
                x,
                y,
                parent_local,
                outside_resolution,
                use_midpoint_only,
            )
        keep_mask, preserve_mask = _force_keep_unary_nodes_and_anchors(
            keep_mask,
            parent_local,
            original_unary_mask,
        )
        node_ids = node_ids[keep_mask]
        parent_ids = parent_ids[keep_mask]
        is_tip = is_tip[keep_mask]
        x = x[keep_mask]
        y = y[keep_mask]
        preserve_mask = preserve_mask[keep_mask]
        n = len(node_ids)
        if n:
            parent_local = _build_parent_local(node_ids, parent_ids, n)
            (
                node_ids,
                parent_ids,
                is_tip,
                x,
                y,
                n,
            ) = _collapse_degree1_nodes(
                node_ids,
                parent_ids,
                is_tip,
                x,
                y,
                parent_local,
                preserve_mask,
                n,
            )

    mutations = genealogy.mutations
    mutation_count = len(mutations)
    mutation_data: dict[str, object] = {
        "tree_idx": np.empty(0, dtype=np.int32),
        "x": np.empty(0, dtype=np.float32),
        "y": np.empty(0, dtype=np.float32),
        "node_id": np.empty(0, dtype=np.int32),
        "id": np.empty(0, dtype=np.int32),
        "site_id": np.empty(0, dtype=np.int32),
        "position": np.empty(0, dtype=np.float64),
        "time": np.empty(0, dtype=np.float64),
        "ancestral_state": [],
        "derived_state": [],
        "inherited_state": [],
    }
    if mutation_count:
        mutation_node_offsets = np.searchsorted(
            genealogy.node_ids,
            mutations.node_ids,
        )
        mutation_x = genealogy.layout_x[mutation_node_offsets].astype(np.float32)
        mutation_y = times_to_y(
            mutations.times,
            min_time,
            max_time,
            time_scale,
        ).astype(np.float32)
        nan_mask = np.isnan(mutations.times)
        if np.any(nan_mask):
            nan_offsets = mutation_node_offsets[nan_mask]
            node_y = times_to_y(
                genealogy.node_times[nan_offsets],
                min_time,
                max_time,
                time_scale,
            )
            parent_ids_for_nan = genealogy.parent_ids[nan_offsets]
            parent_y = np.zeros(len(nan_offsets), dtype=np.float32)
            valid_parent = parent_ids_for_nan >= 0
            if np.any(valid_parent):
                parent_offsets = np.searchsorted(
                    genealogy.node_ids,
                    parent_ids_for_nan[valid_parent],
                )
                parent_y[valid_parent] = times_to_y(
                    genealogy.node_times[parent_offsets],
                    min_time,
                    max_time,
                    time_scale,
                )
            mutation_y[nan_mask] = (node_y + parent_y) / 2.0

        mutation_mask = np.ones(mutation_count, dtype=np.bool_)
        if sparsification:
            mutation_mask &= np.isin(mutations.node_ids, node_ids)
        mutation_node_ids = mutations.node_ids[mutation_mask]
        mutation_x = mutation_x[mutation_mask]
        mutation_y = mutation_y[mutation_mask]
        mutation_ids = mutations.ids[mutation_mask]
        mutation_site_ids = mutations.site_ids[mutation_mask]
        mutation_positions = mutations.positions[mutation_mask]
        mutation_times = mutations.times[mutation_mask]
        ancestral = _filter_tuple(mutations.ancestral_states, mutation_mask)
        derived = _filter_tuple(mutations.derived_states, mutation_mask)
        inherited = _filter_tuple(mutations.inherited_states, mutation_mask)

        if sparsification and len(mutation_ids):
            mutation_tree_ids = np.full(
                len(mutation_ids),
                genealogy.tree_index,
                dtype=np.int32,
            )
            if adaptive_for_tree:
                mutation_keep = _sparsify_mutations_adaptive(
                    mutation_x,
                    mutation_y,
                    mutation_tree_ids,
                    mutation_node_ids,
                    outside_resolution,
                    inside_resolution,
                    genealogy.tree_index,
                    float(adaptive_sparsify_bbox["min_x"]),
                    float(adaptive_sparsify_bbox["max_x"]),
                    float(adaptive_sparsify_bbox["min_y"]),
                    float(adaptive_sparsify_bbox["max_y"]),
                    disable_inside_sparsification,
                )
            else:
                mutation_keep = _sparsify_mutations(
                    mutation_x,
                    mutation_y,
                    mutation_tree_ids,
                    mutation_node_ids,
                    outside_resolution,
                )
            mutation_node_ids = mutation_node_ids[mutation_keep]
            mutation_x = mutation_x[mutation_keep]
            mutation_y = mutation_y[mutation_keep]
            mutation_ids = mutation_ids[mutation_keep]
            mutation_site_ids = mutation_site_ids[mutation_keep]
            mutation_positions = mutation_positions[mutation_keep]
            mutation_times = mutation_times[mutation_keep]
            ancestral = [
                value for value, keep in zip(ancestral, mutation_keep) if keep
            ]
            derived = [
                value for value, keep in zip(derived, mutation_keep) if keep
            ]
            inherited = [
                value for value, keep in zip(inherited, mutation_keep) if keep
            ]
        mutation_data = {
            "tree_idx": np.full(
                len(mutation_ids),
                genealogy.tree_index,
                dtype=np.int32,
            ),
            "x": mutation_x,
            "y": mutation_y,
            "node_id": mutation_node_ids,
            "id": mutation_ids,
            "site_id": mutation_site_ids,
            "position": mutation_positions,
            "time": mutation_times,
            "ancestral_state": ancestral,
            "derived_state": derived,
            "inherited_state": inherited,
        }

    node_data = {
        "node_id": node_ids,
        "parent_id": parent_ids,
        "is_tip": is_tip,
        "tree_idx": np.full(n, genealogy.tree_index, dtype=np.int32),
        "x": x,
        "y": y,
    }
    return node_data, mutation_data


def _concat(parts: list[np.ndarray], dtype: np.dtype) -> np.ndarray:
    nonempty = [np.asarray(part, dtype=dtype) for part in parts if len(part)]
    return np.concatenate(nonempty) if nonempty else np.empty(0, dtype=dtype)


def serialize_csr_genealogies(
    genealogies: Iterable[GenealogyCSR],
    *,
    global_min_time: float,
    global_max_time: float,
    time_scale: str = "linear",
    sparsification: bool = False,
    sparsify_cell_size_multiplier: float | None = None,
    adaptive_sparsify_bbox: dict | None = None,
    adaptive_target_tree_idx: int | None = None,
) -> dict:
    """Serialize CSR genealogies without allocating source-global node arrays."""
    genealogies = list(genealogies)
    time_scale = normalize_time_scale(time_scale)
    processed = [
        _process_genealogy(
            genealogy,
            min_time=float(global_min_time),
            max_time=float(global_max_time),
            time_scale=time_scale,
            sparsification=sparsification,
            sparsify_cell_size_multiplier=sparsify_cell_size_multiplier,
            adaptive_sparsify_bbox=adaptive_sparsify_bbox,
            adaptive_target_tree_idx=adaptive_target_tree_idx,
        )
        for genealogy in genealogies
    ]

    node_table = pa.table(
        {
            "node_id": pa.array(
                _concat([node["node_id"] for node, _ in processed], np.int32),
                type=pa.int32(),
            ),
            "parent_id": pa.array(
                _concat([node["parent_id"] for node, _ in processed], np.int32),
                type=pa.int32(),
            ),
            "is_tip": pa.array(
                _concat([node["is_tip"] for node, _ in processed], np.bool_),
                type=pa.bool_(),
            ),
            "tree_idx": pa.array(
                _concat([node["tree_idx"] for node, _ in processed], np.int32),
                type=pa.int32(),
            ),
            "x": pa.array(
                _concat([node["x"] for node, _ in processed], np.float32),
                type=pa.float32(),
            ),
            "y": pa.array(
                _concat([node["y"] for node, _ in processed], np.float32),
                type=pa.float32(),
            ),
        }
    )

    mutation_count = sum(
        len(mutation["id"]) for _node, mutation in processed
    )
    if mutation_count:
        mutation_table = pa.table(
            {
                "mut_x": pa.array(
                    _concat([m["x"] for _, m in processed], np.float32),
                    type=pa.float32(),
                ),
                "mut_y": pa.array(
                    _concat([m["y"] for _, m in processed], np.float32),
                    type=pa.float32(),
                ),
                "mut_tree_idx": pa.array(
                    _concat([m["tree_idx"] for _, m in processed], np.int32),
                    type=pa.int32(),
                ),
                "mut_node_id": pa.array(
                    _concat([m["node_id"] for _, m in processed], np.int32),
                    type=pa.int32(),
                ),
                "mut_id": pa.array(
                    _concat([m["id"] for _, m in processed], np.int32),
                    type=pa.int32(),
                ),
                "mut_site_id": pa.array(
                    _concat([m["site_id"] for _, m in processed], np.int32),
                    type=pa.int32(),
                ),
                "mut_position": pa.array(
                    _concat([m["position"] for _, m in processed], np.float64),
                    type=pa.float64(),
                ),
                "mut_time": pa.array(
                    _concat([m["time"] for _, m in processed], np.float64),
                    type=pa.float64(),
                ),
                "mut_ancestral_state": pa.array(
                    [value for _, m in processed for value in m["ancestral_state"]],
                    type=pa.string(),
                ),
                "mut_derived_state": pa.array(
                    [value for _, m in processed for value in m["derived_state"]],
                    type=pa.string(),
                ),
                "mut_inherited_state": pa.array(
                    [value for _, m in processed for value in m["inherited_state"]],
                    type=pa.string(),
                ),
            }
        )
    else:
        mutation_table = _empty_mutation_table()

    node_sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(node_sink, node_table.schema) as writer:
        writer.write_table(node_table)
    node_bytes = node_sink.getvalue().to_pybytes()
    mutation_sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(mutation_sink, mutation_table.schema) as writer:
        writer.write_table(mutation_table)
    mutation_bytes = mutation_sink.getvalue().to_pybytes()
    buffer = struct.pack("<I", len(node_bytes)) + node_bytes + mutation_bytes
    return {
        "buffer": buffer,
        "global_min_time": float(global_min_time),
        "global_max_time": float(global_max_time),
        "tree_indices": [genealogy.tree_index for genealogy in genealogies],
        "tree_intervals": [
            [genealogy.interval_left, genealogy.interval_right]
            for genealogy in genealogies
        ],
    }


__all__ = ["serialize_csr_genealogies"]
