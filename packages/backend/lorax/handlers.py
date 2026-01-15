# handlers.py
import os
import json
import asyncio
import re
from collections import OrderedDict, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import psutil
import pyarrow as pa
import tskit
import tszip

from lorax.viz.trees_to_taxonium import process_csv
from lorax.cloud.gcs_utils import get_public_gcs_dict
from lorax.tree_graph import construct_trees_batch
from lorax.utils import (
    LRUCacheWithMeta,
    make_json_safe,
    ensure_json_dict,
    list_project_files,
    make_json_serializable,
)
from lorax.metadata.loader import (
    get_metadata_for_key,
    search_samples_by_metadata,
    get_metadata_array_for_key
)
from lorax.metadata.mutations import (
    get_mutations_in_window,
    search_mutations_by_position
)
from lorax.buffer import mutations_to_arrow_buffer
from lorax.constants import TS_CACHE_SIZE

from lorax.loaders.loader import get_or_load_config

_cache_lock = asyncio.Lock()

# Global cache for loaded tree sequences (kept here as it deals with Data)
# Uses LRUCacheWithMeta to track file mtime for cache validation
_ts_cache = LRUCacheWithMeta(max_size=TS_CACHE_SIZE)
# _config_cache moved to loader.py
# _metadata_cache moved to metadata/loader.py


def _get_file_mtime(file_path: str) -> float:
    """Get file modification time, or 0 if file doesn't exist."""
    try:
        return Path(file_path).stat().st_mtime
    except (OSError, FileNotFoundError):
        return 0.0


async def get_or_load_ts(file_path):
    """
    Load a tree sequence from file_path with mtime validation.

    Validates that cached tree sequence matches current file on disk.
    This prevents serving stale data if the file was updated.
    """

    # Check if file exists
    file_path_obj = Path(file_path)
    if not file_path_obj.exists():
        # If file was cached but no longer exists, remove from cache
        _ts_cache.remove(file_path)
        print(f"❌ File not found: {file_path}")
        return None

    current_mtime = _get_file_mtime(file_path)

    # Double-checked locking optimization
    # 1. Optimistic check (lock-free read)
    ts, cached_mtime = _ts_cache.get_with_meta(file_path)
    if ts is not None:
        # Validate mtime hasn't changed
        if cached_mtime == current_mtime:
            print(f"✅ Using cached tree sequence: {file_path}")
            return ts
        else:
            print(f"🔄 File changed, reloading: {file_path}")
            _ts_cache.remove(file_path)

    async with _cache_lock:
        # 2. Check again under lock (in case another task loaded it while we waited)
        ts, cached_mtime = _ts_cache.get_with_meta(file_path)
        if ts is not None and cached_mtime == current_mtime:
            print(f"✅ Using cached tree sequence (after lock): {file_path}")
            return ts

        print(f"📂 Loading tree sequence from: {file_path}")
        try:
            def choose_file_loader(fp):
                if fp.endswith('.tsz'):
                    return tszip.load(fp)
                elif fp.endswith('.trees'):
                    return tskit.load(fp)
                else:
                    return pd.read_csv(fp)

            ts = await asyncio.to_thread(choose_file_loader, file_path)
            # Store with current mtime for validation
            _ts_cache.set(file_path, ts, meta=current_mtime)
            return ts
        except Exception as e:
            print(f"❌ Failed to load {file_path}: {e}")
            return None

async def cache_status():
    """Return current memory usage and cache statistics."""
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    rss_mb = mem_info.rss / (1024 * 1024)
    vms_mb = mem_info.vms / (1024 * 1024)
    
    # helper to check cache size if it exists in imported module or here
    # We only have _ts_cache here now
    
    return {
        "rss_MB": round(rss_mb, 2),
        "vms_MB": round(vms_mb, 2),
        "ts_cache_size": len(_ts_cache.cache),
        "config_cache_size": "n/a", # Managed in loader.py, could expose if needed
        "pid": os.getpid(),
    }


async def handle_edges_query(file_path, start, end):
    """Fetch edges for a genomic interval [start, end).
    
    Args:
        file_path: Path to tree sequence file
        start: Start genomic position (bp)
        end: End genomic position (bp)
    
    Returns:
        JSON string with edges data or error
    """
    ts = await get_or_load_ts(file_path)
    if ts is None:
        return json.dumps({"error": "Tree sequence not loaded. Please load a file first."})
    try:
        edges = await asyncio.to_thread(get_edges_for_interval, ts, start, end)
        return json.dumps({"edges": edges.tolist(), "start": start, "end": end})
    except Exception as e:
        print("Error in handle_edges_query", e)
        return json.dumps({"error": f"Error fetching edges: {str(e)}"})











