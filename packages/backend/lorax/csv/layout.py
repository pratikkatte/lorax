from __future__ import annotations

from typing import Any, Dict, List

import pyarrow as pa


def build_empty_tree_layout_arrow_ipc() -> bytes:
    """Return a valid (possibly empty) PyArrow IPC stream for tree layout.

    Frontend expects a table with these columns:
    - node_id:int32
    - parent_id:int32
    - is_tip:bool
    - tree_idx:int32
    - x:float32
    - y:float32
    - time:float32
    """
    empty_table = pa.table(
        {
            "node_id": pa.array([], type=pa.int32()),
            "parent_id": pa.array([], type=pa.int32()),
            "is_tip": pa.array([], type=pa.bool_()),
            "tree_idx": pa.array([], type=pa.int32()),
            "x": pa.array([], type=pa.float32()),
            "y": pa.array([], type=pa.float32()),
            "time": pa.array([], type=pa.float32()),
        }
    )
    sink = pa.BufferOutputStream()
    writer = pa.ipc.new_stream(sink, empty_table.schema)
    writer.write_table(empty_table)
    writer.close()
    return sink.getvalue().to_pybytes()


def build_empty_layout_response(tree_indices: List[int] | None = None) -> Dict[str, Any]:
    """Build the response shape returned by `handle_tree_graph_query` for CSV."""
    return {
        "buffer": build_empty_tree_layout_arrow_ipc(),
        "global_min_time": 0.0,
        "global_max_time": 0.0,
        "tree_indices": tree_indices or [],
    }

