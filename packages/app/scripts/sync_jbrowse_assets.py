#!/usr/bin/env python3
"""
Build and bundle JBrowse Web + the Lorax plugin into the lorax_app package.

Outputs:
  packages/app/lorax_app/static/jbrowse/   — JBrowse Web static app
  packages/app/lorax_app/static/lorax-plugin.js — built plugin UMD bundle

Run this once before cutting a release, after sync_ui_assets.py:
  cd lorax_main
  python packages/app/scripts/sync_jbrowse_assets.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# Pin to the same major JBrowse version used by the plugin's @jbrowse/core dep.
JBROWSE_TAG = "v2.12.3"

REPO_ROOT = Path(__file__).resolve().parents[3]
PLUGIN_DIR = REPO_ROOT.parent / "lorax-plugin"
STATIC_DIR = REPO_ROOT / "packages" / "app" / "lorax_app" / "static"
JBROWSE_STATIC_DEST = STATIC_DIR / "jbrowse"
PLUGIN_BUNDLE_DEST = STATIC_DIR / "lorax-plugin.js"


def _get_jbrowse_tag() -> str:
    """
    Read the @jbrowse/core version installed in lorax-plugin/node_modules
    and use it as the JBrowse Web tag. This keeps the JBrowse Web app
    version in lock-step with the version the plugin was compiled against.
    """
    import json
    pkg = PLUGIN_DIR / "node_modules" / "@jbrowse" / "core" / "package.json"
    if pkg.exists():
        version = json.loads(pkg.read_text())["version"]
        print(f"Detected @jbrowse/core version: {version}")
        return f"v{version}"
    # Fallback: use the hardcoded tag
    fallback = JBROWSE_TAG
    print(f"Warning: could not detect @jbrowse/core version, using fallback {fallback}")
    return fallback


JBROWSE_TAG = "v2.12.3"  # fallback; overridden at runtime by _get_jbrowse_tag()


def run(cmd: list[str], cwd: Path, env: dict | None = None) -> None:
    import os
    merged_env = {**os.environ, **(env or {})}
    print(f"\n$ {' '.join(cmd)}  (cwd={cwd})")
    if env:
        print(f"  env overrides: {env}")
    result = subprocess.run(cmd, cwd=cwd, env=merged_env)
    if result.returncode != 0:
        sys.exit(result.returncode)


def build_plugin() -> Path:
    if not PLUGIN_DIR.exists():
        sys.exit(
            f"lorax-plugin directory not found at: {PLUGIN_DIR}\n"
            "Expected it to be a sibling of lorax_main."
        )
    # NODE_ENV=production ensures replaceProcessEnv() bakes in isProd=true,
    # so useSocket() chooses /api/socket.io/ (the pip single-server path)
    # rather than the Vite dev-proxy path /socket.io/.
    run(["npm", "run", "build"], cwd=PLUGIN_DIR, env={"NODE_ENV": "production"})
    bundle = PLUGIN_DIR / "dist" / "jbrowse-plugin-lorax.umd.development.js"
    if not bundle.exists():
        sys.exit(f"Plugin bundle not found after build: {bundle}")
    return bundle


def download_jbrowse(dest: Path) -> None:
    tag = _get_jbrowse_tag()
    ver = tag.lstrip("v")
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp) / "jbrowse"
        run(
            ["npx", "--yes", f"@jbrowse/cli@{ver}", "create",
             str(tmp_path), "--tag", tag],
            cwd=Path(tmp),
        )
        if dest.exists():
            shutil.rmtree(dest)
        # Remove config.json — it is served dynamically by the FastAPI app
        config = tmp_path / "config.json"
        if config.exists():
            config.unlink()
        shutil.copytree(tmp_path, dest)


def main() -> int:
    print("=== Building lorax-plugin bundle ===")
    bundle = build_plugin()
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(bundle, PLUGIN_BUNDLE_DEST)
    print(f"Plugin bundle copied to: {PLUGIN_BUNDLE_DEST}")

    print(f"\n=== Downloading JBrowse Web (version matched to @jbrowse/core) ===")
    download_jbrowse(JBROWSE_STATIC_DEST)
    print(f"JBrowse assets written to: {JBROWSE_STATIC_DEST}")

    print("\nDone. You can now build the wheel:\n  python -m build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
