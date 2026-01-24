"""
Integration Tests for Session Lifecycle

Tests end-to-end session flow including:
- Session creation and persistence
- File loading and caching
- Socket connection management
- Session expiry and cleanup
"""

import pytest
import asyncio
from unittest.mock import patch, MagicMock

# Check if numba is available (required for full app initialization)
try:
    import numba
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False


@pytest.mark.skipif(not HAS_NUMBA, reason="numba required for app initialization")
class TestSessionCreation:
    """Tests for session creation lifecycle."""

    @pytest.mark.asyncio
    async def test_full_session_lifecycle(self, async_client):
        """Test complete session creation and usage."""
        # 1. Create session via init-session
        response = await async_client.post("/init-session")
        assert response.status_code == 200

        sid = response.json()["sid"]
        assert sid is not None

        # 2. Use session for subsequent requests
        response = await async_client.get(
            "/projects",
            cookies={"lorax_sid": sid}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_session_persists_across_requests(self, async_client):
        """Test session persists across multiple requests."""
        # Create session
        response1 = await async_client.post("/init-session")
        sid = response1.json()["sid"]

        # Multiple requests with same session
        for _ in range(5):
            response = await async_client.get(
                "/memory_status",
                cookies={"lorax_sid": sid}
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_multiple_sessions(self, async_client):
        """Test multiple independent sessions."""
        # Create first session
        response1 = await async_client.post("/init-session")
        sid1 = response1.json()["sid"]

        # Create second session (without cookie)
        response2 = await async_client.post("/init-session")
        sid2 = response2.json()["sid"]

        # Sessions should be different
        assert sid1 != sid2


class TestFileLoadingLifecycle:
    """Tests for file loading within session lifecycle."""

    @pytest.mark.asyncio
    async def test_session_tracks_loaded_file(self, session_manager_memory, minimal_ts_file):
        """Test session tracks loaded file path."""
        from lorax.session_manager import Session

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)

        await session_manager_memory.save_session(session)

        # Retrieve and verify
        retrieved = await session_manager_memory.get_session(session.sid)
        assert retrieved.file_path == str(minimal_ts_file)

    @pytest.mark.asyncio
    async def test_file_path_updates(self, session_manager_memory, minimal_ts_file, temp_dir):
        """Test session file path can be updated."""
        session = await session_manager_memory.create_session()

        # First file
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        # Update to different file
        new_path = str(temp_dir / "different.trees")
        session.file_path = new_path
        await session_manager_memory.save_session(session)

        retrieved = await session_manager_memory.get_session(session.sid)
        assert retrieved.file_path == new_path


class TestSocketConnectionLifecycle:
    """Tests for socket connection lifecycle."""

    @pytest.mark.asyncio
    async def test_socket_connection_tracking(self, session_manager_memory):
        """Test socket connections are tracked in session."""
        session = await session_manager_memory.create_session()

        # Add sockets
        session.add_socket("socket-1")
        session.add_socket("socket-2")
        await session_manager_memory.save_session(session)

        # Verify
        retrieved = await session_manager_memory.get_session(session.sid)
        assert retrieved.get_socket_count() == 2
        assert "socket-1" in retrieved.socket_connections
        assert "socket-2" in retrieved.socket_connections

    @pytest.mark.asyncio
    async def test_socket_disconnection(self, session_manager_memory):
        """Test socket disconnection is tracked."""
        session = await session_manager_memory.create_session()

        session.add_socket("socket-1")
        session.add_socket("socket-2")
        await session_manager_memory.save_session(session)

        # Disconnect one
        session.remove_socket("socket-1")
        await session_manager_memory.save_session(session)

        retrieved = await session_manager_memory.get_session(session.sid)
        assert retrieved.get_socket_count() == 1
        assert "socket-1" not in retrieved.socket_connections
        assert "socket-2" in retrieved.socket_connections

    @pytest.mark.asyncio
    async def test_all_sockets_disconnect(self, session_manager_memory):
        """Test behavior when all sockets disconnect."""
        session = await session_manager_memory.create_session()

        session.add_socket("socket-1")
        await session_manager_memory.save_session(session)

        session.remove_socket("socket-1")
        await session_manager_memory.save_session(session)

        retrieved = await session_manager_memory.get_session(session.sid)
        assert retrieved.get_socket_count() == 0


@pytest.mark.skipif(not HAS_NUMBA, reason="numba required for app initialization")
class TestConcurrentSessions:
    """Tests for concurrent session handling."""

    @pytest.mark.asyncio
    async def test_concurrent_session_creation(self, async_client):
        """Test multiple concurrent session creations."""
        # Create sessions concurrently
        tasks = [async_client.post("/init-session") for _ in range(10)]
        responses = await asyncio.gather(*tasks)

        sids = [r.json()["sid"] for r in responses]

        # All should be unique
        assert len(set(sids)) == len(sids)

    @pytest.mark.asyncio
    async def test_concurrent_requests_same_session(self, async_client):
        """Test concurrent requests with same session."""
        # Create session
        response = await async_client.post("/init-session")
        sid = response.json()["sid"]

        # Make concurrent requests
        tasks = [
            async_client.get("/memory_status", cookies={"lorax_sid": sid})
            for _ in range(10)
        ]
        responses = await asyncio.gather(*tasks)

        # All should succeed
        assert all(r.status_code == 200 for r in responses)


class TestSessionWithFileOperations:
    """Tests for session behavior with file operations."""

    @pytest.mark.asyncio
    async def test_session_file_state_isolation(self, session_manager_memory, minimal_ts_file, temp_dir):
        """Test file state is isolated between sessions."""
        # Create two sessions
        session1 = await session_manager_memory.create_session()
        session2 = await session_manager_memory.create_session()

        # Load different files
        session1.file_path = str(minimal_ts_file)
        session2.file_path = str(temp_dir / "other.trees")

        await session_manager_memory.save_session(session1)
        await session_manager_memory.save_session(session2)

        # Verify isolation
        retrieved1 = await session_manager_memory.get_session(session1.sid)
        retrieved2 = await session_manager_memory.get_session(session2.sid)

        assert retrieved1.file_path != retrieved2.file_path

    @pytest.mark.asyncio
    async def test_session_preserves_file_on_reconnect(self, session_manager_memory, minimal_ts_file):
        """Test file path is preserved when socket reconnects."""
        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)

        # Add and remove socket
        session.add_socket("socket-1")
        await session_manager_memory.save_session(session)

        session.remove_socket("socket-1")
        await session_manager_memory.save_session(session)

        # Reconnect
        session.add_socket("socket-2")
        await session_manager_memory.save_session(session)

        # File should still be set
        retrieved = await session_manager_memory.get_session(session.sid)
        assert retrieved.file_path == str(minimal_ts_file)


