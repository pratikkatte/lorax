
import pyarrow as pa

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
