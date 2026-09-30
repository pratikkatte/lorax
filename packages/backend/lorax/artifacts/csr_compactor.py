"""Losslessly regroup local v3 artifacts into resumable v4 artifacts.

Sources are preserved unless removal is explicitly requested. In that mode,
each old shard is removed only after its replacement passes field comparison,
is flushed to disk, and has a durable checksum checkpoint. The original tree
sequence and all source indexes are always preserved.
"""

from __future__ import annotations

import copy
import dataclasses
import fcntl
import hashlib
import json
import math
import multiprocessing
import os
import shutil
import time
from concurrent.futures import FIRST_COMPLETED, ProcessPoolExecutor, wait
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pyarrow as pa

from lorax.artifacts.csr_builder import (
    CSR_ARTIFACT_FORMAT,
    CSR_ARTIFACT_V4_FORMAT,
    CSR_ARTIFACT_V4_SCHEMA_VERSION,
    GENEALOGY_SCHEMA,
    V4_TREES_PER_BATCH,
    _checksum,
    _write_shard_index,
)
from lorax.artifacts.csr_reader import CSRArtifactCorruptError, CSRArtifactReader, _decode_genealogy


def _sync(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _checkpoint(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_suffix(".tmp")
    with temporary.open("w") as stream:
        json.dump(payload, stream, sort_keys=True, separators=(",", ":"))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)
    _sync(path.parent)


def _file_metadata(path: Path) -> dict[str, Any]:
    return {"name": path.name, "size_bytes": path.stat().st_size, "sha256": _checksum(path)}


def _safe_file(directory: Path, name: str) -> Path:
    if not name or Path(name).name != name or name in {".", ".."}:
        raise ValueError(f"Unsafe artifact filename: {name!r}")
    path = directory / name
    if path.is_symlink():
        raise ValueError(f"Artifact symlinks are not supported: {path}")
    return path


def _verify_file(directory: Path, metadata: dict[str, Any]) -> Path:
    path = _safe_file(directory, metadata["name"])
    if path.stat().st_size != int(metadata["size_bytes"]) or _checksum(path) != metadata["sha256"]:
        raise CSRArtifactCorruptError(f"Checksum or size mismatch: {path}")
    return path


def _equal_genealogies(left, right) -> None:
    for field in dataclasses.fields(left):
        a, b = getattr(left, field.name), getattr(right, field.name)
        if isinstance(a, np.ndarray):
            # Byte equality preserves floating-point values and NaN payloads.
            equal = a.dtype == b.dtype and a.shape == b.shape and a.tobytes() == b.tobytes()
        elif dataclasses.is_dataclass(a):
            _equal_genealogies(a, b)
            continue
        else:
            equal = a == b
        if not equal:
            raise CSRArtifactCorruptError(f"Compaction changed field {field.name}")


def _compact_shard(source: str, staging: str, shard: dict[str, Any], breakpoints_name: str) -> dict[str, Any]:
    """Write, reopen, and compare every decoded field before returning a shard."""
    source_dir, staging_dir = Path(source), Path(staging)
    original = _verify_file(source_dir, shard)
    before = original.stat()
    target = _safe_file(staging_dir, shard["name"])
    partial = target.with_suffix(".partial")
    breakpoints = np.load(staging_dir / breakpoints_name, mmap_mode="r", allow_pickle=False)
    first, last = int(shard["first_tree"]), int(shard["last_tree_exclusive"])
    count = last - first
    try:
        with pa.memory_map(str(original), "r") as stream:
            reader = pa.ipc.open_file(stream)
            if not reader.schema.equals(GENEALOGY_SCHEMA) or reader.num_record_batches != count:
                raise CSRArtifactCorruptError(f"Invalid v3 genealogy shard: {original}")
            with pa.OSFile(str(partial), "wb") as sink:
                with pa.ipc.new_file(sink, reader.schema, options=pa.ipc.IpcWriteOptions(compression="zstd")) as writer:
                    for start in range(0, count, V4_TREES_PER_BATCH):
                        rows = [reader.get_batch(i) for i in range(start, min(start + V4_TREES_PER_BATCH, count))]
                        if any(row.num_rows != 1 for row in rows):
                            raise CSRArtifactCorruptError(f"Invalid v3 row count: {original}")
                        writer.write_table(pa.Table.from_batches(rows).combine_chunks(), max_chunksize=V4_TREES_PER_BATCH)
            with pa.memory_map(str(partial), "r") as compact_stream:
                compact = pa.ipc.open_file(compact_stream)
                if not reader.schema.equals(compact.schema, check_metadata=True):
                    raise CSRArtifactCorruptError("Compaction changed the Arrow schema")
                if compact.num_record_batches != math.ceil(count / V4_TREES_PER_BATCH):
                    raise CSRArtifactCorruptError("Incorrect compact batch count")
                offset = 0
                for batch_index in range(compact.num_record_batches):
                    batch = compact.get_batch(batch_index)
                    if batch.num_rows != min(V4_TREES_PER_BATCH, count - offset):
                        raise CSRArtifactCorruptError("Incorrect compact row count")
                    for row_index in range(batch.num_rows):
                        old = _decode_genealogy(reader.get_batch(offset))
                        new = _decode_genealogy(batch.slice(row_index, 1))
                        _equal_genealogies(old, new)
                        tree_index = first + offset
                        if (new.tree_index != tree_index or new.interval_left != breakpoints[tree_index]
                                or new.interval_right != breakpoints[tree_index + 1]):
                            raise CSRArtifactCorruptError("Genealogy differs from the breakpoint index")
                        offset += 1
        after = original.stat()
        if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
            raise CSRArtifactCorruptError(f"Source changed during compaction: {original}")
        _sync(partial)
        os.replace(partial, target)
        _sync(staging_dir)
        return {**shard, **_file_metadata(target), "batch_count": math.ceil(count / V4_TREES_PER_BATCH)}
    finally:
        partial.unlink(missing_ok=True)


def compact_csr_artifact(
    source_artifact: str | Path,
    destination: str | Path,
    *,
    source_file: str | Path | None = None,
    workers: int = 1,
    remove_verified_source_shards: bool = False,
    progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    """Convert v3 without rebuilding layouts/features; resume an interrupted run.

    Removal requires the matching original tree sequence to be present and
    checksum-verified. A source backup becomes incomplete in this mode; the
    published cloud artifact is not modified. Rerun with identical paths to
    resume. Never run this against a source currently serving readers.
    """
    source = Path(source_artifact).expanduser().resolve()
    target = Path(destination).expanduser().resolve()
    if source == target or source in target.parents or target in source.parents:
        raise ValueError("Source and destination artifact directories must be separate")
    if target.exists():
        raise FileExistsError(f"Destination already exists: {target}")
    if workers < 1:
        raise ValueError("workers must be positive")
    if remove_verified_source_shards and source_file is None:
        raise ValueError("Removing shards requires source_file for fingerprint verification")
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = target.with_name(f".{target.name}.compacting")
    if staging.is_symlink():
        raise ValueError("Staging directory cannot be a symlink")
    staging.mkdir(exist_ok=True)
    # Lock the directory inode: no stale PID files, and the lock survives rename.
    lock = os.open(staging, os.O_RDONLY)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return _compact_locked(source, target, staging, source_file, workers,
                               remove_verified_source_shards, progress)
    finally:
        os.close(lock)


def _compact_locked(source, target, staging, source_file, workers, remove_shards, progress):
    manifest_bytes = (source / "manifest.json").read_bytes()
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    manifest = json.loads(manifest_bytes)
    if (manifest.get("format"), manifest.get("schema_version")) != (CSR_ARTIFACT_FORMAT, 3):
        raise ValueError("Compaction requires a v3 artifact; v2 conversion is out of scope")
    # Opening validates indexes/ranges but does not require old completed shards.
    with CSRArtifactReader(source) as reader:
        shards = copy.deepcopy(reader._shards)
    names = [item["name"] for item in shards] + [item["name"] for item in manifest["indexes"].values()]
    if len(names) != len(set(names)):
        raise ValueError("Artifact filenames must be unique")
    for name in names:
        _safe_file(source, name)
        _safe_file(staging, name)
    source_metadata = copy.deepcopy(manifest["source"])
    if source_file is not None:
        original = Path(source_file).expanduser().resolve()
        before = original.stat()
        fingerprint = _checksum(original)
        stat = original.stat()
        if ((before.st_size, before.st_mtime_ns) != (stat.st_size, stat.st_mtime_ns)
                or fingerprint != manifest["fingerprint"] or fingerprint != source_metadata["sha256"]):
            raise CSRArtifactCorruptError("Original tree sequence fingerprint mismatch")
        source_metadata.update(path=str(original), name=original.name, size_bytes=stat.st_size, mtime_ns=stat.st_mtime_ns)
    state_path = staging / "compaction-state.json"
    identity = {"version": 1, "source_artifact": str(source), "destination": str(target), "source_manifest_sha256": manifest_hash}
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if any(state.get(key) != value for key, value in identity.items()):
            raise ValueError("Compaction checkpoint belongs to a different source or destination")
    else:
        if any(staging.iterdir()):
            raise ValueError(f"Unrecognized staging directory: {staging}")
        state = {**identity, "started_at_unix": time.time(), "completed": {}, "removed_source_shards": False}
        _checkpoint(state_path, state)
    # Verify and preserve every feature index before considering shard removal.
    indexes = copy.deepcopy(manifest["indexes"])
    for key, metadata in indexes.items():
        input_path = _verify_file(source, metadata)
        if key == "shards":
            continue
        output_path = staging / metadata["name"]
        if key == "config":
            config = json.loads(input_path.read_text())
            config["artifact_format"] = CSR_ARTIFACT_V4_FORMAT
            _checkpoint(output_path, config)
        else:
            partial = output_path.with_suffix(".partial")
            shutil.copyfile(input_path, partial)
            _verify_file(staging, {**metadata, "name": partial.name})
            _sync(partial)
            os.replace(partial, output_path)
        indexes[key] = {**metadata, **_file_metadata(output_path)}
    _sync(staging)

    def emit(stage):
        if progress is not None:
            completed = list(state["completed"].values())
            progress({"stage": stage, "shards_done": len(completed), "shards_total": len(shards),
                      "trees_verified": sum(s["last_tree_exclusive"] - s["first_tree"] for s in completed),
                      "shard_bytes": sum(s["size_bytes"] for s in completed),
                      "elapsed_seconds": round(time.time() - state["started_at_unix"], 3)})

    def remove_original(shard):
        if remove_shards:
            old = _safe_file(source, shard["name"])
            if old.exists():
                # Recheck immediately before deletion, including on resume.
                _verify_file(source, shard)
                old.unlink()
                _sync(source)

    completed = state["completed"]
    expected_names = {s["name"] for s in shards}
    if set(completed) - expected_names:
        raise ValueError("Checkpoint contains unknown shards")
    if remove_shards:
        state["removed_source_shards"] = True
        _checkpoint(state_path, state)
    for shard in shards:
        if shard["name"] in completed:
            saved = completed[shard["name"]]
            if any(saved[key] != shard[key] for key in ("name", "shard_id", "first_tree", "last_tree_exclusive")):
                raise CSRArtifactCorruptError("Checkpoint shard range mismatch")
            _verify_file(staging, saved)
            remove_original(shard)
        elif not (source / shard["name"]).is_file():
            raise FileNotFoundError(f"Uncheckpointed source shard is missing: {shard['name']}")

    def commit(shard, result):
        completed[shard["name"]] = result
        _checkpoint(state_path, state)
        remove_original(shard)
        emit("compacting")

    pending = [s for s in shards if s["name"] not in completed]
    emit("resuming" if completed else "starting")
    # Bound in-flight work and leave conservative space for its outputs.
    def check_space():
        required = max((s["size_bytes"] for s in pending), default=0) * min(workers, len(pending)) + 256 * 1024**2
        if shutil.disk_usage(staging).free < required:
            raise OSError(f"Insufficient staging space: need at least {required} free bytes; progress is resumable")

    breakpoints_name = indexes["breakpoints"]["name"]
    if workers == 1:
        for shard in pending:
            check_space()
            result = _compact_shard(str(source), str(staging), shard, breakpoints_name)
            commit(shard, result)
    elif pending:
        check_space()
        with ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context("spawn")) as pool:
            queue = iter(pending)
            futures = {}

            def submit():
                shard = next(queue, None)
                if shard is not None:
                    check_space()
                    futures[pool.submit(_compact_shard, str(source), str(staging), shard, breakpoints_name)] = shard

            for _ in range(min(workers, len(pending))):
                submit()
            while futures:
                done, _ = wait(futures, return_when=FIRST_COMPLETED)
                for future in done:
                    shard = futures.pop(future)
                    commit(shard, future.result())
                    submit()

    _write_shard_index(staging / indexes["shards"]["name"], [completed[s["name"]] for s in shards])
    _sync(staging / indexes["shards"]["name"])
    indexes["shards"] = _file_metadata(staging / indexes["shards"]["name"])
    output = copy.deepcopy(manifest)
    total_bytes = sum(s["size_bytes"] for s in completed.values()) + sum(s["size_bytes"] for s in indexes.values())
    output.update(format=CSR_ARTIFACT_V4_FORMAT, schema_version=CSR_ARTIFACT_V4_SCHEMA_VERSION,
                  created_at_unix=int(time.time()), source=source_metadata, indexes=indexes)
    output["build"].update(trees_per_batch=V4_TREES_PER_BATCH, compression="zstd")
    output["artifact"].update(size_bytes=total_bytes, output_source_ratio=total_bytes / source_metadata["size_bytes"])
    output["compaction"] = {**identity, "seconds": round(time.time() - state["started_at_unix"], 3),
                            "all_decoded_fields_equal": True, "trees_verified": manifest["dataset"]["num_trees"],
                            "removed_source_shards": state["removed_source_shards"]}
    _checkpoint(staging / "manifest.json", output)
    emit("verifying")
    with CSRArtifactReader(staging) as reader:
        verification = reader.verify()
    # Refuse a concurrent publish; no existing artifact is replaced.
    if target.exists():
        raise FileExistsError(target)
    staging.rename(target)
    _sync(target.parent)
    (target / "compaction-state.json").unlink()
    _sync(target)
    emit("complete")
    return {"artifact_dir": str(target), "format": output["format"], "size_bytes": total_bytes,
            "trees_verified": output["dataset"]["num_trees"], "verification": verification,
            "source_shards_removed": state["removed_source_shards"]}
