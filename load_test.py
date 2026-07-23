"""Asynchronous load testing tool for Lorax."""

import argparse
import asyncio
import math
import random
import statistics
import time
from typing import Dict, List, Optional

import httpx
import socketio

RequestResult = Dict[str, object]


async def timed_request(client: httpx.AsyncClient, method: str, path: str) -> RequestResult:
    start = time.perf_counter()
    try:
        response = await client.request(method, path)
        duration = time.perf_counter() - start
        success = response.status_code < 400
        error = None if success else f"HTTP {response.status_code}: {response.text}".strip()
    except Exception as exc:  # noqa: BLE001 - capturing all network errors
        duration = time.perf_counter() - start
        success = False
        error = str(exc)
    return {
        "path": path,
        "method": method,
        "duration": duration,
        "success": success,
        "error": error,
    }


async def emit_with_response(
    sio: socketio.AsyncClient,
    emit_event: str,
    response_event: str,
    payload: dict,
    timeout: float,
    label: str,
) -> RequestResult:
    start = time.perf_counter()
    result: RequestResult = {
        "path": label,
        "method": emit_event,
        "duration": 0.0,
        "success": False,
        "error": None,
    }

    response_future: asyncio.Future = asyncio.get_running_loop().create_future()

    async def _handler(message):
        if not response_future.done():
            response_future.set_result(message)

    sio.on(response_event, _handler)

    def remove_handler() -> None:
        """Best-effort removal of the temporary event handler.

        socketio.AsyncClient does not expose an official off() helper in some
        versions, so we manually clean up from the internal handler registry to
        avoid listener leaks during long runs.
        """

        namespace_handlers = getattr(sio, "handlers", {})
        handlers = namespace_handlers.get("/", {})
        callbacks = handlers.get(response_event)
        if callbacks and _handler in callbacks:
            callbacks.remove(_handler)
            if not callbacks:
                handlers.pop(response_event, None)
        if handlers:
            namespace_handlers["/"] = handlers

    try:
        await sio.emit(emit_event, payload)
        await asyncio.wait_for(response_future, timeout=timeout)
        result["success"] = True
    except Exception as exc:  # noqa: BLE001 - network / timeout errors
        result["error"] = str(exc)
    finally:
        remove_handler()
        result["duration"] = time.perf_counter() - start
    return result


async def websocket_sequence(
    base_url: str,
    cookie_header: str,
    lorax_sid: str,
    timeout: float,
    project: str,
    filename: str,
    queries: int,
    socket_path: str,
) -> List[RequestResult]:
    results: List[RequestResult] = []
    sio = socketio.AsyncClient(logger=False, engineio_logger=False)

    connect_start = time.perf_counter()
    try:
        await sio.connect(
            base_url,
            transports=["websocket"],
            headers={"Cookie": cookie_header},
            socketio_path=socket_path,
            wait_timeout=timeout,
        )
        results.append(
            {
                "path": "websocket_connect",
                "method": "CONNECT",
                "duration": time.perf_counter() - connect_start,
                "success": True,
                "error": None,
            }
        )
    except Exception as exc:  # noqa: BLE001 - capture connection errors
        results.append(
            {
                "path": "websocket_connect",
                "method": "CONNECT",
                "duration": time.perf_counter() - connect_start,
                "success": False,
                "error": str(exc),
            }
        )
        await sio.disconnect()
        return results

    try:
        results.append(
            await emit_with_response(
                sio,
                "load_file",
                "load-file-result",
                {"project": project, "file": filename, "lorax_sid": lorax_sid},
                timeout,
                "socketio_load_file",
            )
        )

        for idx in range(queries):
            payload = {"lorax_sid": lorax_sid, "localTrees": [{"global_index": idx}]}
            results.append(
                await emit_with_response(
                    sio,
                    "query",
                    "query-result",
                    payload,
                    timeout,
                    "socketio_query",
                )
            )
    finally:
        await sio.disconnect()

    return results


