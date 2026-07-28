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
from typing import Any, Callable, Iterable

import numpy as np
import pyarrow as pa
import tskit
import tszip

from lorax.tree_graph.tree_graph import _compute_x_postorder

CSR_ARTIFACT_SCHEMA_VERSION = 2
CSR_ARTIFACT_FORMAT = "lorax-csr-v2"
DEFAULT_TARGET_SHARD_MB = 48
SUPPORTED_COMPRESSIONS = {"zstd", "lz4", "none"}

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


class CSRArtifactBuildError(RuntimeError):
    """Raised when a CSR artifact cannot be built safely."""


def _builder_version() -> str:
    try:
        return importlib.metadata.version("lorax-arg")
    except importlib.metadata.PackageNotFoundError:
        return "0.1.7"


def source_fingerprint(file_path: str | Path) -> str:
    """Return a stable content hash for source-addressed publication."""
    digest = hashlib.sha256()
    with Path(file_path).open("rb") as source:
        while chunk := source.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def default_csr_artifact_root() -> Path:
    """Return the default root containing fingerprint-addressed v2 artifacts."""
    from lorax.constants import DISK_CACHE_DIR

    return Path(DISK_CACHE_DIR).expanduser().resolve() / "artifacts" / "v2"


def _checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(
        json.dumps(payload, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    os.replace(temporary, path)


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


def _validate_resume_state(
    state: dict[str, Any],
    *,
    fingerprint: str,
    source_size: int,
    options: dict[str, Any],
    staging: Path,
) -> None:
    if state.get("format") != CSR_ARTIFACT_FORMAT:
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


def _publish(staging: Path, destination: Path) -> None:
    backup: Path | None = None
    if destination.exists():
        backup = destination.parent / (
            f".obsolete-{destination.name[:12]}-{uuid.uuid4().hex}"
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
    return {
        "status": "ready",
        "artifact_dir": str(destination),
        "fingerprint": manifest["fingerprint"],
        "num_trees": manifest["dataset"]["num_trees"],
        "size_bytes": manifest["artifact"]["size_bytes"],
        "manifest": manifest,
    }


def build_csr_artifact(
    source: str | Path,
    output_dir: str | Path | None = None,
    *,
    target_shard_mb: int = DEFAULT_TARGET_SHARD_MB,
    compression: str = "zstd",
    force: bool = False,
    resume: bool = True,
    progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Build and atomically publish a random-access CSR genealogy artifact."""
    source_path = Path(source).expanduser().resolve()
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    if source_path.suffix not in {".trees", ".tsz"}:
        raise ValueError("CSR preprocessing supports only .trees and .tsz files")
    if target_shard_mb < 1:
        raise ValueError("target_shard_mb must be at least 1")
    compression = compression.lower()
    if compression not in SUPPORTED_COMPRESSIONS:
        raise ValueError(
            f"compression must be one of {sorted(SUPPORTED_COMPRESSIONS)}"
        )
    if compression != "none" and not pa.Codec.is_available(compression):
        raise ValueError(f"PyArrow codec {compression!r} is not available")

    source_stat = source_path.stat()
    fingerprint = source_fingerprint(source_path)
    root = (
        Path(output_dir).expanduser().resolve()
        if output_dir is not None
        else default_csr_artifact_root()
    )
    root.mkdir(parents=True, exist_ok=True)
    destination = root / fingerprint
    manifest_path = destination / "manifest.json"
    if manifest_path.exists() and not force:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (
            manifest.get("format") == CSR_ARTIFACT_FORMAT
            and manifest.get("schema_version") == CSR_ARTIFACT_SCHEMA_VERSION
            and manifest.get("fingerprint") == fingerprint
        ):
            return _ready_result(destination, manifest)
        raise CSRArtifactBuildError(
            f"Existing artifact at {destination} is incompatible; use --force"
        )

    target_shard_bytes = target_shard_mb * 1024 * 1024
    options = {
        "compression": compression,
        "target_shard_bytes": target_shard_bytes,
    }
    staging = root / f".{fingerprint}.csr-v2.inprogress"
    state_path = staging / "build-state.json"
    if force or (staging.exists() and not resume):
        shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True, exist_ok=True)

    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        _validate_resume_state(
            state,
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
            "format": CSR_ARTIFACT_FORMAT,
            "schema_version": CSR_ARTIFACT_SCHEMA_VERSION,
            "fingerprint": fingerprint,
            "source_size": source_stat.st_size,
            "options": options,
            "next_tree": 0,
            "shards": [],
            "estimate_completed": False,
            "started_at_unix": int(time.time()),
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
            available = shutil.disk_usage(root).free
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
    shard_bytes = sum(int(item["size_bytes"]) for item in state["shards"])
    total_size = (
        shard_bytes
        + indexes["breakpoints"]["size_bytes"]
        + indexes["shards"]["size_bytes"]
    )
    manifest = {
        "schema_version": CSR_ARTIFACT_SCHEMA_VERSION,
        "format": CSR_ARTIFACT_FORMAT,
        "builder_version": _builder_version(),
        "created_at_unix": int(time.time()),
        "build_seconds": round(time.perf_counter() - started, 3),
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
            "num_mutations": int(tree_sequence.num_mutations),
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
    "CSRArtifactBuildError",
    "DEFAULT_TARGET_SHARD_MB",
    "GENEALOGY_SCHEMA",
    "MUTATION_TYPE",
    "SHARD_INDEX_SCHEMA",
    "build_csr_artifact",
    "default_csr_artifact_root",
    "genealogy_record_batch",
    "source_fingerprint",
]
