# Contributing to Lorax

Thanks for your interest in contributing to Lorax! This guide covers how to set up a development environment, understand the project structure, run tests, and submit changes.

## Development Setup

### Prerequisites

- Python 3.10–3.13
- Node.js 20.19+ or 22.12+ (Node 22 recommended)
- npm
- Git

### Clone and Install

```bash
git clone https://github.com/pratikkatte/lorax.git
cd lorax

# Install frontend dependencies
npm ci

# Install the complete Python project in editable mode with dev extras
python -m pip install -e ".[dev]"
```

### Running in Development Mode

Start the backend and frontend dev servers separately:

```bash
# Terminal 1: Backend (FastAPI + Socket.IO, auto-reload)
LORAX_MODE=local lorax serve --reload

# Terminal 2: Frontend (Vite dev server on port 3001)
npm --workspace packages/website run dev
```

The frontend dev server proxies API requests to the backend automatically.

---

## Project Structure

Lorax is a monorepo managed with npm workspaces:

```
lorax/
├── packages/
│   ├── backend/        # FastAPI + Socket.IO server (Python)
│   │   ├── lorax/      # Main Python package
│   │   │   ├── cli.py              # CLI entry points
│   │   │   ├── lorax_app.py        # App factory (FastAPI + Socket.IO)
│   │   │   ├── routes.py           # HTTP routes
│   │   │   ├── sockets/            # Socket.IO event handlers
│   │   │   ├── tree_graph/         # ARG/tree data structures
│   │   │   ├── metadata/           # Metadata parsing
│   │   │   ├── config/             # Configuration
│   │   │   └── cloud/              # GCS integration
│   │   └── tests/
│   │       ├── unit/               # pytest unit tests
│   │       ├── integration/        # Integration tests
│   │       └── load/               # Locust load tests
│   │
│   ├── website/        # React frontend (Vite + Tailwind)
│   │   ├── src/
│   │   │   ├── components/         # Page-level components
│   │   │   └── ...
│   │   └── e2e/                    # Playwright E2E tests
│   │
│   ├── core/           # Shared React components and visualization logic
│   │   └── src/
│   │       ├── components/         # Deck.gl visualization layers
│   │       ├── hooks/              # React hooks (tree data, snapshots)
│   │       └── utils/              # Shared utilities
│   │
│   └── app/            # Pip-installable single-port distribution (lorax-arg)
│       ├── lorax_app/              # Python wrapper package
│       └── scripts/                # Build helpers (sync_ui_assets.py)
│
├── docker/             # Docker configuration files
├── scripts/            # Data preprocessing helpers
├── pyproject.toml      # Root Python project config
├── package.json        # Root npm workspace config
└── Dockerfile          # Multi-target Docker build
```

---

## Testing

### Backend Unit Tests (pytest)

```bash
python -m pip install -e ".[dev]"
python -m pytest packages/backend/tests
```

### Frontend Unit Tests (Vitest)

```bash
npm --workspace packages/website run test
```

### End-to-End Tests (Playwright)

E2E tests require a running backend and the 1000Genomes chr2 dataset.

Prerequisites:
- Backend running on `http://127.0.0.1:8080`
- Data file at `/1kg_chr2.trees.tsz`

```bash
# First-time setup (install browsers)
npx playwright install

# Run E2E tests
LORAX_E2E=1 npm --workspace packages/website run test:e2e
```

### Load Tests (Locust)

See [`packages/backend/tests/load/README.md`](packages/backend/tests/load/README.md) for load testing setup and usage.

---

## Build and Release

### Build UI Assets

Build the website with the `/api` base path, then sync into the Python package:

```bash
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
```

### Run from Source Without Copying Assets

```bash
export LORAX_APP_STATIC_DIR=packages/website/dist
python -m pip install -e .
lorax
```

### Clean Build Artifacts

```bash
rm -rf build dist *.egg-info
find packages/app -type d -name __pycache__ -prune -exec rm -rf {} +
```

### Production Build (Bundled UI)

Create and activate the reproducible build environment:

```bash
conda env create -f environment-build.yml
conda activate lorax-build
```

The supported release path is:

```bash
python scripts/build_release.py
```

This requires the `lorax-plugin` repository as a sibling checkout. It builds
the frontend assets, package artifacts, validates metadata, and checks the
wheel contents. The lower-level commands below remain useful while developing.

```bash
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py

python -m pip install -U build
python -m build .
```

Or use the shorthand:

```bash
lorax build
```

### Production Install Verification

```bash
conda create -n lorax-wheel-test python=3.11 pip -c conda-forge
conda activate lorax-wheel-test
python -m pip install dist/lorax_arg-*.whl
python -m pip check
python scripts/smoke_installed_wheel.py
```

### Publish to PyPI

The root `pyproject.toml` always contains the next final version, for example
`0.1.9`. Release automation derives prerelease versions without committing them:

- A push to `main` builds and tests a unique beta such as `0.1.9b123`. The beta
  remains a downloadable GitHub Actions artifact and is not uploaded to PyPI.
- A matching tag such as `v0.1.9` builds `0.1.9`, runs clean-wheel installation
  tests on Python 3.10–3.13, and publishes to PyPI only if all tests pass.
- A release tag must point to a commit contained in `main`, and its version must
  exactly match the version in `pyproject.toml`.

Python package indexes normalize prerelease spelling, so use `0.1.9b123` rather
than `0.1.9-beta`. Reusing a single beta version would also fail because package
index versions are immutable.

Before the first automated release, configure PyPI Trusted Publishing for:

- Repository: `pratikkatte/lorax`
- Workflow: `wheel.yml`
- GitHub environment: `pypi`

Protect the `pypi` GitHub environment with required reviewers if you want a
manual approval checkpoint after the tag tests pass and before upload.

To release the final version after the beta artifact has been tested:

```bash
git tag v0.1.9
git push origin v0.1.9
```

For manual artifact inspection, build fresh artifacts locally:

```bash
rm -rf build dist *.egg-info
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
python -m pip install -U build twine
python -m build .
```

---

## Code Style and Conventions

- **Python**: Follow PEP 8. Use type hints where practical.
- **JavaScript/React**: Standard ESLint configuration is included in the workspace.
- **Commits**: Write clear, concise commit messages describing what changed and why.

---

## Submitting Changes

1. **Fork** the repository on GitHub.
2. **Create a branch** from `main`:
   ```bash
   git checkout -b your-feature-name
   ```
3. **Make your changes** and ensure tests pass:
   ```bash
   pytest                                       # Backend tests
   npm --workspace packages/website run test     # Frontend tests
   ```
4. **Commit** your changes with a clear message.
5. **Push** to your fork and open a **Pull Request** against `main`.

Please include in your PR description:
- What the change does
- Why the change is needed
- How to test it
