"""
FileContext: Unified cache entry for loaded files.

Combines tree sequence, config, and metadata into a single eviction unit.
When a file is evicted from cache, all related data is evicted together,
preventing orphan metadata and ensuring atomic invalidation.
"""

from dataclasses import dataclass, field
from typing import Any, Optional, Union

import pandas as pd
import tskit

from lorax.cache.lru import LRUCache


@dataclass
class FileContext:
    """
    Unified cache entry for a loaded file.

    Combines tree sequence, config, and metadata into single
    eviction unit. When file is evicted from cache, all related
    data is evicted together.

    Attributes:
        file_path: Absolute path to the loaded file
        tree_sequence: The loaded tskit.TreeSequence or pandas.DataFrame (for CSV)
        config: Configuration dict computed from the tree sequence
        mtime: File modification time at load (used for cache validation)

    The nested _metadata cache stores per-key metadata lookups:
        - "population" -> {sample_name: value}
        - "region" -> {sample_name: value}
        - "population:array" -> {arrow_buffer, unique_values, sample_node_ids}
    """
    file_path: str
    tree_sequence: Union[tskit.TreeSequence, pd.DataFrame]
    config: dict
    mtime: float

    # Per-key metadata cache (nested within file context)
    # Keys: "population", "region", "population:array", etc.
    _metadata: LRUCache = field(default_factory=lambda: LRUCache(max_size=10))

    def get_metadata(self, key: str) -> Optional[Any]:
        """Get cached metadata for a specific key."""
        return self._metadata.get(key)

    def set_metadata(self, key: str, value: Any) -> None:
        """Cache metadata for a specific key."""
        self._metadata.set(key, value)

    def clear_metadata(self) -> None:
        """Clear all cached metadata (e.g., when file reloaded)."""
        self._metadata.clear()

    @property
    def is_csv(self) -> bool:
        """Check if this is a CSV file (pandas DataFrame)."""
        return isinstance(self.tree_sequence, pd.DataFrame)

    @property
    def is_tree_sequence(self) -> bool:
        """Check if this is a tskit tree sequence."""
        return isinstance(self.tree_sequence, tskit.TreeSequence)

    @property
    def ts(self) -> Union[tskit.TreeSequence, pd.DataFrame]:
        """Alias for tree_sequence for backwards compatibility."""
        return self.tree_sequence
