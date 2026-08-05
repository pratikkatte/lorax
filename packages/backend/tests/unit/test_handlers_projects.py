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
async def test_get_projects_adds_local_phlag_artifact_project(monkeypatch, tmp_path):
    monkeypatch.setattr(handlers, "CURRENT_MODE", "local")
    monkeypatch.setattr(handlers, "get_uploads_dir", lambda _config: tmp_path)
    monkeypatch.setattr(
        handlers,
        "phlag_projects",
        lambda: {
            "PHLaG": {
                "folder": "/external/phlag",
                "files": ["gene_trees-Stiller2024-chr1-sorted.nwk.gz"],
                "description": "PHLaG CSR artifacts",
                "artifact_backed": True,
            }
        },
    )
    monkeypatch.setattr(
        handlers,
        "get_public_gcs_dict",
        AsyncMock(return_value={}),
    )

    projects = await handlers.get_projects(tmp_path, BUCKET_NAME=None, sid="sid-phlag")

    assert projects["PHLaG"]["artifact_backed"] is True
    assert projects["PHLaG"]["files"] == [
        "gene_trees-Stiller2024-chr1-sorted.nwk.gz"
    ]


@pytest.mark.anyio
async def test_get_projects_hides_colocated_artifact_directories(
    monkeypatch,
    tmp_path,
):
    project_dir = tmp_path / "ProjectA"
    project_dir.mkdir(parents=True)
    (project_dir / "source.trees.tsz").write_text("source")
    for directory_name in (
        "source.trees.tsz.artifact",
        ".source.trees.tsz.artifact.inprogress",
        ".source.trees.tsz.artifact.obsolete-test",
    ):
        artifact_directory = project_dir / directory_name
        artifact_directory.mkdir()
        (artifact_directory / "manifest.json").write_text("{}")

    monkeypatch.setattr(handlers, "CURRENT_MODE", "local")
    monkeypatch.setattr(
        handlers,
        "get_public_gcs_dict",
        AsyncMock(return_value={}),
    )

    projects = await handlers.get_projects(
        tmp_path,
        BUCKET_NAME=None,
        sid="sid-artifact",
    )

    assert projects["ProjectA"]["files"] == ["source.trees.tsz"]
    assert all(
        "artifact" not in project_name
        for project_name in projects
    )


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
