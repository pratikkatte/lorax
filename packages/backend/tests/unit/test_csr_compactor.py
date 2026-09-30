"""Lossless local artifact migration and interruption/deletion safety."""

import json
import os
from pathlib import Path

import pytest

from lorax.artifacts import csr_compactor as compactor
from lorax.artifacts.csr_reader import CSRArtifactCorruptError, CSRArtifactReader
from lorax.artifacts.render import serialize_csr_genealogies
from lorax.artifacts.runtime import ArtifactResolver
from tests.unit.test_csr_artifacts import _build, _many_tree_sequence, _metadata_tree_sequence


def _input(tmp_path, *, metadata=False):
    source = tmp_path / "example.trees"
    if metadata:
        _metadata_tree_sequence(source)
    else:
        _many_tree_sequence(source, num_trees=75, num_samples=600)
    result = _build(source, format_version=3, workers=2, trees_per_range=35)
    destination = Path(result["artifact_dir"])
    backup = destination.with_suffix(".artifact_bkp")
    destination.rename(backup)
    return source, backup, destination


@pytest.mark.parametrize("workers", [1, 2])
def test_compaction_preserves_source_fields_render_and_partial_shards(tmp_path, workers):
    source, backup, destination = _input(tmp_path)
    hashes = {p.name: compactor._checksum(p) for p in backup.iterdir()}
    # Discovery metadata may be stale even when the original content is intact.
    stat = source.stat()
    os.utime(source, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1000000))
    result = compactor.compact_csr_artifact(backup, destination, source_file=source, workers=workers)
    assert result["verification"]["ok"]
    assert not result["source_shards_removed"]
    assert hashes == {p.name: compactor._checksum(p) for p in backup.iterdir()}
    assert ArtifactResolver().resolve(source).artifact_format == "lorax-csr-v4"
    assert not (destination / "compaction-state.json").exists()
    with CSRArtifactReader(backup) as old, CSRArtifactReader(destination) as new:
        assert len(new._shards) == len(old._shards) >= 2
        assert any(s["batch_count"] > 1 for s in new._shards)
        assert any((s["last_tree_exclusive"] - s["first_tree"]) % 32 for s in new._shards)
        assert old.layout_order == new.layout_order
        assert old.capabilities == new.capabilities
        for index in [74, 35, 34, 32, 31, 0, 70, *range(75)]:
            a, b = old.tree_at_index(index), new.tree_at_index(index)
            compactor._equal_genealogies(a, b)
            assert serialize_csr_genealogies([a], global_min_time=old.global_min_time, global_max_time=old.global_max_time)["buffer"] == serialize_csr_genealogies([b], global_min_time=new.global_min_time, global_max_time=new.global_max_time)["buffer"]


@pytest.mark.parametrize("legacy_layout", [False, True])
def test_compaction_preserves_metadata_mutations_and_unknown_times(tmp_path, legacy_layout):
    source, backup, destination = _input(tmp_path, metadata=True)
    if legacy_layout:
        manifest_path = backup / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["build"].pop("layout_order")
        manifest_path.write_text(json.dumps(manifest))
    compactor.compact_csr_artifact(backup, destination, source_file=source)
    with CSRArtifactReader(backup) as old, CSRArtifactReader(destination) as new:
        for key, metadata in old.manifest["indexes"].items():
            if key not in {"config", "shards"}:
                assert metadata == new.manifest["indexes"][key]
        for index in range(old.num_trees):
            compactor._equal_genealogies(old.tree_at_index(index), new.tree_at_index(index))
        assert old.node_details(0) == new.node_details(0)


