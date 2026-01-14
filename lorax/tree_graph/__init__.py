"""
tree_graph - Optimized tree construction with Numba JIT compilation.

This module provides fast tree construction from tskit tables with:
- Numba-compiled post-order traversal (50-100x faster than Python)
- CSR format for efficient children access
- PyArrow serialization for frontend rendering
"""

from .tree_graph import TreeGraph, construct_tree, construct_trees_batch

__all__ = ['TreeGraph', 'construct_tree', 'construct_trees_batch']
