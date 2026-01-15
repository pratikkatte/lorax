# handlers.py
import os
import json
import asyncio
import re
from collections import OrderedDict, defaultdict

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
    LRUCache, 
    make_json_safe, 
    ensure_json_dict, 
    list_project_files, 
    make_json_serializable,
    get_metadata_schema # Imported if used, though get_config was the main user
)
from lorax.config.loader import get_or_load_config

_cache_lock = asyncio.Lock()

# Global cache for loaded tree sequences (kept here as it deals with Data)
_ts_cache = LRUCache(max_size=1)
# _config_cache moved to loader.py
_metadata_cache = LRUCache(max_size=10)  # Per-key metadata cache

async def get_or_load_ts(file_path):
    """
    Load a tree sequence from file_path.
    """

    async with _cache_lock:

        ts = _ts_cache.get(file_path)
        if ts is not None:
            print(f"✅ Using cached tree sequence: {file_path}")
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
            _ts_cache.set(file_path, ts)
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


def flatten_all_metadata_by_sample(
    ts,
    sources=("individual",),
    sample_name_key="name"
):
    """
    Dynamically flatten *all* metadata keys and values
    and associate them with samples.

    Parameters
    ----------
    ts : tskit.TreeSequence
    sources : tuple
        Any of ("individual", "node", "population")
    sample_name_key : str
        Key in node metadata used as sample name

    Returns
    -------
    dict
        {metadata_key: {metadata_value: set(sample_names)}}
    """
    result = defaultdict(lambda: defaultdict(set))

    for node_id in ts.samples():
        node = ts.node(node_id)

        # --- resolve sample name ---
        node_meta = node.metadata or {}

        node_meta = ensure_json_dict(node_meta)
        sample_name = node_meta.get(sample_name_key, f"{node_id}")

        # --- iterate over metadata sources ---
        for source in sources:
            if source == "individual":
                if node.individual == tskit.NULL:
                    continue
                meta = ts.individual(node.individual).metadata
                meta = meta or {}
                meta = ensure_json_dict(meta)

            elif source == "node":
                meta = node_meta

            elif source == "population":
                if node.population == tskit.NULL:
                    continue
                meta = ts.population(node.population).metadata
                meta = meta or {}
                meta = ensure_json_dict(meta)

            else:
                raise ValueError(f"Unknown source: {source}")

            if not meta:
                continue

            # --- dynamically extract all key/value pairs ---
            for key, value in meta.items():
                # ensure value is hashable
                if isinstance(value, (list, dict)):
                    value = repr(value)

                result[key][value].add(sample_name)

    # convert defaultdicts to dicts
    return {
        k: dict(v)
        for k, v in result.items()
    }

