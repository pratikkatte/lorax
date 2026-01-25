"""
Lorax Caching System.

This package provides consolidated caching infrastructure:
- LRUCache, LRUCacheWithMeta: In-memory LRU caches with eviction
- DiskCacheManager: LRU disk cache with distributed locking for GCS downloads
- TreeGraphCache: Per-session caching of TreeGraph objects
- FileContext: Unified cache entry combining tree sequence, config, and metadata
- get_file_context: Cached file loading with mtime validation

The FileContext-based caching provides atomic invalidation: when a file is
evicted from cache, its tree sequence, config, and all metadata are evicted
together, preventing orphan metadata.
"""

from lorax.cache.lru import LRUCache, LRUCacheWithMeta
from lorax.cache.disk import DiskCacheManager
from lorax.cache.tree_graph import TreeGraphCache
from lorax.cache.file_context import FileContext
from lorax.cache.file_cache import (
    get_file_context,
    get_file_cache_size,
    # Backwards compatibility
    get_or_load_ts,
    get_ts_cache_size,
)

__all__ = [
    # Core cache classes
    "LRUCache",
    "LRUCacheWithMeta",
    "DiskCacheManager",
    "TreeGraphCache",
    # Unified file caching (preferred API)
    "FileContext",
    "get_file_context",
    "get_file_cache_size",
    # Backwards compatibility
    "get_or_load_ts",
    "get_ts_cache_size",
]
