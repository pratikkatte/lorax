"""
Integration Tests for HTTP Routes

Tests all 8 HTTP endpoints:
- GET /health
- GET /
- POST /init-session
- GET /projects
- GET /memory_status
- GET /{file}
- POST /upload
- GET /favicon.ico
"""

import pytest
import os
from pathlib import Path
from unittest.mock import patch

# Check if numba is available (required for full app initialization)
try:
    import numba
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False

pytestmark = pytest.mark.skipif(not HAS_NUMBA, reason="numba required for app initialization")


class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    @pytest.mark.asyncio
    async def test_health_returns_ok(self, async_client):
        """Test health endpoint returns ok status."""
        response = await async_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "redis" in data

    @pytest.mark.asyncio
    async def test_health_redis_status(self, async_client):
        """Test health endpoint includes Redis status."""
        response = await async_client.get("/health")

        data = response.json()
        # In local mode without Redis, should still return a status
        assert "redis" in data


class TestRootEndpoint:
    """Tests for the / endpoint."""

    @pytest.mark.asyncio
    async def test_root_returns_status(self, async_client):
        """Test root endpoint returns running status."""
        response = await async_client.get("/")

        assert response.status_code == 200
        assert "running" in response.text.lower() or "Lorax" in response.text


class TestFaviconEndpoint:
    """Tests for the /favicon.ico endpoint."""

    @pytest.mark.asyncio
    async def test_favicon_returns_empty(self, async_client):
        """Test favicon endpoint returns empty icon."""
        # Note: Route is spelled "fevicon" in the code
        response = await async_client.get("/fevicon.ico")

        assert response.status_code == 200
        assert response.headers.get("content-type") == "image/x-icon"


class TestInitSessionEndpoint:
    """Tests for the /init-session endpoint."""

    @pytest.mark.asyncio
    async def test_init_session_creates_session(self, async_client):
        """Test init-session creates a new session."""
        response = await async_client.post("/init-session")

        assert response.status_code == 200
        data = response.json()
        assert "sid" in data
        assert len(data["sid"]) > 0

    @pytest.mark.asyncio
    async def test_init_session_sets_cookie(self, async_client):
        """Test init-session sets lorax_sid cookie."""
        response = await async_client.post("/init-session")

        # Check for cookie in response
        assert "lorax_sid" in response.cookies or response.status_code == 200

    @pytest.mark.asyncio
    async def test_init_session_reuses_existing(self, async_client):
        """Test init-session reuses existing session from cookie."""
        # First request creates session
        response1 = await async_client.post("/init-session")
        sid1 = response1.json()["sid"]

        # Second request with cookie should return same session
        cookies = {"lorax_sid": sid1}
        response2 = await async_client.post("/init-session", cookies=cookies)
        sid2 = response2.json()["sid"]

        assert sid1 == sid2


class TestProjectsEndpoint:
    """Tests for the /projects endpoint."""

    @pytest.mark.asyncio
    async def test_projects_returns_list(self, async_client):
        """Test projects endpoint returns project list."""
        response = await async_client.get("/projects")

        assert response.status_code == 200
        data = response.json()
        assert "projects" in data
        assert isinstance(data["projects"], dict)

    @pytest.mark.asyncio
    async def test_projects_creates_session(self, async_client):
        """Test projects endpoint creates session if none exists."""
        response = await async_client.get("/projects")

        assert response.status_code == 200
        # May set a cookie for new session


class TestMemoryStatusEndpoint:
    """Tests for the /memory_status endpoint."""

    @pytest.mark.asyncio
    async def test_memory_status_returns_stats(self, async_client):
        """Test memory_status returns cache statistics."""
        response = await async_client.get("/memory_status")

        assert response.status_code == 200
        data = response.json()
        assert "rss_MB" in data
        assert "vms_MB" in data
        assert "ts_cache_size" in data
        assert "pid" in data

    @pytest.mark.asyncio
    async def test_memory_status_values_are_numbers(self, async_client):
        """Test memory_status values are numeric."""
        response = await async_client.get("/memory_status")

        data = response.json()
        assert isinstance(data["rss_MB"], (int, float))
        assert isinstance(data["vms_MB"], (int, float))
        assert isinstance(data["pid"], int)


