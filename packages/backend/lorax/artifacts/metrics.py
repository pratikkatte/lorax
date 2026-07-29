"""Small dependency-free metrics registry for CSR artifact rollout diagnostics."""

from __future__ import annotations

import os
import threading
import time
from collections import Counter, defaultdict, deque
from contextlib import contextmanager
from typing import Iterator

import psutil


class CSRArtifactMetrics:
    """Thread-safe counters and bounded latency samples."""

    def __init__(self, *, max_samples: int = 2_048):
        self._lock = threading.RLock()
        self._counters: Counter[str] = Counter()
        self._latencies: dict[str, deque[float]] = defaultdict(
            lambda: deque(maxlen=max_samples)
        )
        self._gauges: dict[str, float] = {}

    def increment(self, name: str, amount: int = 1) -> None:
        with self._lock:
            self._counters[str(name)] += int(amount)

    def observe_ms(self, name: str, duration_ms: float) -> None:
        with self._lock:
            self._latencies[str(name)].append(float(duration_ms))

    def set_gauge(self, name: str, value: float) -> None:
        with self._lock:
            self._gauges[str(name)] = float(value)

    @contextmanager
    def timer(self, name: str) -> Iterator[None]:
        started = time.perf_counter()
        try:
            yield
        finally:
            self.observe_ms(name, (time.perf_counter() - started) * 1_000.0)

    @staticmethod
    def _percentile(values: list[float], percentile: float) -> float | None:
        if not values:
            return None
        ordered = sorted(values)
        offset = int(round((len(ordered) - 1) * percentile))
        return round(float(ordered[offset]), 3)

    def snapshot(self) -> dict:
        with self._lock:
            latencies = {
                name: {
                    "count": len(samples),
                    "p50_ms": self._percentile(list(samples), 0.50),
                    "p95_ms": self._percentile(list(samples), 0.95),
                }
                for name, samples in self._latencies.items()
            }
            counters = dict(self._counters)
            gauges = dict(self._gauges)
        gauges["process_rss_bytes"] = float(
            psutil.Process(os.getpid()).memory_info().rss
        )
        return {
            "counters": counters,
            "latencies": latencies,
            "gauges": gauges,
        }

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()
            self._latencies.clear()
            self._gauges.clear()


csr_artifact_metrics = CSRArtifactMetrics()


__all__ = ["CSRArtifactMetrics", "csr_artifact_metrics"]
