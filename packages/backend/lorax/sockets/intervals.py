"""Memory-bounded interval and viewport queries for CSR artifact sessions."""

from __future__ import annotations

import asyncio
import math
import random
from typing import Any

import numpy as np

from lorax.artifacts.metrics import csr_artifact_metrics
from lorax.artifacts.runtime import context_for_session, is_artifact_session
from lorax.sockets.decorators import require_session


def _matrix(translate_x: float, scale_x: float) -> list[float]:
    values = [
        scale_x,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        translate_x,
        0,
        0,
        1,
    ]
    return [float(value) for value in values]


def _precision(group_size: int, scale_factor: float) -> int:
    if group_size == 1 and scale_factor <= 1:
        return 3
    log_group = math.log10(max(1, group_size))
    log_scale = math.log10(max(1, scale_factor))
    return max(1, min(3, 3 - math.floor(log_group + log_scale / 2)))


def _tree_bin(
    tree_index: int,
    left: float,
    right: float,
    start: float,
    end: float,
) -> dict[str, Any]:
    return {
        "key": tree_index,
        "s": left,
        "e": right,
        "visible_s": max(left, start),
        "visible_e": min(right, end),
        "span": right - left,
        "midpoint": (left + right) / 2.0,
        "path": None,
        "global_index": tree_index,
        "precision": None,
    }


def _query_local_data(reader, data: dict[str, Any]) -> dict[str, Any]:
    lo = max(0, int(data.get("lo", 0)))
    hi = min(reader.num_trees + 1, int(data.get("hi", 0)))
    start = float(data["start"])
    end = float(data["end"])
    global_bp_per_unit = float(data["globalBpPerUnit"])
    new_global_bp = float(data["new_globalBp"])
    options = data.get("displayOptions") or {}
    selection_strategy = options.get("selectionStrategy", "largestSpan")

    if hi <= lo + 1 or global_bp_per_unit <= 0 or new_global_bp <= 0:
        return {
            "local_bins": [],
            "displayArray": [],
            "showing_all_trees": False,
        }

    breakpoints = np.asarray(reader.breakpoints[lo:hi], dtype=np.float64)
    tree_count = len(breakpoints) - 1
    if tree_count <= 0:
        return {
            "local_bins": [],
            "displayArray": [],
            "showing_all_trees": False,
        }

    scale_factor = new_global_bp / global_bp_per_unit
    show_all = scale_factor < 1
    if show_all:
        slot_width = (end - start) / tree_count
        tree_width = ((end - start) / global_bp_per_unit / tree_count) * 0.9
        selected = []
        for slot_index in range(tree_count):
            tree = _tree_bin(
                lo + slot_index,
                float(breakpoints[slot_index]),
                float(breakpoints[slot_index + 1]),
                start,
                end,
            )
            slot_center = start + (slot_index + 0.5) * slot_width
            selected.append(
                {
                    **tree,
                    "modelMatrix": _matrix(
                        slot_center / global_bp_per_unit - tree_width / 2.0,
                        tree_width,
                    ),
                    "visible": True,
                    "position": tree["s"],
                    "precision": 2,
                    "slotIndex": slot_index,
                    "isRepresentative": True,
                    "groupSize": 1,
                }
            )
        return {
            "local_bins": selected,
            "displayArray": [tree["global_index"] for tree in selected],
            "showing_all_trees": True,
        }

    max_visible_trees = 10
    effective_max = max(
        1,
        max(max_visible_trees, math.ceil(tree_count / scale_factor)),
    )
    slot_count = min(tree_count, effective_max)
    effective_span = end - start
    slot_width = effective_span / slot_count
    slots: dict[int, dict[str, Any]] = {}
    for offset in range(tree_count):
        tree = _tree_bin(
            lo + offset,
            float(breakpoints[offset]),
            float(breakpoints[offset + 1]),
            start,
            end,
        )
        slot_index = min(
            slot_count - 1,
            max(0, math.floor((tree["midpoint"] - start) / slot_width)),
        )
        slot = slots.get(slot_index)
        if slot is None:
            slots[slot_index] = {
                "tree": tree,
                "count": 1,
                "total_weight": max(0.0, tree["span"]),
            }
            continue
        slot["count"] += 1
        if selection_strategy == "centerWeighted":
            slot_midpoint = start + slot_index * slot_width + slot_width / 2.0
            if abs(tree["midpoint"] - slot_midpoint) < abs(
                slot["tree"]["midpoint"] - slot_midpoint
            ):
                slot["tree"] = tree
        elif selection_strategy == "spanWeightedRandom":
            weight = max(0.0, tree["span"])
            slot["total_weight"] += weight
            if (
                slot["total_weight"] > 0
                and random.random() * slot["total_weight"] < weight
            ):
                slot["tree"] = tree
        elif selection_strategy != "first" and tree["span"] > slot["tree"]["span"]:
            slot["tree"] = tree

    selected = []
    tree_width = slot_width / global_bp_per_unit / 1.05
    for slot_index, slot in slots.items():
        slot_midpoint = start + slot_index * slot_width + slot_width / 2.0
        tree = slot["tree"]
        group_size = int(slot["count"])
        selected.append(
            {
                **tree,
                "modelMatrix": _matrix(
                    slot_midpoint / global_bp_per_unit - tree_width / 2.0,
                    tree_width,
                ),
                "visible": True,
                "position": tree["s"],
                "precision": _precision(group_size, scale_factor),
                "slotIndex": slot_index,
                "isRepresentative": True,
                "groupSize": group_size,
            }
        )
    selected.sort(key=lambda tree: tree["slotIndex"])
    return {
        "local_bins": selected,
        "displayArray": [tree["global_index"] for tree in selected],
        "showing_all_trees": False,
    }


def register_interval_events(sio):
    @sio.event
    async def query_intervals(sid, data):
        data = data or {}
        session = await require_session(data.get("lorax_sid"), sid, sio)
        if not session:
            return {"error": "Session not found"}
        if not is_artifact_session(session):
            return {"error": "Remote interval queries require a CSR artifact session"}
        try:
            context = await asyncio.to_thread(context_for_session, session)
            with csr_artifact_metrics.timer("interval.query"):
                return await asyncio.to_thread(
                    context.reader.intervals_in_range,
                    data.get("start"),
                    data.get("end"),
                    data.get("maxIntervals", 2_000),
                )
        except Exception as exc:
            return {"error": str(exc)}

    @sio.event
    async def query_local_data(sid, data):
        data = data or {}
        session = await require_session(data.get("lorax_sid"), sid, sio)
        if not session:
            return {"error": "Session not found"}
        if not is_artifact_session(session):
            return {"error": "Remote local-data queries require a CSR artifact session"}
        try:
            context = await asyncio.to_thread(context_for_session, session)
            with csr_artifact_metrics.timer("local_data.query"):
                return await asyncio.to_thread(
                    _query_local_data,
                    context.reader,
                    data,
                )
        except Exception as exc:
            return {"error": str(exc)}


__all__ = ["register_interval_events"]
