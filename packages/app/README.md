# lorax-arg

`lorax-arg` is a pip-installable distribution that runs Lorax as a **single-port app**.
It vendors the backend package so the wheel does not depend on a separate `lorax` PyPI release.

- React UI served at `/`
- Backend API served at `/api/*`
- Socket.IO served at `/api/socket.io/`

## Development (monorepo)

This package can run against the backend Python distribution `lorax` (from `packages/backend/`) during development.

### Build + sync UI assets (for wheel builds)

Build the website with `VITE_API_BASE=/api`, then copy the `dist/` output into the Python package:

```bash
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
```

### Run from source without copying assets

```bash
export LORAX_APP_STATIC_DIR=packages/website/dist
python -m pip install -e packages/backend
python -m pip install -e packages/app
lorax-arg
```

## Clean (remove build artifacts)

```bash
rm -rf packages/app/build packages/app/dist packages/app/*.egg-info packages/app/lorax
find packages/app -type d -name __pycache__ -prune -exec rm -rf {} +
```

## Production build (bundled UI)

Build the UI and bundle it into the Python package, then build the wheel/sdist:

```bash
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
python packages/app/scripts/sync_backend_vendor.py

python -m pip install -U build
python -m build packages/app
```

## Production install

Install the built wheel locally (recommended for production verification):

```bash
python -m pip install --force-reinstall dist/lorax_arg-*.whl
lorax-arg
```

## Publish online (PyPI)

1) Update `version` in `packages/app/pyproject.toml`.
2) Build fresh artifacts:

```bash
rm -rf packages/app/build packages/app/dist packages/app/*.egg-info
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
python packages/app/scripts/sync_backend_vendor.py
python -m pip install -U build twine
python -m build packages/app
```

3) Upload to TestPyPI (recommended), then PyPI:

```bash
python -m twine upload --repository testpypi dist/*
# verify: python -m pip install -i https://test.pypi.org/simple lorax-arg
python -m twine upload dist/*
```

Notes:
- You need PyPI credentials (or a token) configured in `~/.pypirc` or via `TWINE_USERNAME`/`TWINE_PASSWORD`.
- Keep `README.md` and metadata in sync with what you want on PyPI.
