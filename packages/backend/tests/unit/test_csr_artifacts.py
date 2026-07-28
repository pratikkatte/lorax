import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pyarrow as pa
import pytest
import tskit


def _recombining_tree_sequence(path: Path) -> tskit.TreeSequence:
    tables = tskit.TableCollection(sequence_length=20)
    sample_a = tables.nodes.add_row(flags=tskit.NODE_IS_SAMPLE, time=0)
    unused = tables.nodes.add_row(time=50)
    sample_b = tables.nodes.add_row(flags=tskit.NODE_IS_SAMPLE, time=0)
    left_root = tables.nodes.add_row(time=1)
    right_root = tables.nodes.add_row(time=2)
    second_root = tables.nodes.add_row(time=3)

    tables.edges.add_row(0, 10, left_root, sample_a)
    tables.edges.add_row(0, 10, left_root, sample_b)
    tables.edges.add_row(10, 20, right_root, sample_a)
    tables.edges.add_row(10, 20, right_root, sample_b)
    # A second root exercises multi-root topology without connecting the
    # intentionally unused high-ID node.
    extra_sample = tables.nodes.add_row(flags=tskit.NODE_IS_SAMPLE, time=0)
    tables.edges.add_row(0, 20, second_root, extra_sample)

    site_id = tables.sites.add_row(4, ancestral_state="A")
    first_mutation = tables.mutations.add_row(
        site=site_id,
        node=sample_a,
        derived_state="G",
        time=0.5,
    )
    tables.mutations.add_row(
        site=site_id,
        node=sample_a,
        derived_state="T",
        parent=first_mutation,
        time=0.25,
    )
    tables.sort()
    tree_sequence = tables.tree_sequence()
    tree_sequence.dump(path)
    assert unused not in list(tree_sequence.first().nodes())
    return tree_sequence


def _build(source: Path, root: Path, **kwargs):
    from lorax.artifacts.csr_builder import build_csr_artifact

    return build_csr_artifact(
        source,
        root,
        target_shard_mb=1,
        **kwargs,
    )


