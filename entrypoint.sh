#!/bin/bash
set -e

echo " Starting Lorax Full Stack"

# Start Redis
# echo "Starting Redis..."
# redis-server --bind 127.0.0.1 --port 6379 --daemonize yes --loglevel notice

# sleep 2
# if ! redis-cli ping > /dev/null 2>&1; then
#     echo "[ERROR] Redis failed to start"
#     exit 1
# fi
# echo "Redis started successfully"

export LORAX_ENV='prod'
# export REDIS_URL='redis://127.0.0.1:6379/0'
export ALLOWED_ORIGINS='http://localhost:5173,https://lorax.in,https://lorax.ucsc.edu'

# redis-cli CONFIG SET client-output-buffer-limit "pubsub 512mb 256mb 60"

echo "Starting Lorax..."
echo "Lorax will be available at http://localhost:80 or to your forwarded port"
echo "Press Ctrl+C to stop."
echo "--------------------------------"

# Start backend using lorax CLI
# echo "[INFO] Starting Gunicorn (FastAPI backend)..."
lorax serve --gunicorn --workers 1 --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

# Start Nginx (frontend proxy)
# echo "[INFO] Starting Nginx (serving frontend + proxying API)..."
nginx -g "daemon off;" &

# Keep container alive
trap "echo '[INFO] Shutting down...'; kill -TERM $BACKEND_PID; exit 0" SIGTERM SIGINT
wait $BACKEND_PID