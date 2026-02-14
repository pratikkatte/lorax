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
from lorax.redis_utils import create_redis_client, get_redis_config
from lorax.cache import DiskCacheManager, TreeGraphCache, CsvTreeGraphCache
from lorax.constants import (
    DISK_CACHE_ENABLED,
    DISK_CACHE_DIR,
    DISK_CACHE_MAX_BYTES,
    INMEM_TTL_SECONDS,
    CACHE_CLEANUP_INTERVAL_SECONDS,
)

# Validate mode requirements
validation_errors = validate_mode_requirements(CURRENT_CONFIG)
if validation_errors:
    for error in validation_errors:
        print(f"Warning: {error}")

# Shared Global State
# We initialize these singletons here to ensure all modules share the same instances
# This is critical for in-memory mode so routes and sockets share the same stores

REDIS_CLUSTER_URL, REDIS_CLUSTER = get_redis_config()
session_manager = SessionManager(
    redis_url=REDIS_CLUSTER_URL,
    redis_cluster=REDIS_CLUSTER,
    memory_ttl_seconds=INMEM_TTL_SECONDS,
    cleanup_interval_seconds=CACHE_CLEANUP_INTERVAL_SECONDS,
)

# Common Environment Variables
_bucket_name = (os.getenv("BUCKET_NAME") or "").strip()
if not _bucket_name:
    _bucket_name = (os.getenv("GCS_BUCKET_NAME") or "").strip()
BUCKET_NAME = _bucket_name or None

# Initialize Disk Cache Manager
# Uses Redis for distributed locking if available, falls back to file locks
_redis_client = None
if REDIS_CLUSTER_URL and DISK_CACHE_ENABLED:
    try:
        _redis_client = create_redis_client(
            REDIS_CLUSTER_URL,
            decode_responses=True,
            cluster=REDIS_CLUSTER,
        )
        print("DiskCacheManager using Redis for distributed locking")
    except Exception as e:
        print(f"Warning: Failed to connect Redis for disk cache: {e}")

disk_cache_manager = DiskCacheManager(
    cache_dir=Path(DISK_CACHE_DIR),
    max_size_bytes=DISK_CACHE_MAX_BYTES,
    redis_client=_redis_client,
    enabled=DISK_CACHE_ENABLED,
)

# Initialize TreeGraph Cache for per-session tree caching (in-memory only).
tree_graph_cache = TreeGraphCache(
    local_ttl_seconds=INMEM_TTL_SECONDS,
    cleanup_interval_seconds=CACHE_CLEANUP_INTERVAL_SECONDS,
)

# CSV mode: cache parsed Newick trees per session (in-memory only)
csv_tree_graph_cache = CsvTreeGraphCache(
    local_ttl_seconds=INMEM_TTL_SECONDS,
    cleanup_interval_seconds=CACHE_CLEANUP_INTERVAL_SECONDS,
)

print(f"Context initialized: mode={CURRENT_MODE}, disk_cache={DISK_CACHE_ENABLED}")
