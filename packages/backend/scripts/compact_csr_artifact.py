#!/usr/bin/env python3
"""Losslessly convert a local v3 artifact into v4, resuming interruptions."""

import argparse
import contextlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with contextlib.redirect_stdout(sys.stderr):
    from lorax.artifacts.csr_compactor import compact_csr_artifact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_artifact")
    parser.add_argument("destination")
    parser.add_argument("--source-file", help="Verify the original source SHA256 and refresh its discovery metadata")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--remove-verified-source-shards", action="store_true",
                        help="DELETE old shards after verified, durable replacements; leaves the old artifact incomplete")
    args = parser.parse_args()
    result = compact_csr_artifact(
        args.source_artifact, args.destination, source_file=args.source_file, workers=args.workers,
        remove_verified_source_shards=args.remove_verified_source_shards,
        progress=lambda event: print(json.dumps(event), flush=True),
    )
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
