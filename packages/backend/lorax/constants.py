"""
Lorax Backend Constants

Centralized configuration values to avoid hardcoding throughout the codebase.
Mode-aware configuration based on deployment environment.
"""

import os
from pathlib import Path

# Import mode configuration
from lorax.modes import (
    get_mode_config,
    get_uploads_dir,
    get_cache_dir,
    CURRENT_MODE,
    CURRENT_CONFIG,
)

# Session Configuration
SESSION_COOKIE = "lorax_sid"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds

# Cache Configuration (mode-aware)
TS_CACHE_SIZE = CURRENT_CONFIG.ts_cache_size
CONFIG_CACHE_SIZE = CURRENT_CONFIG.config_cache_size
METADATA_CACHE_SIZE = CURRENT_CONFIG.metadata_cache_size

# Disk Cache Configuration (mode-aware)
DISK_CACHE_ENABLED = CURRENT_CONFIG.disk_cache_enabled
DISK_CACHE_DIR = get_cache_dir(CURRENT_CONFIG)
DISK_CACHE_MAX_BYTES = CURRENT_CONFIG.disk_cache_max_gb * 1024 * 1024 * 1024

# Connection Limits (mode-aware)
MAX_SOCKETS_PER_SESSION = CURRENT_CONFIG.max_sockets_per_session
ENFORCE_CONNECTION_LIMITS = CURRENT_CONFIG.enforce_connection_limits

# File Types
SUPPORTED_EXTENSIONS = {'.tsz', '.trees', '.csv'}

# Directory Names (mode-aware)
UPLOADS_DIR = str(get_uploads_dir(CURRENT_CONFIG))

# Default Values
DEFAULT_WINDOW_SIZE = 50000

# Socket.IO Configuration
SOCKET_PING_TIMEOUT = 60  # seconds
SOCKET_PING_INTERVAL = 25  # seconds
MAX_HTTP_BUFFER_SIZE = 50_000_000  # 50 MB
SOCKET_DIAGNOSTIC_PING_ENABLED = (
    os.getenv("LORAX_DIAGNOSTIC_PING_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
)

# Error Codes
ERROR_SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
ERROR_MISSING_SESSION = "MISSING_SESSION"
ERROR_NO_FILE_LOADED = "NO_FILE_LOADED"
ERROR_TOO_MANY_CONNECTIONS = "TOO_MANY_CONNECTIONS"
ERROR_CONNECTION_REPLACED = "CONNECTION_REPLACED"


def print_config():
    """Print current configuration for debugging."""
    print(f"Mode: {CURRENT_MODE}")
    print(f"TS Cache Size: {TS_CACHE_SIZE}")
    print(f"Disk Cache: {DISK_CACHE_ENABLED} ({CURRENT_CONFIG.disk_cache_max_gb}GB)")
    print(f"Max Sockets/Session: {MAX_SOCKETS_PER_SESSION}")
    print(f"Uploads Dir: {UPLOADS_DIR}")
