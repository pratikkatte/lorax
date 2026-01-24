"""
Unit Tests for Data Handlers

Tests file loading, tree queries, details handling,
and PyArrow buffer encoding.
"""

import pytest
import json
import asyncio
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np

# Check if numba is available (required for tree_graph module)
try:
    import numba
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False

pytestmark = pytest.mark.skipif(not HAS_NUMBA, reason="numba not installed")


class TestFileLoading:
    """Tests for file loading functions."""

    @pytest.mark.asyncio
    async def test_get_file_mtime(self, minimal_ts_file):
        """Test getting file modification time."""
        from lorax.handlers import _get_file_mtime

        mtime = _get_file_mtime(str(minimal_ts_file))
        assert mtime > 0

    @pytest.mark.asyncio
    async def test_get_file_mtime_nonexistent(self):
        """Test getting mtime for non-existent file."""
        from lorax.handlers import _get_file_mtime

        mtime = _get_file_mtime("/nonexistent/path.trees")
        assert mtime == 0.0

    @pytest.mark.asyncio
    async def test_get_or_load_ts(self, minimal_ts_file):
        """Test loading a tree sequence."""
        from lorax.handlers import get_or_load_ts

        ts = await get_or_load_ts(str(minimal_ts_file))

        assert ts is not None
        assert hasattr(ts, 'num_trees')
        assert hasattr(ts, 'num_samples')

    @pytest.mark.asyncio
    async def test_get_or_load_ts_cached(self, minimal_ts_file):
        """Test that tree sequences are cached."""
        from lorax.handlers import get_or_load_ts, _ts_cache

        # Clear cache first
        _ts_cache.cache.clear()

        # First load
        ts1 = await get_or_load_ts(str(minimal_ts_file))
        assert ts1 is not None

        # Second load should use cache
        ts2 = await get_or_load_ts(str(minimal_ts_file))
        assert ts2 is ts1  # Same object

    @pytest.mark.asyncio
    async def test_get_or_load_ts_nonexistent(self, temp_dir):
        """Test loading non-existent file."""
        from lorax.handlers import get_or_load_ts

        ts = await get_or_load_ts(str(temp_dir / "nonexistent.trees"))
        assert ts is None

    @pytest.mark.asyncio
    async def test_get_or_load_ts_invalid_extension(self, temp_dir):
        """Test loading file with unsupported extension."""
        from lorax.handlers import get_or_load_ts

        invalid_file = temp_dir / "test.invalid"
        invalid_file.write_text("invalid content")

        with pytest.raises(ValueError, match="Unsupported file type"):
            await get_or_load_ts(str(invalid_file))

    @pytest.mark.asyncio
    async def test_load_csv_file(self, sample_csv_file):
        """Test loading a CSV file."""
        from lorax.handlers import get_or_load_ts
        import pandas as pd

        result = await get_or_load_ts(str(sample_csv_file))

        assert result is not None
        assert isinstance(result, pd.DataFrame)


class TestDetailsHandlers:
    """Tests for tree/node/individual detail handlers."""

    @pytest.mark.asyncio
    async def test_get_node_details(self, minimal_ts):
        """Test getting node details."""
        from lorax.handlers import get_node_details

        node_id = 0  # First sample node
        details = get_node_details(minimal_ts, node_id)

        assert "id" in details
        assert "time" in details
        assert "population" in details
        assert "individual" in details
        assert details["id"] == node_id

    @pytest.mark.asyncio
    async def test_get_tree_details(self, minimal_ts):
        """Test getting tree details."""
        from lorax.handlers import get_tree_details

        tree_idx = 0
        details = get_tree_details(minimal_ts, tree_idx)

        assert "interval" in details
        assert "num_roots" in details
        assert "num_nodes" in details
        assert "mutations" in details

    @pytest.mark.asyncio
    async def test_get_individual_details(self, minimal_ts):
        """Test getting individual details."""
        from lorax.handlers import get_individual_details

        # Skip if no individuals
        if minimal_ts.num_individuals == 0:
            pytest.skip("No individuals in tree sequence")

        details = get_individual_details(minimal_ts, 0)

        assert "id" in details
        assert "nodes" in details
        assert "metadata" in details

    @pytest.mark.asyncio
    async def test_handle_details(self, minimal_ts_file):
        """Test the handle_details function."""
        from lorax.handlers import handle_details

        data = {
            "treeIndex": 0,
            "node": 0,
            "comprehensive": False
        }

        result = await handle_details(str(minimal_ts_file), data)
        result_data = json.loads(result)

        assert "tree" in result_data
        assert "node" in result_data

    @pytest.mark.asyncio
    async def test_handle_details_comprehensive(self, minimal_ts_file):
        """Test handle_details with comprehensive flag."""
        from lorax.handlers import handle_details

        data = {
            "treeIndex": 0,
            "node": 0,
            "comprehensive": True
        }

        result = await handle_details(str(minimal_ts_file), data)
        result_data = json.loads(result)

        assert "tree" in result_data
        assert "node" in result_data
        assert "mutations" in result_data
        assert "edges" in result_data


