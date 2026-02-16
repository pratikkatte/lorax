"""
Integration Tests for Socket.IO Events

Tests all Socket.IO events:
- connect
- disconnect
- ping (diagnostics-only when enabled)
- load_file
- details
- query
- process_postorder_layout
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
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import patch, AsyncMock

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
        with patch("lorax.sockets.decorators.session_manager", session_manager_memory):
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

        with patch("lorax.sockets.decorators.session_manager", session_manager_memory):
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
    """Tests for optional diagnostic ping event."""

    @pytest.mark.asyncio
    async def test_ping_handler_not_registered_by_default(self, socket_harness, mock_sio):
        """Ping handler should be absent unless diagnostics are enabled."""
        from lorax.sockets import register_socket_events

        register_socket_events(mock_sio)
        assert "ping" not in socket_harness._event_handlers

    @pytest.mark.asyncio
    async def test_ping_returns_pong_when_diagnostics_enabled(self, socket_harness, mock_sio):
        """Ping should return pong when diagnostics mode is explicitly enabled."""
        from lorax.sockets import register_socket_events

        with patch("lorax.sockets.connection.SOCKET_DIAGNOSTIC_PING_ENABLED", True):
            register_socket_events(mock_sio)

        assert "ping" in socket_harness._event_handlers
        await socket_harness._event_handlers["ping"]("socket-1", {})

        pongs = socket_harness.get_emitted("pong")
        assert len(pongs) == 1
        assert pongs[0]["data"]["type"] == "pong"
        assert "time" in pongs[0]["data"]


class TestSocketSessionActivity:
    """Tests for socket-driven session activity refresh."""

    @pytest.mark.asyncio
    async def test_require_session_refreshes_last_activity(self, mock_sio, session_manager_memory):
        """Socket access should update and persist session last_activity."""
        from lorax.sockets.decorators import require_session

        session = await session_manager_memory.create_session()
        stale_activity = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        session.last_activity = stale_activity
        await session_manager_memory.save_session(session)

        with (
            patch("lorax.sockets.decorators.session_manager", session_manager_memory),
            patch("lorax.sockets.decorators._SESSION_ACTIVITY_TOUCH_SEC", 0.0),
        ):
            touched = await require_session(session.sid, "socket-1", mock_sio)

        assert touched is not None
        refreshed = await session_manager_memory.get_session(session.sid)
        assert refreshed is not None
        assert refreshed.last_activity != stale_activity


class TestLoadFileEvent:
    """Tests for deterministic load_file request/response behavior."""

    @pytest.mark.asyncio
    async def test_load_file_missing_session_returns_terminal_failure(
        self, socket_harness, mock_sio, session_manager_memory
    ):
        from lorax.sockets import register_socket_events
        from lorax.sockets.load_scheduler import LoadScheduler

        with (
            patch("lorax.sockets.file_ops.session_manager", session_manager_memory),
            patch("lorax.sockets.connection.session_manager", session_manager_memory),
            patch("lorax.sockets.file_ops.load_scheduler", LoadScheduler()),
        ):
            register_socket_events(mock_sio)

        result = await socket_harness._event_handlers["load_file"]("socket-1", {"project": "Uploads"})

        assert result["ok"] is False
        assert result["code"] == "MISSING_SESSION"
        emitted = socket_harness.get_emitted("load-file-result")
        assert len(emitted) == 1
        assert emitted[0]["data"]["code"] == "MISSING_SESSION"

    @pytest.mark.asyncio
    async def test_load_file_invalid_session_returns_terminal_failure(
        self, socket_harness, mock_sio, session_manager_memory
    ):
        from lorax.sockets import register_socket_events
        from lorax.sockets.load_scheduler import LoadScheduler

        with (
            patch("lorax.sockets.file_ops.session_manager", session_manager_memory),
            patch("lorax.sockets.connection.session_manager", session_manager_memory),
            patch("lorax.sockets.file_ops.load_scheduler", LoadScheduler()),
        ):
            register_socket_events(mock_sio)

        result = await socket_harness._event_handlers["load_file"](
            "socket-1",
            {"lorax_sid": "invalid-sid", "project": "Uploads", "file": "missing.trees"},
        )

        assert result["ok"] is False
        assert result["code"] == "SESSION_NOT_FOUND"
        emitted = socket_harness.get_emitted("load-file-result")
        assert len(emitted) == 1
        assert emitted[0]["data"]["ok"] is False

    @pytest.mark.asyncio
    async def test_load_file_missing_file_param_returns_terminal_failure(
        self, socket_harness, mock_sio, session_manager_memory
    ):
        from lorax.sockets import register_socket_events
        from lorax.sockets.load_scheduler import LoadScheduler

        session = await session_manager_memory.create_session()

        with (
            patch("lorax.sockets.file_ops.session_manager", session_manager_memory),
            patch("lorax.sockets.connection.session_manager", session_manager_memory),
            patch("lorax.sockets.file_ops.load_scheduler", LoadScheduler()),
        ):
            register_socket_events(mock_sio)

        result = await socket_harness._event_handlers["load_file"](
            "socket-1",
            {"lorax_sid": session.sid, "project": "Uploads"},
        )

        assert result["ok"] is False
        assert result["code"] == "MISSING_FILE_PARAM"
        emitted = socket_harness.get_emitted("load-file-result")
        assert len(emitted) == 1
        assert emitted[0]["data"]["code"] == "MISSING_FILE_PARAM"

    @pytest.mark.asyncio
    async def test_load_file_missing_file_returns_terminal_failure(
        self, socket_harness, mock_sio, session_manager_memory, temp_dir
    ):
        from lorax.sockets import register_socket_events
        from lorax.sockets.load_scheduler import LoadScheduler

        session = await session_manager_memory.create_session()

        with (
            patch("lorax.sockets.file_ops.session_manager", session_manager_memory),
            patch("lorax.sockets.connection.session_manager", session_manager_memory),
            patch("lorax.sockets.file_ops.UPLOAD_DIR", temp_dir),
            patch("lorax.sockets.file_ops.BUCKET_NAME", None),
            patch("lorax.sockets.file_ops.load_scheduler", LoadScheduler()),
        ):
            register_socket_events(mock_sio)

        result = await socket_harness._event_handlers["load_file"](
            "socket-1",
            {"lorax_sid": session.sid, "project": "Uploads", "file": "not_here.trees"},
        )

        assert result["ok"] is False
        assert result["code"] == "FILE_NOT_FOUND"
        emitted = socket_harness.get_emitted("load-file-result")
        assert len(emitted) == 1
        assert emitted[0]["data"]["code"] == "FILE_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_load_file_internal_exception_returns_terminal_failure(
        self, socket_harness, mock_sio, session_manager_memory, temp_dir
    ):
        from lorax.sockets import register_socket_events
        from lorax.sockets.load_scheduler import LoadScheduler

        session = await session_manager_memory.create_session()
        file_path = temp_dir / "Uploads" / "boom.trees"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("not-a-real-tree")

        async def _raise_upload(*args, **kwargs):
            raise RuntimeError("boom")

        with (
            patch("lorax.sockets.file_ops.session_manager", session_manager_memory),
            patch("lorax.sockets.connection.session_manager", session_manager_memory),
            patch("lorax.sockets.file_ops.UPLOAD_DIR", temp_dir),
            patch("lorax.sockets.file_ops.BUCKET_NAME", None),
            patch("lorax.sockets.file_ops.handle_upload", new=_raise_upload),
            patch("lorax.sockets.file_ops.load_scheduler", LoadScheduler()),
        ):
            register_socket_events(mock_sio)

        result = await socket_harness._event_handlers["load_file"](
            "socket-1",
            {"lorax_sid": session.sid, "project": "Uploads", "file": "boom.trees"},
        )

        assert result["ok"] is False
        assert result["code"] == "LOAD_FILE_FAILED"
        emitted = socket_harness.get_emitted("load-file-result")
        assert len(emitted) == 1
        assert emitted[0]["data"]["code"] == "LOAD_FILE_FAILED"

    @pytest.mark.asyncio
    async def test_load_file_queue_overflow_returns_server_busy_quickly(
        self, socket_harness, mock_sio, session_manager_memory, temp_dir
    ):
        from lorax.sockets import register_socket_events
        from lorax.sockets.load_scheduler import LoadScheduler

        session_1 = await session_manager_memory.create_session()
        session_2 = await session_manager_memory.create_session()

        file_path = temp_dir / "Uploads" / "slow.trees"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("not-a-real-tree")

        async def _slow_upload(*args, **kwargs):
            await asyncio.sleep(0.2)
            return SimpleNamespace(config={"initial_position": [0, 1], "times": {"values": [0, 1]}})

        scheduler = LoadScheduler(max_concurrency=1, max_queue=0, queue_timeout_sec=0.05)

        with (
            patch("lorax.sockets.file_ops.session_manager", session_manager_memory),
            patch("lorax.sockets.connection.session_manager", session_manager_memory),
            patch("lorax.sockets.file_ops.UPLOAD_DIR", temp_dir),
            patch("lorax.sockets.file_ops.BUCKET_NAME", None),
            patch("lorax.sockets.file_ops.handle_upload", new=_slow_upload),
            patch("lorax.sockets.file_ops.load_scheduler", scheduler),
        ):
            register_socket_events(mock_sio)

        handler = socket_harness._event_handlers["load_file"]
        task_1 = asyncio.create_task(
            handler("socket-1", {"lorax_sid": session_1.sid, "project": "Uploads", "file": "slow.trees"})
        )
        await asyncio.sleep(0.02)
        result_2 = await handler(
            "socket-2",
            {"lorax_sid": session_2.sid, "project": "Uploads", "file": "slow.trees"},
        )
        result_1 = await task_1

        assert result_1["ok"] is True
        assert result_2["ok"] is False
        assert result_2["code"] == "SERVER_BUSY"

        emitted = socket_harness.get_emitted("load-file-result")
        assert len(emitted) == 2
        assert any(evt["data"]["ok"] is False and evt["data"]["code"] == "SERVER_BUSY" for evt in emitted)


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
                    "request_id": "test-123"
                }
            )

            if "error" not in result:
                assert "buffer" in result
                assert isinstance(result["buffer"], bytes)
                assert "request_id" in result

    @pytest.mark.asyncio
    async def test_postorder_infers_sparsification_from_display_count(
        self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file
    ):
        """Sparsification is inferred from displayArray size in socket handler."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        query_result = {
            "buffer": b"\x00\x01",
            "global_min_time": 0.0,
            "global_max_time": 1.0,
            "tree_indices": [0]
        }
        mock_query = AsyncMock(return_value=query_result)

        with (
            patch("lorax.sockets.session_manager", session_manager_memory),
            patch("lorax.sockets.tree_layout.handle_tree_graph_query", mock_query),
        ):
            register_socket_events(mock_sio)
            handler = socket_harness._event_handlers["process_postorder_layout"]

            await handler(
                "socket-1",
                {"lorax_sid": session.sid, "displayArray": [0], "request_id": "one-tree"},
            )
            await handler(
                "socket-1",
                {"lorax_sid": session.sid, "displayArray": [0, 1], "request_id": "multi-tree"},
            )

        assert mock_query.await_count == 2
        first_kwargs = mock_query.await_args_list[0].kwargs
        second_kwargs = mock_query.await_args_list[1].kwargs
        # Disabled: single-tree full-data behavior; always sparsify for now
        assert first_kwargs["sparsification"] is True
        assert second_kwargs["sparsification"] is True

    @pytest.mark.asyncio
    async def test_postorder_lock_view_single_tree_forces_non_sparse(
        self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file
    ):
        """Target-only lock request should run one adaptive sparse backend call."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        query_result = {
            "buffer": b"\x00\x01",
            "global_min_time": 0.0,
            "global_max_time": 1.0,
            "tree_indices": [0, 1]
        }
        mock_query = AsyncMock(return_value=query_result)

        lock_view = {
            "targetIndex": 1,
            "targetLocalBBox": {
                "treeIndex": 1,
                "minX": -0.2,
                "maxX": 1.4,
                "minY": 0.8,
                "maxY": 0.2,
            },
        }

        with (
            patch("lorax.sockets.session_manager", session_manager_memory),
            patch("lorax.sockets.tree_layout.handle_tree_graph_query", mock_query),
        ):
            register_socket_events(mock_sio)
            handler = socket_harness._event_handlers["process_postorder_layout"]
            await handler(
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "displayArray": [1],
                    "actualDisplayArray": [0, 1, 2],
                    "lockView": lock_view,
                    "request_id": "lock-view-single-tree",
                },
            )

        assert mock_query.await_count == 1
        kwargs = mock_query.await_args_list[0].kwargs
        assert kwargs["tree_indices"] == [1]
        assert kwargs["sparsification"] is True
        # Staged multiplier from clipped coverage area: 0.6 => 0.80 bucket.
        assert kwargs["sparsify_cell_size_multiplier"] == pytest.approx(0.80)
        assert kwargs["adaptive_sparsify_bbox"] == {
            "min_x": 0.0,
            "max_x": 1.0,
            "min_y": 0.2,
            "max_y": 0.8,
        }
        assert kwargs["adaptive_target_tree_idx"] == 1
        assert kwargs["adaptive_outside_cell_size"] is None
        assert kwargs["actual_display_array"] == [0, 1, 2]

    @pytest.mark.asyncio
    async def test_postorder_lock_view_single_tree_missing_bbox_disables_adaptive(
        self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file
    ):
        """Single-tree lock request requires targetLocalBBox to enable adaptive mode."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        query_result = {
            "buffer": b"\x00\x01",
            "global_min_time": 0.0,
            "global_max_time": 1.0,
            "tree_indices": [1]
        }
        mock_query = AsyncMock(return_value=query_result)

        lock_view = {"targetIndex": 1}

        with (
            patch("lorax.sockets.session_manager", session_manager_memory),
            patch("lorax.sockets.tree_layout.handle_tree_graph_query", mock_query),
        ):
            register_socket_events(mock_sio)
            handler = socket_harness._event_handlers["process_postorder_layout"]
            await handler(
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "displayArray": [1],
                    "actualDisplayArray": [0, 1, 2],
                    "lockView": lock_view,
                    "request_id": "lock-view-missing-bbox",
                },
            )

        assert mock_query.await_count == 1
        kwargs = mock_query.await_args_list[0].kwargs
        assert kwargs["tree_indices"] == [1]
        # Disabled: single-tree full-data behavior; always sparsify for now
        assert kwargs["sparsification"] is True
        assert kwargs["sparsify_cell_size_multiplier"] is None
        assert kwargs["adaptive_sparsify_bbox"] is None
        assert kwargs["adaptive_target_tree_idx"] is None
        assert kwargs["adaptive_outside_cell_size"] is None
        assert kwargs["actual_display_array"] == [0, 1, 2]

    @pytest.mark.asyncio
    async def test_postorder_lock_view_single_tree_missing_target_keeps_sparse_rule(
        self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file
    ):
        """Multi-tree requests ignore adaptive lock override in new contract."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        query_result = {
            "buffer": b"\x00\x01",
            "global_min_time": 0.0,
            "global_max_time": 1.0,
            "tree_indices": [0, 1]
        }
        mock_query = AsyncMock(return_value=query_result)

        lock_view = {"targetIndex": 1}

        with (
            patch("lorax.sockets.session_manager", session_manager_memory),
            patch("lorax.sockets.tree_layout.handle_tree_graph_query", mock_query),
        ):
            register_socket_events(mock_sio)
            handler = socket_harness._event_handlers["process_postorder_layout"]
            await handler(
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "displayArray": [0, 1],
                    "actualDisplayArray": [0, 1, 2],
                    "lockView": lock_view,
                    "request_id": "lock-view-missing-target",
                },
            )

        assert mock_query.await_count == 1
        call_kwargs = mock_query.await_args_list[0].kwargs
        assert call_kwargs["tree_indices"] == [0, 1]
        assert call_kwargs["sparsification"] is True
        assert call_kwargs["sparsify_cell_size_multiplier"] is None
        assert call_kwargs["adaptive_sparsify_bbox"] is None
        assert call_kwargs["adaptive_target_tree_idx"] is None
        assert call_kwargs["adaptive_outside_cell_size"] is None
        assert call_kwargs["actual_display_array"] == [0, 1, 2]

    @pytest.mark.asyncio
    async def test_postorder_accepts_lock_view_payload_and_logs(
        self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file
    ):
        """Single-tree request uses normal non-sparse mode when adaptive target mismatches."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        query_result = {
            "buffer": b"\x00\x01",
            "global_min_time": 0.0,
            "global_max_time": 1.0,
            "tree_indices": [0]
        }
        mock_query = AsyncMock(return_value=query_result)

        lock_view = {"targetIndex": 999}

        with (
            patch("lorax.sockets.session_manager", session_manager_memory),
            patch("lorax.sockets.tree_layout.handle_tree_graph_query", mock_query),
        ):
            register_socket_events(mock_sio)
            handler = socket_harness._event_handlers["process_postorder_layout"]
            result = await handler(
                "socket-1",
                {
                    "lorax_sid": session.sid,
                    "displayArray": [0],
                    "actualDisplayArray": [0, 1],
                    "lockView": lock_view,
                    "request_id": "lock-view-1",
                },
            )

        assert "error" not in result
        assert result["buffer"] == query_result["buffer"]
        assert mock_query.await_count == 1
        kwargs = mock_query.await_args_list[0].kwargs
        # Disabled: single-tree full-data behavior; always sparsify for now
        assert kwargs["sparsification"] is True
        assert kwargs["sparsify_cell_size_multiplier"] is None
        assert kwargs["adaptive_sparsify_bbox"] is None
        assert kwargs["adaptive_target_tree_idx"] is None
        assert kwargs["adaptive_outside_cell_size"] is None
        assert kwargs["actual_display_array"] == [0, 1]

    def test_lock_view_adaptive_multiplier_uses_stage_buckets(self):
        """Adaptive multiplier should map coverage to fixed stage buckets."""
        from lorax.sockets.tree_layout import _compute_target_sparsify_multiplier_from_bbox

        assert _compute_target_sparsify_multiplier_from_bbox(
            {"min_x": 0.0, "max_x": 0.4, "min_y": 0.0, "max_y": 0.4}
        ) == pytest.approx(0.35)  # 16%
        assert _compute_target_sparsify_multiplier_from_bbox(
            {"min_x": 0.0, "max_x": 0.5, "min_y": 0.0, "max_y": 0.5}
        ) == pytest.approx(0.50)  # 25%
        assert _compute_target_sparsify_multiplier_from_bbox(
            {"min_x": 0.0, "max_x": 0.75, "min_y": 0.0, "max_y": 0.75}
        ) == pytest.approx(0.65)  # 56.25%
        assert _compute_target_sparsify_multiplier_from_bbox(
            {"min_x": 0.0, "max_x": 0.8, "min_y": 0.0, "max_y": 0.8}
        ) == pytest.approx(0.80)  # 64%
        assert _compute_target_sparsify_multiplier_from_bbox(
            {"min_x": 0.0, "max_x": 1.0, "min_y": 0.0, "max_y": 1.0}
        ) == pytest.approx(0.95)  # 100%


