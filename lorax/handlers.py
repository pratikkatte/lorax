# handlers.py
import os
import json
import asyncio
import re
from collections import OrderedDict, defaultdict

import numpy as np
import pandas as pd
import psutil
import tskit
import tszip

from lorax.viz.trees_to_taxonium import process_csv

from lorax.utils.gcs_utils import get_public_gcs_dict

_cache_lock = asyncio.Lock()


def make_json_safe(obj):
    if isinstance(obj, dict):
        return {k: make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, set):
        return sorted(obj)   # or list(obj)
    if isinstance(obj, list):
        return [make_json_safe(v) for v in obj]
    return obj


# Global cache for loaded tree sequences

class LRUCache:
    """Simple LRU cache with eviction for large in-memory tskit/tszip objects."""
    def __init__(self, max_size=5):
        self.max_size = max_size
        self.cache = OrderedDict()

    def get(self, key):
        if key in self.cache:
            # Move to the end to mark as recently used
            self.cache.move_to_end(key)
            return self.cache[key]
        return None

    def set(self, key, value):
        if key in self.cache:
            # Update existing and mark as recently used
            self.cache.move_to_end(key)
        self.cache[key] = value
        # Evict if too big
        if len(self.cache) > self.max_size:
            old_key, old_val = self.cache.popitem(last=False)
            print(f"🧹 Evicted {old_key} from LRU cache to free memory")

    def clear(self):
        self.cache.clear()

_ts_cache = LRUCache(max_size=1)        
_config_cache = LRUCache(max_size=2)

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

def get_or_load_config(ts, file_path, root_dir):
    config = _config_cache.get(file_path)
    if config is not None:
        print(f"✅ Using cached config: {file_path}")
        return config

    if file_path.endswith('.tsz') or file_path.endswith('.trees'):
        config = get_config(ts, file_path, root_dir)
    else:
        config = get_config_csv(ts, file_path, root_dir)
    _config_cache.set(file_path, config)
    return config

