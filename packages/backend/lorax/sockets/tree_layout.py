"""
Tree layout event handlers for Lorax Socket.IO.

Handles process_postorder_layout and cache_trees events.
"""

import logging
import struct

import pyarrow as pa

from lorax.context import tree_graph_cache, csv_tree_graph_cache
from lorax.handlers import handle_tree_graph_query, ensure_trees_cached
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file

logger = logging.getLogger(__name__)


def _split_layout_buffer(buffer):
    """Decode combined layout buffer into node and mutation Arrow tables."""
    if not isinstance(buffer, (bytes, bytearray)) or len(buffer) < 4:
        return None, None

    node_len = struct.unpack("<I", buffer[:4])[0]
    node_bytes = buffer[4:4 + node_len]
    mut_bytes = buffer[4 + node_len:]

    node_table = pa.ipc.open_stream(node_bytes).read_all()
    mut_table = pa.ipc.open_stream(mut_bytes).read_all() if len(mut_bytes) > 0 else None
    return node_table, mut_table


def _build_layout_buffer(node_table, mut_table):
    """Encode node and mutation Arrow tables into combined layout buffer format."""
    node_sink = pa.BufferOutputStream()
    node_writer = pa.ipc.new_stream(node_sink, node_table.schema)
    node_writer.write_table(node_table)
    node_writer.close()
    node_bytes = node_sink.getvalue().to_pybytes()

    if mut_table is None:
        mut_table = pa.table({
            "mut_x": pa.array([], type=pa.float32()),
            "mut_y": pa.array([], type=pa.float32()),
            "mut_tree_idx": pa.array([], type=pa.int32()),
            "mut_node_id": pa.array([], type=pa.int32()),
        })

    mut_sink = pa.BufferOutputStream()
    mut_writer = pa.ipc.new_stream(mut_sink, mut_table.schema)
    mut_writer.write_table(mut_table)
    mut_writer.close()
    mut_bytes = mut_sink.getvalue().to_pybytes()

    return struct.pack("<I", len(node_bytes)) + node_bytes + mut_bytes


def _merge_layout_results(*results):
    """Merge multiple handle_tree_graph_query responses into one response shape."""
    valid_results = [r for r in results if isinstance(r, dict) and "buffer" in r]
    if not valid_results:
        return {"error": "No valid layout results to merge"}

    node_tables = []
    mut_tables = []
    tree_indices = []
    min_time = None
    max_time = None

    for result in valid_results:
        node_table, mut_table = _split_layout_buffer(result["buffer"])
        if node_table is not None:
            node_tables.append(node_table)
        if mut_table is not None:
            mut_tables.append(mut_table)

        result_tree_indices = result.get("tree_indices", [])
        if isinstance(result_tree_indices, list):
            tree_indices.extend(result_tree_indices)

        result_min_time = result.get("global_min_time")
        result_max_time = result.get("global_max_time")
        if isinstance(result_min_time, (int, float)):
            min_time = float(result_min_time) if min_time is None else min(min_time, float(result_min_time))
        if isinstance(result_max_time, (int, float)):
            max_time = float(result_max_time) if max_time is None else max(max_time, float(result_max_time))

    if not node_tables:
        return {"error": "No node tables available to merge"}

    merged_nodes = pa.concat_tables(node_tables) if len(node_tables) > 1 else node_tables[0]
    merged_muts = None
    if mut_tables:
        merged_muts = pa.concat_tables(mut_tables) if len(mut_tables) > 1 else mut_tables[0]

    return {
        "buffer": _build_layout_buffer(merged_nodes, merged_muts),
        "global_min_time": min_time if min_time is not None else 0.0,
        "global_max_time": max_time if max_time is not None else 0.0,
        "tree_indices": tree_indices,
    }


