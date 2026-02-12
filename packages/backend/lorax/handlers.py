# handlers.py
import os
import json
import asyncio
import re

import numpy as np
import pandas as pd
import psutil
import tskit

from lorax.modes import CURRENT_MODE
from lorax.cloud.gcs_utils import get_public_gcs_dict
from lorax.tree_graph import construct_trees_batch, construct_tree, TreeGraph
from lorax.csv.layout import build_empty_layout_response, build_csv_layout_response
from lorax.utils import (
    ensure_json_dict,
    list_project_files,
    make_json_serializable,
)
from lorax.metadata.loader import (
    get_metadata_for_key,
    search_samples_by_metadata,
    get_metadata_array_for_key,
    _get_sample_metadata_value
)
from lorax.metadata.mutations import (
    get_mutations_in_window,
    search_mutations_by_position
)
from lorax.buffer import mutations_to_arrow_buffer
from lorax.cache import get_file_context, get_file_cache_size
def _get_tip_shift_project_prefixes() -> list[str]:
    """Return project name prefixes that should shift CSV tips to y=1."""
    raw = os.getenv("LORAX_CSV_TIP_SHIFT_PROJECTS", "heliconius")
    parts = [p.strip().lower() for p in raw.split(",") if p.strip()]
    return parts


def should_shift_csv_tips(file_path: str) -> bool:
    """Return True when the file path matches a configured project prefix."""
    if not file_path:
        return False
    prefixes = _get_tip_shift_project_prefixes()
    if not prefixes:
        return False
    parts = re.split(r"[\\/]", str(file_path))
    for part in parts:
        if not part:
            continue
        part_l = str(part).lower()
        if any(part_l.startswith(prefix) for prefix in prefixes):
            return True
    return False


def _is_heliconius_project(file_path: str) -> bool:
    """Return True when the file path indicates a Heliconius project (case-insensitive)."""
    if not file_path:
        return False
    parts = re.split(r"[\\/]", str(file_path))
    for part in parts:
        if part and str(part).lower().startswith("heliconius"):
            return True
    return False


async def cache_status():
    """Return current memory usage and cache statistics."""
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    rss_mb = mem_info.rss / (1024 * 1024)
    vms_mb = mem_info.vms / (1024 * 1024)

    return {
        "rss_MB": round(rss_mb, 2),
        "vms_MB": round(vms_mb, 2),
        "file_cache_size": get_file_cache_size(),
        "pid": os.getpid(),
    }


async def handle_upload(file_path, root_dir):
    """Load a file and return its FileContext."""
    ctx = await get_file_context(file_path, root_dir)
    print("File loading complete")
    return ctx


async def get_projects(upload_dir, BUCKET_NAME, sid=None):
    """List all projects and their files from local uploads and GCS bucket."""
    projects = {}
    upload_dir = str(upload_dir)
    # Avoid listing Uploads/<sid> as separate projects; add session-scoped uploads below.
    projects = list_project_files(
        upload_dir,
        projects,
        root=upload_dir,
        exclude_dirs=["Uploads"],
    )

    # Prefer session-scoped Uploads/<sid> when available (non-local); local uses flat Uploads
    upload_files = []
    uploads_root = None
    if CURRENT_MODE == "local":
        uploads_root = os.path.join(upload_dir, "Uploads")
    else:
        uploads_root = os.path.join(upload_dir, "Uploads", sid) if sid else None

    if uploads_root and os.path.isdir(uploads_root):
        for item in os.listdir(uploads_root):
            if item.endswith((".trees", ".trees.tsz", ".csv")):
                upload_files.append(item)

    projects["Uploads"] = {
        "folder": "Uploads",
        "files": sorted(set(upload_files)),
        "description": "",
    }
    # Remove accidental project entry created from Uploads/<sid>
    if sid and sid in projects:
        projects.pop(sid, None)

    # Merge GCS projects: always include non-Uploads; Uploads only per mode rules
    if CURRENT_MODE == "local":
        projects = get_public_gcs_dict(
            BUCKET_NAME,
            sid=sid,
            projects=projects,
            include_uploads=False,
            uploads_sid=None,
        )
    else:
        projects = get_public_gcs_dict(
            BUCKET_NAME,
            sid=sid,
            projects=projects,
            include_uploads=True,
            uploads_sid=sid,
        )

    return projects

