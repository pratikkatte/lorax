"""Compatibility, bounded caching, and network budgets for CSR artifacts."""

import dataclasses
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pyarrow as pa
import pytest

from lorax.artifacts import csr_builder as builder
from lorax.artifacts.csr_reader import CSRArtifactCorruptError, CSRArtifactReader, _decode_genealogy
from lorax.artifacts.metrics import csr_artifact_metrics
from lorax.artifacts.runtime import ArtifactContextRegistry, ArtifactResolver, is_artifact_session
from lorax.artifacts.storage import GCSArtifactStore
from tests.unit.test_csr_artifacts import _build, _many_tree_sequence, _metadata_tree_sequence


class FakeCloud:
    """Model GCS generations and actual byte ranges rather than BlobReader."""

    def __init__(self, objects):
        self.latest = {}
        self.versions = {}
        self.calls = []
        for name, data in objects.items():
            self.publish(name, data)

    def publish(self, name, data):
        generation = self.latest.get(name, 0) + 1
        self.latest[name] = generation
        self.versions[name, generation] = data

    def bucket(self, name):
        return self

    def blob(self, name):
        cloud = self

        class Blob:
            generation = None
            size = None

            def data(self):
                if name not in cloud.latest:
                    raise FileNotFoundError(name)
                if self.generation is None:
                    self.generation = cloud.latest[name]
                return cloud.versions[name, self.generation]

            def reload(self):
                cloud.calls.append(("metadata", name, None, None))
                self.size = len(self.data())

            def download_as_bytes(self, start=None, end=None, **kwargs):
                cloud.calls.append(("download", name, start, end))
                data = self.data()
                self.size = len(data)
                return data[start or 0:None if end is None else end + 1]

        return Blob()


def _cloud_artifact(tmp_path, monkeypatch, format_version=4):
    source = tmp_path / "cloud.trees"
    _metadata_tree_sequence(source)
    result = _build(source, format_version=format_version)
    path = Path(result["artifact_dir"])
    prefix = "Example/cloud.trees.artifact"
    cloud = FakeCloud({f"{prefix}/{p.name}": p.read_bytes() for p in path.iterdir() if p.is_file()})
    monkeypatch.setattr("lorax.cloud.gcs_utils.get_anonymous_gcs_client", lambda: cloud)
    return cloud, f"gs://bucket/{prefix}", result


def _assert_genealogy_equal(a, b):
    for field in dataclasses.fields(a):
        left, right = getattr(a, field.name), getattr(b, field.name)
        if isinstance(left, np.ndarray):
            np.testing.assert_array_equal(left, right)
        elif dataclasses.is_dataclass(left):
            _assert_genealogy_equal(left, right)
        else:
            assert left == right


@pytest.mark.parametrize("workers", [1, 2])
def test_v4_random_access_shards_partial_groups_and_lineage(tmp_path, workers):
    source = tmp_path / "many.trees"
    ts = _many_tree_sequence(source, num_trees=137, num_samples=400)
    result = _build(source, format_version=4, workers=workers, trees_per_range=37)
    with CSRArtifactReader(result["artifact_dir"], max_open_shards=1) as reader:
        assert reader.format == "lorax-csr-v4"
        assert reader.frontend_config()["artifact_format"] == reader.format
        assert reader.trees_per_batch == 32
        assert len(reader._shards) > 1
        assert any((s["last_tree_exclusive"] - s["first_tree"]) % 32 for s in reader._shards)
        order = [136, 0, 31, 32, 33, 63, 64, 0] + list(np.random.default_rng(42).permutation(137))
        for actual, index in zip(reader.trees_at_indices(order), order):
            tree = ts.at_index(index)
            expected = _decode_genealogy(builder.genealogy_record_batch(tree, ts))
            _assert_genealogy_equal(actual, expected)
            assert actual.ancestors(0) == [0, tree.parent(0)]
            assert set(actual.descendants(tree.root)) == set(tree.nodes())
        assert reader.verify()["ok"]
        assert is_artifact_session(SimpleNamespace(dataset_backend="csr-v4"))


