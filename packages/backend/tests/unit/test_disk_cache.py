"""
Unit Tests for Disk Cache Manager

Tests manifest operations, LRU eviction, file locking,
and cache clear operations.
"""

import pytest
import asyncio
from pathlib import Path
from datetime import datetime, timezone


class TestCachedFile:
    """Tests for the CachedFile dataclass."""

    def test_cached_file_creation(self):
        """Test CachedFile creation."""
        from lorax.disk_cache import CachedFile

        cached = CachedFile(
            gcs_path="bucket/path/file.trees",
            local_path="/tmp/cache/abc123.trees",
            size_bytes=1024 * 1024,
            last_access="2024-01-01T00:00:00+00:00",
            download_complete=True,
            etag="abc123"
        )

        assert cached.gcs_path == "bucket/path/file.trees"
        assert cached.size_bytes == 1024 * 1024
        assert cached.download_complete is True

    def test_cached_file_serialization(self):
        """Test CachedFile to_dict and from_dict."""
        from lorax.disk_cache import CachedFile

        original = CachedFile(
            gcs_path="bucket/path/file.trees",
            local_path="/tmp/cache/abc123.trees",
            size_bytes=1024 * 1024,
            last_access="2024-01-01T00:00:00+00:00",
            download_complete=True
        )

        data = original.to_dict()
        restored = CachedFile.from_dict(data)

        assert restored.gcs_path == original.gcs_path
        assert restored.local_path == original.local_path
        assert restored.size_bytes == original.size_bytes


class TestDiskCacheManifest:
    """Tests for the DiskCacheManifest class."""

    @pytest.mark.asyncio
    async def test_manifest_load_empty(self, temp_dir):
        """Test loading non-existent manifest."""
        from lorax.disk_cache import DiskCacheManifest

        manifest_path = temp_dir / "manifest.json"
        manifest = DiskCacheManifest(manifest_path)

        data = await manifest.load()

        assert data["version"] == 1
        assert data["files"] == {}
        assert data["total_size_bytes"] == 0

    @pytest.mark.asyncio
    async def test_manifest_save_and_load(self, temp_dir):
        """Test saving and loading manifest."""
        from lorax.disk_cache import DiskCacheManifest, CachedFile

        manifest_path = temp_dir / "manifest.json"
        manifest = DiskCacheManifest(manifest_path)

        # Save a file entry
        cached = CachedFile(
            gcs_path="bucket/test.trees",
            local_path=str(temp_dir / "test.trees"),
            size_bytes=1024,
            last_access=datetime.now(timezone.utc).isoformat(),
            download_complete=True
        )
        await manifest.set_file("abc123", cached)

        # Load and verify
        data = await manifest.load()
        assert "abc123" in data["files"]
        assert data["total_size_bytes"] == 1024

    @pytest.mark.asyncio
    async def test_manifest_get_file(self, temp_dir):
        """Test getting a specific file from manifest."""
        from lorax.disk_cache import DiskCacheManifest, CachedFile

        manifest_path = temp_dir / "manifest.json"
        manifest = DiskCacheManifest(manifest_path)

        cached = CachedFile(
            gcs_path="bucket/test.trees",
            local_path=str(temp_dir / "test.trees"),
            size_bytes=1024,
            last_access=datetime.now(timezone.utc).isoformat(),
            download_complete=True
        )
        await manifest.set_file("abc123", cached)

        # Get file
        retrieved = await manifest.get_file("abc123")
        assert retrieved is not None
        assert retrieved.gcs_path == "bucket/test.trees"

        # Get non-existent
        missing = await manifest.get_file("nonexistent")
        assert missing is None

    @pytest.mark.asyncio
    async def test_manifest_update_access_time(self, temp_dir):
        """Test updating access time for cached file."""
        from lorax.disk_cache import DiskCacheManifest, CachedFile
        import time

        manifest_path = temp_dir / "manifest.json"
        manifest = DiskCacheManifest(manifest_path)

        original_time = "2024-01-01T00:00:00+00:00"
        cached = CachedFile(
            gcs_path="bucket/test.trees",
            local_path=str(temp_dir / "test.trees"),
            size_bytes=1024,
            last_access=original_time,
            download_complete=True
        )
        await manifest.set_file("abc123", cached)

        # Update access time
        await manifest.update_access_time("abc123")

        # Verify update
        data = await manifest.load()
        assert data["files"]["abc123"]["last_access"] != original_time

    @pytest.mark.asyncio
    async def test_manifest_remove_file(self, temp_dir):
        """Test removing a file from manifest."""
        from lorax.disk_cache import DiskCacheManifest, CachedFile

        manifest_path = temp_dir / "manifest.json"
        manifest = DiskCacheManifest(manifest_path)

        cached = CachedFile(
            gcs_path="bucket/test.trees",
            local_path=str(temp_dir / "test.trees"),
            size_bytes=1024,
            last_access=datetime.now(timezone.utc).isoformat(),
            download_complete=True
        )
        await manifest.set_file("abc123", cached)

        # Remove
        removed = await manifest.remove_file("abc123")
        assert removed is not None
        assert removed.gcs_path == "bucket/test.trees"

        # Verify total size updated
        total = await manifest.get_total_size()
        assert total == 0

    @pytest.mark.asyncio
    async def test_manifest_files_sorted_by_access(self, temp_dir):
        """Test getting files sorted by access time."""
        from lorax.disk_cache import DiskCacheManifest, CachedFile
        import time

        manifest_path = temp_dir / "manifest.json"
        manifest = DiskCacheManifest(manifest_path)

        # Add files with different access times
        for i in range(3):
            cached = CachedFile(
                gcs_path=f"bucket/test{i}.trees",
                local_path=str(temp_dir / f"test{i}.trees"),
                size_bytes=1024,
                last_access=f"2024-01-0{i+1}T00:00:00+00:00",  # Different dates
                download_complete=True
            )
            await manifest.set_file(f"key{i}", cached)

        # Get sorted files
        files = await manifest.get_files_by_access_time()
        assert len(files) == 3
        # First should be oldest (key0)
        assert files[0][0] == "key0"


