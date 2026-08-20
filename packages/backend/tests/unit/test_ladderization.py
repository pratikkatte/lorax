import gzip
import json

import numpy as np
import pyarrow as pa
import pytest
import tskit


def _unbalanced_csr():
    # Root 5 has a three-tip clade (4) before a one-tip clade (0).
    children_indptr = np.asarray([0, 0, 0, 0, 0, 3, 5], dtype=np.int32)
    children_data = np.asarray([1, 2, 3, 4, 0], dtype=np.int32)
    roots = np.asarray([5], dtype=np.int32)
    return children_indptr, children_data, roots


def test_ladderization_puts_smaller_clades_left_and_preserves_ties():
    from lorax.tree_graph.tree_graph import _ladderize_children_and_compute_x

    children_indptr, children_data, roots = _unbalanced_csr()
    ordered, x, tip_counts, tip_count = _ladderize_children_and_compute_x(
        children_indptr,
        children_data,
        roots,
        6,
    )

    assert ordered[3:5].tolist() == [0, 4]
    assert ordered[:3].tolist() == [1, 2, 3]
    assert tip_counts.tolist() == [1, 1, 1, 1, 3, 4]
    assert tip_count == 4
    assert x[0] == 0
    assert x[1:4].tolist() == [1, 2, 3]
    assert x[0] < x[4]


def test_ladderization_stably_orders_multifurcations():
    from lorax.tree_graph.tree_graph import _ladderize_children_and_compute_x

    # Node 9's source-ordered child sizes are [3, 1, 2, 1].
    children_indptr = np.asarray(
        [0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 9],
        dtype=np.int32,
    )
    children_data = np.asarray(
        [0, 1, 2, 3, 4, 7, 5, 8, 6],
        dtype=np.int32,
    )
    ordered, x, tip_counts, tip_count = _ladderize_children_and_compute_x(
        children_indptr,
        children_data,
        np.asarray([9], dtype=np.int32),
        10,
    )

    assert ordered[5:9].tolist() == [5, 6, 8, 7]
    assert ordered[:3].tolist() == [0, 1, 2]
    assert tip_counts[ordered[5:9]].tolist() == [1, 1, 2, 3]
    assert tip_count == 7
    assert x[5] < x[6] < x[8] < x[7]


def test_ladderization_handles_unary_nodes_single_tips_and_forests():
    from lorax.tree_graph.tree_graph import _ladderize_children_and_compute_x

    children_indptr = np.asarray([0, 0, 0, 1], dtype=np.int32)
    children_data = np.asarray([0], dtype=np.int32)
    ordered, x, tip_counts, tip_count = _ladderize_children_and_compute_x(
        children_indptr,
        children_data,
        np.asarray([2, 1], dtype=np.int32),
        3,
    )

    assert ordered.tolist() == [0]
    assert tip_counts.tolist() == [1, 1, 1]
    assert tip_count == 2
    assert x.tolist() == [0, 1, 0]


def _unbalanced_tree_sequence():
    tables = tskit.TableCollection(sequence_length=1)
    for _ in range(4):
        tables.nodes.add_row(flags=tskit.NODE_IS_SAMPLE, time=0)
    tables.nodes.add_row(time=1)  # node 4: three-tip child clade
    tables.nodes.add_row(time=2)  # node 5: root
    for child in (1, 2, 3):
        tables.edges.add_row(0, 1, parent=4, child=child)
    for child in (4, 0):
        tables.edges.add_row(0, 1, parent=5, child=child)
    tables.sort()
    return tables.tree_sequence()


def test_treesequence_graph_ladderizes_children_and_layout():
    from lorax.tree_graph import construct_tree

    tree_sequence = _unbalanced_tree_sequence()
    graph = construct_tree(
        tree_sequence,
        tree_sequence.tables.edges,
        tree_sequence.tables.nodes,
        list(tree_sequence.breakpoints()),
        0,
    )

    assert graph.children(5).tolist() == [0, 4]
    assert graph.children(4).tolist() == [1, 2, 3]
    assert graph.x[0] == pytest.approx(0.0)
    assert graph.x[1:4].tolist() == pytest.approx([1 / 3, 2 / 3, 1.0])
    assert graph.x[0] < graph.x[4]


def test_newick_layout_ladderizes_without_changing_sample_ids():
    from lorax.csv.newick_tree import parse_newick_to_tree

    samples = ["A", "B", "C", "D"]
    source_ordered = parse_newick_to_tree(
        "(A:1,(B:1,C:1,D:1):1);",
        2,
        samples_order=samples,
    )
    reversed_order = parse_newick_to_tree(
        "((B:1,C:1,D:1):1,A:1);",
        2,
        samples_order=samples,
    )

    def tips(graph):
        return {
            name: (int(graph.node_id[index]), float(graph.x[index]))
            for index, name in enumerate(graph.name)
            if graph.is_tip[index]
        }

    first = tips(source_ordered)
    second = tips(reversed_order)
    assert {name: node_id for name, (node_id, _x) in first.items()} == {
        name: index for index, name in enumerate(samples)
    }
    assert {name: node_id for name, (node_id, _x) in second.items()} == {
        name: index for index, name in enumerate(samples)
    }
    assert first["A"][1] == pytest.approx(0.0)
    assert second["A"][1] == pytest.approx(0.0)


