"""
Locust Load Testing for Lorax Backend

Defines load test scenarios for HTTP endpoints and Socket.IO events.

Usage:
    # Interactive mode (opens web UI at http://localhost:8089)
    locust -f locustfile.py --host http://localhost:8080

    # Headless mode for 100 users
    locust -f locustfile.py --headless -u 100 -r 10 -t 5m --host http://localhost:8080

    # With HTML report
    locust -f locustfile.py --headless -u 100 -r 10 -t 5m --host http://localhost:8080 --html report.html
"""

import json
import time
import random
from locust import HttpUser, TaskSet, task, between, events
import socketio


class LoraxHttpUser(HttpUser):
    """
    HTTP endpoint load testing user.

    Simulates a user making HTTP requests to the Lorax backend.
    """

    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Initialize session on user start."""
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
        # First get HTTP session
        response = self.client.post("/init-session")
        if response.status_code == 200:
            self.sid = response.json().get("sid")
            self.client.cookies.set("lorax_sid", self.sid)
        else:
            self.sid = None
            return

        # Connect Socket.IO
        self.sio = socketio.Client()
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
                    context={}
                )

        @self.sio.event
        def status(data):
            pass  # Handle status messages

        @self.sio.event
        def error(data):
            pass  # Handle errors

        try:
            self.sio.connect(
                self.host,
                headers={"Cookie": f"lorax_sid={self.sid}"}
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
                context={}


class LoraxMixedUser(HttpUser):
    """
    Mixed HTTP and Socket.IO user for realistic load testing.

    Combines HTTP requests with simulated Socket.IO behavior.
    """

    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Initialize session."""
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
