import base64
import json
from pathlib import Path

import google_crc32c
import pytest
from google.api_core.exceptions import NotFound, PreconditionFailed

from lorax.artifacts.csr_reader import CSRArtifactReader
from lorax.artifacts.publisher import prepare_publication, publish_artifact
from tests.unit.test_csr_artifacts import _build, _many_tree_sequence


class Cloud:
    def __init__(self):
        self.name = "bucket"
        self.objects = {}
        self.generation = 0
        self.fail_upload = False

    def bucket(self, name):
        assert name == self.name
        return self

    def blob(self, name):
        return Blob(self, name)

    def get_blob(self, name):
        return self.blob(name) if name in self.objects else None

    def list_blobs(self, bucket, prefix):
        return [self.blob(name) for name in self.objects if name.startswith(prefix)]


class Blob:
    def __init__(self, cloud, name):
        self.cloud, self.name = cloud, name
        old = cloud.objects.get(name)
        self.generation = old[1] if old else None
        self.size = len(old[0]) if old else None
        self.metadata = dict(old[2]) if old else {}
        self.crc32c = base64.b64encode(google_crc32c.Checksum(old[0]).digest()).decode() if old else None

    def download_as_bytes(self, **kwargs):
        if self.name not in self.cloud.objects:
            raise NotFound(self.name)
        return self.cloud.objects[self.name][0]

    def upload_from_string(self, data, *, if_generation_match, **kwargs):
        if self.cloud.fail_upload and "/data/" in self.name:
            raise RuntimeError("interrupted upload")
        old = self.cloud.objects.get(self.name)
        if (old[1] if old else 0) != if_generation_match:
            raise PreconditionFailed(self.name)
        self.cloud.generation += 1
        self.generation = self.cloud.generation
        self.size = len(data)
        self.cloud.objects[self.name] = (data, self.generation, dict(self.metadata))

    def upload_from_filename(self, path, **kwargs):
        self.upload_from_string(Path(path).read_bytes(), **kwargs)

    def rewrite(self, source, *, token, if_source_generation_match, **kwargs):
        assert source.generation == if_source_generation_match
        data = source.download_as_bytes()
        self.upload_from_string(data, **kwargs)
        return None, len(data), len(data)

    def delete(self, *, if_generation_match):
        old = self.cloud.objects.get(self.name)
        if old is None:
            raise NotFound(self.name)
        if old[1] != if_generation_match:
            raise PreconditionFailed(self.name)
        del self.cloud.objects[self.name]


@pytest.fixture
def artifact(tmp_path):
    source = tmp_path / "example.trees"
    _many_tree_sequence(source, num_trees=35, num_samples=4)
    return Path(_build(source, format_version=4)["artifact_dir"])


def test_prepared_publication_keeps_all_trees_readable_under_original_name(artifact, tmp_path):
    plan = prepare_publication(artifact)
    target = tmp_path / "published" / artifact.name
    target.mkdir(parents=True)
    for item in plan.files:
        path = target / item.name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(item.data if item.data is not None else item.path.read_bytes())
    (target / "manifest.json").write_bytes(plan.manifest_bytes)
    with CSRArtifactReader(target) as published, CSRArtifactReader(artifact) as original:
        for index in [0, 31, 32, 34]:
            assert published.tree_at_index(index).node_ids.tolist() == original.tree_at_index(index).node_ids.tolist()
        assert published.verify()["ok"]
        assert published.frontend_config()["artifact_format"] == "lorax-csr-v4"


def seed(cloud, artifact, prefix):
    for path in artifact.iterdir():
        if path.is_file():
            cloud.blob(prefix + path.name).upload_from_string(path.read_bytes(), if_generation_match=0)


def test_atomic_replacement_loads_before_deleting_and_reuses_remote_files(artifact, monkeypatch):
    cloud = Cloud()
    prefix = "Example/example.trees.artifact/"
    alias = "Example/example_v4.trees.artifact/"
    seed(cloud, artifact, prefix)
    seed(cloud, artifact, alias)
    old = {name for name in cloud.objects if name.startswith(prefix)}
    monkeypatch.setattr("lorax.artifacts.publisher.time.sleep", lambda seconds: None)

    def loaded(url, project, filename, manifest):
        assert filename == "example.trees"
        assert all(name in cloud.objects for name in old)
        assert json.loads(cloud.objects[prefix + "manifest.json"][0]) == manifest
        return {"artifact_format": manifest["format"]}

    publish_artifact(artifact, "gs://bucket/" + prefix, client=cloud,
                     reuse_from="gs://bucket/" + alias, backend_url="https://backend.invalid",
                     delete_previous=True, remove_reused_prefix=True, smoke=loaded, report=lambda _: None)
    assert all(name.startswith(prefix) for name in cloud.objects)
    assert all(name == prefix + "manifest.json" or "/data/" in name for name in cloud.objects)


def test_interrupted_upload_does_not_change_manifest_or_delete_old_files(artifact):
    cloud = Cloud()
    prefix = "Example/example.trees.artifact/"
    seed(cloud, artifact, prefix)
    before = dict(cloud.objects)
    cloud.fail_upload = True
    with pytest.raises(RuntimeError, match="interrupted"):
        publish_artifact(artifact, "gs://bucket/" + prefix, client=cloud, report=lambda _: None)
    assert cloud.objects == before