class TestActivityTracking:
    """Tests for session activity tracking."""

    @pytest.mark.asyncio
    async def test_activity_updated_on_socket_add(self, session_manager_memory):
        """Test last_activity is updated when socket is added."""
        import time

        session = await session_manager_memory.create_session()
        original_activity = session.last_activity

        time.sleep(0.01)
        session.add_socket("socket-1")

        assert session.last_activity != original_activity

    @pytest.mark.asyncio
    async def test_activity_updated_on_socket_remove(self, session_manager_memory):
        """Test last_activity is updated when socket is removed."""
        import time

        session = await session_manager_memory.create_session()
        session.add_socket("socket-1")
        original_activity = session.last_activity

        time.sleep(0.01)
        session.remove_socket("socket-1")

        assert session.last_activity != original_activity


@pytest.mark.skipif(not HAS_NUMBA, reason="numba required for app initialization")
class TestErrorHandling:
    """Tests for error handling in session lifecycle."""

    @pytest.mark.asyncio
    async def test_invalid_session_id_handling(self, async_client):
        """Test handling of invalid session IDs."""
        response = await async_client.get(
            "/projects",
            cookies={"lorax_sid": "invalid-nonexistent-session"}
        )

        # Should create new session or handle gracefully
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_malformed_session_cookie(self, async_client):
        """Test handling of malformed session cookies."""
        response = await async_client.get(
            "/projects",
            cookies={"lorax_sid": ""}
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]
