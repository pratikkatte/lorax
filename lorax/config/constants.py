"""
Lorax Backend Constants

Centralized configuration values to avoid hardcoding throughout the codebase.
"""

# Session Configuration
SESSION_COOKIE = "lorax_sid"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds

# Cache Configuration
TS_CACHE_SIZE = 1  # Number of tree sequences to keep in memory
CONFIG_CACHE_SIZE = 2  # Number of configs to keep in memory

# File Types
SUPPORTED_EXTENSIONS = {'.tsz', '.trees', '.csv'}

# Directory Names
UPLOADS_DIR = "Uploads"

# Default Values
DEFAULT_WINDOW_SIZE = 50000

# Socket.IO Configuration
SOCKET_PING_TIMEOUT = 60  # seconds
SOCKET_PING_INTERVAL = 25  # seconds
MAX_HTTP_BUFFER_SIZE = 50_000_000  # 50 MB

# Error Codes
ERROR_SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
ERROR_MISSING_SESSION = "MISSING_SESSION"
ERROR_NO_FILE_LOADED = "NO_FILE_LOADED"
