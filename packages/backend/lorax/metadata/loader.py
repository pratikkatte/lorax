"""
Metadata extraction and caching for tree sequences.

Functions accept FileContext and use its nested metadata cache.
When a FileContext is evicted, its metadata cache is evicted together.
"""

import json
import numpy as np
import tskit
import pyarrow as pa
from collections import defaultdict
from lorax.utils import ensure_json_dict, make_json_safe, make_json_serializable


def get_metadata_for_key(
    ctx,
    key,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Get sample-to-value mapping for a specific metadata key.
    Results are cached in the FileContext's nested metadata cache.

    Parameters
    ----------
    ctx : FileContext
        The file context containing tree_sequence and metadata cache
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
    # Check nested cache in FileContext
    cached = ctx.get_metadata(key)
    if cached is not None:
        print(f"✅ Using cached metadata for key: {key}")
        return cached

    ts = ctx.tree_sequence

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
        ctx.set_metadata(key, result)
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

    ctx.set_metadata(key, result)
    return result


def search_samples_by_metadata(
    ctx,
    key,
    value,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Search for samples that have a specific value for a metadata key.

    Parameters
    ----------
    ctx : FileContext
        The file context containing tree_sequence and metadata cache
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
    ts = ctx.tree_sequence

    # Try to use cached metadata if available
    cached = ctx.get_metadata(key)

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

    # Special handling for "sample" key: it is not a real metadata field in tskit.
    # Treat it as identity so "sample" searches/highlights match by sample name.
    if key == "sample":
        sample_name = str(sample_name)
        return (sample_name, sample_name)

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
    ctx,
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
    ctx : FileContext
        The file context containing tree_sequence and metadata cache
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
    cache_key = f"{key}:array"
    cached = ctx.get_metadata(cache_key)
    if cached is not None:
        print(f"✅ Using cached metadata array for key: {key}")
        return cached

    ts = ctx.tree_sequence
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
        ctx.set_metadata(cache_key, result)
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

    ctx.set_metadata(cache_key, result)
    print(f"✅ Built metadata array for key: {key} ({n_samples} samples, {len(unique_values)} unique values)")
    return result


def get_metadata_schema(
    ts,
    sources=("individual", "node", "population"),
    sample_name_key="name"
):
    """
    Extract metadata keys only (values are fetched on-demand via get_metadata_array_for_key).

    Also includes "sample" as the first key, where each sample's name/ID is its
    own unique value (for coloring samples individually).

    Parameters
    ----------
    ts : tskit.TreeSequence
        The tree sequence (not FileContext - this doesn't need caching)
    sources : tuple
        Any of ("individual", "node", "population")
    sample_name_key : str
        Key in node metadata used as sample name

    Returns
    -------
    dict
        {
            "metadata_keys": [key1, key2, ...]
        }
    """
    keys = set()

    for node_id in ts.samples():
        node = ts.node(node_id)

        # Parse node metadata
        node_meta = node.metadata or {}
        try:
            node_meta = ensure_json_dict(node_meta)
        except (TypeError, json.JSONDecodeError):
            node_meta = {}

        for source in sources:
            if source == "individual":
                if node.individual == tskit.NULL:
                    continue
                meta = ts.individual(node.individual).metadata
                meta = meta or {}
                meta = ensure_json_dict(meta)

            elif source == "node":
                meta = node_meta  # Reuse already parsed node metadata

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

            for key in meta.keys():
                keys.add(key)

    # Prepend "sample" to keys - this makes it the default colorBy option
    return {
        "metadata_keys": ["sample"] + sorted(list(keys))
    }
