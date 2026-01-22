# Lorax Backend Architecture

This document describes the backend architecture for cloud deployment, caching, session management, and multi-user support.

## Deployment Modes

Lorax supports three deployment modes, configured via `LORAX_MODE` environment variable:

| Mode | Use Case | Session Storage | File Source | Workers |
|------|----------|-----------------|-------------|---------|
| `local` | Conda package / desktop | In-memory | Local filesystem | 1 |
| `development` | Developer testing | In-memory | Local + optional GCS | 1 |
| `production` | Cloud deployment | Redis | GCS + disk cache | 4+ |

### Auto-Detection

Mode is auto-detected based on environment:
```python
if REDIS_URL and GCS_BUCKET_NAME:
    mode = "production"
elif GCS_BUCKET_NAME:
    mode = "development"
else:
    mode = "local"  # Default for conda package
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                    (React + Socket.IO)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gunicorn (Production)                         │
│              Multiple Workers + Redis Pub/Sub                    │
└─────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Worker 1   │ │   Worker 2   │ │   Worker 3   │ │   Worker 4   │
│  ┌────────┐  │ │  ┌────────┐  │ │  ┌────────┐  │ │  ┌────────┐  │
│  │TS Cache│  │ │  │TS Cache│  │ │  │TS Cache│  │ │  │TS Cache│  │
│  │(2 slots)│ │ │  │(2 slots)│ │ │  │(2 slots)│ │ │  │(2 slots)│ │
│  └────────┘  │ │  └────────┘  │ │  └────────┘  │ │  └────────┘  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
          │              │              │              │
          └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Shared Resources                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Redis    │  │ Disk Cache  │  │   Google Cloud Storage  │  │
│  │  Sessions   │  │   (50GB)    │  │      (Source files)     │  │
│  │  + Locks    │  │   LRU       │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Disk Cache Manager (`lorax/disk_cache.py`)

LRU disk cache for GCS file downloads with distributed locking.

**Features:**
- 50GB (configurable) LRU eviction based on last access time
- Atomic downloads (temp file + rename)
- Distributed locking via Redis (or file-based fallback)
- Manifest-based tracking (`manifest.json`)

**Structure:**
```
DISK_CACHE_DIR/
├── manifest.json      # Tracks files, sizes, access times
├── locks/             # File-based locks (non-Redis mode)
└── files/
    ├── {hash}.trees   # Cached GCS files
    └── {hash}.tsz
```

**Usage:**
```python
from lorax.context import disk_cache_manager

# Get file from cache or download
path = await disk_cache_manager.get_or_download(
    bucket_name="lorax_projects",
    gcs_path="1000Genomes/1kg_chr20.trees.tsz",
    download_func=async_download_function
)
```

### 2. Mode Configuration (`lorax/modes.py`)

Centralized configuration based on deployment mode.

**Configuration by Mode:**

| Setting | Local | Development | Production |
|---------|-------|-------------|------------|
| `ts_cache_size` | 5 | 5 | 2 |
| `disk_cache_enabled` | False | True | True |
| `disk_cache_max_gb` | 10 | 10 | 50 |
| `max_sockets_per_session` | 100 | 100 | 5 |
| `enforce_connection_limits` | False | False | True |
| `require_redis` | False | False | True |
| `require_gcs` | False | False | True |

### 3. Session Manager (`lorax/session_manager.py`)

Per-user session with socket connection tracking.

**Session Fields:**
```python
class Session:
    sid: str                          # Session ID
    file_path: str                    # Currently loaded file
    created_at: str                   # ISO timestamp
    last_activity: str                # Last activity timestamp
    socket_connections: Dict[str, str]  # {socket_sid: connected_at}
```

**Connection Replacement:**
When a session reaches the connection limit (5 in production), the oldest connection is replaced:
1. New socket connects
2. Session checks connection count
3. If at limit, finds oldest by `connected_at` timestamp
4. Emits `connection-replaced` to oldest socket
5. Disconnects oldest, accepts new

This ensures the user's current tab always works (better UX than rejecting).

### 4. Memory Cache with Validation (`lorax/handlers.py`)

Tree sequence cache with mtime validation to detect file changes.

```python
# LRUCacheWithMeta stores (value, metadata) tuples
_ts_cache = LRUCacheWithMeta(max_size=TS_CACHE_SIZE)

