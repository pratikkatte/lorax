#!/usr/bin/env python3
"""Publish a CSR artifact under its original dataset name."""

import argparse
import contextlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with contextlib.redirect_stdout(sys.stderr):
    from lorax.artifacts.publisher import publish_artifact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact_directory", type=Path)
    parser.add_argument("destination", help="gs://bucket/project/original_filename.artifact")
    parser.add_argument("--reuse-from", help="Copy matching files from an earlier temporary upload")
    parser.add_argument("--backend-url", help="Check the hosted dataset and render three trees after publication")
    parser.add_argument("--delete-previous", action="store_true", help="Delete superseded files after a successful hosted load")
    parser.add_argument("--remove-reused-prefix", action="store_true", help="Remove the temporary upload after a successful hosted load")
    parser.add_argument("--workers", type=int, default=16, help="Concurrent file transfers within one chromosome")
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be positive")
    try:
        result = publish_artifact(**vars(args), report=lambda message: print(message, flush=True))
        print(json.dumps(result), flush=True)
        return 0
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
