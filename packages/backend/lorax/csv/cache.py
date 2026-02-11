"""CSV tree graph cache resolution.

Provides get_or_parse_csv_tree_graph for obtaining NewickTreeGraph instances
from cache or parsing on demand. Used by layout, node search, and compare topology.
"""

import asyncio
from typing import Optional

import pandas as pd

from lorax.csv.newick_tree import parse_newick_to_tree


async def get_or_parse_csv_tree_graph(
    ctx,
    session_id: str,
    tree_idx: int,
    csv_tree_graph_cache,
    shift_tips_to_one: bool = False,
):
    """
    Return a parsed CSV Newick tree graph, using CsvTreeGraphCache.

    The cache is populated by the layout pipeline, but callers (node search,
    compare topology) can also populate it on demand.

    Args:
        ctx: File context with tree_sequence (DataFrame) and config
        session_id: Session ID for cache key
        tree_idx: Tree index (row index in DataFrame)
        csv_tree_graph_cache: CsvTreeGraphCache instance
        shift_tips_to_one: Whether to shift tip y-coordinates to 1.0

    Returns:
        NewickTreeGraph or None if parse fails
    """
    cached = await csv_tree_graph_cache.get(session_id, int(tree_idx))
    if cached is not None:
        return cached

    df = ctx.tree_sequence
    if not isinstance(df, pd.DataFrame):
        return None

    try:
        newick_str = df.iloc[int(tree_idx)].get("newick")
    except Exception:
        newick_str = None
    if newick_str is None or pd.isna(newick_str):
        return None

    times_values = ctx.config.get("times", {}).get("values", [0.0, 1.0])
    max_branch_length = float(times_values[1]) if len(times_values) > 1 else 1.0
    samples_order = ctx.config.get("samples") or []
    tree_max_branch_length = None
    if "max_branch_length" in df.columns:
        try:
            v = df.iloc[int(tree_idx)].get("max_branch_length")
            if (
                v is not None
                and not (isinstance(v, float) and pd.isna(v))
                and str(v).strip() != ""
            ):
                tree_max_branch_length = float(v)
        except Exception:
            tree_max_branch_length = None

    try:
        graph = await asyncio.to_thread(
            parse_newick_to_tree,
            str(newick_str),
            max_branch_length,
            samples_order=samples_order,
            tree_max_branch_length=tree_max_branch_length,
            shift_tips_to_one=shift_tips_to_one,
        )
    except Exception:
        return None

    await csv_tree_graph_cache.set(session_id, int(tree_idx), graph)
    return graph
