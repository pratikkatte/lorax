import json
import os
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
    )
    tables.mutations.add_row(
        site=site_id,
        node=sample_a,
        derived_state="T",
        parent=first_mutation,
    )
    tables.sort()
    tree_sequence = tables.tree_sequence()
    tree_sequence.dump(path)
    assert unused not in list(tree_sequence.first().nodes())
    return tree_sequence


def _many_tree_sequence(
    path: Path,
    *,
    num_trees: int = 48,
    num_samples: int = 1_000,
) -> tskit.TreeSequence:
    tables = tskit.TableCollection(sequence_length=num_trees)
    samples = [
        tables.nodes.add_row(flags=tskit.NODE_IS_SAMPLE, time=0)
        for _ in range(num_samples)
    ]
    for tree_index in range(num_trees):
        root = tables.nodes.add_row(time=tree_index + 1)
        for sample in samples:
            tables.edges.add_row(
                tree_index,
                tree_index + 1,
                root,
                sample,
            )
    tables.sort()
    tree_sequence = tables.tree_sequence()
    tree_sequence.dump(path)
    assert tree_sequence.num_trees == num_trees
    return tree_sequence


def _build(source: Path, **kwargs):
    from lorax.artifacts.csr_builder import build_csr_artifact

    return build_csr_artifact(
        source,
        target_shard_mb=1,
        **kwargs,
    )


