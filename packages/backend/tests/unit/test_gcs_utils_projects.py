"""
Unit tests for async GCS project listing and cache behavior.
"""

from unittest.mock import AsyncMock, Mock

import aiohttp
import pytest

from lorax.cloud import gcs_utils


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def clear_gcs_projects_cache(monkeypatch):
    """Ensure each test starts with a fresh in-process GCS listing cache."""
    gcs_utils._GCS_PROJECTS_CACHE.clear()
    gcs_utils._GCS_PROJECTS_CACHE_LOCKS.clear()
    monkeypatch.setenv("LORAX_GCS_PROJECTS_CACHE_TTL_SEC", "15")
    monkeypatch.setenv("LORAX_GCS_PROJECTS_TIMEOUT_SEC", "5")
    yield
    gcs_utils._GCS_PROJECTS_CACHE.clear()
    gcs_utils._GCS_PROJECTS_CACHE_LOCKS.clear()


@pytest.mark.anyio
async def test_get_public_gcs_dict_parses_projects(monkeypatch):
    fetch_mock = AsyncMock(
        return_value=[
            {"name": "ProjectA/file1.trees"},
            {"name": "ProjectA/file2.csv"},
            {"name": "ProjectB/subdir/file3.trees"},
            {"name": "root_level_file.trees"},
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    assert set(projects.keys()) == {"ProjectA", "ProjectB"}
    assert projects["ProjectA"]["files"] == ["file1.trees", "file2.csv"]
    assert projects["ProjectB"]["files"] == ["subdir/file3.trees"]


@pytest.mark.anyio
async def test_get_public_gcs_dict_hides_auxiliary_objects(monkeypatch):
    fetch_mock = AsyncMock(
        return_value=[
            {"name": "Project/data.tree.gz"},
            {"name": "Project/pos"},
            {"name": "Project/config.json"},
            {"name": "Project/shards.arrow"},
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    assert projects["Project"]["files"] == ["data.tree.gz"]

@pytest.mark.anyio
async def test_public_bucket_listing_follows_pagination(monkeypatch):
    responses = [
        {
            "items": [{"name": "ProjectA/first.trees"}],
            "nextPageToken": "page-2",
        },
        {"items": [{"name": "ProjectB/second.trees"}]},
    ]
    requests = []

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def json(self):
            return self.payload

    class FakeSession:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def get(self, _url, *, params):
            requests.append(params)
            return FakeResponse(responses[len(requests) - 1])

    monkeypatch.setattr(gcs_utils.aiohttp, "ClientSession", FakeSession)

    items = await gcs_utils._fetch_public_bucket_items("bucket")

    assert items == [
        {"name": "ProjectA/first.trees"},
        {"name": "ProjectB/second.trees"},
    ]
    assert requests[0]["fields"] == "items(name),nextPageToken"
    assert requests[1]["pageToken"] == "page-2"


@pytest.mark.anyio
async def test_private_bucket_listing_uses_application_credentials(monkeypatch):
    denied = aiohttp.ClientResponseError(
        request_info=Mock(),
        history=(),
        status=403,
    )
    public_fetch = AsyncMock(side_effect=denied)
    authenticated_fetch = Mock(
        return_value=[{"name": "PrivateProject/data.trees"}]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", public_fetch)
    monkeypatch.setattr(
        gcs_utils,
        "_fetch_authenticated_project_items_sync",
        authenticated_fetch,
    )

    projects = await gcs_utils.get_public_gcs_dict(
        "private-bucket", sid="sid-1", projects={}
    )

    assert projects["PrivateProject"]["files"] == ["data.trees"]
    authenticated_fetch.assert_called_once_with("private-bucket")


@pytest.mark.anyio
async def test_get_public_gcs_dict_hides_artifact_path_components(monkeypatch):
    fetch_mock = AsyncMock(
        return_value=[
            {"name": "ProjectA/source.trees.tsz"},
            {
                "name": (
                    "ProjectA/source.trees.tsz.artifact/manifest.json"
                )
            },
            {
                "name": (
                    "ProjectA/.source.trees.tsz.artifact.inprogress/"
                    "build-state.json"
                )
            },
            {
                "name": (
                    "ProjectA/.source.trees.tsz.artifact.obsolete-test/"
                    "manifest.json"
                )
            },
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects = await gcs_utils.get_public_gcs_dict(
        "bucket",
        sid="sid-1",
        projects={},
    )

    assert projects["ProjectA"]["files"] == ["source.trees.tsz"]


@pytest.mark.anyio
async def test_get_public_gcs_dict_lists_artifact_without_source(monkeypatch):
    fetch_mock = AsyncMock(
        return_value=[
            {"name": "ArtifactOnly/remote.trees.artifact/manifest.json"},
            {"name": "ArtifactOnly/remote.trees.artifact/breakpoints.npy"},
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects = await gcs_utils.get_public_gcs_dict(
        "bucket", sid="sid-1", projects={}
    )

    assert projects["ArtifactOnly"]["files"] == ["remote.trees"]


@pytest.mark.anyio
async def test_get_public_gcs_dict_excludes_uploads_when_disabled(monkeypatch):
    fetch_mock = AsyncMock(
        return_value=[
            {"name": "Uploads/sid-1/private.csv"},
            {"name": "ProjectA/file1.trees"},
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects = await gcs_utils.get_public_gcs_dict(
        "bucket",
        sid="sid-1",
        projects={},
        include_uploads=False,
    )

    assert "Uploads" not in projects
    assert projects["ProjectA"]["files"] == ["file1.trees"]


@pytest.mark.anyio
async def test_get_public_gcs_dict_filters_uploads_to_sid(monkeypatch):
    fetch_mock = AsyncMock(
        return_value=[
            {"name": "Uploads/sid-1/a.csv"},
            {"name": "Uploads/sid-1/b.trees"},
            {"name": "Uploads/sid-2/c.csv"},
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects = await gcs_utils.get_public_gcs_dict(
        "bucket",
        sid="sid-1",
        projects={},
        include_uploads=True,
        uploads_sid="sid-1",
    )

    assert projects["Uploads"]["files"] == ["a.csv", "b.trees"]


@pytest.mark.anyio
async def test_projects_listing_cache_hit_skips_refetch(monkeypatch):
    fetch_mock = AsyncMock(return_value=[{"name": "ProjectA/file1.trees"}])
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects_1 = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})
    projects_2 = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    assert projects_1 == projects_2
    assert fetch_mock.await_count == 1


@pytest.mark.anyio
async def test_projects_listing_cache_expiry_triggers_refresh(monkeypatch):
    fetch_mock = AsyncMock(
        side_effect=[
            [{"name": "ProjectA/file1.trees"}],
            [{"name": "ProjectB/file2.trees"}],
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    projects_1 = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})
    cache_key = next(iter(gcs_utils._GCS_PROJECTS_CACHE.keys()))
    gcs_utils._GCS_PROJECTS_CACHE[cache_key]["fetched_at"] = -1.0
    projects_2 = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    assert "ProjectA" in projects_1
    assert "ProjectB" in projects_2
    assert fetch_mock.await_count == 2


@pytest.mark.anyio
async def test_projects_listing_refresh_failure_uses_stale_cache(monkeypatch):
    initial_fetch = AsyncMock(return_value=[{"name": "ProjectA/file1.trees"}])
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", initial_fetch)
    await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    cache_key = next(iter(gcs_utils._GCS_PROJECTS_CACHE.keys()))
    gcs_utils._GCS_PROJECTS_CACHE[cache_key]["fetched_at"] = -1.0

    failing_fetch = AsyncMock(side_effect=RuntimeError("refresh failed"))
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", failing_fetch)
    projects = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    assert "ProjectA" in projects
    assert failing_fetch.await_count == 1


@pytest.mark.anyio
async def test_projects_listing_failure_without_cache_raises(monkeypatch):
    fetch_mock = AsyncMock(side_effect=RuntimeError("listing failed"))
    monkeypatch.setattr(gcs_utils, "_fetch_public_project_items", fetch_mock)

    with pytest.raises(RuntimeError, match="listing failed"):
        await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})
