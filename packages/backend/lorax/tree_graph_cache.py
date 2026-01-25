"""
TreeGraph Cache for per-session caching of TreeGraph objects.

Supports Redis for production (distributed) and in-memory for local mode.
Enables efficient lineage and search operations by reusing constructed trees.
"""

import pickle
import asyncio
from collections import OrderedDict
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from lorax.tree_graph import TreeGraph

# Maximum number of trees to cache per session (LRU eviction when exceeded)
MAX_TREES_PER_SESSION = 10

# TTL for Redis entries (matches session lifetime)
REDIS_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


class TreeGraphCache:
    """
    Per-session cache for TreeGraph objects with Redis/local mode switching.

    In production mode (with Redis), TreeGraph objects are serialized via pickle
    and stored with per-session keys. In local mode, uses in-memory dict.

    Features:
    - LRU eviction when MAX_TREES_PER_SESSION exceeded per session
    - Thread-safe async operations
    - Automatic mode detection based on Redis availability
    """

    def __init__(self, redis_client=None):
        """
        Initialize the cache.

        Args:
            redis_client: Optional async Redis client. If None, uses in-memory mode.
        """
        self.redis = redis_client
        # Local cache: session_id -> OrderedDict{tree_index -> TreeGraph}
        # OrderedDict maintains insertion order for LRU eviction
        self._local_cache: Dict[str, OrderedDict] = {}
        self._lock = asyncio.Lock()

        mode = "Redis" if redis_client else "in-memory"
        print(f"TreeGraphCache initialized in {mode} mode")

    def _redis_key(self, session_id: str, tree_index: int) -> str:
        """Generate Redis key for a cached TreeGraph."""
        return f"treegraph:{session_id}:{tree_index}"

    def _redis_session_pattern(self, session_id: str) -> str:
        """Generate Redis pattern to match all trees for a session."""
        return f"treegraph:{session_id}:*"

    async def get(self, session_id: str, tree_index: int) -> Optional["TreeGraph"]:
        """
        Retrieve a cached TreeGraph.

        Args:
            session_id: Session identifier
            tree_index: Tree index in the tree sequence

        Returns:
            TreeGraph if cached, None otherwise
        """
        if self.redis:
            return await self._redis_get(session_id, tree_index)
        else:
            return self._local_get(session_id, tree_index)

    async def set(
        self,
        session_id: str,
        tree_index: int,
        tree_graph: "TreeGraph"
    ) -> None:
        """
        Cache a TreeGraph object.

        Args:
            session_id: Session identifier
            tree_index: Tree index in the tree sequence
            tree_graph: TreeGraph object to cache
        """
        if self.redis:
            await self._redis_set(session_id, tree_index, tree_graph)
        else:
            await self._local_set(session_id, tree_index, tree_graph)

    async def get_all_for_session(self, session_id: str) -> Dict[int, "TreeGraph"]:
        """
        Retrieve all cached TreeGraphs for a session.

        Args:
            session_id: Session identifier

        Returns:
            Dict mapping tree_index to TreeGraph
        """
        if self.redis:
            return await self._redis_get_all(session_id)
        else:
            return self._local_get_all(session_id)

    async def clear_session(self, session_id: str) -> None:
        """
        Clear all cached TreeGraphs for a session.

        Call this when:
        - Session loads a new file
        - Session is deleted/expired

        Args:
            session_id: Session identifier
        """
        if self.redis:
            await self._redis_clear_session(session_id)
        else:
            await self._local_clear_session(session_id)

    # ==================== Redis Implementation ====================

    async def _redis_get(self, session_id: str, tree_index: int) -> Optional["TreeGraph"]:
        """Get TreeGraph from Redis."""
        try:
            key = self._redis_key(session_id, tree_index)
            data = await self.redis.get(key)
            if data:
                return pickle.loads(data)
            return None
        except Exception as e:
            print(f"TreeGraphCache Redis get error: {e}")
            return None

    async def _redis_set(
        self,
        session_id: str,
        tree_index: int,
        tree_graph: "TreeGraph"
    ) -> None:
        """Set TreeGraph in Redis with LRU eviction."""
        try:
            # Check current count and evict if needed
            pattern = self._redis_session_pattern(session_id)
            keys = []
            async for key in self.redis.scan_iter(pattern):
                keys.append(key)

            if len(keys) >= MAX_TREES_PER_SESSION:
                # Evict oldest (we can't track true LRU in Redis without extra metadata,
                # so we'll just delete one key - could be improved with sorted sets)
                if keys:
                    await self.redis.delete(keys[0])

            # Serialize and store
            key = self._redis_key(session_id, tree_index)
            data = pickle.dumps(tree_graph)
            await self.redis.setex(key, REDIS_TTL_SECONDS, data)
        except Exception as e:
            print(f"TreeGraphCache Redis set error: {e}")

    async def _redis_get_all(self, session_id: str) -> Dict[int, "TreeGraph"]:
        """Get all TreeGraphs for a session from Redis."""
        result = {}
        try:
            pattern = self._redis_session_pattern(session_id)
            async for key in self.redis.scan_iter(pattern):
                # Extract tree_index from key: treegraph:{session_id}:{tree_index}
                parts = key.split(":")
                if len(parts) == 3:
                    tree_index = int(parts[2])
                    data = await self.redis.get(key)
                    if data:
                        result[tree_index] = pickle.loads(data)
        except Exception as e:
            print(f"TreeGraphCache Redis get_all error: {e}")
        return result

    async def _redis_clear_session(self, session_id: str) -> None:
        """Clear all TreeGraphs for a session from Redis."""
        try:
            pattern = self._redis_session_pattern(session_id)
            keys = []
            async for key in self.redis.scan_iter(pattern):
                keys.append(key)
            if keys:
                await self.redis.delete(*keys)
                print(f"TreeGraphCache cleared {len(keys)} trees for session {session_id[:8]}...")
        except Exception as e:
            print(f"TreeGraphCache Redis clear error: {e}")

    # ==================== Local (In-Memory) Implementation ====================

    def _local_get(self, session_id: str, tree_index: int) -> Optional["TreeGraph"]:
        """Get TreeGraph from local cache."""
        session_cache = self._local_cache.get(session_id)
        if session_cache and tree_index in session_cache:
            # Move to end for LRU (most recently used)
            session_cache.move_to_end(tree_index)
            return session_cache[tree_index]
        return None

    async def _local_set(
        self,
        session_id: str,
        tree_index: int,
        tree_graph: "TreeGraph"
    ) -> None:
        """Set TreeGraph in local cache with LRU eviction."""
        async with self._lock:
            if session_id not in self._local_cache:
                self._local_cache[session_id] = OrderedDict()

            session_cache = self._local_cache[session_id]

            # If key exists, move to end
            if tree_index in session_cache:
                session_cache.move_to_end(tree_index)
                session_cache[tree_index] = tree_graph
            else:
                # Evict oldest if at capacity
                if len(session_cache) >= MAX_TREES_PER_SESSION:
                    # popitem(last=False) removes the oldest (first) item
                    oldest_key, _ = session_cache.popitem(last=False)
                    print(f"TreeGraphCache evicted tree {oldest_key} for session {session_id[:8]}...")

                session_cache[tree_index] = tree_graph

    def _local_get_all(self, session_id: str) -> Dict[int, "TreeGraph"]:
        """Get all TreeGraphs for a session from local cache."""
        session_cache = self._local_cache.get(session_id)
        if session_cache:
            return dict(session_cache)
        return {}

    async def _local_clear_session(self, session_id: str) -> None:
        """Clear all TreeGraphs for a session from local cache."""
        async with self._lock:
            if session_id in self._local_cache:
                count = len(self._local_cache[session_id])
                del self._local_cache[session_id]
                print(f"TreeGraphCache cleared {count} trees for session {session_id[:8]}...")

    # ==================== Utility Methods ====================

    def get_stats(self) -> Dict:
        """Get cache statistics."""
        if self.redis:
            return {
                "mode": "redis",
                "sessions": "N/A (use Redis commands to inspect)"
            }
        else:
            total_trees = sum(len(cache) for cache in self._local_cache.values())
            return {
                "mode": "in-memory",
                "sessions": len(self._local_cache),
                "total_trees": total_trees,
                "max_per_session": MAX_TREES_PER_SESSION
            }
