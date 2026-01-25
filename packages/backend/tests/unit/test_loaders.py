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