def _build_sample_name_mapping(ts, sample_name_key="name"):
    """
    Build mapping from sample name (lowercase) to node_id.

    Args:
        ts: tskit.TreeSequence
        sample_name_key: Key in node metadata used as sample name

    Returns:
        dict mapping lowercase sample name to node_id
    """
    name_to_node_id = {}
    for node_id in ts.samples():
        node = ts.node(node_id)
        node_meta = node.metadata or {}
        try:
            node_meta = ensure_json_dict(node_meta)
        except (TypeError, json.JSONDecodeError):
            node_meta = {}
        name = str(node_meta.get(sample_name_key, f"{node_id}"))
        name_to_node_id[name.lower()] = node_id
    return name_to_node_id


def _compute_lineage_paths(tree, tree_seeds, name_map, sample_colors):
    """
    Compute ancestry paths for seed nodes in a tree.

    Args:
        tree: tskit.Tree object
        tree_seeds: List of seed node IDs to trace ancestry
        name_map: Dict mapping node_id to original name
        sample_colors: Optional dict {sample_name: [r,g,b,a]} for coloring

    Returns:
        List of lineage dicts with path_node_ids and color
    """
    tree_lineages = []
    for seed_node in tree_seeds:
        # Trace ancestry path from sample to root
        path_nodes = []
        current = seed_node
        while current != -1 and current != tskit.NULL:
            path_nodes.append(current)
            current = tree.parent(current)

        if len(path_nodes) > 1:
            # Emit root -> tip to match frontend L-shape construction.
            path_nodes = list(reversed(path_nodes))

            # Get color for this lineage
            name = name_map.get(seed_node, str(seed_node))
            color = None
            if sample_colors:
                color = sample_colors.get(name.lower())

            tree_lineages.append({
                "path_node_ids": [int(n) for n in path_nodes],
                "color": color
            })

    return tree_lineages


def search_nodes_in_trees(
    ts,
    sample_names,
    tree_indices,
    show_lineages=False,
    sample_colors=None,
    sample_name_key="name"
):
    """
    Search for nodes matching sample names in specified trees.
    Returns highlights and optionally lineage paths.

    Args:
        ts: tskit.TreeSequence
        sample_names: List of sample names to search for
        tree_indices: List of tree indices to search in
        show_lineages: Whether to compute lineage (ancestry) paths
        sample_colors: Optional dict {sample_name: [r,g,b,a]} for coloring
        sample_name_key: Key in node metadata used as sample name

    Returns:
        dict with:
        - highlights: {tree_idx: [{node_id, name}]}
        - lineage: {tree_idx: [{path: [[x,y]...], color}]} if show_lineages
    """
    if not sample_names or not tree_indices:
        return {"highlights": {}, "lineage": {}}

    # Build sample_name -> node_id mapping
    name_to_node_id = _build_sample_name_mapping(ts, sample_name_key)

    # Convert sample_names to node_ids
    target_node_ids = set()
    name_map = {}  # node_id -> original name
    for name in sample_names:
        lower_name = name.lower()
        if lower_name in name_to_node_id:
            nid = name_to_node_id[lower_name]
            target_node_ids.add(nid)
            name_map[nid] = name

    if not target_node_ids:
        return {"highlights": {}, "lineage": {}}

    highlights = {}
    lineage = {}

    for tree_idx in tree_indices:
        tree_idx = int(tree_idx)
        if tree_idx < 0 or tree_idx >= ts.num_trees:
            continue

        tree = ts.at_index(tree_idx)

        # Find matching samples in this tree
        tree_highlights = []
        tree_seeds = []  # For lineage computation

        for node_id in target_node_ids:
            # Check if this sample is in this tree
            if tree.is_sample(node_id):
                name = name_map.get(node_id, str(node_id))
                tree_highlights.append({
                    "node_id": int(node_id),
                    "name": name
                })
                tree_seeds.append(node_id)

        if tree_highlights:
            highlights[tree_idx] = tree_highlights

            # Compute lineage paths if requested
            if show_lineages and tree_seeds:
                tree_lineages = _compute_lineage_paths(
                    tree, tree_seeds, name_map, sample_colors
                )
                if tree_lineages:
                    lineage[tree_idx] = tree_lineages

    return {"highlights": highlights, "lineage": lineage}


def get_node_details(ts, node_name):
    """Get details for a specific node in the tree sequence."""
    node = ts.node(node_name)
    return {
        "id": node.id,
        "time": node.time,
        "population": node.population,
        "individual": node.individual,
        "metadata": make_json_serializable(node.metadata)
    }


