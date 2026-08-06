#!/usr/bin/env python3
"""Select and validate the package version used by release automation."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PYPROJECT = REPO_ROOT / "pyproject.toml"
VERSION_LINE = re.compile(r'(?m)^(version\s*=\s*")([^"]+)("\s*)$')
FINAL_VERSION = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")


def read_version() -> str:
    match = VERSION_LINE.search(PYPROJECT.read_text())
    if match is None:
        raise SystemExit("Could not find project.version in pyproject.toml")
    return match.group(2)


def write_version(version: str) -> None:
    contents = PYPROJECT.read_text()
    updated, count = VERSION_LINE.subn(rf"\g<1>{version}\g<3>", contents, count=1)
    if count != 1:
        raise SystemExit("Could not update project.version in pyproject.toml")
    PYPROJECT.write_text(updated)


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("show")

    beta = subparsers.add_parser("beta")
    beta.add_argument("--serial", required=True, type=int)

    final = subparsers.add_parser("final")
    final.add_argument("--tag", required=True)

    args = parser.parse_args()
    base_version = read_version()
    if not FINAL_VERSION.fullmatch(base_version):
        raise SystemExit(
            "pyproject.toml must contain the next final X.Y.Z version; "
            f"found {base_version!r}"
        )

    if args.command == "show":
        selected = base_version
    elif args.command == "beta":
        if args.serial < 1:
            raise SystemExit("Beta serial must be a positive integer")
        selected = f"{base_version}b{args.serial}"
        write_version(selected)
    else:
        tag_version = args.tag.removeprefix("v")
        if tag_version != base_version:
            raise SystemExit(
                f"Tag {args.tag!r} does not match pyproject version {base_version!r}. "
                f"Use tag v{base_version}."
            )
        selected = base_version

    print(selected)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
