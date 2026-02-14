"""
Load-file scheduling and backpressure for Socket.IO handlers.

This module provides a bounded queue plus concurrency limiter for file loads so
CPU-heavy requests cannot starve the service under concurrent usage.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Awaitable, Callable, Dict, Tuple


def _env_int(name: str, default: int, minimum: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    return max(minimum, value)


def _env_float(name: str, default: float, minimum: float) -> float:
    raw = os.getenv(name, str(default))
    try:
        value = float(raw)
    except (TypeError, ValueError):
        value = default
    return max(minimum, value)


DEV_MODE = os.getenv("LORAX_MODE", "").strip().lower() == "development"


def dev_print(*args, **kwargs) -> None:
    """Print only when running in development mode."""
    if DEV_MODE:
        print(*args, **kwargs)


class LoadQueueFullError(Exception):
    """Raised when the bounded load queue is full."""


class LoadQueueTimeoutError(Exception):
    """Raised when a queued load waits too long for a worker slot."""


class LoadScheduler:
    """
    Enforces bounded queueing and concurrency limits for load_file requests.

    in_system counts all active + queued jobs. Worker slots limit concurrent
    execution once a job reaches the front of the queue.
    """

    def __init__(
        self,
        *,
        max_concurrency: int | None = None,
        max_queue: int | None = None,
        queue_timeout_sec: float | None = None,
    ):
        self.max_concurrency = max_concurrency if max_concurrency is not None else _env_int(
            "LORAX_LOAD_FILE_MAX_CONCURRENCY", 1, 1
        )
        self.max_queue = max_queue if max_queue is not None else _env_int(
            "LORAX_LOAD_FILE_MAX_QUEUE", 8, 0
        )
        self.queue_timeout_sec = (
            queue_timeout_sec
            if queue_timeout_sec is not None
            else _env_float("LORAX_LOAD_FILE_QUEUE_TIMEOUT_SEC", 30.0, 0.1)
        )
        self.max_in_system = self.max_concurrency + self.max_queue

        self._worker_slots = asyncio.Semaphore(self.max_concurrency)
        self._state_lock = asyncio.Lock()
        self._counter_lock = asyncio.Lock()
        self._in_system = 0
        self._counters = {
            "load_file_started": 0,
            "load_file_success": 0,
            "load_file_failed": 0,
            "load_file_busy": 0,
            "load_file_timeout": 0,
        }

    async def get_counters(self) -> Dict[str, int]:
        async with self._counter_lock:
            return dict(self._counters)

    async def get_state(self) -> Dict[str, int | float]:
        async with self._state_lock:
            in_system = self._in_system
        return {
            "max_concurrency": self.max_concurrency,
            "max_queue": self.max_queue,
            "queue_timeout_sec": self.queue_timeout_sec,
            "in_system": in_system,
        }

    async def run(
        self,
        job: Callable[[], Awaitable[dict]],
        *,
        request_id: str | int | None = None,
        socket_sid: str | None = None,
        lorax_sid: str | None = None,
    ) -> Tuple[dict, int, int]:
        """
        Execute a load job with bounded queue and limited concurrency.

        Returns:
            (payload, queue_wait_ms, duration_ms)
        """
        reserved = await self._try_reserve_slot()
        if not reserved:
            await self._increment("load_file_busy")
            await self._log(
                "load_file_rejected",
                request_id=request_id,
                socket_sid=socket_sid,
                lorax_sid=lorax_sid,
                reason="queue_full",
            )
            raise LoadQueueFullError("Load queue is full")

        acquired_worker = False
        queue_wait_start = time.perf_counter()
        try:
            try:
                await asyncio.wait_for(
                    self._worker_slots.acquire(), timeout=self.queue_timeout_sec
                )
            except asyncio.TimeoutError as exc:
                await self._increment("load_file_busy", "load_file_timeout")
                await self._log(
                    "load_file_queue_timeout",
                    request_id=request_id,
                    socket_sid=socket_sid,
                    lorax_sid=lorax_sid,
                    wait_timeout_sec=self.queue_timeout_sec,
                )
                raise LoadQueueTimeoutError(
                    f"Timed out waiting for load worker after {self.queue_timeout_sec:.1f}s"
                ) from exc

            acquired_worker = True
            queue_wait_ms = int((time.perf_counter() - queue_wait_start) * 1000)
            await self._increment("load_file_started")
            await self._log(
                "load_file_started",
                request_id=request_id,
                socket_sid=socket_sid,
                lorax_sid=lorax_sid,
                queue_wait_ms=queue_wait_ms,
            )

            run_start = time.perf_counter()
            try:
                payload = await job()
            except Exception as exc:
                duration_ms = int((time.perf_counter() - run_start) * 1000)
                await self._increment("load_file_failed")
                await self._log(
                    "load_file_failed",
                    request_id=request_id,
                    socket_sid=socket_sid,
                    lorax_sid=lorax_sid,
                    queue_wait_ms=queue_wait_ms,
                    duration_ms=duration_ms,
                    error=str(exc),
                )
                raise

            duration_ms = int((time.perf_counter() - run_start) * 1000)
            if payload.get("ok"):
                await self._increment("load_file_success")
                outcome = "success"
            else:
                await self._increment("load_file_failed")
                outcome = "failed"

            await self._log(
                "load_file_completed",
                request_id=request_id,
                socket_sid=socket_sid,
                lorax_sid=lorax_sid,
                queue_wait_ms=queue_wait_ms,
                duration_ms=duration_ms,
                outcome=outcome,
                code=payload.get("code"),
            )
            return payload, queue_wait_ms, duration_ms
        finally:
            if acquired_worker:
                self._worker_slots.release()
            await self._release_slot()

    async def _try_reserve_slot(self) -> bool:
        async with self._state_lock:
            if self._in_system >= self.max_in_system:
                return False
            self._in_system += 1
            return True

    async def _release_slot(self) -> None:
        async with self._state_lock:
            if self._in_system > 0:
                self._in_system -= 1

    async def _increment(self, *names: str) -> None:
        async with self._counter_lock:
            for name in names:
                self._counters[name] = self._counters.get(name, 0) + 1

    async def _log(self, event: str, **fields) -> None:
        state = await self.get_state()
        counters = await self.get_counters()
        record = {
            "event": event,
            "component": "load_file",
            "ts_unix": round(time.time(), 3),
            **state,
            **fields,
            "counters": counters,
        }
        dev_print(f"[load_file] {json.dumps(record, sort_keys=True)}")


load_scheduler = LoadScheduler()