async def cache_status():
    """Return current memory usage and cache statistics."""
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    rss_mb = mem_info.rss / (1024 * 1024)
    vms_mb = mem_info.vms / (1024 * 1024)
    return {
        "rss_MB": round(rss_mb, 2),
        "vms_MB": round(vms_mb, 2),
        "ts_cache_size": len(_ts_cache.cache) if "_ts_cache" in globals() else "n/a",
        "config_cache_size": len(_config_cache.cache) if "_config_cache" in globals() else "n/a",
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
        return json.dumps({"edges": edges, "start": start, "end": end})
    except Exception as e:
        print("Error in handle_edges_query", e)
        return json.dumps({"error": f"Error fetching edges: {str(e)}"})


def extract_sample_names(newick_str):
    tokens = re.findall(r'([^(),:]+):', newick_str)

    samples = []
    for t in tokens:
        # Skip pure numbers (branch lengths)
        if re.fullmatch(r'[0-9.+Ee-]+', t):
            continue
        samples.append(t)

    # Remove duplicates while preserving order
    return list(dict.fromkeys(samples))

def max_branch_length_from_newick(nwk):
    values = re.findall(r":([0-9.eE+-]+)", nwk)
    if not values:
        return 0.0
    return max(map(float, values))

def get_config_csv(df, file_path, root_dir, window_size=50000):
    """Extract configuration from a CSV file with newick trees."""
    genome_length = int(df['genomic_positions'].max())
    intervals = []
    max_branch_length_all = 0
    samples_set = set()

    for _, row in df.iterrows():
        current_pos = int(row['genomic_positions'])
        max_br = max_branch_length_from_newick(row['newick'])
        sample_names = extract_sample_names(row['newick'])
        samples_set.update(sample_names)

        if max_br > max_branch_length_all:
            max_branch_length_all = max_br
        next_row = row.name + 1  # rely on DataFrame index (assumes default integer)
        if next_row < len(df):
            next_pos = int(df.iloc[next_row]['genomic_positions'])
        else:
            next_pos = current_pos + window_size
        intervals.append(current_pos)


    populations = {}
    nodes_population = []
    times = [0, max_branch_length_all]
    sample_names = {}
    for s in samples_set:
        sample_names[str(s)] = {"sample_name": s}
    config = {
        'genome_length': genome_length,
        'times': {'type': 'branch length', 'values': times},
        'intervals': intervals,
        'filename': str(file_path).split('/')[-1],
        'populations': populations,
        'nodes_population': nodes_population,
        'sample_names': sample_names,
    }
    return config

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


def ensure_json_dict(data):
    # If already a dict, return as-is
    if isinstance(data, dict):
        return data

    # If bytes, decode to string
    if isinstance(data, (bytes, bytearray)):
        data = data.decode("utf-8")
    # If string, parse JSON
    if isinstance(data, str):
        return json.loads(data)

    raise TypeError(f"Unsupported data type: {type(data)}")

def extract_node_mutations_tables(ts):
    """Extract mutations keyed by position for UI display."""
    t = ts.tables
    s, m = t.sites, t.mutations

    pos = s.position[m.site]
    anc = ts.sites_ancestral_state
    der = ts.mutations_derived_state
    nodes = m.node  # Node IDs for each mutation

    out = {}

    for p, a, d, node_id in zip(pos, anc, der, nodes):
        if a == d:
            continue

        out[str(int(p))] = {
            "mutation": f"{a}->{d}",
            "node": int(node_id)
        }

    return out


def extract_mutations_by_node(ts):
    """Extract mutations grouped by node ID for tree building.
    
    Returns:
        dict: {node_id (int): [{position, mutation_str}, ...]}
    """
    t = ts.tables
    s, m = t.sites, t.mutations

    pos = s.position[m.site]
    anc = ts.sites_ancestral_state
    der = ts.mutations_derived_state
    nodes = m.node

    out = {}

    for p, a, d, node_id in zip(pos, anc, der, nodes):
        if a == d:
            continue
        node_id = int(node_id)
        if node_id not in out:
            out[node_id] = []
        out[node_id].append({
            "position": int(p),
            "mutation": f"{a}{int(p)}{d}"
        })

    return out


def get_edges_for_interval(ts, start, end):
    """Return edge data for trees spanning [start, end].
    
    Args:
        ts: tskit TreeSequence
        start: Start genomic position (bp)
        end: End genomic position (bp)
    
    Returns:
        dict with left, right, parent, child arrays for edges active in interval
    """
    edges = ts.tables.edges
    
    # Filter edges that are active in the interval
    # An edge is active if its span [left, right) overlaps with [start, end)
    mask = (edges.left < end) & (edges.right > start)
    
    return {
        'left': edges.left[mask].tolist(),
        'right': edges.right[mask].tolist(),
        'parent': edges.parent[mask].tolist(),
        'child': edges.child[mask].tolist(),
    }


def get_config(ts, file_path, root_dir):
    """Extract configuration and metadata from a tree sequence file."""
    try:
        intervals = [tree.interval[0] for tree in ts.trees()]
        times = [ts.min_time, ts.max_time]


        sample_names = {}
        sample_details = flatten_all_metadata_by_sample(ts, sources=("individual", "node", "population"))

        filename = os.path.basename(file_path)
        config = {
            'genome_length': ts.sequence_length,
            'times': {'type': 'coalescent time', 'values': times},
            'intervals': intervals,
            'filename': str(filename),
            'node_times': ts.tables.nodes.time.tolist(),
            'mutations': extract_node_mutations_tables(ts),
            'mutations_by_node': extract_mutations_by_node(ts),
            'sample_names': sample_names,
            'sample_details': make_json_safe(sample_details)
        }
        return config
    except Exception as e:
        print("Error in get_config", e)
        return None
    
async def handle_upload(file_path, root_dir):
    """Load a tree sequence file and return its configuration."""
    ts = await get_or_load_ts(file_path)
    print("File loading complete")
    return ts

def list_project_files(directory, projects, root):
        """
        Recursively list files and folders for the given directory.
        If subdirectories are found, they are added as keys and populated similarly.
        """
        for item in os.listdir(directory):
            item_path = os.path.join(directory, item)
            if os.path.isdir(item_path):
                # Recursive call for subdirectory
                directory_name = os.path.relpath(item_path, root)
                directory_basename = os.path.basename(item_path)
                if directory_basename not in projects:
                    projects[str(directory_basename)] = {
                        "folder": str(directory_name),
                        "files": [],
                        "description": "",
                    }     
                    projects = list_project_files(item_path, projects, root=root)
            else:
                # Get the relative path from root to directory
                directory_name = os.path.relpath(directory, root)
                directory_basename = os.path.basename(directory)
                if os.path.isfile(item_path) and (
                    item.endswith(".trees") or item.endswith(".trees.tsz") or item.endswith(".csv")
                ):
                    if item not in projects[str(directory_basename)]["files"]:
                        projects[str(directory_basename)]["files"].append(item)
        return projects

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

def make_json_serializable(obj):
    """Convert to JSON-safe Python structures and decode nested JSON strings."""
    if isinstance(obj, bytes):
        try:
            text = obj.decode('utf-8')
            return make_json_serializable(json.loads(text))
        except Exception:
            return text
    elif isinstance(obj, str):
        # Try to parse JSON strings like '{"family_id": "ST082"}'
        try:
            parsed = json.loads(obj)
            return make_json_serializable(parsed)
        except Exception:
            return obj
    elif isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(i) for i in obj]
    elif hasattr(obj, '__dict__'):
        return make_json_serializable(obj.__dict__)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj

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


async def handle_details(file_path, data):
    """Handle requests for tree, node, and individual details."""
    try:
        ts = await get_or_load_ts(file_path)
        if ts is None:
            return json.dumps({"error": "Tree sequence (ts) is not set. Please upload a file first."})
        
        return_data = {}
        tree_index = data.get("treeIndex")
        if tree_index:
            return_data["tree"] = get_tree_details(ts, tree_index)
    
        node_name = data.get("node")
        if node_name:
            node_details = get_node_details(ts, int(node_name))
            return_data["node"] = node_details
            if node_details.get("individual") != -1:
                return_data["individual"] = get_individual_details(ts, node_details.get("individual"))

        return json.dumps(return_data)
    except Exception as e:
        return json.dumps({"error": f"Error getting details: {str(e)}"})