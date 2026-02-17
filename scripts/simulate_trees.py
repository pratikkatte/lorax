#!/usr/bin/env python3
"""Simulate chr22-like tree sequences with customizable Ne sweep and benchmarking."""

import argparse
import csv
import logging
import time
from datetime import timedelta
from pathlib import Path
from typing import List, Dict, Any

import msprime
import tszip

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Default simulation parameters
DEFAULT_SAMPLE_SIZE = 100_000  # 100k diploid individuals
DEFAULT_SEQUENCE_LENGTH = 50_000_000  # 50 Mb
DEFAULT_RECOMBINATION_RATE = 1e-8
DEFAULT_MUTATION_RATE = 1.25e-8
DEFAULT_POPULATION_SIZE = 10_000  # Ne
DEFAULT_SWEEP_NE = [5_000, 10_000, 20_000, 50_000]


def format_duration(seconds: float) -> str:
    """Format seconds as human-readable duration."""
    return str(timedelta(seconds=int(seconds)))


def parse_population_sizes(pop_sizes_str: str) -> List[int]:
    """
    Parse comma-separated population sizes.
    Example: "5000,10000,20000,50000"
    """
    values = []
    for token in pop_sizes_str.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            v = int(token)
            if v <= 0:
                raise ValueError
            values.append(v)
        except ValueError as e:
            raise argparse.ArgumentTypeError(
                f"Invalid population size '{token}'. Must be positive integers."
            ) from e
    if not values:
        raise argparse.ArgumentTypeError("No valid population sizes provided.")
    return values


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Simulate chr22-like tree sequence(s) with msprime. "
            "Can run single Ne or sweep multiple Ne values."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "-n", "--num-individuals",
        type=int,
        default=DEFAULT_SAMPLE_SIZE,
        help="Number of diploid individuals to simulate",
    )
    parser.add_argument(
        "-l", "--length",
        type=int,
        default=DEFAULT_SEQUENCE_LENGTH,
        help="Sequence length in base pairs",
    )
    parser.add_argument(
        "-r", "--recombination-rate",
        type=float,
        default=DEFAULT_RECOMBINATION_RATE,
        help="Recombination rate per bp per generation",
    )
    parser.add_argument(
        "-m", "--mutation-rate",
        type=float,
        default=DEFAULT_MUTATION_RATE,
        help="Mutation rate per bp per generation",
    )
    parser.add_argument(
        "-N", "--population-size",
        type=int,
        default=DEFAULT_POPULATION_SIZE,
        help="Effective population size (Ne) for single run mode",
    )

    parser.add_argument(
        "--population-sizes",
        type=parse_population_sizes,
        default=None,
        help=(
            "Comma-separated Ne values for sweep mode "
            "(e.g. '5000,10000,20000,50000'). "
            "If provided, sweep mode runs and ignores --population-size."
        ),
    )

    parser.add_argument(
        "--use-default-sweep",
        action="store_true",
        help=f"Use built-in sweep Ne values: {DEFAULT_SWEEP_NE}",
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help=(
            "Output directory for generated files and CSV summary. "
            "Default: <repo>/UPLOADS/Uploads"
        ),
    )

    parser.add_argument(
        "--output-prefix",
        type=str,
        default="simulated_chr22",
        help="Prefix for output files",
    )

    parser.add_argument(
        "--csv",
        type=str,
        default=None,
        help=(
            "Path to CSV summary file. "
            "Default: <output-dir>/<output-prefix>_ne_sweep_summary.csv"
        ),
    )

    parser.add_argument(
        "--random-seed",
        type=int,
        default=None,
        help="Random seed for reproducibility. If unset, run is stochastic.",
    )

    parser.add_argument(
        "--keep-uncompressed",
        action="store_true",
        help="Also save uncompressed .trees alongside .tsz (larger files).",
    )

    return parser.parse_args()


def get_default_output_dir() -> Path:
    # Same convention as your original script
    return Path(__file__).parent.parent / "UPLOADS/Uploads"


def size_label_from_n(n: int) -> str:
    if n >= 1_000_000 and n % 1_000_000 == 0:
        return f"{n // 1_000_000}M"
    if n >= 1_000 and n % 1_000 == 0:
        return f"{n // 1_000}k"
    return str(n)