def _parse_lock_view_payload(lock_view):
    """Parse and normalize lockView payload from frontend."""
    if not isinstance(lock_view, dict):
        return {
            "enabled": False,
            "bounding_box": None,
            "in_box_tree_indices": [],
            "in_box_tree_count": 0,
            "lock_view_single_tree": False,
        }

    bounding_box = lock_view.get("boundingBox")

    in_box_tree_indices_raw = lock_view.get("inBoxTreeIndices")
    in_box_tree_indices = []
    if isinstance(in_box_tree_indices_raw, list):
        in_box_tree_indices = [
            int(idx)
            for idx in in_box_tree_indices_raw
            if isinstance(idx, int) or (isinstance(idx, float) and idx.is_integer())
        ]

    in_box_tree_count = lock_view.get("inBoxTreeCount")
    if isinstance(in_box_tree_count, int):
        pass
    elif isinstance(in_box_tree_count, float) and in_box_tree_count.is_integer():
        in_box_tree_count = int(in_box_tree_count)
    else:
        in_box_tree_count = len(in_box_tree_indices)

    return {
        "enabled": True,
        "bounding_box": bounding_box if isinstance(bounding_box, dict) else None,
        "in_box_tree_indices": in_box_tree_indices,
        "in_box_tree_count": in_box_tree_count,
        "lock_view_single_tree": in_box_tree_count == 1,
    }


def _resolve_sparsification_plan(display_array, lock_view_info):
    """Resolve sparsification mode based on display array and lock-view context."""
    sparsification = len(display_array) > 1
    candidate_tree_idx = None
    target_tree_idx = None

    in_box_tree_indices = lock_view_info["in_box_tree_indices"]
    lock_view_single_tree = lock_view_info["lock_view_single_tree"]
    if lock_view_single_tree and in_box_tree_indices:
        candidate_tree_idx = int(in_box_tree_indices[0])
        if candidate_tree_idx in display_array:
            target_tree_idx = candidate_tree_idx

    use_mixed_sparsification = target_tree_idx is not None and len(display_array) > 1
    return {
        "sparsification": sparsification,
        "candidate_tree_idx": candidate_tree_idx,
        "target_tree_idx": target_tree_idx,
        "target_in_display_array": target_tree_idx is not None,
        "use_mixed_sparsification": use_mixed_sparsification,
    }