def test_failed_hosted_load_keeps_previous_files_and_alias(artifact):
    cloud = Cloud()
    prefix = "Example/example.trees.artifact/"
    alias = "Example/example_v4.trees.artifact/"
    seed(cloud, artifact, prefix)
    seed(cloud, artifact, alias)
    before = set(cloud.objects)
    previous_manifest = cloud.objects[prefix + "manifest.json"][0]

    def fail(*args):
        raise RuntimeError("render failed")

    with pytest.raises(RuntimeError, match="render failed"):
        publish_artifact(artifact, "gs://bucket/" + prefix, client=cloud,
                         reuse_from="gs://bucket/" + alias, backend_url="https://backend.invalid",
                         delete_previous=True, remove_reused_prefix=True, smoke=fail, report=lambda _: None)
    assert before.issubset(cloud.objects)
    assert cloud.objects[prefix + "manifest.json"][0] == previous_manifest


def test_failed_first_load_unpublishes_the_new_manifest(artifact):
    cloud = Cloud()
    prefix = "Example/example.trees.artifact/"

    def fail(*args):
        raise RuntimeError("render failed")

    with pytest.raises(RuntimeError, match="render failed"):
        publish_artifact(artifact, "gs://bucket/" + prefix, client=cloud,
                         backend_url="https://backend.invalid", smoke=fail, report=lambda _: None)
    assert prefix + "manifest.json" not in cloud.objects


def test_failed_load_can_resume_and_finish_deleting_previous_files(artifact, monkeypatch):
    cloud = Cloud()
    prefix = "Example/example.trees.artifact/"
    seed(cloud, artifact, prefix)
    monkeypatch.setattr("lorax.artifacts.publisher.time.sleep", lambda seconds: None)
    kwargs = dict(client=cloud, backend_url="https://backend.invalid", delete_previous=True,
                  report=lambda _: None)

    def fail(*args):
        raise RuntimeError("render failed")

    with pytest.raises(RuntimeError, match="render failed"):
        publish_artifact(artifact, "gs://bucket/" + prefix, smoke=fail, **kwargs)
    publish_artifact(artifact, "gs://bucket/" + prefix, smoke=lambda *args: {}, **kwargs)
    assert all(name == prefix + "manifest.json" or "/data/" in name for name in cloud.objects)
    assert not any(name.endswith("publication-cleanup.json") for name in cloud.objects)


def test_published_artifact_can_be_resumed_without_overwriting_objects(artifact):
    cloud = Cloud()
    kwargs = dict(client=cloud, report=lambda _: None)
    publish_artifact(artifact, "gs://bucket/Example/example.trees.artifact", **kwargs)
    before = dict(cloud.objects)
    publish_artifact(artifact, "gs://bucket/Example/example.trees.artifact", **kwargs)
    assert cloud.objects == before


def test_versioned_destination_is_rejected(artifact):
    with pytest.raises(ValueError, match="stable artifact name"):
        publish_artifact(artifact, "gs://bucket/Example/example_v4.trees.artifact", client=Cloud())


def test_cleanup_requires_hosted_success_check(artifact):
    with pytest.raises(ValueError, match="successful hosted load"):
        publish_artifact(artifact, "gs://bucket/Example/example.trees.artifact", delete_previous=True)


def test_refuses_format_downgrade(artifact):
    cloud = Cloud()
    prefix = "Example/example.trees.artifact/"
    seed(cloud, artifact, prefix)
    source = artifact.parent / "example.trees"
    _build(source, format_version=3, force=True)
    with pytest.raises(ValueError, match="downgrade"):
        publish_artifact(artifact, "gs://bucket/" + prefix, client=cloud)


def test_concurrent_manifest_change_cancels_cleanup(artifact, monkeypatch):
    cloud = Cloud()
    prefix = "Example/example.trees.artifact/"
    seed(cloud, artifact, prefix)
    before = set(cloud.objects)
    monkeypatch.setattr("lorax.artifacts.publisher.time.sleep", lambda seconds: None)

    def concurrent_publish(*args):
        blob = cloud.get_blob(prefix + "manifest.json")
        other = json.loads(blob.download_as_bytes())
        other["publication"]["other"] = True
        blob.upload_from_string(json.dumps(other).encode(), if_generation_match=blob.generation)
        return {}

    with pytest.raises(RuntimeError, match="Another publication"):
        publish_artifact(artifact, "gs://bucket/" + prefix, client=cloud,
                         backend_url="https://backend.invalid", delete_previous=True,
                         smoke=concurrent_publish, report=lambda _: None)
    assert before.issubset(cloud.objects)


def test_refuses_cleanup_of_another_dataset_prefix(artifact):
    cloud = Cloud()
    with pytest.raises(ValueError, match="version-suffixed copy of this dataset"):
        publish_artifact(artifact, "gs://bucket/Example/example.trees.artifact", client=cloud,
                         reuse_from="gs://bucket/Example/unrelated.trees.artifact",
                         backend_url="https://backend.invalid", remove_reused_prefix=True)
