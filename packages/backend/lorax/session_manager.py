
import os
import json
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, Dict, Tuple

import redis.asyncio as aioredis
from fastapi import Request, Response

from lorax.constants import (
    SESSION_COOKIE,
    COOKIE_MAX_AGE,
    MAX_SOCKETS_PER_SESSION,
    ENFORCE_CONNECTION_LIMITS,
)


class Session:
    """Per-user session with socket connection tracking."""

    def __init__(self, sid, file_path=None, socket_connections=None, last_activity=None):
        self.sid = sid
        self.file_path = file_path
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.last_activity = last_activity or self.created_at
        # socket_connections: {socket_sid: connected_at_iso_string}
        self.socket_connections: Dict[str, str] = socket_connections or {}

    def to_dict(self): 
        return {
            "sid": self.sid,
            "file_path": self.file_path,
            "created_at": self.created_at,
            "last_activity": self.last_activity,
            "socket_connections": self.socket_connections,
        }

    @staticmethod
    def from_dict(data):
        session = Session(
            sid=data["sid"],
            file_path=data.get("file_path"),
            socket_connections=data.get("socket_connections", {}),
            last_activity=data.get("last_activity"),
        )
        session.created_at = data.get("created_at", session.created_at)
        return session

    def update_activity(self):
        """Update last activity timestamp."""
        self.last_activity = datetime.now(timezone.utc).isoformat()

    def add_socket(self, socket_sid: str) -> Optional[str]:
        """
        Add a socket connection.

        Returns:
            socket_sid of oldest connection to replace, or None if under limit
        """
        self.update_activity()

        # Check if we need to replace an existing connection
        if ENFORCE_CONNECTION_LIMITS and len(self.socket_connections) >= MAX_SOCKETS_PER_SESSION:
            # Find oldest connection by connected_at timestamp
            oldest_socket = min(
                self.socket_connections.items(),
                key=lambda x: x[1]  # Sort by timestamp
            )
            oldest_socket_sid = oldest_socket[0]
            # Remove oldest
            del self.socket_connections[oldest_socket_sid]
            # Add new
            self.socket_connections[socket_sid] = datetime.now(timezone.utc).isoformat()
            return oldest_socket_sid

        # Under limit, just add
        self.socket_connections[socket_sid] = datetime.now(timezone.utc).isoformat()
        return None

    def remove_socket(self, socket_sid: str):
        """Remove a socket connection."""
        self.socket_connections.pop(socket_sid, None)
        self.update_activity()

    def get_socket_count(self) -> int:
        """Get current socket connection count."""
        return len(self.socket_connections)

    def is_at_connection_limit(self) -> bool:
        """Check if session is at connection limit."""
        if not ENFORCE_CONNECTION_LIMITS:
            return False
        return len(self.socket_connections) >= MAX_SOCKETS_PER_SESSION

class SessionManager:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url
        self.redis_client = None
        self.memory_sessions: Dict[str, Session] = {}
        
        if self.redis_url:
            self.redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
            print(f"✅ SessionManager using Redis at {self.redis_url}")
        else:
            print("⚠️ SessionManager running in in-memory mode")

    async def get_session(self, sid: str) -> Optional[Session]:
        """Retrieve a session by SID."""
        if not sid:
            return None
            
        if self.redis_client:
            data = await self.redis_client.get(f"sessions:{sid}")
            if data:
                return Session.from_dict(json.loads(data))
            return None
        else:
            return self.memory_sessions.get(sid)

    async def create_session(self, sid: str = None) -> Session:
        """Create a new session. If SID provided, verify uniqueness/overwrite if needed."""
        if not sid:
            sid = str(uuid4())
        
        session = Session(sid)
        await self.save_session(session)
        return session

    async def save_session(self, session: Session):
        """Persist session state."""
        if self.redis_client:
            await self.redis_client.setex(
                f"sessions:{session.sid}", 
                COOKIE_MAX_AGE, 
                json.dumps(session.to_dict())
            )
        else:
            self.memory_sessions[session.sid] = session

    async def get_or_create_session(self, request: Request, response: Response):
        """Helper to handle cookie extraction and setting."""
        sid = request.cookies.get(SESSION_COOKIE)
        secure = request.url.scheme == "https"
        
        session = None
        if sid:
            session = await self.get_session(sid)
        
        if not session:
            # Create new if missing or expired
            session = await self.create_session()
            response.set_cookie(
                key=SESSION_COOKIE, 
                value=session.sid, 
                httponly=True, 
                samesite="Lax", 
                max_age=COOKIE_MAX_AGE, 
                secure=secure
            )
        
        return session.sid, session

    async def health_check(self):
        if self.redis_client:
            return await self.redis_client.ping()
        return True
