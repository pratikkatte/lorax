"""
Mock Redis Client for Testing

In-memory Redis mock that implements the async Redis interface
used by SessionManager and DiskCacheManager.
"""

import asyncio
from typing import Optional, Dict, Any
from datetime import datetime, timezone


class MockRedis:
    """
    In-memory Redis mock for testing.

    Implements the subset of redis.asyncio API used by Lorax:
    - get, set, setex, delete
    - ping
    - eval (for Lua scripts)
    """

    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def ping(self) -> bool:
        """Simulate Redis ping."""
        return True

    async def get(self, key: str) -> Optional[str]:
        """Get value by key, respecting expiry."""
        async with self._lock:
            if key in self._expiry:
                if datetime.now(timezone.utc).timestamp() > self._expiry[key]:
                    # Key has expired
                    del self._data[key]
                    del self._expiry[key]
                    return None
            return self._data.get(key)

    async def set(
        self,
        key: str,
        value: str,
        nx: bool = False,
        px: Optional[int] = None,
        ex: Optional[int] = None
    ) -> bool:
        """
        Set a key-value pair.

        Args:
            key: Redis key
            value: Value to store
            nx: Only set if key doesn't exist
            px: Expiry in milliseconds
            ex: Expiry in seconds
        """
        async with self._lock:
            if nx and key in self._data:
                return False

            self._data[key] = value

            if px:
                self._expiry[key] = datetime.now(timezone.utc).timestamp() + (px / 1000)
            elif ex:
                self._expiry[key] = datetime.now(timezone.utc).timestamp() + ex

            return True

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        """Set with expiry in seconds."""
        return await self.set(key, value, ex=seconds)

    async def delete(self, *keys: str) -> int:
        """Delete one or more keys."""
        async with self._lock:
            deleted = 0
            for key in keys:
                if key in self._data:
                    del self._data[key]
                    self._expiry.pop(key, None)
                    deleted += 1
            return deleted

    async def eval(self, script: str, numkeys: int, *keys_and_args) -> Any:
        """
        Simulate Lua script evaluation.

        Supports the compare-and-delete pattern used by RedisLock:
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        if numkeys > 0:
            key = keys_and_args[0]
            expected_value = keys_and_args[numkeys] if len(keys_and_args) > numkeys else None

            async with self._lock:
                # Compare-and-delete pattern
                if "get" in script and "del" in script:
                    current = self._data.get(key)
                    if current == expected_value:
                        if key in self._data:
                            del self._data[key]
                            self._expiry.pop(key, None)
                            return 1
                    return 0

        return 0

    async def keys(self, pattern: str = "*") -> list:
        """Get keys matching pattern (simplified: supports * and prefix*)."""
        async with self._lock:
            if pattern == "*":
                return list(self._data.keys())

            if pattern.endswith("*"):
                prefix = pattern[:-1]
                return [k for k in self._data.keys() if k.startswith(prefix)]

            return [k for k in self._data.keys() if k == pattern]

    async def flushall(self) -> bool:
        """Clear all data."""
        async with self._lock:
            self._data.clear()
            self._expiry.clear()
            return True

    # For testing convenience
    def _get_all_data(self) -> Dict[str, Any]:
        """Direct access to data for test assertions."""
        return dict(self._data)

    def _set_data(self, key: str, value: str):
        """Direct set for test setup."""
        self._data[key] = value


class MockRedisManager:
    """Mock Socket.IO Redis manager for testing."""

    def __init__(self, url: str):
        self.url = url
        self.redis = MockRedis()