def test_v4_batch_cache_budget_eviction_and_no_repeat_decode(tmp_path):
    source = tmp_path / "cache.trees"
    _many_tree_sequence(source, num_trees=97, num_samples=100)
    result = _build(source, format_version=4)
    with CSRArtifactReader(result["artifact_dir"]) as reader:
        reader.tree_at_index(0)
        first_size = reader._batch_cache_bytes
        reader.max_batch_cache_bytes = first_size
        csr_artifact_metrics.reset()
        reader.tree_at_index(31)
        assert csr_artifact_metrics.snapshot()["counters"]["batch_cache.hit"] == 1
        reader.tree_at_index(32)
        assert reader._batch_cache_bytes <= first_size
        assert (0, 0) not in reader._batch_cache
        assert reader.tree_at_index(0).tree_index == 0
        assert reader._batch_cache_bytes <= first_size
    with CSRArtifactReader(result["artifact_dir"], max_batch_cache_bytes=0) as reader:
        assert reader.tree_at_index(32).tree_index == 32
        assert not reader._batch_cache


@pytest.mark.parametrize("version", [2, 3, 4])
def test_cloud_startup_reads_each_index_once_and_defers_features(tmp_path, monkeypatch, version):
    cloud, location, result = _cloud_artifact(tmp_path, monkeypatch, version)
    csr_artifact_metrics.reset()
    with CSRArtifactReader(location) as reader:
        assert len(cloud.calls) == (3 if version == 2 else 4)
        assert all(call[0] == "download" for call in cloud.calls)
        names = [c[1].rsplit("/", 1)[-1] for c in cloud.calls]
        assert len(names) == len(set(names))
        assert "nodes.arrow" not in names
        expected_bytes = sum(len(cloud.versions[name, cloud.latest[name]]) for _, name, _, _ in cloud.calls)
        assert csr_artifact_metrics.snapshot()["counters"]["storage.transferred_bytes"] == expected_bytes
        reader.tree_at_index(0)
        cloud.calls.clear()
        reader.tree_at_index(0)
        assert not cloud.calls
        if version >= 3:
            assert reader.node_details(0)["metadata"]["name"] == "alpha"
            assert any(c[1].endswith("nodes.arrow") for c in cloud.calls)


def test_resolver_reuses_downloaded_manifest(tmp_path, monkeypatch):
    cloud, location, _ = _cloud_artifact(tmp_path, monkeypatch)
    resolved = ArtifactResolver().resolve_gcs("bucket", "Example/cloud.trees")
    assert resolved is not None
    registry = ArtifactContextRegistry()
    context = registry.open(resolved)
    assert sum(c[1].endswith("manifest.json") for c in cloud.calls) == 1
    cloud.calls.clear()
    assert registry.open_path(location, expected_fingerprint=context.fingerprint) is context
    assert not cloud.calls
    registry.close()


def test_context_ttl_generation_change_same_source_and_fingerprint_mismatch(tmp_path, monkeypatch):
    cloud, location, _ = _cloud_artifact(tmp_path, monkeypatch)
    registry = ArtifactContextRegistry()
    first = registry.open_path(location)
    cloud.calls.clear()
    assert registry.open_path(location) is first
    assert not cloud.calls
    first.validated_at -= 61
    assert registry.open_path(location) is first
    assert len(cloud.calls) == 1  # unchanged generation: manifest only
    name = "Example/cloud.trees.artifact/manifest.json"
    cloud.publish(name, cloud.versions[name, cloud.latest[name]])  # identical source and content, new generation
    first.validated_at -= 61
    second = registry.open_path(location)
    assert second is not first
    assert first.reader._closed
    assert second.fingerprint == first.fingerprint
    with pytest.raises(CSRArtifactCorruptError, match="fingerprint"):
        registry.open_path(location, expected_fingerprint="wrong")
    payload = dict(second.reader.manifest, fingerprint="new-source")
    cloud.publish(name, json.dumps(payload).encode())
    second.validated_at -= 61
    with pytest.raises(CSRArtifactCorruptError, match="fingerprint"):
        registry.open_path(location, expected_fingerprint=second.fingerprint)
    assert second.reader._closed
    assert registry.snapshot()["contexts"] == 0