def get_tree_details(ts, tree_index):
    """Get details for a specific tree at the given index."""
    tree = ts.at_index(tree_index)

    mutations = []
    for mut in tree.mutations():
        site = ts.site(mut.site)
        mutations.append({
            "id": mut.id,
            "node": mut.node,  # Node ID for highlighting
            "site_id": mut.site,
            "position": site.position,
            "derived_state": mut.derived_state,
            "inherited_state": ts.mutation(mut.parent).derived_state if mut.parent != -1 else site.ancestral_state
        })

    return {
        "interval": tree.interval,
        "num_roots": tree.num_roots,
        "num_nodes": tree.num_nodes,
        "mutations": mutations
    }


def get_individual_details(ts, individual_id):
    """Get details for a specific individual in the tree sequence."""
    individual = ts.individual(individual_id)
    return {
        "id": individual.id,
        "nodes": make_json_serializable(individual.nodes),
        "metadata": make_json_serializable(individual.metadata)
    }


def get_comprehensive_individual_details(ts, individual_id):
    """Get comprehensive individual table data including location, parents, flags."""
    if individual_id is None or individual_id == -1:
        return None

    individual = ts.individual(individual_id)
    return {
        "id": int(individual.id),
        "flags": int(individual.flags),
        "location": list(individual.location) if len(individual.location) > 0 else None,
        "parents": [int(p) for p in individual.parents] if len(individual.parents) > 0 else [],
        "nodes": [int(n) for n in individual.nodes],
        "metadata": make_json_serializable(individual.metadata)
    }


def get_population_details(ts, population_id):
    """Get population table data."""
    if population_id is None or population_id == -1:
        return None
    pop = ts.population(population_id)
    return {
        "id": int(pop.id),
        "metadata": make_json_serializable(pop.metadata)
    }


def get_mutations_for_node(ts, node_id, tree_index=None):
    """Get all mutations on a specific node, optionally filtered by tree interval.

    Uses vectorized numpy/tskit table access instead of Python iteration over
    all mutations, for much faster performance on large tree sequences.
    """
    t = ts.tables
    sites = t.sites
    mutations = t.mutations

    # Vectorized: get positions for all mutations via their sites
    positions = sites.position[mutations.site]

    # Filter by node (vectorized)
    node_mask = mutations.node == node_id

    # Filter by tree interval if specified
    if tree_index is not None:
        tree = ts.at_index(tree_index)
        left, right = tree.interval.left, tree.interval.right
        pos_mask = (positions >= left) & (positions < right)
        node_mask = node_mask & pos_mask

    indices = np.where(node_mask)[0]

    # Build result - loop only over matched mutations (typically small)
    result = []
    for idx in indices:
        mut = mutations[idx]
        site_id = int(mut.site)
        site = sites[site_id]
        mut_time = mut.time
        mut_parent = mut.parent

        result.append({
            "id": int(idx),
            "site_id": site_id,
            "position": float(site.position),
            "ancestral_state": site.ancestral_state,
            "derived_state": mut.derived_state,
            "time": float(mut_time) if mut_time != tskit.UNKNOWN_TIME else None,
            "parent_mutation": int(mut_parent) if mut_parent != -1 else None,
            "metadata": make_json_serializable(mut.metadata) if mut.metadata else None
        })

    return result


def get_edges_for_node(ts, node_id, tree_index=None):
    """Get all edges where this node is parent or child."""
    edges = {
        "as_parent": [],  # Edges where node is parent
        "as_child": []    # Edges where node is child
    }

    # Get tree interval if tree_index is specified
    tree_interval = None
    if tree_index is not None:
        tree = ts.at_index(tree_index)
        tree_interval = tree.interval

    for edge in ts.edges():
        # Filter by tree interval if specified (edge must overlap with tree)
        if tree_interval is not None:
            if edge.right <= tree_interval.left or edge.left >= tree_interval.right:
                continue

        edge_data = {
            "id": int(edge.id),
            "left": float(edge.left),
            "right": float(edge.right),
            "parent": int(edge.parent),
            "child": int(edge.child)
        }

        if edge.parent == node_id:
            edges["as_parent"].append(edge_data)
        if edge.child == node_id:
            edges["as_child"].append(edge_data)

    return edges


