import json
import time
import asyncio
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, Dict

from lorax.redis_utils import create_redis_client
from fastapi import Request, Response

from lorax.constants import (
    SESSION_COOKIE,
    COOKIE_MAX_AGE,
    MAX_SOCKETS_PER_SESSION,
    ENFORCE_CONNECTION_LIMITS,
    INMEM_TTL_SECONDS,
    CACHE_CLEANUP_INTERVAL_SECONDS,
)

def _is_https_request(request: Request) -> bool:
    """
    Determine whether the *original* request was HTTPS.

    In production, Lorax typically runs behind an HTTPS load balancer / proxy.
    In that setup, the app may see an internal hop as http://, but the proxy
    sets X-Forwarded-Proto=https (or Forwarded: proto=https).
    """
    xf_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if xf_proto:
        return xf_proto == "https"

    forwarded = request.headers.get("forwarded") or ""
    # Minimal parse: look for "proto=https" token anywhere.
    if "proto=https" in forwarded.lower():
        return True

    return request.url.scheme == "https"


def _parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO timestamp string to UTC datetime."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


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
    def __init__(
        self,
        redis_url: Optional[str] = None,
        *,
        redis_client=None,
        redis_cluster: bool = False,
        memory_ttl_seconds: int = INMEM_TTL_SECONDS,
        cleanup_interval_seconds: int = CACHE_CLEANUP_INTERVAL_SECONDS,
    ):
        self.redis_url = redis_url
        self.redis_client = redis_client
        self.redis_cluster = redis_cluster
        self.memory_sessions: Dict[str, Session] = {}
        self.memory_ttl_seconds = max(1, int(memory_ttl_seconds))
        self.cleanup_interval_seconds = max(1, int(cleanup_interval_seconds))
        self._memory_lock = asyncio.Lock()
        self._last_cleanup_monotonic = 0.0

        if self.redis_client is None and self.redis_url:
            self.redis_client = create_redis_client(
                self.redis_url,
                decode_responses=True,
                cluster=self.redis_cluster,
            )

        if self.redis_client:
            print(f"✅ SessionManager using Redis at {self.redis_url}")
        else:
            print(
                "⚠️ SessionManager running in in-memory mode "
                f"(ttl={self.memory_ttl_seconds}s, cleanup={self.cleanup_interval_seconds}s)"
            )

    def _is_memory_session_expired(self, session: Session, now_utc: Optional[datetime] = None) -> bool:
        now_utc = now_utc or datetime.now(timezone.utc)
        last_seen = _parse_iso_timestamp(session.last_activity) or _parse_iso_timestamp(session.created_at)
        if last_seen is None:
            return False
        return (now_utc - last_seen).total_seconds() > self.memory_ttl_seconds

    async def _cleanup_expired_memory_sessions_locked(self, now_monotonic: float) -> int:
        now_utc = datetime.now(timezone.utc)
        expired_sids = [
            sid
            for sid, session in self.memory_sessions.items()
            if self._is_memory_session_expired(session, now_utc=now_utc)
        ]
        for sid in expired_sids:
            self.memory_sessions.pop(sid, None)
        self._last_cleanup_monotonic = now_monotonic
        return len(expired_sids)

    async def _maybe_cleanup_memory_sessions(self) -> None:
        if self.redis_client:
            return
        now = time.monotonic()
        if (now - self._last_cleanup_monotonic) < self.cleanup_interval_seconds:
            return
        async with self._memory_lock:
            now = time.monotonic()
            if (now - self._last_cleanup_monotonic) < self.cleanup_interval_seconds:
                return
            evicted = await self._cleanup_expired_memory_sessions_locked(now)
            if evicted > 0:
                print(f"SessionManager pruned {evicted} expired in-memory sessions")

    async def cleanup_expired_memory_sessions(self) -> int:
        """Force in-memory session TTL cleanup (primarily for tests/diagnostics)."""
        if self.redis_client:
            return 0
        async with self._memory_lock:
            return await self._cleanup_expired_memory_sessions_locked(time.monotonic())

    def _set_session_cookie(self, response: Response, sid: str, secure: bool) -> None:
        """
        Set/refresh session cookie.

        Uses rolling expiration by resetting max_age on each HTTP request that
        flows through get_or_create_session.
        """
        samesite = "none" if secure else "lax"
        response.set_cookie(
            key=SESSION_COOKIE,
            value=sid,
            httponly=True,
            samesite=samesite,
            max_age=COOKIE_MAX_AGE,
            secure=secure,
        )

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
            await self._maybe_cleanup_memory_sessions()
            async with self._memory_lock:
                session = self.memory_sessions.get(sid)
                if session is None:
                    return None
                if self._is_memory_session_expired(session):
                    self.memory_sessions.pop(sid, None)
                    return None
                return session

    async def create_session(self, sid: str = None) -> Session:
        """Create a new session. If SID provided, verify uniqueness/overwrite if needed."""
        await self._maybe_cleanup_memory_sessions()
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
            await self._maybe_cleanup_memory_sessions()
            async with self._memory_lock:
                self.memory_sessions[session.sid] = session

    async def get_or_create_session(self, request: Request, response: Response):
        """Helper to handle cookie extraction and setting."""
        sid = request.cookies.get(SESSION_COOKIE)
        # Cross-site usage (e.g. lorax.ucsc.edu -> api.lorax.in) requires SameSite=None,
        # and browsers require SameSite=None cookies to be Secure.
        # Detect original HTTPS behind proxies via X-Forwarded-Proto / Forwarded.
        secure = _is_https_request(request)
        
        session = None
        if sid:
            session = await self.get_session(sid)
        
        if not session:
            # Create new if missing or expired
            session = await self.create_session()
        else:
            # Rolling session activity update for active HTTP usage.
            session.update_activity()
            await self.save_session(session)

        # Rolling cookie refresh: extend browser cookie on each successful access.
        self._set_session_cookie(response, session.sid, secure)
        
        return session.sid, session

    async def health_check(self):
        if self.redis_client:
            return await self.redis_client.ping()
        return True
