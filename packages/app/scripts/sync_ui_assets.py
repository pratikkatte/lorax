#!/usr/bin/env python3
"""
Copy the built website assets into the `lorax-app` Python package.

Source:  <repo>/packages/website/dist
Dest:    <repo>/packages/app/lorax_app/static

This is intended for release builds so the resulting wheel is self-contained.
"""

from __future__ import annotations

import shutil
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[3]
    src = repo_root / "packages" / "website" / "dist"
    dest = repo_root / "packages" / "app" / "lorax_app" / "static"

    if not src.exists():
        raise SystemExit(
            f"Website dist not found at: {src}\n\n"
            "Build it first:\n"
            "  npm ci\n"
            "  VITE_API_BASE=/api npm --workspace packages/website run build\n"
        )

    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)

    shutil.copytree(src, dest, dirs_exist_ok=True)
    print(f"Copied UI assets:\n  from: {src}\n  to:   {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

