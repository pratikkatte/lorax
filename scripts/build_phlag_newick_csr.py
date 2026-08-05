#!/usr/bin/env python3
"""Build Lorax CSR-v2 artifacts directly from PHLaG Newick gzip files.

The artifact is placed adjacent to each source as ``<newick.gz>.artifact``.
Genomic positions come from the matching ``positions-*.txt.gz`` file.  For N
trees they provide the first N breakpoints; the final breakpoint is the last
position plus ``--final-window-bp`` (10,000 bp by default).

Lorax's CSR schema calls its vertical coordinate ``node_times``.  For these
Newick artifacts the stored values are branch heights, not times: for a node,
``tree_height - cumulative_distance_from_root``.  Parent-child differences
therefore exactly preserve the input Newick branch lengths, including for
non-ultrametric trees.
"""

from __future__ import annotations

import argparse
import contextlib
import gzip
import json
import os
import re
import shutil
import sys
import time
import uuid
from pathlib import Path
from typing import Iterator

import numpy as np


BACKEND_DIRECTORY = Path(__file__).resolve().parents[1] / "packages" / "backend"
if str(BACKEND_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIRECTORY))

with contextlib.redirect_stdout(sys.stderr):
    import pyarrow as pa  # noqa: E402
    from ete3 import Tree  # noqa: E402
    from lorax.artifacts.csr_builder import (  # noqa: E402
        CSR_ARTIFACT_V2_FORMAT,
        CSR_ARTIFACT_V2_SCHEMA_VERSION,
        GENEALOGY_SCHEMA,
        MUTATION_TYPE,
        SHARD_INDEX_SCHEMA,
        _checksum,
        _write_json_atomic,
        _write_shard,
        artifact_path_for_source,
        source_fingerprint,
    )


REPOSITORY_DIRECTORY = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIRECTORY = (
    REPOSITORY_DIRECTORY.parent
    / "phlag"
    / "data"
    / "bo1929-phlag-avian-analysis-454f29a"
    / "sorted_genetrees"
)
DEFAULT_MAMMALIAN_INPUT_DIRECTORY = (
    REPOSITORY_DIRECTORY.parent
    / "phlag"
    / "data"
    / "bo1929-phlag-mammalian-analysis-a011ac3"
)
TREE_PATTERN = re.compile(
    r"^gene_trees-Stiller2024-(chr(?:[1-9]|1[0-9]|2[0-8]|Z))-sorted\.nwk\.gz$"
)
INTERNAL_NODE_BASE = 1_000_000
DEFAULT_TARGET_SHARD_MB = 48


def chromosome_sort_key(chromosome: str) -> tuple[int, int]:
    suffix = chromosome.removeprefix("chr")
    return (1, 0) if suffix == "Z" else (0, int(suffix))


def chromosomes_in(directory: Path) -> list[str]:
    found = []
    for path in directory.iterdir():
        match = TREE_PATTERN.match(path.name)
        if match:
            found.append(match.group(1))
    return sorted(found, key=chromosome_sort_key)


