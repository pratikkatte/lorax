"""
Lorax Utility Functions.

JSON handling, file utilities, and other helpers.
Note: LRU caches have been moved to lorax.cache.lru
"""

import json
import re
import os
import numpy as np


# Re-export LRU classes for backward compatibility during transition
from lorax.cache.lru import LRUCache, LRUCacheWithMeta


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


def list_project_files(directory, projects, root, exclude_dirs=None):
        """
        Recursively list files and folders for the given directory.
        If subdirectories are found, they are added as keys and populated similarly.
        """
        exclude = set(exclude_dirs or [])
        for item in os.listdir(directory):
            item_path = os.path.join(directory, item)
            if os.path.isdir(item_path):
                directory_name = os.path.relpath(item_path, root)
                directory_basename = os.path.basename(item_path)
                if directory_basename in exclude:
                    continue
                if directory_basename not in projects:
                    projects[str(directory_basename)] = {
                        "folder": str(directory_name),
                        "files": [],
                        "description": "",
                    }
                    list_project_files(
                        item_path,
                        projects,
                        root=root,
                        exclude_dirs=exclude,
                    )
            else:
                directory_name = os.path.relpath(directory, root)
                directory_basename = os.path.basename(directory)
                if os.path.isfile(item_path) and (
                    item.endswith(".trees") or item.endswith(".trees.tsz") or item.endswith(".csv")
                ):
                    if item not in projects[str(directory_basename)]["files"]:
                        projects[str(directory_basename)]["files"].append(item)
        return projects