async def handle_details(file_path, data):
    """Handle requests for tree, node, and individual details."""
    try:
        ctx = await get_file_context(file_path)
        if ctx is None:
            return json.dumps({"error": "Tree sequence (ts) is not set. Please upload a file first."})

        print(f"Getting details for file: {file_path}", data)
        ts = ctx.tree_sequence
        return_data = {}
        tree_index = data.get("treeIndex")
        comprehensive = data.get("comprehensive", False)

        if tree_index is not None:
            return_data["tree"] = get_tree_details(ts, int(tree_index))

        node_name = data.get("node")
        if node_name is not None:
            node_id = int(node_name)
            node_details = get_node_details(ts, node_id)
            return_data["node"] = node_details

            # Auto-fetch individual details
            if node_details.get("individual") != -1:
                if comprehensive:
                    return_data["individual"] = get_comprehensive_individual_details(
                        ts, node_details.get("individual")
                    )
                else:
                    return_data["individual"] = get_individual_details(
                        ts, node_details.get("individual")
                    )

            # Comprehensive mode: add population, mutations, edges
            if comprehensive:
                # Population
                if node_details.get("population") != -1:
                    return_data["population"] = get_population_details(
                        ts, node_details.get("population")
                    )

                # Mutations on this node
                return_data["mutations"] = get_mutations_for_node(
                    ts, node_id, tree_index
                )

                # # Edges for this node
                # return_data["edges"] = get_edges_for_node(
                #     ts, node_id, tree_index
                # )

        return json.dumps(return_data)
    except Exception as e:
        return json.dumps({"error": f"Error getting details: {str(e)}"})


async def handle_tree_graph_query(
    file_path,
    tree_indices,
    sparsification=False,
    session_id: str = None,
    tree_graph_cache=None,
    csv_tree_graph_cache=None,
    actual_display_array=None
):
    """
    Construct trees using Numba-optimized tree_graph module.

    Args:
        file_path: Path to tree sequence file
        tree_indices: List of tree indices to process
        sparsification: Enable sparsification (default False). Uses edge-midpoint grid deduplication.
        session_id: Session ID for cache lookup/storage
        tree_graph_cache: TreeGraphCache instance for caching TreeGraph objects

    Returns:
        dict with:
        - buffer: PyArrow IPC binary data containing:
            - node_id: int32 (tskit node ID)
            - parent_id: int32 (-1 for roots)
            - is_tip: bool
            - tree_idx: int32 (which tree this node belongs to)
            - x: float32 (time-based coordinate [0,1])
            - y: float32 (layout-based coordinate [0,1])
        - global_min_time: float
        - global_max_time: float
        - tree_indices: list[int]
    """
    ctx = await get_file_context(file_path)
    if ctx is None:
        return {"error": "Tree sequence not loaded. Please load a file first."}

    ts = ctx.tree_sequence

    # CSV support: parse Newick strings and build tree layout
    if isinstance(ts, pd.DataFrame):
        shift_tips_to_one = should_shift_csv_tips(ctx.file_path or file_path)
        # Get max_branch_length from config (times.values[1])
        times_values = ctx.config.get("times", {}).get("values", [0.0, 1.0])
        max_branch_length = float(times_values[1]) if len(times_values) > 1 else 1.0
        indices = [int(t) for t in (tree_indices or [])]
        samples_order = ctx.config.get("samples") or []
        pre_parsed_graphs = {}
        if session_id and csv_tree_graph_cache:
            from lorax.csv.newick_tree import parse_newick_to_tree

            for tree_idx in indices:
                cached = await csv_tree_graph_cache.get(session_id, int(tree_idx))
                if cached is not None:
                    pre_parsed_graphs[int(tree_idx)] = cached
                    continue

                # Cache miss: parse and store (best-effort)
                try:
                    newick_str = ts.iloc[int(tree_idx)].get("newick")
                except Exception:
                    newick_str = None
                if newick_str is None or pd.isna(newick_str):
                    continue

                tree_max_branch_length = None
                if "max_branch_length" in ts.columns:
                    try:
                        v = ts.iloc[int(tree_idx)].get("max_branch_length")
                        if v is not None and not (isinstance(v, float) and pd.isna(v)) and str(v).strip() != "":
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
                    continue

                pre_parsed_graphs[int(tree_idx)] = graph
                await csv_tree_graph_cache.set(session_id, int(tree_idx), graph)

            if actual_display_array is not None:
                await csv_tree_graph_cache.evict_not_visible(session_id, set(actual_display_array))

        return build_csv_layout_response(
            ts,
            indices,
            max_branch_length,
            samples_order=samples_order,
            pre_parsed_graphs=pre_parsed_graphs,
            shift_tips_to_one=shift_tips_to_one,
        )

    # Collect pre-cached TreeGraphs
    pre_cached_graphs = {}
    if session_id and tree_graph_cache:
        for tree_idx in tree_indices:
            cached = await tree_graph_cache.get(session_id, int(tree_idx))
            if cached is not None:
                pre_cached_graphs[int(tree_idx)] = cached
        if pre_cached_graphs:
            print(f"TreeGraph cache hits: {len(pre_cached_graphs)}/{len(tree_indices)} trees")

    # Run in thread pool to avoid blocking
    def process_trees():
        return construct_trees_batch(
            ts,
            tree_indices,
            sparsification=sparsification,
            pre_cached_graphs=pre_cached_graphs
        )

    buffer, min_time, max_time, processed_indices, newly_built = await asyncio.to_thread(process_trees)

    # Cache newly built TreeGraphs
    if session_id and tree_graph_cache and newly_built:
        for tree_idx, graph in newly_built.items():
            await tree_graph_cache.set(session_id, tree_idx, graph)
        print(f"TreeGraph cached: {len(newly_built)} new trees for session {session_id[:8]}...")

    # Evict trees no longer in visible set (visibility-based eviction)
    if session_id and tree_graph_cache and actual_display_array is not None:
        await tree_graph_cache.evict_not_visible(session_id, set(actual_display_array))

    return {
        "buffer": buffer,
        "global_min_time": min_time,
        "global_max_time": max_time,
        "tree_indices": processed_indices
    }


