from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import pandas as pd

from lorax.utils import extract_sample_names, max_branch_length_from_newick


@dataclass(frozen=True)
class CsvConfigOptions:
    window_size: int = 50_000


REQUIRED_COLUMNS = ("genomic_positions", "newick")
MAX_BRANCH_COL = "max_branch_length"


def _dedupe_preserve_order(values: List[Any]) -> List[str]:
    seen = set()
    out: List[str] = []
    for v in values:
        s = str(v)
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


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


def _is_empty_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def extract_csv_metadata(df: pd.DataFrame) -> Dict[str, List[str]]:
    """Extract file-level metadata from a CSV DataFrame.

    Metadata columns are all columns after max_branch_length. File-level metadata
    values come only from metadata-only rows (rows with empty tree columns).
    """
    if MAX_BRANCH_COL not in df.columns:
        return {}

    max_idx = list(df.columns).index(MAX_BRANCH_COL)
    tree_cols = list(df.columns[: max_idx + 1])
    metadata_cols = list(df.columns[max_idx + 1 :])

    if not metadata_cols:
        return {}

    file_level: Dict[str, List[str]] = {c: [] for c in metadata_cols}

    for _, row in df.iterrows():
        if any(not _is_empty_value(row[col]) for col in tree_cols):
            continue
        for col in metadata_cols:
            value = row[col]
            if _is_empty_value(value):
                continue
            file_level[col].append(str(value))

    return file_level


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
    file_metadata = extract_csv_metadata(df)
    df2 = _sorted_reset(df)

    # Optional per-tree metadata: "tree_info" / "tree info" column.
    # This is intended for frontend-side per-tree UI (e.g., default per-tree colors)
    # and is sent eagerly with config on load_file.
    tree_info_map: Dict[str, str] = {}
    tree_info_col = None
    for cand in ("tree_info", "tree info"):
        if cand in df2.columns:
            tree_info_col = cand
            break

    if tree_info_col is not None:
        # Use row index as tree_idx (this matches backend CSV layout access: df.iloc[tree_idx])
        for i, row in df2.iterrows():
            nwk = row.get("newick")
            if isinstance(nwk, float) and pd.isna(nwk):
                continue
            if _is_empty_value(nwk):
                continue
            v = row.get(tree_info_col)
            if _is_empty_value(v):
                continue
            tree_info_map[str(int(i))] = str(v)

    # Compute max tree height (branch length) and sample names (best-effort, lightweight).
    #
    # Prefer the CSV-provided per-tree `max_branch_length` column when present, since
    # regex parsing only captures max *edge* length, not the full root→tip height.
    max_branch_length_all = 0.0
    samples_set = set()
    has_max_col = MAX_BRANCH_COL in df2.columns
    saw_valid_max_col_value = False

    for _, row in df2.iterrows():
        nwk = row["newick"]
        if isinstance(nwk, float) and pd.isna(nwk):
            continue
        if _is_empty_value(nwk):
            continue
        nwk = str(nwk)

        if has_max_col:
            v = row.get(MAX_BRANCH_COL)
            if not _is_empty_value(v):
                try:
                    max_br = float(v)
                    saw_valid_max_col_value = True
                    if max_br > max_branch_length_all:
                        max_branch_length_all = max_br
                except Exception:
                    # Ignore invalid per-row values; may fallback to regex below.
                    pass

        try:
            sample_names = extract_sample_names(nwk)
            samples_set.update(sample_names)
        except Exception:
            pass

    # Fallback: if the CSV doesn't provide usable per-tree max heights, derive a
    # best-effort global max from Newick text (max edge length).
    if not saw_valid_max_col_value:
        for _, row in df2.iterrows():
            nwk = row["newick"]
            if isinstance(nwk, float) and pd.isna(nwk):
                continue
            if _is_empty_value(nwk):
                continue
            nwk = str(nwk)

            try:
                max_br = float(max_branch_length_from_newick(nwk))
                if max_br > max_branch_length_all:
                    max_branch_length_all = max_br
            except Exception:
                # Keep config resilient; downstream can still load.
                pass

    genomic_positions = df2["genomic_positions"].astype(int).tolist()
    intervals = _compute_intervals(genomic_positions, options.window_size)
    genome_length = int(intervals[-1]) if intervals else int(genomic_positions[-1])

    # Compute centered initial position (10% of genome, minimum 1kb) like tskit loader.
    window_size = max(genome_length * 0.1, 1000)
    midpoint = genome_length / 2.0
    start = max(0, midpoint - window_size / 2.0)
    end = min(genome_length, midpoint + window_size / 2.0)

    # Build a deterministic, file-level sample order for stable tip node IDs across trees.
    # Prefer explicit file metadata (if provided), otherwise derive from all Newicks.
    samples_list_meta = file_metadata.get("samples", [])
    if samples_list_meta:
        samples_order = _dedupe_preserve_order(samples_list_meta)
    else:
        samples_order = sorted(str(s) for s in samples_set)

    # Temporary workaround: CSV inputs may include the outgroup sample "etal" (any case).
    # The layout/parsing pipeline prunes it from the Newick tree, so also remove it
    # from the file-level samples list to keep UI/search options consistent.
    samples_order = [s for s in samples_order if str(s).lower() != "etal"]

    sample_names_map = {str(s): {"sample_name": s} for s in samples_order}

    config: Dict[str, Any] = {
        "genome_length": genome_length,
        "initial_position": [int(start), int(end)],
        "times": {"type": "branch length", "values": [0.0, float(max_branch_length_all)]},
        "intervals": intervals,
        "filename": str(file_path).split("/")[-1],
        "sample_names": sample_names_map,
        "samples": samples_order,
        # Present but empty for compatibility; CSV doesn’t have these yet.
        "metadata_schema": {
            # Always expose "sample" as the only supported metadata key for CSV.
            # (CSV metadata Socket.IO handlers currently support only key == "sample".)
            "metadata_keys": ["sample"]
        },
    }

    if tree_info_map:
        # Kept as "tree_info" regardless of whether CSV column is "tree info" or "tree_info".
        config["tree_info"] = tree_info_map

    return config
