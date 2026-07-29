"""Memory-bounded random access to lorax-csr-v2 and lorax-csr-v3 artifacts."""

from __future__ import annotations

import bisect
import hashlib
import json
import threading
from collections import OrderedDict, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pyarrow as pa

from lorax.artifacts.metrics import csr_artifact_metrics
from lorax.artifacts.csr_builder import (
    CSR_ARTIFACT_FORMAT,
    CSR_ARTIFACT_SCHEMA_VERSION,
    CSR_ARTIFACT_V2_FORMAT,
    CSR_ARTIFACT_V2_SCHEMA_VERSION,
)


class CSRArtifactError(RuntimeError):
    """Base error for invalid or unreadable CSR artifacts."""


class CSRArtifactCorruptError(CSRArtifactError):
    """Raised when an artifact checksum or structural invariant fails."""


class CSRArtifactCapabilityError(CSRArtifactError):
    """Raised when an older artifact lacks a requested feature."""

    code = "CSR_REBUILD_REQUIRED"

    def __init__(self, capability: str):
        self.capability = capability
        super().__init__(
            f"CSR artifact lacks {capability!r}; rebuild it as lorax-csr-v3"
        )


V3_CAPABILITY_INDEXES = {
    "render": {"breakpoints", "shards"},
    "intervals": {"breakpoints"},
    "details": {
        "nodes",
        "sites",
        "individuals",
        "populations",
        "mutations",
        "mutation_rows_by_id",
        "node_mutation_offsets",
        "node_mutation_ids",
    },
    "mutations": {
        "mutations",
        "mutation_positions",
        "mutation_rows_by_id",
        "node_mutation_offsets",
        "node_mutation_ids",
    },
    "metadata": {"metadata_samples", "sample_names"},
    "sample_search": {"sample_names"},
    "node_tree_ranges": {"node_tree_ranges", "node_tree_range_offsets"},
    "lineage": {"breakpoints", "shards"},
    "topology_comparison": {"breakpoints", "shards"},
}


def _checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _verify_file(path: Path, metadata: dict[str, Any]) -> None:
    if not path.is_file():
        raise CSRArtifactCorruptError(f"Missing artifact file: {path.name}")
    if path.stat().st_size != int(metadata["size_bytes"]):
        raise CSRArtifactCorruptError(f"Size mismatch for {path.name}")
    if _checksum(path) != metadata["sha256"]:
        raise CSRArtifactCorruptError(f"Checksum mismatch for {path.name}")


def _readonly(array: np.ndarray) -> np.ndarray:
    array.setflags(write=False)
    return array


def _metadata_query_value(value: Any) -> str:
    if isinstance(value, (dict, list, tuple)):
        # Match the string representation already exposed by Lorax's legacy
        # metadata filters and used by the v3 index builder.
        return repr(value)
    return str(value)


@dataclass(frozen=True)
class GenealogyMutations:
    ids: np.ndarray
    site_ids: np.ndarray
    node_ids: np.ndarray
    parent_ids: np.ndarray
    positions: np.ndarray
    times: np.ndarray
    ancestral_states: tuple[str, ...]
    derived_states: tuple[str, ...]
    inherited_states: tuple[str, ...]

    def __len__(self) -> int:
        return len(self.ids)


@dataclass(frozen=True)
class GenealogyCSR:
    tree_index: int
    interval_left: float
    interval_right: float
    node_ids: np.ndarray
    parent_ids: np.ndarray
    child_offsets: np.ndarray
    child_node_ids: np.ndarray
    node_times: np.ndarray
    node_flags: np.ndarray
    layout_x: np.ndarray
    mutations: GenealogyMutations

    def node_offset(self, node_id: int) -> int:
        offset = int(np.searchsorted(self.node_ids, int(node_id)))
        if offset >= len(self.node_ids) or int(self.node_ids[offset]) != int(node_id):
            raise KeyError(f"Node {node_id} is not in tree {self.tree_index}")
        return offset

    def has_node(self, node_id: int) -> bool:
        try:
            self.node_offset(node_id)
            return True
        except KeyError:
            return False

    def parent(self, node_id: int) -> int:
        return int(self.parent_ids[self.node_offset(node_id)])

    def parent_of(self, node_id: int) -> int:
        return self.parent(node_id)

    def children(self, node_id: int) -> np.ndarray:
        offset = self.node_offset(node_id)
        left = int(self.child_offsets[offset])
        right = int(self.child_offsets[offset + 1])
        return self.child_node_ids[left:right]

    def is_tip(self, node_id: int) -> bool:
        offset = self.node_offset(node_id)
        return bool(self.child_offsets[offset] == self.child_offsets[offset + 1])

    def node_time(self, node_id: int) -> float:
        return float(self.node_times[self.node_offset(node_id)])

    def node_x(self, node_id: int) -> float:
        return float(self.layout_x[self.node_offset(node_id)])

    def roots(self) -> np.ndarray:
        return self.node_ids[self.parent_ids == -1]

    def ancestors(self, node_id: int, *, include_self: bool = True) -> list[int]:
        current = int(node_id)
        path = [current] if include_self else []
        while True:
            parent_id = self.parent(current)
            if parent_id == -1:
                break
            path.append(parent_id)
            current = parent_id
        return path

    def descendants(self, node_id: int, *, include_self: bool = True) -> list[int]:
        result: list[int] = []
        stack = [int(node_id)]
        while stack:
            current = stack.pop()
            if include_self or current != int(node_id):
                result.append(current)
            stack.extend(reversed(self.children(current).tolist()))
        return result

    def edges(self) -> set[tuple[int, int]]:
        return {
            (int(parent_id), int(node_id))
            for node_id, parent_id in zip(self.node_ids, self.parent_ids)
            if int(parent_id) != -1
        }


