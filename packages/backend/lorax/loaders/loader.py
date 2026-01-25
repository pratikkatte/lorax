"""
Config computation for loaded files.

Provides compute_config() which creates configuration from a tree sequence.
The config is cached within FileContext (see cache/file_cache.py), not here.
"""

from lorax.loaders.csv_loader import get_config_csv
from lorax.loaders.tskit_loader import get_config_tskit


def compute_config(ts, file_path, root_dir):
    """
    Compute config for a tree sequence.

    This function is called by file_cache.py when loading a new FileContext.
    The config is cached within the FileContext, so this function does
    not maintain its own cache.

    Args:
        ts: tskit.TreeSequence or pandas.DataFrame (for CSV)
        file_path: Path to the source file
        root_dir: Root directory for relative paths

    Returns:
        dict: Configuration including intervals, sample counts, etc.
    """
    if file_path.endswith('.tsz') or file_path.endswith('.trees'):
        return get_config_tskit(ts, file_path, root_dir)
    else:
        return get_config_csv(ts, file_path, root_dir)
