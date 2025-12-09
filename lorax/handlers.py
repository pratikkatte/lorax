# handlers.py
import os
import json
# from lorax.chat.langgraph_tskit import api_interface
from lorax.viz.trees_to_taxonium import old_new_tree_samples, process_csv
import tskit
import tszip
import numpy as np
import os
import asyncio
import psutil
import pandas as pd
import re
from lorax.utils.gcs_utils import get_public_gcs_dict

_cache_lock = asyncio.Lock()


from collections import OrderedDict

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

def get_or_load_config(ts, file_path):
    config = _config_cache.get(file_path)
    if config is not None:
        print(f"✅ Using cached config: {file_path}")
        return config

    if file_path.endswith('.tsz') or file_path.endswith('.trees'):
        config = get_config(ts, file_path)
    else:
        config = get_config_csv(ts, file_path)
    _config_cache.set(file_path, config)
    return config

async def cache_status():
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    rss_mb = mem_info.rss / (1024 * 1024)   # Resident set size (MB)
    vms_mb = mem_info.vms / (1024 * 1024)   # Virtual memory (MB)
    return {
        "rss_MB": round(rss_mb, 2),
        "vms_MB": round(vms_mb, 2),
        # "num_sessions": len(sessions) if not USE_REDIS else "Redis mode",
        "ts_cache_size": len(_ts_cache.cache) if "_ts_cache" in globals() else "n/a",
        "config_cache_size": len(_config_cache.cache) if "_config_cache" in globals() else "n/a",
        "pid": os.getpid(),
    }

async def handle_query(file_path, localTrees):
    """

    """
    # get object from file_path using get_or_load_ts
    
    ts = await get_or_load_ts(file_path)
    if ts is None:
        return json.dumps({"error": "Tree sequence (ts) is not set. Please upload a file first. Or file_path is not valid or not found."})
    try:
        if file_path.endswith('.tsz') or file_path.endswith('.trees'):
            tree_dict = await asyncio.to_thread(old_new_tree_samples, localTrees, ts)
        else:
            tree_dict = await asyncio.to_thread(process_csv, ts, localTrees, outgroup="Etal")
        # tree_dict = await asyncio.to_thread(old_new_tree_samples, localTrees, ts)
        data = json.dumps({
            "tree_dict": tree_dict
            })
        return data
    except Exception as e:
        print("Error in handle_query", e)
        return json.dumps({"error": f"Error processing query: {str(e)}"})

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

def get_config_csv(df, file_path, window_size=50000):
    # Ensure all numeric types are converted to native Python ints for JSON serializability
    genome_length = int(df['genomic_positions'].max())
    times = None ## Hard Coded here

    intervals = []
    max_branch_length_all = 0

    samples_set = set()
    for _, row in df.iterrows():
        # Get the next row's genomic position if available, otherwise use current + window_size
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

def get_config(ts, file_path):
    try:
        intervals = [tree.interval[0] for tree in ts.trees()]
        times = [ts.min_time, ts.max_time]
        populations = {}
        nodes_population = [ts.node(n).population for n in ts.samples()]

        for s in ts.populations():
            meta = ensure_json_dict(s.metadata) if s.metadata else {}
            populations[str(s.id)] = {
                "population": meta.get("name"),
                "description": meta.get("description"),
                "super_population": meta.get("super_population")
                }

        # nodes_population = [ts.node(n).population for n in ts.samples()]
        sample_names = {}
        # for i, s in enumerate(ts.samples()):
        #     sample_names[str(s)] = {"sample_name": str(s)}

        config = {'genome_length': ts.sequence_length,
        'times': {'type': 'coalescent time', 'values': times},
        'intervals':intervals,
        'filename': str(file_path).split('/')[-1], 
        'populations':populations,
        'nodes_population':nodes_population,
        'sample_names':sample_names
        }
        return config
    except Exception as e:
        print("Error in get_config", e)
        return None
    
def get_local_uploads(upload_dir, sid):
    """
    TODO: IMPLEMENT THIS LATER
    """