def test_cloud_lazy_missing_sidecar_and_full_verify(tmp_path, monkeypatch):
    cloud, location, _ = _cloud_artifact(tmp_path, monkeypatch)
    del cloud.latest["Example/cloud.trees.artifact/nodes.arrow"]
    with CSRArtifactReader(location) as reader:
        assert reader.tree_at_index(0).tree_index == 0
        with pytest.raises(CSRArtifactCorruptError, match="Missing"):
            reader.node_details(0)
        with pytest.raises(CSRArtifactCorruptError, match="Missing"):
            reader.verify()


def test_range_cache_backward_seek_bounds_generation_and_eviction():
    page = 256 * 1024
    data = bytes(range(256)) * 4096
    cloud = FakeCloud({"artifact/shard": data})
    store = GCSArtifactStore("gs://bucket/artifact", client=cloud, max_cache_bytes=page * 2)
    with store.open_binary("shard") as stream:
        assert stream.read(100) == data[:100]
        initial = len(cloud.calls)
        stream.seek(50)
        assert stream.read(10) == data[50:60]
        assert len(cloud.calls) == initial
        stream.seek(page - 10)
        assert stream.read(20) == data[page - 10:page + 10]
        assert store._range_bytes == page * 2
        cloud.publish("artifact/shard", b"x" * len(data))
        stream.seek(page * 2)
        assert stream.read(20) == data[page * 2:page * 2 + 20]  # pinned old generation
        assert store._range_bytes == page * 2
        assert ("shard", 0) not in store._ranges
        stream.seek(0)
        assert stream.read(10) == data[:10]
        stream.seek(-5, io.SEEK_END)
        assert stream.read(20) == data[-5:]
        assert stream.read(1) == b""
        stream.seek(10, io.SEEK_END)
        assert stream.read() == b""
    with pytest.raises(ValueError):
        stream.read(1)
    store.close()
    assert store._range_bytes == 0


