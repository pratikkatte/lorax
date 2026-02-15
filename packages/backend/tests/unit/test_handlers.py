"""
Unit Tests for Data Handlers

Tests file loading, tree queries, details handling,
and PyArrow buffer encoding.
"""

import pytest
import json
import asyncio
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np
import tskit

# Check if numba is available (required for tree_graph module)
try:
    import numba
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False

pytestmark = pytest.mark.skipif(not HAS_NUMBA, reason="numba not installed")


def _build_metadata_test_tree_sequence():
    """Build a small single-tree sequence with node metadata for highlight tests."""
    tables = tskit.TableCollection(sequence_length=1.0)
    root = tables.nodes.add_row(time=1.0, flags=0)
    sample_specs = [
        {"name": "s0", "group": "A"},
        {"name": "s1", "group": "A"},
        {"name": "s2", "group": 2},
        {"name": "s3"},
        {"name": "s4", "group": ""},
    ]
    sample_ids = []
    for spec in sample_specs:
        node_id = tables.nodes.add_row(
            time=0.0,
            flags=tskit.NODE_IS_SAMPLE,
            metadata=json.dumps(spec).encode("utf-8"),
        )
        tables.edges.add_row(0.0, 1.0, root, node_id)
        sample_ids.append(node_id)
    tables.sort()
    return tables.tree_sequence(), sample_ids


class TestFileLoading:
    """Tests for file loading functions."""

    @pytest.mark.asyncio
    async def test_get_file_mtime(self, minimal_ts_file):
        """Test getting file modification time."""
        from lorax.cache.file_cache import _get_file_mtime

        mtime = _get_file_mtime(str(minimal_ts_file))
        assert mtime > 0

    @pytest.mark.asyncio
    async def test_get_file_mtime_nonexistent(self):
        """Test getting mtime for non-existent file."""
        from lorax.cache.file_cache import _get_file_mtime

        mtime = _get_file_mtime("/nonexistent/path.trees")
        assert mtime == 0.0

    @pytest.mark.asyncio
    async def test_get_file_context(self, minimal_ts_file):
        """Test loading a FileContext."""
        from lorax.cache import get_file_context

        ctx = await get_file_context(str(minimal_ts_file))

        assert ctx is not None
        assert ctx.tree_sequence is not None
        assert hasattr(ctx.tree_sequence, 'num_trees')
        assert hasattr(ctx.tree_sequence, 'num_samples')
        assert ctx.config is not None
        assert ctx.mtime > 0

    @pytest.mark.asyncio
    async def test_get_file_context_cached(self, minimal_ts_file):
        """Test that FileContexts are cached."""
        from lorax.cache import get_file_context
        from lorax.cache.file_cache import _file_cache

        # Clear cache first
        _file_cache.cache.clear()

        # First load
        ctx1 = await get_file_context(str(minimal_ts_file))
        assert ctx1 is not None

        # Second load should use cache
        ctx2 = await get_file_context(str(minimal_ts_file))
        assert ctx2 is ctx1  # Same object

    @pytest.mark.asyncio
    async def test_get_file_context_nonexistent(self, temp_dir):
        """Test loading non-existent file."""
        from lorax.cache import get_file_context

        ctx = await get_file_context(str(temp_dir / "nonexistent.trees"))
        assert ctx is None

    @pytest.mark.asyncio
    async def test_get_or_load_ts(self, minimal_ts_file):
        """Test backwards-compatible get_or_load_ts function."""
        from lorax.cache import get_or_load_ts

        ts = await get_or_load_ts(str(minimal_ts_file))

        assert ts is not None
        assert hasattr(ts, 'num_trees')
        assert hasattr(ts, 'num_samples')

    @pytest.mark.asyncio
    async def test_get_or_load_ts_nonexistent(self, temp_dir):
        """Test loading non-existent file with backwards-compatible function."""
        from lorax.cache import get_or_load_ts

        ts = await get_or_load_ts(str(temp_dir / "nonexistent.trees"))
        assert ts is None

    @pytest.mark.asyncio
    async def test_load_csv_file(self, sample_csv_file):
        """Test loading a CSV file."""
        from lorax.cache import get_file_context
        import pandas as pd

        ctx = await get_file_context(str(sample_csv_file))

        assert ctx is not None
        assert isinstance(ctx.tree_sequence, pd.DataFrame)
        assert ctx.is_csv
        assert not ctx.is_tree_sequence


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


