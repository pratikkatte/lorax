import json
import re
import os
import asyncio
from collections import OrderedDict, defaultdict
import numpy as np
import tskit

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

    def remove(self, key):
        """Remove a specific key from the cache."""
        if key in self.cache:
            del self.cache[key]

    def clear(self):
        self.cache.clear()


class LRUCacheWithMeta:
    """
    LRU cache with metadata support for cache validation.

    Stores (value, metadata) tuples, allowing validation against
    external state (e.g., file mtime) before returning cached values.
    """
    def __init__(self, max_size=5):
        self.max_size = max_size
        self.cache = OrderedDict()  # key -> (value, meta)

    def get(self, key):
        """Get value only (ignores metadata)."""
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key][0]
        return None

    def get_with_meta(self, key):
        """Get (value, metadata) tuple."""
        if key in self.cache:
            self.cache.move_to_end(key)
            value, meta = self.cache[key]
            return value, meta
        return None, None

    def set(self, key, value, meta=None):
        """Set value with optional metadata."""
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = (value, meta)
        # Evict if too big
        if len(self.cache) > self.max_size:
            old_key, (old_val, old_meta) = self.cache.popitem(last=False)
            print(f"🧹 Evicted {old_key} from LRU cache to free memory")

    def remove(self, key):
        """Remove a specific key from the cache."""
        if key in self.cache:
            del self.cache[key]

    def clear(self):
        self.cache.clear()

    def __len__(self):
        return len(self.cache)

def make_json_safe(obj):
    if isinstance(obj, dict):
        return {k: make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, set):
        return sorted(obj)   # or list(obj)
    if isinstance(obj, list):
        return [make_json_safe(v) for v in obj]
    return obj

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
                    # projects = list_project_files(item_path, projects, root=root)
                    list_project_files(item_path, projects, root=root) # Fixed: recursion shouldn't overwrite projects if modifying valid dict
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


