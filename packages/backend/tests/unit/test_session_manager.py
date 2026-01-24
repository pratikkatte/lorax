"""
Unit Tests for Session Manager

Tests session creation, serialization, socket tracking,
and connection limit enforcement.
"""

import pytest
import json
from datetime import datetime, timezone
from unittest.mock import patch


class TestSession:
    """Tests for the Session class."""

    def test_session_creation(self):
        """Test basic session creation with SID."""
        from lorax.session_manager import Session

        session = Session(sid="test-session-123")

        assert session.sid == "test-session-123"
        assert session.file_path is None
        assert session.socket_connections == {}
        assert session.created_at is not None

    def test_session_with_file_path(self):
        """Test session creation with file path."""
        from lorax.session_manager import Session

        session = Session(
            sid="test-session-123",
            file_path="/path/to/file.trees"
        )

        assert session.file_path == "/path/to/file.trees"

    def test_session_serialization(self):
        """Test session to_dict and from_dict."""
        from lorax.session_manager import Session

        original = Session(
            sid="test-session-123",
            file_path="/path/to/file.trees"
        )
        original.socket_connections = {"socket-1": "2024-01-01T00:00:00+00:00"}

        # Serialize
        data = original.to_dict()
        assert data["sid"] == "test-session-123"
        assert data["file_path"] == "/path/to/file.trees"
        assert "socket-1" in data["socket_connections"]

        # Deserialize
        restored = Session.from_dict(data)
        assert restored.sid == original.sid
        assert restored.file_path == original.file_path
        assert restored.socket_connections == original.socket_connections

    def test_add_socket_under_limit(self):
        """Test adding socket when under connection limit."""
        from lorax.session_manager import Session

        session = Session(sid="test-session-123")

        # Add socket
        replaced = session.add_socket("socket-1")

        assert replaced is None
        assert "socket-1" in session.socket_connections
        assert session.get_socket_count() == 1

    def test_add_multiple_sockets(self):
        """Test adding multiple sockets."""
        from lorax.session_manager import Session

        session = Session(sid="test-session-123")

        for i in range(3):
            session.add_socket(f"socket-{i}")

        assert session.get_socket_count() == 3
        for i in range(3):
            assert f"socket-{i}" in session.socket_connections

    def test_remove_socket(self):
        """Test removing a socket connection."""
        from lorax.session_manager import Session

        session = Session(sid="test-session-123")
        session.add_socket("socket-1")
        session.add_socket("socket-2")

        session.remove_socket("socket-1")

        assert "socket-1" not in session.socket_connections
        assert "socket-2" in session.socket_connections
        assert session.get_socket_count() == 1

    def test_remove_nonexistent_socket(self):
        """Test removing a socket that doesn't exist."""
        from lorax.session_manager import Session

        session = Session(sid="test-session-123")
        session.add_socket("socket-1")

        # Should not raise an error
        session.remove_socket("nonexistent-socket")
        assert session.get_socket_count() == 1

    def test_update_activity(self):
        """Test that activity timestamp is updated."""
        from lorax.session_manager import Session
        import time

        session = Session(sid="test-session-123")
        original_activity = session.last_activity

        time.sleep(0.01)  # Small delay
        session.update_activity()

        assert session.last_activity != original_activity

    @patch("lorax.session_manager.ENFORCE_CONNECTION_LIMITS", True)
    @patch("lorax.session_manager.MAX_SOCKETS_PER_SESSION", 3)
    def test_connection_limit_enforcement(self):
        """Test that oldest connection is replaced when at limit."""
        from lorax.session_manager import Session
        import time

        session = Session(sid="test-session-123")

        # Add sockets up to limit
        session.add_socket("socket-1")
        time.sleep(0.01)
        session.add_socket("socket-2")
        time.sleep(0.01)
        session.add_socket("socket-3")

        assert session.get_socket_count() == 3

        # Add one more - should replace oldest (socket-1)
        time.sleep(0.01)
        replaced = session.add_socket("socket-4")

        assert replaced == "socket-1"
        assert session.get_socket_count() == 3
        assert "socket-1" not in session.socket_connections
        assert "socket-4" in session.socket_connections

    @patch("lorax.session_manager.ENFORCE_CONNECTION_LIMITS", False)
    def test_connection_limit_not_enforced(self):
        """Test that limits are not enforced when disabled."""
        from lorax.session_manager import Session

        session = Session(sid="test-session-123")

        # Add many sockets
        for i in range(10):
            replaced = session.add_socket(f"socket-{i}")
            assert replaced is None

        assert session.get_socket_count() == 10

    def test_is_at_connection_limit(self):
        """Test connection limit check."""
        from lorax.session_manager import Session

        session = Session(sid="test-session-123")

        # Initially not at limit
        assert session.is_at_connection_limit() is False


class TestSessionManager:
    """Tests for the SessionManager class."""

    @pytest.mark.asyncio
    async def test_create_session(self, session_manager_memory):
        """Test session creation."""
        session = await session_manager_memory.create_session()

        assert session is not None
        assert session.sid is not None
        assert len(session.sid) == 36  # UUID format

    @pytest.mark.asyncio
    async def test_create_session_with_sid(self, session_manager_memory):
        """Test session creation with specific SID."""
        session = await session_manager_memory.create_session(sid="custom-sid-123")

        assert session.sid == "custom-sid-123"

    @pytest.mark.asyncio
    async def test_get_session(self, session_manager_memory):
        """Test session retrieval."""
        created = await session_manager_memory.create_session()
        retrieved = await session_manager_memory.get_session(created.sid)

        assert retrieved is not None
        assert retrieved.sid == created.sid

    @pytest.mark.asyncio
    async def test_get_nonexistent_session(self, session_manager_memory):
        """Test retrieval of non-existent session."""
        session = await session_manager_memory.get_session("nonexistent-sid")
        assert session is None

    @pytest.mark.asyncio
    async def test_get_session_with_none(self, session_manager_memory):
        """Test retrieval with None SID."""
        session = await session_manager_memory.get_session(None)
        assert session is None

    @pytest.mark.asyncio
    async def test_save_session(self, session_manager_memory):
        """Test session persistence."""
        session = await session_manager_memory.create_session()
        session.file_path = "/updated/path.trees"

        await session_manager_memory.save_session(session)

        retrieved = await session_manager_memory.get_session(session.sid)
        assert retrieved.file_path == "/updated/path.trees"

    @pytest.mark.asyncio
    async def test_health_check_memory(self, session_manager_memory):
        """Test health check with in-memory storage."""
        result = await session_manager_memory.health_check()
        assert result is True


class TestSessionManagerRedis:
    """Tests for SessionManager with Redis storage."""

    @pytest.mark.asyncio
    async def test_create_session_redis(self, session_manager_redis):
        """Test session creation with Redis backend."""
        session = await session_manager_redis.create_session()

        assert session is not None
        assert session.sid is not None

    @pytest.mark.asyncio
    async def test_session_persistence_redis(self, session_manager_redis):
        """Test session persistence with Redis backend."""
        session = await session_manager_redis.create_session()
        session.file_path = "/path/to/file.trees"

        await session_manager_redis.save_session(session)

        retrieved = await session_manager_redis.get_session(session.sid)
        assert retrieved is not None
        assert retrieved.file_path == "/path/to/file.trees"

    @pytest.mark.asyncio
    async def test_health_check_redis(self, session_manager_redis):
        """Test health check with Redis backend."""
        result = await session_manager_redis.health_check()
        assert result is True