def test_v4_resume_rejects_changed_format_and_preserves_finished_shards(tmp_path, monkeypatch):
    source = tmp_path / "resume.trees"
    _many_tree_sequence(source, num_trees=137, num_samples=400)
    original = builder._write_shard
    calls = 0

    def interrupted(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("interrupted")
        return original(*args, **kwargs)

    monkeypatch.setattr(builder, "_write_shard", interrupted)
    with pytest.raises(RuntimeError, match="interrupted"):
        _build(source, format_version=4)
    staging = tmp_path / ".resume.trees.artifact.inprogress"
    first_hash = hashlib.sha256((staging / "csr-000000.arrow").read_bytes()).hexdigest()
    with pytest.raises(builder.CSRArtifactBuildError):
        _build(source, format_version=3)
    monkeypatch.setattr(builder, "_write_shard", original)
    result = _build(source, format_version=4, workers=2)
    assert hashlib.sha256((Path(result["artifact_dir"]) / "csr-000000.arrow").read_bytes()).hexdigest() == first_hash
    with CSRArtifactReader(result["artifact_dir"]) as reader:
        assert reader.verify()["ok"]


def test_v4_rejects_bad_group_size_and_wrong_row_count(tmp_path):
    source = tmp_path / "bad.trees"
    _many_tree_sequence(source, num_trees=65, num_samples=100)
    result = _build(source, format_version=4)
    artifact = Path(result["artifact_dir"])
    manifest = result["manifest"]
    manifest["build"]["trees_per_batch"] = 0
    (artifact / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(CSRArtifactCorruptError, match="trees_per_batch"):
        CSRArtifactReader(artifact)
    manifest["build"]["trees_per_batch"] = 32
    (artifact / "manifest.json").write_text(json.dumps(manifest))
    with CSRArtifactReader(artifact) as reader:
        shard = reader._shards[0]
        batch = reader._open_shard(0, shard).get_batch(0)
        with pytest.raises(CSRArtifactCorruptError, match="row count"):
            reader._validate_genealogy_batch(batch.slice(0, 31), 0, shard)
        with pytest.raises(CSRArtifactCorruptError, match="tree indexes"):
            reader._validate_genealogy_batch(batch, 1, shard)


def test_v4_cli_and_corrupt_batch_detected_through_public_reader(tmp_path):
    source = tmp_path / "cli.trees"
    _many_tree_sequence(source, num_trees=65, num_samples=100)
    script = Path(__file__).resolve().parents[2] / "scripts/preprocess_treesequence_csr.py"
    completed = subprocess.run(
        [sys.executable, str(script), str(source), "--format-version", "4", "--verify"],
        capture_output=True, text=True, check=True,
    )
    result = json.loads(completed.stdout)
    assert result["schema_version"] == 4
    assert result["verification"]["ok"]
    artifact = Path(result["artifact_dir"])
    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    with pa.ipc.open_file(str(artifact / "shards.arrow")) as index:
        shard_rows = index.read_all().to_pylist()
    shard = shard_rows[0]
    shard_path = artifact / shard["name"]
    ipc = pa.ipc.open_file(str(shard_path))
    batches = [ipc.get_batch(i) for i in range(ipc.num_record_batches)]
    # Keep the declared batch count, but remove a row from an interior batch.
    output = pa.BufferOutputStream()
    with pa.ipc.new_file(output, batches[0].schema) as writer:
        writer.write_batch(batches[0].slice(0, 31))
        for batch in batches[1:]:
            writer.write_batch(batch)
    data = output.getvalue().to_pybytes()
    shard_path.write_bytes(data)
    shard["size_bytes"] = len(data)
    shard["sha256"] = hashlib.sha256(data).hexdigest()
    builder._write_shard_index(artifact / "shards.arrow", shard_rows)
    index_data = (artifact / "shards.arrow").read_bytes()
    manifest["indexes"]["shards"].update(size_bytes=len(index_data), sha256=hashlib.sha256(index_data).hexdigest())
    manifest_path.write_text(json.dumps(manifest))
    with CSRArtifactReader(artifact) as reader:
        with pytest.raises(CSRArtifactCorruptError, match="row count"):
            reader.tree_at_index(0)
        with pytest.raises(CSRArtifactCorruptError, match="row count"):
            reader.verify()


def test_remote_startup_checks_hash_even_when_size_matches(tmp_path, monkeypatch):
    cloud, location, _ = _cloud_artifact(tmp_path, monkeypatch)
    name = "Example/cloud.trees.artifact/breakpoints.npy"
    original = cloud.versions[name, cloud.latest[name]]
    cloud.publish(name, original[:-1] + bytes([original[-1] ^ 1]))
    with pytest.raises(CSRArtifactCorruptError, match="Checksum"):
        CSRArtifactReader(location)


def test_large_range_read_coalesces_requests_without_exceeding_cache():
    page = 256 * 1024
    data = b"a" * (page * 8)
    cloud = FakeCloud({"artifact/shard": data})
    store = GCSArtifactStore("gs://bucket/artifact", client=cloud, max_cache_bytes=page)
    with store.open_binary("shard") as stream:
        assert stream.read(len(data)) == data
    assert len([c for c in cloud.calls if c[0] == "download"]) == 1
    assert store._range_bytes <= page
    store.close()


def test_local_feature_integrity_is_checked_on_first_use(tmp_path):
    source = tmp_path / "lazy.trees"
    _metadata_tree_sequence(source)
    result = _build(source, format_version=4)
    artifact = Path(result["artifact_dir"])
    (artifact / "nodes.arrow").write_bytes(b"corrupt")
    with CSRArtifactReader(artifact) as reader:
        assert reader.tree_at_index(0).tree_index == 0
        assert not reader.breakpoints.flags.writeable
        with pytest.raises(CSRArtifactCorruptError, match="Size mismatch"):
            reader.node_details(0)
        with pytest.raises(CSRArtifactCorruptError, match="Size mismatch"):
            reader.verify()
