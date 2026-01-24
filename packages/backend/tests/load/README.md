# Lorax Load Testing

This directory contains load testing tools for the Lorax backend using [Locust](https://locust.io/).

## Prerequisites

Install test dependencies:

```bash
cd packages/backend
pip install -e ".[dev]"
```

Ensure the backend is running:

```bash
lorax serve --reload
```

## Quick Start

### Interactive Mode (Web UI)

Start Locust with the web interface:

```bash
cd packages/backend/tests/load
locust -f locustfile.py --host http://localhost:8080
```

Then open http://localhost:8089 in your browser to configure and run tests.

### Headless Mode

Run tests from command line without the web UI:

```bash
# 100 users, 10 spawn rate, 5 minutes
locust -f locustfile.py --headless -u 100 -r 10 -t 5m --host http://localhost:8080
```

## Test Scenarios

Pre-defined scenarios are available in `scenarios.py`:

| Scenario | Users | Spawn Rate | Duration | Purpose |
|----------|-------|------------|----------|---------|
| smoke | 5 | 5/s | 1m | Quick verification |
| light | 10 | 2/s | 2m | Light load testing |
| medium | 50 | 5/s | 5m | Normal load testing |
| heavy | 100 | 10/s | 10m | Heavy load testing |
| sustained | 50 | 5/s | 30m | Memory leak detection |
| spike | 200 | 50/s | 5m | Spike testing |
| stress | 150 | 15/s | 15m | Find breaking point |
| endurance | 30 | 3/s | 1h | Long-running test |

Run a scenario:

```bash
python scenarios.py medium
```

Or with a custom host:

```bash
python scenarios.py heavy http://staging.example.com
```

## User Classes

### LoraxHttpUser

Tests HTTP endpoints:
- `/health` - Health checks (high frequency)
- `/projects` - Project listing
- `/memory_status` - Cache statistics
- `/init-session` - Session creation

### LoraxSocketUser

Tests Socket.IO events:
- `ping` - Latency measurement
- `load_file` - File loading requests

### LoraxMixedUser

Realistic mixed workload combining HTTP and simulated Socket.IO behavior.

## Expected Performance

### HTTP Endpoints
- P95 response time: < 1 second
- P99 response time: < 2 seconds
- Error rate: < 1%

### Socket.IO Events
- P95 response time: < 2 seconds
- P99 response time: < 5 seconds
- Error rate: < 1%

## Generating Reports

### HTML Report

```bash
locust -f locustfile.py --headless -u 100 -r 10 -t 5m \
    --host http://localhost:8080 \
    --html report.html
```

### CSV Export

```bash
locust -f locustfile.py --headless -u 100 -r 10 -t 5m \
    --host http://localhost:8080 \
    --csv results
```

This generates:
- `results_stats.csv` - Request statistics
- `results_failures.csv` - Failure details
- `results_stats_history.csv` - Time-series data

## Analyzing Results

### Validate Against Thresholds

```python
from scenarios import validate_results

results = validate_results("results", "medium")
if results["passed"]:
    print("All thresholds passed!")
else:
    print("Failures:")
    for failure in results["failures"]:
        print(f"  - {failure}")
```

### Key Metrics to Watch

1. **Response Time Distribution**
   - Median (50th percentile)
   - P95 and P99 percentiles
   - Maximum response time

2. **Throughput**
   - Requests per second
   - Trend over time

3. **Error Rate**
   - Percentage of failed requests
   - Types of errors

4. **Resource Utilization**
   - Memory usage (check `/memory_status`)
   - Connection pool utilization

## Troubleshooting

### "Connection refused" errors

Ensure the backend is running:
```bash
lorax serve --reload
```

### High error rate

Check backend logs for errors:
```bash
tail -f /var/log/lorax/server.log
```

### Memory issues during sustained tests

Monitor memory:
```bash
watch -n 5 'curl http://localhost:8080/memory_status'
```

### Socket.IO connection issues

Ensure Socket.IO client is installed:
```bash
pip install python-socketio[client]
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Run Load Tests
  run: |
    cd packages/backend
    pip install -e ".[dev]"
    lorax serve &
    sleep 5
    cd tests/load
    python scenarios.py smoke http://localhost:8080

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: load-test-results
    path: packages/backend/tests/load/*_report.html
```

## Custom Tests

Create custom test classes by extending the base users:

```python
from locust import task
from locustfile import LoraxHttpUser

class CustomUser(LoraxHttpUser):
    @task
    def custom_test(self):
        # Your custom test logic
        pass
```
