#!/usr/bin/env python3
"""Preprocess a TreeSequence into a random-access Lorax CSR artifact."""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from pathlib import Path

# Permit direct execution from a source checkout without installing a command.
BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
if str(BACKEND_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIRECTORY))

with contextlib.redirect_stdout(sys.stderr):
    from lorax.artifacts.csr_builder import (  # noqa: E402
        DEFAULT_TARGET_SHARD_MB,
        build_csr_artifact,
    )
    from lorax.artifacts.csr_reader import CSRArtifactReader  # noqa: E402


def _positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("value must be at least 1")
    return parsed


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert every genealogy in a .trees or .tsz TreeSequence into "
            "compressed, indexed CSR shards for future Lorax loading."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("input_path", type=Path)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Root directory; the fingerprinted artifact is created beneath it",
    )
    parser.add_argument(
        "--target-shard-mb",
        type=_positive_int,
        default=DEFAULT_TARGET_SHARD_MB,
        help="Approximate uncompressed genealogy bytes grouped per Arrow shard",
    )
    parser.add_argument(
        "--compression",
        choices=("zstd", "lz4", "none"),
        default="zstd",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild and atomically replace an existing artifact",
    )
    parser.add_argument(
        "--no-resume",
        action="store_true",
        help="Discard an interrupted build instead of resuming completed shards",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Hash and validate every output file after the build",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    def report_progress(event: dict) -> None:
        print(json.dumps(event, sort_keys=True), file=sys.stderr, flush=True)

    try:
        result = build_csr_artifact(
            args.input_path,
            args.output_dir,
            target_shard_mb=args.target_shard_mb,
            compression=args.compression,
            force=args.force,
            resume=not args.no_resume,
            progress=report_progress,
        )
        if args.verify:
            with CSRArtifactReader.open(result["artifact_dir"]) as reader:
                result["verification"] = reader.verify()
        print(
            json.dumps(
                {
                    key: value
                    for key, value in result.items()
                    if key != "manifest"
                },
                sort_keys=True,
            )
        )
        return 0
    except Exception as exc:
        print(
            json.dumps(
                {
                    "status": "error",
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
