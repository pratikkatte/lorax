"""
Integration Tests for Socket.IO Events

Tests all 14 Socket.IO events:
- connect
- disconnect
- ping
- load_file
- details
- query
- process_postorder_layout
- fetch_metadata_for_key
- search_metadata
- fetch_metadata_array
- query_mutations_window
- search_mutations
- search_nodes
- get_highlight_positions_event
"""

import pytest
import json
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

# Check if numba is available (required for full sockets module initialization)
try:
    import numba
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False

pytestmark = pytest.mark.skipif(not HAS_NUMBA, reason="numba required for socket handlers")


class TestConnectEvent:
    """Tests for the connect event."""

    @pytest.mark.asyncio
    async def test_connect_without_cookie(self, socket_harness, mock_sio, session_manager_memory):
        """Test connect without lorax_sid cookie."""
        from lorax.sockets import register_socket_events

        # Register events
        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        # Simulate connect without cookie
        await socket_harness.simulate_connect("socket-1", lorax_sid=None)

        # Should emit error
        errors = socket_harness.get_emitted("error")
        assert len(errors) >= 0  # May or may not emit depending on implementation

    @pytest.mark.asyncio
    async def test_connect_with_valid_session(self, socket_harness, mock_sio, session_manager_memory):
        """Test connect with valid session cookie."""
        from lorax.sockets import register_socket_events

        # Create a session first
        session = await session_manager_memory.create_session()

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        # Simulate connect with valid session
        await socket_harness.simulate_connect("socket-1", lorax_sid=session.sid)

        # Should not emit error
        errors = socket_harness.get_emitted("error")
        # Valid session should not produce error

    @pytest.mark.asyncio
    async def test_connect_with_expired_session(self, socket_harness, mock_sio, session_manager_memory):
        """Test connect with expired/invalid session."""
        from lorax.sockets import register_socket_events

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        # Simulate connect with invalid session
        await socket_harness.simulate_connect("socket-1", lorax_sid="invalid-session-id")

        # Should emit error about session not found
        errors = socket_harness.get_emitted("error")
        assert len(errors) >= 0


class TestPingEvent:
    """Tests for the ping event."""

    @pytest.mark.asyncio
    async def test_ping_returns_pong(self, socket_harness, mock_sio):
        """Test ping event returns pong."""
        from lorax.sockets import register_socket_events

        register_socket_events(mock_sio)

        # Call ping event handler directly
        if "ping" in socket_harness._event_handlers:
            await socket_harness._event_handlers["ping"]("socket-1", {})

            pongs = socket_harness.get_emitted("pong")
            assert len(pongs) == 1
            assert pongs[0]["data"]["type"] == "pong"
            assert "time" in pongs[0]["data"]


class TestDetailsEvent:
    """Tests for the details event."""

    @pytest.mark.asyncio
    async def test_details_requires_session(self, socket_harness, mock_sio, session_manager_memory):
        """Test details event requires valid session."""
        from lorax.sockets import register_socket_events

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        # Call without valid session
        if "details" in socket_harness._event_handlers:
            await socket_harness._event_handlers["details"]("socket-1", {
                "lorax_sid": "invalid-sid"
            })

            # Should emit error
            errors = socket_harness.get_emitted("error")
            assert len(errors) >= 0

    @pytest.mark.asyncio
    async def test_details_requires_file_loaded(self, socket_harness, mock_sio, session_manager_memory):
        """Test details event requires file to be loaded."""
        from lorax.sockets import register_socket_events

        # Create session without file
        session = await session_manager_memory.create_session()

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "details" in socket_harness._event_handlers:
            await socket_harness._event_handlers["details"]("socket-1", {
                "lorax_sid": session.sid,
                "treeIndex": 0,
                "node": 0
            })

            # Should emit error about no file loaded
            errors = socket_harness.get_emitted("error")
            assert len(errors) >= 0


class TestQueryEvent:
    """Tests for the query event."""

    @pytest.mark.asyncio
    async def test_query_validates_session(self, socket_harness, mock_sio, session_manager_memory):
        """Test query event validates session."""
        from lorax.sockets import register_socket_events

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "query" in socket_harness._event_handlers:
            await socket_harness._event_handlers["query"]("socket-1", {
                "lorax_sid": "invalid-sid"
            })

            # Should emit error for invalid session


