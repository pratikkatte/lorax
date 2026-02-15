"""
Unit tests for async GCS project listing and cache behavior.
"""

from unittest.mock import AsyncMock

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
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", fetch_mock)

    projects = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    assert set(projects.keys()) == {"ProjectA", "ProjectB"}
    assert projects["ProjectA"]["files"] == ["file1.trees", "file2.csv"]
    assert projects["ProjectB"]["files"] == ["subdir"]


@pytest.mark.anyio
async def test_get_public_gcs_dict_excludes_uploads_when_disabled(monkeypatch):
    fetch_mock = AsyncMock(
        return_value=[
            {"name": "Uploads/sid-1/private.csv"},
            {"name": "ProjectA/file1.trees"},
        ]
    )
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", fetch_mock)

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
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", fetch_mock)

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
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", fetch_mock)

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
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", fetch_mock)

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
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", initial_fetch)
    await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    cache_key = next(iter(gcs_utils._GCS_PROJECTS_CACHE.keys()))
    gcs_utils._GCS_PROJECTS_CACHE[cache_key]["fetched_at"] = -1.0

    failing_fetch = AsyncMock(side_effect=RuntimeError("refresh failed"))
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", failing_fetch)
    projects = await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})

    assert "ProjectA" in projects
    assert failing_fetch.await_count == 1


@pytest.mark.anyio
async def test_projects_listing_failure_without_cache_raises(monkeypatch):
    fetch_mock = AsyncMock(side_effect=RuntimeError("listing failed"))
    monkeypatch.setattr(gcs_utils, "_fetch_public_bucket_items", fetch_mock)

    with pytest.raises(RuntimeError, match="listing failed"):
        await gcs_utils.get_public_gcs_dict("bucket", sid="sid-1", projects={})