def _list_numpy(
    batch: pa.RecordBatch, name: str, dtype: np.dtype[Any]
) -> np.ndarray:
    column = batch.column(batch.schema.get_field_index(name))
    scalar = column[0]
    if not scalar.is_valid:
        return _readonly(np.empty(0, dtype=dtype))
    values = scalar.values.to_numpy(zero_copy_only=False)
    return _readonly(np.asarray(values, dtype=dtype))


def _decode_mutations(batch: pa.RecordBatch) -> GenealogyMutations:
    column = batch.column(batch.schema.get_field_index("mutations"))
    scalar = column[0]
    values = scalar.values

    def primitive(name: str, dtype: np.dtype[Any]) -> np.ndarray:
        return _readonly(
            np.asarray(values.field(name).to_numpy(zero_copy_only=False), dtype=dtype)
        )

    def strings(name: str) -> tuple[str, ...]:
        return tuple(values.field(name).to_pylist())

    return GenealogyMutations(
        ids=primitive("id", np.int32),
        site_ids=primitive("site_id", np.int32),
        node_ids=primitive("node_id", np.int32),
        parent_ids=primitive("parent_id", np.int32),
        positions=primitive("position", np.float64),
        times=primitive("time", np.float64),
        ancestral_states=strings("ancestral_state"),
        derived_states=strings("derived_state"),
        inherited_states=strings("inherited_state"),
    )


def _decode_genealogy(batch: pa.RecordBatch) -> GenealogyCSR:
    if batch.num_rows != 1:
        raise CSRArtifactCorruptError("A genealogy record batch must contain one row")

    def scalar(name: str) -> Any:
        return batch.column(batch.schema.get_field_index(name))[0].as_py()

    genealogy = GenealogyCSR(
        tree_index=int(scalar("tree_index")),
        interval_left=float(scalar("interval_left")),
        interval_right=float(scalar("interval_right")),
        node_ids=_list_numpy(batch, "node_ids", np.int32),
        parent_ids=_list_numpy(batch, "parent_ids", np.int32),
        child_offsets=_list_numpy(batch, "child_offsets", np.int32),
        child_node_ids=_list_numpy(batch, "child_node_ids", np.int32),
        node_times=_list_numpy(batch, "node_times", np.float64),
        node_flags=_list_numpy(batch, "node_flags", np.uint32),
        layout_x=_list_numpy(batch, "layout_x", np.float32),
        mutations=_decode_mutations(batch),
    )
    num_nodes = len(genealogy.node_ids)
    aligned = {
        "parent_ids": len(genealogy.parent_ids),
        "node_times": len(genealogy.node_times),
        "node_flags": len(genealogy.node_flags),
        "layout_x": len(genealogy.layout_x),
    }
    for name, length in aligned.items():
        if length != num_nodes:
            raise CSRArtifactCorruptError(
                f"{name} has {length} values for {num_nodes} nodes"
            )
    if len(genealogy.child_offsets) != num_nodes + 1:
        raise CSRArtifactCorruptError("CSR child_offsets length is invalid")
    if (
        genealogy.child_offsets[0] != 0
        or genealogy.child_offsets[-1] != len(genealogy.child_node_ids)
        or np.any(np.diff(genealogy.child_offsets) < 0)
    ):
        raise CSRArtifactCorruptError("CSR child offsets are inconsistent")
    if num_nodes and np.any(np.diff(genealogy.node_ids) <= 0):
        raise CSRArtifactCorruptError("Genealogy node IDs are not sorted and unique")
    return genealogy