def get_edges_for_interval(ts, start, end):
    edges = ts.tables.edges

    # FAST slicing: edges.left is sorted
    hi = np.searchsorted(edges.left, end, side="left")

    mask = edges.right[:hi] > start

    return np.column_stack((
        edges.left[:hi][mask],
        edges.right[:hi][mask],
        edges.parent[:hi][mask],
        edges.child[:hi][mask],
    ))


async def handle_upload(file_path, root_dir):
    """Load a tree sequence file and return its configuration."""
    ts = await get_or_load_ts(file_path)
    print("File loading complete")
    return ts

async def get_projects(upload_dir, BUCKET_NAME):
    """List all projects and their files from local uploads and GCS bucket."""
    projects = {}
    upload_dir = str(upload_dir)
    projects[upload_dir] = {
        "folder": upload_dir,
        "files": [],
        "description": "",
    }
    projects = list_project_files(upload_dir, projects, root=upload_dir)
    projects = get_public_gcs_dict(BUCKET_NAME, sid=None, projects=projects)
    return projects

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
            # Check if this sample is in this tree (has edges in this interval)
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
                tree_lineages = []
                for seed_node in tree_seeds:
                    # Trace ancestry path from sample to root
                    path_nodes = []
                    current = seed_node
                    while current != -1 and current != tskit.NULL:
                        path_nodes.append(current)
                        current = tree.parent(current)

                    if len(path_nodes) > 1:
                        # Get color for this lineage
                        name = name_map.get(seed_node, str(seed_node))
                        color = None
                        if sample_colors:
                            color = sample_colors.get(name.lower())

                        tree_lineages.append({
                            "path_node_ids": [int(n) for n in path_nodes],
                            "color": color
                        })

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
    """Get all mutations on a specific node, optionally filtered by tree interval."""
    mutations = []

    # Get tree interval if tree_index is specified
    tree_interval = None
    if tree_index is not None:
        tree = ts.at_index(tree_index)
        tree_interval = tree.interval

    for mut in ts.mutations():
        if mut.node == node_id:
            site = ts.site(mut.site)

            # Filter by tree interval if specified
            if tree_interval is not None:
                if not (site.position >= tree_interval.left and site.position < tree_interval.right):
                    continue

            mutations.append({
                "id": int(mut.id),
                "site_id": int(mut.site),
                "position": float(site.position),
                "ancestral_state": site.ancestral_state,
                "derived_state": mut.derived_state,
                "time": float(mut.time) if mut.time != tskit.UNKNOWN_TIME else None,
                "parent_mutation": int(mut.parent) if mut.parent != -1 else None,
                "metadata": make_json_serializable(mut.metadata) if mut.metadata else None
            })

    return mutations


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
        ts = await get_or_load_ts(file_path)
        if ts is None:
            return json.dumps({"error": "Tree sequence (ts) is not set. Please upload a file first."})

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

                # Edges for this node
                return_data["edges"] = get_edges_for_node(
                    ts, node_id, tree_index
                )

        return json.dumps(return_data)
    except Exception as e:
        return json.dumps({"error": f"Error getting details: {str(e)}"})


async def handle_tree_graph_query(file_path, tree_indices, sparsity_resolution=None, sparsity_precision=None):
    """
    Construct trees using Numba-optimized tree_graph module.

    This is an alternative to handle_postorder_query that uses the faster
    Numba-compiled tree construction for large tree sequences.

    Args:
        file_path: Path to tree sequence file
        tree_indices: List of tree indices to process
        sparsity_resolution: Optional grid resolution for sparsification
        sparsity_precision: Optional decimal precision for sparsification

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
    ts = await get_or_load_ts(file_path)
    if ts is None:
        return {"error": "Tree sequence not loaded. Please load a file first."}

    # Run in thread pool to avoid blocking
    def process_trees():
        return construct_trees_batch(
            ts,
            tree_indices,
            sparsity_resolution=sparsity_resolution,
            sparsity_precision=sparsity_precision
        )

    buffer, min_time, max_time, processed_indices = await asyncio.to_thread(process_trees)

    return {
        "buffer": buffer,
        "global_min_time": min_time,
        "global_max_time": max_time,
        "tree_indices": processed_indices
    }