async def get_or_construct_tree_graph(
    file_path: str,
    tree_index: int,
    session_id: str,
    tree_graph_cache
) -> TreeGraph:
    """
    Get a TreeGraph from cache or construct and cache it.

    This function is used by lineage operations that need the full TreeGraph
    structure for ancestor/descendant traversal.

    Args:
        file_path: Path to tree sequence file
        tree_index: Index of the tree to get
        session_id: Session ID for cache key
        tree_graph_cache: TreeGraphCache instance

    Returns:
        TreeGraph object, or None if file not loaded
    """
    # Check cache first
    cached = await tree_graph_cache.get(session_id, tree_index)
    if cached is not None:
        print(f"TreeGraph cache hit: session={session_id[:8]}... tree={tree_index}")
        return cached

    # Load file context
    ctx = await get_file_context(file_path)
    if ctx is None:
        return None

    ts = ctx.tree_sequence

    # Can't construct TreeGraph for CSV
    if isinstance(ts, pd.DataFrame):
        return None

    # Construct tree graph
    def _construct():
        edges = ts.tables.edges
        nodes = ts.tables.nodes
        breakpoints = list(ts.breakpoints())
        min_time = float(ts.min_time)
        max_time = float(ts.max_time)
        return construct_tree(ts, edges, nodes, breakpoints, tree_index, min_time, max_time)

    tree_graph = await asyncio.to_thread(_construct)

    # Cache it
    await tree_graph_cache.set(session_id, tree_index, tree_graph)
    print(f"TreeGraph cached: session={session_id[:8]}... tree={tree_index}")

    return tree_graph


def _edges_from_tree_graph(tg) -> set:
    """Extract (parent, child) edge set from TreeGraph."""
    edges = set()
    for n in np.where(tg.in_tree)[0]:
        p = int(tg.parent[n])
        if p >= 0:
            edges.add((p, int(n)))
    return edges


def _edge_with_coords(tg, parent: int, child: int) -> dict:
    """Get edge dict with x,y coordinates (frontend convention: x=time, y=layout)."""
    return {
        "parent": parent,
        "child": child,
        "parent_x": float(tg.y[parent]),
        "parent_y": float(tg.x[parent]),
        "child_x": float(tg.y[child]),
        "child_y": float(tg.x[child]),
    }


def _edges_from_newick_tree_graph(ng) -> set:
    """Extract (parent, child) edge set from NewickTreeGraph."""
    edges = set()
    for i in range(len(ng.parent_id)):
        p = int(ng.parent_id[i])
        if p >= 0:
            c = int(ng.node_id[i])
            edges.add((p, c))
    return edges


def _newick_node_id_to_index(ng, node_id: int) -> int | None:
    """Map node_id to array index in NewickTreeGraph (node_id can differ from index)."""
    idxs = np.where(ng.node_id == int(node_id))[0]
    return int(idxs[0]) if idxs.size > 0 else None


