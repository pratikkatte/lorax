#!/usr/bin/env python3
"""Open one GCS CSR artifact and fetch a tree through the production reader."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from lorax.artifacts.csr_reader import CSRArtifactReader  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Smoke-test seekable reads from a gs://...artifact prefix"
    )
    parser.add_argument("artifact", help="gs://bucket/project/file.artifact")
    parser.add_argument("--tree-index", type=int, default=0)
    args = parser.parse_args()

    with CSRArtifactReader.open(args.artifact, max_open_shards=1) as reader:
        genealogy = reader.tree_at_index(args.tree_index)
        result = {
            "ok": True,
            "artifact": reader.artifact_directory,
            "format": reader.format,
            "fingerprint": reader.manifest["fingerprint"],
            "num_trees": reader.num_trees,
            "tree_index": genealogy.tree_index,
            "tree_interval": [
                genealogy.interval_left,
                genealogy.interval_right,
            ],
            "tree_nodes": len(genealogy.node_ids),
        }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
