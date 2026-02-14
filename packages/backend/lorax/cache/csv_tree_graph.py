"""
CSV Newick Tree cache for per-session caching of parsed Newick trees.

This is a lightweight in-memory cache (no Redis) that mirrors the small subset
of the TreeGraphCache interface used by the layout pipeline:
- get / set per (session_id, tree_index)
- clear_session on file load
- evict_not_visible for viewport-based eviction
"""

import asyncio
import time
from collections import OrderedDict
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from lorax.csv.newick_tree import NewickTreeGraph


class CsvTreeGraphCache:
    """
    Per-session cache for parsed NewickTreeGraph objects (CSV mode).

    NOTE: This intentionally stays in-memory only to keep it simple.
    """

    def __init__(
        self,
        *,
        local_ttl_seconds: int = 3600,
        cleanup_interval_seconds: int = 60,
    ):
        # session_id -> OrderedDict{tree_index -> NewickTreeGraph}
        self._local_cache: Dict[str, OrderedDict] = {}
        self._session_last_access: Dict[str, float] = {}
        self._local_ttl_seconds = max(1, int(local_ttl_seconds))
        self._cleanup_interval_seconds = max(1, int(cleanup_interval_seconds))
        self._last_cleanup_monotonic = 0.0
        self._lock = asyncio.Lock()
        print(
            "CsvTreeGraphCache initialized "
            f"(in-memory, ttl={self._local_ttl_seconds}s, cleanup={self._cleanup_interval_seconds}s)"
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
                print(f"CsvTreeGraphCache TTL-evicted {evicted_sessions} expired sessions")

    async def get(self, session_id: str, tree_index: int) -> Optional["NewickTreeGraph"]:
        await self._maybe_cleanup()
        async with self._lock:
            session_cache = self._local_cache.get(session_id)
            if not session_cache:
                return None
            graph = session_cache.get(tree_index)
            if graph is None:
                self._touch_session_nolock(session_id)
                return None
            session_cache.move_to_end(tree_index)
            self._touch_session_nolock(session_id)
            return graph

    async def set(self, session_id: str, tree_index: int, graph: "NewickTreeGraph") -> None:
        await self._maybe_cleanup()
        async with self._lock:
            if session_id not in self._local_cache:
                self._local_cache[session_id] = OrderedDict()
            session_cache = self._local_cache[session_id]
            session_cache[tree_index] = graph
            session_cache.move_to_end(tree_index)
            self._touch_session_nolock(session_id)

    async def clear_session(self, session_id: str) -> None:
        await self._maybe_cleanup()
        async with self._lock:
            self._local_cache.pop(session_id, None)
            self._session_last_access.pop(session_id, None)

    async def evict_not_visible(self, session_id: str, visible_indices: set) -> int:
        await self._maybe_cleanup()
        async with self._lock:
            session_cache = self._local_cache.get(session_id)
            if not session_cache:
                return 0
            to_delete = [idx for idx in session_cache.keys() if idx not in visible_indices]
            for idx in to_delete:
                session_cache.pop(idx, None)
            if not session_cache:
                self._local_cache.pop(session_id, None)
                self._session_last_access.pop(session_id, None)
            else:
                self._touch_session_nolock(session_id)
            return len(to_delete)

    async def cleanup_expired_local_sessions(self) -> int:
        """Force a full TTL cleanup pass (primarily for tests/diagnostics)."""
        async with self._lock:
            now = time.monotonic()
            self._last_cleanup_monotonic = now
            return self._cleanup_expired_sessions_nolock(now)