class TestEdgesQuery:
    """Tests for edge query handlers."""

    @pytest.mark.asyncio
    async def test_get_edges_for_interval(self, minimal_ts):
        """Test getting edges for a genomic interval."""
        from lorax.handlers import get_edges_for_interval

        edges = get_edges_for_interval(minimal_ts, 0, 1000)

        assert isinstance(edges, np.ndarray)
        if len(edges) > 0:
            assert edges.shape[1] == 4  # left, right, parent, child

    @pytest.mark.asyncio
    async def test_handle_edges_query(self, minimal_ts_file):
        """Test handle_edges_query function."""
        from lorax.handlers import handle_edges_query

        result = await handle_edges_query(str(minimal_ts_file), 0, 1000)
        data = json.loads(result)

        assert "edges" in data
        assert "start" in data
        assert "end" in data

    @pytest.mark.asyncio
    async def test_handle_edges_query_no_file(self, temp_dir):
        """Test handle_edges_query with non-existent file."""
        from lorax.handlers import handle_edges_query

        result = await handle_edges_query(
            str(temp_dir / "nonexistent.trees"), 0, 1000
        )
        data = json.loads(result)

        assert "error" in data


class TestNodeSearch:
    """Tests for node search functionality."""

    @pytest.mark.asyncio
    async def test_search_nodes_in_trees_empty(self, minimal_ts):
        """Test search with empty inputs."""
        from lorax.handlers import search_nodes_in_trees

        result = search_nodes_in_trees(minimal_ts, [], [])

        assert result["highlights"] == {}
        assert result["lineage"] == {}

    @pytest.mark.asyncio
    async def test_search_nodes_in_trees(self, minimal_ts):
        """Test searching for nodes in trees."""
        from lorax.handlers import search_nodes_in_trees

        # Get a sample node name
        sample_id = minimal_ts.samples()[0]

        result = search_nodes_in_trees(
            minimal_ts,
            sample_names=[str(sample_id)],
            tree_indices=[0],
            show_lineages=False
        )

        # May or may not find nodes depending on metadata
        assert "highlights" in result
        assert "lineage" in result


class TestTreeGraphQuery:
    """Tests for tree graph query handlers."""

    @pytest.mark.asyncio
    async def test_handle_tree_graph_query(self, minimal_ts_file):
        """Test handle_tree_graph_query function."""
        from lorax.handlers import handle_tree_graph_query

        result = await handle_tree_graph_query(
            str(minimal_ts_file),
            tree_indices=[0],
            sparsification=False
        )

        assert "buffer" in result
        assert "global_min_time" in result
        assert "global_max_time" in result
        assert "tree_indices" in result
        assert isinstance(result["buffer"], bytes)

    @pytest.mark.asyncio
    async def test_handle_tree_graph_query_with_sparsification(self, minimal_ts_file):
        """Test tree graph query with sparsification."""
        from lorax.handlers import handle_tree_graph_query

        result = await handle_tree_graph_query(
            str(minimal_ts_file),
            tree_indices=[0],
            sparsification=True
        )

        assert "buffer" in result
        assert isinstance(result["buffer"], bytes)

    @pytest.mark.asyncio
    async def test_handle_tree_graph_query_multiple_trees(self, minimal_ts_file):
        """Test tree graph query with multiple trees."""
        from lorax.handlers import handle_tree_graph_query, get_or_load_ts

        ts = await get_or_load_ts(str(minimal_ts_file))
        num_trees = min(ts.num_trees, 5)
        tree_indices = list(range(num_trees))

        result = await handle_tree_graph_query(
            str(minimal_ts_file),
            tree_indices=tree_indices,
            sparsification=False
        )

        assert len(result["tree_indices"]) == num_trees


class TestCacheStatus:
    """Tests for cache status reporting."""

    @pytest.mark.asyncio
    async def test_cache_status(self):
        """Test cache_status function."""
        from lorax.handlers import cache_status

        status = await cache_status()

        assert "rss_MB" in status
        assert "vms_MB" in status
        assert "ts_cache_size" in status
        assert "pid" in status
        assert isinstance(status["rss_MB"], float)


class TestMutationsHandlers:
    """Tests for mutation-related handlers."""

    @pytest.mark.asyncio
    async def test_get_mutations_for_node(self, minimal_ts):
        """Test getting mutations for a specific node."""
        from lorax.handlers import get_mutations_for_node

        # Get any node with mutations
        mutations = get_mutations_for_node(minimal_ts, node_id=0)

        assert isinstance(mutations, list)
        for mut in mutations:
            assert "id" in mut
            assert "site_id" in mut
            assert "position" in mut

    @pytest.mark.asyncio
    async def test_get_mutations_for_node_with_tree_filter(self, minimal_ts):
        """Test getting mutations filtered by tree."""
        from lorax.handlers import get_mutations_for_node

        mutations = get_mutations_for_node(
            minimal_ts, node_id=0, tree_index=0
        )

        assert isinstance(mutations, list)

    @pytest.mark.asyncio
    async def test_get_edges_for_node(self, minimal_ts):
        """Test getting edges for a specific node."""
        from lorax.handlers import get_edges_for_node

        edges = get_edges_for_node(minimal_ts, node_id=0)

        assert "as_parent" in edges
        assert "as_child" in edges
        assert isinstance(edges["as_parent"], list)
        assert isinstance(edges["as_child"], list)
