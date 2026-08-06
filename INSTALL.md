# Installation Guide

This document covers all the ways to install and run Lorax.

## Quick Install (pip)

The simplest safe installation uses a dedicated environment:

```bash
conda create -n lorax-runtime python=3.11 pip -c conda-forge
conda activate lorax-runtime
python -m pip install lorax-arg
lorax
```

This installs Lorax and opens the web interface in your browser.

### CLI Options

```bash
lorax --help              # Show all options
lorax --port 3000         # Run on a specific port
lorax --file path/to.trees  # Load a file directly (preferred for large files)
```

---

## Docker

### Option 1: Pre-built Image (Recommended)

Pull the image from Docker Hub and run it:

```bash
docker pull pratikkatte7/lorax
docker run -it -p 80:80 lorax
```

Then open [http://localhost:80](http://localhost:80) in your browser.

> If port 80 is in use on your system, choose a different host port:
> ```bash
> docker run -it -p 5173:80 lorax
> ```
> Then open [http://localhost:5173](http://localhost:5173).

### Option 2: Build from Source (Full Image)

The full image bundles the website (nginx) and backend (FastAPI + Socket.IO) in a single container, served on port 3000.

```bash
git clone https://github.com/pratikkatte/lorax.git
cd lorax
docker build -t lorax-monorepo .
docker run --rm -p 3000:3000 lorax-monorepo
```

Then open [http://localhost:3000](http://localhost:3000).

### Option 3: Build from Source (Backend Only)

A backend-only image suitable for cloud deployments (e.g., GCP). Runs the API on port 8080.

```bash
docker build --target backend -t lorax-backend .
docker run --rm -p 8080:8080 lorax-backend
```

---

## Using Your Own ARG Data

Lorax supports files in `.trees`, `.trees.tsz` (tskit format), and `.csv` format.

### Web Upload

For smaller files, use the upload panel in the Lorax web interface once the tool is running.

### Volume Mounting (Recommended for Large Datasets)

Mount a local directory into the container to avoid slow web uploads. For example, if your ARG files are in a folder named `ts_files` in your current directory:

**Pre-built image:**

```bash
docker run -it -p 80:80 -v $(pwd)/ts_files:/app/UPLOADS/ts_files lorax
```

**Full monorepo image:**

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/ts_files:/app/UPLOADS/ts_files" \
  lorax-monorepo
```

After mounting, your files will be accessible through the Lorax interface.

### Direct File Loading (pip install)

When running via pip, use the `--file` flag to load a file directly:

```bash
lorax --file path/to/your.trees
```

---

## Clean Conda Environment for Release Builds

Do not build or install Lorax in Conda's `base` environment. A Lorax wheel is
pure Python, so a wheel built with Python 3.11 can be installed on every tested
Python version (3.10 through 3.13). Runtime compatibility is determined by the
dependency ranges in the root `pyproject.toml`, not by packages already present
in the build environment.

Create the dedicated build environment once:

```bash
conda env create -f environment-build.yml
conda activate lorax-build
```

For a full release build, clone `lorax-plugin` beside this repository. The
release command installs locked Node dependencies, builds both frontends,
creates the wheel and source archive, runs Twine metadata checks, and verifies
that the wheel contains its UI:

```bash
cd /path/to/parent
git clone https://github.com/pratikkatte/lorax.git
git clone https://github.com/pratikkatte/lorax-plugin.git
cd lorax
python scripts/build_release.py
```

If the generated frontend under `packages/app/lorax_app/static` is already
current, it can be reused:

```bash
python scripts/build_release.py --use-existing-frontend
```

Before publishing, the CI wheel matrix must pass on Python 3.10, 3.11, 3.12,
and 3.13. It installs the wheel into a clean environment, runs `pip check`, and
forces the first Numba compilation—the path that catches NumPy binary-stack
problems.

## Building from Source (pip)

For development or when you need to run from source without Docker.

### Prerequisites

- Python 3.10–3.13
- Node.js 20.19+ or 22.12+ (Node 22 recommended)
- npm

### Steps

```bash
# Clone the repository
git clone https://github.com/pratikkatte/lorax.git
cd lorax

# Build the website
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build

# Install the complete Python project from the canonical root metadata
python -m pip install -e .

# Run Lorax
lorax --port 3000
```

### Building a Self-contained Wheel

```bash
# Build UI and sync into the Python package
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
python packages/app/scripts/sync_jbrowse_assets.py

# Build the wheel
python -m pip install build
python -m build .
```

The resulting wheel can be installed on machines with Python 3.10–3.13:

```bash
conda create -n lorax-runtime python=3.11 pip -c conda-forge
conda activate lorax-runtime
python -m pip install dist/lorax_arg-*.whl
python -m pip check
python scripts/smoke_installed_wheel.py
lorax
```

Use a dedicated runtime environment on each server. Installing Lorax into a
shared environment can still conflict with unrelated software that has its own
NumPy, Pandas, Protobuf, or web-stack constraints. In particular, do not use
the Conda `base` environment for Lorax.

---

## Environment Variables

The backend supports several environment variables for tuning performance and behavior.

### Load-File Backpressure

Controls concurrency for CPU-heavy file loading to prevent starving socket responsiveness.

| Variable | Default | Description |
|---|---|---|
| `LORAX_LOAD_FILE_MAX_CONCURRENCY` | `1` | Maximum concurrent file loads |
| `LORAX_LOAD_FILE_MAX_QUEUE` | `8` | Maximum queued file-load requests |
| `LORAX_LOAD_FILE_QUEUE_TIMEOUT_SEC` | `30` | Queue timeout in seconds |

### Session and Cache TTLs

Controls in-memory session and tree-graph cache lifetimes.

| Variable | Default | Description |
|---|---|---|
| `LORAX_COOKIE_MAX_AGE_SEC` | `3600` | Session cookie max age (seconds) |
| `LORAX_INMEM_TTL_SEC` | `3600` | In-memory cache idle TTL (seconds) |
| `LORAX_CACHE_CLEANUP_INTERVAL_SEC` | `60` | Cache cleanup interval (seconds) |

### Runtime Mode

| Variable | Default | Description |
|---|---|---|
| `LORAX_MODE` | _(unset)_ | Set to `local` for local-only mode |

---

## Production Deployment

### Gunicorn (multi-worker)

```bash
python -m pip install -e ".[prod]"
python -m gunicorn -c packages/backend/gunicorn_config.py lorax.lorax_app:sio_app
```

Override worker count at runtime:

```bash
WEB_CONCURRENCY=3 python -m gunicorn -c packages/backend/gunicorn_config.py lorax.lorax_app:sio_app
```

### Google Cloud Platform

The repository includes a `cloudbuild.yaml` for CI/CD with Google Cloud Build. The backend can be deployed to Compute Engine with Docker, and the frontend can be served from a GCS bucket. Redis (via Memorystore) is supported for distributed caching.

See the backend README at [`packages/backend/README.md`](packages/backend/README.md) for further server configuration details.
