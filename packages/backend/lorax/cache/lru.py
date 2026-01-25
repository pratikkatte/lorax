"""
LRU Cache implementations for Lorax.

Provides in-memory caching with eviction for:
- Tree sequences (with mtime validation)
- Configuration data
- Metadata lookups
"""

from collections import OrderedDict


class LRUCache:
    """Simple LRU cache with eviction for large in-memory tskit/tszip objects."""
    def __init__(self, max_size=5):
        self.max_size = max_size
        self.cache = OrderedDict()

    def get(self, key):
        if key in self.cache:
            # Move to the end to mark as recently used
            self.cache.move_to_end(key)
            return self.cache[key]
        return None

    def set(self, key, value):
        if key in self.cache:
            # Update existing and mark as recently used
            self.cache.move_to_end(key)
        self.cache[key] = value
        # Evict if too big
        if len(self.cache) > self.max_size:
            old_key, old_val = self.cache.popitem(last=False)
            print(f"🧹 Evicted {old_key} from LRU cache to free memory")

    def remove(self, key):
        """Remove a specific key from the cache."""
        if key in self.cache:
            del self.cache[key]

    def clear(self):
        self.cache.clear()


class LRUCacheWithMeta:
    """
    LRU cache with metadata support for cache validation.

    Stores (value, metadata) tuples, allowing validation against
    external state (e.g., file mtime) before returning cached values.
    """
    def __init__(self, max_size=5):
        self.max_size = max_size
        self.cache = OrderedDict()  # key -> (value, meta)

    def get(self, key):
        """Get value only (ignores metadata)."""
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key][0]
        return None

    def get_with_meta(self, key):
        """Get (value, metadata) tuple."""
        if key in self.cache:
            self.cache.move_to_end(key)
            value, meta = self.cache[key]
            return value, meta
        return None, None

    def set(self, key, value, meta=None):
        """Set value with optional metadata."""
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = (value, meta)
        # Evict if too big
        if len(self.cache) > self.max_size:
            old_key, (old_val, old_meta) = self.cache.popitem(last=False)
            print(f"🧹 Evicted {old_key} from LRU cache to free memory")

    def remove(self, key):
        """Remove a specific key from the cache."""
        if key in self.cache:
            del self.cache[key]

    def clear(self):
        self.cache.clear()

    def __len__(self):
        return len(self.cache)