async def get_or_load_ts(file_path):
    current_mtime = Path(file_path).stat().st_mtime

    ts, cached_mtime = _ts_cache.get_with_meta(file_path)
    if ts and cached_mtime == current_mtime:
        return ts  # Cache hit, file unchanged

    # Reload if file changed or not cached
    ts = await load_tree_sequence(file_path)
    _ts_cache.set(file_path, ts, meta=current_mtime)
    return ts
```

## Data Flow

### File Loading Flow

```
1. Frontend: Socket.IO "load_file" event
   └─> sockets.py: background_load_file()

2. Check disk cache
   └─> disk_cache_manager.get_or_download()
       ├─> Cache hit: Return local path
       └─> Cache miss:
           ├─> Acquire distributed lock (Redis/file)
           ├─> Double-check cache
           ├─> Evict old files if needed
           ├─> Download from GCS to temp file
           ├─> Atomic rename
           ├─> Update manifest
           └─> Release lock

3. Load tree sequence
   └─> handlers.py: get_or_load_ts()
       ├─> Check memory cache + mtime
       └─> Load with tskit/tszip

4. Generate config
   └─> config/loader.py: get_or_load_config()

5. Emit "load-file-result" to frontend
```

### Socket Connection Flow

```
1. Frontend connects with lorax_sid cookie

2. sockets.py: connect()
   ├─> Validate session exists
   ├─> session.add_socket(socket_sid)
   │   ├─> Under limit: Add socket
   │   └─> At limit: Replace oldest
   │       ├─> Emit "connection-replaced" to old socket
   │       └─> Disconnect old socket
   └─> Emit "session-restored" or "status"

3. On disconnect
   └─> session.remove_socket(socket_sid)
```

## Environment Variables

### Required (Production)
```bash
REDIS_URL=redis://localhost:6379
GCS_BUCKET_NAME=your-bucket
IS_VM=true
```

### Optional
```bash
LORAX_MODE=production|development|local  # Auto-detected if not set

# Cache sizes
TS_CACHE_SIZE=2              # Tree sequences per worker (default: 2 prod, 5 local)
CONFIG_CACHE_SIZE=2          # Config objects per worker
METADATA_CACHE_SIZE=5        # Metadata entries per worker

# Disk cache
DISK_CACHE_DIR=/var/lorax/cache
DISK_CACHE_MAX_GB=50

# Connection limits
MAX_SOCKETS_PER_SESSION=5    # Enforced in production only

# Server
ALLOWED_ORIGINS=https://your-domain.com
```

## CLI Commands

```bash
# Start server
lorax serve                        # Local mode
lorax serve --reload               # Development with hot reload
lorax serve --gunicorn --workers 4 # Production

# Configuration
lorax config show                  # Display current config
lorax config init                  # Create ~/.lorax/config.yaml
lorax config path                  # Show config file path

# Cache management
lorax cache-status                 # Show disk cache stats
lorax cache-clear                  # Clear disk cache
```

## File Structure

```
lorax/
├── lorax_app.py           # FastAPI + Socket.IO setup
├── routes.py              # HTTP endpoints
├── sockets.py             # Socket.IO event handlers
├── handlers.py            # Tree loading, caching, queries
├── session_manager.py     # Session state + socket tracking
├── disk_cache.py          # LRU disk cache manager
├── context.py             # Global singletons initialization
├── cli.py                 # Command-line interface
├── modes.py               # Deployment mode detection and defaults
├── constants.py           # Mode-aware app configuration
├── utils.py               # LRUCache, LRUCacheWithMeta
├── loaders/               # Tree data loading
│   ├── loader.py          # Config caching
│   ├── tskit_loader.py    # Tskit/tszip format handling
│   └── csv_loader.py      # CSV format handling
├── cloud/
│   └── gcs_utils.py       # GCS download with disk cache
├── metadata/
│   └── loader.py          # Metadata caching
└── ...
```

## Performance Considerations

### Memory Management
- **Production**: 2 TS slots per worker × 4 workers = 8 cached tree sequences max
- **Local**: 5 TS slots for single user with more RAM available
- Mtime validation prevents serving stale data without memory overhead

### Disk Cache
- 50GB limit with LRU eviction
- Prevents repeated GCS downloads for popular files
- Shared across all workers via filesystem

### Connection Limits
- 5 sockets per session in production (prevents tab spam)
- Oldest replaced (not rejected) for better UX
- Unlimited in local/development mode

### Multi-Worker Coordination
- Redis for distributed session storage
- Redis locks for GCS download coordination
- File-based locks as fallback for single-process mode
