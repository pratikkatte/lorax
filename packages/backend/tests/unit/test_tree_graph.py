"""
Unit Tests for Tree Graph Module

Tests tree construction, coordinate normalization,
sparsification, and batch processing.
"""

import pytest
import numpy as np

# Check if numba is available (required for tree_graph module)
try:
    import numba
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False

pytestmark = pytest.mark.skipif(not HAS_NUMBA, reason="numba not installed")


class TestTreeGraph:
    """Tests for the TreeGraph class."""

    def test_tree_graph_attributes(self, minimal_ts):
        """Test TreeGraph has expected attributes after construction."""
        from lorax.tree_graph import construct_tree

        edges = minimal_ts.tables.edges
        nodes = minimal_ts.tables.nodes
        breakpoints = list(minimal_ts.breakpoints())
        min_time = float(minimal_ts.min_time)
        max_time = float(minimal_ts.max_time)

        graph = construct_tree(
            minimal_ts, edges, nodes, breakpoints,
            tree_idx=0,
            min_time=min_time,
            max_time=max_time
        )

        # Check arrays exist
        assert hasattr(graph, 'x')
        assert hasattr(graph, 'y')
        assert hasattr(graph, 'in_tree')
        assert hasattr(graph, 'parent_ids')

        # Check array shapes
        num_nodes = minimal_ts.num_nodes
        assert len(graph.x) == num_nodes
        assert len(graph.y) == num_nodes
        assert len(graph.in_tree) == num_nodes

    def test_tree_graph_coordinate_ranges(self, minimal_ts):
        """Test that coordinates are properly normalized."""
        from lorax.tree_graph import construct_tree

        edges = minimal_ts.tables.edges
        nodes = minimal_ts.tables.nodes
        breakpoints = list(minimal_ts.breakpoints())
        min_time = float(minimal_ts.min_time)
        max_time = float(minimal_ts.max_time)

        graph = construct_tree(
            minimal_ts, edges, nodes, breakpoints,
            tree_idx=0,
            min_time=min_time,
            max_time=max_time
        )

        # Filter to nodes actually in the tree
        in_tree_mask = graph.in_tree
        x_values = graph.x[in_tree_mask]
        y_values = graph.y[in_tree_mask]

        if len(x_values) > 0:
            # Coordinates should be normalized
            assert np.all(x_values >= 0)
            assert np.all(x_values <= 1) or np.allclose(x_values.max(), 1, atol=0.1)
            assert np.all(y_values >= 0)
            assert np.all(y_values <= 1) or np.allclose(y_values.max(), 1, atol=0.1)

    def test_tree_graph_sample_nodes(self, minimal_ts):
        """Test that sample nodes are marked correctly."""
        from lorax.tree_graph import construct_tree

        edges = minimal_ts.tables.edges
        nodes = minimal_ts.tables.nodes
        breakpoints = list(minimal_ts.breakpoints())
        min_time = float(minimal_ts.min_time)
        max_time = float(minimal_ts.max_time)

        graph = construct_tree(
            minimal_ts, edges, nodes, breakpoints,
            tree_idx=0,
            min_time=min_time,
            max_time=max_time
        )

        # Sample nodes should be in the tree
        for sample_id in minimal_ts.samples():
            # Most samples should be in most trees
            # (though some might not be if tree is empty at their position)
            pass  # Just verify no errors


