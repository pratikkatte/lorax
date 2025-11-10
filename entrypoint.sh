#!/bin/bash
set -e

echo " Starting Lorax Full Stack"

# Start Redis
echo "Starting Redis..."
redis-server --bind 127.0.0.1 --port 6379 --daemonize yes --loglevel notice

sleep 2
if ! redis-cli ping > /dev/null 2>&1; then
    echo "[ERROR] Redis failed to start"
    exit 1
fi
echo "Redis started successfully"

export LORAX_ENV='prod'
export REDIS_URL='redis://127.0.0.1:6379/0'


redis-cli CONFIG SET client-output-buffer-limit "pubsub 512mb 256mb 60"


# Start backend (Gunicorn)
echo "[INFO] Starting Gunicorn (FastAPI backend)..."
gunicorn -c /app/gunicorn_config.py lorax.lorax_app:sio_app &
BACKEND_PID=$!

# Start Nginx (frontend proxy)
echo "[INFO] Starting Nginx (serving frontend + proxying API)..."
nginx -g "daemon off;" &

# Keep container alive
trap "echo '[INFO] Shutting down...'; kill -TERM $BACKEND_PID; exit 0" SIGTERM SIGINT
wait $BACKEND_PID