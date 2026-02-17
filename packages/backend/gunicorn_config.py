"""
Gunicorn configuration for FastAPI application on Google Cloud Run.
Optimized for high concurrency with proper worker management.

For 100s of users on 1 instance:
- Use 'uvicorn' worker class (async capable)
- Calculate workers based on available CPU cores
- Cloud Run: typically 2-4 CPU cores recommended
"""

import multiprocessing
import os

# Get CPU count for worker calculation
cpu_cores = multiprocessing.cpu_count()

# Bind to 0.0.0.0:8080 (Cloud Run requirement)
bind = "0.0.0.0:8080"

# Worker configuration
default_workers = min(1, max(2, cpu_cores))
try:
    workers = int(os.getenv("WEB_CONCURRENCY", str(default_workers)))
except ValueError:
    workers = default_workers
workers = max(1, workers)
workers = 1 
# Use uvicorn worker class for async FastAPI
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout = 0
graceful_timeout = 0
keepalive = 0

# Connection settings
backlog = 2048  # Maximum number of pending connections
max_requests = 1000  # Restart workers periodically for memory management
max_requests_jitter = 100  # Stagger restarts to avoid thundering herd

# Performance tuning
worker_connections = 1000  # Max connections per worker
limit_request_fields = 100
limit_request_field_size = 8190

# Process naming and logging
proc_name = "lorax-fastapi"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'
errorlog = "-"
accesslog = "-"
loglevel = "error"

# Reload on file changes (disable in production)
reload = False

# Pre-load application
preload_app = False

# Server mechanics
daemon = False
pidfile = None
tmp_upload_dir = None