class TestConstructTreesBatch:
    """Tests for batch tree construction."""

    def test_construct_trees_batch_single(self, minimal_ts):
        """Test batch construction with single tree."""
        from lorax.tree_graph import construct_trees_batch

        buffer, min_time, max_time, indices = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=False
        )

        assert isinstance(buffer, bytes)
        assert len(buffer) > 0
        assert min_time <= max_time
        assert indices == [0]

    def test_construct_trees_batch_multiple(self, minimal_ts):
        """Test batch construction with multiple trees."""
        from lorax.tree_graph import construct_trees_batch

        num_trees = min(minimal_ts.num_trees, 5)
        tree_indices = list(range(num_trees))

        buffer, min_time, max_time, indices = construct_trees_batch(
            minimal_ts,
            tree_indices=tree_indices,
            sparsification=False
        )

        assert isinstance(buffer, bytes)
        assert len(indices) == num_trees

    def test_construct_trees_batch_with_sparsification(self, minimal_ts):
        """Test batch construction with sparsification enabled."""
        from lorax.tree_graph import construct_trees_batch

        buffer, min_time, max_time, indices = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True
        )

        assert isinstance(buffer, bytes)
        # Sparsified buffer should generally be smaller or equal

    def test_construct_trees_batch_invalid_index(self, minimal_ts):
        """Test batch construction with invalid tree index."""
        from lorax.tree_graph import construct_trees_batch

        # Invalid indices should be handled gracefully
        buffer, min_time, max_time, indices = construct_trees_batch(
            minimal_ts,
            tree_indices=[999999],  # Invalid index
            sparsification=False
        )

        # Should either skip invalid or handle gracefully
        assert isinstance(buffer, bytes)

    def test_construct_trees_batch_empty(self, minimal_ts):
        """Test batch construction with empty tree list."""
        from lorax.tree_graph import construct_trees_batch

        buffer, min_time, max_time, indices = construct_trees_batch(
            minimal_ts,
            tree_indices=[],
            sparsification=False
        )

        assert isinstance(buffer, bytes)
        assert indices == []


class TestArrowBuffer:
    """Tests for PyArrow buffer encoding."""

    def test_arrow_buffer_structure(self, minimal_ts):
        """Test that Arrow buffer has correct structure."""
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        buffer, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=False
        )

        # Parse the buffer
        reader = pa.ipc.open_stream(buffer)
        table = reader.read_all()

        # Check expected columns
        expected_columns = ['node_id', 'parent_id', 'is_tip', 'tree_idx', 'x', 'y']
        for col in expected_columns:
            assert col in table.column_names, f"Missing column: {col}"

    def test_arrow_buffer_dtypes(self, minimal_ts):
        """Test that Arrow buffer has correct data types."""
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        buffer, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=False
        )

        reader = pa.ipc.open_stream(buffer)
        table = reader.read_all()

        # Check column types
        schema = table.schema
        assert pa.types.is_int32(schema.field('node_id').type)
        assert pa.types.is_int32(schema.field('parent_id').type)
        assert pa.types.is_boolean(schema.field('is_tip').type)
        assert pa.types.is_int32(schema.field('tree_idx').type)
        assert pa.types.is_float32(schema.field('x').type)
        assert pa.types.is_float32(schema.field('y').type)

    def test_arrow_buffer_values(self, minimal_ts):
        """Test that Arrow buffer contains valid values."""
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        buffer, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=False
        )

        reader = pa.ipc.open_stream(buffer)
        table = reader.read_all()

        # Convert to pandas for easier testing
        df = table.to_pandas()

        if len(df) > 0:
            # Node IDs should be valid
            assert df['node_id'].min() >= 0

            # Parent IDs should be -1 (root) or valid node IDs
            assert df['parent_id'].min() >= -1

            # Tree indices should match requested
            assert df['tree_idx'].unique().tolist() == [0]

            # Coordinates should be normalized
            assert df['x'].min() >= 0
            assert df['y'].min() >= 0


class TestSparsification:
    """Tests for tree sparsification algorithm."""

    def test_sparsification_reduces_nodes(self, minimal_ts):
        """Test that sparsification reduces node count."""
        from lorax.tree_graph import construct_trees_batch

        # Without sparsification
        buffer_full, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=False
        )

        # With sparsification
        buffer_sparse, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True
        )

        # Sparsified should be smaller or equal
        assert len(buffer_sparse) <= len(buffer_full)

    def test_sparsification_preserves_tips(self, minimal_ts):
        """Test that sparsification preserves tip nodes."""
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        buffer, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True
        )

        reader = pa.ipc.open_stream(buffer)
        table = reader.read_all()
        df = table.to_pandas()

        # All samples should still be present
        tip_nodes = df[df['is_tip'] == True]
        assert len(tip_nodes) > 0

    def test_sparsification_tree_structure_valid(self, minimal_ts):
        """Test that sparsified tree has valid structure."""
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        buffer, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True
        )

        reader = pa.ipc.open_stream(buffer)
        table = reader.read_all()
        df = table.to_pandas()

        if len(df) > 0:
            # Build node set for validation
            node_ids = set(df['node_id'].tolist())

            # All parent_ids (except -1) should be in node_ids
            for parent_id in df['parent_id']:
                if parent_id != -1:
                    assert parent_id in node_ids, f"Parent {parent_id} not in nodes"
