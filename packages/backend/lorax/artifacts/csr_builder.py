"""Build versioned, random-access CSR genealogy artifacts.

The builder is intentionally separate from the render-v1 artifact builder. It
loads a source TreeSequence in the preprocessing process, emits one Arrow
record batch per unsparsified genealogy, and atomically publishes an artifact
that can later be opened without touching the source file.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import math
import os
import shutil
import time
import uuid
from pathlib import Path
from collections import defaultdict
from typing import Any, Callable, Iterable

import numpy as np
import pyarrow as pa
import tskit
import tszip

from lorax.loaders.tskit_loader import get_config_tskit
from lorax.tree_graph.tree_graph import _compute_x_postorder
from lorax.utils import ensure_json_dict, make_json_serializable

CSR_ARTIFACT_V2_SCHEMA_VERSION = 2
CSR_ARTIFACT_V2_FORMAT = "lorax-csr-v2"
CSR_ARTIFACT_SCHEMA_VERSION = 3
CSR_ARTIFACT_FORMAT = "lorax-csr-v3"
DEFAULT_TARGET_SHARD_MB = 48
SUPPORTED_COMPRESSIONS = {"zstd", "lz4", "none"}
SIDECAR_BATCH_ROWS = 65_536

ProgressCallback = Callable[[dict[str, Any]], None]

MUTATION_TYPE = pa.struct(
    [
        pa.field("id", pa.int32()),
        pa.field("site_id", pa.int32()),
        pa.field("node_id", pa.int32()),
        pa.field("parent_id", pa.int32()),
        pa.field("position", pa.float64()),
        pa.field("time", pa.float64()),
        pa.field("ancestral_state", pa.string()),
        pa.field("derived_state", pa.string()),
        pa.field("inherited_state", pa.string()),
    ]
)

GENEALOGY_SCHEMA = pa.schema(
    [
        pa.field("tree_index", pa.int64()),
        pa.field("interval_left", pa.float64()),
        pa.field("interval_right", pa.float64()),
        pa.field("node_ids", pa.list_(pa.int32())),
        pa.field("parent_ids", pa.list_(pa.int32())),
        pa.field("child_offsets", pa.list_(pa.int32())),
        pa.field("child_node_ids", pa.list_(pa.int32())),
        pa.field("node_times", pa.list_(pa.float64())),
        pa.field("node_flags", pa.list_(pa.uint32())),
        pa.field("layout_x", pa.list_(pa.float32())),
        pa.field("mutations", pa.list_(MUTATION_TYPE)),
    ]
)

SHARD_INDEX_SCHEMA = pa.schema(
    [
        pa.field("shard_id", pa.int32()),
        pa.field("first_tree", pa.int64()),
        pa.field("last_tree_exclusive", pa.int64()),
        pa.field("batch_count", pa.int32()),
        pa.field("name", pa.string()),
        pa.field("size_bytes", pa.int64()),
        pa.field("sha256", pa.string()),
    ]
)

NODE_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int32()),
        pa.field("flags", pa.uint32()),
        pa.field("time", pa.float64()),
        pa.field("population", pa.int32()),
        pa.field("individual", pa.int32()),
        pa.field("metadata_json", pa.string()),
        pa.field("metadata_raw", pa.binary()),
    ]
)

SITE_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int32()),
        pa.field("position", pa.float64()),
        pa.field("ancestral_state", pa.string()),
        pa.field("metadata_json", pa.string()),
        pa.field("metadata_raw", pa.binary()),
    ]
)

INDIVIDUAL_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int32()),
        pa.field("flags", pa.uint32()),
        pa.field("location", pa.list_(pa.float64())),
        pa.field("parents", pa.list_(pa.int32())),
        pa.field("nodes", pa.list_(pa.int32())),
        pa.field("metadata_json", pa.string()),
        pa.field("metadata_raw", pa.binary()),
    ]
)

POPULATION_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int32()),
        pa.field("metadata_json", pa.string()),
        pa.field("metadata_raw", pa.binary()),
    ]
)

GLOBAL_MUTATION_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int32()),
        pa.field("site_id", pa.int32()),
        pa.field("node_id", pa.int32()),
        pa.field("parent_id", pa.int32()),
        pa.field("position", pa.float64()),
        pa.field("time", pa.float64()),
        pa.field("ancestral_state", pa.string()),
        pa.field("derived_state", pa.string()),
        pa.field("inherited_state", pa.string()),
        pa.field("metadata_json", pa.string()),
        pa.field("metadata_raw", pa.binary()),
    ]
)

SAMPLE_NAME_SCHEMA = pa.schema(
    [
        pa.field("normalized_name", pa.string()),
        pa.field("display_name", pa.string()),
        pa.field("node_id", pa.int32()),
    ]
)

METADATA_SAMPLE_SCHEMA = pa.schema(
    [
        pa.field("source", pa.dictionary(pa.int32(), pa.string())),
        pa.field("key", pa.dictionary(pa.int32(), pa.string())),
        pa.field("value", pa.dictionary(pa.int32(), pa.string())),
        pa.field("sample_node_ids", pa.list_(pa.int32())),
        pa.field("sample_names", pa.list_(pa.string())),
    ]
)

NODE_TREE_RANGE_SCHEMA = pa.schema(
    [
        pa.field("node_id", pa.int32()),
        pa.field("first_tree", pa.int64()),
        pa.field("last_tree_exclusive", pa.int64()),
    ]
)


class CSRArtifactBuildError(RuntimeError):
    """Raised when a CSR artifact cannot be built safely."""


def _builder_version() -> str:
    try:
        return importlib.metadata.version("lorax-arg")
    except importlib.metadata.PackageNotFoundError:
        return "0.1.7"


def source_fingerprint(file_path: str | Path) -> str:
    """Return the source content hash recorded in the artifact manifest."""
    digest = hashlib.sha256()
    with Path(file_path).open("rb") as source:
        while chunk := source.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def artifact_path_for_source(source: str | Path) -> Path:
    """Return the deterministic CSR artifact directory beside a source file."""
    source_path = Path(source).expanduser().resolve()
    return Path(f"{source_path}.artifact")


def _checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(
        json.dumps(payload, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    os.replace(temporary, path)


def _write_npy_atomic(path: Path, values: np.ndarray) -> None:
    available = shutil.disk_usage(path.parent).free
    if int(values.nbytes) > available:
        raise CSRArtifactBuildError(
            f"Index {path.name} needs approximately {values.nbytes} bytes, "
            f"but only {available} bytes are available"
        )
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("wb") as sink:
            np.save(sink, values, allow_pickle=False)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _ipc_write_options(compression: str) -> pa.ipc.IpcWriteOptions:
    codec = None if compression == "none" else compression
    return pa.ipc.IpcWriteOptions(compression=codec)


def _write_arrow_table_atomic(
    path: Path,
    table: pa.Table,
    *,
    compression: str,
) -> dict[str, Any]:
    available = shutil.disk_usage(path.parent).free
    if int(table.nbytes) > available:
        raise CSRArtifactBuildError(
            f"Sidecar {path.name} needs approximately {table.nbytes} bytes, "
            f"but only {available} bytes are available"
        )
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with pa.OSFile(str(temporary), "wb") as sink:
            with pa.ipc.new_file(
                sink,
                table.schema,
                options=_ipc_write_options(compression),
            ) as writer:
                writer.write_table(table, max_chunksize=SIDECAR_BATCH_ROWS)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return {
        "name": path.name,
        "size_bytes": path.stat().st_size,
        "sha256": _checksum(path),
        "rows": table.num_rows,
        "batch_rows": SIDECAR_BATCH_ROWS,
        "batch_count": (
            int(math.ceil(table.num_rows / SIDECAR_BATCH_ROWS))
            if table.num_rows
            else 0
        ),
    }


def _file_metadata(path: Path, *, rows: int | None = None) -> dict[str, Any]:
    metadata = {
        "name": path.name,
        "size_bytes": path.stat().st_size,
        "sha256": _checksum(path),
    }
    if rows is not None:
        metadata["rows"] = int(rows)
    return metadata


def _metadata_payload(
    value: Any,
    *,
    raw_metadata: bytes | None = None,
) -> tuple[str, bytes]:
    """Return deterministic JSON plus bytes suitable for lossless round trips."""
    if value is None:
        return "null", bytes(raw_metadata or b"")
    if isinstance(value, bytes):
        raw = bytes(value) if raw_metadata is None else bytes(raw_metadata)
        if not raw:
            return "null", raw
        try:
            decoded = ensure_json_dict(raw)
        except Exception:
            decoded = {"__raw_hex__": raw.hex()}
    else:
        try:
            decoded = make_json_serializable(value)
        except Exception:
            decoded = str(value)
        raw = (
            bytes(raw_metadata)
            if raw_metadata is not None
            else json.dumps(
                decoded,
                sort_keys=True,
                separators=(",", ":"),
                default=str,
            ).encode("utf-8")
        )
    try:
        normalized = json.dumps(
            make_json_serializable(decoded),
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
    except Exception:
        normalized = json.dumps(str(decoded))
    return normalized, raw


def _metadata_dict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    try:
        decoded = ensure_json_dict(value)
    except Exception:
        decoded = value if isinstance(value, dict) else {}
    return decoded if isinstance(decoded, dict) else {}


def _metadata_index_value(value: Any) -> str:
    if isinstance(value, (dict, list, tuple)):
        # Preserve the strings already exposed by Lorax's metadata filters.
        return repr(make_json_serializable(value))
    return str(value)


def _raw_metadata_at(table: Any, row_id: int) -> bytes:
    """Return the exact encoded metadata bytes from a tskit table row."""
    offsets = table.metadata_offset
    start = int(offsets[int(row_id)])
    stop = int(offsets[int(row_id) + 1])
    return bytes(np.asarray(table.metadata[start:stop], dtype=np.int8))


def _load_source(source: Path) -> tskit.TreeSequence:
    if source.suffix == ".trees":
        return tskit.load(str(source))
    if source.suffix == ".tsz":
        return tszip.load(str(source))
    raise ValueError(
        f"Unsupported source {source}; expected a .trees or .tsz TreeSequence"
    )


def _list_array(values: np.ndarray, value_type: pa.DataType) -> pa.Array:
    return pa.array([values], type=pa.list_(value_type))


def _compact_topology(
    tree: tskit.Tree,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return compact node, parent, child CSR, and x-layout arrays."""
    node_ids = np.fromiter(tree.nodes(), dtype=np.int32)
    node_ids.sort()
    num_nodes = len(node_ids)
    if num_nodes == 0:
        empty_i32 = np.empty(0, dtype=np.int32)
        return (
            empty_i32,
            empty_i32.copy(),
            np.zeros(1, dtype=np.int32),
            empty_i32.copy(),
            np.empty(0, dtype=np.float32),
        )

    # Indexing the low-level parent array avoids a Python call per node. The
    # resulting persisted arrays remain compact and contain only this tree.
    parent_ids = np.asarray(tree.parent_array[node_ids], dtype=np.int32).copy()
    child_mask = parent_ids != tskit.NULL
    child_local = np.flatnonzero(child_mask).astype(np.int32)
    parent_node_ids = parent_ids[child_mask]
    parent_local = np.searchsorted(node_ids, parent_node_ids).astype(np.int32)
    if (
        np.any(parent_local >= num_nodes)
        or np.any(node_ids[parent_local] != parent_node_ids)
    ):
        raise CSRArtifactBuildError(
            f"Tree {tree.index} contains a parent outside its compact node set"
        )

    child_counts = np.bincount(parent_local, minlength=num_nodes).astype(np.int32)
    child_offsets = np.empty(num_nodes + 1, dtype=np.int32)
    child_offsets[0] = 0
    np.cumsum(child_counts, out=child_offsets[1:])
    order = np.argsort(parent_local, kind="stable")
    ordered_child_local = child_local[order]
    child_node_ids = node_ids[ordered_child_local].astype(np.int32, copy=True)

    roots_local = np.flatnonzero(parent_ids == tskit.NULL).astype(np.int32)
    layout_x, tip_count = _compute_x_postorder(
        child_offsets,
        ordered_child_local,
        roots_local,
        num_nodes,
    )
    if tip_count > 1:
        layout_x /= np.float32(tip_count - 1)
    return node_ids, parent_ids, child_offsets, child_node_ids, layout_x


