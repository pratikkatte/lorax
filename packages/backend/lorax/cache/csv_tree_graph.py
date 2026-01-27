"""
CSV Newick Tree cache for per-session caching of parsed Newick trees.

This is a lightweight in-memory cache (no Redis) that mirrors the small subset
of the TreeGraphCache interface used by the layout pipeline:
- get / set per (session_id, tree_index)
- clear_session on file load
- evict_not_visible for viewport-based eviction
"""

import asyncio
from collections import OrderedDict
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from lorax.csv.newick_tree import NewickTreeGraph


class CsvTreeGraphCache:
    """
    Per-session cache for parsed NewickTreeGraph objects (CSV mode).

    NOTE: This intentionally stays in-memory only to keep it simple.
    """

    def __init__(self):
        # session_id -> OrderedDict{tree_index -> NewickTreeGraph}
        self._local_cache: Dict[str, OrderedDict] = {}
        self._lock = asyncio.Lock()
        print("CsvTreeGraphCache initialized (in-memory)")

    async def get(self, session_id: str, tree_index: int) -> Optional["NewickTreeGraph"]:
        session_cache = self._local_cache.get(session_id)
        if session_cache and tree_index in session_cache:
            session_cache.move_to_end(tree_index)
            return session_cache[tree_index]
        return None

    async def set(self, session_id: str, tree_index: int, graph: "NewickTreeGraph") -> None:
        async with self._lock:
            if session_id not in self._local_cache:
                self._local_cache[session_id] = OrderedDict()
            self._local_cache[session_id][tree_index] = graph

    async def clear_session(self, session_id: str) -> None:
        async with self._lock:
            if session_id in self._local_cache:
                del self._local_cache[session_id]

    async def evict_not_visible(self, session_id: str, visible_indices: set) -> int:
        async with self._lock:
            session_cache = self._local_cache.get(session_id)
            if not session_cache:
                return 0
            to_delete = [idx for idx in session_cache.keys() if idx not in visible_indices]
            for idx in to_delete:
                session_cache.pop(idx, None)
            return len(to_delete)

