"""
Load Testing Scenarios for Lorax Backend

Defines different load testing scenarios for various use cases.

Usage:
    from scenarios import run_scenario
    run_scenario("light")

Or via command line:
    python locustfile.py light
"""

# Scenario configurations
SCENARIOS = {
    # Light load - 10 users for 2 minutes
    "light": {
        "users": 10,
        "spawn_rate": 2,  # users per second
        "duration": "2m",
        "description": "Light load test with 10 concurrent users",
        "host": "http://localhost:8080"
    },

    # Medium load - 50 users for 5 minutes
    "medium": {
        "users": 50,
        "spawn_rate": 5,
        "duration": "5m",
        "description": "Medium load test with 50 concurrent users",
        "host": "http://localhost:8080"
    },

    # Heavy load - 100 users for 10 minutes
    "heavy": {
        "users": 100,
        "spawn_rate": 10,
        "duration": "10m",
        "description": "Heavy load test with 100 concurrent users",
        "host": "http://localhost:8080"
    },

    # Sustained load - 50 users for 30 minutes
    "sustained": {
        "users": 50,
        "spawn_rate": 5,
        "duration": "30m",
        "description": "Sustained load test for memory leak detection",
        "host": "http://localhost:8080"
    },

    # Spike test - 200 users with fast spawn
    "spike": {
        "users": 200,
        "spawn_rate": 50,
        "duration": "5m",
        "description": "Spike test with rapid user increase",
        "host": "http://localhost:8080"
    },

    # Stress test - 150 users for 15 minutes
    "stress": {
        "users": 150,
        "spawn_rate": 15,
        "duration": "15m",
        "description": "Stress test to find breaking point",
        "host": "http://localhost:8080"
    },

    # Endurance test - 30 users for 1 hour
    "endurance": {
        "users": 30,
        "spawn_rate": 3,
        "duration": "1h",
        "description": "Long-running endurance test",
        "host": "http://localhost:8080"
    },

    # Quick smoke test - 5 users for 1 minute
    "smoke": {
        "users": 5,
        "spawn_rate": 5,
        "duration": "1m",
        "description": "Quick smoke test to verify setup",
        "host": "http://localhost:8080"
    }
}


# Expected performance thresholds
THRESHOLDS = {
    "http": {
        "p95_response_time_ms": 1000,  # 95th percentile < 1 second
        "p99_response_time_ms": 2000,  # 99th percentile < 2 seconds
        "error_rate_percent": 1.0,     # Error rate < 1%
    },
    "socketio": {
        "p95_response_time_ms": 2000,  # 95th percentile < 2 seconds
        "p99_response_time_ms": 5000,  # 99th percentile < 5 seconds
        "error_rate_percent": 1.0,     # Error rate < 1%
    }
}


def run_scenario(scenario_name: str, host: str = None):
    """
    Run a specific load testing scenario.

    Args:
        scenario_name: Name of the scenario to run
        host: Override host URL

    Returns:
        subprocess.CompletedProcess result
    """
    import subprocess

    if scenario_name not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario_name}. "
                        f"Available: {', '.join(SCENARIOS.keys())}")

    config = SCENARIOS[scenario_name]
    target_host = host or config["host"]

    cmd = [
        "locust",
        "-f", "locustfile.py",
        "--headless",
        "-u", str(config["users"]),
        "-r", str(config["spawn_rate"]),
        "-t", config["duration"],
        "--host", target_host,
        "--html", f"{scenario_name}_report.html",
        "--csv", f"{scenario_name}_results"
    ]

    print(f"Running scenario: {scenario_name}")
    print(f"Description: {config['description']}")
    print(f"Users: {config['users']}, Spawn rate: {config['spawn_rate']}/s")
    print(f"Duration: {config['duration']}")
    print(f"Target: {target_host}")
    print("-" * 50)

    return subprocess.run(cmd)


def validate_results(results_file: str, scenario_name: str = "default") -> dict:
    """
    Validate load test results against thresholds.

    Args:
        results_file: Path to Locust CSV results file
        scenario_name: Scenario name for reporting

    Returns:
        dict with validation results
    """
    import csv

    validation = {
        "passed": True,
        "failures": [],
        "metrics": {}
    }

    try:
        with open(f"{results_file}_stats.csv", 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row["Name"] == "Aggregated":
                    # Extract metrics
                    validation["metrics"] = {
                        "requests": int(row["Request Count"]),
                        "failures": int(row["Failure Count"]),
                        "avg_response_time": float(row["Average Response Time"]),
                        "p95": float(row.get("95%", 0)),
                        "p99": float(row.get("99%", 0)),
                    }

                    # Calculate error rate
                    total = validation["metrics"]["requests"]
                    failures = validation["metrics"]["failures"]
                    error_rate = (failures / total * 100) if total > 0 else 0
                    validation["metrics"]["error_rate"] = error_rate

                    # Validate against thresholds
                    http_thresholds = THRESHOLDS["http"]

                    if validation["metrics"]["p95"] > http_thresholds["p95_response_time_ms"]:
                        validation["passed"] = False
                        validation["failures"].append(
                            f"P95 response time {validation['metrics']['p95']}ms "
                            f"exceeds threshold {http_thresholds['p95_response_time_ms']}ms"
                        )

                    if error_rate > http_thresholds["error_rate_percent"]:
                        validation["passed"] = False
                        validation["failures"].append(
                            f"Error rate {error_rate:.2f}% "
                            f"exceeds threshold {http_thresholds['error_rate_percent']}%"
                        )

    except FileNotFoundError:
        validation["passed"] = False
        validation["failures"].append(f"Results file not found: {results_file}_stats.csv")

    return validation


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Load Testing Scenarios")
        print("=" * 50)
        for name, config in SCENARIOS.items():
            print(f"\n{name}:")
            print(f"  {config['description']}")
            print(f"  Users: {config['users']}, Rate: {config['spawn_rate']}/s")
            print(f"  Duration: {config['duration']}")
        print("\nUsage: python scenarios.py <scenario_name> [host]")
    else:
        scenario = sys.argv[1]
        host = sys.argv[2] if len(sys.argv) > 2 else None
        run_scenario(scenario, host)
