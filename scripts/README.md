This directory contains helper scripts for preprocessing data for figures and data included in the paper.

## CSV formatting

`csv_formatting.py` generates per-chromosome CSVs from an input TSV/CSV.

```bash
python3 scripts/csv_formatting.py path/to/input.tsv path/to/output_dir
```

Options:
- `--output-prefix` to add a prefix to output filenames.
- `--delimiter` to override the input delimiter (default: tab).

## Tree sequence simulation

`simulate_trees.py` simulates chr22-like tree sequences and writes compressed `.trees.tsz` outputs plus a CSV summary.

Run from the repo root:

```bash
python3 scripts/simulate_trees.py
```

Common examples:

```bash
# Single Ne run with custom sample size and output directory
python3 scripts/simulate_trees.py \
  --num-individuals 100000 \
  --population-size 10000 \
  --output-dir packages/backend/UPLOADS/Uploads

# Sweep Ne values in one run
python3 scripts/simulate_trees.py \
  --population-sizes 5000,10000,20000,50000 \
  --output-prefix simulated_chr22
```

Useful options:
- `--use-default-sweep` to run built-in Ne sweep values.
- `--random-seed` for reproducible simulations.
- `--keep-uncompressed` to also save `.trees` files.

## Load and render benchmark

`benchmark_load_render.py` benchmarks load and tree-layout performance for `.tsz` files and writes a results CSV.

Run from the repo root:

```bash
python3 scripts/benchmark_load_render.py \
  --dir packages/backend/UPLOADS/Uploads \
  --output packages/backend/benchmark.csv \
  --replicates 5 --warmup
```

Benchmark specific files:

```bash
python3 scripts/benchmark_load_render.py \
  --files "packages/backend/UPLOADS/Uploads/simulated_chr22_100k_Ne5k.trees.tsz,packages/backend/UPLOADS/Uploads/simulated_chr22_100k_Ne10k.trees.tsz" \
  --output packages/backend/benchmark.csv
```

Useful options:
- `--viewport-size` to control the number of trees in the first layout batch.
- `--replicates` for repeated measurements (mean +/- SD is reported when `> 1`).