class TestFileLock:
    """Tests for the FileLock class."""

    @pytest.mark.asyncio
    async def test_file_lock_acquire_release(self, temp_dir):
        """Test basic lock acquire and release."""
        from lorax.disk_cache import FileLock

        lock_path = temp_dir / "test.lock"
        lock = FileLock(lock_path)

        acquired = await lock.acquire(timeout=1.0)
        assert acquired is True

        await lock.release()
        # Should be able to acquire again after release
        acquired = await lock.acquire(timeout=1.0)
        assert acquired is True
        await lock.release()

    @pytest.mark.asyncio
    async def test_file_lock_contention(self, temp_dir):
        """Test lock contention between two locks."""
        from lorax.disk_cache import FileLock

        lock_path = temp_dir / "test.lock"
        lock1 = FileLock(lock_path)
        lock2 = FileLock(lock_path)

        # First lock succeeds
        acquired1 = await lock1.acquire(timeout=1.0)
        assert acquired1 is True

        # Second lock should fail (with short timeout)
        acquired2 = await lock2.acquire(timeout=0.1)
        assert acquired2 is False

        # Release first lock
        await lock1.release()

        # Now second should succeed
        acquired2 = await lock2.acquire(timeout=1.0)
        assert acquired2 is True
        await lock2.release()