async def handle_upload(file_path):
    """
    """
    # basefilename = os.path.basename(file_path)
    # if basefilename.endswith('.tsz'):
    #     ts = tszip.load(file_path)
    # else:
    #     ts = tskit.load(file_path)

    ts = await get_or_load_ts(file_path)
    print("File loading complete")
    config = await asyncio.to_thread(get_or_load_config, ts, file_path)
    return config, None

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
    f"""
    # Read the local uploads folder (or a root "uploads" or upload_dir directory in upload_dir).
    # List all subfolders (each represents a project), and enumerate files in each.
    """    

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
    import json
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
    node = ts.node(node_name)
    data = {
        "id": node.id,
        "time": node.time,
        "population": node.population,
        "individual": node.individual,
        "metadata": make_json_serializable(node.metadata)
    }
    return data

def get_tree_details(ts, tree_index):
    tree = ts.at_index(tree_index)
    data = {
        "interval": tree.interval,
        "num_roots": tree.num_roots,
        "num_nodes": tree.num_nodes
        }
    return data

def get_individual_details(ts, individual_id):
    individual = ts.individual(individual_id)
    data = { 
        "id": individual.id,
        "nodes": make_json_serializable(individual.nodes),
        "metadata": make_json_serializable(individual.metadata)
    }
    return data

async def handle_details(file_path, data):
    

    try:
        ts = await get_or_load_ts(file_path)
        if ts is None:
            return json.dumps({"error": "Tree sequence (ts) is not set. Please upload a file first. Or file_path is not valid or not found."})
        return_data = {}
        tree_index = data.get("treeIndex")
        if tree_index:
            tree_details = get_tree_details(ts, tree_index)
            return_data["tree"] = tree_details

        node_name = data.get("node")
        if node_name:
            node_details = get_node_details(ts, int(node_name))
            return_data["node"] = node_details
            if node_details.get("individual") != -1:
                individual_details = get_individual_details(ts, node_details.get("individual"))
                return_data["individual"] = individual_details

        return json.dumps(return_data)
    except Exception as e:
        return json.dumps({"error": f"Error getting details: {str(e)}"})