def _edge_with_coords_newick(ng, parent: int, child: int) -> dict | None:
    """Edge dict with x,y (frontend convention: x=time, y=layout) for NewickTreeGraph."""
    pi = _newick_node_id_to_index(ng, parent)
    ci = _newick_node_id_to_index(ng, child)
    if pi is None or ci is None:
        return None
    return {
        "parent": parent,
        "child": child,
        "parent_x": float(ng.y[pi]),
        "parent_y": float(ng.x[pi]),
        "child_x": float(ng.y[ci]),
        "child_y": float(ng.x[ci]),
    }


async def get_compare_trees_diff(
    file_path: str,
    tree_indices: list,
    session_id: str,
    tree_graph_cache,
    csv_tree_graph_cache=None,
) -> dict:
    """
    Compare consecutive trees and return inserted/removed edges with coordinates.

    Args:
        file_path: Path to tree sequence file
        tree_indices: List of visible tree indices
        session_id: Session ID for cache key
        tree_graph_cache: TreeGraphCache instance (tskit)
        csv_tree_graph_cache: CsvTreeGraphCache instance (for CSV)

    Returns:
        dict with comparisons: [{prev_idx, next_idx, inserted: [...], removed: [...]}]
    """
    from lorax.csv.cache import get_or_parse_csv_tree_graph
    from lorax.sockets.utils import is_csv_session_file

    if not tree_indices or len(tree_indices) < 2:
        return {"comparisons": []}

    ctx = await get_file_context(file_path)
    if ctx is None:
        return {"comparisons": [], "error": "No file loaded"}

    ts = ctx.tree_sequence
    is_csv = is_csv_session_file(file_path) or isinstance(ts, pd.DataFrame)

    if is_csv:
        if not csv_tree_graph_cache:
            return {"comparisons": [], "error": "CSV compare requires csv_tree_graph_cache"}
        num_trees = len(ts)
        indices = [int(i) for i in tree_indices if 0 <= int(i) < num_trees]
        shift_tips_to_one = should_shift_csv_tips(file_path)

        comparisons = []
        for i in range(len(indices) - 1):
            prev_idx = indices[i]
            next_idx = indices[i + 1]

            ng_prev = await get_or_parse_csv_tree_graph(
                ctx, session_id, prev_idx, csv_tree_graph_cache, shift_tips_to_one
            )
            ng_next = await get_or_parse_csv_tree_graph(
                ctx, session_id, next_idx, csv_tree_graph_cache, shift_tips_to_one
            )
            if ng_prev is None or ng_next is None:
                continue

            edges_prev = _edges_from_newick_tree_graph(ng_prev)
            edges_next = _edges_from_newick_tree_graph(ng_next)

            inserted = edges_next - edges_prev
            removed = edges_prev - edges_next

            inserted_list = []
            for p, c in inserted:
                e = _edge_with_coords_newick(ng_next, p, c)
                if e is not None:
                    inserted_list.append(e)
            removed_list = []
            for p, c in removed:
                e = _edge_with_coords_newick(ng_prev, p, c)
                if e is not None:
                    removed_list.append(e)

            comparisons.append({
                "prev_idx": prev_idx,
                "next_idx": next_idx,
                "inserted": inserted_list,
                "removed": removed_list,
            })

        return {"comparisons": comparisons}

    comparisons = []
    indices = [int(i) for i in tree_indices if 0 <= int(i) < ts.num_trees]

    for i in range(len(indices) - 1):
        prev_idx = indices[i]
        next_idx = indices[i + 1]

        tg_prev = await get_or_construct_tree_graph(
            file_path, prev_idx, session_id, tree_graph_cache
        )
        tg_next = await get_or_construct_tree_graph(
            file_path, next_idx, session_id, tree_graph_cache
        )
        if tg_prev is None or tg_next is None:
            continue

        edges_prev = _edges_from_tree_graph(tg_prev)
        edges_next = _edges_from_tree_graph(tg_next)

        inserted = edges_next - edges_prev
        removed = edges_prev - edges_next

        inserted_list = [
            _edge_with_coords(tg_next, p, c) for p, c in inserted
        ]
        removed_list = [
            _edge_with_coords(tg_prev, p, c) for p, c in removed
        ]

        comparisons.append({
            "prev_idx": prev_idx,
            "next_idx": next_idx,
            "inserted": inserted_list,
            "removed": removed_list,
        })

    return {"comparisons": comparisons}


