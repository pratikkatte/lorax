#!/usr/bin/env python3
"""Simulate a chr22-like tree sequence with customizable number of individuals."""

import argparse
import logging
import time
from datetime import timedelta
from pathlib import Path

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
DEFAULT_SEQUENCE_LENGTH = 50_000_000  # 50 Mb (chr22 length)
DEFAULT_RECOMBINATION_RATE = 1e-8  # Human average
DEFAULT_MUTATION_RATE = 1.25e-8  # Human average
DEFAULT_POPULATION_SIZE = 10_000  # Human Ne


def parse_args():
    parser = argparse.ArgumentParser(
        description="Simulate a chr22-like tree sequence with msprime.",
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
        help="Effective population size (Ne)",
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output file path (default: UPLOADS/Uploads/simulated_chr22_{n}k.trees.tsz)",
    )
    return parser.parse_args()


def format_duration(seconds: float) -> str:
    """Format seconds as human-readable duration."""
    return str(timedelta(seconds=int(seconds)))


def main():
    args = parse_args()

    sample_size = args.num_individuals
    sequence_length = args.length
    recombination_rate = args.recombination_rate
    mutation_rate = args.mutation_rate
    population_size = args.population_size

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        size_label = f"{sample_size // 1000}k" if sample_size >= 1000 else str(sample_size)
        output_path = (
            Path(__file__).parent.parent
            / f"UPLOADS/Uploads/simulated_chr22_{size_label}.trees.tsz"
        )

    total_start = time.time()

    logger.info("=" * 60)
    logger.info("CHR22-LIKE TREE SEQUENCE SIMULATION")
    logger.info("=" * 60)
    logger.info("Parameters:")
    logger.info(f"  Samples: {sample_size:,} diploid individuals ({sample_size * 2:,} haplotypes)")
    logger.info(f"  Sequence length: {sequence_length:,} bp ({sequence_length / 1e6:.1f} Mb)")
    logger.info(f"  Recombination rate: {recombination_rate} /bp/gen")
    logger.info(f"  Mutation rate: {mutation_rate} /bp/gen")
    logger.info(f"  Effective population size: {population_size:,}")
    logger.info(f"  Output: {output_path}")
    logger.info("-" * 60)

    # Step 1: Simulate ancestry
    logger.info("STEP 1/3: Simulating ancestry (this is the slowest step)...")
    step_start = time.time()

    ts = msprime.sim_ancestry(
        samples=sample_size,
        sequence_length=sequence_length,
        recombination_rate=recombination_rate,
        population_size=population_size,
        ploidy=2,
    )

    ancestry_time = time.time() - step_start
    logger.info(f"  Ancestry simulation completed in {format_duration(ancestry_time)}")
    logger.info(f"  Trees generated: {ts.num_trees:,}")
    logger.info(f"  Nodes: {ts.num_nodes:,}")
    logger.info(f"  Edges: {ts.num_edges:,}")

    # Step 2: Add mutations
    logger.info("-" * 60)
    logger.info("STEP 2/3: Adding mutations...")
    step_start = time.time()

    ts = msprime.sim_mutations(ts, rate=mutation_rate)

    mutation_time = time.time() - step_start
    logger.info(f"  Mutation simulation completed in {format_duration(mutation_time)}")
    logger.info(f"  Mutations added: {ts.num_mutations:,}")
    logger.info(f"  Sites: {ts.num_sites:,}")

    # Step 3: Save compressed file
    logger.info("-" * 60)
    logger.info("STEP 3/3: Compressing and saving with tszip...")
    step_start = time.time()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    tszip.compress(ts, output_path)

    save_time = time.time() - step_start
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(f"  Saved to: {output_path}")
    logger.info(f"  File size: {file_size_mb:.1f} MB")
    logger.info(f"  Compression completed in {format_duration(save_time)}")

    # Summary
    total_time = time.time() - total_start
    logger.info("=" * 60)
    logger.info("SIMULATION COMPLETE")
    logger.info("=" * 60)
    logger.info("Final statistics:")
    logger.info(f"  Individuals: {ts.num_individuals:,}")
    logger.info(f"  Samples (haplotypes): {ts.num_samples:,}")
    logger.info(f"  Trees: {ts.num_trees:,}")
    logger.info(f"  Mutations: {ts.num_mutations:,}")
    logger.info(f"  Sequence length: {ts.sequence_length:,.0f} bp")
    logger.info("-" * 60)
    logger.info("Timing breakdown:")
    logger.info(f"  Ancestry simulation: {format_duration(ancestry_time)} ({ancestry_time/total_time*100:.1f}%)")
    logger.info(f"  Mutation simulation: {format_duration(mutation_time)} ({mutation_time/total_time*100:.1f}%)")
    logger.info(f"  Compression & save:  {format_duration(save_time)} ({save_time/total_time*100:.1f}%)")
    logger.info(f"  TOTAL TIME: {format_duration(total_time)}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
