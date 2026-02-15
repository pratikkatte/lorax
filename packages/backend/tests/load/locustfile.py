"""
Locust Load Testing for Lorax Backend

Defines load test scenarios for HTTP endpoints and Socket.IO events.

Usage:
    # Interactive mode (opens web UI at http://localhost:8089)
    locust -f locustfile.py --host http://localhost:8080

    # Headless mode for 100 users
    locust -f locustfile.py --headless -u 100 -r 10 -t 5m --host http://localhost:8080

    # Realistic workflow (load file, upload, request trees) - set LOAD_TEST_FILE for deployment:
    export LOAD_TEST_FILE="1000Genomes:1kg_chr20.trees.tsz"
    python scenarios.py realistic https://api.lorax.in
"""

import json
import logging
import os
import time
import random
from pathlib import Path

from locust import HttpUser, TaskSet, task, between, events
from locust.exception import StopUser
import socketio

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# Path to upload fixture (relative to this file)
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
UPLOAD_FIXTURE = FIXTURES_DIR / "sample.csv"

# Default files for load testing (project:filename). Override via LOAD_TEST_FILES (comma-separated).
DEFAULT_LOAD_TEST_FILES = [
    "1000Genomes:1kg_chr20.trees.tsz",
    "1000Genomes:1kg_chr2.trees.tsz",
    "Heliconius:erato-sara_chr2.csv",
]

# Default upload CSV for upload testing. Override via LOAD_TEST_UPLOAD_CSV.
DEFAULT_UPLOAD_CSV = Path.home() / ".lorax" / "projects" / "Heliconius" / "erato-sara_chr2.csv"

# Session isolation validation: when 1, validate load_file and process_postorder_layout
# responses match our session (filename, owner_sid, request_id, tree_indices, buffer content).
LOAD_TEST_VALIDATE_SESSION = os.getenv("LOAD_TEST_VALIDATE_SESSION", "0") == "1"

# When 1, prefer different files per user (round-robin by user_id) for stronger isolation testing.
LOAD_TEST_VARY_FILES = os.getenv("LOAD_TEST_VARY_FILES", "0") == "1"


def _get_origin():
    """Origin for CORS-restricted deployments (lorax.in). Override via LOCUST_ORIGIN env."""
    return os.getenv("LOCUST_ORIGIN", "https://lorax.in")


