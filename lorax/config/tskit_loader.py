import os
import tskit
from lorax.utils import get_metadata_schema

def get_config_tskit(ts, file_path, root_dir):
    """Extract configuration and metadata from a tree sequence file.

    Note: Uses get_metadata_schema() for lightweight initial load.
    Full metadata mappings are fetched on-demand via fetch_metadata_for_key.
    """
    try:
        intervals = [tree.interval[0] for tree in ts.trees()]
        times = [ts.min_time, ts.max_time]

        sample_names = {}
        # Use schema-only extraction for lightweight initial load
        metadata_schema = get_metadata_schema(ts, sources=("individual", "node", "population"))

        filename = os.path.basename(file_path)
        config = {
            'genome_length': ts.sequence_length,
            'times': {'type': 'coalescent time', 'values': times},
            'intervals': intervals,
            'filename': str(filename),
            # node_times removed - now sent per-query from handle_layout_query for efficiency
            # 'mutations': extract_node_mutations_tables(ts),
            # 'mutations_by_node': extract_mutations_by_node(ts),
            'sample_names': sample_names,
            # Send schema only - full mappings fetched on-demand
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
