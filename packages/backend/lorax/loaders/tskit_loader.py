import os
import tskit
from lorax.metadata.loader import get_metadata_schema


def _get_project_name(file_path, root_dir):
    """Return the immediate parent directory name for the file."""
    if not file_path:
        return None
    try:
        parent_dir = os.path.basename(os.path.dirname(str(file_path)))
    except Exception:
        parent_dir = None
    if parent_dir:
        return parent_dir
    if root_dir:
        return os.path.basename(os.path.normpath(str(root_dir)))
    return None

def get_config_tskit(ts, file_path, root_dir):
    """Extract configuration and metadata from a tree sequence file.

    Note: Uses get_metadata_schema() for lightweight initial load.
    Full metadata values are fetched on-demand via fetch_metadata_array.
    """
    try:
        intervals = list(ts.breakpoints())
        times = [ts.min_time, ts.max_time]
        genome_length = ts.sequence_length

        # Timeline unit label for UI: normalize unknown -> "Time"
        time_units = getattr(ts, "time_units", None)
        time_units_str = str(time_units) if time_units is not None else "unknown"
        timeline_type = "Coalescent Time" if time_units_str.strip().lower() == "unknown" else time_units_str

        # Compute centered initial position (10% of genome, minimum 1kb)
        window_size = max(genome_length * 0.1, 1000)
        midpoint = genome_length / 2.0
        start = max(0, midpoint - window_size / 2.0)
        end = min(genome_length, midpoint + window_size / 2.0)

        sample_names = {}
        # Use schema-only extraction for lightweight initial load
        metadata_schema = get_metadata_schema(ts, sources=("individual", "node", "population"))

        filename = os.path.basename(file_path)
        project_name = _get_project_name(file_path, root_dir)

        config = {
            'genome_length': genome_length,
            'initial_position': [int(start), int(end)],
            'times': {'type': timeline_type, 'values': times},
            'intervals': intervals,
            'filename': str(filename),
            'project': project_name,
            'num_samples': ts.num_samples,
            'sample_names': sample_names,
            'metadata_schema': metadata_schema
        }
        return config
    except Exception as e:
        print("Error in get_config", e)
        return None

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
