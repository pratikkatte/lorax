#!/usr/bin/env bash
set -euo pipefail

export PYTHONUNBUFFERED=1

GUNICORN_CONFIG="${GUNICORN_CONFIG:-/app/backend/gunicorn_config.py}"

echo "[entrypoint] starting backend with gunicorn on 127.0.0.1:8080"
python -m gunicorn -c "${GUNICORN_CONFIG}" --bind 127.0.0.1:8080 lorax.lorax_app:sio_app &
BACKEND_PID="$!"

terminate() {
  echo "[entrypoint] shutting down..."
  if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    wait "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap terminate INT TERM

echo "[entrypoint] starting nginx on :3000"
exec nginx -g "daemon off;"