def _get_env_float(name, default):
    value = os.getenv(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _get_socket_transports():
    """Socket.IO transports override via LOCUST_SOCKET_TRANSPORTS (comma-separated)."""
    raw = os.getenv("LOCUST_SOCKET_TRANSPORTS")
    if not raw:
        return ["polling"]
    return [t.strip() for t in raw.split(",") if t.strip()]


def _get_socket_wait_timeout():
    """Socket.IO connect wait timeout (seconds)."""
    return _get_env_float("LOCUST_SOCKET_WAIT_TIMEOUT", 10.0)


def _get_socket_request_timeout():
    """Engine.IO request timeout (seconds)."""
    return _get_env_float("LOCUST_SOCKET_REQUEST_TIMEOUT", 15.0)


def _get_load_test_file_list():
    """Get list of project:filename pairs for load testing."""
    env_spec = os.getenv("LOAD_TEST_FILES")
    if env_spec:
        return [p.strip() for p in env_spec.split(",") if ":" in p.strip()]
    env_single = os.getenv("LOAD_TEST_FILE")
    if env_single and ":" in env_single:
        return [env_single.strip()]
    return DEFAULT_LOAD_TEST_FILES


def _parse_file_list(file_list):
    """Parse list of 'project:filename' strings into (project, filename) tuples."""
    return [tuple(spec.split(":", 1)) for spec in file_list if ":" in spec]


def _pick_load_test_file(projects_data, user_id=None):
    """
    Pick project and file for load testing.
    Uses LOAD_TEST_FILES or LOAD_TEST_FILE env, else DEFAULT_LOAD_TEST_FILES, else first from /projects.
    When LOAD_TEST_VARY_FILES=1 and user_id is set, picks different files per user (round-robin).
    Returns (project, filename) or (None, None).
    """
    file_list = _get_load_test_file_list()
    if file_list:
        parsed = _parse_file_list(file_list)
        if LOAD_TEST_VARY_FILES and user_id is not None and parsed:
            idx = (user_id - 1) % len(parsed)
            return parsed[idx]
        return parsed[0]

    all_pairs = _get_all_load_test_files(projects_data)
    if LOAD_TEST_VARY_FILES and user_id is not None and all_pairs:
        idx = (user_id - 1) % len(all_pairs)
        return all_pairs[idx]
    if all_pairs:
        return all_pairs[0]
    return (None, None)


def _get_all_load_test_files(projects_data):
    """Get all (project, filename) pairs for load testing."""
    file_list = _get_load_test_file_list()
    if file_list:
        return _parse_file_list(file_list)

    out = []
    projects = projects_data.get("projects", {})
    for proj_name, proj_data in projects.items():
        if isinstance(proj_data, dict):
            for f in proj_data.get("files", []) or []:
                if f and (f.endswith(".trees") or f.endswith(".tsz") or f.endswith(".csv")):
                    out.append((proj_name, f))
    return out


def _get_upload_fixture_path():
    """Path to CSV file for upload testing. Uses LOAD_TEST_UPLOAD_CSV env or defaults."""
    env_path = os.getenv("LOAD_TEST_UPLOAD_CSV")
    if env_path:
        p = Path(env_path)
        if p.exists():
            return p
    if DEFAULT_UPLOAD_CSV.exists():
        return DEFAULT_UPLOAD_CSV
    return UPLOAD_FIXTURE


def _num_trees_from_config(config):
    """Extract num_trees from load-file-result config."""
    if not config:
        return 10
    intervals = config.get("intervals", [])
    if not intervals:
        return config.get("num_trees", 10)
    return max(1, len(intervals) - 1)


def _parse_tree_indices_from_buffer(buffer: bytes) -> list:
    """Parse PyArrow IPC buffer and return unique tree_idx values. Returns [] on failure."""
    if not buffer or len(buffer) < 4:
        return []
    try:
        import pyarrow as pa

        node_len = int.from_bytes(buffer[:4], "little")
        node_bytes = buffer[4 : 4 + node_len]
        reader = pa.ipc.open_stream(node_bytes)
        table = reader.read_next_batch()
        if "tree_idx" in table.schema.names:
            col = table.column("tree_idx")
            if hasattr(col, "combine_chunks"):
                col = col.combine_chunks()
            return sorted(set(col.to_pylist()))
    except Exception:
        pass
    return []


_user_counter = 0


def _next_user_id():
    global _user_counter
    _user_counter += 1
    return _user_counter


def _connect_socket_and_load(self, project, filename):
    """Shared: connect Socket.IO and load file. Returns True if ready."""
    self.sio = socketio.Client(request_timeout=_get_socket_request_timeout())
    self._load_file_done = None

    @self.sio.event
    def connect():
        self.connected = True

    @self.sio.event
    def disconnect():
        self.connected = False

    @self.sio.on("load-file-result")
    def load_file_result(data):
        if LOAD_TEST_VALIDATE_SESSION and data:
            err = []
            if data.get("filename") != filename:
                err.append(f"filename mismatch: got {data.get('filename')!r} expected {filename!r}")
            if data.get("owner_sid") != self.sid:
                err.append(f"owner_sid mismatch: got {data.get('owner_sid')!r} expected {self.sid[:8]!r}...")
            config = data.get("config") or {}
            if not config.get("intervals") and "num_trees" not in config:
                err.append("config missing num_trees or intervals")
            if err:
                self._load_file_done = {
                    "ok": False,
                    "error": "session validation failed: " + "; ".join(err),
                    "code": "SESSION_VALIDATION_FAILED",
                }
                return
        self._load_file_done = data

    @self.sio.event
    def error(data):
        pass

    @self.sio.event
    def status(data):
        pass

    start_time = time.time()
    try:
        self.sio.connect(
            self.host,
            headers={"Cookie": f"lorax_sid={self.sid}", "Origin": _get_origin()},
            transports=_get_socket_transports(),
            wait=True,
            wait_timeout=_get_socket_wait_timeout(),
        )
        events.request.fire(
            request_type="Socket.IO",
            name="connect",
            response_time=(time.time() - start_time) * 1000,
            response_length=0,
            exception=None,
            context={},
        )
    except Exception as e:
        events.request.fire(
            request_type="Socket.IO",
            name="connect",
            response_time=(time.time() - start_time) * 1000,
            response_length=0,
            exception=e,
            context={},
        )
        logger.warning("[User %s] Socket.IO connect failed: %s", self.user_id, e)
        return False

    self.connected = getattr(self, "connected", False)
    if not self.connected:
        return False

    logger.info("[User %s] Loading file %s/%s", self.user_id, project, filename)
    start_time = time.time()
    self._load_file_done = None
    self.sio.emit("load_file", {"lorax_sid": self.sid, "project": project, "file": filename})

    deadline = time.time() + 60
    while self._load_file_done is None and time.time() < deadline:
        time.sleep(0.1)

    if self._load_file_done:
        payload = self._load_file_done
        is_error = (
            payload.get("ok") is False
            or "error" in payload
            or (payload.get("code") and payload.get("code") != "FILE_LOADED" and not payload.get("config"))
        )
        if is_error:
            error_text = (
                payload.get("error")
                or payload.get("message")
                or payload.get("code")
                or "session validation failed"
            )
            events.request.fire(
                request_type="Socket.IO",
                name="load_file",
                response_time=(time.time() - start_time) * 1000,
                response_length=0,
                exception=Exception(error_text),
                context={},
            )
            return False
        config = payload.get("config", {})
        self.num_trees = _num_trees_from_config(config)
        events.request.fire(
            request_type="Socket.IO",
            name="load_file",
            response_time=(time.time() - start_time) * 1000,
            response_length=0,
            exception=None,
            context={},
        )

    return bool(self._load_file_done)


class LoraxHttpUser(HttpUser):
    """
    HTTP endpoint load testing user.

    Simulates a user making HTTP requests to the Lorax backend.
    """

    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Initialize session on user start."""
        self.client.headers["Origin"] = _get_origin()
        response = self.client.post("/init-session")
        if response.status_code == 200:
            self.sid = response.json().get("sid")
            self.client.cookies.set("lorax_sid", self.sid)
        else:
            self.sid = None

    @task(10)
    def health_check(self):
        """High-frequency health check."""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    response.success()
                else:
                    response.failure("Health check returned ok=false")
            else:
                response.failure(f"Status code: {response.status_code}")

    @task(5)
    def get_projects(self):
        """List available projects."""
        with self.client.get("/projects", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "projects" in data:
                    response.success()
                else:
                    response.failure("Missing projects in response")
            else:
                response.failure(f"Status code: {response.status_code}")

    @task(3)
    def memory_status(self):
        """Check memory status."""
        with self.client.get("/memory_status", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "rss_MB" in data:
                    response.success()
                else:
                    response.failure("Missing memory stats")
            else:
                response.failure(f"Status code: {response.status_code}")

    @task(1)
    def init_new_session(self):
        """Create a new session."""
        with self.client.post("/init-session", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "sid" in data:
                    response.success()
                else:
                    response.failure("Missing sid in response")
            else:
                response.failure(f"Status code: {response.status_code}")


class LoraxSocketUser(HttpUser):
    """
    Socket.IO load testing user.

    Simulates a user connecting via Socket.IO and making requests.
    """

    wait_time = between(1.0, 3.0)

    def on_start(self):
        """Initialize HTTP session and Socket.IO connection."""
        self.client.headers["Origin"] = _get_origin()
        response = self.client.post("/init-session")
        if response.status_code == 200:
            self.sid = response.json().get("sid")
            self.client.cookies.set("lorax_sid", self.sid)
        else:
            self.sid = None
            return

        # Connect Socket.IO
        self.sio = socketio.Client(request_timeout=_get_socket_request_timeout())
        self.connected = False
        self.pending_responses = {}

        @self.sio.event
        def connect():
            self.connected = True

        @self.sio.event
        def disconnect():
            self.connected = False

        @self.sio.event
        def pong(data):
            request_time = self.pending_responses.pop("ping", None)
            if request_time:
                response_time = time.time() - request_time
                events.request.fire(
                    request_type="Socket.IO",
                    name="ping",
                    response_time=response_time * 1000,
                    response_length=len(str(data)),
                    exception=None,
                    context={},
                )

        @self.sio.event
        def status(data):
            pass  # Handle status messages

        @self.sio.event
        def error(data):
            pass  # Handle errors

        start_time = time.time()
        try:
            self.sio.connect(
                self.host,
                headers={"Cookie": f"lorax_sid={self.sid}", "Origin": _get_origin()},
                transports=_get_socket_transports(),
                wait=True,
                wait_timeout=_get_socket_wait_timeout(),
            )
            events.request.fire(
                request_type="Socket.IO",
                name="connect",
                response_time=(time.time() - start_time) * 1000,
                response_length=0,
                exception=None,
                context={},
            )
        except Exception as e:
            events.request.fire(
                request_type="Socket.IO",
                name="connect",
                response_time=0,
                response_length=0,
                exception=e,
                context={}
            )

    def on_stop(self):
        """Disconnect Socket.IO on stop."""
        if hasattr(self, 'sio') and self.sio.connected:
            self.sio.disconnect()

    @task(10)
    def ping(self):
        """Send ping and measure latency."""
        if not self.connected:
            return

        self.pending_responses["ping"] = time.time()
        try:
            self.sio.emit("ping", {})
        except Exception as e:
            events.request.fire(
                request_type="Socket.IO",
                name="ping",
                response_time=0,
                response_length=0,
                exception=e,
                context={}
            )

    @task(1)
    def load_file_request(self):
        """Simulate file load request."""
        if not self.connected or not self.sid:
            return

        start_time = time.time()
        try:
            self.sio.emit("load_file", {
                "lorax_sid": self.sid,
                "file": "test.trees",
                "project": "test"
            })
            # Note: This doesn't wait for response, just measures emit time
            events.request.fire(
                request_type="Socket.IO",
                name="load_file_emit",
                response_time=(time.time() - start_time) * 1000,
                response_length=0,
                exception=None,
                context={}
            )
        except Exception as e:
            events.request.fire(
                request_type="Socket.IO",
                name="load_file_emit",
                response_time=0,
                response_length=0,
                exception=e,
                context={},
            )


class LoraxMixedUser(HttpUser):
    """
    Mixed HTTP and Socket.IO user for realistic load testing.

    Combines HTTP requests with simulated Socket.IO behavior.
    """

    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Initialize session."""
        self.client.headers["Origin"] = _get_origin()
        response = self.client.post("/init-session")
        if response.status_code == 200:
            self.sid = response.json().get("sid")
            self.client.cookies.set("lorax_sid", self.sid)
        else:
            self.sid = None

    @task(5)
    def typical_browsing(self):
        """Simulate typical browsing pattern."""
        # Health check
        self.client.get("/health")

        # Get projects
        self.client.get("/projects")

        # Random wait to simulate user thinking
        time.sleep(random.uniform(0.5, 1.5))

    @task(3)
    def check_status(self):
        """Check server status."""
        self.client.get("/health")
        self.client.get("/memory_status")

    @task(1)
    def new_session(self):
        """Occasionally create new session."""
        self.client.post("/init-session")


def _upload_file_and_get_filename(client):
    """Upload fixture file via POST /upload. Returns filename or None."""
    upload_path = _get_upload_fixture_path()
    if not upload_path.exists():
        return None

    with open(upload_path, "rb") as f:
        files = {"file": (upload_path.name, f, "text/csv")}
        response = client.post("/upload", files=files, name="upload")
        if response.status_code != 200:
            return None
        data = response.json()
        if "error" in data:
            return None
        return data.get("filename", upload_path.name)


class LoraxLoadUser(HttpUser):
    """
    User that loads from projects (1000Genomes, Heliconius, etc.). No upload.
    Cycle: init_session -> projects -> load_file -> process_postorder_layout -> disconnect.
    One cycle per user; 10 users = 10 requests per type.
    """

    weight = 1
    wait_time = between(0, 0)

    def on_start(self):
        """Initialize session, get projects, connect Socket.IO, load a file from projects."""
        self.user_id = _next_user_id()
        logger.info("[User %s] Starting (type=load)", self.user_id)

        self.client.headers["Origin"] = _get_origin()
        self.file_pairs = []

        response = self.client.post("/init-session")
        if response.status_code != 200:
            self.sid = None
            self.ready = False
            logger.warning("[User %s] init-session failed", self.user_id)
            return
        self.sid = response.json().get("sid")
        self.client.cookies.set("lorax_sid", self.sid)
        logger.info("[User %s] Session created: %s", self.user_id, self.sid[:8] + "...")

        proj_response = self.client.get("/projects")
        if proj_response.status_code != 200:
            self.ready = False
            logger.warning("[User %s] /projects failed", self.user_id)
            return
        proj_data = proj_response.json()
        all_pairs = _get_all_load_test_files(proj_data)
        self.file_pairs = [(p, f) for p, f in all_pairs if p != "Uploads"]
        logger.info("[User %s] Got %s file pairs (excluding Uploads)", self.user_id, len(self.file_pairs))

        project, filename = _pick_load_test_file(proj_data, user_id=self.user_id)
        if project == "Uploads" or not project:
            project, filename = (self.file_pairs[0] if self.file_pairs else (None, None))

        self.project = project
        self.filename = filename
        self.num_trees = 10
        self.ready = False
        self.sio = None
        self._request_id = 0

        if not project or not filename:
            logger.warning("[User %s] No project/file to load", self.user_id)
            return

        logger.info("[User %s] Will load file: %s/%s", self.user_id, project, filename)
        logger.info("[User %s] Connecting Socket.IO...", self.user_id)
        self.ready = _connect_socket_and_load(self, project, filename)
        logger.info("[User %s] on_start complete, ready=%s, num_trees=%s", self.user_id, self.ready, self.num_trees)

    def on_stop(self):
        if hasattr(self, "sio") and self.sio and self.sio.connected:
            self.sio.disconnect()
        logger.info("[User %s] Stopped", self.user_id)

    @task
    def run_cycle(self):
        """Run one full cycle: process_postorder_layout, then disconnect."""
        logger.info("[User %s] Starting cycle", self.user_id)

        self._do_request_tree_layout()
        logger.info("[User %s] Completed process_postorder_layout", self.user_id)

        logger.info("[User %s] Cycle complete, disconnecting", self.user_id)
        if hasattr(self, "sio") and self.sio and self.sio.connected:
            self.sio.disconnect()
        raise StopUser()

    def _do_request_tree_layout(self):
        """Request tree data (process_postorder_layout) - simulates scroll."""
        if not self.ready or not self.sio or not self.sio.connected:
            return

        self._request_id = getattr(self, "_request_id", 0) + 1
        num_trees = self.num_trees
        window_size = min(10, num_trees)
        start_idx = random.randint(0, max(0, num_trees - window_size))
        display_array = list(range(start_idx, min(start_idx + window_size, num_trees)))

        if not display_array:
            return

        start_time = time.time()
        self._postorder_done = None

        def callback(response):
            self._postorder_done = True
            rt = (time.time() - start_time) * 1000
            if response and "error" in response:
                events.request.fire(
                    request_type="Socket.IO",
                    name="process_postorder_layout",
                    response_time=rt,
                    response_length=0,
                    exception=Exception(response.get("error", "Unknown error")),
                    context={},
                )
            else:
                buf_len = len(response.get("buffer", b"")) if response else 0
                exc = None
                if LOAD_TEST_VALIDATE_SESSION and response:
                    err = []
                    if response.get("request_id") != self._request_id:
                        err.append(
                            f"request_id mismatch: got {response.get('request_id')!r} expected {self._request_id!r}"
                        )
                    resp_indices = response.get("tree_indices", [])
                    display_set = set(display_array)
                    if not all(i in display_set for i in resp_indices):
                        err.append(
                            f"tree_indices {resp_indices!r} not subset of display_array {display_array!r}"
                        )
                    buf = response.get("buffer", b"")
                    if buf:
                        buf_indices = _parse_tree_indices_from_buffer(buf)
                        if buf_indices and set(buf_indices) != set(resp_indices):
                            err.append(
                                f"buffer tree_idx {buf_indices!r} != response tree_indices {resp_indices!r}"
                            )
                    if err:
                        exc = Exception("session validation failed: " + "; ".join(err))
                events.request.fire(
                    request_type="Socket.IO",
                    name="process_postorder_layout",
                    response_time=rt,
                    response_length=buf_len,
                    exception=exc,
                    context={},
                )

        try:
            self.sio.emit(
                "process_postorder_layout",
                {
                    "lorax_sid": self.sid,
                    "displayArray": display_array,
                    "actualDisplayArray": display_array,
                    "sparsification": len(display_array) > 1,
                    "request_id": self._request_id,
                },
                callback=callback,
            )
        except Exception as e:
            events.request.fire(
                request_type="Socket.IO",
                name="process_postorder_layout",
                response_time=0,
                response_length=0,
                exception=e,
                context={},
            )
            return

        deadline = time.time() + 120
        while self._postorder_done is None and time.time() < deadline:
            time.sleep(0.1)


class LoraxUploadUser(HttpUser):
    """
    User that uploads a file then loads from Uploads.
    Cycle: init_session -> upload -> load_file -> process_postorder_layout -> disconnect.
    One cycle per user; 10 users = 10 requests per type.
    """

    weight = 1
    wait_time = between(0, 0)

    def on_start(self):
        """Initialize session, upload file, connect Socket.IO, load from Uploads."""
        self.user_id = _next_user_id()
        logger.info("[User %s] Starting (type=upload)", self.user_id)

        self.client.headers["Origin"] = _get_origin()

        response = self.client.post("/init-session")
        if response.status_code != 200:
            self.sid = None
            self.ready = False
            logger.warning("[User %s] init-session failed", self.user_id)
            return
        self.sid = response.json().get("sid")
        self.client.cookies.set("lorax_sid", self.sid)
        logger.info("[User %s] Session created: %s", self.user_id, self.sid[:8] + "...")

        filename = _upload_file_and_get_filename(self.client)
        if not filename:
            logger.warning("[User %s] Upload failed, no filename", self.user_id)
            return

        self.project = "Uploads"
        self.filename = filename
        self.num_trees = 10
        self.ready = False
        self.sio = None
        self._request_id = 0

        logger.info("[User %s] Will load file: Uploads/%s", self.user_id, filename)
        logger.info("[User %s] Connecting Socket.IO...", self.user_id)
        self.ready = _connect_socket_and_load(self, "Uploads", filename)
        logger.info("[User %s] on_start complete, ready=%s, num_trees=%s", self.user_id, self.ready, self.num_trees)

    def on_stop(self):
        if hasattr(self, "sio") and self.sio and self.sio.connected:
            self.sio.disconnect()
        logger.info("[User %s] Stopped", self.user_id)

    @task
    def run_cycle(self):
        """Run one cycle: request_tree_layout; then stop (no load_different_file)."""
        logger.info("[User %s] Starting cycle", self.user_id)

        self._do_request_tree_layout()
        logger.info("[User %s] Completed request_tree_layout", self.user_id)

        logger.info("[User %s] Cycle complete, disconnecting", self.user_id)
        if hasattr(self, "sio") and self.sio and self.sio.connected:
            self.sio.disconnect()
        raise StopUser()

    def _do_request_tree_layout(self):
        """Request tree data (process_postorder_layout) - simulates scroll."""
        if not self.ready or not self.sio or not self.sio.connected:
            return

        self._request_id = getattr(self, "_request_id", 0) + 1
        num_trees = self.num_trees
        window_size = min(10, num_trees)
        start_idx = random.randint(0, max(0, num_trees - window_size))
        display_array = list(range(start_idx, min(start_idx + window_size, num_trees)))

        if not display_array:
            return

        start_time = time.time()
        self._postorder_done = None

        def callback(response):
            self._postorder_done = True
            rt = (time.time() - start_time) * 1000
            if response and "error" in response:
                events.request.fire(
                    request_type="Socket.IO",
                    name="process_postorder_layout",
                    response_time=rt,
                    response_length=0,
                    exception=Exception(response.get("error", "Unknown error")),
                    context={},
                )
            else:
                buf_len = len(response.get("buffer", b"")) if response else 0
                exc = None
                if LOAD_TEST_VALIDATE_SESSION and response:
                    err = []
                    if response.get("request_id") != self._request_id:
                        err.append(
                            f"request_id mismatch: got {response.get('request_id')!r} expected {self._request_id!r}"
                        )
                    resp_indices = response.get("tree_indices", [])
                    display_set = set(display_array)
                    if not all(i in display_set for i in resp_indices):
                        err.append(
                            f"tree_indices {resp_indices!r} not subset of display_array {display_array!r}"
                        )
                    buf = response.get("buffer", b"")
                    if buf:
                        buf_indices = _parse_tree_indices_from_buffer(buf)
                        if buf_indices and set(buf_indices) != set(resp_indices):
                            err.append(
                                f"buffer tree_idx {buf_indices!r} != response tree_indices {resp_indices!r}"
                            )
                    if err:
                        exc = Exception("session validation failed: " + "; ".join(err))
                events.request.fire(
                    request_type="Socket.IO",
                    name="process_postorder_layout",
                    response_time=rt,
                    response_length=buf_len,
                    exception=exc,
                    context={},
                )

        try:
            self.sio.emit(
                "process_postorder_layout",
                {
                    "lorax_sid": self.sid,
                    "displayArray": display_array,
                    "actualDisplayArray": display_array,
                    "sparsification": len(display_array) > 1,
                    "request_id": self._request_id,
                },
                callback=callback,
            )
        except Exception as e:
            events.request.fire(
                request_type="Socket.IO",
                name="process_postorder_layout",
                response_time=0,
                response_length=0,
                exception=e,
                context={},
            )
            return

        deadline = time.time() + 120
        while self._postorder_done is None and time.time() < deadline:
            time.sleep(0.1)


# For running with specific scenarios
if __name__ == "__main__":
    import subprocess
    import sys

    if len(sys.argv) > 1:
        scenario = sys.argv[1]
        from scenarios import SCENARIOS

        if scenario in SCENARIOS:
            config = SCENARIOS[scenario]
            cmd = [
                "locust",
                "-f", __file__,
                "--headless",
                "-u", str(config["users"]),
                "-r", str(config["spawn_rate"]),
                "-t", config["duration"],
                "--host", config.get("host", "http://localhost:8080"),
                "--html", f"{scenario}_report.html"
            ]
            subprocess.run(cmd)
        else:
            print(f"Unknown scenario: {scenario}")
            print(f"Available: {', '.join(SCENARIOS.keys())}")
    else:
        print("Usage: python locustfile.py <scenario>")
        print("Or run with locust command directly")
