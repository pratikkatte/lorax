"""
Node search event handlers for Lorax Socket.IO.

Handles search_nodes and get_highlight_positions_event events.
"""

import asyncio

from lorax.artifacts.graph import CompactGenealogyGraph
from lorax.artifacts.csr_reader import CSRArtifactCapabilityError
from lorax.artifacts.runtime import context_for_session, is_artifact_session
from lorax.context import tree_graph_cache, csv_tree_graph_cache
from lorax.constants import ERROR_NO_FILE_LOADED
from lorax.handlers import (
    should_shift_csv_tips,
    search_nodes_in_trees,
    get_highlight_positions,
    get_multi_value_highlight_positions,
    get_compare_trees_diff,
)
from lorax.cache import get_file_context
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file
from lorax.tree_graph.time_scale import (
    newick_node_position,
    normalize_time_scale,
    tree_graph_edge_coordinates,
    times_to_y,
)


async def _get_or_parse_csv_tree_graph(ctx, session_id: str, tree_idx: int):
    """
    Return a parsed CSV Newick tree graph, using CsvTreeGraphCache.

    Delegates to lorax.csv.cache.get_or_parse_csv_tree_graph.
    """
    from lorax.csv.cache import get_or_parse_csv_tree_graph

    shift_tips_to_one = should_shift_csv_tips(ctx.file_path)
    return await get_or_parse_csv_tree_graph(
        ctx, session_id, tree_idx, csv_tree_graph_cache, shift_tips_to_one
    )


def _find_node_index(graph, node_id: int):
    """Find the array index in a NewickTreeGraph for a given node_id."""
    # node_id is stored as a numpy array; use vectorized equality.
    try:
        idxs = (graph.node_id == int(node_id)).nonzero()[0]
        if idxs.size == 0:
            return None
        return int(idxs[0])
    except Exception:
        return None


def _compare_artifact_trees(context, tree_indices, time_scale):
    indices = [
        int(index)
        for index in tree_indices
        if 0 <= int(index) < context.reader.num_trees
    ]
    genealogies = context.reader.trees_at_indices(indices)
    graphs = [
        CompactGenealogyGraph.from_genealogy(
            genealogy,
            global_min_time=context.reader.global_min_time,
            global_max_time=context.reader.global_max_time,
            time_scale=time_scale,
        )
        for genealogy in genealogies
    ]
    comparisons = []
    for previous, following in zip(graphs, graphs[1:]):
        previous_edges = previous.edges()
        following_edges = following.edges()
        comparisons.append(
            {
                "prev_idx": previous.tree_index,
                "next_idx": following.tree_index,
                "inserted": [
                    tree_graph_edge_coordinates(
                        following,
                        parent,
                        child,
                        context.reader.global_min_time,
                        context.reader.global_max_time,
                        time_scale,
                    )
                    for parent, child in sorted(following_edges - previous_edges)
                ],
                "removed": [
                    tree_graph_edge_coordinates(
                        previous,
                        parent,
                        child,
                        context.reader.global_min_time,
                        context.reader.global_max_time,
                        time_scale,
                    )
                    for parent, child in sorted(previous_edges - following_edges)
                ],
            }
        )
    return {"comparisons": comparisons}


def _artifact_sample_name_map(reader):
    reader.require_capability("sample_search")
    return {
        str(row["display_name"]).casefold(): int(row["node_id"])
        for row in reader._sidecar_table("sample_names").to_pylist()
    }


def _artifact_matching_nodes(reader, metadata_key, metadata_value):
    if metadata_key == "sample":
        node_id = _artifact_sample_name_map(reader).get(
            str(metadata_value).casefold()
        )
        return [] if node_id is None else [node_id]
    return reader.metadata_samples(
        metadata_key,
        metadata_value,
    )["sample_node_ids"]


def _artifact_positions(
    context,
    node_ids,
    tree_indices,
    time_scale,
    *,
    show_lineages=False,
):
    positions = []
    lineages = {}
    wanted = {int(node_id) for node_id in node_ids}
    ranges_by_node = {
        node_id: context.reader.tree_ranges_for_node(node_id)
        for node_id in wanted
    }
    requested_indices = [int(index) for index in tree_indices]
    relevant_indices = [
        tree_index
        for tree_index in requested_indices
        if any(
            start <= tree_index < stop
            for ranges in ranges_by_node.values()
            for start, stop in ranges
        )
    ]
    genealogies = context.reader.trees_at_indices(relevant_indices)
    for genealogy in genealogies:
        for node_id in wanted:
            if not genealogy.has_node(node_id):
                continue
            offset = genealogy.node_offset(node_id)
            positions.append(
                {
                    "node_id": node_id,
                    "tree_idx": genealogy.tree_index,
                    "x": float(genealogy.layout_x[offset]),
                    "y": float(
                        times_to_y(
                            [genealogy.node_times[offset]],
                            context.reader.global_min_time,
                            context.reader.global_max_time,
                            time_scale,
                        )[0]
                    ),
                }
            )
            if show_lineages:
                path = list(reversed(genealogy.ancestors(node_id)))
                if len(path) > 1:
                    lineages.setdefault(genealogy.tree_index, []).append(
                        {"path_node_ids": path, "color": None}
                    )
    return positions, lineages