def simulate_one(
    *,
    num_individuals: int,
    sequence_length: int,
    recombination_rate: float,
    mutation_rate: float,
    population_size: int,
    output_dir: Path,
    output_prefix: str,
    random_seed: int | None,
    keep_uncompressed: bool,
) -> Dict[str, Any]:
    """
    Run one simulation and return benchmark stats.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    sample_label = size_label_from_n(num_individuals)
    ne_label = size_label_from_n(population_size)

    # Build output filenames
    tsz_path = output_dir / f"{output_prefix}_{sample_label}_Ne{ne_label}.trees.tsz"
    trees_path = output_dir / f"{output_prefix}_{sample_label}_Ne{ne_label}.trees"

    logger.info("-" * 70)
    logger.info(
        "Running simulation | individuals=%s | Ne=%s | length=%s | rec=%g | mut=%g",
        f"{num_individuals:,}",
        f"{population_size:,}",
        f"{sequence_length:,}",
        recombination_rate,
        mutation_rate,
    )

    total_start = time.time()

    # 1) Ancestry
    t0 = time.time()
    ts = msprime.sim_ancestry(
        samples=num_individuals,
        sequence_length=sequence_length,
        recombination_rate=recombination_rate,
        population_size=population_size,
        ploidy=2,
        random_seed=random_seed,
    )
    ancestry_time = time.time() - t0

    # 2) Mutations
    t1 = time.time()
    ts = msprime.sim_mutations(ts, rate=mutation_rate, random_seed=random_seed)
    mutation_time = time.time() - t1

    # Table row counts (explicitly requested diagnostic)
    tables = ts.tables
    nodes_rows = tables.nodes.num_rows
    edges_rows = tables.edges.num_rows
    sites_rows = tables.sites.num_rows
    muts_rows = tables.mutations.num_rows

    # Optional uncompressed
    trees_size_mb = None
    save_trees_time = 0.0
    if keep_uncompressed:
        t2 = time.time()
        ts.dump(trees_path)
        save_trees_time = time.time() - t2
        trees_size_mb = trees_path.stat().st_size / (1024 * 1024)

    # 3) Compress + save
    t3 = time.time()
    tszip.compress(ts, tsz_path)
    save_tsz_time = time.time() - t3
    tsz_size_mb = tsz_path.stat().st_size / (1024 * 1024)

    total_time = time.time() - total_start

    logger.info("Output .tsz: %s (%.2f MB)", tsz_path, tsz_size_mb)
    if keep_uncompressed:
        logger.info("Output .trees: %s (%.2f MB)", trees_path, trees_size_mb)

    logger.info(
        "Rows | nodes=%s edges=%s sites=%s mutations=%s",
        f"{nodes_rows:,}",
        f"{edges_rows:,}",
        f"{sites_rows:,}",
        f"{muts_rows:,}",
    )
    logger.info(
        "Timing | ancestry=%s | mutations=%s | save_tsz=%s | total=%s",
        format_duration(ancestry_time),
        format_duration(mutation_time),
        format_duration(save_tsz_time),
        format_duration(total_time),
    )

    return {
        "num_individuals": num_individuals,
        "num_haplotypes": num_individuals * 2,
        "sequence_length": sequence_length,
        "recombination_rate": recombination_rate,
        "mutation_rate": mutation_rate,
        "population_size_Ne": population_size,
        "num_trees": ts.num_trees,
        "num_nodes": ts.num_nodes,
        "num_edges": ts.num_edges,
        "num_sites": ts.num_sites,
        "num_mutations": ts.num_mutations,
        "table_nodes_rows": nodes_rows,
        "table_edges_rows": edges_rows,
        "table_sites_rows": sites_rows,
        "table_mutations_rows": muts_rows,
        "ancestry_time_sec": round(ancestry_time, 6),
        "mutation_time_sec": round(mutation_time, 6),
        "save_trees_time_sec": round(save_trees_time, 6),
        "save_tsz_time_sec": round(save_tsz_time, 6),
        "total_time_sec": round(total_time, 6),
        "trees_size_mb": round(trees_size_mb, 6) if trees_size_mb is not None else "",
        "tsz_size_mb": round(tsz_size_mb, 6),
        "trees_path": str(trees_path) if keep_uncompressed else "",
        "tsz_path": str(tsz_path),
    }


def write_csv(rows: List[Dict[str, Any]], csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        raise ValueError("No rows to write to CSV.")

    # Stable column order
    fieldnames = [
        "num_individuals",
        "num_haplotypes",
        "sequence_length",
        "recombination_rate",
        "mutation_rate",
        "population_size_Ne",
        "num_trees",
        "num_nodes",
        "num_edges",
        "num_sites",
        "num_mutations",
        "table_nodes_rows",
        "table_edges_rows",
        "table_sites_rows",
        "table_mutations_rows",
        "ancestry_time_sec",
        "mutation_time_sec",
        "save_trees_time_sec",
        "save_tsz_time_sec",
        "total_time_sec",
        "trees_size_mb",
        "tsz_size_mb",
        "trees_path",
        "tsz_path",
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    args = parse_args()

    if args.num_individuals <= 0:
        raise ValueError("--num-individuals must be > 0")
    if args.length <= 0:
        raise ValueError("--length must be > 0")
    if args.recombination_rate < 0:
        raise ValueError("--recombination-rate must be >= 0")
    if args.mutation_rate < 0:
        raise ValueError("--mutation-rate must be >= 0")
    if args.population_size <= 0:
        raise ValueError("--population-size must be > 0")

    output_dir = Path(args.output_dir) if args.output_dir else get_default_output_dir()

    # Determine mode: sweep vs single
    if args.population_sizes is not None:
        ne_values = args.population_sizes
    elif args.use_default_sweep:
        ne_values = DEFAULT_SWEEP_NE
    else:
        ne_values = [args.population_size]

    # De-duplicate while preserving order
    seen = set()
    ne_values = [x for x in ne_values if not (x in seen or seen.add(x))]

    logger.info("=" * 70)
    logger.info("TREE SEQUENCE SIMULATION")
    logger.info("=" * 70)
    logger.info("Mode: %s", "SWEEP" if len(ne_values) > 1 else "SINGLE")
    logger.info("Individuals (diploid): %s", f"{args.num_individuals:,}")
    logger.info("Sequence length (bp): %s", f"{args.length:,}")
    logger.info("Recombination rate: %g", args.recombination_rate)
    logger.info("Mutation rate: %g", args.mutation_rate)
    logger.info("Ne values: %s", ", ".join(f"{v:,}" for v in ne_values))
    logger.info("Output dir: %s", output_dir)
    logger.info("Keep uncompressed .trees: %s", args.keep_uncompressed)
    if args.random_seed is not None:
        logger.info("Random seed: %s", args.random_seed)
    logger.info("=" * 70)

    all_rows: List[Dict[str, Any]] = []
    sweep_start = time.time()

    for i, ne in enumerate(ne_values, start=1):
        logger.info("Run %d/%d | Ne=%s", i, len(ne_values), f"{ne:,}")
        row = simulate_one(
            num_individuals=args.num_individuals,
            sequence_length=args.length,
            recombination_rate=args.recombination_rate,
            mutation_rate=args.mutation_rate,
            population_size=ne,
            output_dir=output_dir,
            output_prefix=args.output_prefix,
            random_seed=args.random_seed,
            keep_uncompressed=args.keep_uncompressed,
        )
        all_rows.append(row)

    total_sweep_time = time.time() - sweep_start

    # CSV path
    if args.csv:
        csv_path = Path(args.csv)
    else:
        csv_path = output_dir / f"{args.output_prefix}_ne_sweep_summary.csv"

    write_csv(all_rows, csv_path)

    logger.info("=" * 70)
    logger.info("ALL RUNS COMPLETE")
    logger.info("Total sweep time: %s", format_duration(total_sweep_time))
    logger.info("Summary CSV: %s", csv_path)
    logger.info("=" * 70)

    # Compact table-like log summary
    logger.info("Ne vs .tsz size (MB) and mutations:")
    for r in all_rows:
        logger.info(
            "  Ne=%-8s | tsz=%8.2f MB | mutations=%-12s | edges=%-12s | trees=%-10s",
            f"{r['population_size_Ne']:,}",
            r["tsz_size_mb"],
            f"{r['num_mutations']:,}",
            f"{r['num_edges']:,}",
            f"{r['num_trees']:,}",
        )


if __name__ == "__main__":
    main()