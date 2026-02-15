"""
Tree layout event handlers for Lorax Socket.IO.

Handles process_postorder_layout and cache_trees events.
"""

import logging
import math

from lorax.context import tree_graph_cache, csv_tree_graph_cache
from lorax.handlers import handle_tree_graph_query, ensure_trees_cached
from lorax.sockets.decorators import require_session
from lorax.sockets.utils import is_csv_session_file

logger = logging.getLogger(__name__)
ADAPTIVE_OUTSIDE_CELL_SIZE = 0.002


def _clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def _parse_int_like(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def _parse_float_like(value):
    if isinstance(value, bool):
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(numeric):
        return None
    return numeric


def _parse_target_local_bbox(raw_target_local_bbox):
    if not isinstance(raw_target_local_bbox, dict):
        return None

    tree_index = _parse_int_like(raw_target_local_bbox.get("treeIndex"))
    min_x = _parse_float_like(raw_target_local_bbox.get("minX"))
    max_x = _parse_float_like(raw_target_local_bbox.get("maxX"))
    min_y = _parse_float_like(raw_target_local_bbox.get("minY"))
    max_y = _parse_float_like(raw_target_local_bbox.get("maxY"))

    if (
        tree_index is None
        or min_x is None
        or max_x is None
        or min_y is None
        or max_y is None
    ):
        return None

    min_x = _clamp(min_x, 0.0, 1.0)
    max_x = _clamp(max_x, 0.0, 1.0)
    min_y = _clamp(min_y, 0.0, 1.0)
    max_y = _clamp(max_y, 0.0, 1.0)

    return {
        "tree_index": tree_index,
        "min_x": min(min_x, max_x),
        "max_x": max(min_x, max_x),
        "min_y": min(min_y, max_y),
        "max_y": max(min_y, max_y),
    }


def _parse_lock_view_payload(lock_view):
    """Parse minimal lockView payload: targetIndex and targetLocalBBox only."""
    if not isinstance(lock_view, dict):
        return {
            "enabled": False,
            "target_index": None,
            "target_local_bbox": None,
        }

    target_index = _parse_int_like(lock_view.get("targetIndex"))
    target_local_bbox = _parse_target_local_bbox(lock_view.get("targetLocalBBox"))
    if target_index is None and isinstance(target_local_bbox, dict):
        target_index = _parse_int_like(target_local_bbox.get("tree_index"))

    enabled = target_index is not None or target_local_bbox is not None
    return {
        "enabled": enabled,
        "target_index": target_index,
        "target_local_bbox": target_local_bbox,
    }


def _compute_target_sparsify_multiplier_from_bbox(target_local_bbox):
    """Compute sparsify multiplier from targetLocalBBox area (coverage)."""
    fallback_multiplier = 0.45
    if not isinstance(target_local_bbox, dict):
        return fallback_multiplier
    min_x = target_local_bbox.get("min_x")
    max_x = target_local_bbox.get("max_x")
    min_y = target_local_bbox.get("min_y")
    max_y = target_local_bbox.get("max_y")
    if None in (min_x, max_x, min_y, max_y):
        return fallback_multiplier
    try:
        min_x = float(min_x)
        max_x = float(max_x)
        min_y = float(min_y)
        max_y = float(max_y)
    except (TypeError, ValueError):
        return fallback_multiplier
    if not all(math.isfinite(v) for v in (min_x, max_x, min_y, max_y)):
        return fallback_multiplier
    width = max(0.0, max(max_x, min_x) - min(max_x, min_x))
    height = max(0.0, max(max_y, min_y) - min(max_y, min_y))
    coverage = _clamp(width * height, 0.01, 1.0)
    multiplier = 0.30 + 1.40 * math.sqrt(coverage)
    return _clamp(multiplier, 0.25, 1.75)


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

            display_array = []
            display_array_raw = data.get("displayArray", [])
            if isinstance(display_array_raw, list):
                for idx in display_array_raw:
                    parsed = _parse_int_like(idx)
                    if parsed is not None:
                        display_array.append(parsed)

            actual_display_array = display_array
            actual_display_array_raw = data.get("actualDisplayArray", display_array)
            if isinstance(actual_display_array_raw, list):
                parsed_actual_display_array = []
                for idx in actual_display_array_raw:
                    parsed = _parse_int_like(idx)
                    if parsed is not None:
                        parsed_actual_display_array.append(parsed)
                actual_display_array = parsed_actual_display_array

            request_id = data.get("request_id")
            raw_lock_view = data.get("lockView")
            lock_view_info = _parse_lock_view_payload(raw_lock_view)

            sparsification = len(display_array) > 1
            use_target_adaptive_sparsification = False
            target_tree_idx = None
            target_sparsify_multiplier = None
            target_sparsify_bbox = None

            target_index = lock_view_info.get("target_index")
            target_local_bbox = lock_view_info.get("target_local_bbox")
            if lock_view_info["enabled"] and len(display_array) == 1:
                resolved_target = target_index if target_index is not None else (
                    target_local_bbox.get("tree_index") if isinstance(target_local_bbox, dict) else None
                )
                if resolved_target is not None and resolved_target == display_array[0]:
                    use_target_adaptive_sparsification = True
                    target_tree_idx = resolved_target
                    target_sparsify_multiplier = _compute_target_sparsify_multiplier_from_bbox(target_local_bbox)
                    sparsification = True

                    if isinstance(target_local_bbox, dict) and target_local_bbox.get("tree_index") == target_tree_idx:
                        target_sparsify_bbox = {
                            "min_x": target_local_bbox["min_x"],
                            "max_x": target_local_bbox["max_x"],
                            "min_y": target_local_bbox["min_y"],
                            "max_y": target_local_bbox["max_y"],
                        }

            if lock_view_info["enabled"]:
                print(
                    "[process_postorder_layout] lockView payload received "
                    f"session={lorax_sid} request_id={request_id} "
                    f"display_array={display_array} "
                    f"actual_display_array={actual_display_array} "
                    f"target_tree_idx={target_tree_idx} "
                    f"target_sparsify_multiplier={target_sparsify_multiplier} "
                    f"target_sparsify_bbox={target_sparsify_bbox} "
                    f"sparsification={'sparse' if sparsification else 'full'}"
                )
            elif isinstance(raw_lock_view, dict):
                print(
                    "[process_postorder_layout] lockView payload ignored "
                    f"session={lorax_sid} request_id={request_id} "
                    "enabled=False (missing/invalid payload)"
                )

            logger.debug(
                "[process_postorder_layout] session=%s request_id=%s display_count=%s "
                "lock_enabled=%s target_tree_idx=%s adaptive=%s multiplier=%s sparsification=%s",
                lorax_sid,
                request_id,
                len(display_array),
                lock_view_info["enabled"],
                target_tree_idx,
                use_target_adaptive_sparsification,
                target_sparsify_multiplier,
                "sparse" if sparsification else "full",
            )

            # New-only lock contract: backend runs a single call.
            # Adaptive override applies only for target-only requests.
            if use_target_adaptive_sparsification and target_tree_idx is not None:
                print(
                    "[process_postorder_layout] lockView target request "
                    f"session={lorax_sid} request_id={request_id} "
                    f"target_tree_idx={target_tree_idx} "
                    f"display_array={display_array} "
                    f"actual_display_array={actual_display_array} "
                    f"target_sparsify_multiplier={target_sparsify_multiplier} "
                    f"target_sparsify_bbox={target_sparsify_bbox}"
                )

            result = await handle_tree_graph_query(
                session.file_path,
                display_array,
                sparsification=sparsification,
                session_id=lorax_sid,
                tree_graph_cache=tree_graph_cache,
                csv_tree_graph_cache=csv_tree_graph_cache,
                actual_display_array=actual_display_array,
                sparsify_cell_size_multiplier=target_sparsify_multiplier,
                adaptive_sparsify_bbox=target_sparsify_bbox,
                adaptive_target_tree_idx=target_tree_idx,
                adaptive_outside_cell_size=(
                    ADAPTIVE_OUTSIDE_CELL_SIZE if use_target_adaptive_sparsification else None
                ),
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
