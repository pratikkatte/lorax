
import numpy as np
import tskit

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
