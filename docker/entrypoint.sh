#!/usr/bin/env bash
set -euo pipefail

export PYTHONUNBUFFERED=1

echo "[entrypoint] starting backend on 127.0.0.1:8080"
python -m uvicorn lorax.lorax_app:sio_app --host 127.0.0.1 --port 8080 &
UVICORN_PID="$!"

terminate() {
  echo "[entrypoint] shutting down..."
  if kill -0 "$UVICORN_PID" >/dev/null 2>&1; then
    kill "$UVICORN_PID" >/dev/null 2>&1 || true
    wait "$UVICORN_PID" >/dev/null 2>&1 || true
  fi
}

trap terminate INT TERM

echo "[entrypoint] starting nginx on :3000"
exec nginx -g "daemon off;"