def get_metadata_for_key(
    ts,
    file_path,
    key,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Get sample-to-value mapping for a specific metadata key.
    Results are cached per (file_path, key) for performance.

    Parameters
    ----------
    ts : tskit.TreeSequence
    file_path : str
        Used as part of cache key
    key : str
        The metadata key to extract
    sources : tuple
        Any of ("individual", "node", "population")
    sample_name_key : str
        Key in node metadata used as sample name

    Returns
    -------
    dict
        {sample_name: value} for the specified key
    """
    cache_key = f"{file_path}:{key}"
    cached = _metadata_cache.get(cache_key)
    if cached is not None:
        print(f"✅ Using cached metadata for key: {key}")
        return cached

    # Special handling for "sample" key - each sample's value is its own name
    if key == "sample":
        result = {}
        for node_id in ts.samples():
            node = ts.node(node_id)
            node_meta = node.metadata or {}
            try:
                node_meta = ensure_json_dict(node_meta)
            except (TypeError, json.JSONDecodeError):
                node_meta = {}
            sample_name = str(node_meta.get(sample_name_key, f"{node_id}"))
            result[sample_name] = sample_name
        _metadata_cache.set(cache_key, result)
        return result

    result = {}

    for node_id in ts.samples():
        node = ts.node(node_id)
        node_meta = node.metadata or {}
        node_meta = ensure_json_dict(node_meta)
        sample_name = node_meta.get(sample_name_key, f"{node_id}")

        for source in sources:
            if source == "individual":
                if node.individual == tskit.NULL:
                    continue
                meta = ts.individual(node.individual).metadata
                meta = meta or {}
                meta = ensure_json_dict(meta)

            elif source == "node":
                meta = node_meta

            elif source == "population":
                if node.population == tskit.NULL:
                    continue
                meta = ts.population(node.population).metadata
                meta = meta or {}
                meta = ensure_json_dict(meta)

            else:
                continue

            if not meta:
                continue

            if key in meta:
                value = meta[key]
                if value is None:
                    break  # Skip None values
                if isinstance(value, (list, dict)):
                    value = repr(value)
                result[sample_name] = str(value)
                break  # Found the key, move to next sample

    _metadata_cache.set(cache_key, result)
    return result


def search_samples_by_metadata(
    ts,
    file_path,
    key,
    value,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Search for samples that have a specific value for a metadata key.

    Parameters
    ----------
    ts : tskit.TreeSequence
    file_path : str
        Used for cache lookup
    key : str
        The metadata key to search
    value : str
        The value to match
    sources : tuple
        Any of ("individual", "node", "population")
    sample_name_key : str
        Key in node metadata used as sample name

    Returns
    -------
    list
        List of sample names matching the criteria
    """
    # Try to use cached metadata if available
    cache_key = f"{file_path}:{key}"
    cached = _metadata_cache.get(cache_key)

    if cached is not None:
        # Use cached data for fast lookup
        return [sample for sample, val in cached.items() if str(val) == str(value)]

    # If not cached, compute on the fly
    matching_samples = []

    for node_id in ts.samples():
        node = ts.node(node_id)
        node_meta = node.metadata or {}
        node_meta = ensure_json_dict(node_meta)
        sample_name = node_meta.get(sample_name_key, f"{node_id}")

        for source in sources:
            if source == "individual":
                if node.individual == tskit.NULL:
                    continue
                meta = ts.individual(node.individual).metadata
                meta = meta or {}
                meta = ensure_json_dict(meta)

            elif source == "node":
                meta = node_meta

            elif source == "population":
                if node.population == tskit.NULL:
                    continue
                meta = ts.population(node.population).metadata
                meta = meta or {}
                meta = ensure_json_dict(meta)

            else:
                continue

            if not meta:
                continue

            if key in meta:
                meta_value = meta[key]
                if meta_value is None:
                    break  # Skip None values
                if isinstance(meta_value, (list, dict)):
                    meta_value = repr(meta_value)
                if str(meta_value) == str(value):
                    matching_samples.append(sample_name)
                break

    return matching_samples


def _get_sample_metadata_value(ts, node_id, key, sources, sample_name_key="name"):
    """
    Helper to get a specific metadata value for a sample node.
    Returns (sample_name, value) tuple.
    """
    node = ts.node(node_id)
    node_meta = node.metadata or {}
    node_meta = ensure_json_dict(node_meta)
    sample_name = node_meta.get(sample_name_key, f"{node_id}")

    for source in sources:
        if source == "individual":
            if node.individual == tskit.NULL:
                continue
            meta = ts.individual(node.individual).metadata
            meta = meta or {}
            meta = ensure_json_dict(meta)

        elif source == "node":
            meta = node_meta

        elif source == "population":
            if node.population == tskit.NULL:
                continue
            meta = ts.population(node.population).metadata
            meta = meta or {}
            meta = ensure_json_dict(meta)

        else:
            continue

        if not meta:
            continue

        if key in meta:
            value = meta[key]
            if isinstance(value, (list, dict)):
                value = repr(value)
            return (sample_name, value)

    return (sample_name, None)


def get_metadata_array_for_key(
    ts,
    file_path,
    key,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Build efficient array-based metadata for a key using PyArrow.

    Returns indices array where indices[i] is the index into unique_values
    for the i-th sample (ordered by node_id from ts.samples()).

    Parameters
    ----------
    ts : tskit.TreeSequence
    file_path : str
        Used as part of cache key
    key : str
        The metadata key to extract
    sources : tuple
        Any of ("individual", "node", "population")
    sample_name_key : str
        Key in node metadata used as sample name

    Returns
    -------
    dict
        {
            'unique_values': [val0, val1, ...],  # Index i -> value string
            'sample_node_ids': [node_id0, node_id1, ...],  # Sample order
            'arrow_buffer': bytes  # PyArrow IPC serialized indices
        }
    """
    cache_key = f"{file_path}:{key}:array"
    cached = _metadata_cache.get(cache_key)
    if cached is not None:
        print(f"✅ Using cached metadata array for key: {key}")
        return cached

    sample_ids = list(ts.samples())
    n_samples = len(sample_ids)

    # Special handling for "sample" key - each sample's name is its own unique value
    if key == "sample":
        unique_values = []
        value_to_idx = {}
        indices = np.zeros(n_samples, dtype=np.uint32)

        for i, node_id in enumerate(sample_ids):
            node = ts.node(node_id)
            node_meta = node.metadata or {}
            try:
                node_meta = ensure_json_dict(node_meta)
            except (TypeError, json.JSONDecodeError):
                node_meta = {}
            sample_name = str(node_meta.get(sample_name_key, f"{node_id}"))

            if sample_name not in value_to_idx:
                value_to_idx[sample_name] = len(unique_values)
                unique_values.append(sample_name)

            indices[i] = value_to_idx[sample_name]

        # Serialize to Arrow IPC format
        table = pa.table({'idx': pa.array(indices, type=pa.uint32())})
        sink = pa.BufferOutputStream()
        writer = pa.ipc.new_stream(sink, table.schema)
        writer.write_table(table)
        writer.close()

        result = {
            'unique_values': unique_values,
            'sample_node_ids': [int(x) for x in sample_ids],
            'arrow_buffer': sink.getvalue().to_pybytes()
        }
        _metadata_cache.set(cache_key, result)
        print(f"✅ Built sample metadata array ({n_samples} samples, {len(unique_values)} unique values)")
        return result

    unique_values = []
    value_to_idx = {}
    indices = np.zeros(n_samples, dtype=np.uint32)

    for i, node_id in enumerate(sample_ids):
        sample_name, value = _get_sample_metadata_value(ts, node_id, key, sources, sample_name_key)

        if value is None:
            value = ""  # Handle missing values

        value_str = str(value)

        if value_str not in value_to_idx:
            value_to_idx[value_str] = len(unique_values)
            unique_values.append(value_str)

        indices[i] = value_to_idx[value_str]

    # Serialize to Arrow IPC format
    table = pa.table({'idx': pa.array(indices, type=pa.uint32())})
    sink = pa.BufferOutputStream()
    writer = pa.ipc.new_stream(sink, table.schema)
    writer.write_table(table)
    writer.close()

    result = {
        'unique_values': unique_values,
        'sample_node_ids': [int(x) for x in sample_ids],  # Convert to Python int for JSON
        'arrow_buffer': sink.getvalue().to_pybytes()
    }

    _metadata_cache.set(cache_key, result)
    print(f"✅ Built metadata array for key: {key} ({n_samples} samples, {len(unique_values)} unique values)")
    return result


def get_mutations_in_window(ts, start, end, offset=0, limit=1000):
    """
    Get mutations within a genomic interval [start, end) with pagination.

    Args:
        ts: tskit.TreeSequence
        start: Start genomic position (bp)
        end: End genomic position (bp)
        offset: Number of mutations to skip (for pagination)
        limit: Maximum number of mutations to return

    Returns:
        dict with:
            - 'mutations': list of mutation dicts
            - 'total_count': total mutations in window (for pagination)
            - 'has_more': whether there are more mutations
    """
    t = ts.tables
    sites = t.sites
    mutations = t.mutations

    # Get positions for all mutations via their sites
    positions = sites.position[mutations.site]

    # Create mask for mutations in the window
    mask = (positions >= start) & (positions < end)
    indices = np.where(mask)[0]

    total_count = len(indices)

    # Apply pagination
    paginated_indices = indices[offset:offset + limit]

    # Extract mutation data
    result_mutations = []
    for idx in paginated_indices:
        mut = mutations[idx]
        site = sites[mut.site]
        position = int(site.position)
        site_id = int(mut.site)
        node_id = int(mut.node)

        # Get ancestral and derived states
        ancestral_state = site.ancestral_state
        derived_state = mut.derived_state

        result_mutations.append({
            'position': position,
            'mutation': f"{ancestral_state}->{derived_state}",
            'node_id': node_id,
            'site_id': site_id,
            'ancestral_state': ancestral_state,
            'derived_state': derived_state,
        })

    return {
        'mutations': result_mutations,
        'total_count': total_count,
        'has_more': offset + limit < total_count
    }


def search_mutations_by_position(ts, position, range_bp=5000, offset=0, limit=1000):
    """
    Search for mutations around a specific position.

    Args:
        ts: tskit.TreeSequence
        position: Center position to search around (bp)
        range_bp: Total range to search (searches +/- range_bp/2 around position)
        offset: Number of mutations to skip (for pagination)
        limit: Maximum number of mutations to return

    Returns:
        dict with:
            - 'mutations': list of mutation dicts sorted by distance from position
            - 'total_count': total mutations in search range
            - 'has_more': whether there are more mutations
            - 'search_start': actual start of search range
            - 'search_end': actual end of search range
    """
    half_range = range_bp // 2
    search_start = max(0, position - half_range)
    search_end = min(ts.sequence_length, position + half_range)

    t = ts.tables
    sites = t.sites
    mutations = t.mutations

    # Get positions for all mutations via their sites
    positions = sites.position[mutations.site]

    # Create mask for mutations in the search range
    mask = (positions >= search_start) & (positions < search_end)
    indices = np.where(mask)[0]

    # Calculate distances and sort by distance
    if len(indices) > 0:
        mutation_positions = positions[indices]
        distances = np.abs(mutation_positions - position)
        sorted_order = np.argsort(distances)
        indices = indices[sorted_order]
        sorted_distances = distances[sorted_order]
    else:
        sorted_distances = np.array([])

    total_count = len(indices)

    # Apply pagination
    paginated_indices = indices[offset:offset + limit]
    paginated_distances = sorted_distances[offset:offset + limit] if len(sorted_distances) > 0 else []

    # Extract mutation data
    result_mutations = []
    for i, idx in enumerate(paginated_indices):
        mut = mutations[idx]
        site = sites[mut.site]
        mut_position = int(site.position)
        site_id = int(mut.site)
        node_id = int(mut.node)

        # Get ancestral and derived states
        ancestral_state = site.ancestral_state
        derived_state = mut.derived_state

        result_mutations.append({
            'position': mut_position,
            'mutation': f"{ancestral_state}->{derived_state}",
            'node_id': node_id,
            'site_id': site_id,
            'ancestral_state': ancestral_state,
            'derived_state': derived_state,
            'distance': int(paginated_distances[i]) if i < len(paginated_distances) else 0,
        })

    return {
        'mutations': result_mutations,
        'total_count': total_count,
        'has_more': offset + limit < total_count,
        'search_start': int(search_start),
        'search_end': int(search_end),
    }


def mutations_to_arrow_buffer(mutations_data):
    """
    Convert mutations list to PyArrow IPC buffer for efficient transfer.

    Args:
        mutations_data: dict with 'mutations' list from get_mutations_in_window or search_mutations_by_position

    Returns:
        bytes: PyArrow IPC serialized buffer
    """
    mutations = mutations_data.get('mutations', [])

    if not mutations:
        # Return empty table with correct schema
        table = pa.table({
            'position': pa.array([], type=pa.int64()),
            'mutation': pa.array([], type=pa.string()),
            'node_id': pa.array([], type=pa.int32()),
            'site_id': pa.array([], type=pa.int32()),
            'ancestral_state': pa.array([], type=pa.string()),
            'derived_state': pa.array([], type=pa.string()),
            'distance': pa.array([], type=pa.int64()),
        })
    else:
        table = pa.table({
            'position': pa.array([m['position'] for m in mutations], type=pa.int64()),
            'mutation': pa.array([m['mutation'] for m in mutations], type=pa.string()),
            'node_id': pa.array([m['node_id'] for m in mutations], type=pa.int32()),
            'site_id': pa.array([m['site_id'] for m in mutations], type=pa.int32()),
            'ancestral_state': pa.array([m['ancestral_state'] for m in mutations], type=pa.string()),
            'derived_state': pa.array([m['derived_state'] for m in mutations], type=pa.string()),
            'distance': pa.array([m.get('distance', 0) for m in mutations], type=pa.int64()),
        })

    sink = pa.BufferOutputStream()
    writer = pa.ipc.new_stream(sink, table.schema)
    writer.write_table(table)
    writer.close()

    return sink.getvalue().to_pybytes()


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