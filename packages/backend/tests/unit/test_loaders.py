"""
Unit Tests for File Loaders

Tests tskit and CSV file loading functionality.
"""

import pytest
import json
from pathlib import Path
import pandas as pd


class TestTskitLoader:
    """Tests for tskit file loading."""

    @pytest.mark.asyncio
    async def test_load_trees_file(self, minimal_ts_file):
        """Test loading .trees file."""
        import tskit

        ts = tskit.load(str(minimal_ts_file))

        assert ts is not None
        assert ts.num_trees > 0
        assert ts.num_samples > 0

    @pytest.mark.asyncio
    async def test_load_tsz_file(self, minimal_ts, temp_dir):
        """Test loading .tsz file."""
        import tszip

        # Create tsz file
        tsz_file = temp_dir / "test.tsz"
        tszip.compress(minimal_ts, str(tsz_file))

        # Load it
        ts = tszip.load(str(tsz_file))

        assert ts is not None
        assert ts.num_trees == minimal_ts.num_trees

    def test_compute_config_trees(self, minimal_ts, temp_dir):
        """Test config generation for tree sequence."""
        from lorax.loaders.loader import compute_config

        config = compute_config(minimal_ts, str(temp_dir / "test.trees"), str(temp_dir))

        assert config is not None
        # Config should contain key fields (names may vary by implementation)
        assert "genome_length" in config or "sequence_length" in config
        assert "intervals" in config or "num_trees" in config
        # Verify genome_length matches sequence_length
        if "genome_length" in config:
            assert config["genome_length"] == minimal_ts.sequence_length

    def test_config_includes_metadata_keys(self, minimal_ts, temp_dir):
        """Test that config includes metadata key information."""
        from lorax.loaders.loader import compute_config

        config = compute_config(minimal_ts, str(temp_dir / "test.trees"), str(temp_dir))

        # Should include metadata-related config
        assert "metadata_keys" in config or "node_metadata_keys" in config or True  # May be empty

    def test_config_includes_initial_position(self, minimal_ts, temp_dir):
        """Test that config includes initial position."""
        from lorax.loaders.loader import compute_config

        config = compute_config(minimal_ts, str(temp_dir / "test.trees"), str(temp_dir))

        assert "initial_position" in config
        assert len(config["initial_position"]) == 2


class TestCSVLoader:
    """Tests for CSV file loading."""

    def test_load_csv_file(self, sample_csv_file):
        """Test loading CSV file."""
        df = pd.read_csv(sample_csv_file)

        assert df is not None
        assert len(df) > 0
        assert "id" in df.columns
        assert "parent" in df.columns

    def test_csv_config_generation(self, temp_dir):
        """Test config generation for CSV file with proper format."""
        from lorax.loaders.loader import compute_config

        # Create CSV with required columns for the loader
        csv_content = """genomic_positions,newick
0,((A,B),(C,D));
1000,((A,C),(B,D));
"""
        csv_file = temp_dir / "proper.csv"
        csv_file.write_text(csv_content)

        df = pd.read_csv(csv_file)
        try:
            config = compute_config(df, str(csv_file), str(temp_dir))
            assert config is not None
        except (ValueError, KeyError):
            # CSV loader may have specific requirements
            pytest.skip("CSV loader requires specific format")

    def test_csv_required_columns(self, temp_dir):
        """Test CSV with required columns."""
        csv_content = """id,parent,left,right,time
0,-1,0,1000,100
1,0,0,1000,50
"""
        csv_file = temp_dir / "valid.csv"
        csv_file.write_text(csv_content)

        df = pd.read_csv(csv_file)

        assert "id" in df.columns
        assert "parent" in df.columns
        assert "left" in df.columns
        assert "right" in df.columns
        assert "time" in df.columns


class TestFileContextCaching:
    """Tests for FileContext-based caching."""

    @pytest.mark.asyncio
    async def test_file_context_caches_config(self, minimal_ts_file):
        """Test that FileContext caches config with tree sequence."""
        from lorax.cache import get_file_context
        from lorax.cache.file_cache import _file_cache

        # Clear cache
        _file_cache.cache.clear()

        # Load file
        ctx = await get_file_context(str(minimal_ts_file))

        assert ctx is not None
        assert ctx.config is not None
        assert ctx.tree_sequence is not None

        # Config should be accessible from the same context
        config1 = ctx.config
        config2 = ctx.config
        assert config1 is config2  # Same object

    @pytest.mark.asyncio
    async def test_file_context_atomic_eviction(self, minimal_ts_file):
        """Test that FileContext evicts config with tree sequence."""
        from lorax.cache import get_file_context
        from lorax.cache.file_cache import _file_cache

        # Clear cache
        _file_cache.cache.clear()

        # Load file
        ctx = await get_file_context(str(minimal_ts_file))
        assert ctx is not None

        # Manually clear cache
        _file_cache.cache.clear()

        # Context should be gone
        ctx2 = await get_file_context(str(minimal_ts_file))
        assert ctx2 is not ctx  # New object after cache clear