class TestHighlightOptimizations:
    """Tests for optimized highlight/multi-search paths."""

    @pytest.mark.asyncio
    async def test_value_to_sample_nodes_index_exact_match_and_cache(self):
        from lorax.cache.file_context import FileContext
        from lorax.handlers import _get_value_to_sample_nodes_index

        ts, sample_ids = _build_metadata_test_tree_sequence()
        ctx = FileContext(
            file_path="in-memory.trees",
            tree_sequence=ts,
            config={},
            mtime=0.0,
        )

        index = _get_value_to_sample_nodes_index(
            ctx,
            "group",
            sources=("node",),
            sample_name_key="name",
        )

        assert sorted(index["A"].tolist()) == sorted(sample_ids[:2])
        assert index["2"].tolist() == [sample_ids[2]]
        assert index[""].tolist() == [sample_ids[4]]
        assert sample_ids[3] not in index[""].tolist()

        cached = _get_value_to_sample_nodes_index(
            ctx,
            "group",
            sources=("node",),
            sample_name_key="name",
        )
        assert cached is index

    @pytest.mark.asyncio
    async def test_get_highlight_positions_uses_index_and_vectorized_filter(self):
        from lorax.cache import TreeGraphCache
        from lorax.cache.file_context import FileContext
        from lorax.handlers import get_highlight_positions

        ts, sample_ids = _build_metadata_test_tree_sequence()
        ctx = FileContext(
            file_path="in-memory.trees",
            tree_sequence=ts,
            config={},
            mtime=0.0,
        )
        cache = TreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)

        result = await get_highlight_positions(
            ts,
            "in-memory.trees",
            "group",
            "A",
            [0],
            "session-highlight",
            cache,
            sources=("node",),
            ctx=ctx,
        )

        node_ids = sorted(pos["node_id"] for pos in result["positions"])
        assert node_ids == sorted(sample_ids[:2])
        assert all(pos["tree_idx"] == 0 for pos in result["positions"])

    @pytest.mark.asyncio
    async def test_get_multi_value_highlight_positions_parity(self):
        from lorax.cache import TreeGraphCache
        from lorax.cache.file_context import FileContext
        from lorax.handlers import get_multi_value_highlight_positions

        ts, sample_ids = _build_metadata_test_tree_sequence()
        ctx = FileContext(
            file_path="in-memory.trees",
            tree_sequence=ts,
            config={},
            mtime=0.0,
        )
        cache = TreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)

        result = await get_multi_value_highlight_positions(
            ts,
            "in-memory.trees",
            "group",
            ["A", 2, "", "missing"],
            [0],
            "session-multi",
            cache,
            show_lineages=True,
            sources=("node",),
            ctx=ctx,
        )

        assert len(result["positions_by_value"]["A"]) == 2
        assert len(result["positions_by_value"]["2"]) == 1
        assert len(result["positions_by_value"][""]) == 1
        assert len(result["positions_by_value"]["missing"]) == 0
        assert result["total_count"] == 4
        assert "A" in result["lineages"]
        assert 0 in result["lineages"]["A"]
        assert len(result["lineages"]["A"][0]) == 2
        lineage_nodes = [entry["path_node_ids"][-1] for entry in result["lineages"]["A"][0]]
        assert sorted(lineage_nodes) == sorted(sample_ids[:2])

    @pytest.mark.asyncio
    async def test_highlight_cache_miss_dedupes_concurrent_tree_build(self):
        from lorax.cache import TreeGraphCache
        from lorax.cache.file_context import FileContext
        import lorax.handlers as handlers_module

        ts, _ = _build_metadata_test_tree_sequence()
        ctx = FileContext(
            file_path="in-memory.trees",
            tree_sequence=ts,
            config={},
            mtime=0.0,
        )
        cache = TreeGraphCache(local_ttl_seconds=3600, cleanup_interval_seconds=60)
        handlers_module._TREE_GRAPH_LOAD_TASKS.clear()

        call_count = 0
        original_construct_tree = handlers_module.construct_tree

        def counting_construct_tree(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            time.sleep(0.05)
            return original_construct_tree(*args, **kwargs)

        with patch("lorax.handlers.construct_tree", side_effect=counting_construct_tree):
            await asyncio.gather(
                handlers_module.get_highlight_positions(
                    ts,
                    "in-memory.trees",
                    "group",
                    "A",
                    [0],
                    "dedupe-session",
                    cache,
                    sources=("node",),
                    ctx=ctx,
                ),
                handlers_module.get_highlight_positions(
                    ts,
                    "in-memory.trees",
                    "group",
                    "A",
                    [0],
                    "dedupe-session",
                    cache,
                    sources=("node",),
                    ctx=ctx,
                ),
            )

        assert call_count == 1


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
        from lorax.handlers import handle_tree_graph_query
        from lorax.cache import get_file_context

        ctx = await get_file_context(str(minimal_ts_file))
        ts = ctx.tree_sequence
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
        assert "file_cache_size" in status
        assert "pid" in status
        assert isinstance(status["rss_MB"], float)


class TestFileContext:
    """Tests for FileContext functionality."""

    @pytest.mark.asyncio
    async def test_file_context_metadata_caching(self, minimal_ts_file):
        """Test that FileContext caches metadata."""
        from lorax.cache import get_file_context

        ctx = await get_file_context(str(minimal_ts_file))
        assert ctx is not None

        # Set some metadata
        ctx.set_metadata("test_key", {"sample1": "value1"})

        # Get it back
        cached = ctx.get_metadata("test_key")
        assert cached == {"sample1": "value1"}

        # Non-existent key returns None
        assert ctx.get_metadata("nonexistent") is None

    @pytest.mark.asyncio
    async def test_file_context_clear_metadata(self, minimal_ts_file):
        """Test clearing FileContext metadata."""
        from lorax.cache import get_file_context

        ctx = await get_file_context(str(minimal_ts_file))

        ctx.set_metadata("key1", "value1")
        ctx.set_metadata("key2", "value2")

        ctx.clear_metadata()

        assert ctx.get_metadata("key1") is None
        assert ctx.get_metadata("key2") is None

    @pytest.mark.asyncio
    async def test_file_context_properties(self, minimal_ts_file, sample_csv_file):
        """Test FileContext type properties."""
        from lorax.cache import get_file_context

        # Test with tree sequence
        ctx_ts = await get_file_context(str(minimal_ts_file))
        assert ctx_ts.is_tree_sequence
        assert not ctx_ts.is_csv
        assert ctx_ts.ts is ctx_ts.tree_sequence

        # Test with CSV
        ctx_csv = await get_file_context(str(sample_csv_file))
        assert ctx_csv.is_csv
        assert not ctx_csv.is_tree_sequence


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


class TestCompareTreesDiff:
    """Tests for get_compare_trees_diff (compare topology)."""

    @pytest.mark.anyio
    async def test_get_compare_trees_diff_csv(self, temp_dir):
        """Test compare topology with CSV file (different Newick topologies)."""
        from lorax.cache import CsvTreeGraphCache, get_file_context
        from lorax.handlers import get_compare_trees_diff

        def _node_index(graph, node_id):
            matches = np.where(graph.node_id == int(node_id))[0]
            assert len(matches) == 1
            return int(matches[0])

        def _assert_edge_coords_match_graph(edge, graph):
            parent_idx = _node_index(graph, edge["parent"])
            child_idx = _node_index(graph, edge["child"])

            assert edge["parent_x"] == pytest.approx(float(graph.x[parent_idx]))
            assert edge["parent_y"] == pytest.approx(float(graph.y[parent_idx]))
            assert edge["child_x"] == pytest.approx(float(graph.x[child_idx]))
            assert edge["child_y"] == pytest.approx(float(graph.y[child_idx]))

        # Create CSV with genomic_positions and newick (different topologies)
        csv_content = """genomic_positions,newick
0,((A:0.1,B:0.2):0.3,C:0.4);
1000,((A:0.1,C:0.2):0.3,B:0.4);
2000,((B:0.1,C:0.2):0.3,A:0.4);
"""
        csv_path = temp_dir / "compare_test.csv"
        csv_path.write_text(csv_content)

        ctx = await get_file_context(str(csv_path))
        assert ctx is not None
        assert ctx.is_csv

        csv_cache = CsvTreeGraphCache()
        session_id = "test-session-compare"
        result = await get_compare_trees_diff(
            str(csv_path),
            tree_indices=[0, 1, 2],
            session_id=session_id,
            tree_graph_cache=None,
            csv_tree_graph_cache=csv_cache,
        )

        assert "comparisons" in result
        assert "error" not in result
        # Two consecutive pairs: (0,1) and (1,2)
        assert len(result["comparisons"]) == 2
        for comp in result["comparisons"]:
            prev_graph = await csv_cache.get(session_id, int(comp["prev_idx"]))
            next_graph = await csv_cache.get(session_id, int(comp["next_idx"]))

            assert "prev_idx" in comp
            assert "next_idx" in comp
            assert "inserted" in comp
            assert "removed" in comp
            assert prev_graph is not None
            assert next_graph is not None

            # Different topologies should yield some inserted/removed edges
            assert isinstance(comp["inserted"], list)
            assert isinstance(comp["removed"], list)
            # Canonical edge semantics: *_x uses graph.x (layout), *_y uses graph.y (time).
            for e in comp["inserted"]:
                _assert_edge_coords_match_graph(e, next_graph)
            for e in comp["removed"]:
                _assert_edge_coords_match_graph(e, prev_graph)

            # Basic payload shape checks.
            for e in comp["inserted"] + comp["removed"]:
                assert "parent_x" in e
                assert "parent_y" in e
                assert "child_x" in e
                assert "child_y" in e

    @pytest.mark.asyncio
    async def test_get_compare_trees_diff_csv_single_tree(self, temp_dir):
        """Test compare topology with CSV returns empty when fewer than 2 trees."""
        from lorax.cache import CsvTreeGraphCache, get_file_context
        from lorax.handlers import get_compare_trees_diff

        csv_content = """genomic_positions,newick
0,((A:0.1,B:0.2):0.3,C:0.4);
"""
        csv_path = temp_dir / "single.csv"
        csv_path.write_text(csv_content)

        await get_file_context(str(csv_path))
        csv_cache = CsvTreeGraphCache()
        result = await get_compare_trees_diff(
            str(csv_path),
            tree_indices=[0],
            session_id="test",
            tree_graph_cache=None,
            csv_tree_graph_cache=csv_cache,
        )

        assert result["comparisons"] == []
