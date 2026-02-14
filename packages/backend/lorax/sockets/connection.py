"""
Connection event handlers for Lorax Socket.IO.

Handles connect/disconnect events and optional diagnostic ping.
"""

from datetime import datetime
from http.cookies import SimpleCookie

from lorax.context import session_manager
from lorax.constants import (
    ERROR_SESSION_NOT_FOUND,
    ERROR_CONNECTION_REPLACED,
    SOCKET_DIAGNOSTIC_PING_ENABLED,
)


# Mapping from socket_sid to lorax_sid for disconnect handling
_socket_to_session: dict = {}


def register_connection_events(sio):
    """Register connection-related socket events."""

    @sio.event
    async def connect(sid, environ, auth=None):
        print(f"🔌 Socket.IO connected: {sid}")

        cookie = environ.get("HTTP_COOKIE", "")
        cookies = SimpleCookie()
        cookies.load(cookie)

        lorax_sid_cookie = cookies.get("lorax_sid")
        session_id = lorax_sid_cookie.value if lorax_sid_cookie else None

        if not session_id:
            print(f"⚠️ No lorax_sid cookie found for socket {sid}")
            await sio.emit("error", {
                "code": ERROR_SESSION_NOT_FOUND,
                "message": "Session not found. Please refresh the page."
            }, to=sid)
            return

        # Validate session exists
        session = await session_manager.get_session(session_id)
        if not session:
            print(f"⚠️ Session not found: {session_id}")
            await sio.emit("error", {
                "code": ERROR_SESSION_NOT_FOUND,
                "message": "Session expired. Please refresh the page."
            }, to=sid)
            return

        # Track this socket connection
        replaced_socket_sid = session.add_socket(sid)
        await session_manager.save_session(session)

        # Store mapping for disconnect handling
        _socket_to_session[sid] = session_id

        # If we replaced an old connection, notify it
        if replaced_socket_sid:
            print(f"🔄 Replacing old socket {replaced_socket_sid} with new socket {sid}")
            await sio.emit("connection-replaced", {
                "code": ERROR_CONNECTION_REPLACED,
                "message": "This connection was replaced by a newer tab. Please use the new tab.",
            }, to=replaced_socket_sid)
            # Disconnect the old socket
            try:
                await sio.disconnect(replaced_socket_sid)
            except Exception as e:
                print(f"Warning: Failed to disconnect old socket: {e}")

        # Send session state
        if session.file_path:
            await sio.emit("session-restored", {
                "lorax_sid": session_id,
                "file_path": session.file_path
            }, to=sid)
        else:
            await sio.emit("status", {
                "message": "Connected",
                "lorax_sid": session_id
            }, to=sid)

    @sio.event
    async def disconnect(sid):
        print(f"🔌 Socket.IO disconnected: {sid}")

        # Remove socket from session tracking
        session_id = _socket_to_session.pop(sid, None)
        if session_id:
            session = await session_manager.get_session(session_id)
            if session:
                session.remove_socket(sid)
                await session_manager.save_session(session)

    if SOCKET_DIAGNOSTIC_PING_ENABLED:
        @sio.event
        async def ping(sid, data):
            await sio.emit("pong", {
                "type": "pong",
                "time": datetime.utcnow().isoformat()
            }, to=sid)