class LoraxHandler:
    def __init__(self):
        self.ts = None  # Set when a file is uploaded
        self.file_path = None
        self.viz_snapshot = None
        self.ts_intervals = None
        self.global_context = {'file_path': self.file_path, 'viz_snapshot': self.viz_snapshot, 'memory': None}

    async def handle_ping(self, message):
        return {"type": "ping", "data": "Pong"}

    # def handle_chat(self, message):
    #     try:
    #         action = None
    #         llm_output = api_interface(message.get("message"), self.file_path)
            
    #         # Handle different types of llm_output
    #         if isinstance(llm_output, str):
    #             # If it's already a string, use it directly
    #             response_data = llm_output
    #         elif isinstance(llm_output, (list, tuple)) and len(llm_output) > 0:
    #             # If it's a list/tuple, take the first element
    #             response_data = str(llm_output[0]) if llm_output[0] else str(llm_output)
    #             action = llm_output[1]
    #         else:
    #             # Otherwise, convert to string
    #             response_data = str(llm_output)
                
    #         data = {"type": "chat", "data": response_data, "action": action}
    #         return data
    #     except Exception as e:
    #         print(f"Error in handle_chat: {e}")
    #         return {"type": "chat", "data": f"Error processing chat message: {str(e)}"}

    async def handle_query(self, message):
        if self.ts is None:
            return json.dumps({"error": "Tree sequence (ts) is not set. Please upload a file first."})

        try:
            localTrees = message.get("localTrees")
            # nwk_string, genome_positions, mutations, times, tree_index = start_end(start, end, self.ts)
            tree_dict = old_new_tree_samples(localTrees, self.ts)

            # self.viz_snapshot = {'window': [0, start, end, self.ts.sequence_length], 'sample_sets':'ts.get_samples()'}

            # self.global_context['viz_snapshot'] = self.viz_snapshot
            data = json.dumps({
                "tree_dict": tree_dict
            })
            return data
        except Exception as e:
            print("Error in handle_query", e)
            return json.dumps({"error": f"Error processing query: {str(e)}"})

    def get_config(self):
        # intervals = [(tree.interval[0], tree.interval[1]) for tree in self.ts.trees()]
        # intervals = {tree.interval[0]: [tree.interval[0], tree.interval[1]] for tree in self.ts.trees()}
        new_intervals = {int(tree.interval[0]): [int(tree.interval[0]), int(tree.interval[1])] for tree in self.ts.trees()}
        self.ts_intervals = new_intervals
        times = [self.ts.min_time, self.ts.max_time]
        populations = {}
        # for s in self.ts.populations(): populations[str(s.id)] = str(json.loads(s.metadata)['name'])
        for s in self.ts.populations():
            meta = json.loads(s.metadata)
            populations[int(s.id)] = {
                "population": meta.get("name"),
                "description": meta.get("description"),
                "super_population": meta.get("super_population")
                }
        nodes_population = [n.population for n in self.ts.nodes()]

        config = {'genome_length': self.ts.sequence_length, 'times':times, 'new_intervals':new_intervals,'filename': str(self.file_path).split('/')[-1], 'populations':populations, 'nodes_population':nodes_population}
        return config
    
    def get_tree_details(self, tree_index):
        tree = self.ts.at_index(tree_index)
        data = {
            "interval": tree.interval,
            "num_roots": tree.num_roots,
            "num_nodes": tree.num_nodes
        }
        return data
    
    def get_node_details(self, node_name):
        node = self.ts.node(node_name)
        data = {
            "id": node.id,
            "time": node.time,
            "population": node.population,
            "individual": node.individual,
            "metadata": self.make_json_serializable(node.metadata)
        }
        return data
    
    def get_individual_details(self, individual_id):
        individual = self.ts.individual(individual_id)
        data = { 
            "id": individual.id,
            "nodes": self.make_json_serializable(individual.nodes),
            "metadata": self.make_json_serializable(individual.metadata)
        }
        return data
    
    def make_json_serializable(self, obj):
        """Convert byte data and other non-serializable objects to JSON serializable format"""
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        elif isinstance(obj, dict):
            return {k: self.make_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self.make_json_serializable(item) for item in obj]
        elif hasattr(obj, '__dict__'):
            return self.make_json_serializable(obj.__dict__)    
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return obj
    
    async def handle_upload(self, file_path=None):
        if self.file_path != file_path:    
            basefilename = os.path.basename(file_path)
            if basefilename.endswith('.tsz'):
                self.ts = tszip.load(file_path)
                self.file_path = file_path
                self.global_context = self.file_path
            else:
                self.ts = tskit.load(file_path)
                self.file_path = file_path
                self.global_context = self.file_path
            
        # viz_config = self.get_config()
        # chat_config = "file uploaded"
        return None, None
        return viz_config, chat_config

    async def get_projects(self, upload_dir):
        with open(f'{upload_dir}/projects.json', 'r') as f:
            projects = json.load(f)
            final_projects = [project for project in projects if os.path.exists(os.path.join(upload_dir, project.get("folder", "")))]
        return final_projects
    
    async def handle_details(self, message):
        try:
            return_data = {}
            object = message.get("object")
            tree_index = object.get("treeIndex")

            if tree_index:
                tree_details = self.get_tree_details(tree_index)
                return_data["tree"] = tree_details
            
            node_name = object.get("node")
            if node_name:
                node_details = self.get_node_details(int(node_name))
                return_data["node"] = node_details
                if node_details.get("individual") != -1:
                    individual_details = self.get_individual_details(node_details.get("individual"))
                    return_data["individual"] = individual_details
            return json.dumps(return_data)
        except Exception as e:
            return {"error": f"Error getting details: {str(e)}"}

    async def handle_viz(self, message):
        print("Viz received")
        if message.get("action") == 'query_trees':
            print("query_trees", message)
        return {
            "type": "viz",
            "data": "Your message was received! --> " + message.get("message", "")
        }