def test_newick_layout_preserves_equal_clade_source_order():
    from lorax.csv.newick_tree import parse_newick_to_tree

    graph = parse_newick_to_tree("(B:1,A:1,(C:1,D:1):1);", 2)
    tip_x = {
        name: float(graph.x[index])
        for index, name in enumerate(graph.name)
        if graph.is_tip[index]
    }
    assert tip_x["B"] < tip_x["A"] < tip_x["C"] < tip_x["D"]


def _legacy_genealogy_batch():
    from lorax.artifacts.csr_builder import GENEALOGY_SCHEMA, MUTATION_TYPE

    node_ids = np.arange(6, dtype=np.int32)
    parent_ids = np.asarray([5, 4, 4, 4, 5, -1], dtype=np.int32)
    child_offsets, child_node_ids, _roots = _unbalanced_csr()
    arrays = [
        pa.array([0], type=pa.int64()),
        pa.array([0.0], type=pa.float64()),
        pa.array([1.0], type=pa.float64()),
        pa.array([node_ids], type=pa.list_(pa.int32())),
        pa.array([parent_ids], type=pa.list_(pa.int32())),
        pa.array([child_offsets], type=pa.list_(pa.int32())),
        pa.array([child_node_ids], type=pa.list_(pa.int32())),
        pa.array([np.asarray([0, 0, 0, 0, 1, 2], dtype=np.float64)], type=pa.list_(pa.float64())),
        pa.array([np.asarray([1, 1, 1, 1, 0, 0], dtype=np.uint32)], type=pa.list_(pa.uint32())),
        pa.array([np.ones(6, dtype=np.float32)], type=pa.list_(pa.float32())),
        pa.array(
            [[{
                "id": 0,
                "site_id": 0,
                "node_id": 0,
                "parent_id": -1,
                "position": 0.5,
                "time": 0.0,
                "ancestral_state": "A",
                "derived_state": "G",
                "inherited_state": "A",
            }]],
            type=pa.list_(MUTATION_TYPE),
        ),
    ]
    return pa.RecordBatch.from_arrays(arrays, schema=GENEALOGY_SCHEMA)


def test_legacy_artifact_decode_normalizes_children_layout_and_mutation_x():
    from lorax.artifacts.csr_reader import _decode_genealogy
    from lorax.artifacts.render import _process_genealogy

    genealogy = _decode_genealogy(
        _legacy_genealogy_batch(),
        normalize_layout=True,
    )

    assert genealogy.children(5).tolist() == [0, 4]
    assert genealogy.layout_x[0] == pytest.approx(0.0)
    assert genealogy.layout_x[1:4].tolist() == pytest.approx([1 / 3, 2 / 3, 1.0])
    node_data, mutation_data = _process_genealogy(
        genealogy,
        min_time=0,
        max_time=2,
        time_scale="linear",
        sparsification=False,
        sparsify_cell_size_multiplier=None,
        adaptive_sparsify_bbox=None,
        adaptive_target_tree_idx=None,
    )
    mutation_node = int(mutation_data["node_id"][0])
    mutation_node_offset = int(np.flatnonzero(node_data["node_id"] == mutation_node)[0])
    assert mutation_data["x"][0] == pytest.approx(node_data["x"][mutation_node_offset])


def test_phlag_record_builder_persists_ladderized_children_and_layout():
    from lorax.artifacts.csr_reader import _decode_genealogy
    from scripts.build_phlag_newick_csr import newick_record_batch

    sample_ids = {}
    batch, _height, _node_count, _edge_count = newick_record_batch(
        "((B:1,C:1,D:1):1,A:1);",
        tree_index=0,
        interval_left=0,
        interval_right=1,
        sample_ids=sample_ids,
    )
    genealogy = _decode_genealogy(batch, normalize_layout=False)

    def terminal_tip_count(node_id):
        children = genealogy.children(node_id).tolist()
        if not children:
            return 1
        return sum(terminal_tip_count(int(child)) for child in children)

    for node_id in genealogy.node_ids:
        children = [int(child) for child in genealogy.children(int(node_id))]
        child_tip_counts = [terminal_tip_count(child) for child in children]
        assert child_tip_counts == sorted(child_tip_counts)
    assert sample_ids == {"B": 0, "C": 1, "D": 2, "A": 3}
    assert genealogy.layout_x.min() >= 0.0
    assert genealogy.layout_x.max() <= 1.0


def test_phlag_builder_records_ladderized_layout_marker(tmp_path):
    from lorax.tree_graph.tree_graph import LADDERIZED_LAYOUT_ORDER
    from scripts.build_phlag_newick_csr import build_chromosome

    trees_path = tmp_path / "trees.nwk.gz"
    positions_path = tmp_path / "positions.txt.gz"
    with gzip.open(trees_path, "wt", encoding="utf-8") as trees:
        trees.write("((B:1,C:1,D:1):1,A:1);\n")
    with gzip.open(positions_path, "wt", encoding="utf-8") as positions:
        positions.write("0\n")

    result = build_chromosome(
        tmp_path,
        "chr1",
        final_window_bp=10,
        target_shard_mb=1,
        compression="zstd",
        force=False,
        limit=None,
        trees_path=trees_path,
        positions_path=positions_path,
    )
    manifest = json.loads(
        (tmp_path / "trees.nwk.gz.artifact" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )

    assert result["num_trees"] == 1
    assert manifest["builder_version"] == "phlag-newick-csr-v2"
    assert manifest["build"]["layout_order"] == LADDERIZED_LAYOUT_ORDER
    assert manifest["build"]["rooting_method"] == "minvar"
    assert manifest["build"]["source_rooting"] == "arbitrary"