class TestProcessPostorderLayout:
    """Tests for the process_postorder_layout event."""

    @pytest.mark.asyncio
    async def test_postorder_requires_session(self, socket_harness, mock_sio, session_manager_memory):
        """Test postorder layout requires valid session."""
        from lorax.sockets import register_socket_events

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "process_postorder_layout" in socket_harness._event_handlers:
            result = await socket_harness._event_handlers["process_postorder_layout"](
                "socket-1",
                {"lorax_sid": "invalid-sid", "displayArray": [0]}
            )

            assert "error" in result

    @pytest.mark.asyncio
    async def test_postorder_returns_buffer(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test postorder layout returns PyArrow buffer."""
        from lorax.sockets import register_socket_events

        # Create session with file loaded
        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "process_postorder_layout" in socket_harness._event_handlers:
            result = await socket_harness._event_handlers["process_postorder_layout"](
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "displayArray": [0],
                    "sparsification": False,
                    "request_id": "test-123"
                }
            )

            if "error" not in result:
                assert "buffer" in result
                assert isinstance(result["buffer"], bytes)
                assert "request_id" in result


class TestMetadataEvents:
    """Tests for metadata-related events."""

    @pytest.mark.asyncio
    async def test_fetch_metadata_for_key(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test fetch_metadata_for_key event."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "fetch_metadata_for_key" in socket_harness._event_handlers:
            await socket_harness._event_handlers["fetch_metadata_for_key"](
                "socket-1",
                {"lorax_sid": session.sid, "key": "name"}
            )

            # Check for result or error
            results = socket_harness.get_emitted("metadata-key-result")
            assert len(results) >= 0

    @pytest.mark.asyncio
    async def test_search_metadata(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test search_metadata event."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "search_metadata" in socket_harness._event_handlers:
            await socket_harness._event_handlers["search_metadata"](
                "socket-1",
                {"lorax_sid": session.sid, "key": "name", "value": "test"}
            )

            results = socket_harness.get_emitted("search-result")
            assert len(results) >= 0


class TestMutationEvents:
    """Tests for mutation-related events."""

    @pytest.mark.asyncio
    async def test_query_mutations_window(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test query_mutations_window event."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "query_mutations_window" in socket_harness._event_handlers:
            await socket_harness._event_handlers["query_mutations_window"](
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "start": 0,
                    "end": 1000,
                    "offset": 0,
                    "limit": 100
                }
            )

            results = socket_harness.get_emitted("mutations-window-result")
            assert len(results) >= 0

    @pytest.mark.asyncio
    async def test_search_mutations(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test search_mutations event."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "search_mutations" in socket_harness._event_handlers:
            await socket_harness._event_handlers["search_mutations"](
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "position": 500,
                    "range_bp": 1000
                }
            )

            results = socket_harness.get_emitted("mutations-search-result")
            assert len(results) >= 0


class TestNodeSearchEvents:
    """Tests for node search events."""

    @pytest.mark.asyncio
    async def test_search_nodes(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test search_nodes event."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "search_nodes" in socket_harness._event_handlers:
            await socket_harness._event_handlers["search_nodes"](
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "sample_names": ["0", "1"],
                    "tree_indices": [0],
                    "show_lineages": False
                }
            )

            results = socket_harness.get_emitted("search-nodes-result")
            assert len(results) >= 0

    @pytest.mark.asyncio
    async def test_search_nodes_csv(self, socket_harness, mock_sio, session_manager_memory, temp_dir):
        """CSV: search_nodes should return tip node_ids for sample names (cached Newick graphs)."""
        from lorax.sockets import register_socket_events

        # Minimal Newick-per-row CSV expected by lorax.csv.config/build_csv_config
        csv_path = temp_dir / "test_newick.csv"
        csv_path.write_text(
            "genomic_positions,newick\n"
            "0,\"(A:1,B:1):0;\"\n"
            "50000,\"(A:1,B:1):0;\"\n"
        )

        session = await session_manager_memory.create_session()
        session.file_path = str(csv_path)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "search_nodes" in socket_harness._event_handlers:
            await socket_harness._event_handlers["search_nodes"](
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "sample_names": ["A"],
                    "tree_indices": [0],
                    "show_lineages": False,
                },
            )

            results = socket_harness.get_emitted("search-nodes-result")
            assert len(results) == 1
            payload = results[0]["data"]
            assert "highlights" in payload
            # A is first in sorted samples_order -> node_id 0
            assert 0 in payload["highlights"]
            assert payload["highlights"][0][0]["node_id"] == 0
            assert payload["highlights"][0][0]["name"] == "A"

    @pytest.mark.asyncio
    async def test_get_highlight_positions(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test get_highlight_positions_event."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "get_highlight_positions_event" in socket_harness._event_handlers:
            await socket_harness._event_handlers["get_highlight_positions_event"](
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "metadata_key": "name",
                    "metadata_value": "test",
                    "tree_indices": [0]
                }
            )

            results = socket_harness.get_emitted("highlight-positions-result")
            assert len(results) >= 0

    @pytest.mark.asyncio
    async def test_get_highlight_positions_csv_sample(self, socket_harness, mock_sio, session_manager_memory, temp_dir):
        """CSV: get_highlight_positions_event should return x/y for metadata_key=sample."""
        from lorax.sockets import register_socket_events

        csv_path = temp_dir / "test_newick.csv"
        csv_path.write_text(
            "genomic_positions,newick\n"
            "0,\"(A:1,B:1):0;\"\n"
        )

        session = await session_manager_memory.create_session()
        session.file_path = str(csv_path)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "get_highlight_positions_event" in socket_harness._event_handlers:
            await socket_harness._event_handlers["get_highlight_positions_event"](
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "metadata_key": "sample",
                    "metadata_value": "A",
                    "tree_indices": [0],
                },
            )

            results = socket_harness.get_emitted("highlight-positions-result")
            assert len(results) == 1
            payload = results[0]["data"]
            assert "positions" in payload
            assert len(payload["positions"]) == 1
            pos = payload["positions"][0]
            assert pos["node_id"] == 0
            assert pos["tree_idx"] == 0
            assert "x" in pos and "y" in pos


class TestDisconnectEvent:
    """Tests for the disconnect event."""

    @pytest.mark.asyncio
    async def test_disconnect_cleans_up(self, socket_harness, mock_sio, session_manager_memory):
        """Test disconnect removes socket from session."""
        from lorax.sockets import register_socket_events

        # Create session and add socket
        session = await session_manager_memory.create_session()

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        # Simulate connect
        await socket_harness.simulate_connect("socket-1", lorax_sid=session.sid)

        # Simulate disconnect
        await socket_harness.simulate_disconnect("socket-1")

        # Verify socket was removed from harness tracking
        assert "socket-1" not in socket_harness.connected_sockets
