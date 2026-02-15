import asyncio
from unittest.mock import AsyncMock
from unittest.mock import patch


class MockSio:
    def __init__(self):
        self.handlers = {}
        self.emit = AsyncMock()
        self.disconnect = AsyncMock()

    def event(self, fn):
        self.handlers[fn.__name__] = fn
        return fn


def test_ping_handler_not_registered_by_default():
    from lorax.sockets.connection import register_connection_events

    sio = MockSio()
    with patch("lorax.sockets.connection.SOCKET_DIAGNOSTIC_PING_ENABLED", False):
        register_connection_events(sio)

    assert "ping" not in sio.handlers


def test_ping_handler_registered_when_enabled():
    from lorax.sockets.connection import register_connection_events

    sio = MockSio()
    with patch("lorax.sockets.connection.SOCKET_DIAGNOSTIC_PING_ENABLED", True):
        register_connection_events(sio)

    assert "ping" in sio.handlers

    asyncio.run(sio.handlers["ping"]("socket-1", {}))
    sio.emit.assert_awaited_once()
    emitted_event, payload = sio.emit.await_args.args[0], sio.emit.await_args.args[1]
    emitted_to = sio.emit.await_args.kwargs.get("to")
    assert emitted_event == "pong"
    assert payload["type"] == "pong"
    assert emitted_to == "socket-1"

