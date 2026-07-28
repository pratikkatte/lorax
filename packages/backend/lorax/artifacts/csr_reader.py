"""Memory-bounded random access to lorax-csr-v2 genealogy artifacts."""

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

from lorax.artifacts.csr_builder import (
    CSR_ARTIFACT_FORMAT,
    CSR_ARTIFACT_SCHEMA_VERSION,
)


class CSRArtifactError(RuntimeError):
    """Base error for invalid or unreadable CSR artifacts."""


class CSRArtifactCorruptError(CSRArtifactError):
    """Raised when an artifact checksum or structural invariant fails."""


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

    def children(self, node_id: int) -> np.ndarray:
        offset = self.node_offset(node_id)
        left = int(self.child_offsets[offset])
        right = int(self.child_offsets[offset + 1])
        return self.child_node_ids[left:right]

    def is_tip(self, node_id: int) -> bool:
        offset = self.node_offset(node_id)
        return bool(self.child_offsets[offset] == self.child_offsets[offset + 1])


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
        if (
            self.manifest.get("format") != CSR_ARTIFACT_FORMAT
            or self.manifest.get("schema_version") != CSR_ARTIFACT_SCHEMA_VERSION
        ):
            raise CSRArtifactError(
                f"Unsupported CSR artifact at {self.artifact_directory}"
            )
        if max_open_shards < 1:
            raise ValueError("max_open_shards must be at least 1")
        self.max_open_shards = max_open_shards
        self._lock = threading.RLock()
        self._closed = False
        self._open_shards: OrderedDict[
            int, tuple[pa.NativeFile, pa.ipc.RecordBatchFileReader]
        ] = OrderedDict()

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
        if len(self.breakpoints) != self.num_trees + 1:
            raise CSRArtifactCorruptError("Breakpoint index length is invalid")
        expected_tree = 0
        for shard in self._shards:
            if int(shard["first_tree"]) != expected_tree:
                raise CSRArtifactCorruptError("Shard tree ranges are not contiguous")
            expected_tree = int(shard["last_tree_exclusive"])
        if expected_tree != self.num_trees:
            raise CSRArtifactCorruptError("Shard index does not cover every genealogy")

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
            mmap = getattr(self.breakpoints, "_mmap", None)
            if mmap is not None:
                mmap.close()
            self._closed = True

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
            return cached[1]
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
        return reader

    def tree_at_index(self, tree_index: int) -> GenealogyCSR:
        return self.trees_at_indices([tree_index])[0]

    def tree_at_position(self, position: float) -> GenealogyCSR:
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
        return self.tree_at_index(tree_index)

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
    "CSRArtifactCorruptError",
    "CSRArtifactError",
    "CSRArtifactReader",
    "GenealogyCSR",
    "GenealogyMutations",
]