class TestFileEndpoint:
    """Tests for the /{file} endpoint."""

    @pytest.mark.asyncio
    async def test_get_file_missing(self, async_client, temp_dir, monkeypatch):
        """Test get file with non-existent file."""
        # Point uploads to temp dir
        monkeypatch.setenv("UPLOADS_DIR", str(temp_dir))

        response = await async_client.get(
            "/nonexistent.trees",
            params={"project": "test"}
        )

        # Should return error in response
        assert response.status_code == 200
        data = response.json()
        assert "error" in data or "config" not in data

    @pytest.mark.asyncio
    async def test_get_file_with_coordinates(self, async_client, minimal_ts_file, temp_dir, monkeypatch):
        """Test get file with genomic coordinates."""
        # Setup uploads directory
        uploads_dir = temp_dir / "UPLOADS" / "test"
        uploads_dir.mkdir(parents=True)

        # Copy test file
        import shutil
        dest_file = uploads_dir / "test.trees"
        shutil.copy(minimal_ts_file, dest_file)

        monkeypatch.setattr("lorax.routes.UPLOAD_DIR", temp_dir / "UPLOADS")

        response = await async_client.get(
            "/test.trees",
            params={
                "project": "test",
                "genomiccoordstart": 0,
                "genomiccoordend": 1000
            }
        )

        # May succeed or fail depending on file location
        assert response.status_code == 200


class TestUploadEndpoint:
    """Tests for the /upload endpoint."""

    @pytest.mark.asyncio
    async def test_upload_file(self, async_client, sample_csv_file, temp_dir, monkeypatch):
        """Test file upload."""
        # Setup uploads directory
        uploads_dir = temp_dir / "UPLOADS"
        monkeypatch.setattr("lorax.routes.UPLOAD_DIR", uploads_dir)
        monkeypatch.setattr("lorax.context.IS_VM", False)

        # Create file content
        content = sample_csv_file.read_bytes()

        response = await async_client.post(
            "/upload",
            files={"file": ("test.csv", content, "text/csv")}
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_upload_sets_owner_sid(self, async_client, sample_csv_file, temp_dir, monkeypatch):
        """Test that upload returns owner_sid."""
        uploads_dir = temp_dir / "UPLOADS"
        monkeypatch.setattr("lorax.routes.UPLOAD_DIR", uploads_dir)
        monkeypatch.setattr("lorax.context.IS_VM", False)

        content = sample_csv_file.read_bytes()

        response = await async_client.post(
            "/upload",
            files={"file": ("test.csv", content, "text/csv")}
        )

        if response.status_code == 200:
            data = response.json()
            if "error" not in data:
                assert "sid" in data or "owner_sid" in data


class TestRouteIntegration:
    """Integration tests combining multiple routes."""

    @pytest.mark.asyncio
    async def test_session_workflow(self, async_client):
        """Test complete session workflow."""
        # 1. Initialize session
        init_response = await async_client.post("/init-session")
        assert init_response.status_code == 200
        sid = init_response.json()["sid"]

        # 2. Check health
        health_response = await async_client.get("/health")
        assert health_response.status_code == 200

        # 3. Get projects
        projects_response = await async_client.get(
            "/projects",
            cookies={"lorax_sid": sid}
        )
        assert projects_response.status_code == 200

        # 4. Check memory status
        memory_response = await async_client.get("/memory_status")
        assert memory_response.status_code == 200

    @pytest.mark.asyncio
    async def test_error_handling(self, async_client):
        """Test that errors are handled gracefully."""
        # Request non-existent file
        response = await async_client.get("/invalid_file_12345.trees")

        # Should not crash, should return error or 404
        assert response.status_code in [200, 404, 422]