def test_compaction_resume_after_deleting_verified_shard(tmp_path):
    source, backup, destination = _input(tmp_path)
    original_source = source.read_bytes()

    def interrupt(event):
        if event["stage"] == "compacting":
            raise RuntimeError("simulated interruption")

    with pytest.raises(RuntimeError, match="interruption"):
        compactor.compact_csr_artifact(backup, destination, source_file=source,
                                      remove_verified_source_shards=True, progress=interrupt)
    assert not destination.exists()
    staging = destination.with_name(f".{destination.name}.compacting")
    checkpoint = json.loads((staging / "compaction-state.json").read_text())
    assert len(checkpoint["completed"]) == 1
    first = next(iter(checkpoint["completed"]))
    assert not (backup / first).exists()
    before = (staging / first).stat().st_mtime_ns
    result = compactor.compact_csr_artifact(backup, destination, source_file=source,
                                          remove_verified_source_shards=True)
    assert result["verification"]["ok"]
    assert result["source_shards_removed"]
    assert source.read_bytes() == original_source
    assert (destination / first).stat().st_mtime_ns == before
    assert not list(backup.glob("csr-*.arrow"))
    assert (backup / "nodes.arrow").is_file()


def test_corrupt_input_never_deleted_and_no_artifact_published(tmp_path):
    source, backup, destination = _input(tmp_path)
    originals = list(backup.glob("csr-*.arrow"))
    first = sorted(backup.glob("csr-*.arrow"))[0]
    first.write_bytes(b"corrupt")
    with pytest.raises(CSRArtifactCorruptError, match="Checksum"):
        compactor.compact_csr_artifact(backup, destination, source_file=source,
                                      remove_verified_source_shards=True)
    assert first.read_bytes() == b"corrupt"
    assert all(p.is_file() for p in originals)


def test_insufficient_space_preserves_originals_and_checkpoint(tmp_path, monkeypatch):
    source, backup, destination = _input(tmp_path)
    originals = list(backup.glob("csr-*.arrow"))
    usage = compactor.shutil.disk_usage(tmp_path)
    monkeypatch.setattr(compactor.shutil, "disk_usage", lambda path: usage._replace(free=1))
    with pytest.raises(OSError, match="Insufficient staging space"):
        compactor.compact_csr_artifact(backup, destination, source_file=source,
                                      remove_verified_source_shards=True)
    assert all(p.is_file() for p in originals)
    assert not destination.exists()
    assert not destination.exists()


def test_corrupt_checkpoint_output_never_deletes_original(tmp_path):
    source, backup, destination = _input(tmp_path)
    originals = list(backup.glob("csr-*.arrow"))

    def interrupt(event):
        if event["stage"] == "compacting":
            raise RuntimeError("simulated interruption")

    with pytest.raises(RuntimeError):
        compactor.compact_csr_artifact(backup, destination, source_file=source, progress=interrupt)
    staging = destination.with_name(f".{destination.name}.compacting")
    first = sorted(staging.glob("csr-*.arrow"))[0]
    first.write_bytes(b"corrupt")
    with pytest.raises(CSRArtifactCorruptError, match="Checksum"):
        compactor.compact_csr_artifact(backup, destination, source_file=source,
                                      remove_verified_source_shards=True)
    assert all(p.is_file() for p in originals)
    assert not destination.exists()


def test_compaction_rejects_wrong_source_and_destination_overlap(tmp_path):
    source, backup, destination = _input(tmp_path)
    originals = list(backup.glob("csr-*.arrow"))
    with pytest.raises(ValueError, match="separate"):
        compactor.compact_csr_artifact(backup, backup)
    with pytest.raises(ValueError, match="requires source_file"):
        compactor.compact_csr_artifact(backup, destination, remove_verified_source_shards=True)
    source.write_bytes(b"wrong source")
    with pytest.raises(CSRArtifactCorruptError, match="fingerprint"):
        compactor.compact_csr_artifact(backup, destination, source_file=source,
                                      remove_verified_source_shards=True)
    assert all(p.is_file() for p in originals)


def test_feature_corruption_prevents_any_removal(tmp_path):
    source, backup, destination = _input(tmp_path)
    originals = list(backup.glob("csr-*.arrow"))
    (backup / "nodes.arrow").write_bytes(b"corrupt")
    with pytest.raises(CSRArtifactCorruptError, match="Checksum"):
        compactor.compact_csr_artifact(backup, destination, source_file=source,
                                      remove_verified_source_shards=True)
    assert all(p.is_file() for p in originals)
