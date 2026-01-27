import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Import mode configuration first (before other lorax imports that depend on it)
from lorax.modes import (
    CURRENT_MODE,
    CURRENT_CONFIG,
    get_cache_dir,
    validate_mode_requirements,
)
from lorax.session_manager import SessionManager
from lorax.cache import DiskCacheManager, TreeGraphCache, CsvTreeGraphCache
from lorax.constants import (
    DISK_CACHE_ENABLED,
    DISK_CACHE_DIR,
    DISK_CACHE_MAX_BYTES,
)

# Validate mode requirements
validation_errors = validate_mode_requirements(CURRENT_CONFIG)
if validation_errors:
    for error in validation_errors:
        print(f"Warning: {error}")

# Shared Global State
# We initialize these singletons here to ensure all modules share the same instances
# This is critical for in-memory mode so routes and sockets share the same stores

REDIS_URL = os.getenv("REDIS_URL", None)
session_manager = SessionManager(REDIS_URL)

# Common Environment Variables
IS_VM = os.getenv("IS_VM", "").lower() in ("true", "1", "yes")
BUCKET_NAME = os.getenv("BUCKET_NAME") or os.getenv("GCS_BUCKET_NAME") or 'lorax_projects'

# Initialize Disk Cache Manager
# Uses Redis for distributed locking if available, falls back to file locks
_redis_client = None
if REDIS_URL and DISK_CACHE_ENABLED:
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
        print(f"DiskCacheManager using Redis for distributed locking")
    except Exception as e:
        print(f"Warning: Failed to connect Redis for disk cache: {e}")

disk_cache_manager = DiskCacheManager(
    cache_dir=Path(DISK_CACHE_DIR),
    max_size_bytes=DISK_CACHE_MAX_BYTES,
    redis_client=_redis_client,
    enabled=DISK_CACHE_ENABLED,
)

# Initialize TreeGraph Cache for per-session tree caching
# Uses Redis in production for distributed caching, in-memory for local mode
_tree_graph_redis = None
if REDIS_URL:
    try:
        import redis.asyncio as aioredis
        # Create a separate connection for binary data (decode_responses=False)
        _tree_graph_redis = aioredis.from_url(REDIS_URL, decode_responses=False)
        print(f"TreeGraphCache using Redis at {REDIS_URL}")
    except Exception as e:
        print(f"Warning: Failed to connect Redis for TreeGraphCache: {e}")

tree_graph_cache = TreeGraphCache(redis_client=_tree_graph_redis)

# CSV mode: cache parsed Newick trees per session (in-memory only)
csv_tree_graph_cache = CsvTreeGraphCache()

print(f"Context initialized: mode={CURRENT_MODE}, disk_cache={DISK_CACHE_ENABLED}")
