import os
import json
from lorax.metadata.loader import get_metadata_schema
from lorax.utils import make_json_serializable


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


def _json_safe(value):
    """Return a value that can safely travel through JSON socket payloads."""
    try:
        converted = make_json_serializable(value)
    except Exception:
        converted = str(value)

    try:
        json.dumps(converted)
        return converted
    except (TypeError, ValueError):
        pass

    if isinstance(converted, dict):
        return {str(k): _json_safe(v) for k, v in converted.items()}
    if isinstance(converted, (list, tuple)):
        return [_json_safe(v) for v in converted]
    if isinstance(converted, set):
        return sorted((_json_safe(v) for v in converted), key=str)
    if hasattr(converted, "item"):
        try:
            return _json_safe(converted.item())
        except Exception:
            pass
    return str(converted)


def _get_top_level_metadata(ts):
    """Extract tree-sequence-level metadata as JSON-safe data."""
    metadata = getattr(ts, "metadata", None)
    if metadata is None:
        return None
    if isinstance(metadata, (bytes, bytearray, str)) and len(metadata) == 0:
        return None
    return _json_safe(metadata)


def _parse_provenance_record(record):
    if isinstance(record, (bytes, bytearray)):
        record = record.decode("utf-8", errors="replace")
    if isinstance(record, str):
        try:
            return _json_safe(json.loads(record)), True
        except Exception:
            return record, False
    return _json_safe(record), True


def _summarize_provenance_record(provenance):
    record = provenance.get("record")
    summary = {
        "id": provenance.get("id"),
        "timestamp": provenance.get("timestamp"),
        "software": None,
        "software_version": None,
    }
    if isinstance(record, dict):
        software = record.get("software")
        if isinstance(software, dict):
            summary["software"] = software.get("name")
            summary["software_version"] = software.get("version")
        elif software is not None:
            summary["software"] = str(software)
    return summary


def _get_provenance(ts):
    """Extract full provenance records with best-effort JSON parsing."""
    records = []
    try:
        provenances = ts.provenances()
    except Exception:
        provenances = []

    for provenance in provenances:
        record, record_is_json = _parse_provenance_record(getattr(provenance, "record", None))
        provenance_id = getattr(provenance, "id", len(records))
        try:
            provenance_id = int(provenance_id)
        except (TypeError, ValueError):
            provenance_id = len(records)
        records.append({
            "id": provenance_id,
            "timestamp": getattr(provenance, "timestamp", None),
            "record": record,
            "record_is_json": record_is_json,
        })

    latest = _summarize_provenance_record(records[-1]) if records else None
    return {
        "count": len(records),
        "latest": latest,
        "records": records,
    }


def _get_table_counts(ts):
    """Expose commonly useful table counts for the File Info dropdown."""
    return {
        "trees": int(getattr(ts, "num_trees", 0)),
        "nodes": int(getattr(ts, "num_nodes", 0)),
        "edges": int(getattr(ts, "num_edges", 0)),
        "sites": int(getattr(ts, "num_sites", 0)),
        "mutations": int(getattr(ts, "num_mutations", 0)),
        "individuals": int(getattr(ts, "num_individuals", 0)),
        "populations": int(getattr(ts, "num_populations", 0)),
    }

def get_config_tskit(ts, file_path, root_dir):
    """Extract configuration and metadata from a tree sequence file.

    Note: Uses get_metadata_schema() for lightweight initial load.
    Full metadata values are fetched on-demand via fetch_metadata_array.
    """
    try:
        intervals = list(ts.breakpoints())
        times = [ts.min_time, ts.max_time]
        genome_length = ts.sequence_length

        # Preserve raw tskit time_units for the UI label.
        time_units = getattr(ts, "time_units", None)
        timeline_type = str(time_units) if time_units is not None else "unknown"

        # Compute centered initial position (10% of genome, minimum 1kb)
        window_size = max(genome_length * 0.1, 1000)
        midpoint = genome_length / 2.0
        start = max(0, midpoint - window_size / 2.0)
        end = min(genome_length, midpoint + window_size / 2.0)

        sample_names = {}
        # Use schema-only extraction for lightweight initial load
        metadata_schema = get_metadata_schema(ts, sources=("individual", "node", "population"))
        top_level_metadata = _get_top_level_metadata(ts)
        provenance = _get_provenance(ts)
        table_counts = _get_table_counts(ts)

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
            'metadata_schema': metadata_schema,
            'top_level_metadata': top_level_metadata,
            'provenance': provenance,
            'table_counts': table_counts
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
