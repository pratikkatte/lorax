#!/usr/bin/env python3
"""
Benchmark Lorax load and render pipeline for manuscript tables.

Measures load time (tszip + config), tree layout time (construct_trees_batch),
RSS memory, and buffer size. Supports N replicates per file with mean ± SD.

Usage:
    python benchmark_load_render.py --dir packages/backend/UPLOADS/Uploads \\
        --output manuscript_benchmark.csv --replicates 5
"""

import argparse
import asyncio
import csv
import logging
import re
import statistics
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import psutil

# Configure logging - suppress verbose Lorax prints during benchmark
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Reduce noise from Lorax internals
logging.getLogger("lorax").setLevel(logging.WARNING)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark Lorax load and render pipeline for manuscript tables.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--dir",
        type=str,
        default=None,
        help="Directory to glob for .tsz files (mutually exclusive with --files)",
    )
    parser.add_argument(
        "--files",
        type=str,
        default=None,
        help="Comma-separated .tsz file paths (mutually exclusive with --dir)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="manuscript_benchmark.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--viewport-size",
        type=int,
        default=10,
        help="Number of trees in first layout batch",
    )
    parser.add_argument(
        "--replicates",
        type=int,
        default=1,
        help="N runs per file; report mean ± SD for timing and RSS",
    )
    parser.add_argument(
        "--warmup",
        action="store_true",
        help="Discard first measurement per file (warmup run)",
    )
    return parser.parse_args()


def collect_files(args: argparse.Namespace) -> List[Path]:
    """Collect .tsz file paths from --dir or --files."""
    if args.dir and args.files:
        raise ValueError("Use --dir or --files, not both.")
    if args.dir:
        dir_path = Path(args.dir)
        if not dir_path.is_dir():
            raise ValueError(f"Directory not found: {dir_path}")
        files = sorted(dir_path.glob("*.tsz"))
        if not files:
            raise ValueError(f"No .tsz files in {dir_path}")
        return files
    if args.files:
        paths = [Path(p.strip()) for p in args.files.split(",") if p.strip()]
        missing = [p for p in paths if not p.exists()]
        if missing:
            raise ValueError(f"Files not found: {missing}")
        return [p for p in paths if p.suffix == ".tsz" or str(p).endswith(".tsz")]
    raise ValueError("Provide --dir or --files")


def parse_metadata_from_filename(path: Path) -> Dict[str, Optional[int]]:
    """Parse num_individuals and Ne from exp.py-style filenames if possible."""
    # Use stem but strip .trees from double extension (e.g. file.trees.tsz -> file.trees)
    name = path.stem
    if name.endswith(".trees"):
        name = name[:-6]  # strip ".trees"
    # e.g. simulated_chr22_100k_Ne5k or simulated_1M_Ne50k
    out: Dict[str, Optional[int]] = {"num_individuals_from_file": None, "ne_from_file": None}

    # Sample size: _100k_Ne or _1M_Ne (before Ne to avoid matching Ne5k)
    m = re.search(r"_(\d+)k_Ne", name, re.I)
    if m:
        out["num_individuals_from_file"] = int(m.group(1)) * 1000
    else:
        m = re.search(r"_(\d+)M_Ne", name, re.I)
        if m:
            out["num_individuals_from_file"] = int(m.group(1)) * 1_000_000

    # Ne: Ne5k, Ne50k, Ne1M
    m = re.search(r"Ne(\d+)k", name, re.I)
    if m:
        out["ne_from_file"] = int(m.group(1)) * 1000
    else:
        m = re.search(r"Ne(\d+)M", name, re.I)
        if m:
            out["ne_from_file"] = int(m.group(1)) * 1_000_000

    return out


async def run_one_replicate(
    file_path: str,
    root_dir: str,
    viewport_size: int,
) -> Dict[str, Any]:
    """Run load + tree layout once, return metrics."""
    from lorax.cache import evict_file, get_file_context
    from lorax.loaders.loader import compute_config
    from lorax.tree_graph import construct_trees_batch

    # Evict to force cold load
    evict_file(file_path)

    process = psutil.Process()
    rss_before = process.memory_info().rss

    # 1. Load
    t0 = time.perf_counter()
    ctx = await get_file_context(file_path, root_dir)
    load_time = time.perf_counter() - t0

    if ctx is None:
        raise RuntimeError(f"Failed to load {file_path}")

    ts = ctx.tree_sequence
    if not hasattr(ts, "num_trees"):
        raise RuntimeError(f"CSV files not supported: {file_path}")

    rss_after = process.memory_info().rss

    # 2. Tree layout (first viewport batch)
    num_trees = ts.num_trees
    tree_indices = list(range(min(viewport_size, num_trees)))

    t1 = time.perf_counter()
    buffer, _, _, _, _ = construct_trees_batch(
        ts,
        tree_indices,
        sparsification=len(tree_indices) > 1,
        sparsify_mutations=True,
        pre_cached_graphs={},
    )
    tree_layout_time = time.perf_counter() - t1

    buffer_size_kb = len(buffer) / 1024

    return {
        "load_time_sec": load_time,
        "tree_layout_time_sec": tree_layout_time,
        "rss_after_load_mb": rss_after / (1024 * 1024),
        "buffer_size_kb": buffer_size_kb,
        "num_individuals": ts.num_samples // 2 if ts.num_samples else 0,
        "num_nodes": ts.num_nodes,
        "num_edges": ts.num_edges,
        "num_trees": ts.num_trees,
        "num_mutations": ts.num_mutations,
        "num_haplotypes": ts.num_samples,
    }


