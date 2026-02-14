"""
TreeGraph Cache for per-session caching of TreeGraph objects.

This cache is intentionally in-memory only. It stores per-session TreeGraph
objects and applies opportunistic TTL cleanup to bound long-run memory growth.
"""

import asyncio
import time
from collections import OrderedDict
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from lorax.tree_graph import TreeGraph


class TreeGraphCache:
    """
    Per-session in-memory cache for TreeGraph objects.

    Features:
    - Visibility-based eviction via `evict_not_visible`
    - Per-session TTL expiration
    - Async lock for thread-safe updates
    """

    def __init__(
        self,
        *,
        local_ttl_seconds: int = 3600,
        cleanup_interval_seconds: int = 60,
    ):
        # Local cache: session_id -> OrderedDict{tree_index -> TreeGraph}
        # OrderedDict keeps recent access ordering per session.
        self._local_cache: Dict[str, OrderedDict] = {}
        self._session_last_access: Dict[str, float] = {}
        self._local_ttl_seconds = max(1, int(local_ttl_seconds))
        self._cleanup_interval_seconds = max(1, int(cleanup_interval_seconds))
        self._last_cleanup_monotonic = 0.0
        self._lock = asyncio.Lock()
        print(
            "TreeGraphCache initialized (in-memory, "
            f"ttl={self._local_ttl_seconds}s, cleanup={self._cleanup_interval_seconds}s)"
        )

    def _touch_session_nolock(self, session_id: str, now: Optional[float] = None) -> None:
        self._session_last_access[session_id] = time.monotonic() if now is None else now

    def _cleanup_expired_sessions_nolock(self, now: float) -> int:
        expired_session_ids = [
            session_id
            for session_id, last_access in self._session_last_access.items()
            if (now - last_access) > self._local_ttl_seconds
        ]
        for session_id in expired_session_ids:
            self._local_cache.pop(session_id, None)
            self._session_last_access.pop(session_id, None)
        return len(expired_session_ids)

    async def _maybe_cleanup(self) -> None:
        now = time.monotonic()
        if (now - self._last_cleanup_monotonic) < self._cleanup_interval_seconds:
            return
        async with self._lock:
            now = time.monotonic()
            if (now - self._last_cleanup_monotonic) < self._cleanup_interval_seconds:
                return
            self._last_cleanup_monotonic = now
            evicted_sessions = self._cleanup_expired_sessions_nolock(now)
            if evicted_sessions > 0:
                print(f"TreeGraphCache TTL-evicted {evicted_sessions} expired sessions")

    async def get(self, session_id: str, tree_index: int) -> Optional["TreeGraph"]:
        """Retrieve a cached TreeGraph."""
        await self._maybe_cleanup()
        async with self._lock:
            session_cache = self._local_cache.get(session_id)
            if not session_cache:
                return None
            tree_graph = session_cache.get(tree_index)
            if tree_graph is None:
                self._touch_session_nolock(session_id)
                return None
            session_cache.move_to_end(tree_index)
            self._touch_session_nolock(session_id)
            return tree_graph

    async def set(
        self,
        session_id: str,
        tree_index: int,
        tree_graph: "TreeGraph",
    ) -> None:
        """Cache a TreeGraph object."""
        await self._maybe_cleanup()
        async with self._lock:
            if session_id not in self._local_cache:
                self._local_cache[session_id] = OrderedDict()
            session_cache = self._local_cache[session_id]
            session_cache[tree_index] = tree_graph
            session_cache.move_to_end(tree_index)
            self._touch_session_nolock(session_id)

    async def get_all_for_session(self, session_id: str) -> Dict[int, "TreeGraph"]:
        """Retrieve all cached TreeGraphs for a session."""
        await self._maybe_cleanup()
        async with self._lock:
            session_cache = self._local_cache.get(session_id)
            if not session_cache:
                return {}
            self._touch_session_nolock(session_id)
            return dict(session_cache)

    async def clear_session(self, session_id: str) -> None:
        """Clear all cached TreeGraphs for a session."""
        await self._maybe_cleanup()
        async with self._lock:
            count = len(self._local_cache.get(session_id, {}))
            self._local_cache.pop(session_id, None)
            self._session_last_access.pop(session_id, None)
            if count > 0:
                print(f"TreeGraphCache cleared {count} trees for session {session_id[:8]}...")

    async def evict_not_visible(self, session_id: str, visible_indices: set) -> int:
        """Evict trees that are not currently visible."""
        await self._maybe_cleanup()
        async with self._lock:
            session_cache = self._local_cache.get(session_id)
            if not session_cache:
                return 0
            keys_to_remove = [idx for idx in session_cache.keys() if idx not in visible_indices]
            for idx in keys_to_remove:
                session_cache.pop(idx, None)
            if not session_cache:
                self._local_cache.pop(session_id, None)
                self._session_last_access.pop(session_id, None)
            else:
                self._touch_session_nolock(session_id)
            evicted = len(keys_to_remove)
            if evicted > 0:
                print(f"TreeGraphCache evicted {evicted} non-visible trees for session {session_id[:8]}...")
            return evicted

    async def cleanup_expired_local_sessions(self) -> int:
        """Force a full TTL cleanup pass (primarily for tests/diagnostics)."""
        async with self._lock:
            now = time.monotonic()
            self._last_cleanup_monotonic = now
            return self._cleanup_expired_sessions_nolock(now)

    def get_stats(self) -> Dict:
        """Get cache statistics."""
        total_trees = sum(len(cache) for cache in self._local_cache.values())
        return {
            "mode": "in-memory",
            "sessions": len(self._local_cache),
            "total_trees": total_trees,
            "eviction_strategy": "visibility+ttl",
            "ttl_seconds": self._local_ttl_seconds,
            "cleanup_interval_seconds": self._cleanup_interval_seconds,
        }
