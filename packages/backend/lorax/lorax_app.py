"""
Socket.IO version of the Lorax backend (single-process, no Gunicorn).

Run with:
    uvicorn lorax_socketio_app:sio_app --host 0.0.0.0 --port 8080 --reload
"""
import os
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv

from lorax.context import REDIS_CLUSTER_URL, REDIS_CLUSTER
from lorax.constants import (
    SOCKET_PING_TIMEOUT, SOCKET_PING_INTERVAL, MAX_HTTP_BUFFER_SIZE
)
from lorax.routes import router
from lorax.sockets import register_socket_events

load_dotenv()

# Setup

app = FastAPI(title="Lorax Backend", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)


ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3001,http://localhost:3000").split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_client_manager = None
if REDIS_CLUSTER_URL and not REDIS_CLUSTER:
    _client_manager = socketio.AsyncRedisManager(REDIS_CLUSTER_URL)
elif REDIS_CLUSTER_URL and REDIS_CLUSTER:
    print("Warning: Socket.IO Redis manager does not support Redis Cluster; running without shared manager.")

if _client_manager:
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
        client_manager=_client_manager,
        logger=False,
        engineio_logger=False,
        ping_timeout=SOCKET_PING_TIMEOUT,
        ping_interval=SOCKET_PING_INTERVAL,
        max_http_buffer_size=MAX_HTTP_BUFFER_SIZE
    )
else:
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
        logger=False,
        engineio_logger=False,
        ping_timeout=SOCKET_PING_TIMEOUT,
        ping_interval=SOCKET_PING_INTERVAL,
        max_http_buffer_size=MAX_HTTP_BUFFER_SIZE
    )

sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Include Routes
app.include_router(router)

# Register Socket Events
register_socket_events(sio)
