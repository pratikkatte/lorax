# Lorax Backend

The Lorax backend server for tree visualization and analysis.

## Installation

```bash
cd packages/backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the backend package
pip install -e .

# For production with gunicorn support:
pip install -e ".[prod]"
```

## Usage

### Start the Backend Server

```bash
# Development mode (with auto-reload)
lorax serve --reload

# Or specify host/port
lorax serve --host 0.0.0.0 --port 8080 --reload

LORAX_MODE=local lorax serve --reload

# Production mode (gunicorn + uvicorn worker class)
python -m gunicorn -c packages/backend/gunicorn_config.py lorax.lorax_app:sio_app

# Override worker count at runtime (default: min(4, max(2, cpu_cores)))
WEB_CONCURRENCY=3 python -m gunicorn -c packages/backend/gunicorn_config.py lorax.lorax_app:sio_app
```

### Load-File Backpressure

`load_file` uses a bounded queue and worker slots to prevent CPU-heavy loads from
starving socket responsiveness.

```bash
# Defaults shown
LORAX_LOAD_FILE_MAX_CONCURRENCY=1
LORAX_LOAD_FILE_MAX_QUEUE=8
LORAX_LOAD_FILE_QUEUE_TIMEOUT_SEC=30
```

### Session And Tree Cache TTLs

The backend uses in-memory session and tree-graph caches. Defaults are 1 hour
idle TTL with periodic opportunistic cleanup.

```bash
# Defaults shown
LORAX_COOKIE_MAX_AGE_SEC=3600
LORAX_INMEM_TTL_SEC=3600
LORAX_CACHE_CLEANUP_INTERVAL_SEC=60
```

### Available Commands

```bash
# Show help
lorax --help

# Show serve command help
lorax serve --help

# Show version
lorax --version
```

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest
```

## Project Structure

```
packages/backend/
├── pyproject.toml          # Package configuration
├── gunicorn_config.py      # Gunicorn configuration
├── README.md               # This file
├── requirements.txt        # Full dependency list
└── lorax/                  # Main package
    ├── __init__.py
    ├── cli.py              # CLI commands
    ├── lorax_app.py        # FastAPI + Socket.IO app
    ├── routes.py           # HTTP routes
    ├── sockets.py          # Socket.IO events
    ├── handlers.py         # Request handlers
    ├── session_manager.py  # Session management
    ├── manager.py          # Resource management
    ├── context.py          # App context
    ├── utils.py            # Utilities
    ├── config/             # Configuration
    ├── cloud/              # Cloud utilities
    ├── metadata/           # Metadata handling
    ├── tree_graph/         # Tree graph utilities
    └── viz/                # Visualization
```
