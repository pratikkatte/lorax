from types import SimpleNamespace

import numpy as np
import pytest

from lorax.artifacts.csr_reader import GenealogyCSR, GenealogyMutations
from lorax.sockets.node_search import _artifact_positions, _compare_artifact_trees


EMPTY_MUTATIONS = GenealogyMutations(
    ids=np.empty(0, dtype=np.int32),
    site_ids=np.empty(0, dtype=np.int32),
    node_ids=np.empty(0, dtype=np.int32),
    parent_ids=np.empty(0, dtype=np.int32),
    positions=np.empty(0, dtype=np.float64),
    times=np.empty(0, dtype=np.float64),
    ancestral_states=(),
    derived_states=(),
    inherited_states=(),
)


def _genealogy(tree_index, times, parent_ids=(1, 2, -1)):
    if tuple(parent_ids) == (1, 2, -1):
        child_offsets = np.array([0, 0, 1, 2], dtype=np.int32)
    else:
        child_offsets = np.array([0, 0, 0, 2], dtype=np.int32)
    return GenealogyCSR(
        tree_index=tree_index,
        interval_left=float(tree_index),
        interval_right=float(tree_index + 1),
        node_ids=np.array([0, 1, 2], dtype=np.int32),
        parent_ids=np.asarray(parent_ids, dtype=np.int32),
        child_offsets=child_offsets,
        child_node_ids=np.array([0, 1], dtype=np.int32),
        node_times=np.asarray(times, dtype=np.float64),
        node_flags=np.array([1, 0, 0], dtype=np.uint32),
        layout_x=np.array([0.25, 0.5, 0.75], dtype=np.float32),
        mutations=EMPTY_MUTATIONS,
    )


class _Reader:
    global_min_time = 0.0
    global_max_time = 20.0

    def __init__(self, genealogies):
        self._genealogies = {tree.tree_index: tree for tree in genealogies}
        self.num_trees = len(genealogies)

    def has_capability(self, _capability):
        return False

    def trees_at_indices(self, indices):
        return [self._genealogies[index] for index in indices]


@pytest.mark.parametrize("time_scale", ["linear", "log"])
def test_artifact_highlights_follow_per_tree_height_normalization(time_scale):
    context = SimpleNamespace(
        reader=_Reader(
            [_genealogy(0, [0.0, 5.0, 10.0]), _genealogy(1, [0.0, 10.0, 20.0])]
        )
    )

    positions, _lineages = _artifact_positions(
        context,
        [1],
        [0, 1],
        time_scale,
        normalize_tree_heights=True,
    )

    assert len(positions) == 2
    assert positions[0]["y"] == pytest.approx(positions[1]["y"])


def test_artifact_topology_overlays_use_the_changed_tree_maximum():
    context = SimpleNamespace(
        reader=_Reader(
            [
                _genealogy(0, [0.0, 0.0, 10.0], parent_ids=(2, 2, -1)),
                _genealogy(1, [0.0, 5.0, 20.0]),
            ]
        )
    )

    result = _compare_artifact_trees(
        context,
        [0, 1],
        "linear",
        normalize_tree_heights=True,
    )

    comparison = result["comparisons"][0]
    inserted = comparison["inserted"][0]
    removed = comparison["removed"][0]
    assert inserted["parent_y"] == pytest.approx(0.75)
    assert inserted["child_y"] == pytest.approx(1.0)
    assert removed["parent_y"] == pytest.approx(0.0)
    assert removed["child_y"] == pytest.approx(1.0)
