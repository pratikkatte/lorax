"""
Lorax Socket Event Handlers.

This package provides modularized socket event handling:
- connection: connect, disconnect, optional diagnostic ping events
- file_ops: load_file, details, query events
- tree_layout: process_postorder_layout, cache_trees events
- metadata: fetch_metadata_array, search_metadata events
- mutations: query_mutations_window, search_mutations events
- node_search: search_nodes, get_highlight_positions events
- lineage: ancestors, descendants, mrca, subtree events
- debug: cache_stats events
"""

from lorax.sockets.utils import is_csv_session_file
from lorax.sockets.decorators import (
    require_session,
    with_session,
    with_file_loaded,
    csv_not_supported,
    socket_error_handler,
)

# Will be populated by individual modules after split
from lorax.sockets.connection import register_connection_events
from lorax.sockets.file_ops import register_file_events
from lorax.sockets.tree_layout import register_tree_layout_events
from lorax.sockets.metadata import register_metadata_events
from lorax.sockets.mutations import register_mutations_events
from lorax.sockets.node_search import register_node_search_events
from lorax.sockets.lineage import register_lineage_events
from lorax.sockets.debug import register_debug_events


def register_socket_events(sio):
    """Register all socket event handlers."""
    register_connection_events(sio)
    register_file_events(sio)
    register_tree_layout_events(sio)
    register_metadata_events(sio)
    register_mutations_events(sio)
    register_node_search_events(sio)
    register_lineage_events(sio)
    register_debug_events(sio)


__all__ = [
    "register_socket_events",
    "is_csv_session_file",
    "require_session",
    "with_session",
    "with_file_loaded",
    "csv_not_supported",
    "socket_error_handler",
]