class TestDiskCacheManager:
    """Tests for the DiskCacheManager class."""

    @pytest.mark.asyncio
    async def test_cache_key_generation(self, disk_cache_manager):
        """Test cache key generation."""
        key1 = disk_cache_manager._get_cache_key("bucket1", "path/file.trees")
        key2 = disk_cache_manager._get_cache_key("bucket1", "path/file.trees")
        key3 = disk_cache_manager._get_cache_key("bucket2", "path/file.trees")

        assert key1 == key2  # Same input = same key
        assert key1 != key3  # Different bucket = different key
        assert len(key1) == 16  # Truncated hash

    @pytest.mark.asyncio
    async def test_local_path_generation(self, disk_cache_manager):
        """Test local path generation preserves extension."""
        path = disk_cache_manager._get_local_path("abc123", "path/file.trees")
        assert path.suffix == ".trees"

        path = disk_cache_manager._get_local_path("abc123", "path/file.tsz")
        assert path.suffix == ".tsz"

    @pytest.mark.asyncio
    async def test_cache_file(self, disk_cache_manager, temp_dir):
        """Test registering a cached file."""
        local_path = temp_dir / "test.trees"
        local_path.write_bytes(b"test content")

        await disk_cache_manager.cache_file(
            gcs_bucket="test-bucket",
            gcs_path="path/file.trees",
            local_path=local_path,
            size_bytes=12
        )

        # Verify file is in cache
        cached = await disk_cache_manager.get_cached_path(
            "test-bucket", "path/file.trees"
        )
        # Note: cached path is different from local_path
        # because cache_file records the cached location
        stats = await disk_cache_manager.get_stats()
        assert stats["file_count"] == 1

    @pytest.mark.asyncio
    async def test_get_cached_path_miss(self, disk_cache_manager):
        """Test cache miss returns None."""
        path = await disk_cache_manager.get_cached_path(
            "test-bucket", "nonexistent.trees"
        )
        assert path is None

    @pytest.mark.asyncio
    async def test_evict_if_needed(self, disk_cache_manager, temp_dir):
        """Test LRU eviction when cache is full."""
        # Create test files
        files = []
        for i in range(5):
            local_path = temp_dir / f"test{i}.trees"
            local_path.write_bytes(b"x" * (25 * 1024 * 1024))  # 25 MB each
            files.append(local_path)

        # Cache files
        for i, local_path in enumerate(files):
            cache_key = disk_cache_manager._get_cache_key(
                "test-bucket", f"path/file{i}.trees"
            )
            dest_path = disk_cache_manager._get_local_path(
                cache_key, f"file{i}.trees"
            )
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(local_path.read_bytes())

            await disk_cache_manager.cache_file(
                gcs_bucket="test-bucket",
                gcs_path=f"path/file{i}.trees",
                local_path=dest_path,
                size_bytes=25 * 1024 * 1024
            )
            await asyncio.sleep(0.01)  # Ensure different access times

        # Verify all cached
        stats = await disk_cache_manager.get_stats()
        assert stats["file_count"] == 5

        # Evict to make room (cache is 100MB, we have 125MB)
        await disk_cache_manager.evict_if_needed(required_bytes=0)

        # Should have evicted some files
        stats = await disk_cache_manager.get_stats()
        assert stats["total_size_bytes"] <= disk_cache_manager.max_size_bytes

    @pytest.mark.asyncio
    async def test_get_stats(self, disk_cache_manager):
        """Test getting cache statistics."""
        stats = await disk_cache_manager.get_stats()

        assert stats["enabled"] is True
        assert "total_size_bytes" in stats
        assert "total_size_mb" in stats
        assert "max_size_mb" in stats
        assert "file_count" in stats
        assert "cache_dir" in stats

    @pytest.mark.asyncio
    async def test_clear_cache(self, disk_cache_manager, temp_dir):
        """Test clearing the cache."""
        # Add a file
        cache_key = disk_cache_manager._get_cache_key(
            "test-bucket", "path/file.trees"
        )
        dest_path = disk_cache_manager._get_local_path(cache_key, "file.trees")
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(b"test content")

        await disk_cache_manager.cache_file(
            gcs_bucket="test-bucket",
            gcs_path="path/file.trees",
            local_path=dest_path,
            size_bytes=12
        )

        # Clear
        await disk_cache_manager.clear()

        # Verify empty
        stats = await disk_cache_manager.get_stats()
        assert stats["file_count"] == 0
        assert stats["total_size_bytes"] == 0

    @pytest.mark.asyncio
    async def test_disabled_cache(self, temp_dir):
        """Test cache when disabled."""
        from lorax.disk_cache import DiskCacheManager

        manager = DiskCacheManager(
            cache_dir=temp_dir / "cache",
            max_size_bytes=100 * 1024 * 1024,
            enabled=False
        )

        stats = await manager.get_stats()
        assert stats["enabled"] is False

        path = await manager.get_cached_path("bucket", "path")
        assert path is None
