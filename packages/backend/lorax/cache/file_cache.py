"""
Unified File Cache for Lorax.

Provides cached loading of FileContext objects which combine tree sequences,
config, and metadata into a single eviction unit. When a file is evicted,
all related data is evicted together.

This replaces the separate tree_sequence, config, and metadata caches.
"""

import asyncio
from pathlib import Path
from typing import Optional

import pandas as pd
import tskit
import tszip

from lorax.cache.lru import LRUCacheWithMeta
from lorax.cache.file_context import FileContext
from lorax.constants import TS_CACHE_SIZE

# Per-file locks to allow concurrent loading of different files
# (replaces global lock that serialized all loads)
_file_locks: dict[str, asyncio.Lock] = {}
_locks_lock = asyncio.Lock()


async def _get_file_lock(file_path: str) -> asyncio.Lock:
    """Get or create the lock for a specific file path."""
    async with _locks_lock:
        if file_path not in _file_locks:
            _file_locks[file_path] = asyncio.Lock()
        return _file_locks[file_path]


# Global cache for FileContext objects
# Uses LRUCacheWithMeta to track file mtime for cache validation
_file_cache = LRUCacheWithMeta(max_size=TS_CACHE_SIZE)


def _get_file_mtime(file_path: str) -> float:
    """Get file modification time, or 0 if file doesn't exist."""
    try:
        return Path(file_path).stat().st_mtime
    except (OSError, FileNotFoundError):
        return 0.0


def _load_tree_sequence(file_path: str):
    """Load tree sequence from file based on extension."""
    if file_path.endswith('.tsz'):
        return tszip.load(file_path)
    elif file_path.endswith('.trees'):
        return tskit.load(file_path)
    elif file_path.endswith('.csv'):
        return pd.read_csv(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_path}")


async def get_file_context(file_path: str, root_dir: str = None) -> Optional[FileContext]:
    """
    Get or load a FileContext for the given file path.

    Validates mtime and returns cached context if valid.
    Loads fresh if cache miss or file changed.

    Args:
        file_path: Path to the tree sequence file
        root_dir: Root directory for relative paths (defaults to file's parent)

    Returns:
        FileContext object with tree_sequence, config, and metadata cache,
        or None if file doesn't exist or fails to load.
    """
    # Import here to avoid circular dependency
    from lorax.loaders.loader import compute_config

    file_path_obj = Path(file_path)
    if not file_path_obj.exists():
        _file_cache.remove(file_path)
        print(f"❌ File not found: {file_path}")
        return None

    current_mtime = _get_file_mtime(file_path)

    # Double-checked locking optimization
    # 1. Optimistic check (lock-free read)
    ctx, cached_mtime = _file_cache.get_with_meta(file_path)
    if ctx is not None:
        if cached_mtime == current_mtime:
            print(f"✅ Using cached FileContext: {file_path}")
            return ctx
        else:
            print(f"🔄 File changed, reloading: {file_path}")
            _file_cache.remove(file_path)

    # Need to load - acquire per-file lock (allows concurrent loads of different files)
    file_lock = await _get_file_lock(file_path)
    async with file_lock:
        # 2. Check again under lock (in case another task loaded it while we waited)
        ctx, cached_mtime = _file_cache.get_with_meta(file_path)
        if ctx is not None and cached_mtime == current_mtime:
            print(f"✅ Using cached FileContext (after lock): {file_path}")
            return ctx

        print(f"📂 Loading FileContext: {file_path}")

        try:
            # Load tree sequence
            ts = await asyncio.to_thread(_load_tree_sequence, file_path)

            # Compute config immediately (it's derived from ts)
            effective_root_dir = root_dir or str(file_path_obj.parent)
            config = await asyncio.to_thread(
                compute_config, ts, file_path, effective_root_dir
            )

            # Create FileContext with empty metadata cache
            ctx = FileContext(
                file_path=file_path,
                tree_sequence=ts,
                config=config,
                mtime=current_mtime
            )

            _file_cache.set(file_path, ctx, meta=current_mtime)
            return ctx

        except Exception as e:
            print(f"❌ Failed to load {file_path}: {e}")
            return None


def get_file_cache_size() -> int:
    """Return current number of cached files."""
    return len(_file_cache.cache)


# Backwards compatibility: provide get_or_load_ts that returns just the tree_sequence
async def get_or_load_ts(file_path: str, root_dir: str = None):
    """
    Backwards-compatible function that returns just the tree sequence.

    Prefer using get_file_context() directly for new code.
    """
    ctx = await get_file_context(file_path, root_dir)
    return ctx.tree_sequence if ctx else None


def get_ts_cache_size() -> int:
    """Backwards-compatible alias for get_file_cache_size()."""
    return get_file_cache_size()
