"""Feature-service adapters backed only by lorax-csr-v3 sidecars."""

from __future__ import annotations

import numpy as np
import pyarrow as pa

from lorax.artifacts.csr_reader import CSRArtifactReader


def artifact_details(reader: CSRArtifactReader, data: dict) -> dict:
    is_phlag_newick = bool(reader.v2_sample_names())
    if not is_phlag_newick:
        reader.require_capability("details")
    result = {}
    tree_index = data.get("treeIndex")
    if tree_index is not None:
        genealogy = reader.tree_at_index(int(tree_index))
        tip_count = int(sum(genealogy.is_tip(int(node_id)) for node_id in genealogy.node_ids))
        tree = {
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
        if is_phlag_newick:
            tree.update({
                "num_tips": tip_count,
                "num_internal_nodes": len(genealogy.node_ids) - tip_count,
                "mutation_count": 0,
            })
        result["tree"] = tree

    node_value = data.get("node")
    if node_value is not None:
        node_id = int(node_value)
        if is_phlag_newick:
            if tree_index is None:
                raise ValueError("treeIndex is required for Phlag Newick node details")
            genealogy = reader.tree_at_index(int(tree_index))
            if not genealogy.has_node(node_id):
                raise KeyError(f"Node {node_id} is not in tree {tree_index}")
            sample_names = reader.v2_sample_names()
            is_tip = genealogy.is_tip(node_id)
            metadata = {}
            if is_tip and 0 <= node_id < len(sample_names):
                metadata["sample"] = sample_names[node_id]
            result["node"] = {
                "id": node_id,
                "time": genealogy.node_time(node_id),
                "population": -1,
                "individual": -1,
                "metadata": metadata,
                "node_type": "tip" if is_tip else "internal",
            }
            if data.get("comprehensive", False):
                result["mutations"] = []
            return result
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
    sample_names = reader.v2_sample_names()
    if sample_names:
        if key != "sample":
            raise CSRArtifactCapabilityError("metadata key " + str(key))
        values = sample_names
        sample_node_ids = list(range(len(values)))
        unique_values = values
        indices = np.arange(len(values), dtype=np.uint32)
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
