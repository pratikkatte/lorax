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

# Production mode (with gunicorn)
lorax serve --gunicorn --workers 4

# With custom gunicorn config
lorax serve --gunicorn --config gunicorn_config.py
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
