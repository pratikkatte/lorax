"""Unit tests for canonical lineage coordinate semantics."""

import numpy as np
import pytest

from lorax.cache import TreeGraphCache
from lorax.lineage import get_ancestors, get_mrca, get_subtree, search_nodes_by_criteria


class DummyTreeGraph:
    """Small deterministic tree graph for lineage coordinate tests."""

    def __init__(self):
        # Tree structure:
        #   0
        #  / \
        # 1   2
        # |
        # 3
        self.parent = np.array([-1, 0, 0, 1], dtype=np.int32)
        self.time = np.array([4.0, 2.0, 0.0, 0.0], dtype=np.float32)
        self.x = np.array([0.5, 0.2, 0.8, 0.1], dtype=np.float32)  # layout/horizontal
        self.y = np.array([0.0, 0.5, 1.0, 1.0], dtype=np.float32)  # time/vertical
        self.in_tree = np.array([True, True, True, True], dtype=np.bool_)
        self._children = {
            0: np.array([1, 2], dtype=np.int32),
            1: np.array([3], dtype=np.int32),
            2: np.array([], dtype=np.int32),
            3: np.array([], dtype=np.int32),
        }

    def children(self, node_id: int) -> np.ndarray:
        return self._children[int(node_id)]

    def is_tip(self, node_id: int) -> bool:
        return self._children[int(node_id)].size == 0


@pytest.fixture
async def lineage_cache():
    cache = TreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)
    await cache.set("lineage-session", 0, DummyTreeGraph())
    return cache


@pytest.mark.anyio
async def test_get_ancestors_returns_canonical_x_y(lineage_cache):
    result = await get_ancestors(lineage_cache, "lineage-session", 0, 3)

    assert result["ancestors"] == [1, 0]
    assert [entry["node_id"] for entry in result["path"]] == [3, 1, 0]

    first = result["path"][0]
    assert first["x"] == pytest.approx(0.1)
    assert first["y"] == pytest.approx(1.0)

    parent = result["path"][1]
    assert parent["x"] == pytest.approx(0.2)
    assert parent["y"] == pytest.approx(0.5)


@pytest.mark.anyio
async def test_search_nodes_by_criteria_min_max_y_uses_time_axis(lineage_cache):
    min_filtered = await search_nodes_by_criteria(
        lineage_cache, "lineage-session", 0, {"min_y": 0.9}
    )
    assert set(min_filtered["matches"]) == {2, 3}
    assert all(pos["y"] >= 0.9 for pos in min_filtered["positions"])

    max_filtered = await search_nodes_by_criteria(
        lineage_cache, "lineage-session", 0, {"max_y": 0.6}
    )
    assert set(max_filtered["matches"]) == {0, 1}
    assert all(pos["y"] <= 0.6 for pos in max_filtered["positions"])


@pytest.mark.anyio
async def test_get_subtree_and_mrca_return_canonical_positions(lineage_cache):
    subtree = await get_subtree(lineage_cache, "lineage-session", 0, 1)
    assert {node["node_id"] for node in subtree["nodes"]} == {1, 3}
    node_by_id = {node["node_id"]: node for node in subtree["nodes"]}
    assert node_by_id[1]["x"] == pytest.approx(0.2)
    assert node_by_id[1]["y"] == pytest.approx(0.5)
    assert node_by_id[3]["x"] == pytest.approx(0.1)
    assert node_by_id[3]["y"] == pytest.approx(1.0)

    mrca = await get_mrca(lineage_cache, "lineage-session", 0, [2, 3])
    assert mrca["mrca"] == 0
    assert mrca["mrca_position"]["x"] == pytest.approx(0.5)
    assert mrca["mrca_position"]["y"] == pytest.approx(0.0)
