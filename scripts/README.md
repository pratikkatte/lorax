This directory contains helper scripts for preprocessing data.

## CSV formatting

`csv_formatting.py` generates per-chromosome CSVs from an input TSV/CSV.

```bash
python3 scripts/csv_formatting.py path/to/input.tsv path/to/output_dir
```

Options:
- `--output-prefix` to add a prefix to output filenames.
- `--delimiter` to override the input delimiter (default: tab).