def test_builder_and_reader_match_tskit_and_lorax_layout(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader
    from lorax.tree_graph import construct_tree

    source = tmp_path / "recombining.trees"
    tree_sequence = _recombining_tree_sequence(source)
    result = _build(source, tmp_path / "artifacts")
    artifact = Path(result["artifact_dir"])

    assert (artifact / "manifest.json").is_file()
    assert (artifact / "breakpoints.npy").is_file()
    assert (artifact / "shards.arrow").is_file()
    assert result["num_trees"] == tree_sequence.num_trees

    edges = tree_sequence.tables.edges
    nodes = tree_sequence.tables.nodes
    breakpoints = list(tree_sequence.breakpoints())
    with CSRArtifactReader.open(artifact) as reader:
        assert reader.verify()["ok"] is True
        for expected_tree in tree_sequence.trees():
            genealogy = reader.tree_at_index(expected_tree.index)
            expected_nodes = np.asarray(
                sorted(expected_tree.nodes()), dtype=np.int32
            )
            np.testing.assert_array_equal(genealogy.node_ids, expected_nodes)
            np.testing.assert_array_equal(
                genealogy.parent_ids,
                expected_tree.parent_array[expected_nodes],
            )
            np.testing.assert_array_equal(
                genealogy.node_times,
                tree_sequence.tables.nodes.time[expected_nodes],
            )
            np.testing.assert_array_equal(
                genealogy.node_flags,
                tree_sequence.tables.nodes.flags[expected_nodes],
            )
            assert genealogy.interval_left == expected_tree.interval.left
            assert genealogy.interval_right == expected_tree.interval.right
            for node_id in expected_nodes:
                assert genealogy.parent(int(node_id)) == expected_tree.parent(
                    int(node_id)
                )
                np.testing.assert_array_equal(
                    np.sort(genealogy.children(int(node_id))),
                    np.sort(
                        np.asarray(
                            expected_tree.children(int(node_id)), dtype=np.int32
                        )
                    ),
                )
                assert genealogy.is_tip(int(node_id)) == (
                    expected_tree.num_children(int(node_id)) == 0
                )

            dense = construct_tree(
                tree_sequence,
                edges,
                nodes,
                breakpoints,
                expected_tree.index,
            )
            np.testing.assert_allclose(
                genealogy.layout_x,
                dense.x[expected_nodes],
                rtol=0,
                atol=1e-7,
            )

        first = reader.tree_at_index(0)
        assert first.mutations.ids.tolist() == [0, 1]
        assert first.mutations.site_ids.tolist() == [0, 0]
        assert first.mutations.ancestral_states == ("A", "A")
        assert first.mutations.derived_states == ("G", "T")
        assert first.mutations.inherited_states == ("A", "G")
        assert len(reader.tree_at_index(1).mutations) == 0


def test_position_lookup_boundaries_and_multi_read_order(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / "positions.trees"
    _recombining_tree_sequence(source)
    result = _build(source, tmp_path / "artifacts")

    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        assert reader.tree_at_position(0).tree_index == 0
        assert reader.tree_at_position(9.999).tree_index == 0
        assert reader.tree_at_position(10).tree_index == 1
        assert reader.tree_at_position(19.999).tree_index == 1
        assert [
            genealogy.tree_index
            for genealogy in reader.trees_at_indices([1, 0, 1])
        ] == [1, 0, 1]
        with pytest.raises(ValueError):
            reader.tree_at_position(-1)
        with pytest.raises(ValueError):
            reader.tree_at_position(20)
        with pytest.raises(IndexError):
            reader.tree_at_index(2)


def test_reader_does_not_reopen_source(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / "closed-source.trees"
    _recombining_tree_sequence(source)
    result = _build(source, tmp_path / "artifacts")
    source.unlink()

    with (
        patch("tskit.load", side_effect=AssertionError("source reopened")),
        patch("tszip.load", side_effect=AssertionError("source reopened")),
    ):
        with CSRArtifactReader.open(result["artifact_dir"]) as reader:
            genealogy = reader.tree_at_index(0)
            assert genealogy.tree_index == 0
            assert len(genealogy.node_ids) < result["manifest"]["dataset"]["num_nodes"]


def test_corrupt_index_is_rejected_and_shard_is_verified_lazily(tmp_path):
    from lorax.artifacts.csr_reader import (
        CSRArtifactCorruptError,
        CSRArtifactReader,
    )

    source = tmp_path / "corrupt.trees"
    _recombining_tree_sequence(source)
    result = _build(source, tmp_path / "artifacts")
    artifact = Path(result["artifact_dir"])

    manifest = json.loads((artifact / "manifest.json").read_text())
    shard_index = artifact / manifest["indexes"]["shards"]["name"]
    original_index = shard_index.read_bytes()
    shard_index.write_bytes(original_index + b"broken")
    with pytest.raises(CSRArtifactCorruptError, match="Size mismatch"):
        CSRArtifactReader.open(artifact)
    shard_index.write_bytes(original_index)

    with CSRArtifactReader.open(artifact) as reader:
        shard_path = artifact / reader._shards[0]["name"]
        original_shard = shard_path.read_bytes()
        shard_path.write_bytes(original_shard + b"broken")
        with pytest.raises(CSRArtifactCorruptError, match="Size mismatch"):
            reader.tree_at_index(0)


def test_existing_ready_artifact_is_reused_and_force_rebuilds(tmp_path):
    source = tmp_path / "reuse.trees"
    _recombining_tree_sequence(source)
    root = tmp_path / "artifacts"
    first = _build(source, root)
    second = _build(source, root)
    assert second["fingerprint"] == first["fingerprint"]
    assert second["artifact_dir"] == first["artifact_dir"]

    rebuilt = _build(source, root, force=True)
    assert rebuilt["fingerprint"] == first["fingerprint"]
    assert not list(root.glob(".obsolete-*"))


def test_default_root_and_tsz_input_are_supported(tmp_path, monkeypatch):
    import tszip
    import lorax.artifacts.csr_builder as builder
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / "compressed-source.trees"
    tree_sequence = _recombining_tree_sequence(source)
    compressed = tmp_path / "compressed-source.tsz"
    tszip.compress(tree_sequence, compressed)
    default_root = tmp_path / "default-v2-root"
    monkeypatch.setattr(builder, "default_csr_artifact_root", lambda: default_root)

    result = builder.build_csr_artifact(
        compressed,
        target_shard_mb=1,
    )

    assert Path(result["artifact_dir"]).parent == default_root
    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        assert reader.num_trees == tree_sequence.num_trees
        assert reader.tree_at_position(10).tree_index == 1


@pytest.mark.parametrize("compression", ["zstd", "lz4", "none"])
def test_supported_compressions_round_trip(tmp_path, compression):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / f"{compression}.trees"
    _recombining_tree_sequence(source)
    result = _build(
        source,
        tmp_path / compression,
        compression=compression,
    )
    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        assert reader.tree_at_index(0).tree_index == 0
        assert reader.manifest["build"]["compression"] == compression


def test_single_genealogy_may_exceed_target_shard_size(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / "oversized.trees"
    tables = tskit.TableCollection(sequence_length=1)
    node_count = 70_000
    for _ in range(node_count):
        tables.nodes.add_row(flags=tskit.NODE_IS_SAMPLE, time=0)
    tables.tree_sequence().dump(source)

    result = _build(
        source,
        tmp_path / "oversized-artifact",
        compression="none",
    )

    assert result["manifest"]["artifact"]["num_shards"] == 1
    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        genealogy = reader.tree_at_index(0)
        assert len(genealogy.node_ids) == node_count
        assert genealogy.child_offsets[-1] == 0
        assert all(genealogy.is_tip(node_id) for node_id in (0, node_count - 1))


def _large_test_record(tree_index: int, node_count: int = 90_000) -> pa.RecordBatch:
    from lorax.artifacts.csr_builder import GENEALOGY_SCHEMA, MUTATION_TYPE

    node_ids = np.arange(node_count, dtype=np.int32)
    parent_ids = np.full(node_count, -1, dtype=np.int32)
    offsets = np.zeros(node_count + 1, dtype=np.int32)
    arrays = [
        pa.array([tree_index], type=pa.int64()),
        pa.array([float(tree_index * 10)], type=pa.float64()),
        pa.array([float((tree_index + 1) * 10)], type=pa.float64()),
        pa.array([node_ids], type=pa.list_(pa.int32())),
        pa.array([parent_ids], type=pa.list_(pa.int32())),
        pa.array([offsets], type=pa.list_(pa.int32())),
        pa.array([np.empty(0, dtype=np.int32)], type=pa.list_(pa.int32())),
        pa.array(
            [np.zeros(node_count, dtype=np.float64)],
            type=pa.list_(pa.float64()),
        ),
        pa.array(
            [np.zeros(node_count, dtype=np.uint32)],
            type=pa.list_(pa.uint32()),
        ),
        pa.array(
            [np.zeros(node_count, dtype=np.float32)],
            type=pa.list_(pa.float32()),
        ),
        pa.array([[]], type=pa.list_(MUTATION_TYPE)),
    ]
    return pa.RecordBatch.from_arrays(arrays, schema=GENEALOGY_SCHEMA)


def test_interrupted_build_resumes_completed_shards(tmp_path, monkeypatch):
    import lorax.artifacts.csr_builder as builder

    source = tmp_path / "resume.trees"
    _recombining_tree_sequence(source)
    root = tmp_path / "artifacts"
    monkeypatch.setattr(
        builder,
        "genealogy_record_batch",
        lambda tree, _ts: _large_test_record(tree.index),
    )
    original_write = builder._write_shard
    calls = 0

    def fail_second_shard(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated interruption")
        return original_write(*args, **kwargs)

    monkeypatch.setattr(builder, "_write_shard", fail_second_shard)
    with pytest.raises(RuntimeError, match="simulated interruption"):
        builder.build_csr_artifact(source, root, target_shard_mb=1)

    staging = next(root.glob(".*.csr-v2.inprogress"))
    state = json.loads((staging / "build-state.json").read_text())
    assert state["next_tree"] == 1
    assert len(state["shards"]) == 1

    monkeypatch.setattr(builder, "_write_shard", original_write)
    result = builder.build_csr_artifact(source, root, target_shard_mb=1)
    assert result["num_trees"] == 2
    assert not list(root.glob(".*.csr-v2.inprogress"))


def test_standalone_script_explicit_output_and_verify(tmp_path):
    source = tmp_path / "script.trees"
    _recombining_tree_sequence(source)
    output = tmp_path / "script-output"
    script = (
        Path(__file__).parents[2]
        / "scripts"
        / "preprocess_treesequence_csr.py"
    )
    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            str(source),
            "--output-dir",
            str(output),
            "--target-shard-mb",
            "1",
            "--verify",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr
    result = json.loads(completed.stdout.strip().splitlines()[-1])
    assert result["status"] == "ready"
    assert result["verification"]["ok"] is True
    assert Path(result["artifact_dir"]).is_relative_to(output)
