"""
Shared Test Fixtures for Lorax Backend

Provides fixtures for:
- Environment setup (force local mode)
- Test data paths
- Mock Redis and GCS
- FastAPI test client
- Socket.IO test harness
- Session manager fixtures
- Tree sequence fixtures (msprime-generated)
"""

import os
import sys
import json
import tempfile
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List
from unittest.mock import patch, MagicMock

import pytest
import numpy as np

# Set environment BEFORE importing lorax modules
os.environ["LORAX_MODE"] = "local"
os.environ["REDIS_URL"] = ""
os.environ["GCS_BUCKET_NAME"] = ""

# Add package to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from tests.mocks import MockRedis, MockGCSBucket


# =============================================================================
# Environment Fixtures
# =============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def force_local_mode(monkeypatch):
    """Force local mode for all tests."""
    monkeypatch.setenv("LORAX_MODE", "local")
    monkeypatch.setenv("REDIS_URL", "")
    monkeypatch.setenv("GCS_BUCKET_NAME", "")


@pytest.fixture
def temp_dir():
    """Provide a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def uploads_dir(temp_dir):
    """Provide a temporary uploads directory."""
    uploads = temp_dir / "UPLOADS"
    uploads.mkdir(parents=True)
    return uploads


# =============================================================================
# Test Data Fixtures
# =============================================================================

@pytest.fixture(scope="session")
def test_data_dir():
    """Path to test data files."""
    # Use existing test file in UPLOADS if available
    data_dir = BACKEND_DIR / "UPLOADS"
    if data_dir.exists():
        return data_dir
    # Fall back to creating a temp directory
    return Path(tempfile.mkdtemp())


@pytest.fixture(scope="session")
def existing_tsz_file(test_data_dir):
    """Path to an existing .tsz file for testing."""
    # Look for any .tsz file in the test data directory
    for tsz_file in test_data_dir.rglob("*.tsz"):
        return tsz_file
    return None


@pytest.fixture
def minimal_ts():
    """
    Generate a minimal tree sequence using msprime.

    This creates a small tree sequence suitable for fast unit tests.
    """
    try:
        import msprime

        ts = msprime.sim_ancestry(
            samples=10,
            population_size=1000,
            sequence_length=10000,
            recombination_rate=1e-8,
            random_seed=42
        )
        # Add mutations
        ts = msprime.sim_mutations(ts, rate=1e-8, random_seed=42)
        return ts
    except ImportError:
        pytest.skip("msprime not installed")


@pytest.fixture
def minimal_ts_file(temp_dir, minimal_ts):
    """Save minimal tree sequence to a file."""
    file_path = temp_dir / "test.trees"
    minimal_ts.dump(str(file_path))
    return file_path


@pytest.fixture
def sample_csv_content():
    """Sample CSV content for testing CSV loader."""
    return """id,parent,left,right,time
0,-1,0,10000,100
1,0,0,10000,50
2,0,0,10000,50
3,1,0,10000,0
4,1,0,10000,0
5,2,0,10000,0
6,2,0,10000,0
"""


@pytest.fixture
def sample_csv_file(temp_dir, sample_csv_content):
    """Create a sample CSV file for testing."""
    file_path = temp_dir / "test.csv"
    file_path.write_text(sample_csv_content)
    return file_path


# =============================================================================
# Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_redis():
    """Provide a mock Redis client."""
    return MockRedis()


@pytest.fixture
def mock_gcs_bucket(temp_dir):
    """Provide a mock GCS bucket."""
    bucket = MockGCSBucket(
        bucket_name="test-bucket",
        base_dir=temp_dir / "gcs"
    )
    yield bucket
    bucket.clear()


# =============================================================================
# Session Manager Fixtures
# =============================================================================

@pytest.fixture
async def session_manager_memory():
    """Session manager using in-memory storage."""
    from lorax.session_manager import SessionManager
    manager = SessionManager(redis_url=None)
    yield manager


@pytest.fixture
async def session_manager_redis(mock_redis):
    """Session manager using mock Redis."""
    from lorax.session_manager import SessionManager

    manager = SessionManager(redis_url=None)
    # Replace the redis client with our mock
    manager.redis_client = mock_redis
    yield manager


@pytest.fixture
async def test_session(session_manager_memory):
    """Create a test session."""
    session = await session_manager_memory.create_session()
    return session


# =============================================================================
# Disk Cache Fixtures
# =============================================================================

@pytest.fixture
def disk_cache_manager(temp_dir, mock_redis):
    """Provide a disk cache manager for testing."""
    from lorax.disk_cache import DiskCacheManager

    cache_dir = temp_dir / "cache"
    cache_dir.mkdir(parents=True)

    manager = DiskCacheManager(
        cache_dir=cache_dir,
        max_size_bytes=100 * 1024 * 1024,  # 100 MB
        redis_client=None,  # Use file-based locking
        enabled=True
    )
    return manager


# =============================================================================
# FastAPI Test Client Fixtures
# =============================================================================

@pytest.fixture
def app():
    """Create a fresh FastAPI app for testing."""
    from lorax.lorax_app import app as lorax_app
    return lorax_app


@pytest.fixture
async def async_client(app):
    """Async HTTP client for testing FastAPI routes."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# =============================================================================
