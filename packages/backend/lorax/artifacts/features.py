"""Feature-service adapters backed only by lorax-csr-v3 sidecars."""

from __future__ import annotations

import numpy as np
import pyarrow as pa

from lorax.artifacts.csr_reader import CSRArtifactReader


def artifact_details(reader: CSRArtifactReader, data: dict) -> dict:
    reader.require_capability("details")
    result = {}
    tree_index = data.get("treeIndex")
    if tree_index is not None:
        genealogy = reader.tree_at_index(int(tree_index))
        result["tree"] = {
            "interval": [genealogy.interval_left, genealogy.interval_right],
            "num_roots": len(genealogy.roots()),
            "num_nodes": len(genealogy.node_ids),
            "mutations": [
                {
                    "id": int(mutation_id),
                    "node": int(node_id),
                    "site_id": int(site_id),
                    "position": float(position),
                    "derived_state": derived,
                    "inherited_state": inherited,
                }
                for (
                    mutation_id,
                    node_id,
                    site_id,
                    position,
                    derived,
                    inherited,
                ) in zip(
                    genealogy.mutations.ids,
                    genealogy.mutations.node_ids,
                    genealogy.mutations.site_ids,
                    genealogy.mutations.positions,
                    genealogy.mutations.derived_states,
                    genealogy.mutations.inherited_states,
                )
            ],
        }

    node_value = data.get("node")
    if node_value is not None:
        node_id = int(node_value)
        node = reader.node_details(node_id)
        result["node"] = {
            key: node[key]
            for key in ("id", "time", "population", "individual", "metadata")
        }
        individual_id = node.get("individual", -1)
        if individual_id != -1:
            individual = reader.individual_details(individual_id)
            if not data.get("comprehensive", False):
                individual = {
                    "id": individual["id"],
                    "nodes": individual["nodes"],
                    "metadata": individual["metadata"],
                }
            elif not individual["location"]:
                individual["location"] = None
            result["individual"] = individual
        if data.get("comprehensive", False):
            population_id = node.get("population", -1)
            if population_id != -1:
                result["population"] = reader.population_details(population_id)
            mutations = reader.mutations_for_node(node_id)
            if tree_index is not None:
                left, right = reader.interval_at_index(int(tree_index))
                mutations = [
                    mutation
                    for mutation in mutations
                    if left <= mutation["position"] < right
                ]
            result["mutations"] = [
                {
                    "id": mutation["id"],
                    "site_id": mutation["site_id"],
                    "position": mutation["position"],
                    "ancestral_state": mutation["ancestral_state"],
                    "derived_state": mutation["derived_state"],
                    "time": (
                        None
                        if np.isnan(mutation["time"])
                        else mutation["time"]
                    ),
                    "parent_mutation": (
                        None
                        if mutation["parent_id"] == -1
                        else mutation["parent_id"]
                    ),
                    "metadata": mutation["metadata"],
                }
                for mutation in mutations
            ]
    return result


def artifact_mutation_search(
    reader: CSRArtifactReader,
    position: float,
    range_bp: float,
    offset: int,
    limit: int,
) -> dict:
    half_range = float(range_bp) // 2
    search_start = max(0.0, float(position) - half_range)
    search_end = min(reader.sequence_length, float(position) + half_range)
    reader.require_capability("mutations")
    positions = reader._mapped_index("mutation_positions")
    left = int(np.searchsorted(positions, search_start, side="left"))
    right = int(np.searchsorted(positions, search_end, side="left"))
    candidate_positions = np.asarray(positions[left:right], dtype=np.float64)
    order = np.argsort(
        np.abs(candidate_positions - float(position)),
        kind="stable",
    )
    offset = max(0, int(offset))
    limit = max(1, int(limit))
    selected_rows = order[offset : offset + limit] + left
    selected = [
        reader._mutation_result(
            reader._row_at("mutations", int(row_index))
        )
        for row_index in selected_rows
    ]
    for mutation in selected:
        tree_index = reader.tree_index_at_position(mutation["position"])
        interval_left, interval_right = reader.interval_at_index(tree_index)
        mutation["distance"] = int(abs(mutation["position"] - float(position)))
        mutation["tree_index"] = tree_index
        mutation["interval_left"] = interval_left
        mutation["interval_right"] = interval_right
    return {
        "mutations": selected,
        "total_count": len(order),
        "has_more": offset + limit < len(order),
        "search_start": int(search_start),
        "search_end": int(search_end),
    }


def artifact_metadata_array(
    reader: CSRArtifactReader,
    key: str,
) -> dict:
    reader.require_capability("metadata")
    sample_rows = sorted(
        reader._sidecar_table("sample_names").to_pylist(),
        key=lambda row: int(row["node_id"]),
    )
    sample_node_ids = [int(row["node_id"]) for row in sample_rows]
    if key == "sample":
        values = [str(row["display_name"]) for row in sample_rows]
    else:
        value_map = reader.metadata_values(key)["sample_values"]
        values = [str(value_map.get(node_id, "")) for node_id in sample_node_ids]

    unique_values: list[str] = []
    value_to_index: dict[str, int] = {}
    indices = np.empty(len(values), dtype=np.uint32)
    for offset, value in enumerate(values):
        if value not in value_to_index:
            value_to_index[value] = len(unique_values)
            unique_values.append(value)
        indices[offset] = value_to_index[value]

    table = pa.table({"idx": pa.array(indices, type=pa.uint32())})
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return {
        "key": key,
        "unique_values": unique_values,
        "sample_node_ids": sample_node_ids,
        "arrow_buffer": sink.getvalue().to_pybytes(),
    }


__all__ = [
    "artifact_details",
    "artifact_metadata_array",
    "artifact_mutation_search",
]
