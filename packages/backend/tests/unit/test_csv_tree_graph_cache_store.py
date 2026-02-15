"""
Unit tests for in-memory CsvTreeGraphCache behavior.
"""

import pytest


class TestCsvTreeGraphCacheStore:
    @pytest.mark.asyncio
    async def test_set_get_clear(self):
        from lorax.cache.csv_tree_graph import CsvTreeGraphCache

        cache = CsvTreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)
        graph = object()

        await cache.set("sid-1", 5, graph)
        retrieved = await cache.get("sid-1", 5)
        assert retrieved is graph

        await cache.clear_session("sid-1")
        assert await cache.get("sid-1", 5) is None

    @pytest.mark.asyncio
    async def test_evict_not_visible(self):
        from lorax.cache.csv_tree_graph import CsvTreeGraphCache

        cache = CsvTreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)
        await cache.set("sid-1", 1, object())
        await cache.set("sid-1", 2, object())
        await cache.set("sid-1", 3, object())

        evicted = await cache.evict_not_visible("sid-1", {3})
        assert evicted == 2
        assert await cache.get("sid-1", 1) is None
        assert await cache.get("sid-1", 2) is None
        assert await cache.get("sid-1", 3) is not None

    @pytest.mark.asyncio
    async def test_ttl_cleanup_prunes_expired_sessions(self):
        from lorax.cache.csv_tree_graph import CsvTreeGraphCache

        cache = CsvTreeGraphCache(local_ttl_seconds=1, cleanup_interval_seconds=60)
        await cache.set("sid-expired", 1, object())

        async with cache._lock:
            cache._session_last_access["sid-expired"] -= 10

        evicted_sessions = await cache.cleanup_expired_local_sessions()
        assert evicted_sessions == 1
        assert await cache.get("sid-expired", 1) is None
