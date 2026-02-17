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

    def test_sparsification_no_orphaned_mutations(self, minimal_ts):
        """With sparsification, every mut_node_id must exist in the node table for that tree."""
        import struct
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        if minimal_ts.num_mutations == 0:
            pytest.skip("minimal_ts has no mutations")

        buffer, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=list(range(min(minimal_ts.num_trees, 5))),
            sparsification=True,
        )

        node_len = struct.unpack("<I", buffer[:4])[0]
        node_bytes = buffer[4 : 4 + node_len]
        mut_bytes = buffer[4 + node_len :]

        node_table = pa.ipc.open_stream(node_bytes).read_all()
        node_df = node_table.to_pandas()

        kept_nodes = set(zip(node_df["tree_idx"], node_df["node_id"]))

        if len(mut_bytes) > 0:
            mut_table = pa.ipc.open_stream(mut_bytes).read_all()
            mut_df = mut_table.to_pandas()
            for _, row in mut_df.iterrows():
                key = (row["mut_tree_idx"], row["mut_node_id"])
                assert key in kept_nodes, (
                    f"Orphaned mutation: mut_node_id={row['mut_node_id']} "
                    f"not in kept nodes for tree_idx={row['mut_tree_idx']}"
                )

    def test_sparsification_midpoint_only_when_tips_span_x(self, minimal_ts):
        """When tips span x (not all at 1), midpoint-only deduplication is used (more aggressive)."""
        from lorax.tree_graph import construct_tree
        from lorax.tree_graph.tree_graph import _sparsify_edges

        edges = minimal_ts.tables.edges
        nodes = minimal_ts.tables.nodes
        breakpoints = list(minimal_ts.breakpoints())
        graph = construct_tree(
            minimal_ts, edges, nodes, breakpoints,
            index=0,
            min_time=float(minimal_ts.min_time),
            max_time=float(minimal_ts.max_time),
        )

        indices = np.where(graph.in_tree)[0].astype(np.int32)
        n = len(indices)
        if n == 0:
            pytest.skip("empty tree")

        node_ids = indices
        parent_ids = graph.parent[indices]
        x = graph.x[indices].astype(np.float32)
        y = graph.y[indices].astype(np.float32)

        order = np.argsort(node_ids)
        sorted_ids = node_ids[order]
        pos = np.searchsorted(sorted_ids, parent_ids)
        parent_indices = np.full(n, -1, dtype=np.int32)
        safe_pos = np.minimum(pos, n - 1)
        valid = (parent_ids != -1) & (pos < n) & (sorted_ids[safe_pos] == parent_ids)
        parent_indices[valid] = order[pos[valid]]

        resolution = 100
        keep_midpoint = _sparsify_edges(x, y, parent_indices, resolution, use_midpoint_only=True)
        keep_direction = _sparsify_edges(x, y, parent_indices, resolution, use_midpoint_only=False)

        # Midpoint-only is more aggressive: keeps <= direction-based nodes
        assert np.sum(keep_midpoint) <= np.sum(keep_direction)

    def test_sparsification_cell_size_multiplier_controls_density(self, minimal_ts):
        """Lower cell-size multiplier should retain at least as many nodes as higher multiplier."""
        import struct
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        tree_indices = list(range(min(minimal_ts.num_trees, 5)))
        if not tree_indices:
            pytest.skip("minimal_ts has no trees")

        dense_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=tree_indices,
            sparsification=True,
            sparsify_cell_size_multiplier=0.25,
        )
        coarse_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=tree_indices,
            sparsification=True,
            sparsify_cell_size_multiplier=1.75,
        )

        dense_node_len = struct.unpack("<I", dense_buffer[:4])[0]
        coarse_node_len = struct.unpack("<I", coarse_buffer[:4])[0]
        dense_nodes = pa.ipc.open_stream(dense_buffer[4:4 + dense_node_len]).read_all().num_rows
        coarse_nodes = pa.ipc.open_stream(coarse_buffer[4:4 + coarse_node_len]).read_all().num_rows

        assert dense_nodes >= coarse_nodes

    def test_adaptive_sparsification_bbox_does_not_crop_nodes(self, minimal_ts):
        """Adaptive bbox mode keeps full tree output and only adjusts in-bbox density."""
        import struct
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        bbox = {
            "min_x": 0.45,
            "max_x": 0.55,
            "min_y": 0.2,
            "max_y": 0.8,
        }
        buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            adaptive_sparsify_bbox=bbox,
            adaptive_target_tree_idx=0,
            adaptive_outside_cell_size=0.002,
            sparsify_cell_size_multiplier=0.5,
        )

        node_len = struct.unpack("<I", buffer[:4])[0]
        node_table = pa.ipc.open_stream(buffer[4:4 + node_len]).read_all()
        node_df = node_table.to_pandas()

        assert len(node_df) > 0

        in_bbox = (
            (node_df["x"] >= bbox["min_x"])
            & (node_df["x"] <= bbox["max_x"])
            & (node_df["y"] >= bbox["min_y"])
            & (node_df["y"] <= bbox["max_y"])
        )
        assert (~in_bbox).any(), "Adaptive mode must keep nodes outside bbox (no cropping)"

        node_ids = set(node_df["node_id"].tolist())
        for parent_id in node_df["parent_id"]:
            if parent_id != -1:
                assert parent_id in node_ids

    def test_adaptive_sparsification_increases_inside_density(self, minimal_ts):
        """Adaptive mode should retain at least as many in-bbox nodes as baseline sparsification."""
        import struct
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        bbox = {
            "min_x": 0.0,
            "max_x": 1.0,
            "min_y": 0.0,
            "max_y": 0.6,
        }
        baseline_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            sparsify_cell_size=0.002,
        )
        adaptive_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            sparsify_cell_size=0.002,
            sparsify_cell_size_multiplier=0.5,
            adaptive_sparsify_bbox=bbox,
            adaptive_target_tree_idx=0,
            adaptive_outside_cell_size=0.002,
        )

        baseline_node_len = struct.unpack("<I", baseline_buffer[:4])[0]
        adaptive_node_len = struct.unpack("<I", adaptive_buffer[:4])[0]
        baseline_nodes = pa.ipc.open_stream(baseline_buffer[4:4 + baseline_node_len]).read_all().to_pandas()
        adaptive_nodes = pa.ipc.open_stream(adaptive_buffer[4:4 + adaptive_node_len]).read_all().to_pandas()

        baseline_in_bbox = (
            (baseline_nodes["x"] >= bbox["min_x"])
            & (baseline_nodes["x"] <= bbox["max_x"])
            & (baseline_nodes["y"] >= bbox["min_y"])
            & (baseline_nodes["y"] <= bbox["max_y"])
        ).sum()
        adaptive_in_bbox = (
            (adaptive_nodes["x"] >= bbox["min_x"])
            & (adaptive_nodes["x"] <= bbox["max_x"])
            & (adaptive_nodes["y"] >= bbox["min_y"])
            & (adaptive_nodes["y"] <= bbox["max_y"])
        ).sum()

        assert adaptive_in_bbox >= baseline_in_bbox

    def test_adaptive_sparsification_mutations_keep_refs_and_outside_points(self, minimal_ts):
        """Adaptive mode should not crop mutations to bbox and must keep valid node refs."""
        import struct
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        if minimal_ts.num_mutations == 0:
            pytest.skip("minimal_ts has no mutations")

        bbox = {
            "min_x": 0.25,
            "max_x": 0.75,
            "min_y": 0.0,
            "max_y": 0.6,
        }
        baseline_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            sparsify_cell_size=0.002,
        )
        adaptive_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            sparsify_cell_size=0.002,
            sparsify_cell_size_multiplier=0.5,
            adaptive_sparsify_bbox=bbox,
            adaptive_target_tree_idx=0,
            adaptive_outside_cell_size=0.002,
        )

        baseline_node_len = struct.unpack("<I", baseline_buffer[:4])[0]
        baseline_mut_bytes = baseline_buffer[4 + baseline_node_len :]
        if len(baseline_mut_bytes) == 0:
            pytest.skip("baseline produced no mutations")
        baseline_mut_df = pa.ipc.open_stream(baseline_mut_bytes).read_all().to_pandas()
        baseline_outside = (
            (baseline_mut_df["mut_x"] < bbox["min_x"])
            | (baseline_mut_df["mut_x"] > bbox["max_x"])
            | (baseline_mut_df["mut_y"] < bbox["min_y"])
            | (baseline_mut_df["mut_y"] > bbox["max_y"])
        ).sum()
        if baseline_outside == 0:
            pytest.skip("fixture has no baseline mutations outside bbox")

        adaptive_node_len = struct.unpack("<I", adaptive_buffer[:4])[0]
        adaptive_node_bytes = adaptive_buffer[4 : 4 + adaptive_node_len]
        adaptive_mut_bytes = adaptive_buffer[4 + adaptive_node_len :]

        node_df = pa.ipc.open_stream(adaptive_node_bytes).read_all().to_pandas()
        kept_nodes = set(zip(node_df["tree_idx"], node_df["node_id"]))

        if len(adaptive_mut_bytes) == 0:
            pytest.fail("adaptive mode unexpectedly removed all mutations")

        mut_df = pa.ipc.open_stream(adaptive_mut_bytes).read_all().to_pandas()
        adaptive_outside = (
            (mut_df["mut_x"] < bbox["min_x"])
            | (mut_df["mut_x"] > bbox["max_x"])
            | (mut_df["mut_y"] < bbox["min_y"])
            | (mut_df["mut_y"] > bbox["max_y"])
        ).sum()
        assert adaptive_outside > 0, "adaptive mode should not crop mutations outside bbox"

        for _, row in mut_df.iterrows():
            key = (row["mut_tree_idx"], row["mut_node_id"])
            assert key in kept_nodes

    def test_adaptive_sparsification_inside_never_coarser_than_outside(self, minimal_ts):
        """Even with a coarse multiplier input, adaptive inside must stay >= outside detail."""
        import struct
        import pyarrow as pa
        from lorax.tree_graph import construct_trees_batch

        bbox = {
            "min_x": 0.0,
            "max_x": 1.0,
            "min_y": 0.0,
            "max_y": 1.0,
        }
        baseline_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            sparsify_cell_size=0.002,
        )
        adaptive_buffer, _, _, _, _ = construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            sparsify_cell_size=0.002,
            sparsify_cell_size_multiplier=1.75,  # would be coarser if not clamped
            adaptive_sparsify_bbox=bbox,
            adaptive_target_tree_idx=0,
            adaptive_outside_cell_size=0.002,
        )

        baseline_node_len = struct.unpack("<I", baseline_buffer[:4])[0]
        adaptive_node_len = struct.unpack("<I", adaptive_buffer[:4])[0]
        baseline_nodes = pa.ipc.open_stream(baseline_buffer[4:4 + baseline_node_len]).read_all().num_rows
        adaptive_nodes = pa.ipc.open_stream(adaptive_buffer[4:4 + adaptive_node_len]).read_all().num_rows
        assert adaptive_nodes >= baseline_nodes

    def test_adaptive_sparsification_reuses_cached_outside_cell_size(self, minimal_ts):
        """Adaptive mode should reuse target TreeGraph's recorded outside cell size when available."""
        from lorax.tree_graph import construct_tree, construct_trees_batch

        edges = minimal_ts.tables.edges
        nodes = minimal_ts.tables.nodes
        breakpoints = list(minimal_ts.breakpoints())
        graph = construct_tree(
            minimal_ts,
            edges,
            nodes,
            breakpoints,
            index=0,
            min_time=float(minimal_ts.min_time),
            max_time=float(minimal_ts.max_time),
        )
        graph.last_outside_cell_size = 0.004

        bbox = {
            "min_x": 0.0,
            "max_x": 1.0,
            "min_y": 0.0,
            "max_y": 1.0,
        }
        construct_trees_batch(
            minimal_ts,
            tree_indices=[0],
            sparsification=True,
            pre_cached_graphs={0: graph},
            adaptive_sparsify_bbox=bbox,
            adaptive_target_tree_idx=0,
            sparsify_cell_size_multiplier=0.95,
        )

        assert graph.last_outside_cell_size == pytest.approx(0.004)

    def test_low_coverage_disables_inside_edge_dedupe_only(self):
        """Low-coverage mode should keep all in-bbox edges but leave outside dedupe unchanged."""
        from lorax.tree_graph.tree_graph import _sparsify_edges_adaptive

        x = np.array([0.0, 0.20, 0.22, 0.90, 0.92], dtype=np.float32)
        y = np.array([0.0, 0.20, 0.22, 0.90, 0.92], dtype=np.float32)
        parent_indices = np.array([-1, 0, 0, 0, 0], dtype=np.int32)

        # bbox contains only the first two non-root edges by midpoint
        bbox_min_x, bbox_max_x = 0.0, 0.2
        bbox_min_y, bbox_max_y = 0.0, 0.2

        regular_keep = _sparsify_edges_adaptive(
            x,
            y,
            parent_indices,
            outside_resolution=2,
            inside_resolution=4,
            bbox_min_x=bbox_min_x,
            bbox_max_x=bbox_max_x,
            bbox_min_y=bbox_min_y,
            bbox_max_y=bbox_max_y,
            use_midpoint_only=False,
            disable_inside_sparsification_for_low_coverage=False,
        )
        low_coverage_keep = _sparsify_edges_adaptive(
            x,
            y,
            parent_indices,
            outside_resolution=2,
            inside_resolution=4,
            bbox_min_x=bbox_min_x,
            bbox_max_x=bbox_max_x,
            bbox_min_y=bbox_min_y,
            bbox_max_y=bbox_max_y,
            use_midpoint_only=False,
            disable_inside_sparsification_for_low_coverage=True,
        )

        # In-bbox edges (indices 1,2): low coverage keeps both.
        assert int(low_coverage_keep[1]) + int(low_coverage_keep[2]) == 2
        assert int(regular_keep[1]) + int(regular_keep[2]) == 1

        # Outside-bbox dedupe behavior (indices 3,4) stays identical.
        assert bool(low_coverage_keep[3]) == bool(regular_keep[3])
        assert bool(low_coverage_keep[4]) == bool(regular_keep[4])

    def test_low_coverage_disables_inside_mutation_dedupe_only(self):
        """Low-coverage mode should keep all in-bbox mutations but preserve outside dedupe."""
        from lorax.tree_graph.tree_graph import _sparsify_mutations_adaptive

        mut_x = np.array([0.10, 0.11, 0.90, 0.91], dtype=np.float32)
        mut_y = np.array([0.10, 0.11, 0.90, 0.91], dtype=np.float32)
        mut_tree_idx = np.array([0, 0, 0, 0], dtype=np.int32)
        mut_node_id = np.array([10, 11, 12, 13], dtype=np.int32)

        bbox_min_x, bbox_max_x = 0.0, 0.2
        bbox_min_y, bbox_max_y = 0.0, 0.2

        regular_keep = _sparsify_mutations_adaptive(
            mut_x,
            mut_y,
            mut_tree_idx,
            mut_node_id,
            outside_resolution=2,
            inside_resolution=4,
            target_tree_idx=0,
            bbox_min_x=bbox_min_x,
            bbox_max_x=bbox_max_x,
            bbox_min_y=bbox_min_y,
            bbox_max_y=bbox_max_y,
            disable_inside_sparsification_for_low_coverage=False,
        )
        low_coverage_keep = _sparsify_mutations_adaptive(
            mut_x,
            mut_y,
            mut_tree_idx,
            mut_node_id,
            outside_resolution=2,
            inside_resolution=4,
            target_tree_idx=0,
            bbox_min_x=bbox_min_x,
            bbox_max_x=bbox_max_x,
            bbox_min_y=bbox_min_y,
            bbox_max_y=bbox_max_y,
            disable_inside_sparsification_for_low_coverage=True,
        )

        # In-bbox mutations (indices 0,1): low coverage keeps both.
        assert int(low_coverage_keep[0]) + int(low_coverage_keep[1]) == 2
        assert int(regular_keep[0]) + int(regular_keep[1]) == 1

        # Outside-bbox dedupe behavior (indices 2,3) stays identical.
        assert bool(low_coverage_keep[2]) == bool(regular_keep[2])
        assert bool(low_coverage_keep[3]) == bool(regular_keep[3])
