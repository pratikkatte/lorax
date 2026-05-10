"""Helpers for mapping tree node times onto normalized display coordinates."""

from __future__ import annotations

import numpy as np

TIME_SCALE_LINEAR = "linear"
TIME_SCALE_LOG = "log"
SUPPORTED_TIME_SCALES = {TIME_SCALE_LINEAR, TIME_SCALE_LOG}


def normalize_time_scale(time_scale: str | None) -> str:
    """Return a supported time scale name, defaulting to linear."""
    if isinstance(time_scale, str):
        normalized = time_scale.strip().lower()
        if normalized in SUPPORTED_TIME_SCALES:
            return normalized
    return TIME_SCALE_LINEAR


def time_to_y(time_value: float, min_time: float, max_time: float, time_scale: str | None = None) -> float:
    """Map a time value to normalized y where max_time is 0 and min_time is 1."""
    y = times_to_y(np.asarray([time_value], dtype=np.float64), min_time, max_time, time_scale)
    return float(y[0]) if y.size else 1.0


def times_to_y(times, min_time: float, max_time: float, time_scale: str | None = None) -> np.ndarray:
    """Vectorized time-to-y transform for node and mutation coordinates."""
    values = np.asarray(times, dtype=np.float64)
    time_range = float(max_time) - float(min_time)
    if not np.isfinite(time_range) or time_range <= 0:
        return np.ones(values.shape, dtype=np.float32)

    offset = np.clip(values - float(min_time), 0.0, time_range)
    if normalize_time_scale(time_scale) == TIME_SCALE_LOG:
        denominator = np.log1p(time_range)
        if not np.isfinite(denominator) or denominator <= 0:
            return np.ones(values.shape, dtype=np.float32)
        normalized = np.log1p(offset) / denominator
    else:
        normalized = offset / time_range

    return (1.0 - normalized).astype(np.float32)


def normalized_y_to_scaled_y(y_values, min_time: float, max_time: float, time_scale: str | None = None) -> np.ndarray:
    """Convert existing linear normalized y coordinates to the requested scale."""
    values = np.asarray(y_values, dtype=np.float64)
    time_range = float(max_time) - float(min_time)
    if not np.isfinite(time_range) or time_range <= 0:
        return np.ones(values.shape, dtype=np.float32)
    times = float(max_time) - np.clip(values, 0.0, 1.0) * time_range
    return times_to_y(times, min_time, max_time, time_scale)


def tree_graph_node_position(graph, node_id: int, min_time: float, max_time: float, time_scale: str | None = None) -> dict:
    """Return emitted local coordinates for a TreeGraph node."""
    node_id = int(node_id)
    return {
        "node_id": node_id,
        "x": float(graph.x[node_id]),
        "y": time_to_y(float(graph.time[node_id]), min_time, max_time, time_scale),
    }


def tree_graph_edge_coordinates(
    graph,
    parent: int,
    child: int,
    min_time: float,
    max_time: float,
    time_scale: str | None = None,
) -> dict:
    """Return emitted local coordinates for a TreeGraph edge."""
    parent_pos = tree_graph_node_position(graph, parent, min_time, max_time, time_scale)
    child_pos = tree_graph_node_position(graph, child, min_time, max_time, time_scale)
    return {
        "parent": int(parent),
        "child": int(child),
        "parent_x": parent_pos["x"],
        "parent_y": parent_pos["y"],
        "child_x": child_pos["x"],
        "child_y": child_pos["y"],
    }


def newick_node_id_to_index(graph, node_id: int) -> int | None:
    """Map a NewickTreeGraph node_id to its array index."""
    idxs = np.where(graph.node_id == int(node_id))[0]
    return int(idxs[0]) if idxs.size > 0 else None


def newick_node_position(
    graph,
    node_id: int,
    max_branch_length: float,
    time_scale: str | None = None,
) -> dict | None:
    """Return emitted local coordinates for a NewickTreeGraph node."""
    idx = newick_node_id_to_index(graph, node_id)
    if idx is None:
        return None
    return {
        "node_id": int(node_id),
        "x": float(graph.x[idx]),
        "y": float(normalized_y_to_scaled_y([graph.y[idx]], 0.0, max_branch_length, time_scale)[0]),
    }


def newick_edge_coordinates(
    graph,
    parent: int,
    child: int,
    max_branch_length: float,
    time_scale: str | None = None,
) -> dict | None:
    """Return emitted local coordinates for a NewickTreeGraph edge."""
    parent_pos = newick_node_position(graph, parent, max_branch_length, time_scale)
    child_pos = newick_node_position(graph, child, max_branch_length, time_scale)
    if parent_pos is None or child_pos is None:
        return None
    return {
        "parent": int(parent),
        "child": int(child),
        "parent_x": parent_pos["x"],
        "parent_y": parent_pos["y"],
        "child_x": child_pos["x"],
        "child_y": child_pos["y"],
    }