class CSRArtifactReader:
    """Random-access reader that never opens the source TreeSequence."""

    def __init__(self, artifact_directory: str | Path, *, max_open_shards: int = 8):
        self.artifact_directory = Path(artifact_directory).expanduser().resolve()
        manifest_path = self.artifact_directory / "manifest.json"
        if not manifest_path.is_file():
            raise FileNotFoundError(manifest_path)
        self.manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        version_key = (
            self.manifest.get("format"),
            int(self.manifest.get("schema_version", -1)),
        )
        supported_versions = {
            (CSR_ARTIFACT_V2_FORMAT, CSR_ARTIFACT_V2_SCHEMA_VERSION),
            (CSR_ARTIFACT_FORMAT, CSR_ARTIFACT_SCHEMA_VERSION),
        }
        if version_key not in supported_versions:
            raise CSRArtifactError(
                f"Unsupported CSR artifact at {self.artifact_directory}"
            )
        self.schema_version = version_key[1]
        self.format = version_key[0]
        self.capabilities = dict(self.manifest.get("capabilities") or {})
        if self.schema_version == CSR_ARTIFACT_V2_SCHEMA_VERSION:
            self.capabilities = {
                "render": True,
                "intervals": True,
                "lineage": True,
                "topology_comparison": True,
                **self.capabilities,
            }
        else:
            available_indexes = set(self.manifest.get("indexes") or {})
            missing_capabilities = sorted(
                capability
                for capability in V3_CAPABILITY_INDEXES
                if not self.capabilities.get(capability)
            )
            if missing_capabilities:
                raise CSRArtifactCorruptError(
                    "lorax-csr-v3 is missing required capabilities: "
                    + ", ".join(missing_capabilities)
                )
            if "config" not in available_indexes:
                raise CSRArtifactCorruptError(
                    "lorax-csr-v3 is missing the frontend configuration"
                )
            for capability, required_indexes in V3_CAPABILITY_INDEXES.items():
                if self.capabilities.get(capability) and not required_indexes.issubset(
                    available_indexes
                ):
                    missing = sorted(required_indexes - available_indexes)
                    raise CSRArtifactCorruptError(
                        f"Capability {capability!r} is missing indexes: {missing}"
                    )
        if max_open_shards < 1:
            raise ValueError("max_open_shards must be at least 1")
        self.max_open_shards = max_open_shards
        self._lock = threading.RLock()
        self._closed = False
        self._open_shards: OrderedDict[
            int, tuple[pa.NativeFile, pa.ipc.RecordBatchFileReader]
        ] = OrderedDict()
        self._sidecar_sources: dict[str, pa.NativeFile] = {}
        self._sidecar_readers: dict[str, pa.ipc.RecordBatchFileReader] = {}
        self._sidecar_tables: dict[str, pa.Table] = {}
        self._mapped_indexes: dict[str, np.ndarray] = {}

        breakpoints_meta = self.manifest["indexes"]["breakpoints"]
        shard_index_meta = self.manifest["indexes"]["shards"]
        breakpoints_path = self.artifact_directory / breakpoints_meta["name"]
        shard_index_path = self.artifact_directory / shard_index_meta["name"]
        _verify_file(breakpoints_path, breakpoints_meta)
        _verify_file(shard_index_path, shard_index_meta)

        self.breakpoints = np.load(
            breakpoints_path,
            mmap_mode="r",
            allow_pickle=False,
        )
        with pa.memory_map(str(shard_index_path), "r") as source:
            shard_table = pa.ipc.open_file(source).read_all()
        self._shards = shard_table.to_pylist()
        self._shard_first_trees = [
            int(shard["first_tree"]) for shard in self._shards
        ]
        self.num_trees = int(self.manifest["dataset"]["num_trees"])
        self.sequence_length = float(self.manifest["dataset"]["sequence_length"])
        self.global_min_time = float(
            self.manifest["dataset"].get("global_min_time", 0.0)
        )
        self.global_max_time = float(
            self.manifest["dataset"].get("global_max_time", 1.0)
        )
        if len(self.breakpoints) != self.num_trees + 1:
            raise CSRArtifactCorruptError("Breakpoint index length is invalid")
        expected_tree = 0
        for shard in self._shards:
            if int(shard["first_tree"]) != expected_tree:
                raise CSRArtifactCorruptError("Shard tree ranges are not contiguous")
            expected_tree = int(shard["last_tree_exclusive"])
        if expected_tree != self.num_trees:
            raise CSRArtifactCorruptError("Shard index does not cover every genealogy")

        config_meta = self.manifest.get("indexes", {}).get("config")
        if config_meta is not None:
            config_path = self.artifact_directory / config_meta["name"]
            _verify_file(config_path, config_meta)
            self._stored_config = json.loads(config_path.read_text(encoding="utf-8"))
        else:
            self._stored_config = None

        for key, metadata in self.manifest.get("indexes", {}).items():
            if key in {"breakpoints", "shards", "config"}:
                continue
            path = self.artifact_directory / metadata["name"]
            _verify_file(path, metadata)

    @classmethod
    def open(
        cls, artifact_directory: str | Path, *, max_open_shards: int = 8
    ) -> "CSRArtifactReader":
        return cls(artifact_directory, max_open_shards=max_open_shards)

    def __enter__(self) -> "CSRArtifactReader":
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        self.close()

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            for source, _reader in self._open_shards.values():
                source.close()
            self._open_shards.clear()
            for source in self._sidecar_sources.values():
                source.close()
            self._sidecar_sources.clear()
            self._sidecar_readers.clear()
            self._sidecar_tables.clear()
            mmap = getattr(self.breakpoints, "_mmap", None)
            if mmap is not None:
                mmap.close()
            for array in self._mapped_indexes.values():
                index_mmap = getattr(array, "_mmap", None)
                if index_mmap is not None:
                    index_mmap.close()
            self._mapped_indexes.clear()
            self._closed = True

    def has_capability(self, capability: str) -> bool:
        return bool(self.capabilities.get(capability, False))

    def require_capability(self, capability: str) -> None:
        if not self.has_capability(capability):
            raise CSRArtifactCapabilityError(capability)

    def frontend_config(
        self,
        *,
        filename: str | None = None,
        project: str | None = None,
    ) -> dict[str, Any]:
        """Return a JSON-safe config without materializing all breakpoints."""
        if self._stored_config is None:
            dataset = self.manifest["dataset"]
            source = self.manifest.get("source", {})
            config = {
                "genome_length": self.sequence_length,
                "initial_position": [
                    int(max(0.0, self.sequence_length * 0.45)),
                    int(min(self.sequence_length, self.sequence_length * 0.55)),
                ],
                "times": {
                    "type": str(dataset.get("time_units", "unknown")),
                    "values": [self.global_min_time, self.global_max_time],
                },
                "intervals": None,
                "interval_source": "backend",
                "num_trees": self.num_trees,
                "filename": source.get("name", ""),
                "project": (
                    Path(source.get("path", "")).parent.name
                    if source.get("path")
                    else None
                ),
                "num_samples": int(dataset.get("num_samples", 0)),
                "sample_names": {},
                "metadata_schema": {},
                "top_level_metadata": None,
                "provenance": {"count": 0, "latest": None, "records": []},
                "table_counts": {
                    "trees": self.num_trees,
                    "nodes": int(dataset.get("num_nodes", 0)),
                    "edges": int(dataset.get("num_edges", 0)),
                    "sites": dataset.get("num_sites"),
                    "mutations": int(dataset.get("num_mutations", 0)),
                    "individuals": dataset.get("num_individuals"),
                    "populations": dataset.get("num_populations"),
                },
            }
        else:
            config = dict(self._stored_config)
        config["intervals"] = None
        config["interval_source"] = "backend"
        config["num_trees"] = self.num_trees
        config["num_breakpoints"] = self.num_trees + 1
        config["artifact_format"] = self.format
        config["artifact_fingerprint"] = str(self.manifest["fingerprint"])
        config["artifact_capabilities"] = dict(self.capabilities)
        if filename is not None:
            config["filename"] = str(filename)
        if project is not None:
            config["project"] = str(project)
        return config

    def _index_metadata(self, key: str) -> dict[str, Any]:
        metadata = self.manifest.get("indexes", {}).get(key)
        if metadata is None:
            raise CSRArtifactCapabilityError(key)
        return metadata

    def _mapped_index(self, key: str) -> np.ndarray:
        with self._lock:
            cached = self._mapped_indexes.get(key)
            if cached is not None:
                return cached
            metadata = self._index_metadata(key)
            path = self.artifact_directory / metadata["name"]
            array = np.load(path, mmap_mode="r", allow_pickle=False)
            self._mapped_indexes[key] = array
            return array

    def _sidecar_reader(self, key: str) -> pa.ipc.RecordBatchFileReader:
        with self._lock:
            cached = self._sidecar_readers.get(key)
            if cached is not None:
                return cached
            metadata = self._index_metadata(key)
            path = self.artifact_directory / metadata["name"]
            source = pa.memory_map(str(path), "r")
            try:
                reader = pa.ipc.open_file(source)
            except Exception:
                source.close()
                raise
            self._sidecar_sources[key] = source
            self._sidecar_readers[key] = reader
            return reader

    def _sidecar_table(self, key: str) -> pa.Table:
        with self._lock:
            cached = self._sidecar_tables.get(key)
            if cached is not None:
                return cached
            table = self._sidecar_reader(key).read_all()
            self._sidecar_tables[key] = table
            return table

    def _sidecar_slice(
        self,
        key: str,
        offset: int,
        length: int,
    ) -> pa.Table:
        offset = max(0, int(offset))
        length = max(0, int(length))
        with self._lock:
            reader = self._sidecar_reader(key)
            if length == 0:
                return pa.Table.from_batches([], schema=reader.schema)
            metadata = self._index_metadata(key)
            batch_rows = int(metadata.get("batch_rows", 0))
            if batch_rows > 0:
                first_batch = offset // batch_rows
                remaining_offset = offset % batch_rows
            else:
                first_batch = 0
                remaining_offset = offset
            remaining_length = length
            batches: list[pa.RecordBatch] = []
            for batch_index in range(first_batch, reader.num_record_batches):
                batch = reader.get_batch(batch_index)
                if remaining_offset >= batch.num_rows:
                    remaining_offset -= batch.num_rows
                    continue
                take = min(remaining_length, batch.num_rows - remaining_offset)
                batches.append(batch.slice(remaining_offset, take))
                remaining_length -= take
                remaining_offset = 0
                if remaining_length == 0:
                    break
            if remaining_length:
                raise CSRArtifactCorruptError(
                    f"{key} slice exceeds the indexed row count"
                )
            return pa.Table.from_batches(batches, schema=reader.schema)

    def _row_at(self, key: str, row_index: int) -> dict[str, Any]:
        metadata = self._index_metadata(key)
        row_index = int(row_index)
        row_count = int(metadata.get("rows", -1))
        if row_index < 0 or (row_count >= 0 and row_index >= row_count):
            raise IndexError(f"{key} row {row_index} is out of range")
        with self._lock:
            reader = self._sidecar_reader(key)
            batch_rows = int(metadata.get("batch_rows", 0))
            if batch_rows > 0:
                batch_index = row_index // batch_rows
                batch_offset = row_index % batch_rows
                if batch_index >= reader.num_record_batches:
                    raise CSRArtifactCorruptError(
                        f"{key} index does not contain row {row_index}"
                    )
                batch = reader.get_batch(batch_index)
                if batch_offset >= batch.num_rows:
                    raise CSRArtifactCorruptError(
                        f"{key} batch metadata is inconsistent"
                    )
                return {
                    name: batch.column(column_index)[batch_offset].as_py()
                    for column_index, name in enumerate(batch.schema.names)
                }
            remaining = row_index
            for batch_index in range(reader.num_record_batches):
                batch = reader.get_batch(batch_index)
                if remaining < batch.num_rows:
                    return {
                        name: batch.column(column_index)[remaining].as_py()
                        for column_index, name in enumerate(batch.schema.names)
                    }
                remaining -= batch.num_rows
        raise CSRArtifactCorruptError(f"{key} index does not contain row {row_index}")

    def _shard_for_tree(self, tree_index: int) -> tuple[int, dict[str, Any]]:
        tree_index = int(tree_index)
        if tree_index < 0 or tree_index >= self.num_trees:
            raise IndexError(
                f"Tree index {tree_index} outside [0, {self.num_trees})"
            )
        shard_offset = bisect.bisect_right(
            self._shard_first_trees, tree_index
        ) - 1
        if shard_offset < 0:
            raise CSRArtifactCorruptError(f"No shard for tree {tree_index}")
        shard = self._shards[shard_offset]
        if tree_index >= int(shard["last_tree_exclusive"]):
            raise CSRArtifactCorruptError(f"No shard for tree {tree_index}")
        return shard_offset, shard

    def _open_shard(
        self, shard_offset: int, shard: dict[str, Any]
    ) -> pa.ipc.RecordBatchFileReader:
        if self._closed:
            raise CSRArtifactError("CSR artifact reader is closed")
        cached = self._open_shards.pop(shard_offset, None)
        if cached is not None:
            self._open_shards[shard_offset] = cached
            csr_artifact_metrics.increment("shard_cache.hit")
            return cached[1]
        csr_artifact_metrics.increment("shard_cache.miss")
        path = self.artifact_directory / shard["name"]
        if not path.is_file():
            raise CSRArtifactCorruptError(f"Missing shard {shard['name']}")
        if path.stat().st_size != int(shard["size_bytes"]):
            raise CSRArtifactCorruptError(f"Size mismatch for {shard['name']}")
        source = pa.memory_map(str(path), "r")
        try:
            reader = pa.ipc.open_file(source)
            if reader.num_record_batches != int(shard["batch_count"]):
                raise CSRArtifactCorruptError(
                    f"Batch count mismatch for {shard['name']}"
                )
        except Exception:
            source.close()
            raise
        self._open_shards[shard_offset] = (source, reader)
        while len(self._open_shards) > self.max_open_shards:
            _old_offset, (old_source, _old_reader) = self._open_shards.popitem(
                last=False
            )
            old_source.close()
            csr_artifact_metrics.increment("shard_cache.eviction")
        return reader

    def tree_at_index(self, tree_index: int) -> GenealogyCSR:
        return self.trees_at_indices([tree_index])[0]

    def tree_at_position(self, position: float) -> GenealogyCSR:
        return self.tree_at_index(self.tree_index_at_position(position))

    def tree_index_at_position(self, position: float) -> int:
        position = float(position)
        if (
            not np.isfinite(position)
            or position < 0
            or position >= self.sequence_length
        ):
            raise ValueError(
                f"Position {position} outside [0, {self.sequence_length})"
            )
        tree_index = int(np.searchsorted(self.breakpoints, position, side="right") - 1)
        return tree_index

    def tree_indices_in_range(self, start: float, end: float) -> range:
        """Return tree indexes whose genomic intervals overlap ``[start, end)``."""
        start = float(start)
        end = float(end)
        if (
            not np.isfinite(start)
            or not np.isfinite(end)
            or start < 0
            or end > self.sequence_length
            or start >= end
        ):
            raise ValueError(
                "Genomic range must satisfy "
                f"0 <= start < end <= {self.sequence_length}; got [{start}, {end})"
            )
        first_tree = int(
            np.searchsorted(self.breakpoints, start, side="right") - 1
        )
        last_tree_exclusive = int(
            np.searchsorted(self.breakpoints, end, side="left")
        )
        return range(first_tree, last_tree_exclusive)

    def trees_in_range(self, start: float, end: float) -> list[GenealogyCSR]:
        """Decode all genealogies whose genomic intervals overlap ``[start, end)``."""
        return self.trees_at_indices(self.tree_indices_in_range(start, end))

    def interval_at_index(self, tree_index: int) -> tuple[float, float]:
        self._shard_for_tree(tree_index)
        return (
            float(self.breakpoints[int(tree_index)]),
            float(self.breakpoints[int(tree_index) + 1]),
        )

    def intervals_in_range(
        self,
        start: float,
        end: float,
        max_intervals: int = 2_000,
    ) -> dict[str, Any]:
        """Return memory-bounded interval metadata for a genomic viewport."""
        max_intervals = int(max_intervals)
        if max_intervals < 1:
            raise ValueError("max_intervals must be at least 1")
        tree_range = self.tree_indices_in_range(start, end)
        first_tree = int(tree_range.start)
        last_tree_exclusive = int(tree_range.stop)
        breakpoint_start = first_tree
        breakpoint_stop = min(self.num_trees + 1, last_tree_exclusive + 1)
        count = breakpoint_stop - breakpoint_start
        if count <= max_intervals:
            visible = np.asarray(
                self.breakpoints[breakpoint_start:breakpoint_stop],
                dtype=np.float64,
            )
        else:
            step = max(1, int(np.ceil(count / max_intervals)))
            visible = np.asarray(
                self.breakpoints[breakpoint_start:breakpoint_stop:step],
                dtype=np.float64,
            )
        return {
            "visibleIntervals": visible.tolist(),
            "lo": breakpoint_start,
            "hi": breakpoint_stop,
            "count": count,
            "first_tree": first_tree,
            "last_tree_exclusive": last_tree_exclusive,
        }

    @staticmethod
    def _decode_metadata_row(row: dict[str, Any]) -> dict[str, Any]:
        value = row.get("metadata_json")
        try:
            return json.loads(value) if value else {}
        except (TypeError, json.JSONDecodeError):
            return {}

    def node_details(self, node_id: int) -> dict[str, Any]:
        self.require_capability("details")
        row = self._row_at("nodes", node_id)
        return {
            "id": int(row["id"]),
            "flags": int(row["flags"]),
            "time": float(row["time"]),
            "population": int(row["population"]),
            "individual": int(row["individual"]),
            "metadata": self._decode_metadata_row(row),
        }

    def site_details(self, site_id: int) -> dict[str, Any]:
        self.require_capability("details")
        row = self._row_at("sites", site_id)
        return {
            "id": int(row["id"]),
            "position": float(row["position"]),
            "ancestral_state": row["ancestral_state"],
            "metadata": self._decode_metadata_row(row),
        }

    def individual_details(self, individual_id: int) -> dict[str, Any]:
        self.require_capability("details")
        row = self._row_at("individuals", individual_id)
        return {
            "id": int(row["id"]),
            "flags": int(row["flags"]),
            "location": list(row["location"] or []),
            "parents": list(row["parents"] or []),
            "nodes": list(row["nodes"] or []),
            "metadata": self._decode_metadata_row(row),
        }

    def population_details(self, population_id: int) -> dict[str, Any]:
        self.require_capability("details")
        row = self._row_at("populations", population_id)
        return {
            "id": int(row["id"]),
            "metadata": self._decode_metadata_row(row),
        }

    @staticmethod
    def _mutation_result(row: dict[str, Any]) -> dict[str, Any]:
        metadata = CSRArtifactReader._decode_metadata_row(row)
        return {
            "id": int(row["id"]),
            "site_id": int(row["site_id"]),
            "node_id": int(row["node_id"]),
            "parent_id": int(row["parent_id"]),
            "position": float(row["position"]),
            "time": float(row["time"]),
            "ancestral_state": row["ancestral_state"],
            "derived_state": row["derived_state"],
            "inherited_state": row["inherited_state"],
            "mutation": f"{row['ancestral_state']}->{row['derived_state']}",
            "metadata": metadata if metadata else None,
        }

    def mutations_in_range(
        self,
        start: float,
        end: float,
        *,
        offset: int = 0,
        limit: int = 1_000,
    ) -> dict[str, Any]:
        self.require_capability("mutations")
        start = float(start)
        end = float(end)
        offset = max(0, int(offset))
        limit = max(1, int(limit))
        if (
            not np.isfinite(start)
            or not np.isfinite(end)
            or start < 0
            or end > self.sequence_length
            or start >= end
        ):
            raise ValueError(
                "Mutation range must satisfy "
                f"0 <= start < end <= {self.sequence_length}"
            )
        positions = self._mapped_index("mutation_positions")
        left = int(np.searchsorted(positions, start, side="left"))
        right = int(np.searchsorted(positions, end, side="left"))
        total = max(0, right - left)
        selection_start = min(right, left + offset)
        selection_stop = min(right, selection_start + limit)
        table = self._sidecar_slice(
            "mutations",
            selection_start,
            selection_stop - selection_start,
        )
        rows = [
            self._mutation_result(row)
            for row in table.to_pylist()
        ]
        for row in rows:
            tree_index = self.tree_index_at_position(row["position"])
            interval_left, interval_right = self.interval_at_index(tree_index)
            row["tree_index"] = tree_index
            row["interval_left"] = interval_left
            row["interval_right"] = interval_right
        return {
            "mutations": rows,
            "total_count": total,
            "has_more": selection_stop < right,
            "start": start,
            "end": end,
            "offset": offset,
            "limit": limit,
        }

    def mutations_for_node(self, node_id: int) -> list[dict[str, Any]]:
        self.require_capability("mutations")
        node_id = int(node_id)
        offsets = self._mapped_index("node_mutation_offsets")
        if node_id < 0 or node_id + 1 >= len(offsets):
            raise IndexError(f"Node {node_id} is out of range")
        mutation_ids = np.asarray(
            self._mapped_index("node_mutation_ids")[
                int(offsets[node_id]) : int(offsets[node_id + 1])
            ],
            dtype=np.int32,
        )
        if len(mutation_ids) == 0:
            return []
        mutation_rows_by_id = self._mapped_index("mutation_rows_by_id")
        return [
            self._mutation_result(
                self._row_at(
                    "mutations",
                    int(mutation_rows_by_id[int(mutation_id)]),
                )
            )
            for mutation_id in mutation_ids
        ]

    def search_samples(self, query: str) -> list[dict[str, Any]]:
        self.require_capability("sample_search")
        normalized = str(query).casefold()
        return [
            {
                "node_id": int(row["node_id"]),
                "name": row["display_name"],
            }
            for row in self._sidecar_table("sample_names").to_pylist()
            if normalized in str(row["normalized_name"])
        ]

    def metadata_samples(
        self,
        key: str,
        value: Any,
        *,
        sources: Iterable[str] = ("individual", "node", "population"),
    ) -> dict[str, Any]:
        self.require_capability("metadata")
        normalized_value = _metadata_query_value(value)
        values = self.metadata_values(key, sources=sources)["sample_values"]
        node_ids = sorted(
            node_id
            for node_id, sample_value in values.items()
            if sample_value == normalized_value
        )
        names_by_node = {
            int(row["node_id"]): str(row["display_name"])
            for row in self._sidecar_table("sample_names").to_pylist()
        }
        return {
            "key": str(key),
            "value": value,
            "sample_node_ids": node_ids,
            "samples": [names_by_node.get(node_id, str(node_id)) for node_id in node_ids],
        }

    def metadata_values(
        self,
        key: str,
        *,
        sources: Iterable[str] = ("individual", "node", "population"),
    ) -> dict[str, Any]:
        self.require_capability("metadata")
        wanted_sources = {str(source) for source in sources}
        rows = [
            row
            for row in self._sidecar_table("metadata_samples").to_pylist()
            if row["source"] in wanted_sources and row["key"] == str(key)
        ]
        values = sorted({str(row["value"]) for row in rows})
        sample_map: dict[int, str] = {}
        for row in rows:
            for node_id in row["sample_node_ids"]:
                # Rows are ordered individual, node, population to preserve the
                # same first-source-wins precedence as the legacy metadata path.
                sample_map.setdefault(int(node_id), str(row["value"]))
        return {
            "key": str(key),
            "unique_values": values,
            "sample_values": sample_map,
        }

    def tree_ranges_for_node(self, node_id: int) -> list[tuple[int, int]]:
        self.require_capability("node_tree_ranges")
        node_id = int(node_id)
        offsets = self._mapped_index("node_tree_range_offsets")
        if node_id < 0 or node_id + 1 >= len(offsets):
            raise IndexError(f"Node {node_id} is out of range")
        start = int(offsets[node_id])
        stop = int(offsets[node_id + 1])
        return [
            (int(row["first_tree"]), int(row["last_tree_exclusive"]))
            for row in self._sidecar_slice(
                "node_tree_ranges",
                start,
                stop - start,
            ).to_pylist()
        ]

    def trees_at_indices(self, indices: Iterable[int]) -> list[GenealogyCSR]:
        requested = [int(index) for index in indices]
        if not requested:
            return []
        grouped: dict[int, list[tuple[int, int, dict[str, Any]]]] = defaultdict(list)
        for request_offset, tree_index in enumerate(requested):
            shard_offset, shard = self._shard_for_tree(tree_index)
            grouped[shard_offset].append((request_offset, tree_index, shard))

        results: list[GenealogyCSR | None] = [None] * len(requested)
        with self._lock:
            for shard_offset, requests in grouped.items():
                shard = requests[0][2]
                reader = self._open_shard(shard_offset, shard)
                decoded: dict[int, GenealogyCSR] = {}
                first_tree = int(shard["first_tree"])
                for request_offset, tree_index, _ in requests:
                    genealogy = decoded.get(tree_index)
                    if genealogy is None:
                        batch = reader.get_batch(tree_index - first_tree)
                        genealogy = _decode_genealogy(batch)
                        if genealogy.tree_index != tree_index:
                            raise CSRArtifactCorruptError(
                                f"Shard returned tree {genealogy.tree_index}, "
                                f"expected {tree_index}"
                            )
                        decoded[tree_index] = genealogy
                    results[request_offset] = genealogy
        return [result for result in results if result is not None]

    def verify(self) -> dict[str, Any]:
        verified_bytes = 0
        for metadata in self.manifest["indexes"].values():
            path = self.artifact_directory / metadata["name"]
            _verify_file(path, metadata)
            verified_bytes += int(metadata["size_bytes"])
        for shard in self._shards:
            path = self.artifact_directory / shard["name"]
            _verify_file(path, shard)
            verified_bytes += int(shard["size_bytes"])
            with pa.memory_map(str(path), "r") as source:
                reader = pa.ipc.open_file(source)
                if reader.num_record_batches != int(shard["batch_count"]):
                    raise CSRArtifactCorruptError(
                        f"Batch count mismatch for {shard['name']}"
                    )
        return {
            "ok": True,
            "fingerprint": self.manifest["fingerprint"],
            "num_trees": self.num_trees,
            "num_shards": len(self._shards),
            "verified_bytes": verified_bytes,
        }


__all__ = [
    "CSRArtifactCapabilityError",
    "CSRArtifactCorruptError",
    "CSRArtifactError",
    "CSRArtifactReader",
    "GenealogyCSR",
    "GenealogyMutations",
]
