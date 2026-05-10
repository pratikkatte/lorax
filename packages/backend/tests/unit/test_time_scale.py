import numpy as np

from lorax.tree_graph.time_scale import (
    newick_edge_coordinates,
    normalize_time_scale,
    time_to_y,
    times_to_y,
    tree_graph_edge_coordinates,
)


def test_linear_time_scale_matches_existing_mapping():
    y = times_to_y(np.array([0.0, 5.0, 10.0]), 0.0, 10.0, "linear")
    assert np.allclose(y, [1.0, 0.5, 0.0])


def test_log_time_scale_maps_bounds():
    assert time_to_y(0.0, 0.0, 10.0, "log") == 1.0
    assert time_to_y(10.0, 0.0, 10.0, "log") == 0.0


def test_invalid_time_scale_falls_back_to_linear():
    assert normalize_time_scale("bogus") == "linear"
    assert time_to_y(5.0, 0.0, 10.0, "bogus") == time_to_y(5.0, 0.0, 10.0, "linear")


def test_degenerate_time_range_is_stable():
    y = times_to_y(np.array([1.0, 2.0]), 5.0, 5.0, "log")
    assert np.allclose(y, [1.0, 1.0])


def test_tree_graph_edge_coordinates_use_shared_time_scale():
    class Graph:
        x = np.array([0.25, 0.75], dtype=np.float32)
        time = np.array([0.0, 10.0], dtype=np.float32)

    edge = tree_graph_edge_coordinates(Graph(), 0, 1, 0.0, 10.0, "log")

    assert edge["parent_x"] == 0.25
    assert edge["child_x"] == 0.75
    assert edge["parent_y"] == 1.0
    assert edge["child_y"] == 0.0


def test_newick_edge_coordinates_use_shared_time_scale():
    class Graph:
        node_id = np.array([10, 20], dtype=np.int32)
        x = np.array([0.25, 0.75], dtype=np.float32)
        y = np.array([1.0, 0.0], dtype=np.float32)

    edge = newick_edge_coordinates(Graph(), 10, 20, 10.0, "log")

    assert edge["parent"] == 10
    assert edge["child"] == 20
    assert edge["parent_y"] == 1.0
    assert edge["child_y"] == 0.0