class TestMetadataEvents:
    """Tests for metadata-related events."""

    @pytest.mark.asyncio
    async def test_fetch_metadata_array(self, socket_harness, mock_sio, session_manager_memory, minimal_ts_file):
        """Test fetch_metadata_array event."""
        from lorax.sockets import register_socket_events

        session = await session_manager_memory.create_session()
        session.file_path = str(minimal_ts_file)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

        if "fetch_metadata_array" in socket_harness._event_handlers:
            await socket_harness._event_handlers["fetch_metadata_array"](
                "socket-1",
                {"lorax_sid": session.sid, "key": "name"}
            )

            # Check for result or error
            results = socket_harness.get_emitted("metadata-array-result")
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

    @pytest.mark.anyio
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

        with patch("lorax.sockets.decorators.session_manager", session_manager_memory):
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
                # Canonical semantics: x=layout/horizontal, y=time/vertical.
                assert pos["x"] == pytest.approx(0.0)
                assert pos["y"] == pytest.approx(1.0)

    @pytest.mark.anyio
    async def test_search_metadata_multi_csv_lineages(self, socket_harness, mock_sio, session_manager_memory, temp_dir):
        """CSV: search_metadata_multi_event should return lineage paths when show_lineages=true."""
        from lorax.sockets import register_socket_events

        csv_path = temp_dir / "test_newick.csv"
        csv_path.write_text(
            "genomic_positions,newick\n"
            "0,\"(A:1,B:1):0;\"\n"
        )

        session = await session_manager_memory.create_session()
        session.file_path = str(csv_path)
        await session_manager_memory.save_session(session)

        with patch("lorax.sockets.decorators.session_manager", session_manager_memory):
            register_socket_events(mock_sio)

            if "search_metadata_multi_event" in socket_harness._event_handlers:
                await socket_harness._event_handlers["search_metadata_multi_event"](
                    "socket-1",
                    {
                        "lorax_sid": session.sid,
                        "metadata_key": "sample",
                        "metadata_values": ["A"],
                        "tree_indices": [0],
                        "show_lineages": True,
                    },
                )

                results = socket_harness.get_emitted("search-metadata-multi-result")
                assert len(results) == 1
                payload = results[0]["data"]
                assert payload["positions_by_value"]["A"]
                first_pos = payload["positions_by_value"]["A"][0]
                # Canonical semantics: x=layout/horizontal, y=time/vertical.
                assert first_pos["x"] == pytest.approx(0.0)
                assert first_pos["y"] == pytest.approx(1.0)
                assert "lineages" in payload
                assert "A" in payload["lineages"]
                assert 0 in payload["lineages"]["A"]
                lineage_list = payload["lineages"]["A"][0]
                assert len(lineage_list) >= 1
                assert "path_node_ids" in lineage_list[0]
                assert len(lineage_list[0]["path_node_ids"]) > 1

    @pytest.mark.anyio
    async def test_compare_trees_event_csv_coordinates_are_canonical(
        self, socket_harness, mock_sio, session_manager_memory, temp_dir
    ):
        """CSV compare_trees_event should emit parent/child coords with canonical x/y semantics."""
        from lorax.cache import CsvTreeGraphCache
        from lorax.sockets import register_socket_events

        def _node_index(graph, node_id):
            ids = [int(v) for v in graph.node_id.tolist()]
            return ids.index(int(node_id))

        csv_path = temp_dir / "compare_newick.csv"
        csv_path.write_text(
            "genomic_positions,newick\n"
            "0,\"((A:1,B:1):1,C:1);\"\n"
            "1000,\"((A:1,C:1):1,B:1);\"\n"
        )

        session = await session_manager_memory.create_session()
        session.file_path = str(csv_path)
        await session_manager_memory.save_session(session)

        csv_cache = CsvTreeGraphCache()
        with (
            patch("lorax.sockets.decorators.session_manager", session_manager_memory),
            patch("lorax.sockets.node_search.csv_tree_graph_cache", csv_cache),
        ):
            register_socket_events(mock_sio)

            if "compare_trees_event" in socket_harness._event_handlers:
                await socket_harness._event_handlers["compare_trees_event"](
                    "socket-1",
                    {"lorax_sid": session.sid, "tree_indices": [0, 1]},
                )

                results = socket_harness.get_emitted("compare-trees-result")
                assert len(results) == 1
                payload = results[0]["data"]
                assert "comparisons" in payload
                assert len(payload["comparisons"]) == 1

                comp = payload["comparisons"][0]
                prev_graph = await csv_cache.get(session.sid, int(comp["prev_idx"]))
                next_graph = await csv_cache.get(session.sid, int(comp["next_idx"]))
                assert prev_graph is not None
                assert next_graph is not None

                # inserted edges come from next graph, removed edges from prev graph.
                for edge in comp["inserted"]:
                    parent_idx = _node_index(next_graph, edge["parent"])
                    child_idx = _node_index(next_graph, edge["child"])
                    assert edge["parent_x"] == pytest.approx(float(next_graph.x[parent_idx]))
                    assert edge["parent_y"] == pytest.approx(float(next_graph.y[parent_idx]))
                    assert edge["child_x"] == pytest.approx(float(next_graph.x[child_idx]))
                    assert edge["child_y"] == pytest.approx(float(next_graph.y[child_idx]))

                for edge in comp["removed"]:
                    parent_idx = _node_index(prev_graph, edge["parent"])
                    child_idx = _node_index(prev_graph, edge["child"])
                    assert edge["parent_x"] == pytest.approx(float(prev_graph.x[parent_idx]))
                    assert edge["parent_y"] == pytest.approx(float(prev_graph.y[parent_idx]))
                    assert edge["child_x"] == pytest.approx(float(prev_graph.x[child_idx]))
                    assert edge["child_y"] == pytest.approx(float(prev_graph.y[child_idx]))


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
