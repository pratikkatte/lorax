# Contributing (build & release)

This guide documents the build, packaging, and publish steps for `lorax-arg` within the monorepo.

## Build + sync UI assets (for wheel builds)

Build the website with `VITE_API_BASE=/api`, then copy the `dist/` output into the Python package:

```bash
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
```

## Run from source without copying assets

```bash
export LORAX_APP_STATIC_DIR=packages/website/dist
python -m pip install -e .
lorax
```

## Clean (remove build artifacts)

```bash
rm -rf build dist *.egg-info
find packages/app -type d -name __pycache__ -prune -exec rm -rf {} +
```

## Production build (bundled UI)

Build the UI and bundle it into the Python package, then build the wheel/sdist:

```bash
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py

python -m pip install -U build
python -m build .
```

You can also run:

```bash
lorax build
```

## Production install

Install the built wheel locally (recommended for production verification):

```bash
python -m pip install --force-reinstall dist/lorax_arg-*.whl
lorax
```

## Publish online (PyPI)

1) Update `version` in the repo-root `pyproject.toml`.
2) Build fresh artifacts:

```bash
rm -rf build dist *.egg-info
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
python -m pip install -U build twine
python -m build .
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
