"""
Disk Cache Manager for Lorax

LRU disk cache with distributed locking for GCS file downloads.
Supports three modes: local, development, production.
"""

import os
import json
import hashlib
import asyncio
import fcntl
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict

import aiofiles


@dataclass
class CachedFile:
    """Metadata for a cached file."""
    gcs_path: str
    local_path: str
    size_bytes: int
    last_access: str
    download_complete: bool
    etag: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "CachedFile":
        return CachedFile(**data)


class DiskCacheManifest:
    """Thread-safe manifest for tracking cached files."""

    def __init__(self, manifest_path: Path):
        self.manifest_path = manifest_path
        self._lock = asyncio.Lock()

    async def load(self) -> Dict[str, Any]:
        """Load manifest from disk."""
        if not self.manifest_path.exists():
            return {"version": 1, "files": {}, "total_size_bytes": 0}

        try:
            async with aiofiles.open(self.manifest_path, "r") as f:
                content = await f.read()
                return json.loads(content) if content else {"version": 1, "files": {}, "total_size_bytes": 0}
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to load manifest: {e}")
            return {"version": 1, "files": {}, "total_size_bytes": 0}

    async def save(self, data: Dict[str, Any]):
        """Save manifest to disk atomically."""
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.manifest_path.with_suffix(".tmp")

        async with aiofiles.open(tmp_path, "w") as f:
            await f.write(json.dumps(data, indent=2))

        # Atomic rename
        tmp_path.rename(self.manifest_path)

    async def get_file(self, cache_key: str) -> Optional[CachedFile]:
        """Get cached file metadata."""
        async with self._lock:
            data = await self.load()
            file_data = data["files"].get(cache_key)
            if file_data:
                return CachedFile.from_dict(file_data)
            return None

    async def set_file(self, cache_key: str, cached_file: CachedFile):
        """Set cached file metadata."""
        async with self._lock:
            data = await self.load()

            # Update total size
            old_file = data["files"].get(cache_key)
            if old_file:
                data["total_size_bytes"] -= old_file.get("size_bytes", 0)

            data["files"][cache_key] = cached_file.to_dict()
            data["total_size_bytes"] += cached_file.size_bytes

            await self.save(data)

    async def update_access_time(self, cache_key: str):
        """Update last access time for a cached file."""
        async with self._lock:
            data = await self.load()
            if cache_key in data["files"]:
                data["files"][cache_key]["last_access"] = datetime.now(timezone.utc).isoformat()
                await self.save(data)

    async def remove_file(self, cache_key: str) -> Optional[CachedFile]:
        """Remove a file from the manifest."""
        async with self._lock:
            data = await self.load()
            file_data = data["files"].pop(cache_key, None)
            if file_data:
                data["total_size_bytes"] -= file_data.get("size_bytes", 0)
                await self.save(data)
                return CachedFile.from_dict(file_data)
            return None

    async def get_total_size(self) -> int:
        """Get total size of cached files in bytes."""
        data = await self.load()
        return data.get("total_size_bytes", 0)

    async def get_files_by_access_time(self) -> list:
        """Get all files sorted by last access time (oldest first)."""
        data = await self.load()
        files = []
        for cache_key, file_data in data["files"].items():
            files.append((cache_key, CachedFile.from_dict(file_data)))

        # Sort by last_access (oldest first)
        files.sort(key=lambda x: x[1].last_access)
        return files


