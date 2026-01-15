from lorax.utils import LRUCache
from lorax.config.csv_loader import get_config_csv
from lorax.config.tskit_loader import get_config_tskit

# Initialize config cache
_config_cache = LRUCache(max_size=2)

def get_or_load_config(ts, file_path, root_dir):
    config = _config_cache.get(file_path)
    if config is not None:
        print(f"✅ Using cached config: {file_path}")
        return config

    if file_path.endswith('.tsz') or file_path.endswith('.trees'):
        config = get_config_tskit(ts, file_path, root_dir)
    else:
        config = get_config_csv(ts, file_path, root_dir)
    _config_cache.set(file_path, config)
    return config
