#!/usr/bin/env python3
"""Validate release-wheel metadata and required bundled files."""

from __future__ import annotations

import argparse
import email
import re
import zipfile
from pathlib import Path


REQUIRED_FILES = (
    "lorax/cli.py",
    "lorax_app/__init__.py",
    "lorax_app/static/index.html",
)


def referenced_static_files(index_html: bytes) -> set[str]:
    """Return package-relative local assets referenced by the SPA entry page."""
    text = index_html.decode("utf-8")
    return {
        f"lorax_app/static/{path}"
        for path in re.findall(r'''(?:src|href)=["']/([^"'#?]+)''', text)
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("wheel", type=Path)
    args = parser.parse_args()

    with zipfile.ZipFile(args.wheel) as archive:
        names = set(archive.namelist())
        missing = [path for path in REQUIRED_FILES if path not in names]
        if missing:
            raise SystemExit(f"Wheel is missing required files: {', '.join(missing)}")

        index_html = archive.read("lorax_app/static/index.html")
        missing_assets = sorted(referenced_static_files(index_html) - names)
        if missing_assets:
            raise SystemExit(
                "Wheel index.html references missing static files: "
                + ", ".join(missing_assets)
            )

        metadata_paths = [name for name in names if name.endswith(".dist-info/METADATA")]
        if len(metadata_paths) != 1:
            raise SystemExit("Wheel must contain exactly one METADATA file")
        metadata = email.message_from_bytes(archive.read(metadata_paths[0]))

    if metadata["Name"] != "lorax-arg":
        raise SystemExit(f"Unexpected project name: {metadata['Name']!r}")
    if metadata["Requires-Python"] not in {">=3.10,<3.14", "<3.14,>=3.10"}:
        raise SystemExit(f"Unexpected Python range: {metadata['Requires-Python']!r}")

    requirements = metadata.get_all("Requires-Dist", [])
    required_constraints = ("numpy<2.4,>=2.0", "numba<0.63,>=0.61", "pandas<3,>=2.0")
    for constraint in required_constraints:
        if not any(requirement.replace(" ", "").startswith(constraint) for requirement in requirements):
            raise SystemExit(f"Wheel metadata is missing constraint: {constraint}")

    print(f"Wheel validation passed: {args.wheel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