def source_paths(directory: Path, chromosome: str) -> tuple[Path, Path]:
    trees = directory / f"gene_trees-Stiller2024-{chromosome}-sorted.nwk.gz"
    positions = directory / f"positions-gene_trees-Stiller2024-{chromosome}-sorted.txt.gz"
    missing = [str(path) for path in (trees, positions) if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing PHLaG source file(s): " + ", ".join(missing))
    return trees, positions


def load_positions(path: Path, final_window_bp: int) -> np.ndarray:
    values: list[int] = []
    opener = gzip.open if path.name.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            text = line.strip()
            if not text:
                raise ValueError(f"{path}:{line_number} is empty")
            try:
                value = int(text)
            except ValueError as error:
                raise ValueError(f"{path}:{line_number} is not an integer: {text!r}") from error
            if values and value <= values[-1]:
                raise ValueError(f"{path}:{line_number} is not strictly increasing")
            values.append(value)
    if not values:
        raise ValueError(f"{path} has no genomic positions")
    return np.asarray([*values, values[-1] + final_window_bp], dtype=np.float64)


def newick_rows(path: Path) -> Iterator[tuple[int, str]]:
    with gzip.open(path, "rt", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            newick = line.strip()
            if not newick:
                raise ValueError(f"{path}:{line_number} is empty")
            yield line_number - 1, newick


def _list_array(values: np.ndarray, value_type: pa.DataType) -> pa.Array:
    return pa.array([values], type=pa.list_(value_type))


def newick_record_batch(
    newick: str,
    tree_index: int,
    interval_left: float,
    interval_right: float,
    sample_ids: dict[str, int],
) -> tuple[pa.RecordBatch, float, int, int]:
    tree = Tree(newick, format=1)
    nodes = list(tree.traverse("postorder"))
    if not nodes:
        raise ValueError(f"Tree {tree_index} has no nodes")

    assigned: dict[object, int] = {}
    internal_offset = 0
    for node in nodes:
        if node.is_leaf():
            name = str(node.name)
            if name not in sample_ids:
                if len(sample_ids) >= INTERNAL_NODE_BASE:
                    raise ValueError("Too many distinct samples for reserved CSR node IDs")
                sample_ids[name] = len(sample_ids)
            assigned[node] = sample_ids[name]
        else:
            assigned[node] = INTERNAL_NODE_BASE + internal_offset
            internal_offset += 1

    root_distance: dict[object, float] = {tree: 0.0}
    for node in tree.traverse("preorder"):
        if node.up is not None:
            branch_length = float(node.dist or 0.0)
            if not np.isfinite(branch_length) or branch_length < 0:
                raise ValueError(
                    f"Tree {tree_index} has invalid branch length {branch_length!r}"
                )
            root_distance[node] = root_distance[node.up] + branch_length
    tree_height = max(root_distance.values(), default=0.0)

    x_by_node: dict[object, float] = {}
    tip_count = 0
    for node in nodes:
        if node.is_leaf():
            x_by_node[node] = float(tip_count)
            tip_count += 1
        else:
            child_x = [x_by_node[child] for child in node.children]
            x_by_node[node] = (min(child_x) + max(child_x)) / 2.0
    denominator = max(1, tip_count - 1)

    ordered = sorted(nodes, key=assigned.__getitem__)
    node_ids = np.asarray([assigned[node] for node in ordered], dtype=np.int32)
    parent_ids = np.asarray(
        [-1 if node.up is None else assigned[node.up] for node in ordered], dtype=np.int32
    )
    node_heights = np.asarray(
        [tree_height - root_distance[node] for node in ordered], dtype=np.float64
    )
    node_flags = np.asarray([1 if node.is_leaf() else 0 for node in ordered], dtype=np.uint32)
    layout_x = np.asarray([x_by_node[node] / denominator for node in ordered], dtype=np.float32)

    local_by_id = {int(node_id): offset for offset, node_id in enumerate(node_ids)}
    children: list[list[int]] = [[] for _ in ordered]
    for node_id, parent_id in zip(node_ids, parent_ids):
        if int(parent_id) != -1:
            children[local_by_id[int(parent_id)]].append(int(node_id))
    child_offsets = np.zeros(len(ordered) + 1, dtype=np.int32)
    child_node_ids_list: list[int] = []
    for offset, child_ids in enumerate(children):
        child_node_ids_list.extend(child_ids)
        child_offsets[offset + 1] = len(child_node_ids_list)
    child_node_ids = np.asarray(child_node_ids_list, dtype=np.int32)

    arrays = [
        pa.array([tree_index], type=pa.int64()),
        pa.array([interval_left], type=pa.float64()),
        pa.array([interval_right], type=pa.float64()),
        _list_array(node_ids, pa.int32()),
        _list_array(parent_ids, pa.int32()),
        _list_array(child_offsets, pa.int32()),
        _list_array(child_node_ids, pa.int32()),
        _list_array(node_heights, pa.float64()),
        _list_array(node_flags, pa.uint32()),
        _list_array(layout_x, pa.float32()),
        pa.array([[]], type=pa.list_(MUTATION_TYPE)),
    ]
    return (
        pa.RecordBatch.from_arrays(arrays, schema=GENEALOGY_SCHEMA),
        tree_height,
        len(nodes),
        len(nodes) - 1,
    )


def write_shard_index(path: Path, shards: list[dict[str, object]]) -> None:
    table = pa.Table.from_pylist(shards, schema=SHARD_INDEX_SCHEMA)
    with pa.OSFile(str(path), "wb") as sink:
        with pa.ipc.new_file(sink, SHARD_INDEX_SCHEMA) as writer:
            writer.write_table(table)


def build_chromosome(
    input_directory: Path,
    chromosome: str,
    *,
    final_window_bp: int,
    target_shard_mb: int,
    compression: str,
    force: bool,
    limit: int | None,
    trees_path: Path | None = None,
    positions_path: Path | None = None,
    dataset_name: str = "avian",
) -> dict[str, object]:
    if trees_path is None or positions_path is None:
        trees_path, positions_path = source_paths(input_directory, chromosome)
    trees_path = trees_path.resolve()
    positions_path = positions_path.resolve()
    if not trees_path.is_file() or not positions_path.is_file():
        raise FileNotFoundError(
            "Missing PHLaG source file(s): "
            + ", ".join(
                str(path)
                for path in (trees_path, positions_path)
                if not path.is_file()
            )
        )
    breakpoints = load_positions(positions_path, final_window_bp)
    if limit is not None:
        breakpoints = breakpoints[: limit + 1]
    expected_trees = len(breakpoints) - 1
    destination = artifact_path_for_source(trees_path)
    if destination.exists() and not force:
        raise FileExistsError(f"Artifact already exists: {destination} (use --force)")

    staging = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.inprogress")
    staging.mkdir(parents=True)
    started = time.perf_counter()
    sample_ids: dict[str, int] = {}
    pending: list[pa.RecordBatch] = []
    pending_bytes = 0
    shards: list[dict[str, object]] = []
    max_branch_height = 0.0
    total_nodes = 0
    total_edges = 0
    target_bytes = target_shard_mb * 1024 * 1024

    def flush() -> None:
        nonlocal pending, pending_bytes
        if pending:
            shards.append(_write_shard(staging, len(shards), pending, compression))
            pending = []
            pending_bytes = 0

    try:
        seen_trees = 0
        for tree_index, newick in newick_rows(trees_path):
            if tree_index >= expected_trees:
                if limit is not None:
                    break
                raise ValueError(f"{trees_path} has more trees than {positions_path} has positions")
            record, height, node_count, edge_count = newick_record_batch(
                newick,
                tree_index,
                float(breakpoints[tree_index]),
                float(breakpoints[tree_index + 1]),
                sample_ids,
            )
            if pending and pending_bytes + record.nbytes > target_bytes:
                flush()
            pending.append(record)
            pending_bytes += record.nbytes
            max_branch_height = max(max_branch_height, height)
            total_nodes += node_count
            total_edges += edge_count
            seen_trees += 1
            if seen_trees % 500 == 0:
                print(
                    json.dumps({"chromosome": chromosome, "trees_processed": seen_trees}),
                    file=sys.stderr,
                    flush=True,
                )
        if seen_trees != expected_trees:
            raise ValueError(
                f"Row mismatch for {chromosome}: {seen_trees} trees and "
                f"{expected_trees} positions"
            )
        flush()

        breakpoints_path = staging / "breakpoints.npy"
        np.save(breakpoints_path, breakpoints, allow_pickle=False)
        shard_index_path = staging / "shards.arrow"
        write_shard_index(shard_index_path, shards)
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
        tree_stat = trees_path.stat()
        position_stat = positions_path.stat()
        fingerprint = source_fingerprint(trees_path)
        shard_bytes = sum(int(shard["size_bytes"]) for shard in shards)
        manifest = {
            "schema_version": CSR_ARTIFACT_V2_SCHEMA_VERSION,
            "format": CSR_ARTIFACT_V2_FORMAT,
            "builder_version": "phlag-newick-csr-v1",
            "created_at_unix": int(time.time()),
            "build_seconds": round(time.perf_counter() - started, 3),
            "fingerprint": fingerprint,
            "source": {
                "path": str(trees_path.resolve()),
                "name": trees_path.name,
                "size_bytes": tree_stat.st_size,
                "mtime_ns": tree_stat.st_mtime_ns,
                "sha256": fingerprint,
            },
            "inputs": {
                "positions": {
                    "path": str(positions_path.resolve()),
                    "name": positions_path.name,
                    "size_bytes": position_stat.st_size,
                    "mtime_ns": position_stat.st_mtime_ns,
                    "sha256": source_fingerprint(positions_path),
                }
            },
            "dataset": {
                "phlag_dataset": dataset_name,
                "chromosome": chromosome,
                "sequence_start": float(breakpoints[0]),
                "sequence_length": float(breakpoints[-1]),
                "num_trees": expected_trees,
                "num_nodes": total_nodes,
                "num_edges": total_edges,
                "num_samples": len(sample_ids),
                "num_sites": 0,
                "num_mutations": 0,
                "num_individuals": 0,
                "num_populations": 0,
                "time_units": "branch length",
                "global_min_time": 0.0,
                "global_max_time": max_branch_height,
            },
            "build": {
                "compression": compression,
                "target_shard_bytes": target_bytes,
                "complete_unsparsified_genealogies": True,
                "precomputed_layout_x": True,
                "vertical_coordinate": "tree_height_minus_cumulative_root_branch_length",
                "final_window_bp": final_window_bp,
            },
            "capabilities": {
                "render": True,
                "intervals": True,
                "lineage": False,
                "topology_comparison": False,
            },
            "indexes": indexes,
            "artifact": {
                "num_shards": len(shards),
                "size_bytes": shard_bytes + sum(item["size_bytes"] for item in indexes.values()),
            },
        }
        _write_json_atomic(staging / "manifest.json", manifest)
        if destination.exists():
            shutil.rmtree(destination)
        os.replace(staging, destination)
        return {
            "chromosome": chromosome,
            "artifact_dir": str(destination),
            "num_trees": expected_trees,
            "num_samples": len(sample_ids),
            "max_branch_height": max_branch_height,
        }
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset",
        choices=("avian", "mammalian"),
        default="avian",
        help="PHLaG release layout to process",
    )
    parser.add_argument("--input-dir", type=Path)
    parser.add_argument("--chromosome", action="append", help="Repeat to select chromosomes")
    parser.add_argument("--final-window-bp", type=int, default=10_000)
    parser.add_argument("--target-shard-mb", type=int, default=DEFAULT_TARGET_SHARD_MB)
    parser.add_argument("--compression", choices=("zstd", "lz4", "none"), default="zstd")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, help="Smoke-test only: at most N trees per chromosome")
    parser.add_argument("--verify", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.final_window_bp < 1 or args.target_shard_mb < 1:
        raise SystemExit("--final-window-bp and --target-shard-mb must be positive")
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be positive")
    default_directory = (
        DEFAULT_MAMMALIAN_INPUT_DIRECTORY
        if args.dataset == "mammalian"
        else DEFAULT_INPUT_DIRECTORY
    )
    input_directory = (args.input_dir or default_directory).resolve()
    if args.dataset == "mammalian":
        available = ["chr3"]
        requested = args.chromosome or available
        trees_override = input_directory / "alltrees.tree.gz"
        positions_override = input_directory / "pos"
    else:
        available = chromosomes_in(input_directory)
        requested = args.chromosome or available
        trees_override = None
        positions_override = None
    requested = sorted(dict.fromkeys(requested), key=chromosome_sort_key)
    unknown = sorted(set(requested) - set(available), key=chromosome_sort_key)
    if unknown:
        raise SystemExit("No Newick source for: " + ", ".join(unknown))

    results = []
    for chromosome in requested:
        result = build_chromosome(
            input_directory,
            chromosome,
            final_window_bp=args.final_window_bp,
            target_shard_mb=args.target_shard_mb,
            compression=args.compression,
            force=args.force,
            limit=args.limit,
            trees_path=trees_override,
            positions_path=positions_override,
            dataset_name=args.dataset,
        )
        if args.verify:
            from lorax.artifacts.csr_reader import CSRArtifactReader

            with CSRArtifactReader.open(result["artifact_dir"]) as reader:
                result["verification"] = reader.verify()
        results.append(result)
        print(json.dumps(result, sort_keys=True), flush=True)
    print(json.dumps({"status": "ready", "chromosomes": results}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
