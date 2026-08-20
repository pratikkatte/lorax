import gzip
import json
import struct

import numpy as np
import pyarrow as pa
import pytest


def _genealogy(newick: str):
    from lorax.artifacts.csr_reader import _decode_genealogy
    from scripts.build_phlag_newick_csr import _newick_source_record_batch

    batch, _height, _nodes, _edges = _newick_source_record_batch(
        newick,
        tree_index=0,
        interval_left=10,
        interval_right=20,
        sample_ids={},
    )
    return _decode_genealogy(batch)


def _tip_distances_from_root(genealogy) -> dict[int, float]:
    root = int(genealogy.roots()[0])
    root_height = genealogy.node_time(root)
    return {
        int(node_id): root_height - genealogy.node_time(int(node_id))
        for node_id in genealogy.node_ids
        if genealogy.is_tip(int(node_id))
    }


def _tip_pair_distances(genealogy) -> dict[tuple[int, int], float]:
    adjacency = {int(node_id): [] for node_id in genealogy.node_ids}
    for node_id, parent_id in zip(genealogy.node_ids, genealogy.parent_ids):
        if int(parent_id) == -1:
            continue
        length = abs(
            genealogy.node_time(int(parent_id))
            - genealogy.node_time(int(node_id))
        )
        adjacency[int(parent_id)].append((int(node_id), length))
        adjacency[int(node_id)].append((int(parent_id), length))
    tips = sorted(
        int(node_id)
        for node_id in genealogy.node_ids
        if genealogy.is_tip(int(node_id))
    )
    result = {}
    for offset, start in enumerate(tips):
        distances = {start: 0.0}
        stack = [(start, -1)]
        while stack:
            node, parent = stack.pop()
            for neighbor, length in adjacency[node]:
                if neighbor == parent:
                    continue
                distances[neighbor] = distances[node] + length
                stack.append((neighbor, node))
        for end in tips[offset + 1 :]:
            result[(start, end)] = distances[end]
    return result


def test_minvar_places_root_at_exact_interior_point_and_preserves_distances():
    from lorax.artifacts.minvar import reroot_minvar

    source = _genealogy("(A:1,B:2,C:3);")
    rooted = reroot_minvar(source)

    assert rooted.interval_left == 10
    assert rooted.interval_right == 20
    assert rooted.roots().tolist() == [1_000_001]
    assert len(rooted.node_ids) == len(source.node_ids) + 1
    np.testing.assert_allclose(
        [_tip_distances_from_root(rooted)[node] for node in (0, 1, 2)],
        [1.75, 2.75, 2.25],
    )
    assert _tip_pair_distances(rooted) == pytest.approx(
        _tip_pair_distances(source)
    )
    assert rooted.layout_x.min() >= 0.0
    assert rooted.layout_x.max() <= 1.0


def test_minvar_reuses_existing_internal_node_when_it_is_optimal():
    from lorax.artifacts.minvar import reroot_minvar

    source = _genealogy("(A:1,B:1,C:1);")
    rooted = reroot_minvar(source)

    assert rooted.roots().tolist() == source.roots().tolist()
    assert len(rooted.node_ids) == len(source.node_ids)
    np.testing.assert_allclose(
        list(_tip_distances_from_root(rooted).values()),
        [1.0, 1.0, 1.0],
    )


def test_minvar_tie_is_deterministic_and_keeps_zero_length_tips():
    from lorax.artifacts.minvar import reroot_minvar

    source = _genealogy("(A:0,B:0,C:0);")
    first = reroot_minvar(source)
    second = reroot_minvar(source)

    np.testing.assert_array_equal(first.node_ids, second.node_ids)
    np.testing.assert_array_equal(first.parent_ids, second.parent_ids)
    np.testing.assert_array_equal(first.child_node_ids, second.child_node_ids)
    assert sum(first.is_tip(int(node)) for node in first.node_ids) == 3
    assert len(first.roots()) == 1


def test_minvar_rejects_multiple_roots():
    from dataclasses import replace

    from lorax.artifacts.minvar import MinVarRootingError, reroot_minvar

    source = _genealogy("(A:1,B:1,C:1);")
    parents = np.asarray(source.parent_ids, dtype=np.int32).copy()
    parents[0] = -1
    malformed = replace(source, parent_ids=parents)

    with pytest.raises(MinVarRootingError, match="one source root"):
        reroot_minvar(malformed)


