"""Exact linear-time minimum-variance rooting for compact genealogies."""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

import numpy as np

from lorax.tree_graph.tree_graph import _ladderize_children_and_compute_x

if TYPE_CHECKING:
    from lorax.artifacts.csr_reader import GenealogyCSR


class MinVarRootingError(ValueError):
    """Raised when a compact genealogy cannot be rooted safely."""


def _readonly(values: np.ndarray) -> np.ndarray:
    values.setflags(write=False)
    return values


def _validate_and_build_adjacency(
    genealogy: "GenealogyCSR",
) -> tuple[list[list[tuple[int, float]]], np.ndarray]:
    node_ids = np.asarray(genealogy.node_ids, dtype=np.int32)
    parent_ids = np.asarray(genealogy.parent_ids, dtype=np.int32)
    node_times = np.asarray(genealogy.node_times, dtype=np.float64)
    node_count = len(node_ids)
    if node_count < 2:
        raise MinVarRootingError("MinVar rooting requires at least two nodes")
    if len(parent_ids) != node_count or len(node_times) != node_count:
        raise MinVarRootingError("Genealogy node arrays have inconsistent lengths")
    if not np.all(np.isfinite(node_times)):
        raise MinVarRootingError("Genealogy contains a non-finite branch height")

    roots = np.flatnonzero(parent_ids == -1)
    if len(roots) != 1:
        raise MinVarRootingError(
            f"MinVar rooting requires one source root; found {len(roots)}"
        )

    adjacency: list[list[tuple[int, float]]] = [[] for _ in range(node_count)]
    child_locals = np.flatnonzero(parent_ids != -1).astype(np.int32)
    edge_count = len(child_locals)
    local_by_id = {int(node_id): local for local, node_id in enumerate(node_ids)}
    parent_locals = np.empty(edge_count, dtype=np.int32)
    for edge_offset, child_local_value in enumerate(child_locals):
        child_local = int(child_local_value)
        parent_id = int(parent_ids[child_local])
        parent_local = local_by_id.get(parent_id)
        if parent_local is None:
            raise MinVarRootingError(
                f"Node {int(node_ids[child_local])} has an unknown parent {parent_id}"
            )
        parent_locals[edge_offset] = parent_local
    deltas = node_times[parent_locals] - node_times[child_locals]
    tolerances = 1e-12 * np.maximum.reduce(
        (
            np.ones(edge_count, dtype=np.float64),
            np.abs(node_times[parent_locals]),
            np.abs(node_times[child_locals]),
        )
    )
    if np.any(deltas < -tolerances):
        invalid_offset = int(np.flatnonzero(deltas < -tolerances)[0])
        child_local = int(child_locals[invalid_offset])
        parent_local = int(parent_locals[invalid_offset])
        raise MinVarRootingError(
            f"Edge {int(node_ids[parent_local])}->{int(node_ids[child_local])} "
            "has a negative branch length"
        )
    lengths = np.maximum(0.0, deltas)
    for child_local, parent_local, length in zip(
        child_locals,
        parent_locals,
        lengths,
    ):
        child_local = int(child_local)
        parent_local = int(parent_local)
        length = float(length)
        if parent_local == child_local:
            raise MinVarRootingError(
                f"Node {int(node_ids[child_local])} cannot be its own parent"
            )
        adjacency[parent_local].append((child_local, length))
        adjacency[child_local].append((parent_local, length))

    if edge_count != node_count - 1:
        raise MinVarRootingError(
            f"Genealogy has {edge_count} edges for {node_count} nodes"
        )
    original_child_counts = np.diff(
        np.asarray(genealogy.child_offsets, dtype=np.int32)
    )
    if len(original_child_counts) != node_count:
        raise MinVarRootingError("Genealogy child offsets have an invalid length")
    tip_mask = original_child_counts == 0
    if int(np.count_nonzero(tip_mask)) < 2:
        raise MinVarRootingError("MinVar rooting requires at least two tips")
    for local in np.flatnonzero(tip_mask):
        if len(adjacency[int(local)]) != 1:
            raise MinVarRootingError(
                f"Tip {int(node_ids[local])} does not have degree one"
            )
    return adjacency, tip_mask


def _traversal(
    adjacency: list[list[tuple[int, float]]],
    root: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[int]]:
    node_count = len(adjacency)
    parent = np.full(node_count, -2, dtype=np.int32)
    parent_length = np.zeros(node_count, dtype=np.float64)
    distance = np.zeros(node_count, dtype=np.float64)
    parent[root] = -1
    order: list[int] = []
    stack = [root]
    while stack:
        node = stack.pop()
        order.append(node)
        for neighbor, length in reversed(adjacency[node]):
            if neighbor == int(parent[node]):
                continue
            if parent[neighbor] != -2:
                raise MinVarRootingError("Genealogy topology contains a cycle")
            parent[neighbor] = node
            parent_length[neighbor] = length
            distance[neighbor] = distance[node] + length
            stack.append(neighbor)
    if len(order) != node_count:
        raise MinVarRootingError("Genealogy topology is disconnected")
    return parent, parent_length, distance, order