def _artifact_search_nodes(context, data):
    name_map = _artifact_sample_name_map(context.reader)
    names = [str(name) for name in data.get("sample_names", [])]
    tree_indices = [int(index) for index in data.get("tree_indices", [])]
    genealogies = context.reader.trees_at_indices(tree_indices)
    highlights = {}
    lineages = {}
    for genealogy in genealogies:
        hits = []
        for name in names:
            node_id = name_map.get(name.casefold())
            if node_id is None or not genealogy.has_node(node_id):
                continue
            hits.append({"node_id": node_id, "name": name})
            if data.get("show_lineages"):
                path = list(reversed(genealogy.ancestors(node_id)))
                if len(path) > 1:
                    lineages.setdefault(genealogy.tree_index, []).append(
                        {
                            "path_node_ids": path,
                            "color": (data.get("sample_colors") or {}).get(
                                name.casefold()
                            ),
                        }
                    )
        if hits:
            highlights[genealogy.tree_index] = hits
    return {"highlights": highlights, "lineage": lineages}


def _build_node_id_to_index(graph):
    """Build a node_id -> array index dict for a NewickTreeGraph."""
    try:
        return {int(nid): i for i, nid in enumerate(graph.node_id)}
    except Exception:
        return {}


def _get_csv_max_branch_length(ctx) -> float:
    times_values = ctx.config.get("times", {}).get("values", [0.0, 1.0])
    return float(times_values[1]) if len(times_values) > 1 else 1.0


def _compute_csv_lineage_path(graph, seed_node_id: int, node_id_to_index: dict):
    """
    Compute ancestry path (tip -> root) for a CSV NewickTreeGraph.

    Returns a list of node_ids starting at seed_node_id, following parent_id until -1.
    Includes a cycle guard to avoid infinite loops on malformed graphs.
    """
    path = []
    current = int(seed_node_id)
    visited = set()

    while current != -1:
        if current in visited:
            break
        visited.add(current)
        path.append(current)

        idx = node_id_to_index.get(current)
        if idx is None:
            break
        parent = int(graph.parent_id[idx])
        current = parent

    return path