def aggregate_replicates(
    replicates: List[Dict[str, Any]],
    file_path: Path,
    file_size_mb: float,
    metadata: Dict[str, Optional[int]],
) -> Dict[str, Any]:
    """Compute mean ± SD and build output row."""
    n = len(replicates)
    load_times = [r["load_time_sec"] for r in replicates]
    tree_layout_times = [r["tree_layout_time_sec"] for r in replicates]
    rss_values = [r["rss_after_load_mb"] for r in replicates]

    row: Dict[str, Any] = {
        "file": str(file_path.name),
        "file_path": str(file_path),
        "file_size_mb": round(file_size_mb, 4),
        "num_individuals": replicates[0]["num_individuals"],
        "num_haplotypes": replicates[0]["num_haplotypes"],
        "num_nodes": replicates[0]["num_nodes"],
        "num_edges": replicates[0]["num_edges"],
        "num_trees": replicates[0]["num_trees"],
        "num_mutations": replicates[0]["num_mutations"],
        "buffer_size_kb": round(replicates[0]["buffer_size_kb"], 2),
        "ne_from_file": metadata.get("ne_from_file", ""),
    }

    if n == 1:
        row["load_time_mean"] = round(load_times[0], 6)
        row["load_time_sd"] = 0
        row["tree_layout_time_mean"] = round(tree_layout_times[0], 6)
        row["tree_layout_time_sd"] = 0
        row["rss_mean"] = round(rss_values[0], 2)
        row["rss_sd"] = 0
    else:
        row["load_time_mean"] = round(statistics.mean(load_times), 6)
        row["load_time_sd"] = round(statistics.stdev(load_times), 6)
        row["tree_layout_time_mean"] = round(statistics.mean(tree_layout_times), 6)
        row["tree_layout_time_sd"] = round(statistics.stdev(tree_layout_times), 6)
        row["rss_mean"] = round(statistics.mean(rss_values), 2)
        row["rss_sd"] = round(statistics.stdev(rss_values), 2)

    row["replicates"] = n
    return row


def write_csv(rows: List[Dict[str, Any]], output_path: Path) -> None:
    """Write benchmark results to CSV."""
    fieldnames = [
        "file",
        "file_path",
        "file_size_mb",
        "num_individuals",
        "num_haplotypes",
        "ne_from_file",
        "num_nodes",
        "num_edges",
        "num_trees",
        "num_mutations",
        "load_time_mean",
        "load_time_sd",
        "tree_layout_time_mean",
        "tree_layout_time_sd",
        "rss_mean",
        "rss_sd",
        "buffer_size_kb",
        "replicates",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


async def main_async(args: argparse.Namespace) -> None:
    files = collect_files(args)
    logger.info("Found %d .tsz file(s)", len(files))

    rows: List[Dict[str, Any]] = []
    for i, path in enumerate(files):
        file_path = str(path.resolve())
        root_dir = str(path.parent)
        file_size_mb = path.stat().st_size / (1024 * 1024)
        metadata = parse_metadata_from_filename(path)

        logger.info("[%d/%d] %s (%.2f MB)", i + 1, len(files), path.name, file_size_mb)

        replicates: List[Dict[str, Any]] = []
        n_runs = args.replicates + (1 if args.warmup else 0)
        for r in range(n_runs):
            is_warmup = args.warmup and r == 0
            try:
                result = await run_one_replicate(
                    file_path, root_dir, args.viewport_size
                )
                if not is_warmup:
                    replicates.append(result)
            except Exception as e:
                logger.error("Replicate %d failed: %s", r + 1, e)
                raise

        if not replicates:
            raise RuntimeError("No successful replicates")

        row = aggregate_replicates(replicates, path, file_size_mb, metadata)
        rows.append(row)

        # Log summary for this file
        if row["replicates"] == 1:
            logger.info(
                "  load=%.2fs layout=%.2fs rss=%.1fMB",
                row["load_time_mean"],
                row["tree_layout_time_mean"],
                row["rss_mean"],
            )
        else:
            logger.info(
                "  load=%.2f±%.2fs layout=%.2f±%.2fs rss=%.1f±%.1fMB",
                row["load_time_mean"],
                row["load_time_sd"],
                row["tree_layout_time_mean"],
                row["tree_layout_time_sd"],
                row["rss_mean"],
                row["rss_sd"],
            )

    write_csv(rows, Path(args.output))
    logger.info("Wrote %s", args.output)


def main() -> None:
    args = parse_args()
    if args.replicates < 1:
        raise ValueError("--replicates must be >= 1")
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
