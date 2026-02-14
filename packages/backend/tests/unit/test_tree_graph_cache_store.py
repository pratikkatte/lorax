"""
Unit tests for in-memory TreeGraphCache behavior.
"""

import pytest


class TestTreeGraphCacheStore:
    @pytest.mark.asyncio
    async def test_set_get_and_stats(self):
        from lorax.cache.tree_graph import TreeGraphCache

        cache = TreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)
        graph = object()

        await cache.set("sid-1", 10, graph)
        retrieved = await cache.get("sid-1", 10)
        assert retrieved is graph

        stats = cache.get_stats()
        assert stats["mode"] == "in-memory"
        assert stats["sessions"] == 1
        assert stats["total_trees"] == 1

    @pytest.mark.asyncio
    async def test_evict_not_visible(self):
        from lorax.cache.tree_graph import TreeGraphCache

        cache = TreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)
        await cache.set("sid-1", 1, object())
        await cache.set("sid-1", 2, object())
        await cache.set("sid-1", 3, object())

        evicted = await cache.evict_not_visible("sid-1", {2})
        assert evicted == 2

        all_cached = await cache.get_all_for_session("sid-1")
        assert set(all_cached.keys()) == {2}

    @pytest.mark.asyncio
    async def test_ttl_cleanup_prunes_expired_sessions(self):
        from lorax.cache.tree_graph import TreeGraphCache

        cache = TreeGraphCache(local_ttl_seconds=1, cleanup_interval_seconds=60)
        await cache.set("sid-expired", 1, object())

        async with cache._lock:
            cache._session_last_access["sid-expired"] -= 10

        evicted_sessions = await cache.cleanup_expired_local_sessions()
        assert evicted_sessions == 1

        retrieved = await cache.get("sid-expired", 1)
        assert retrieved is None