def register_node_search_events(sio):
    """Register node search socket events."""

    @sio.event
    async def search_nodes(sid, data):
        """Socket event to search for nodes matching metadata values in trees.

        This is used for highlighting nodes when searching/filtering by metadata.
        Returns node_ids for matching samples in each tree, and optionally lineage paths.
        Frontend computes positions using the post-order layout data.

        data: {
            lorax_sid: str,
            sample_names: [str],    # Sample names to search for
            tree_indices: [int],    # Tree indices to search in
            show_lineages: bool,    # Whether to compute lineage paths
            sample_colors: dict     # Optional {sample_name: [r,g,b,a]}
        }

        Returns: {
            highlights: {tree_idx: [{node_id, name}]},
            lineage: {tree_idx: [{path_node_ids: [int], color}]}
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return

            if is_csv_session_file(session.file_path):
                sample_names = data.get("sample_names", [])
                tree_indices = data.get("tree_indices", [])
                show_lineages = data.get("show_lineages", False)

                # CSV mode currently supports only tip highlights (no lineage paths).
                if show_lineages:
                    show_lineages = False

                if not sample_names or not tree_indices:
                    await sio.emit("search-nodes-result", {"highlights": {}, "lineage": {}}, to=sid)
                    return

                ctx = await get_file_context(session.file_path)
                if ctx is None:
                    await sio.emit("search-nodes-result", {"error": "Failed to load CSV"}, to=sid)
                    return

                samples_order = ctx.config.get("samples") or []
                sample_id_map = {str(name): idx for idx, name in enumerate(samples_order)}

                highlights = {}

                for tree_idx in tree_indices:
                    tree_idx = int(tree_idx)
                    graph = await _get_or_parse_csv_tree_graph(ctx, lorax_sid, tree_idx)
                    if graph is None:
                        continue

                    hits = []
                    for name in sample_names:
                        node_id = sample_id_map.get(str(name))
                        if node_id is None:
                            continue
                        if _find_node_index(graph, node_id) is None:
                            continue
                        hits.append({"node_id": int(node_id), "name": str(name)})

                    if hits:
                        highlights[tree_idx] = hits

                await sio.emit("search-nodes-result", {"highlights": highlights, "lineage": {}}, to=sid)
                return

            sample_names = data.get("sample_names", [])
            tree_indices = data.get("tree_indices", [])
            show_lineages = data.get("show_lineages", False)
            sample_colors = data.get("sample_colors", {})

            # Check cache and warn if trees not found (they should be cached from layout)
            if tree_indices:
                uncached = []
                for tree_idx in tree_indices:
                    cached = await tree_graph_cache.get(lorax_sid, int(tree_idx))
                    if cached is None:
                        uncached.append(tree_idx)
                if uncached:
                    print(f"⚠️ WARNING: Trees {uncached} not in cache for session {lorax_sid[:8]}... "
                          f"(expected from layout render)")

            if not sample_names or not tree_indices:
                await sio.emit("search-nodes-result", {
                    "highlights": {},
                    "lineage": {}
                }, to=sid)
                return

            if is_artifact_session(session):
                try:
                    context = await asyncio.to_thread(context_for_session, session)
                    result = await asyncio.to_thread(
                        _artifact_search_nodes,
                        context,
                        data,
                    )
                except CSRArtifactCapabilityError as exc:
                    result = {"error": str(exc), "code": exc.code}
                await sio.emit("search-nodes-result", result, to=sid)
                return

            ctx = await get_file_context(session.file_path)
            if ctx is None:
                await sio.emit("search-nodes-result", {
                    "error": "Failed to load tree sequence"
                }, to=sid)
                return

            ts = ctx.tree_sequence

            result = await asyncio.to_thread(
                search_nodes_in_trees,
                ts,
                sample_names,
                tree_indices,
                show_lineages,
                sample_colors
            )

            await sio.emit("search-nodes-result", result, to=sid)
        except Exception as e:
            print(f"❌ Search nodes error: {e}")
            await sio.emit("search-nodes-result", {"error": str(e)}, to=sid)

    @sio.event
    async def get_highlight_positions_event(sid, data):
        """Socket event to get positions for all tip nodes matching a metadata value.

        Returns positions for ALL matching nodes, ignoring sparsification.
        Used for highlighting nodes that may not be currently rendered.

        data: {
            lorax_sid: str,
            metadata_key: str,      # Metadata key to filter by
            metadata_value: str,    # Metadata value to match
            tree_indices: [int]     # Tree indices to compute positions for
        }

        Returns: {
            positions: [{node_id, tree_idx, x, y}, ...]
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return

            if is_csv_session_file(session.file_path):
                metadata_key = data.get("metadata_key")
                metadata_value = data.get("metadata_value")
                tree_indices = data.get("tree_indices", [])
                time_scale = normalize_time_scale(data.get("timeScale"))

                if metadata_key != "sample":
                    await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                    return

                if metadata_value is None or not tree_indices:
                    await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                    return

                ctx = await get_file_context(session.file_path)
                if ctx is None:
                    await sio.emit("highlight-positions-result", {"error": "Failed to load CSV"}, to=sid)
                    return

                max_branch_length = _get_csv_max_branch_length(ctx)
                samples_order = ctx.config.get("samples") or []
                sample_id_map = {str(name): idx for idx, name in enumerate(samples_order)}
                target_node_id = sample_id_map.get(str(metadata_value))
                if target_node_id is None:
                    await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                    return

                positions = []
                for tree_idx in tree_indices:
                    tree_idx = int(tree_idx)
                    graph = await _get_or_parse_csv_tree_graph(ctx, lorax_sid, tree_idx)
                    if graph is None:
                        continue

                    arr_idx = _find_node_index(graph, target_node_id)
                    if arr_idx is None:
                        continue
                    node_pos = newick_node_position(
                        graph,
                        target_node_id,
                        max_branch_length,
                        time_scale,
                    )
                    if node_pos is None:
                        continue

                    positions.append(
                        {
                            "node_id": int(target_node_id),
                            "tree_idx": int(tree_idx),
                            # Canonical axis contract: x=layout, y=time.
                            "x": node_pos["x"],
                            "y": node_pos["y"],
                        }
                    )

                await sio.emit("highlight-positions-result", {"positions": positions}, to=sid)
                return

            metadata_key = data.get("metadata_key")
            metadata_value = data.get("metadata_value")
            tree_indices = data.get("tree_indices", [])
            time_scale = normalize_time_scale(data.get("timeScale"))

            if not metadata_key or metadata_value is None:
                await sio.emit("highlight-positions-result", {
                    "error": "Missing metadata_key or metadata_value"
                }, to=sid)
                return

            if not tree_indices:
                await sio.emit("highlight-positions-result", {"positions": []}, to=sid)
                return

            if is_artifact_session(session):
                try:
                    context = await asyncio.to_thread(context_for_session, session)
                    node_ids = await asyncio.to_thread(
                        _artifact_matching_nodes,
                        context.reader,
                        metadata_key,
                        metadata_value,
                    )
                    positions, _lineages = await asyncio.to_thread(
                        _artifact_positions,
                        context,
                        node_ids,
                        tree_indices,
                        time_scale,
                    )
                    result = {"positions": positions}
                except CSRArtifactCapabilityError as exc:
                    result = {"error": str(exc), "code": exc.code}
                await sio.emit("highlight-positions-result", result, to=sid)
                return

            ctx = await get_file_context(session.file_path)
            if ctx is None:
                await sio.emit("highlight-positions-result", {
                    "error": "Failed to load tree sequence"
                }, to=sid)
                return

            ts = ctx.tree_sequence

            result = await get_highlight_positions(
                ts,
                session.file_path,
                metadata_key,
                metadata_value,
                tree_indices,
                lorax_sid,
                tree_graph_cache,
                ctx=ctx,
                time_scale=time_scale,
            )

            await sio.emit("highlight-positions-result", result, to=sid)
        except Exception as e:
            print(f"❌ Get highlight positions error: {e}")
            await sio.emit("highlight-positions-result", {"error": str(e)}, to=sid)

    @sio.event
    async def search_metadata_multi_event(sid, data):
        """Socket event for multi-value metadata search.

        Returns positions for tip nodes matching ANY of the metadata values,
        grouped by value for per-value coloring with OR logic.

        data: {
            lorax_sid: str,
            metadata_key: str,          # Metadata key to filter by
            metadata_values: [str],     # Array of values (OR logic)
            tree_indices: [int],        # Tree indices to compute positions for
            show_lineages: bool         # Whether to compute lineage paths
        }

        Emits: "search-metadata-multi-result" with:
        {
            positions_by_value: {"Africa": [{node_id, tree_idx, x, y}, ...], ...},
            lineages: {"Africa": {tree_idx: [{path_node_ids, color}]}} if show_lineages,
            total_count: int
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                await sio.emit("error", {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return

            if is_csv_session_file(session.file_path):
                metadata_key = data.get("metadata_key")
                metadata_values = data.get("metadata_values", [])
                tree_indices = data.get("tree_indices", [])
                show_lineages = bool(data.get("show_lineages", False))
                time_scale = normalize_time_scale(data.get("timeScale"))

                if metadata_key != "sample":
                    await sio.emit(
                        "search-metadata-multi-result",
                        {"positions_by_value": {}, "lineages": {}, "total_count": 0},
                        to=sid,
                    )
                    return

                if not metadata_values or not tree_indices:
                    await sio.emit(
                        "search-metadata-multi-result",
                        {"positions_by_value": {}, "lineages": {}, "total_count": 0},
                        to=sid,
                    )
                    return

                ctx = await get_file_context(session.file_path)
                if ctx is None:
                    await sio.emit("search-metadata-multi-result", {"error": "Failed to load CSV"}, to=sid)
                    return

                max_branch_length = _get_csv_max_branch_length(ctx)
                samples_order = ctx.config.get("samples") or []
                sample_id_map = {str(name): idx for idx, name in enumerate(samples_order)}

                # Deduplicate and stringify values
                unique_values = list({str(v) for v in metadata_values})
                positions_by_value = {v: [] for v in unique_values}
                lineages = {} if show_lineages else {}
                total_count = 0

                for value in unique_values:
                    node_id = sample_id_map.get(value)
                    if node_id is None:
                        continue

                    value_lineages = {} if show_lineages else None

                    for tree_idx in tree_indices:
                        tree_idx = int(tree_idx)
                        graph = await _get_or_parse_csv_tree_graph(ctx, lorax_sid, tree_idx)
                        if graph is None:
                            continue
                        node_id_to_index = _build_node_id_to_index(graph) if show_lineages else None
                        arr_idx = _find_node_index(graph, node_id)
                        if arr_idx is None:
                            continue
                        node_pos = newick_node_position(
                            graph,
                            node_id,
                            max_branch_length,
                            time_scale,
                        )
                        if node_pos is None:
                            continue

                        positions_by_value[value].append(
                            {
                                "node_id": int(node_id),
                                "tree_idx": int(tree_idx),
                                # Canonical axis contract: x=layout, y=time.
                                "x": node_pos["x"],
                                "y": node_pos["y"],
                            }
                        )
                        total_count += 1

                        if show_lineages:
                            path_node_ids = _compute_csv_lineage_path(graph, int(node_id), node_id_to_index)
                            if len(path_node_ids) > 1:
                                # Emit root -> tip to match frontend L-shape construction.
                                path_node_ids = list(reversed(path_node_ids))
                                value_lineages.setdefault(tree_idx, []).append(
                                    {"path_node_ids": path_node_ids, "color": None}
                                )

                    if show_lineages and value_lineages:
                        lineages[value] = value_lineages

                await sio.emit(
                    "search-metadata-multi-result",
                    {"positions_by_value": positions_by_value, "lineages": lineages, "total_count": total_count},
                    to=sid,
                )
                return

            metadata_key = data.get("metadata_key")
            metadata_values = data.get("metadata_values", [])
            tree_indices = data.get("tree_indices", [])
            show_lineages = data.get("show_lineages", False)
            time_scale = normalize_time_scale(data.get("timeScale"))

            if not metadata_key:
                await sio.emit("search-metadata-multi-result", {
                    "error": "Missing metadata_key"
                }, to=sid)
                return

            if not metadata_values or not tree_indices:
                await sio.emit("search-metadata-multi-result", {
                    "positions_by_value": {},
                    "lineages": {},
                    "total_count": 0
                }, to=sid)
                return

            if is_artifact_session(session):
                try:
                    context = await asyncio.to_thread(context_for_session, session)
                    positions_by_value = {}
                    lineages = {}
                    total_count = 0
                    for value in dict.fromkeys(str(v) for v in metadata_values):
                        node_ids = await asyncio.to_thread(
                            _artifact_matching_nodes,
                            context.reader,
                            metadata_key,
                            value,
                        )
                        positions, value_lineages = await asyncio.to_thread(
                            _artifact_positions,
                            context,
                            node_ids,
                            tree_indices,
                            time_scale,
                            show_lineages=show_lineages,
                        )
                        positions_by_value[value] = positions
                        total_count += len(positions)
                        if value_lineages:
                            lineages[value] = value_lineages
                    result = {
                        "positions_by_value": positions_by_value,
                        "lineages": lineages,
                        "total_count": total_count,
                    }
                except CSRArtifactCapabilityError as exc:
                    result = {"error": str(exc), "code": exc.code}
                await sio.emit("search-metadata-multi-result", result, to=sid)
                return

            ctx = await get_file_context(session.file_path)
            if ctx is None:
                await sio.emit("search-metadata-multi-result", {
                    "error": "Failed to load tree sequence"
                }, to=sid)
                return

            ts = ctx.tree_sequence

            result = await get_multi_value_highlight_positions(
                ts,
                session.file_path,
                metadata_key,
                metadata_values,
                tree_indices,
                lorax_sid,
                tree_graph_cache,
                show_lineages,
                ctx=ctx,
                time_scale=time_scale,
            )

            await sio.emit("search-metadata-multi-result", result, to=sid)
        except Exception as e:
            print(f"❌ Search metadata multi error: {e}")
            await sio.emit("search-metadata-multi-result", {"error": str(e)}, to=sid)

    @sio.event
    async def compare_trees_event(sid, data):
        """Socket event for compare mode: receive visible tree indices from frontend.

        data: {
            lorax_sid: str,
            tree_indices: [int]   # Visible tree indices
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return
            tree_indices = data.get("tree_indices", [])
            time_scale = normalize_time_scale(data.get("timeScale"))
            if not session.file_path:
                await sio.emit(
                    "compare-trees-result",
                    {"comparisons": [], "error": ERROR_NO_FILE_LOADED},
                    to=sid,
                )
                return

            if is_artifact_session(session):
                context = await asyncio.to_thread(context_for_session, session)
                result = await asyncio.to_thread(
                    _compare_artifact_trees,
                    context,
                    tree_indices,
                    time_scale,
                )
            else:
                result = await get_compare_trees_diff(
                    session.file_path,
                    tree_indices,
                    lorax_sid,
                    tree_graph_cache,
                    csv_tree_graph_cache=csv_tree_graph_cache,
                    time_scale=time_scale,
                )
            await sio.emit("compare-trees-result", result, to=sid)
        except Exception as e:
            print(f"❌ Compare trees event error: {e}")
            await sio.emit(
                "compare-trees-result",
                {"comparisons": [], "error": str(e)},
                to=sid,
            )
