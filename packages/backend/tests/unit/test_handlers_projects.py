"""
Unit tests for /projects handler behavior around GCS listing.
"""

import logging
from unittest.mock import AsyncMock

import pytest

import lorax.handlers as handlers


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_get_projects_skips_gcs_when_bucket_unset(monkeypatch, tmp_path):
    project_dir = tmp_path / "ProjectA"
    project_dir.mkdir(parents=True)
    (project_dir / "file1.csv").write_text("x")
    uploads_dir = tmp_path / "Uploads"
    uploads_dir.mkdir(parents=True)
    (uploads_dir / "upload1.csv").write_text("x")

    gcs_mock = AsyncMock(return_value={})
    monkeypatch.setattr(handlers, "get_public_gcs_dict", gcs_mock)
    monkeypatch.setattr(handlers, "CURRENT_MODE", "local")

    projects = await handlers.get_projects(tmp_path, BUCKET_NAME=None, sid="sid-1")

    assert gcs_mock.await_count == 0
    assert "ProjectA" in projects
    assert projects["Uploads"]["files"] == ["upload1.csv"]


@pytest.mark.anyio
async def test_get_projects_local_mode_calls_gcs_without_uploads(monkeypatch):
    monkeypatch.setattr(handlers, "CURRENT_MODE", "local")
    monkeypatch.setattr(handlers, "list_project_files", lambda *args, **kwargs: {})
    monkeypatch.setattr(handlers.os.path, "isdir", lambda *_: False)

    gcs_mock = AsyncMock(return_value={})
    monkeypatch.setattr(handlers, "get_public_gcs_dict", gcs_mock)

    await handlers.get_projects("/tmp/uploads", BUCKET_NAME="bucket", sid="sid-local")

    assert gcs_mock.await_count == 1
    await_kwargs = gcs_mock.await_args.kwargs
    assert await_kwargs["include_uploads"] is False
    assert await_kwargs["uploads_sid"] is None
    assert await_kwargs["sid"] == "sid-local"


@pytest.mark.anyio
async def test_get_projects_non_local_mode_calls_gcs_with_uploads(monkeypatch):
    monkeypatch.setattr(handlers, "CURRENT_MODE", "production")
    monkeypatch.setattr(handlers, "list_project_files", lambda *args, **kwargs: {})
    monkeypatch.setattr(handlers.os.path, "isdir", lambda *_: False)

    gcs_mock = AsyncMock(return_value={})
    monkeypatch.setattr(handlers, "get_public_gcs_dict", gcs_mock)

    await handlers.get_projects("/tmp/uploads", BUCKET_NAME="bucket", sid="sid-prod")

    assert gcs_mock.await_count == 1
    await_kwargs = gcs_mock.await_args.kwargs
    assert await_kwargs["include_uploads"] is True
    assert await_kwargs["uploads_sid"] == "sid-prod"
    assert await_kwargs["sid"] == "sid-prod"


@pytest.mark.anyio
async def test_get_projects_degrades_gracefully_when_gcs_fails(monkeypatch, caplog):
    monkeypatch.setattr(handlers, "CURRENT_MODE", "production")
    monkeypatch.setattr(
        handlers,
        "list_project_files",
        lambda *args, **kwargs: {
            "LocalProject": {
                "folder": "LocalProject",
                "files": ["local.csv"],
                "description": "",
            }
        },
    )
    monkeypatch.setattr(handlers.os.path, "isdir", lambda *_: False)

    gcs_mock = AsyncMock(side_effect=RuntimeError("gcs unavailable"))
    monkeypatch.setattr(handlers, "get_public_gcs_dict", gcs_mock)

    with caplog.at_level(logging.WARNING):
        projects = await handlers.get_projects("/tmp/uploads", BUCKET_NAME="bucket", sid="sid-prod")

    assert gcs_mock.await_count == 1
    assert "LocalProject" in projects
    assert "Uploads" in projects
    assert "Failed to merge GCS projects" in caplog.text