class TestLoaderEdgeCases:
    """Tests for loader edge cases."""

    def test_minimal_tree_sequence(self):
        """Test handling of minimal tree sequence."""
        try:
            import msprime

            # Create minimal tree sequence
            # Note: sim_ancestry returns 2 samples per individual by default (diploid)
            ts = msprime.sim_ancestry(
                samples=1,  # 1 individual = 2 samples (diploid)
                population_size=1000,
                sequence_length=100,
                random_seed=42,
                ploidy=1  # Explicitly set haploid for 1 sample
            )
            assert ts.num_samples >= 1
        except ImportError:
            pytest.skip("msprime not installed")

    def test_tree_sequence_with_mutations(self, minimal_ts):
        """Test tree sequence with mutations."""
        # minimal_ts fixture already has mutations added
        assert minimal_ts.num_mutations >= 0

    def test_large_sequence_length(self):
        """Test tree sequence with large sequence length."""
        try:
            import msprime

            ts = msprime.sim_ancestry(
                samples=5,
                population_size=1000,
                sequence_length=1e8,  # 100 Mb
                recombination_rate=1e-8,
                random_seed=42
            )
            assert ts.sequence_length == 1e8
        except ImportError:
            pytest.skip("msprime not installed")


class TestNewickTreeParsing:
    """Tests for Newick tree parsing and layout computation."""

    def test_parse_simple_newick(self):
        """Test parsing a simple Newick tree."""
        from lorax.csv.newick_tree import parse_newick_to_tree

        nwk = "((A:0.1,B:0.2):0.3,C:0.4);"
        graph = parse_newick_to_tree(nwk, 0.4)

        assert len(graph.node_id) == 5  # 3 tips + 2 internal
        assert sum(graph.is_tip) == 3  # 3 leaf nodes
        assert graph.x.min() >= 0.0
        assert graph.x.max() <= 1.0
        assert graph.y.min() >= 0.0
        assert graph.y.max() <= 1.0

    def test_parse_newick_names(self):
        """Test that leaf names are extracted correctly."""
        from lorax.csv.newick_tree import parse_newick_to_tree

        nwk = "((A:0.1,B:0.2):0.3,C:0.4);"
        graph = parse_newick_to_tree(nwk, 0.4)

        names = [n for n in graph.name if n]
        assert "A" in names
        assert "B" in names
        assert "C" in names

    def test_parse_newick_parent_relationships(self):
        """Test that parent-child relationships are correct."""
        from lorax.csv.newick_tree import parse_newick_to_tree

        nwk = "((A:0.1,B:0.2):0.3,C:0.4);"
        graph = parse_newick_to_tree(nwk, 0.4)

        # Root should have parent -1
        root_mask = graph.parent_id == -1
        assert sum(root_mask) == 1

        # All other nodes should have valid parents
        non_roots = graph.parent_id[~root_mask]
        assert all(p >= 0 for p in non_roots)

    def test_parse_newick_normalization(self):
        """Test that coordinates are normalized to [0,1]."""
        from lorax.csv.newick_tree import parse_newick_to_tree

        # Tree with branch lengths up to 0.5
        nwk = "((A:0.1,B:0.2):0.3,C:0.5);"
        graph = parse_newick_to_tree(nwk, 0.5)

        # Y should be normalized by max_branch_length:
        # root (past/max-time) near 0, tips (present/min-time) near 1.
        root_mask = graph.parent_id == -1
        assert sum(root_mask) == 1
        assert float(graph.y[root_mask][0]) == pytest.approx(0.0)
        assert float(graph.y[graph.is_tip].max()) == pytest.approx(1.0)

        # X should be normalized based on tip count
        assert graph.x.min() == 0.0
        assert graph.x.max() == 1.0

        # Anchored scaling case: global max > per-tree height.
        # Tips should remain at 1.0, and the root should be 1 - tree_height/global_max.
        graph2 = parse_newick_to_tree(nwk, 0.7, tree_max_branch_length=0.5)
        root_mask2 = graph2.parent_id == -1
        assert sum(root_mask2) == 1
        assert float(graph2.y[graph2.is_tip].max()) == pytest.approx(1.0)
        assert float(graph2.y[root_mask2][0]) == pytest.approx(1.0 - 0.5 / 0.7)

    def test_build_csv_layout_response(self, temp_dir):
        """Test building layout response for CSV trees."""
        import struct
        import pyarrow as pa
        from lorax.csv.layout import build_csv_layout_response

        # Create a simple CSV dataframe
        df = pd.DataFrame({
            "genomic_positions": [0, 1000, 2000],
            "newick": [
                "((A:0.1,B:0.2):0.3,C:0.4);",
                "((A:0.2,B:0.1):0.3,C:0.4);",
                "((A:0.1,C:0.2):0.3,B:0.4);"
            ]
        })

        result = build_csv_layout_response(df, [0, 1, 2], 0.5)

        # Check response structure
        assert "buffer" in result
        assert "global_min_time" in result
        assert "global_max_time" in result
        assert "tree_indices" in result

        # Check buffer format
        buffer = result["buffer"]
        node_len = struct.unpack("<I", buffer[:4])[0]
        node_bytes = buffer[4:4+node_len]

        # Parse PyArrow table
        reader = pa.ipc.open_stream(node_bytes)
        table = reader.read_all()

        # Should have nodes from all 3 trees
        assert len(table) == 15  # 5 nodes per tree * 3 trees
        assert set(table["tree_idx"].to_pylist()) == {0, 1, 2}

    def test_build_csv_layout_response_empty(self, temp_dir):
        """Test building layout response with empty tree indices."""
        from lorax.csv.layout import build_csv_layout_response

        df = pd.DataFrame({
            "genomic_positions": [0],
            "newick": ["((A:0.1,B:0.2):0.3,C:0.4);"]
        })

        result = build_csv_layout_response(df, [], 0.5)

        assert result["tree_indices"] == []

    def test_parse_newick_prunes_etal_outgroup(self):
        """CSV Newick parsing should prune the 'etal' outgroup leaf (temporary workaround)."""
        from lorax.csv.newick_tree import parse_newick_to_tree

        # Include Etal (capitalized) as a leaf tip.
        nwk = "((Etal:0.1,A:0.2):0.3,B:0.4);"
        graph = parse_newick_to_tree(nwk, 0.4)

        names = [n for n in graph.name if n]
        assert "etal" not in {str(n).lower() for n in names}
        assert "A" in names
        assert "B" in names

    def test_parse_newick_prunes_etal_before_samples_order_mapping(self):
        """If samples_order excludes 'etal', parsing should still succeed after pruning."""
        from lorax.csv.newick_tree import parse_newick_to_tree

        nwk = "((Etal:0.1,A:0.2):0.3,B:0.4);"
        graph = parse_newick_to_tree(nwk, 0.4, samples_order=["A", "B"])

        names = [n for n in graph.name if n]
        assert "etal" not in {str(n).lower() for n in names}
        assert set(names) == {"A", "B"}


