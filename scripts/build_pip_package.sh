#!/usr/bin/env sh
# Build the website, JBrowse assets, Lorax plugin, and self-contained PyPI artifacts.
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

if [ -n "${PYTHON_BIN:-}" ]; then
  python_bin=$PYTHON_BIN
elif [ -x .venv/bin/python ]; then
  python_bin=.venv/bin/python
else
  python_bin=python3
fi

if ! "$python_bin" -c 'import sys, tomllib; assert sys.version_info >= (3, 11)' >/dev/null 2>&1; then
  echo "A Python 3.11+ build environment is required." >&2
  echo "Create the documented lorax-build environment, or set PYTHON_BIN to its Python executable." >&2
  exit 1
fi

exec "$python_bin" scripts/build_release.py "$@"