def test_builder_and_reader_match_tskit_and_lorax_layout(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader
    from lorax.tree_graph import construct_tree

    source = tmp_path / "recombining.trees"
    tree_sequence = _recombining_tree_sequence(source)
    result = _build(source)
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


def test_builder_uses_exact_colocated_path_without_locators(tmp_path):
    import tszip

    from lorax.artifacts import artifact_path_for_source

    uncompressed = tmp_path / "colocated-source.trees"
    tree_sequence = _recombining_tree_sequence(uncompressed)
    source = tmp_path / "colocated.trees.tsz"
    tszip.compress(tree_sequence, source)
    result = _build(source)
    expected = tmp_path / "colocated.trees.tsz.artifact"

    assert artifact_path_for_source(source) == expected
    assert Path(result["artifact_dir"]) == expected
    assert expected.name != result["fingerprint"]
    assert not (tmp_path / "locators").exists()
    assert not (tmp_path / ".locators").exists()


def test_multiprocess_ranges_match_single_worker_artifact(tmp_path):
    import tszip

    from lorax.artifacts import CSRArtifactReader, build_csr_artifact

    serial_source = tmp_path / "serial-many.trees"
    tree_sequence = _many_tree_sequence(serial_source)
    parallel_source = tmp_path / "parallel-many.trees.tsz"
    tszip.compress(tree_sequence, parallel_source)

    serial = build_csr_artifact(
        serial_source,
        target_shard_mb=1,
        workers=1,
        trees_per_range=5,
        skip_node_tree_ranges=True,
    )
    parallel = build_csr_artifact(
        parallel_source,
        target_shard_mb=1,
        workers=4,
        trees_per_range=5,
        skip_node_tree_ranges=True,
    )

    assert serial["manifest"]["capabilities"]["node_tree_ranges"] is False
    assert parallel["manifest"]["capabilities"]["node_tree_ranges"] is False
    assert "node_tree_ranges" not in parallel["manifest"]["indexes"]
    assert parallel["manifest"]["build"]["worker_counts_requested"] == [4]
    assert 1 < max(parallel["manifest"]["build"]["worker_counts_used"]) <= 4
    assert parallel["manifest"]["build"]["trees_per_range"] == 5
    assert parallel["manifest"]["build"]["multiprocessing_start_methods_used"] == [
        "fork" if os.name == "posix" else "spawn"
    ]
    assert parallel["manifest"]["build"]["genealogy_worker_seconds"] > 0
    assert parallel["manifest"]["build"]["worker_peak_rss_bytes"] is not None
    with (
        CSRArtifactReader.open(serial["artifact_dir"]) as serial_reader,
        CSRArtifactReader.open(parallel["artifact_dir"]) as parallel_reader,
    ):
        assert serial_reader.num_trees == parallel_reader.num_trees
        for tree_index in range(serial_reader.num_trees):
            observed = parallel_reader.tree_at_index(tree_index)
            expected = serial_reader.tree_at_index(tree_index)
            assert observed.tree_index == expected.tree_index
            assert observed.interval_left == expected.interval_left
            assert observed.interval_right == expected.interval_right
            np.testing.assert_array_equal(observed.node_ids, expected.node_ids)
            np.testing.assert_array_equal(observed.parent_ids, expected.parent_ids)
            np.testing.assert_array_equal(
                observed.child_offsets,
                expected.child_offsets,
            )
            np.testing.assert_array_equal(
                observed.child_node_ids,
                expected.child_node_ids,
            )
            np.testing.assert_array_equal(observed.node_times, expected.node_times)
            np.testing.assert_array_equal(observed.node_flags, expected.node_flags)
            np.testing.assert_array_equal(observed.layout_x, expected.layout_x)
            assert len(observed.mutations) == len(expected.mutations)

        expected_tree = 0
        for shard in parallel_reader._shards:
            assert shard["first_tree"] == expected_tree
            expected_tree = shard["last_tree_exclusive"]
        assert expected_tree == parallel_reader.num_trees


def test_spawn_workers_load_source_and_emit_memory_warning(
    tmp_path,
    monkeypatch,
):
    import multiprocessing
    import tszip
    import lorax.artifacts.csr_builder as builder

    if "spawn" not in multiprocessing.get_all_start_methods():
        pytest.skip("spawn multiprocessing is unavailable")
    uncompressed = tmp_path / "spawn-many.trees"
    tree_sequence = _many_tree_sequence(uncompressed)
    source = tmp_path / "spawn-many.trees.tsz"
    tszip.compress(tree_sequence, source)
    events = []
    monkeypatch.setattr(
        builder,
        "_parallel_start_method",
        lambda _workers: "spawn",
    )

    result = builder.build_csr_artifact(
        source,
        target_shard_mb=1,
        workers=8,
        trees_per_range=5,
        format_version=2,
        progress=events.append,
    )

    assert result["manifest"]["build"]["multiprocessing_start_methods_used"] == [
        "spawn"
    ]
    assert result["manifest"]["build"]["worker_counts_requested"] == [8]
    assert any(event["event"] == "warning" for event in events)
    assert result["num_trees"] == 48


def test_position_lookup_boundaries_and_multi_read_order(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / "positions.trees"
    _recombining_tree_sequence(source)
    result = _build(source)

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


def test_genomic_range_lookup_uses_half_open_overlap_semantics(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / "ranges.trees"
    _recombining_tree_sequence(source)
    result = _build(source)

    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        assert list(reader.tree_indices_in_range(0, 10)) == [0]
        assert list(reader.tree_indices_in_range(2, 10)) == [0]
        assert list(reader.tree_indices_in_range(2, 10.1)) == [0, 1]
        assert list(reader.tree_indices_in_range(10, 20)) == [1]
        assert list(reader.tree_indices_in_range(0, 20)) == [0, 1]
        assert [
            genealogy.tree_index
            for genealogy in reader.trees_in_range(2, 10.1)
        ] == [0, 1]
        for invalid_range in [(-1, 1), (0, 0), (10, 9), (0, 21)]:
            with pytest.raises(ValueError):
                reader.tree_indices_in_range(*invalid_range)


def test_reader_does_not_reopen_source(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    source = tmp_path / "closed-source.trees"
    _recombining_tree_sequence(source)
    result = _build(source)
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
    result = _build(source)
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
    first = _build(source)
    second = _build(source)
    assert second["fingerprint"] == first["fingerprint"]
    assert second["artifact_dir"] == first["artifact_dir"]

    rebuilt = _build(source, force=True)
    assert rebuilt["fingerprint"] == first["fingerprint"]
    assert not list(tmp_path.glob(".*.artifact.obsolete-*"))


def test_changed_source_requires_force_to_replace_colocated_artifact(tmp_path):
    from lorax.artifacts import CSRArtifactBuildError

    source = tmp_path / "changed.trees"
    _recombining_tree_sequence(source)
    first = _build(source)

    replacement = tskit.TableCollection(sequence_length=1)
    replacement.nodes.add_row(flags=tskit.NODE_IS_SAMPLE, time=0)
    replacement.tree_sequence().dump(source)

    with pytest.raises(CSRArtifactBuildError, match="use --force"):
        _build(source)

    rebuilt = _build(source, force=True)
    assert rebuilt["artifact_dir"] == first["artifact_dir"]
    assert rebuilt["fingerprint"] != first["fingerprint"]


def test_colocated_tsz_input_is_supported(tmp_path):
    import tszip
    from lorax.artifacts.csr_reader import CSRArtifactReader
    from lorax.artifacts.csr_builder import build_csr_artifact

    source = tmp_path / "compressed-source.trees"
    tree_sequence = _recombining_tree_sequence(source)
    compressed = tmp_path / "compressed-source.tsz"
    tszip.compress(tree_sequence, compressed)

    result = build_csr_artifact(
        compressed,
        target_shard_mb=1,
    )

    assert Path(result["artifact_dir"]) == Path(f"{compressed}.artifact")
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
        compression="none",
    )

    assert result["manifest"]["artifact"]["num_shards"] == 1
    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        genealogy = reader.tree_at_index(0)
        assert len(genealogy.node_ids) == node_count
        assert genealogy.child_offsets[-1] == 0
        assert all(genealogy.is_tip(node_id) for node_id in (0, node_count - 1))
        # Detail lookup jumps directly into the second compressed sidecar
        # record batch instead of decoding every preceding batch.
        assert reader.node_details(node_count - 1)["id"] == node_count - 1


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
        builder.build_csr_artifact(source, target_shard_mb=1)

    staging = tmp_path / ".resume.trees.artifact.inprogress"
    state = json.loads((staging / "build-state.json").read_text())
    assert state["next_tree"] == 1
    assert len(state["shards"]) == 1

    monkeypatch.setattr(builder, "_write_shard", original_write)
    result = builder.build_csr_artifact(source, target_shard_mb=1)
    assert result["num_trees"] == 2
    assert not staging.exists()


def test_interrupted_build_rejects_changed_node_tree_range_option(
    tmp_path,
    monkeypatch,
):
    import lorax.artifacts.csr_builder as builder

    source = tmp_path / "resume-node-range-option.trees"
    _recombining_tree_sequence(source)
    original_sidecar_writer = builder._write_v3_sidecars

    def interrupt_sidecars(*args, **kwargs):
        raise RuntimeError("simulated sidecar interruption")

    monkeypatch.setattr(builder, "_write_v3_sidecars", interrupt_sidecars)
    with pytest.raises(RuntimeError, match="simulated sidecar interruption"):
        builder.build_csr_artifact(source, target_shard_mb=1)

    staging = tmp_path / ".resume-node-range-option.trees.artifact.inprogress"
    state = json.loads((staging / "build-state.json").read_text())
    assert state["options"]["skip_node_tree_ranges"] is False

    monkeypatch.setattr(builder, "_write_v3_sidecars", original_sidecar_writer)
    with pytest.raises(
        builder.CSRArtifactBuildError,
        match="Build options differ.*--force",
    ):
        builder.build_csr_artifact(
            source,
            target_shard_mb=1,
            skip_node_tree_ranges=True,
        )

    result = builder.build_csr_artifact(
        source,
        target_shard_mb=1,
        skip_node_tree_ranges=True,
        force=True,
    )
    assert result["manifest"]["capabilities"]["node_tree_ranges"] is False


def test_interrupted_range_build_resumes_with_different_worker_count(
    tmp_path,
    monkeypatch,
):
    import lorax.artifacts.csr_builder as builder

    source = tmp_path / "resume-workers.trees"
    tree_sequence = _many_tree_sequence(source)
    original_build_range = builder._build_tree_range
    calls = 0

    def fail_second_range(task):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated range failure")
        return original_build_range(task)

    monkeypatch.setattr(builder, "_build_tree_range", fail_second_range)
    with pytest.raises(RuntimeError, match="simulated range failure"):
        builder.build_csr_artifact(
            source,
            target_shard_mb=1,
            workers=1,
            trees_per_range=5,
            format_version=2,
        )

    staging = tmp_path / ".resume-workers.trees.artifact.inprogress"
    state = json.loads((staging / "build-state.json").read_text())
    assert 0 < state["next_tree"] < tree_sequence.num_trees
    assert state["completed_ranges"]
    assert state["worker_counts_used"] == [1]
    committed_before_resume = state["next_tree"]
    incomplete_range = builder._range_directory(
        staging,
        committed_before_resume,
        min(committed_before_resume + 5, tree_sequence.num_trees),
    )
    incomplete_range.mkdir(parents=True)
    (incomplete_range / "partial.arrow").write_bytes(b"incomplete")

    monkeypatch.setattr(builder, "_build_tree_range", original_build_range)
    result = builder.build_csr_artifact(
        source,
        target_shard_mb=1,
        workers=2,
        trees_per_range=5,
        format_version=2,
    )

    assert result["num_trees"] == tree_sequence.num_trees
    assert result["manifest"]["build"]["worker_counts_requested"] == [1, 2]
    assert result["manifest"]["build"]["worker_counts_used"] == [1, 2]
    assert committed_before_resume > 0
    assert not staging.exists()


def test_range_promotion_recovers_already_renamed_shard(tmp_path):
    import lorax.artifacts.csr_builder as builder

    source = tmp_path / "promotion-recovery.trees"
    _recombining_tree_sequence(source)
    staging = tmp_path / ".promotion-recovery.artifact.inprogress"
    staging.mkdir()
    range_directory = builder._range_directory(staging, 0, 2)
    builder._initialize_range_worker(str(source))
    result = builder._build_tree_range(
        {
            "source": str(source),
            "fingerprint": builder.source_fingerprint(source),
            "start": 0,
            "end": 2,
            "range_directory": str(range_directory),
            "target_shard_bytes": 1,
            "compression": "zstd",
        }
    )
    assert len(result["shards"]) == 2
    first_source = range_directory / result["shards"][0]["name"]
    first_destination = staging / "csr-000000.arrow"
    os.replace(first_source, first_destination)
    state = {"next_tree": 0, "shards": []}
    state_path = staging / "build-state.json"
    state_path.write_text(json.dumps(state))

    promoted = builder._promote_completed_range(
        result,
        range_directory=range_directory,
        staging=staging,
        state=state,
        state_path=state_path,
    )

    assert [shard["name"] for shard in promoted] == [
        "csr-000000.arrow",
        "csr-000001.arrow",
    ]
    assert state["next_tree"] == 2
    assert first_destination.is_file()
    assert (staging / "csr-000001.arrow").is_file()


def test_projected_size_checks_space_beside_source(tmp_path, monkeypatch):
    import lorax.artifacts.csr_builder as builder

    source = tmp_path / "no-space.trees"
    _recombining_tree_sequence(source)

    class NoFreeSpace:
        free = 0

    monkeypatch.setattr(
        builder.shutil,
        "disk_usage",
        lambda checked_path: (
            NoFreeSpace()
            if Path(checked_path) == tmp_path
            else pytest.fail("disk space checked on the wrong filesystem")
        ),
    )
    monkeypatch.setattr(
        builder,
        "ProcessPoolExecutor",
        lambda *args, **kwargs: pytest.fail(
            "process pool started before the disk-space guard"
        ),
    )

    with pytest.raises(
        builder.CSRArtifactBuildError,
        match="exceeds available disk space",
    ):
        builder.build_csr_artifact(
            source,
            target_shard_mb=1,
            workers=2,
            trees_per_range=1,
        )

    assert (tmp_path / ".no-space.trees.artifact.inprogress").is_dir()


def test_interrupted_v3_build_resumes_completed_sidecars(tmp_path, monkeypatch):
    import lorax.artifacts.csr_builder as builder

    source = tmp_path / "resume-sidecars.trees"
    _metadata_tree_sequence(source)
    original_write = builder._write_arrow_table_atomic

    def interrupt_at_sites(path, table, *, compression):
        if path.name == "sites.arrow":
            raise RuntimeError("simulated sidecar interruption")
        return original_write(path, table, compression=compression)

    monkeypatch.setattr(builder, "_write_arrow_table_atomic", interrupt_at_sites)
    with pytest.raises(RuntimeError, match="sidecar interruption"):
        builder.build_csr_artifact(source, target_shard_mb=1)

    staging = tmp_path / ".resume-sidecars.trees.artifact.inprogress"
    state = json.loads((staging / "build-state.json").read_text())
    assert "config" in state["sidecar_indexes"]
    assert "nodes" in state["sidecar_indexes"]
    assert "sites" not in state["sidecar_indexes"]

    monkeypatch.setattr(builder, "_write_arrow_table_atomic", original_write)
    monkeypatch.setattr(
        builder,
        "_build_node_rows",
        lambda _ts: (_ for _ in ()).throw(
            AssertionError("completed nodes sidecar was rebuilt")
        ),
    )
    result = builder.build_csr_artifact(source, target_shard_mb=1)
    assert result["manifest"]["capabilities"]["details"] is True
    assert not staging.exists()


def test_standalone_script_uses_colocated_output_and_verify(tmp_path):
    source = tmp_path / "script.trees"
    _recombining_tree_sequence(source)
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
    assert Path(result["artifact_dir"]) == Path(f"{source}.artifact")


def test_standalone_script_accepts_worker_range_options(tmp_path):
    source = tmp_path / "script-workers.trees"
    _recombining_tree_sequence(source)
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
            "--target-shard-mb",
            "1",
            "--workers",
            "2",
            "--trees-per-range",
            "1",
            "--skip-node-tree-ranges",
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    result = json.loads(completed.stdout.strip().splitlines()[-1])
    manifest = json.loads(
        (Path(result["artifact_dir"]) / "manifest.json").read_text()
    )
    assert manifest["build"]["worker_counts_requested"] == [2]
    assert manifest["build"]["worker_counts_used"] == [1]
    assert manifest["build"]["trees_per_range"] == 1
    assert manifest["build"]["skip_node_tree_ranges"] is True
    assert manifest["capabilities"]["node_tree_ranges"] is False
    assert "node_tree_ranges" not in manifest["indexes"]


@pytest.mark.parametrize(
    ("option", "value"),
    [("--workers", "0"), ("--trees-per-range", "0")],
)
def test_standalone_script_rejects_nonpositive_parallel_options(
    tmp_path,
    option,
    value,
):
    source = tmp_path / f"invalid-{option[2:]}.trees"
    _recombining_tree_sequence(source)
    script = (
        Path(__file__).parents[2]
        / "scripts"
        / "preprocess_treesequence_csr.py"
    )

    completed = subprocess.run(
        [sys.executable, str(script), str(source), option, value],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 2
    assert "value must be at least 1" in completed.stderr


def test_standalone_script_rejects_removed_output_dir_option(tmp_path):
    source = tmp_path / "script-output-option.trees"
    _recombining_tree_sequence(source)
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
            str(tmp_path / "elsewhere"),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 2
    assert "unrecognized arguments: --output-dir" in completed.stderr


def _metadata_tree_sequence(path: Path) -> tskit.TreeSequence:
    tables = tskit.TableCollection(sequence_length=12)
    tables.nodes.metadata_schema = tskit.MetadataSchema.permissive_json()
    tables.individuals.metadata_schema = tskit.MetadataSchema.permissive_json()
    tables.populations.metadata_schema = tskit.MetadataSchema.permissive_json()
    population = tables.populations.add_row(metadata={"region": "north"})
    individual = tables.individuals.add_row(
        location=[1.5, 2.5],
        metadata={"group": "A"},
    )
    sample_a = tables.nodes.add_row(
        flags=tskit.NODE_IS_SAMPLE,
        time=0,
        population=population,
        individual=individual,
        metadata={"name": "alpha", "color": "red", "group": "B"},
    )
    sample_b = tables.nodes.add_row(
        flags=tskit.NODE_IS_SAMPLE,
        time=0,
        population=population,
        metadata={"name": "beta", "color": "blue"},
    )
    root = tables.nodes.add_row(time=2)
    tables.edges.add_row(0, 12, root, sample_a)
    tables.edges.add_row(0, 12, root, sample_b)
    site = tables.sites.add_row(5, ancestral_state="A")
    tables.mutations.add_row(
        site=site,
        node=sample_a,
        derived_state="G",
        time=0.5,
    )
    tables.sort()
    tree_sequence = tables.tree_sequence()
    tree_sequence.dump(path)
    return tree_sequence


def _split_frontend_buffer(buffer):
    import struct

    node_size = struct.unpack("<I", buffer[:4])[0]
    nodes = pa.ipc.open_stream(pa.BufferReader(buffer[4 : 4 + node_size])).read_all()
    mutations = pa.ipc.open_stream(
        pa.BufferReader(buffer[4 + node_size :])
    ).read_all()
    return nodes, mutations


def _assert_arrow_tables_equal_with_nan(observed, expected):
    assert observed.schema == expected.schema
    assert observed.num_rows == expected.num_rows
    for field in expected.schema:
        observed_values = observed[field.name].to_numpy(zero_copy_only=False)
        expected_values = expected[field.name].to_numpy(zero_copy_only=False)
        if pa.types.is_floating(field.type):
            np.testing.assert_allclose(
                observed_values,
                expected_values,
                rtol=0,
                atol=0,
                equal_nan=True,
            )
        else:
            assert observed[field.name].to_pylist() == expected[field.name].to_pylist()


def test_v3_config_sidecars_and_feature_indexes_are_source_free(tmp_path):
    from lorax.artifacts import CSRArtifactReader

    source = tmp_path / "metadata.trees"
    tree_sequence = _metadata_tree_sequence(source)
    result = _build(source)
    artifact = Path(result["artifact_dir"])
    manifest = result["manifest"]

    assert manifest["format"] == "lorax-csr-v3"
    assert manifest["schema_version"] == 3
    assert manifest["capabilities"]["metadata"] is True
    for name in (
        "config",
        "nodes",
        "sites",
        "individuals",
        "populations",
        "mutations",
        "mutation_positions",
        "node_mutation_offsets",
        "node_mutation_ids",
        "metadata_samples",
        "sample_names",
        "node_tree_ranges",
    ):
        assert name in manifest["indexes"]

    source.unlink()
    with (
        patch("tskit.load", side_effect=AssertionError("source reopened")),
        patch("tszip.load", side_effect=AssertionError("source reopened")),
        CSRArtifactReader.open(artifact) as reader,
    ):
        config = reader.frontend_config(filename="selected.trees", project="P")
        assert config["intervals"] is None
        assert config["interval_source"] == "backend"
        assert config["num_trees"] == tree_sequence.num_trees
        assert config["filename"] == "selected.trees"
        assert reader.node_details(0)["metadata"]["name"] == "alpha"
        assert reader.individual_details(0)["nodes"] == [0]
        assert reader.population_details(0)["metadata"]["region"] == "north"
        assert reader.mutations_for_node(0)[0]["derived_state"] == "G"
        mutation_window = reader.mutations_in_range(0, 12)
        assert mutation_window["mutations"][0]["tree_index"] == 0
        assert mutation_window["mutations"][0]["interval_left"] == 0
        assert mutation_window["mutations"][0]["interval_right"] == 12
        assert reader.metadata_samples("group", "A")["sample_node_ids"] == [0]
        assert reader.metadata_samples("group", "B")["sample_node_ids"] == []
        assert reader.search_samples("alp") == [{"node_id": 0, "name": "alpha"}]
        assert reader.tree_ranges_for_node(0) == [(0, 1)]
        assert reader.intervals_in_range(0, 12, 1)["last_tree_exclusive"] == 1
        assert config["num_breakpoints"] == tree_sequence.num_trees + 1

        metadata_schema = reader._sidecar_reader("metadata_samples").schema
        assert pa.types.is_dictionary(metadata_schema.field("source").type)
        node_row = reader._row_at("nodes", 0)
        node_table = tree_sequence.tables.nodes
        raw_start = int(node_table.metadata_offset[0])
        raw_stop = int(node_table.metadata_offset[1])
        assert node_row["metadata_raw"] == bytes(
            np.asarray(node_table.metadata[raw_start:raw_stop], dtype=np.int8)
        )


def test_v3_without_node_tree_ranges_keeps_other_features_source_free(tmp_path):
    from lorax.artifacts import (
        CSRArtifactCapabilityError,
        CSRArtifactReader,
    )

    source = tmp_path / "metadata-without-node-ranges.trees"
    tree_sequence = _metadata_tree_sequence(source)
    result = _build(source, skip_node_tree_ranges=True)
    artifact = Path(result["artifact_dir"])
    manifest = result["manifest"]
    stored_config = json.loads((artifact / "config.json").read_text())

    assert manifest["capabilities"]["node_tree_ranges"] is False
    assert manifest["build"]["skip_node_tree_ranges"] is True
    assert stored_config["artifact_capabilities"]["node_tree_ranges"] is False
    for key, name in (
        ("node_tree_ranges", "node-tree-ranges.arrow"),
        ("node_tree_range_offsets", "node-tree-range-offsets.npy"),
    ):
        assert key not in manifest["indexes"]
        assert not (artifact / name).exists()
    for capability in (
        "render",
        "intervals",
        "details",
        "mutations",
        "metadata",
        "sample_search",
        "lineage",
        "topology_comparison",
    ):
        assert manifest["capabilities"][capability] is True

    source.unlink()
    with (
        patch("tskit.load", side_effect=AssertionError("source reopened")),
        patch("tszip.load", side_effect=AssertionError("source reopened")),
        CSRArtifactReader.open(artifact) as reader,
    ):
        assert reader.verify()["ok"] is True
        assert reader.tree_at_index(0).tree_index == 0
        assert reader.intervals_in_range(0, 12, 1)["first_tree"] == 0
        assert reader.node_details(0)["metadata"]["name"] == "alpha"
        assert reader.mutations_for_node(0)[0]["derived_state"] == "G"
        assert reader.metadata_samples("group", "A")["sample_node_ids"] == [0]
        assert reader.search_samples("alp") == [{"node_id": 0, "name": "alpha"}]
        config = reader.frontend_config()
        assert config["artifact_capabilities"]["node_tree_ranges"] is False
        assert config["num_trees"] == tree_sequence.num_trees

        with pytest.raises(
            CSRArtifactCapabilityError,
            match="without --skip-node-tree-ranges",
        ) as error:
            reader.tree_ranges_for_node(0)
        assert error.value.code == "CSR_REBUILD_REQUIRED"


def test_existing_artifact_node_tree_range_compatibility(tmp_path):
    from lorax.artifacts import CSRArtifactBuildError, build_csr_artifact

    complete_source = tmp_path / "complete-v3.trees"
    _recombining_tree_sequence(complete_source)
    complete = _build(complete_source)
    reused = build_csr_artifact(
        complete_source,
        target_shard_mb=1,
        skip_node_tree_ranges=True,
    )
    assert reused["artifact_dir"] == complete["artifact_dir"]
    assert reused["manifest"]["capabilities"]["node_tree_ranges"] is True

    partial_source = tmp_path / "partial-v3.trees"
    _recombining_tree_sequence(partial_source)
    partial = _build(partial_source, skip_node_tree_ranges=True)
    with pytest.raises(
        CSRArtifactBuildError,
        match="lacks the node-tree range index.*--force",
    ):
        _build(partial_source)

    rebuilt = _build(partial_source, force=True)
    assert rebuilt["artifact_dir"] == partial["artifact_dir"]
    assert rebuilt["manifest"]["capabilities"]["node_tree_ranges"] is True


def test_v2_remains_renderable_but_rejects_v3_capabilities(tmp_path):
    from lorax.artifacts import (
        CSRArtifactCapabilityError,
        CSRArtifactReader,
        build_csr_artifact,
    )

    source = tmp_path / "legacy.trees"
    _recombining_tree_sequence(source)
    result = build_csr_artifact(
        source,
        target_shard_mb=1,
        format_version=2,
    )
    source.unlink()
    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        assert reader.format == "lorax-csr-v2"
        assert reader.tree_at_index(0).tree_index == 0
        assert reader.frontend_config()["interval_source"] == "backend"
        with pytest.raises(CSRArtifactCapabilityError) as error:
            reader.node_details(0)
        assert error.value.code == "CSR_REBUILD_REQUIRED"


def test_v3_manifest_cannot_claim_an_incomplete_feature_set(tmp_path):
    from lorax.artifacts import CSRArtifactCorruptError, CSRArtifactReader

    source = tmp_path / "incomplete-v3.trees"
    _recombining_tree_sequence(source)
    result = _build(source)
    artifact = Path(result["artifact_dir"])
    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["capabilities"]["metadata"] = False
    manifest_path.write_text(json.dumps(manifest))

    with pytest.raises(CSRArtifactCorruptError, match="metadata"):
        CSRArtifactReader.open(artifact)


def test_v3_node_tree_range_capability_must_match_its_indexes(tmp_path):
    from lorax.artifacts import CSRArtifactCorruptError, CSRArtifactReader

    skipped_source = tmp_path / "missing-node-ranges.trees"
    _recombining_tree_sequence(skipped_source)
    skipped = _build(skipped_source, skip_node_tree_ranges=True)
    skipped_manifest_path = Path(skipped["artifact_dir"]) / "manifest.json"
    skipped_manifest = json.loads(skipped_manifest_path.read_text())
    skipped_manifest["capabilities"]["node_tree_ranges"] = True
    skipped_manifest_path.write_text(json.dumps(skipped_manifest))
    with pytest.raises(
        CSRArtifactCorruptError,
        match="node_tree_ranges.*missing indexes",
    ):
        CSRArtifactReader.open(skipped["artifact_dir"])

    complete_source = tmp_path / "unexpected-node-ranges.trees"
    _recombining_tree_sequence(complete_source)
    complete = _build(complete_source)
    complete_manifest_path = Path(complete["artifact_dir"]) / "manifest.json"
    complete_manifest = json.loads(complete_manifest_path.read_text())
    complete_manifest["capabilities"]["node_tree_ranges"] = False
    complete_manifest_path.write_text(json.dumps(complete_manifest))
    with pytest.raises(
        CSRArtifactCorruptError,
        match="Disabled capability 'node_tree_ranges' publishes indexes",
    ):
        CSRArtifactReader.open(complete["artifact_dir"])


@pytest.mark.parametrize("sparsification", [False, True])
@pytest.mark.parametrize("time_scale", ["linear", "log"])
def test_csr_frontend_serializer_matches_legacy_contract(
    tmp_path,
    sparsification,
    time_scale,
):
    from lorax.artifacts import CSRArtifactReader
    from lorax.artifacts.render import serialize_csr_genealogies
    from lorax.tree_graph import construct_trees_batch

    source = tmp_path / "render.trees"
    tree_sequence = _recombining_tree_sequence(source)
    result = _build(source)

    legacy_buffer, min_time, max_time, indices, _graphs = construct_trees_batch(
        tree_sequence,
        [0, 1],
        sparsification=sparsification,
        sparsify_mutations=sparsification,
        time_scale=time_scale,
    )
    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        artifact_result = serialize_csr_genealogies(
            reader.trees_at_indices([0, 1]),
            global_min_time=reader.global_min_time,
            global_max_time=reader.global_max_time,
            sparsification=sparsification,
            time_scale=time_scale,
        )

    legacy_nodes, legacy_mutations = _split_frontend_buffer(legacy_buffer)
    csr_nodes, csr_mutations = _split_frontend_buffer(artifact_result["buffer"])
    assert csr_nodes.equals(legacy_nodes)
    _assert_arrow_tables_equal_with_nan(csr_mutations, legacy_mutations)
    assert artifact_result["global_min_time"] == min_time
    assert artifact_result["global_max_time"] == max_time
    assert artifact_result["tree_indices"] == indices


def test_resolver_and_context_registry_open_adjacent_artifact(tmp_path):
    from lorax.artifacts.runtime import ArtifactContextRegistry, ArtifactResolver

    source = tmp_path / "resolver.trees"
    _recombining_tree_sequence(source)
    result = _build(source)

    resolver = ArtifactResolver()
    resolved = resolver.resolve(source)
    assert resolved is not None
    registry = ArtifactContextRegistry(max_contexts=1, max_open_shards=1)
    first = registry.open(resolved)
    second = registry.open(resolved)
    assert first is second
    assert first.reader.tree_at_index(1).tree_index == 1
    registry.close()


def test_resolver_ignores_old_fingerprint_addressed_artifact(tmp_path):
    from lorax.artifacts.runtime import ArtifactResolver

    source = tmp_path / "old-layout.trees"
    _recombining_tree_sequence(source)
    built = _build(source)
    artifact = Path(built["artifact_dir"])
    old_destination = (
        tmp_path / "cache" / "artifacts" / "v3" / built["fingerprint"]
    )
    old_destination.parent.mkdir(parents=True)
    artifact.rename(old_destination)

    assert ArtifactResolver().resolve(source) is None


def test_resolver_rejects_stale_and_corrupt_adjacent_manifests(tmp_path):
    from lorax.artifacts.runtime import ArtifactResolver

    stale_source = tmp_path / "stale.trees"
    _recombining_tree_sequence(stale_source)
    _build(stale_source)
    stale_source.write_bytes(stale_source.read_bytes() + b"changed")
    assert ArtifactResolver().resolve(stale_source) is None

    corrupt_source = tmp_path / "corrupt-manifest.trees"
    _recombining_tree_sequence(corrupt_source)
    corrupt = _build(corrupt_source)
    manifest_path = Path(corrupt["artifact_dir"]) / "manifest.json"
    manifest_path.write_text("{not-json")
    assert ArtifactResolver().resolve(corrupt_source) is None


def test_contexts_and_unhealthy_state_are_keyed_by_artifact_path(tmp_path):
    from lorax.artifacts.runtime import ArtifactContextRegistry, ArtifactResolver

    source_a = tmp_path / "copy-a.trees"
    source_b = tmp_path / "copy-b.trees"
    _recombining_tree_sequence(source_a)
    source_b.write_bytes(source_a.read_bytes())
    built_a = _build(source_a)
    built_b = _build(source_b)
    assert built_a["fingerprint"] == built_b["fingerprint"]

    resolver = ArtifactResolver()
    resolved_a = resolver.resolve(source_a)
    resolved_b = resolver.resolve(source_b)
    assert resolved_a is not None
    assert resolved_b is not None
    registry = ArtifactContextRegistry(max_contexts=2)
    context_a = registry.open(resolved_a)
    context_b = registry.open(resolved_b)
    assert context_a is not context_b
    assert registry.snapshot()["contexts"] == 2

    resolver.mark_unhealthy(resolved_a.artifact_directory)
    assert resolver.resolve(source_a) is None
    assert resolver.resolve(source_b) is not None
    registry.close()


def test_reusing_content_hash_refreshes_manifest_source_timestamp(tmp_path):
    from lorax.artifacts.runtime import ArtifactResolver

    source = tmp_path / "retouched.trees"
    _recombining_tree_sequence(source)
    first = _build(source)
    source_stat = source.stat()
    os.utime(
        source,
        ns=(source_stat.st_atime_ns, source_stat.st_mtime_ns + 1_000_000_000),
    )

    assert ArtifactResolver().resolve(source) is None
    reused = _build(source)
    assert reused["artifact_dir"] == first["artifact_dir"]
    assert ArtifactResolver().resolve(source) is not None


@pytest.mark.asyncio
async def test_v3_details_adapter_matches_legacy_response(tmp_path):
    from lorax.artifacts import CSRArtifactReader
    from lorax.artifacts.features import artifact_details
    from lorax.handlers import handle_details

    source = tmp_path / "details.trees"
    _metadata_tree_sequence(source)
    result = _build(source)

    for request in (
        {"treeIndex": 0, "node": 0},
        {"treeIndex": 0, "node": 0, "comprehensive": True},
    ):
        expected = json.loads(await handle_details(str(source), request))
        with CSRArtifactReader.open(result["artifact_dir"]) as reader:
            observed = artifact_details(reader, request)
        assert observed == expected


def test_backend_local_data_uses_compact_viewport_slice(tmp_path):
    from lorax.artifacts import CSRArtifactReader
    from lorax.sockets.intervals import _query_local_data

    source = tmp_path / "local-data.trees"
    _recombining_tree_sequence(source)
    result = _build(source)

    with CSRArtifactReader.open(result["artifact_dir"]) as reader:
        interval_result = reader.intervals_in_range(0, 20, 10)
        result = _query_local_data(
            reader,
            {
                "lo": interval_result["lo"],
                "hi": interval_result["hi"],
                "start": 0,
                "end": 20,
                "globalBpPerUnit": 20 / 3,
                "new_globalBp": 1,
                "displayOptions": {"selectionStrategy": "largestSpan"},
            },
        )

    assert result["showing_all_trees"] is True
    assert result["displayArray"] == [0, 1]
    assert [
        (row["s"], row["e"], row["global_index"])
        for row in result["local_bins"]
    ] == [(0.0, 10.0, 0), (10.0, 20.0, 1)]