async def ensure_trees_cached(
    file_path: str,
    tree_indices: list,
    session_id: str,
    tree_graph_cache
) -> int:
    """
    Ensure multiple trees are cached for a session.

    This is called after process_postorder_layout to cache trees for
    subsequent lineage operations.

    Args:
        file_path: Path to tree sequence file
        tree_indices: List of tree indices to cache
        session_id: Session ID for cache key
        tree_graph_cache: TreeGraphCache instance

    Returns:
        Number of trees newly cached (not already in cache)
    """
    ctx = await get_file_context(file_path)
    if ctx is None:
        return 0

    ts = ctx.tree_sequence

    if isinstance(ts, pd.DataFrame):
        return 0

    newly_cached = 0

    # Pre-extract tables for efficiency
    edges = ts.tables.edges
    nodes = ts.tables.nodes
    breakpoints = list(ts.breakpoints())
    min_time = float(ts.min_time)
    max_time = float(ts.max_time)

    for tree_index in tree_indices:
        tree_index = int(tree_index)

        # Skip if already cached
        cached = await tree_graph_cache.get(session_id, tree_index)
        if cached is not None:
            continue

        # Construct and cache
        def _construct(idx):
            return construct_tree(ts, edges, nodes, breakpoints, idx, min_time, max_time)

        tree_graph = await asyncio.to_thread(_construct, tree_index)
        await tree_graph_cache.set(session_id, tree_index, tree_graph)
        newly_cached += 1

    if newly_cached > 0:
        print(f"Cached {newly_cached} trees for session {session_id[:8]}...")

    return newly_cached


def _get_matching_sample_nodes(ts, metadata_key, metadata_value, sources, sample_name_key):
    """
    Find all sample node IDs that match a metadata value.

    Args:
        ts: tskit.TreeSequence
        metadata_key: Metadata key to filter by
        metadata_value: Metadata value to match
        sources: Metadata sources to search
        sample_name_key: Key in node metadata used as sample name

    Returns:
        Set of matching node IDs
    """
    matching_node_ids = set()
    for node_id in ts.samples():
        sample_name, value = _get_sample_metadata_value(
            ts, node_id, metadata_key, sources, sample_name_key
        )
        if value is not None and str(value) == str(metadata_value):
            matching_node_ids.add(node_id)
    return matching_node_ids


async def _ensure_tree_graph_loaded(
    ts,
    tree_idx,
    session_id,
    tree_graph_cache,
    edges,
    nodes,
    breakpoints,
    min_time,
    max_time
):
    """
    Get tree graph from cache or construct and cache it.

    Args:
        ts: tskit.TreeSequence
        tree_idx: Tree index to load
        session_id: Session ID for cache key
        tree_graph_cache: TreeGraphCache instance
        edges, nodes, breakpoints, min_time, max_time: Pre-extracted table data

    Returns:
        TreeGraph object
    """
    from lorax.tree_graph import construct_tree

    # Try to get from cache first
    graph = await tree_graph_cache.get(session_id, tree_idx)
    if graph is not None:
        return graph

    # Construct tree graph
    def _construct():
        return construct_tree(ts, edges, nodes, breakpoints, tree_idx, min_time, max_time)

    graph = await asyncio.to_thread(_construct)

    # Cache it for future use
    await tree_graph_cache.set(session_id, tree_idx, graph)

    return graph


