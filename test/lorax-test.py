from locust import User, task, between, events
import socketio
import requests
import time
import threading

BASE_URL = "http://localhost:8080"      # or https://lorax.in/api
SOCKET_PATH = "/socket.io/"
PROJECT = "1000Genomes"
TEST_FILE = "1kg_chr20.trees.tsz"

# ===================================================================
# Blocking waiter for socket.io events (so locust can measure latency)
# ===================================================================
class EventWaiter:
    def __init__(self):
        self.result = None
        self.event = threading.Event()

    def handler(self, data):
        self.result = data
        self.event.set()

    def wait(self, timeout=10):
        if not self.event.wait(timeout):
            raise TimeoutError("Socket.IO event timed out")
        return self.result


# ===================================================================
# Main Locust User
# ===================================================================
class LoraxSocketUser(User):
    wait_time = between(1, 3)

    def on_start(self):
        print("\n--- NEW USER SPAWNED ---")
        self.http = requests.Session()

        # -----------------------------
        # Step 1: Init Session (HTTP)
        # -----------------------------
        start = time.time()
        resp = self.http.post(f"{BASE_URL}/init-session")
        sid = resp.json().get("sid")

        events.request.fire(
            request_type="http",
            name="init-session",
            response_time=(time.time() - start) * 1000,
            response_length=0,
            success=True,
        )

        self.sid = sid
        print("✔ SID:", sid)

        # -----------------------------
        # Step 2: Connect WebSocket
        # -----------------------------
        self.sio = socketio.Client()

        cookies = f"lorax_sid={sid}"

        start = time.time()
        try:
            self.sio.connect(
                BASE_URL,
                transports=["websocket"],
                socketio_path=SOCKET_PATH,
                headers={"Cookie": cookies},
                wait_timeout=10,
            )
            success = True
        except Exception as e:
            success = False
            print("❌ WS connect failed:", e)

        events.request.fire(
            request_type="socketio",
            name="connect",
            response_time=(time.time() - start) * 1000,
            response_length=0,
            success=success,
        )

        # -----------------------------
        # Setup Socket.IO Handlers
        # -----------------------------
        self.setup_handlers()

    # ================================================================
    # Socket.IO event handler registration
    # ================================================================
    def setup_handlers(self):
        @self.sio.on("status")
        def status(data):
            print("[EVENT] status:", data)

        @self.sio.on("pong")
        def pong(data):
            self.pong_waiter.handler(data)

        @self.sio.on("query-result")
        def query_result(data):
            self.query_waiter.handler(data)

        @self.sio.on("details-result")
        def details_result(data):
            self.details_waiter.handler(data)

        @self.sio.on("load-file-result")
        def load_file_result(data):
            self.loadfile_waiter.handler(data)

    # ================================================================
    # TASK 1: PING LATENCY (round-trip)
    # ================================================================
    @task
    def do_ping(self):
        self.pong_waiter = EventWaiter()
        start = time.time()

        try:
            self.sio.emit("ping", {"time": time.time()})
            self.pong_waiter.wait()

            events.request.fire(
                request_type="socketio",
                name="ping",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                success=True,
            )
        except Exception as e:
            events.request.fire(
                request_type="socketio",
                name="ping",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                success=False,
                exception=e,
            )

    # ================================================================
    # TASK 2: QUERY OPERATION
    # ================================================================
    @task
    def do_query(self):
        self.query_waiter = EventWaiter()
        start = time.time()

        payload = {
            "value": 2000000,
            "localTrees": [],
            "lorax_sid": self.sid,
        }

        try:
            self.sio.emit("query", payload)
            result = self.query_waiter.wait()

            events.request.fire(
                request_type="socketio",
                name="query",
                response_time=(time.time() - start) * 1000,
                response_length=len(str(result)),
                success=True,
            )
        except Exception as e:
            events.request.fire(
                request_type="socketio",
                name="query",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                success=False,
                exception=e,
            )

    # ================================================================
    # TASK 3: DETAILS OPERATION
    # ================================================================
    @task
    def do_details(self):
        self.details_waiter = EventWaiter()
        start = time.time()

        payload = {
            "lorax_sid": self.sid,
            "node": 42,
            "global_index": 50,
        }

        try:
            self.sio.emit("details", payload)
            result = self.details_waiter.wait()

            events.request.fire(
                request_type="socketio",
                name="details",
                response_time=(time.time() - start) * 1000,
                response_length=len(str(result)),
                success=True,
            )
        except Exception as e:
            events.request.fire(
                request_type="socketio",
                name="details",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                success=False,
                exception=e,
            )

    # ================================================================
    # TASK 4: LOAD FILE (biggest stress)
    # ================================================================
    @task
    def do_loadfile(self):
        self.loadfile_waiter = EventWaiter()
        start = time.time()

        payload = {
            "project": PROJECT,
            "file": TEST_FILE,
            "lorax_sid": self.sid,
        }

        try:
            self.sio.emit("load_file", payload)
            result = self.loadfile_waiter.wait()

            events.request.fire(
                request_type="socketio",
                name="load_file",
                response_time=(time.time() - start) * 1000,
                response_length=len(str(result)),
                success=True,
            )
        except Exception as e:
            events.request.fire(
                request_type="socketio",
                name="load_file",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                success=False,
                exception=e,
            )

    def on_stop(self):
        if hasattr(self, "sio"):
            print("--- USER DISCONNECTING ---")
            self.sio.disconnect()