async def simulate_user(
    user_id: int,
    request_count: int,
    base_url: str,
    timeout: float,
    socket_queries: int,
    project: str,
    filename: str,
    socket_path: str,
) -> List[RequestResult]:
    cookies = httpx.Cookies()
    results: List[RequestResult] = []

    async with httpx.AsyncClient(base_url=base_url, cookies=cookies, timeout=timeout) as client:
        init_result = await timed_request(client, "POST", "/init-session")
        results.append(init_result)

        lorax_sid = client.cookies.get("lorax_sid")
        cookie_header = "; ".join([f"{k}={v}" for k, v in client.cookies.items()])

        if lorax_sid:
            results.extend(
                await websocket_sequence(
                    base_url,
                    cookie_header,
                    lorax_sid,
                    timeout,
                    project,
                    filename,
                    socket_queries,
                    socket_path,
                )
            )

        for _ in range(request_count):
            path = random.choice(["/projects", "/memory_status", "/health"])
            results.append(await timed_request(client, "GET", path))

    for result in results:
        result["user_id"] = user_id
    return results


async def run_load_test(
    users: int,
    request_count: int,
    concurrency: int,
    base_url: str,
    timeout: float,
    socket_queries: int,
    project: str,
    filename: str,
    socket_path: str,
) -> List[RequestResult]:
    semaphore = asyncio.Semaphore(concurrency)

    async def run_user(user_index: int) -> List[RequestResult]:
        async with semaphore:
            return await simulate_user(
                user_index,
                request_count,
                base_url,
                timeout,
                socket_queries,
                project,
                filename,
                socket_path,
            )

    tasks = [asyncio.create_task(run_user(i)) for i in range(users)]
    results: List[RequestResult] = []
    for task in asyncio.as_completed(tasks):
        results.extend(await task)
    return results


def percentile(values: List[float], pct: float) -> Optional[float]:
    if not values:
        return None
    if not 0 <= pct <= 1:
        raise ValueError("pct must be between 0 and 1")

    values = sorted(values)
    k = (len(values) - 1) * pct
    lower = math.floor(k)
    upper = math.ceil(k)
    if lower == upper:
        return values[int(k)]
    return values[lower] + (values[upper] - values[lower]) * (k - lower)


def summarize(results: List[RequestResult]) -> str:
    total = len(results)
    successes = sum(1 for r in results if r["success"])
    failures = total - successes
    latencies = [r["duration"] for r in results if r["success"]]

    summary_lines = [
        f"Total requests: {total}",
        f"Successful: {successes}",
        f"Failed: {failures}",
    ]

    if latencies:
        summary_lines.append(
            f"Latency (s): min={min(latencies):.3f} max={max(latencies):.3f} avg={statistics.mean(latencies):.3f}"
        )

        p50 = percentile(latencies, 0.5)
        p90 = percentile(latencies, 0.9)
        quantile_parts = []
        if p50 is not None:
            quantile_parts.append(f"p50={p50:.3f}")
        if p90 is not None:
            quantile_parts.append(f"p90={p90:.3f}")
        if quantile_parts:
            summary_lines.append("Latency " + " ".join(quantile_parts))
    return "\n".join(summary_lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simple asynchronous load tester for the Lorax backend")
    parser.add_argument("--base-url", default="http://localhost:8080", help="Base URL of the Lorax service")
    parser.add_argument("--users", type=int, default=25, help="Number of concurrent users to simulate")
    parser.add_argument("--requests-per-user", type=int, default=10, help="Number of requests each user performs after session init")
    parser.add_argument("--concurrency", type=int, default=10, help="Maximum number of simultaneous users")
    parser.add_argument("--timeout", type=float, default=15.0, help="Per-request timeout in seconds")
    parser.add_argument("--socket-queries", type=int, default=3, help="Number of websocket queries each user performs")
    parser.add_argument("--project", default="1000Genomes", help="Project folder to load via Socket.IO")
    parser.add_argument("--filename", default="1kg_chr20.trees.tsz", help="Filename to load via Socket.IO")
    parser.add_argument("--socket-path", default="/socket.io", help="Socket.IO path if not using the default")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    results = asyncio.run(
        run_load_test(
            users=args.users,
            request_count=args.requests_per_user,
            concurrency=args.concurrency,
            base_url=args.base_url,
            timeout=args.timeout,
            socket_queries=args.socket_queries,
            project=args.project,
            filename=args.filename,
            socket_path=args.socket_path,
        )
    )

    print(summarize(results))

    failed = [r for r in results if not r["success"]]
    if failed:
        print("\nErrors:")
        for record in failed:
            print(f"- User {record['user_id']} {record['method']} {record['path']}: {record['error']}")


if __name__ == "__main__":
    main()
