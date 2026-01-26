from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import pandas as pd

from lorax.utils import extract_sample_names, max_branch_length_from_newick


@dataclass(frozen=True)
class CsvConfigOptions:
    window_size: int = 50_000


REQUIRED_COLUMNS = ("genomic_positions", "newick")


def _validate_csv_df(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"CSV missing required column(s): {missing}. "
            f"Expected columns: {list(REQUIRED_COLUMNS)}"
        )

    if len(df) == 0:
        raise ValueError("CSV contains no rows.")


def _sorted_reset(df: pd.DataFrame) -> pd.DataFrame:
    # Deterministic ordering: global_index == row index after this.
    out = df.copy()
    out["genomic_positions"] = pd.to_numeric(out["genomic_positions"], errors="raise")
    out = out.sort_values("genomic_positions", kind="mergesort")
    out = out.reset_index(drop=True)
    return out


def _compute_intervals(genomic_positions: List[int], window_size: int) -> List[int]:
    # Frontend expects N+1 breakpoints for N trees (see localBackendWorker logic).
    # Each tree i spans [intervals[i], intervals[i+1]).
    if not genomic_positions:
        return []

    positions = [int(p) for p in genomic_positions]
    intervals = positions[:]  # N items
    last_end = int(positions[-1]) + int(window_size)
    intervals.append(last_end)  # N+1
    return intervals


def build_csv_config(
    df: pd.DataFrame,
    file_path: str,
    *,
    options: CsvConfigOptions | None = None,
) -> Dict[str, Any]:
    """Build a Lorax-compatible config for Newick-per-row CSV.

    CSV schema:
    - genomic_positions: int (tree start position)
    - newick: str (Newick tree)

    Contract notes:
    - `intervals` must be N+1 breakpoints (required by frontend binning logic).
    - `times` uses branch length for CSV: {type: "branch length", values: [0, max]}.
    """
    options = options or CsvConfigOptions()

    _validate_csv_df(df)
    df2 = _sorted_reset(df)

    # Compute max branch length and sample names (best-effort, lightweight).
    max_branch_length_all = 0.0
    samples_set = set()

    for _, row in df2.iterrows():
        nwk = row["newick"]
        if isinstance(nwk, float) and pd.isna(nwk):
            continue
        nwk = str(nwk)

        try:
            max_br = float(max_branch_length_from_newick(nwk))
            if max_br > max_branch_length_all:
                max_branch_length_all = max_br
        except Exception:
            # Keep config resilient; downstream can still load.
            pass

        try:
            sample_names = extract_sample_names(nwk)
            samples_set.update(sample_names)
        except Exception:
            pass

    genomic_positions = df2["genomic_positions"].astype(int).tolist()
    intervals = _compute_intervals(genomic_positions, options.window_size)
    genome_length = int(intervals[-1]) if intervals else int(genomic_positions[-1])

    # Compute centered initial position (10% of genome, minimum 1kb) like tskit loader.
    window_size = max(genome_length * 0.1, 1000)
    midpoint = genome_length / 2.0
    start = max(0, midpoint - window_size / 2.0)
    end = min(genome_length, midpoint + window_size / 2.0)

    sample_names_map: Dict[str, Dict[str, Any]] = {str(s): {"sample_name": s} for s in samples_set}

    return {
        "genome_length": genome_length,
        "initial_position": [int(start), int(end)],
        "times": {"type": "branch length", "values": [0.0, float(max_branch_length_all)]},
        "intervals": intervals,
        "filename": str(file_path).split("/")[-1],
        "sample_names": sample_names_map,
        # Present but empty for compatibility; CSV doesn’t have these yet.
        "metadata_schema": {"metadata_keys": ["sample"]},
    }