def _minimum_variance_edge(
    adjacency: list[list[tuple[int, float]]],
    node_ids: np.ndarray,
    tip_mask: np.ndarray,
) -> tuple[int, int, float, float]:
    """Return ``(u, v, x, length)`` with x measured from local node u."""
    base = 0
    parent, parent_length, distance, order = _traversal(adjacency, base)
    tip_count = int(np.count_nonzero(tip_mask))
    leaf_counts = tip_mask.astype(np.int64)
    subtree_distance_sums = np.zeros(len(adjacency), dtype=np.float64)
    for node in reversed(order):
        parent_node = int(parent[node])
        if parent_node == -1:
            continue
        length = float(parent_length[node])
        leaf_counts[parent_node] += leaf_counts[node]
        subtree_distance_sums[parent_node] += (
            subtree_distance_sums[node] + leaf_counts[node] * length
        )
    if int(leaf_counts[base]) != tip_count:
        raise MinVarRootingError("Genealogy tip traversal is inconsistent")

    tip_distances = distance[tip_mask]
    distance_sums = np.zeros(len(adjacency), dtype=np.float64)
    squared_distance_sums = np.zeros(len(adjacency), dtype=np.float64)
    distance_sums[base] = float(np.sum(tip_distances, dtype=np.float64))
    squared_distance_sums[base] = float(
        np.sum(tip_distances * tip_distances, dtype=np.float64)
    )

    for node in order[1:]:
        parent_node = int(parent[node])
        length = float(parent_length[node])
        inside_count = int(leaf_counts[node])
        inside_sum = float(
            subtree_distance_sums[node] + inside_count * length
        )
        outside_sum = float(distance_sums[parent_node] - inside_sum)
        distance_sums[node] = (
            distance_sums[parent_node]
            + (tip_count - 2 * inside_count) * length
        )
        squared_distance_sums[node] = (
            squared_distance_sums[parent_node]
            + 2.0 * length * (outside_sum - inside_sum)
            + tip_count * length * length
        )

    best_variance = float("inf")
    best: tuple[int, int, float, float] | None = None
    best_edge_key: tuple[int, int] | None = None
    n_float = float(tip_count)
    for node in order[1:]:
        u = int(parent[node])
        v = node
        length = float(parent_length[node])
        edge_key = tuple(sorted((int(node_ids[u]), int(node_ids[v]))))
        inside_count = int(leaf_counts[v])
        inside_sum = float(
            subtree_distance_sums[v] + inside_count * length
        )
        outside_sum = float(distance_sums[u] - inside_sum)
        slope_sum = tip_count - 2 * inside_count
        quadratic = 1.0 - (float(slope_sum) / n_float) ** 2
        linear = (
            2.0 * (outside_sum - inside_sum) / n_float
            - 2.0 * distance_sums[u] * slope_sum / (n_float * n_float)
        )
        if length == 0.0 or quadratic <= 0.0:
            offset = 0.0
        else:
            offset = min(length, max(0.0, -linear / (2.0 * quadratic)))

        sum_at_offset = distance_sums[u] + slope_sum * offset
        squared_sum_at_offset = (
            squared_distance_sums[u]
            + 2.0 * offset * (outside_sum - inside_sum)
            + tip_count * offset * offset
        )
        variance = (
            squared_sum_at_offset / n_float
            - (sum_at_offset / n_float) ** 2
        )
        variance = max(0.0, float(variance))
        tolerance = 1e-12 * max(1.0, abs(best_variance), abs(variance))
        if (
            best is None
            or variance < best_variance - tolerance
            or (
                abs(variance - best_variance) <= tolerance
                and best_edge_key is not None
                and edge_key < best_edge_key
            )
        ):
            best_variance = variance
            best = (u, v, offset, length)
            best_edge_key = edge_key

    if best is None:
        raise MinVarRootingError("Genealogy contains no edge on which to place a root")
    return best