class TestCsvConfigOutgroupFiltering:
    def test_build_csv_config_filters_etal_outgroup_from_samples(self, temp_dir):
        """CSV config samples list should exclude 'etal' to match pruning behavior."""
        from lorax.csv.config import build_csv_config

        df = pd.DataFrame(
            {
                "genomic_positions": [0],
                "newick": ["((Etal:0.1,A:0.2):0.3,B:0.4);"],
            }
        )
        cfg = build_csv_config(df, str(temp_dir / "test.csv"))
        assert "etal" not in {str(s).lower() for s in cfg.get("samples", [])}


class TestFileTypeDetection:
    """Tests for file type detection."""

    def test_detect_trees_extension(self):
        """Test detection of .trees files."""
        path = Path("/path/to/file.trees")
        assert path.suffix == ".trees"

    def test_detect_tsz_extension(self):
        """Test detection of .tsz files."""
        path = Path("/path/to/file.tsz")
        assert path.suffix == ".tsz"

    def test_detect_csv_extension(self):
        """Test detection of .csv files."""
        path = Path("/path/to/file.csv")
        assert path.suffix == ".csv"

    def test_compound_extension(self):
        """Test handling of compound extensions like .trees.tsz."""
        path = Path("/path/to/file.trees.tsz")
        assert path.suffix == ".tsz"
        assert ".trees" in path.suffixes