class FileLock:
    """File-based lock for single-process or fallback mode."""

    def __init__(self, lock_path: Path):
        self.lock_path = lock_path
        self._fd = None

    async def acquire(self, timeout: float = 300.0) -> bool:
        """Acquire the lock with timeout."""
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)

        start_time = asyncio.get_event_loop().time()
        while True:
            try:
                self._fd = open(self.lock_path, "w")
                fcntl.flock(self._fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                return True
            except (IOError, OSError):
                if self._fd:
                    self._fd.close()
                    self._fd = None

                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed >= timeout:
                    return False

                await asyncio.sleep(0.1)

    async def release(self):
        """Release the lock."""
        if self._fd:
            try:
                fcntl.flock(self._fd.fileno(), fcntl.LOCK_UN)
                self._fd.close()
            except (IOError, OSError):
                pass
            finally:
                self._fd = None


class RedisLock:
    """Redis-based distributed lock for multi-worker deployments."""

    def __init__(self, redis_client, lock_key: str, timeout_ms: int = 300000):
        self.redis = redis_client
        self.lock_key = lock_key
        self.timeout_ms = timeout_ms
        self._lock_value = None

    async def acquire(self, timeout: float = 300.0) -> bool:
        """Acquire the lock with timeout."""
        import uuid
        self._lock_value = str(uuid.uuid4())

        start_time = asyncio.get_event_loop().time()
        while True:
            # SET key value NX PX timeout_ms
            acquired = await self.redis.set(
                self.lock_key,
                self._lock_value,
                nx=True,
                px=self.timeout_ms
            )
            if acquired:
                return True

            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed >= timeout:
                return False

            await asyncio.sleep(0.1)

    async def release(self):
        """Release the lock if we own it."""
        if self._lock_value:
            # Only release if we own it (compare-and-delete)
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            try:
                await self.redis.eval(lua_script, 1, self.lock_key, self._lock_value)
            except Exception as e:
                print(f"Warning: Failed to release Redis lock: {e}")
            finally:
                self._lock_value = None


class DiskCacheManager:
    """
    LRU disk cache manager for GCS file downloads.

    Features:
    - 50GB (configurable) LRU eviction
    - Atomic downloads (temp file + rename)
    - Distributed locking (Redis or file-based)
    - Access time tracking
    """

    def __init__(
        self,
        cache_dir: Path,
        max_size_bytes: int,
        redis_client=None,
        enabled: bool = True
    ):
        self.cache_dir = Path(cache_dir)
        self.max_size_bytes = max_size_bytes
        self.redis = redis_client
        self.enabled = enabled

        self.files_dir = self.cache_dir / "files"
        self.locks_dir = self.cache_dir / "locks"
        self.manifest = DiskCacheManifest(self.cache_dir / "manifest.json")

        # Create directories
        if self.enabled:
            self.files_dir.mkdir(parents=True, exist_ok=True)
            self.locks_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_key(self, gcs_bucket: str, gcs_path: str) -> str:
        """Generate cache key from GCS path."""
        full_path = f"{gcs_bucket}/{gcs_path}"
        return hashlib.sha256(full_path.encode()).hexdigest()[:16]

    def _get_local_path(self, cache_key: str, gcs_path: str) -> Path:
        """Get local file path for a cache key."""
        # Preserve extension for tskit compatibility
        ext = Path(gcs_path).suffix or ".dat"
        return self.files_dir / f"{cache_key}{ext}"

    async def _acquire_lock(self, cache_key: str) -> Any:
        """Acquire download lock (Redis or file-based)."""
        if self.redis:
            lock = RedisLock(self.redis, f"lorax:download:{cache_key}")
        else:
            lock = FileLock(self.locks_dir / f"{cache_key}.lock")

        acquired = await lock.acquire()
        if not acquired:
            raise TimeoutError(f"Failed to acquire lock for {cache_key}")

        return lock

    async def _release_lock(self, lock: Any):
        """Release download lock."""
        await lock.release()

    async def get_cached_path(self, gcs_bucket: str, gcs_path: str) -> Optional[Path]:
        """
        Get path to cached file if it exists and is valid.
        Updates access time on hit.
        """
        if not self.enabled:
            return None

        cache_key = self._get_cache_key(gcs_bucket, gcs_path)
        cached_file = await self.manifest.get_file(cache_key)

        if cached_file and cached_file.download_complete:
            local_path = Path(cached_file.local_path)
            if local_path.exists():
                # Update access time
                await self.manifest.update_access_time(cache_key)
                print(f"Cache hit: {gcs_path}")
                return local_path
            else:
                # File was deleted externally, remove from manifest
                await self.manifest.remove_file(cache_key)

        return None

    async def evict_if_needed(self, required_bytes: int = 0):
        """Evict oldest files until we have space for required_bytes."""
        if not self.enabled:
            return

        target_size = self.max_size_bytes - required_bytes
        current_size = await self.manifest.get_total_size()

        if current_size <= target_size:
            return

        # Get files sorted by access time (oldest first)
        files = await self.manifest.get_files_by_access_time()

        for cache_key, cached_file in files:
            if current_size <= target_size:
                break

            # Delete file
            local_path = Path(cached_file.local_path)
            if local_path.exists():
                try:
                    local_path.unlink()
                    print(f"Evicted: {cached_file.gcs_path} ({cached_file.size_bytes / 1024 / 1024:.1f} MB)")
                except OSError as e:
                    print(f"Warning: Failed to delete {local_path}: {e}")

            # Remove from manifest
            await self.manifest.remove_file(cache_key)
            current_size -= cached_file.size_bytes

    async def cache_file(
        self,
        gcs_bucket: str,
        gcs_path: str,
        local_path: Path,
        size_bytes: int,
        etag: Optional[str] = None
    ):
        """Register a downloaded file in the cache."""
        if not self.enabled:
            return

        cache_key = self._get_cache_key(gcs_bucket, gcs_path)

        cached_file = CachedFile(
            gcs_path=f"{gcs_bucket}/{gcs_path}",
            local_path=str(local_path),
            size_bytes=size_bytes,
            last_access=datetime.now(timezone.utc).isoformat(),
            download_complete=True,
            etag=etag
        )

        await self.manifest.set_file(cache_key, cached_file)
        print(f"Cached: {gcs_path} ({size_bytes / 1024 / 1024:.1f} MB)")

    async def get_or_download(
        self,
        gcs_bucket: str,
        gcs_path: str,
        download_func
    ) -> Path:
        """
        Get file from cache or download using provided function.

        Args:
            gcs_bucket: GCS bucket name
            gcs_path: Path within bucket
            download_func: async function(local_path) that downloads file

        Returns:
            Path to local file
        """
        # Fast path: check cache without lock
        cached_path = await self.get_cached_path(gcs_bucket, gcs_path)
        if cached_path:
            return cached_path

        if not self.enabled:
            # Cache disabled, download directly
            cache_key = self._get_cache_key(gcs_bucket, gcs_path)
            local_path = self._get_local_path(cache_key, gcs_path)
            await download_func(str(local_path))
            return local_path

        cache_key = self._get_cache_key(gcs_bucket, gcs_path)
        local_path = self._get_local_path(cache_key, gcs_path)

        # Acquire distributed lock
        lock = await self._acquire_lock(cache_key)
        try:
            # Double-check after acquiring lock
            cached_path = await self.get_cached_path(gcs_bucket, gcs_path)
            if cached_path:
                return cached_path

            # Estimate size and evict if needed (conservative estimate)
            await self.evict_if_needed(required_bytes=1024 * 1024 * 1024)  # 1GB buffer

            # Download to temp file
            tmp_path = local_path.with_suffix(local_path.suffix + ".tmp")
            try:
                await download_func(str(tmp_path))

                # Get actual size
                size_bytes = tmp_path.stat().st_size

                # Evict with actual size if needed
                await self.evict_if_needed(required_bytes=size_bytes)

                # Atomic rename
                tmp_path.rename(local_path)

                # Register in cache
                await self.cache_file(gcs_bucket, gcs_path, local_path, size_bytes)

                return local_path

            except Exception as e:
                # Cleanup temp file on failure
                if tmp_path.exists():
                    tmp_path.unlink()
                raise

        finally:
            await self._release_lock(lock)

    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.enabled:
            return {"enabled": False}

        total_size = await self.manifest.get_total_size()
        data = await self.manifest.load()

        return {
            "enabled": True,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "max_size_mb": round(self.max_size_bytes / 1024 / 1024, 2),
            "usage_percent": round(total_size / self.max_size_bytes * 100, 1) if self.max_size_bytes > 0 else 0,
            "file_count": len(data["files"]),
            "cache_dir": str(self.cache_dir),
        }

    async def clear(self):
        """Clear all cached files."""
        if not self.enabled:
            return

        files = await self.manifest.get_files_by_access_time()

        for cache_key, cached_file in files:
            local_path = Path(cached_file.local_path)
            if local_path.exists():
                try:
                    local_path.unlink()
                except OSError:
                    pass
            await self.manifest.remove_file(cache_key)

        print("Disk cache cleared")