def _mutation_rows(
    tree: tskit.Tree, tree_sequence: tskit.TreeSequence
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for site in tree.sites():
        for mutation in site.mutations:
            parent_id = int(mutation.parent)
            inherited_state = (
                site.ancestral_state
                if parent_id == tskit.NULL
                else tree_sequence.mutation(parent_id).derived_state
            )
            rows.append(
                {
                    "id": int(mutation.id),
                    "site_id": int(site.id),
                    "node_id": int(mutation.node),
                    "parent_id": parent_id,
                    "position": float(site.position),
                    "time": float(mutation.time),
                    "ancestral_state": site.ancestral_state,
                    "derived_state": mutation.derived_state,
                    "inherited_state": inherited_state,
                }
            )
    return rows


def genealogy_record_batch(
    tree: tskit.Tree, tree_sequence: tskit.TreeSequence
) -> pa.RecordBatch:
    """Convert the current tskit tree into one compact CSR record batch."""
    (
        node_ids,
        parent_ids,
        child_offsets,
        child_node_ids,
        layout_x,
    ) = _compact_topology(tree)
    node_table = tree_sequence.tables.nodes
    node_times = np.asarray(node_table.time[node_ids], dtype=np.float64)
    node_flags = np.asarray(node_table.flags[node_ids], dtype=np.uint32)
    mutations = _mutation_rows(tree, tree_sequence)
    interval = tree.interval

    arrays = [
        pa.array([int(tree.index)], type=pa.int64()),
        pa.array([float(interval.left)], type=pa.float64()),
        pa.array([float(interval.right)], type=pa.float64()),
        _list_array(node_ids, pa.int32()),
        _list_array(parent_ids, pa.int32()),
        _list_array(child_offsets, pa.int32()),
        _list_array(child_node_ids, pa.int32()),
        _list_array(node_times, pa.float64()),
        _list_array(node_flags, pa.uint32()),
        _list_array(layout_x, pa.float32()),
        pa.array([mutations], type=pa.list_(MUTATION_TYPE)),
    ]
    return pa.RecordBatch.from_arrays(arrays, schema=GENEALOGY_SCHEMA)


def _write_shard(
    staging: Path,
    shard_id: int,
    records: Iterable[pa.RecordBatch],
    compression: str,
) -> dict[str, Any]:
    records = list(records)
    if not records:
        raise ValueError("Cannot write an empty CSR shard")
    first_tree = int(records[0].column(0)[0].as_py())
    last_tree = int(records[-1].column(0)[0].as_py()) + 1
    name = f"csr-{shard_id:06d}.arrow"
    destination = staging / name
    partial = staging / f".{name}.{uuid.uuid4().hex}.partial"
    options = pa.ipc.IpcWriteOptions(
        compression=None if compression == "none" else compression
    )
    try:
        with pa.OSFile(str(partial), "wb") as sink:
            with pa.ipc.new_file(sink, GENEALOGY_SCHEMA, options=options) as writer:
                for record in records:
                    writer.write_batch(record)
        os.replace(partial, destination)
    finally:
        partial.unlink(missing_ok=True)
    return {
        "shard_id": shard_id,
        "first_tree": first_tree,
        "last_tree_exclusive": last_tree,
        "batch_count": len(records),
        "name": name,
        "size_bytes": destination.stat().st_size,
        "sha256": _checksum(destination),
    }


def _write_breakpoints(path: Path, tree_sequence: tskit.TreeSequence) -> None:
    breakpoints = np.fromiter(
        tree_sequence.breakpoints(),
        dtype=np.float64,
        count=int(tree_sequence.num_trees) + 1,
    )
    with path.open("wb") as output:
        np.save(output, breakpoints, allow_pickle=False)


def _write_shard_index(path: Path, shards: list[dict[str, Any]]) -> None:
    table = pa.Table.from_pylist(shards, schema=SHARD_INDEX_SCHEMA)
    partial = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with pa.OSFile(str(partial), "wb") as sink:
            with pa.ipc.new_file(sink, SHARD_INDEX_SCHEMA) as writer:
                writer.write_table(table)
        os.replace(partial, path)
    finally:
        partial.unlink(missing_ok=True)


def _table_from_rows(
    rows: list[dict[str, Any]],
    schema: pa.Schema,
) -> pa.Table:
    if rows:
        return pa.Table.from_pylist(rows, schema=schema)
    return pa.Table.from_batches([], schema=schema)


def _build_node_rows(
    tree_sequence: tskit.TreeSequence,
) -> list[dict[str, Any]]:
    rows = []
    table = tree_sequence.tables.nodes
    for node in tree_sequence.nodes():
        metadata_json, metadata_raw = _metadata_payload(
            node.metadata,
            raw_metadata=_raw_metadata_at(table, node.id),
        )
        rows.append(
            {
                "id": int(node.id),
                "flags": int(node.flags),
                "time": float(node.time),
                "population": int(node.population),
                "individual": int(node.individual),
                "metadata_json": metadata_json,
                "metadata_raw": metadata_raw,
            }
        )
    return rows


def _build_site_rows(
    tree_sequence: tskit.TreeSequence,
) -> list[dict[str, Any]]:
    rows = []
    table = tree_sequence.tables.sites
    for site in tree_sequence.sites():
        metadata_json, metadata_raw = _metadata_payload(
            site.metadata,
            raw_metadata=_raw_metadata_at(table, site.id),
        )
        rows.append(
            {
                "id": int(site.id),
                "position": float(site.position),
                "ancestral_state": site.ancestral_state,
                "metadata_json": metadata_json,
                "metadata_raw": metadata_raw,
            }
        )
    return rows


def _build_individual_rows(
    tree_sequence: tskit.TreeSequence,
) -> list[dict[str, Any]]:
    rows = []
    table = tree_sequence.tables.individuals
    for individual in tree_sequence.individuals():
        metadata_json, metadata_raw = _metadata_payload(
            individual.metadata,
            raw_metadata=_raw_metadata_at(table, individual.id),
        )
        rows.append(
            {
                "id": int(individual.id),
                "flags": int(individual.flags),
                "location": np.asarray(individual.location, dtype=np.float64),
                "parents": np.asarray(individual.parents, dtype=np.int32),
                "nodes": np.asarray(individual.nodes, dtype=np.int32),
                "metadata_json": metadata_json,
                "metadata_raw": metadata_raw,
            }
        )
    return rows


def _build_population_rows(
    tree_sequence: tskit.TreeSequence,
) -> list[dict[str, Any]]:
    rows = []
    table = tree_sequence.tables.populations
    for population in tree_sequence.populations():
        metadata_json, metadata_raw = _metadata_payload(
            population.metadata,
            raw_metadata=_raw_metadata_at(table, population.id),
        )
        rows.append(
            {
                "id": int(population.id),
                "metadata_json": metadata_json,
                "metadata_raw": metadata_raw,
            }
        )
    return rows


def _build_global_mutation_rows(
    tree_sequence: tskit.TreeSequence,
) -> list[dict[str, Any]]:
    rows = []
    table = tree_sequence.tables.mutations
    for mutation in tree_sequence.mutations():
        site = tree_sequence.site(int(mutation.site))
        parent_id = int(mutation.parent)
        inherited_state = (
            site.ancestral_state
            if parent_id == tskit.NULL
            else tree_sequence.mutation(parent_id).derived_state
        )
        metadata_json, metadata_raw = _metadata_payload(
            mutation.metadata,
            raw_metadata=_raw_metadata_at(table, mutation.id),
        )
        rows.append(
            {
                "id": int(mutation.id),
                "site_id": int(site.id),
                "node_id": int(mutation.node),
                "parent_id": parent_id,
                "position": float(site.position),
                "time": float(mutation.time),
                "ancestral_state": site.ancestral_state,
                "derived_state": mutation.derived_state,
                "inherited_state": inherited_state,
                "metadata_json": metadata_json,
                "metadata_raw": metadata_raw,
            }
        )
    rows.sort(key=lambda row: (row["position"], row["id"]))
    return rows


def _sample_metadata_sources(
    tree_sequence: tskit.TreeSequence,
    node_id: int,
) -> list[tuple[str, dict[str, Any]]]:
    node = tree_sequence.node(node_id)
    sources = [("node", _metadata_dict(node.metadata))]
    if node.individual != tskit.NULL:
        sources.append(
            (
                "individual",
                _metadata_dict(tree_sequence.individual(node.individual).metadata),
            )
        )
    if node.population != tskit.NULL:
        sources.append(
            (
                "population",
                _metadata_dict(tree_sequence.population(node.population).metadata),
            )
        )
    return sources


def _build_sample_indexes(
    tree_sequence: tskit.TreeSequence,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    name_rows: list[dict[str, Any]] = []
    grouped: dict[
        tuple[str, str, str],
        tuple[list[int], list[str]],
    ] = {}
    for raw_node_id in tree_sequence.samples():
        node_id = int(raw_node_id)
        sources = _sample_metadata_sources(tree_sequence, node_id)
        node_metadata = next(
            metadata for source, metadata in sources if source == "node"
        )
        display_name = str(node_metadata.get("name", node_id))
        name_rows.append(
            {
                "normalized_name": display_name.casefold(),
                "display_name": display_name,
                "node_id": node_id,
            }
        )
        for source, metadata in sources:
            for key, value in metadata.items():
                index_key = (source, str(key), _metadata_index_value(value))
                node_ids, sample_names = grouped.setdefault(index_key, ([], []))
                node_ids.append(node_id)
                sample_names.append(display_name)
    name_rows.sort(key=lambda row: (row["normalized_name"], row["node_id"]))
    metadata_rows = [
        {
            "source": source,
            "key": key,
            "value": value,
            "sample_node_ids": np.asarray(node_ids, dtype=np.int32),
            "sample_names": sample_names,
        }
        for (source, key, value), (node_ids, sample_names) in sorted(
            grouped.items()
        )
    ]
    return name_rows, metadata_rows


def _build_node_tree_ranges(
    tree_sequence: tskit.TreeSequence,
) -> list[dict[str, Any]]:
    """Build run-length encoded node membership using the sequential iterator."""
    open_starts: dict[int, int] = {}
    previous_nodes: set[int] = set()
    ranges: list[dict[str, Any]] = []
    for tree in tree_sequence.trees():
        current_nodes = {int(node_id) for node_id in tree.nodes()}
        tree_index = int(tree.index)
        for node_id in current_nodes - previous_nodes:
            open_starts[node_id] = tree_index
        for node_id in previous_nodes - current_nodes:
            ranges.append(
                {
                    "node_id": node_id,
                    "first_tree": open_starts.pop(node_id),
                    "last_tree_exclusive": tree_index,
                }
            )
        previous_nodes = current_nodes
    for node_id in previous_nodes:
        ranges.append(
            {
                "node_id": node_id,
                "first_tree": open_starts[node_id],
                "last_tree_exclusive": int(tree_sequence.num_trees),
            }
        )
    ranges.sort(key=lambda row: (row["node_id"], row["first_tree"]))
    return ranges


def _write_v3_sidecars(
    staging: Path,
    tree_sequence: tskit.TreeSequence,
    source_path: Path,
    *,
    compression: str,
    state: dict[str, Any],
    state_path: Path,
) -> tuple[dict[str, dict[str, Any]], dict[str, bool]]:
    capabilities = {
        "render": True,
        "intervals": True,
        "details": True,
        "mutations": True,
        "metadata": True,
        "sample_search": True,
        "node_tree_ranges": True,
        "lineage": True,
        "topology_comparison": True,
    }
    indexes: dict[str, dict[str, Any]] = dict(
        state.get("sidecar_indexes") or {}
    )

    def checkpoint(key: str, metadata: dict[str, Any]) -> None:
        indexes[key] = metadata
        state["sidecar_indexes"] = indexes
        state["sidecar_stage"] = key
        _write_json_atomic(state_path, state)

    def write_arrow(
        key: str,
        name: str,
        rows: list[dict[str, Any]],
        schema: pa.Schema,
    ) -> None:
        if key in indexes:
            return
        checkpoint(
            key,
            _write_arrow_table_atomic(
                staging / name,
                _table_from_rows(rows, schema),
                compression=compression,
            ),
        )

    def write_npy(key: str, name: str, values: np.ndarray) -> None:
        if key in indexes:
            return
        path = staging / name
        _write_npy_atomic(path, values)
        checkpoint(key, _file_metadata(path, rows=len(values)))

    if "config" not in indexes:
        config = get_config_tskit(
            tree_sequence,
            str(source_path),
            str(source_path.parent),
            include_intervals=False,
        )
        if config is None:
            raise CSRArtifactBuildError(
                "Unable to build artifact frontend configuration"
            )
        config["artifact_format"] = CSR_ARTIFACT_FORMAT
        config["artifact_capabilities"] = capabilities
        config_path = staging / "config.json"
        _write_json_atomic(config_path, config)
        checkpoint("config", _file_metadata(config_path))

    write_arrow(
        "nodes",
        "nodes.arrow",
        _build_node_rows(tree_sequence) if "nodes" not in indexes else [],
        NODE_SCHEMA,
    )
    write_arrow(
        "sites",
        "sites.arrow",
        _build_site_rows(tree_sequence) if "sites" not in indexes else [],
        SITE_SCHEMA,
    )
    write_arrow(
        "individuals",
        "individuals.arrow",
        (
            _build_individual_rows(tree_sequence)
            if "individuals" not in indexes
            else []
        ),
        INDIVIDUAL_SCHEMA,
    )
    write_arrow(
        "populations",
        "populations.arrow",
        (
            _build_population_rows(tree_sequence)
            if "populations" not in indexes
            else []
        ),
        POPULATION_SCHEMA,
    )

    mutation_keys = {
        "mutations",
        "mutation_positions",
        "mutation_rows_by_id",
        "node_mutation_offsets",
        "node_mutation_ids",
    }
    mutation_rows = (
        _build_global_mutation_rows(tree_sequence)
        if not mutation_keys.issubset(indexes)
        else []
    )
    write_arrow(
        "mutations",
        "mutations.arrow",
        mutation_rows,
        GLOBAL_MUTATION_SCHEMA,
    )
    if "mutation_positions" not in indexes:
        write_npy(
            "mutation_positions",
            "mutation-positions.npy",
            np.asarray(
                [row["position"] for row in mutation_rows],
                dtype=np.float64,
            ),
        )
    if "mutation_rows_by_id" not in indexes:
        mutation_rows_by_id = np.empty(len(mutation_rows), dtype=np.int64)
        for row_index, row in enumerate(mutation_rows):
            mutation_rows_by_id[int(row["id"])] = row_index
        write_npy(
            "mutation_rows_by_id",
            "mutation-rows-by-id.npy",
            mutation_rows_by_id,
        )
    if not {
        "node_mutation_offsets",
        "node_mutation_ids",
    }.issubset(indexes):
        node_mutations: dict[int, list[int]] = defaultdict(list)
        for row in mutation_rows:
            node_mutations[int(row["node_id"])].append(int(row["id"]))
        offsets = np.zeros(int(tree_sequence.num_nodes) + 1, dtype=np.int64)
        mutation_ids: list[int] = []
        for node_id in range(int(tree_sequence.num_nodes)):
            mutation_ids.extend(node_mutations.get(node_id, ()))
            offsets[node_id + 1] = len(mutation_ids)
        write_npy(
            "node_mutation_offsets",
            "node-mutation-offsets.npy",
            offsets,
        )
        write_npy(
            "node_mutation_ids",
            "node-mutation-ids.npy",
            np.asarray(mutation_ids, dtype=np.int32),
        )

    if not {"sample_names", "metadata_samples"}.issubset(indexes):
        sample_name_rows, metadata_rows = _build_sample_indexes(tree_sequence)
        write_arrow(
            "sample_names",
            "sample-names.arrow",
            sample_name_rows,
            SAMPLE_NAME_SCHEMA,
        )
        write_arrow(
            "metadata_samples",
            "metadata-samples.arrow",
            metadata_rows,
            METADATA_SAMPLE_SCHEMA,
        )

    node_tree_ranges = (
        _build_node_tree_ranges(tree_sequence)
        if not {
            "node_tree_ranges",
            "node_tree_range_offsets",
        }.issubset(indexes)
        else []
    )
    write_arrow(
        "node_tree_ranges",
        "node-tree-ranges.arrow",
        node_tree_ranges,
        NODE_TREE_RANGE_SCHEMA,
    )
    if "node_tree_range_offsets" not in indexes:
        node_tree_offsets = np.zeros(
            int(tree_sequence.num_nodes) + 1,
            dtype=np.int64,
        )
        range_offset = 0
        for node_id in range(int(tree_sequence.num_nodes)):
            while (
                range_offset < len(node_tree_ranges)
                and int(node_tree_ranges[range_offset]["node_id"]) == node_id
            ):
                range_offset += 1
            node_tree_offsets[node_id + 1] = range_offset
        write_npy(
            "node_tree_range_offsets",
            "node-tree-range-offsets.npy",
            node_tree_offsets,
        )

    state["sidecars_complete"] = True
    state["sidecar_indexes"] = indexes
    _write_json_atomic(state_path, state)
    return indexes, capabilities


def _validate_resume_state(
    state: dict[str, Any],
    *,
    artifact_format: str,
    fingerprint: str,
    source_size: int,
    options: dict[str, Any],
    staging: Path,
) -> None:
    if state.get("format") != artifact_format:
        raise CSRArtifactBuildError("Staging directory contains another artifact format")
    if state.get("fingerprint") != fingerprint:
        raise CSRArtifactBuildError(
            "Source content changed since the interrupted CSR build"
        )
    if int(state.get("source_size", -1)) != source_size:
        raise CSRArtifactBuildError(
            "Source size changed since the interrupted CSR build"
        )
    if state.get("options") != options:
        raise CSRArtifactBuildError(
            "Build options differ from the interrupted CSR build; use --force"
        )
    expected_next = 0
    for shard in state.get("shards", []):
        if int(shard["first_tree"]) != expected_next:
            raise CSRArtifactBuildError("Interrupted build has a non-contiguous index")
        shard_path = staging / shard["name"]
        if not shard_path.exists() or shard_path.stat().st_size != shard["size_bytes"]:
            raise CSRArtifactBuildError(
                f"Interrupted build is missing completed shard {shard['name']}"
            )
        if _checksum(shard_path) != shard["sha256"]:
            raise CSRArtifactBuildError(
                f"Completed shard {shard['name']} failed checksum validation"
            )
        expected_next = int(shard["last_tree_exclusive"])
    if int(state.get("next_tree", -1)) != expected_next:
        raise CSRArtifactBuildError("Interrupted build checkpoint is inconsistent")
    for key, metadata in (state.get("sidecar_indexes") or {}).items():
        path = staging / str(metadata.get("name", ""))
        if not path.is_file():
            raise CSRArtifactBuildError(
                f"Interrupted build is missing completed sidecar {key}"
            )
        if path.stat().st_size != int(metadata.get("size_bytes", -1)):
            raise CSRArtifactBuildError(
                f"Completed sidecar {key} has an unexpected size"
            )
        if _checksum(path) != metadata.get("sha256"):
            raise CSRArtifactBuildError(
                f"Completed sidecar {key} failed checksum validation"
            )


def _publish(staging: Path, destination: Path) -> None:
    backup: Path | None = None
    if destination.exists():
        backup = destination.parent / (
            f".{destination.name}.obsolete-{uuid.uuid4().hex}"
        )
        os.replace(destination, backup)
    try:
        os.replace(staging, destination)
    except Exception:
        if backup is not None and backup.exists() and not destination.exists():
            os.replace(backup, destination)
        raise
    finally:
        if backup is not None:
            shutil.rmtree(backup, ignore_errors=True)


def _ready_result(destination: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    build_seconds = float(manifest.get("build_seconds") or 0.0)
    num_trees = int(manifest["dataset"]["num_trees"])
    return {
        "status": "ready",
        "artifact_dir": str(destination),
        "fingerprint": manifest["fingerprint"],
        "format": manifest["format"],
        "schema_version": int(manifest["schema_version"]),
        "num_trees": num_trees,
        "num_shards": int(manifest["artifact"]["num_shards"]),
        "size_bytes": manifest["artifact"]["size_bytes"],
        "source_size_bytes": int(manifest["source"]["size_bytes"]),
        "output_source_ratio": manifest["artifact"]["output_source_ratio"],
        "build_seconds": build_seconds,
        "build_trees_per_second": (
            num_trees / build_seconds if build_seconds > 0 else None
        ),
        "manifest": manifest,
    }


def build_csr_artifact(
    source: str | Path,
    *,
    target_shard_mb: int = DEFAULT_TARGET_SHARD_MB,
    compression: str = "zstd",
    force: bool = False,
    resume: bool = True,
    format_version: int = CSR_ARTIFACT_SCHEMA_VERSION,
    progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Build and atomically publish ``<source>.artifact`` beside the source."""
    source_path = Path(source).expanduser().resolve()
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    if source_path.suffix not in {".trees", ".tsz"}:
        raise ValueError("CSR preprocessing supports only .trees and .tsz files")
    if target_shard_mb < 1:
        raise ValueError("target_shard_mb must be at least 1")
    if format_version not in {
        CSR_ARTIFACT_V2_SCHEMA_VERSION,
        CSR_ARTIFACT_SCHEMA_VERSION,
    }:
        raise ValueError("format_version must be 2 or 3")
    artifact_format = (
        CSR_ARTIFACT_FORMAT
        if format_version == CSR_ARTIFACT_SCHEMA_VERSION
        else CSR_ARTIFACT_V2_FORMAT
    )
    compression = compression.lower()
    if compression not in SUPPORTED_COMPRESSIONS:
        raise ValueError(
            f"compression must be one of {sorted(SUPPORTED_COMPRESSIONS)}"
        )
    if compression != "none" and not pa.Codec.is_available(compression):
        raise ValueError(f"PyArrow codec {compression!r} is not available")

    source_stat = source_path.stat()
    fingerprint = source_fingerprint(source_path)
    destination = artifact_path_for_source(source_path)
    manifest_path = destination / "manifest.json"
    if manifest_path.exists() and not force:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (
            manifest.get("format") == artifact_format
            and manifest.get("schema_version") == format_version
            and manifest.get("fingerprint") == fingerprint
        ):
            refreshed_source = {
                **manifest.get("source", {}),
                "path": str(source_path),
                "name": source_path.name,
                "size_bytes": source_stat.st_size,
                "mtime_ns": source_stat.st_mtime_ns,
                "sha256": fingerprint,
            }
            if refreshed_source != manifest.get("source"):
                manifest["source"] = refreshed_source
                _write_json_atomic(manifest_path, manifest)
            return _ready_result(destination, manifest)
        raise CSRArtifactBuildError(
            f"Existing artifact at {destination} is incompatible; use --force"
        )
    if destination.exists() and not force:
        raise CSRArtifactBuildError(
            f"Existing artifact at {destination} has no valid manifest; use --force"
        )

    target_shard_bytes = target_shard_mb * 1024 * 1024
    options = {
        "compression": compression,
        "target_shard_bytes": target_shard_bytes,
        "format_version": format_version,
    }
    staging = destination.with_name(f".{destination.name}.inprogress")
    state_path = staging / "build-state.json"
    if force or (staging.exists() and not resume):
        shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True, exist_ok=True)

    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        _validate_resume_state(
            state,
            artifact_format=artifact_format,
            fingerprint=fingerprint,
            source_size=source_stat.st_size,
            options=options,
            staging=staging,
        )
    elif any(staging.iterdir()):
        raise CSRArtifactBuildError(
            f"Unrecognized partial build at {staging}; use --force"
        )
    else:
        state = {
            "format": artifact_format,
            "schema_version": format_version,
            "fingerprint": fingerprint,
            "source_size": source_stat.st_size,
            "options": options,
            "next_tree": 0,
            "shards": [],
            "estimate_completed": False,
            "started_at_unix": time.time(),
        }
        _write_json_atomic(state_path, state)

    started = time.perf_counter()
    tree_sequence = _load_source(source_path)
    num_trees = int(tree_sequence.num_trees)
    next_tree = int(state["next_tree"])
    if next_tree > num_trees:
        raise CSRArtifactBuildError("Checkpoint exceeds the source tree count")

    breakpoints_path = staging / "breakpoints.npy"
    if not breakpoints_path.exists():
        _write_breakpoints(breakpoints_path, tree_sequence)

    pending: list[pa.RecordBatch] = []
    pending_bytes = 0
    first_estimate_reported = bool(state.get("estimate_completed", False))
    current_tree = (
        tree_sequence.at_index(next_tree) if next_tree < num_trees else None
    )

    def publish_pending() -> None:
        nonlocal pending, pending_bytes, first_estimate_reported
        if not pending:
            return
        shard = _write_shard(
            staging,
            len(state["shards"]),
            pending,
            compression,
        )
        state["shards"].append(shard)
        state["next_tree"] = shard["last_tree_exclusive"]
        _write_json_atomic(state_path, state)
        completed = int(state["next_tree"])
        total_size = sum(int(item["size_bytes"]) for item in state["shards"])
        elapsed = max(time.perf_counter() - started, 1e-9)
        built_this_run = max(1, completed - next_tree)
        trees_per_second = built_this_run / elapsed
        projected_size = (
            math.ceil(total_size / completed * num_trees)
            if completed and num_trees
            else total_size
        )
        if not first_estimate_reported:
            available = shutil.disk_usage(destination.parent).free
            if projected_size > available:
                raise CSRArtifactBuildError(
                    "Projected CSR artifact size "
                    f"({projected_size} bytes) exceeds available disk space "
                    f"({available} bytes)"
                )
            first_estimate_reported = True
            state["estimate_completed"] = True
            _write_json_atomic(state_path, state)
        if progress is not None:
            remaining = max(0, num_trees - completed)
            progress(
                {
                    "event": "progress",
                    "completed_trees": completed,
                    "num_trees": num_trees,
                    "shards": len(state["shards"]),
                    "size_bytes": total_size,
                    "projected_size_bytes": projected_size,
                    "source_size_bytes": source_stat.st_size,
                    "projected_output_source_ratio": (
                        projected_size / source_stat.st_size
                        if source_stat.st_size
                        else None
                    ),
                    "trees_per_second": trees_per_second,
                    "eta_seconds": (
                        remaining / trees_per_second if trees_per_second else None
                    ),
                }
            )
        pending = []
        pending_bytes = 0

    while current_tree is not None:
        record = genealogy_record_batch(current_tree, tree_sequence)
        record_bytes = max(1, int(record.nbytes))
        if pending and pending_bytes + record_bytes > target_shard_bytes:
            publish_pending()
        pending.append(record)
        pending_bytes += record_bytes
        if int(current_tree.index) + 1 >= num_trees:
            current_tree = None
        elif not current_tree.next():
            current_tree = None
    publish_pending()

    if int(state["next_tree"]) != num_trees:
        raise CSRArtifactBuildError(
            f"Built {state['next_tree']} of {num_trees} genealogies"
        )

    shard_index_path = staging / "shards.arrow"
    _write_shard_index(shard_index_path, state["shards"])
    indexes = {
        "breakpoints": {
            "name": breakpoints_path.name,
            "size_bytes": breakpoints_path.stat().st_size,
            "sha256": _checksum(breakpoints_path),
        },
        "shards": {
            "name": shard_index_path.name,
            "size_bytes": shard_index_path.stat().st_size,
            "sha256": _checksum(shard_index_path),
        },
    }
    capabilities = {
        "render": True,
        "intervals": True,
        "lineage": True,
        "topology_comparison": True,
    }
    if format_version == CSR_ARTIFACT_SCHEMA_VERSION:
        sidecar_indexes, v3_capabilities = _write_v3_sidecars(
            staging,
            tree_sequence,
            source_path,
            compression=compression,
            state=state,
            state_path=state_path,
        )
        indexes.update(sidecar_indexes)
        capabilities.update(v3_capabilities)
    shard_bytes = sum(int(item["size_bytes"]) for item in state["shards"])
    total_size = (
        shard_bytes
        + sum(int(metadata["size_bytes"]) for metadata in indexes.values())
    )
    manifest = {
        "schema_version": format_version,
        "format": artifact_format,
        "builder_version": _builder_version(),
        "created_at_unix": int(time.time()),
        "build_seconds": round(
            max(
                time.perf_counter() - started,
                time.time() - float(state.get("started_at_unix", time.time())),
            ),
            3,
        ),
        "fingerprint": fingerprint,
        "source": {
            "path": str(source_path),
            "name": source_path.name,
            "size_bytes": source_stat.st_size,
            "mtime_ns": source_stat.st_mtime_ns,
            "sha256": fingerprint,
        },
        "dataset": {
            "sequence_length": float(tree_sequence.sequence_length),
            "num_trees": num_trees,
            "num_nodes": int(tree_sequence.num_nodes),
            "num_edges": int(tree_sequence.num_edges),
            "num_samples": int(tree_sequence.num_samples),
            "num_sites": int(tree_sequence.num_sites),
            "num_mutations": int(tree_sequence.num_mutations),
            "num_individuals": int(tree_sequence.num_individuals),
            "num_populations": int(tree_sequence.num_populations),
            "time_units": str(getattr(tree_sequence, "time_units", "unknown")),
            "global_min_time": float(tree_sequence.min_time),
            "global_max_time": float(tree_sequence.max_time),
        },
        "build": {
            "compression": compression,
            "target_shard_bytes": target_shard_bytes,
            "complete_unsparsified_genealogies": True,
            "precomputed_layout_x": True,
            "precomputed_layout_y": False,
        },
        "capabilities": capabilities,
        "indexes": indexes,
        "artifact": {
            "num_shards": len(state["shards"]),
            "size_bytes": total_size,
            "output_source_ratio": (
                total_size / source_stat.st_size if source_stat.st_size else None
            ),
        },
    }
    # The manifest is the artifact commit marker and is always written last.
    _write_json_atomic(staging / "manifest.json", manifest)
    _publish(staging, destination)
    (destination / "build-state.json").unlink(missing_ok=True)
    return _ready_result(destination, manifest)


__all__ = [
    "CSR_ARTIFACT_FORMAT",
    "CSR_ARTIFACT_SCHEMA_VERSION",
    "CSR_ARTIFACT_V2_FORMAT",
    "CSR_ARTIFACT_V2_SCHEMA_VERSION",
    "CSRArtifactBuildError",
    "DEFAULT_TARGET_SHARD_MB",
    "GENEALOGY_SCHEMA",
    "MUTATION_TYPE",
    "SHARD_INDEX_SCHEMA",
    "artifact_path_for_source",
    "build_csr_artifact",
    "genealogy_record_batch",
    "source_fingerprint",
]