def register_tree_layout_events(sio):
    """Register tree layout socket events."""

    @sio.event
    async def process_postorder_layout(sid, data):
        """Socket event to get post-order tree traversal for efficient rendering.

        Returns PyArrow IPC binary data with post-order node arrays.
        Frontend computes layout using stack-based reconstruction.

        Uses Socket.IO acknowledgement callback pattern - returns result directly
        instead of emitting to ensure request-response correlation.
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "request_id": data.get("request_id")}

            if not session.file_path:
                print(f"⚠️ No file loaded for session {lorax_sid}")
                return {"error": "No file loaded for session", "request_id": data.get("request_id")}

            display_array_raw = data.get("displayArray", [])
            display_array = display_array_raw if isinstance(display_array_raw, list) else []
            actual_display_array_raw = data.get("actualDisplayArray", display_array)
            actual_display_array = (
                actual_display_array_raw
                if isinstance(actual_display_array_raw, list)
                else display_array
            )
            request_id = data.get("request_id")
            lock_view_info = _parse_lock_view_payload(data.get("lockView"))
            sparsification_plan = _resolve_sparsification_plan(display_array, lock_view_info)

            sparsification = sparsification_plan["sparsification"]
            candidate_tree_idx = sparsification_plan["candidate_tree_idx"]
            target_tree_idx = sparsification_plan["target_tree_idx"]
            target_in_display_array = sparsification_plan["target_in_display_array"]
            use_mixed_sparsification = sparsification_plan["use_mixed_sparsification"]

            if lock_view_info["enabled"]:
                print(
                    "[process_postorder_layout] lockView boundingBox "
                    f"session={lorax_sid} request_id={request_id} "
                    f"boundingBox={lock_view_info}"
                )
                print(
                    "[process_postorder_layout] lockView plan "
                    f"session={lorax_sid} request_id={request_id} "
                    f"display_count={len(display_array)} "
                    f"display_array={display_array} "
                    f"actual_display_array={actual_display_array} "
                    f"display_min={min(display_array) if display_array else None} "
                    f"display_max={max(display_array) if display_array else None} "
                    f"candidate_tree_idx={candidate_tree_idx} "
                    f"target_tree_idx={target_tree_idx} "
                    f"target_in_display_array={target_in_display_array} "
                    f"use_mixed_sparsification={use_mixed_sparsification}"
                )
                effective_sparsification = (
                    "mixed" if use_mixed_sparsification else ("sparse" if sparsification else "full")
                )
                logger.debug(
                    "[process_postorder_layout] session=%s request_id=%s display_count=%s "
                    "in_box_tree_count=%s in_box_tree_indices=%s bounding_box=%s "
                    "lock_view_single_tree=%s target_tree_idx=%s use_mixed_sparsification=%s "
                    "sparsification=%s",
                    lorax_sid,
                    request_id,
                    len(display_array),
                    lock_view_info["in_box_tree_count"],
                    lock_view_info["in_box_tree_indices"],
                    lock_view_info["bounding_box"],
                    lock_view_info["lock_view_single_tree"],
                    target_tree_idx,
                    use_mixed_sparsification,
                    effective_sparsification,
                )

            # handle_tree_graph_query returns dict with PyArrow buffer (Numba-optimized)
            # Pass session_id and tree_graph_cache for caching TreeGraph objects
            # actual_display_array contains all visible trees for cache eviction
            if use_mixed_sparsification:
                non_target_indices = [idx for idx in display_array if idx != target_tree_idx]
                sparse_result = await handle_tree_graph_query(
                    session.file_path,
                    non_target_indices,
                    sparsification=True,
                    session_id=lorax_sid,
                    tree_graph_cache=tree_graph_cache,
                    csv_tree_graph_cache=csv_tree_graph_cache,
                    actual_display_array=actual_display_array
                )
                if "error" in sparse_result:
                    return {"error": sparse_result["error"], "request_id": request_id}

                full_result = await handle_tree_graph_query(
                    session.file_path,
                    [target_tree_idx],
                    sparsification=False,
                    session_id=lorax_sid,
                    tree_graph_cache=tree_graph_cache,
                    csv_tree_graph_cache=csv_tree_graph_cache,
                    actual_display_array=actual_display_array
                )
                if "error" in full_result:
                    return {"error": full_result["error"], "request_id": request_id}

                result = _merge_layout_results(sparse_result, full_result)
            else:
                result = await handle_tree_graph_query(
                    session.file_path,
                    display_array,
                    sparsification=sparsification,
                    session_id=lorax_sid,
                    tree_graph_cache=tree_graph_cache,
                    csv_tree_graph_cache=csv_tree_graph_cache,
                    actual_display_array=actual_display_array
                )

            if "error" in result:
                return {"error": result["error"], "request_id": request_id}
            else:
                # Return result directly - Socket.IO sends as acknowledgement callback
                return {
                    "buffer": result["buffer"],  # Binary PyArrow IPC data
                    "global_min_time": result["global_min_time"],
                    "global_max_time": result["global_max_time"],
                    "tree_indices": result["tree_indices"],
                    "request_id": request_id
                }
        except Exception as e:
            print(f"❌ Postorder layout query error: {e}")
            return {"error": str(e), "request_id": data.get("request_id")}

    @sio.event
    async def cache_trees(sid, data):
        """Socket event to pre-cache TreeGraph objects for lineage operations.

        Call this after process_postorder_layout to enable subsequent lineage queries.

        data: {
            lorax_sid: str,
            tree_indices: [int]  # Tree indices to cache
        }

        Returns: {
            cached_count: int,  # Number of trees newly cached
            total_cached: int   # Total trees now in cache for session
        }
        """
        try:
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return {"error": "Session not found", "cached_count": 0}

            if not session.file_path:
                return {"error": "No file loaded", "cached_count": 0}

            if is_csv_session_file(session.file_path):
                return {"error": "Lineage not supported for CSV", "cached_count": 0}

            tree_indices = data.get("tree_indices", [])
            if not tree_indices:
                return {"cached_count": 0, "total_cached": 0}

            newly_cached = await ensure_trees_cached(
                session.file_path,
                tree_indices,
                lorax_sid,
                tree_graph_cache
            )

            # Get total cached
            all_cached = await tree_graph_cache.get_all_for_session(lorax_sid)

            return {
                "cached_count": newly_cached,
                "total_cached": len(all_cached)
            }
        except Exception as e:
            print(f"❌ Cache trees error: {e}")
            return {"error": str(e), "cached_count": 0}