def _build_phlag_artifact(
    tmp_path,
    trees: list[str],
    *,
    dataset_name: str = "avian",
):
    from scripts.build_phlag_newick_csr import build_chromosome

    trees_path = tmp_path / "trees.nwk.gz"
    positions_path = tmp_path / "positions.txt.gz"
    with gzip.open(trees_path, "wt", encoding="utf-8") as output:
        output.write("".join(f"{tree}\n" for tree in trees))
    with gzip.open(positions_path, "wt", encoding="utf-8") as output:
        output.write("".join(f"{index * 10}\n" for index in range(len(trees))))
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
        dataset_name=dataset_name,
    )
    return result["artifact_dir"]


@pytest.mark.parametrize("dataset_name", ["avian", "mammalian"])
def test_phlag_builder_stores_minvar_and_reader_only_decodes(
    tmp_path,
    dataset_name,
    monkeypatch,
):
    from lorax.artifacts.csr_reader import CSRArtifactReader
    from lorax.artifacts.features import artifact_details
    from lorax.artifacts.render import serialize_csr_genealogies
    import lorax.artifacts.minvar as minvar_module

    artifact = _build_phlag_artifact(
        tmp_path,
        ["(A:1,B:2,C:3);"],
        dataset_name=dataset_name,
    )
    manifest = json.loads(
        (tmp_path / "trees.nwk.gz.artifact" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert manifest["builder_version"] == "phlag-newick-csr-v2"
    assert manifest["build"]["rooting_method"] == "minvar"
    assert manifest["build"]["source_rooting"] == "arbitrary"

    def fail_if_runtime_rooting_occurs(*_args, **_kwargs):
        raise AssertionError("reader attempted runtime rerooting")

    monkeypatch.setattr(minvar_module, "reroot_minvar", fail_if_runtime_rooting_occurs)
    with CSRArtifactReader.open(artifact) as reader:
        assert reader.is_minvar_rooted is True
        assert reader.global_max_time == pytest.approx(
            manifest["dataset"]["global_max_time"]
        )
        assert reader.frontend_config()["tree_rooting"] == {
            "method": "minvar",
            "label": "MinVar rooted",
            "automatic": True,
            "stage": "preprocessing",
        }
        first = reader.tree_at_index(0)
        assert first.roots().tolist() == [1_000_001]
        assert len(first.node_ids) == 5
        np.testing.assert_allclose(
            [_tip_distances_from_root(first)[node] for node in (0, 1, 2)],
            [1.75, 2.75, 2.25],
        )

        root = int(first.roots()[0])
        details = artifact_details(
            reader,
            {"treeIndex": 0, "node": root},
        )
        assert details["node"]["time"] == first.node_time(root)
        assert float(np.max(first.node_times)) <= reader.global_max_time
        rendered = serialize_csr_genealogies(
            [first],
            global_min_time=reader.global_min_time,
            global_max_time=reader.global_max_time,
            sparsification=False,
        )
        node_byte_count = struct.unpack("<I", rendered["buffer"][:4])[0]
        nodes = pa.ipc.open_stream(
            rendered["buffer"][4 : 4 + node_byte_count]
        ).read_all()
        parent_by_node = dict(
            zip(nodes.column("node_id").to_pylist(), nodes.column("parent_id").to_pylist())
        )
        assert parent_by_node[root] == -1


def test_unmarked_v2_reader_does_not_advertise_or_transform(tmp_path):
    from lorax.artifacts.csr_reader import CSRArtifactReader

    artifact = _build_phlag_artifact(tmp_path, ["(A:1,B:2,C:3);"])
    with CSRArtifactReader.open(artifact) as reader:
        stored_node_ids = reader.tree_at_index(0).node_ids.copy()
        stored_parent_ids = reader.tree_at_index(0).parent_ids.copy()

    manifest_path = tmp_path / "trees.nwk.gz.artifact" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["dataset"].pop("phlag_dataset")
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with CSRArtifactReader.open(artifact) as reader:
        assert reader.is_minvar_rooted is False
        assert reader.global_max_time == manifest["dataset"]["global_max_time"]
        assert "tree_rooting" not in reader.frontend_config()
        genealogy = reader.tree_at_index(0)
        np.testing.assert_array_equal(genealogy.node_ids, stored_node_ids)
        np.testing.assert_array_equal(genealogy.parent_ids, stored_parent_ids)