async def get_highlight_positions(
    ts,
    file_path,
    metadata_key,
    metadata_value,
    tree_indices,
    session_id: str,
    tree_graph_cache,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Get positions for all tip nodes with a specific metadata value.
    Uses cached TreeGraph objects when available.

    Args:
        ts: tskit.TreeSequence
        file_path: Path to tree sequence file (for cache key)
        metadata_key: Metadata key to filter by
        metadata_value: Metadata value to match
        tree_indices: List of tree indices to compute positions for
        session_id: Session ID for cache lookup
        tree_graph_cache: TreeGraphCache instance
        sources: Metadata sources to search
        sample_name_key: Key in node metadata used as sample name

    Returns:
        dict with:
        - positions: List of {node_id, tree_idx, x, y} dicts
    """
    if not tree_indices:
        return {"positions": []}

    # Get sample node IDs that have this metadata value
    matching_node_ids = _get_matching_sample_nodes(
        ts, metadata_key, metadata_value, sources, sample_name_key
    )

    if not matching_node_ids:
        return {"positions": []}

    # Pre-extract tables for reuse (only needed if cache miss)
    edges = ts.tables.edges
    nodes = ts.tables.nodes
    breakpoints = list(ts.breakpoints())
    min_time = float(ts.min_time)
    max_time = float(ts.max_time)

    positions = []

    # For each requested tree, get graph and extract positions
    for tree_idx in tree_indices:
        tree_idx = int(tree_idx)
        if tree_idx < 0 or tree_idx >= ts.num_trees:
            continue

        graph = await _ensure_tree_graph_loaded(
            ts, tree_idx, session_id, tree_graph_cache,
            edges, nodes, breakpoints, min_time, max_time
        )

        # Extract positions for matching nodes that are in this tree
        for node_id in matching_node_ids:
            if graph.in_tree[node_id]:
                positions.append({
                    "node_id": int(node_id),
                    "tree_idx": tree_idx,
                    "x": float(graph.x[node_id]),
                    "y": float(graph.y[node_id])
                })

    return {"positions": positions}


async def get_multi_value_highlight_positions(
    ts,
    file_path,
    metadata_key,
    metadata_values,  # List[str] - Array of values (OR logic)
    tree_indices,
    session_id: str,
    tree_graph_cache,
    show_lineages: bool = False,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Get positions for tip nodes matching ANY of the metadata values.
    Returns positions grouped by value for per-value coloring.

    Args:
        ts: tskit.TreeSequence
        file_path: Path to tree sequence file (for cache key)
        metadata_key: Metadata key to filter by
        metadata_values: List of metadata values to match (OR logic)
        tree_indices: List of tree indices to compute positions for
        session_id: Session ID for cache lookup
        tree_graph_cache: TreeGraphCache instance
        show_lineages: Whether to compute lineage (ancestry) paths
        sources: Metadata sources to search
        sample_name_key: Key in node metadata used as sample name

    Returns:
        dict with:
        - positions_by_value: {"Africa": [{node_id, tree_idx, x, y}, ...], ...}
        - lineages: {"Africa": {tree_idx: [{path_node_ids, color}]}} if show_lineages
        - total_count: int
    """
    if not tree_indices or not metadata_values:
        return {"positions_by_value": {}, "lineages": {}, "total_count": 0}

    # Deduplicate values
    unique_values = list(set(str(v) for v in metadata_values))

    # Pre-extract tables for reuse (only needed if cache miss)
    edges = ts.tables.edges
    nodes = ts.tables.nodes
    breakpoints = list(ts.breakpoints())
    min_time = float(ts.min_time)
    max_time = float(ts.max_time)

    positions_by_value = {}
    lineages = {} if show_lineages else None
    total_count = 0

    # For each value, find matching samples
    for value in unique_values:
        matching_node_ids = _get_matching_sample_nodes(
            ts, metadata_key, value, sources, sample_name_key
        )

        if not matching_node_ids:
            positions_by_value[value] = []
            continue

        value_positions = []
        value_lineages = {} if show_lineages else None

        # For each requested tree, get graph and extract positions
        for tree_idx in tree_indices:
            tree_idx = int(tree_idx)
            if tree_idx < 0 or tree_idx >= ts.num_trees:
                continue

            graph = await _ensure_tree_graph_loaded(
                ts, tree_idx, session_id, tree_graph_cache,
                edges, nodes, breakpoints, min_time, max_time
            )

            tree_positions = []
            tree_seeds = []  # For lineage computation

            # Extract positions for matching nodes that are in this tree
            for node_id in matching_node_ids:
                if graph.in_tree[node_id]:
                    tree_positions.append({
                        "node_id": int(node_id),
                        "tree_idx": tree_idx,
                        "x": float(graph.x[node_id]),
                        "y": float(graph.y[node_id])
                    })
                    tree_seeds.append(node_id)

            value_positions.extend(tree_positions)

            # Compute lineage paths if requested
            if show_lineages and tree_seeds:
                tree = ts.at_index(tree_idx)
                name_map = {nid: str(nid) for nid in tree_seeds}
                tree_lineages = _compute_lineage_paths(
                    tree, tree_seeds, name_map, None  # No per-sample colors, use value color
                )
                if tree_lineages:
                    value_lineages[tree_idx] = tree_lineages

        positions_by_value[value] = value_positions
        total_count += len(value_positions)

        if show_lineages and value_lineages:
            lineages[value] = value_lineages

    result = {
        "positions_by_value": positions_by_value,
        "total_count": total_count
    }

    if show_lineages:
        result["lineages"] = lineages

    return result