def reroot_minvar(genealogy: "GenealogyCSR") -> "GenealogyCSR":
    """Return an immutable exact MinVar-rooted copy of ``genealogy``."""
    adjacency, tip_mask = _validate_and_build_adjacency(genealogy)
    source_node_ids = np.asarray(genealogy.node_ids, dtype=np.int32)
    u, v, offset, edge_length = _minimum_variance_edge(
        adjacency,
        source_node_ids,
        tip_mask,
    )
    endpoint_tolerance = 1e-12 * max(1.0, edge_length)
    root_at_u = offset <= endpoint_tolerance
    root_at_v = edge_length - offset <= endpoint_tolerance
    # A biological tip must remain a leaf in the returned rooted topology. If
    # MinVar lands exactly on one, represent that same position by splitting
    # its incident edge with a zero-length root branch.
    root_endpoint_is_tip = (
        (root_at_u and bool(tip_mask[u]))
        or (root_at_v and bool(tip_mask[v]))
    )
    if root_at_u and not root_endpoint_is_tip:
        root_local = u
    elif root_at_v and not root_endpoint_is_tip:
        root_local = v
    else:
        max_node_id = int(source_node_ids[-1])
        if max_node_id >= np.iinfo(np.int32).max:
            raise MinVarRootingError("No int32 node ID is available for the MinVar root")
        root_local = len(adjacency)
        adjacency.append([])
        adjacency[u] = [(n, w) for n, w in adjacency[u] if n != v]
        adjacency[v] = [(n, w) for n, w in adjacency[v] if n != u]
        adjacency[u].append((root_local, offset))
        adjacency[v].append((root_local, edge_length - offset))
        adjacency[root_local] = [
            (u, offset),
            (v, edge_length - offset),
        ]
        source_node_ids = np.append(
            source_node_ids,
            np.int32(max_node_id + 1),
        )
        tip_mask = np.append(tip_mask, False)
    parent_local, _parent_lengths, root_distances, order = _traversal(
        adjacency,
        root_local,
    )
    tip_distances = root_distances[tip_mask]
    tree_height = float(np.max(tip_distances))
    node_heights_local = np.maximum(0.0, tree_height - root_distances)

    node_count = len(source_node_ids)
    sorted_local = np.argsort(source_node_ids, kind="stable")
    node_ids = source_node_ids[sorted_local].astype(np.int32, copy=True)
    output_offset_by_local = np.empty(node_count, dtype=np.int32)
    output_offset_by_local[sorted_local] = np.arange(node_count, dtype=np.int32)
    parent_ids = np.full(node_count, -1, dtype=np.int32)
    node_times = np.empty(node_count, dtype=np.float64)
    source_flags = np.asarray(genealogy.node_flags, dtype=np.uint32)
    if node_count > len(source_flags):
        source_flags = np.append(source_flags, np.uint32(0))
    node_flags = np.empty(node_count, dtype=np.uint32)
    for local in range(node_count):
        output_offset = int(output_offset_by_local[local])
        parent_node = int(parent_local[local])
        if parent_node != -1:
            parent_ids[output_offset] = int(source_node_ids[parent_node])
        node_times[output_offset] = node_heights_local[local]
        node_flags[output_offset] = source_flags[local]

    children_by_local: list[list[int]] = [[] for _ in range(node_count)]
    for local in order:
        parent_node = int(parent_local[local])
        if parent_node != -1:
            children_by_local[parent_node].append(local)
    child_offsets = np.zeros(node_count + 1, dtype=np.int32)
    child_local_values: list[int] = []
    for output_offset, local in enumerate(sorted_local):
        children = sorted(
            children_by_local[int(local)],
            key=lambda child: int(source_node_ids[child]),
        )
        child_local_values.extend(
            int(output_offset_by_local[child]) for child in children
        )
        child_offsets[output_offset + 1] = len(child_local_values)
    child_local = np.asarray(child_local_values, dtype=np.int32)
    roots_local = np.flatnonzero(parent_ids == -1).astype(np.int32)
    child_local, layout_x, _tip_counts, rendered_tip_count = (
        _ladderize_children_and_compute_x(
            child_offsets,
            child_local,
            roots_local,
            node_count,
        )
    )
    if rendered_tip_count != int(np.count_nonzero(tip_mask)):
        raise MinVarRootingError("Rerooted genealogy changed the number of tips")
    if rendered_tip_count > 1:
        layout_x /= np.float32(rendered_tip_count - 1)
    child_node_ids = node_ids[child_local].astype(np.int32, copy=True)

    return replace(
        genealogy,
        node_ids=_readonly(node_ids),
        parent_ids=_readonly(parent_ids),
        child_offsets=_readonly(child_offsets),
        child_node_ids=_readonly(child_node_ids),
        node_times=_readonly(node_times),
        node_flags=_readonly(node_flags),
        layout_x=_readonly(np.asarray(layout_x, dtype=np.float32)),
    )


__all__ = ["MinVarRootingError", "reroot_minvar"]