# Socket.IO Test Harness
# =============================================================================

class SocketTestHarness:
    """
    Test harness for Socket.IO events.

    Captures emitted events for assertion and provides
    mock socket connections.
    """

    def __init__(self):
        self.emitted_events: List[Dict[str, Any]] = []
        self.connected_sockets: Dict[str, Dict] = {}
        self._event_handlers: Dict[str, Any] = {}

    def create_mock_sio(self):
        """Create a mock Socket.IO server."""
        mock_sio = MagicMock()

        async def mock_emit(event, data, to=None, room=None):
            self.emitted_events.append({
                "event": event,
                "data": data,
                "to": to or room
            })

        async def mock_disconnect(sid):
            if sid in self.connected_sockets:
                del self.connected_sockets[sid]

        mock_sio.emit = mock_emit
        mock_sio.disconnect = mock_disconnect

        # Store event handlers when registered
        def mock_event(func):
            self._event_handlers[func.__name__] = func
            return func

        mock_sio.event = mock_event

        return mock_sio

    async def simulate_connect(self, sid: str, lorax_sid: str = None):
        """Simulate a socket connection."""
        environ = {
            "HTTP_COOKIE": f"lorax_sid={lorax_sid}" if lorax_sid else ""
        }
        self.connected_sockets[sid] = {"lorax_sid": lorax_sid}

        if "connect" in self._event_handlers:
            await self._event_handlers["connect"](sid, environ, None)

    async def simulate_disconnect(self, sid: str):
        """Simulate a socket disconnection."""
        if "disconnect" in self._event_handlers:
            await self._event_handlers["disconnect"](sid)
        self.connected_sockets.pop(sid, None)

    async def call_event(self, event_name: str, sid: str, data: Dict):
        """Call a registered event handler."""
        if event_name in self._event_handlers:
            return await self._event_handlers[event_name](sid, data)
        raise ValueError(f"Event handler not found: {event_name}")

    def get_emitted(self, event_name: str = None) -> List[Dict]:
        """Get emitted events, optionally filtered by event name."""
        if event_name:
            return [e for e in self.emitted_events if e["event"] == event_name]
        return self.emitted_events

    def clear_events(self):
        """Clear all recorded events."""
        self.emitted_events.clear()


@pytest.fixture
def socket_harness():
    """Provide a Socket.IO test harness."""
    return SocketTestHarness()


@pytest.fixture
def mock_sio(socket_harness):
    """Provide a mock Socket.IO server."""
    return socket_harness.create_mock_sio()


# =============================================================================
# Integration Test Fixtures
# =============================================================================

@pytest.fixture(scope="module")
def integration_server():
    """
    Marker fixture for tests requiring a running server.

    These tests should be run with the backend started separately:
    lorax serve --reload
    """
    return "http://localhost:8080"


# =============================================================================
# Utility Functions
# =============================================================================

def create_test_session_dict(sid: str, file_path: str = None) -> Dict:
    """Create a session dictionary for testing."""
    from datetime import datetime, timezone

    return {
        "sid": sid,
        "file_path": file_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_activity": datetime.now(timezone.utc).isoformat(),
        "socket_connections": {}
    }


def generate_random_tree_data(num_nodes: int = 100) -> Dict:
    """Generate random tree data for testing."""
    return {
        "node_ids": list(range(num_nodes)),
        "parent_ids": [-1] + list(np.random.randint(0, i) for i in range(1, num_nodes)),
        "times": sorted(np.random.uniform(0, 100, num_nodes).tolist(), reverse=True)
    }
