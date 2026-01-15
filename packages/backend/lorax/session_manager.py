
import os
import json
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict

import redis.asyncio as aioredis
from fastapi import Request, Response

from lorax.config.constants import (
    SESSION_COOKIE, 
    COOKIE_MAX_AGE,
)

class Session:
    """Per-user session."""
    def __init__(self, sid, file_path=None):
        self.sid = sid
        self.file_path = file_path
        self.created_at = datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "sid": self.sid,
            "file_path": self.file_path,
            "created_at": self.created_at,
        }

    @staticmethod
    def from_dict(data):
        return Session(
            sid=data["sid"],
            file_path=data.get("file_path"),
        )

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
