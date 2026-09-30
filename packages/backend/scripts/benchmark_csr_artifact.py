#!/usr/bin/env python3
"""Measure artifact startup, rendering, navigation, and lossless regrouping.

This benchmark never rewrites an artifact. Grouping comparisons use bounded
in-memory samples; they are not whole-dataset size or cloud-speed predictions.
"""

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with contextlib.redirect_stdout(sys.stderr):
    import numpy as np
    import pyarrow as pa
    from lorax.artifacts.csr_reader import CSRArtifactReader, _decode_genealogy
    from lorax.artifacts.metrics import csr_artifact_metrics
    from lorax.artifacts.render import serialize_csr_genealogies


def timed_stage(name, operation):
    before = csr_artifact_metrics.snapshot()["counters"]
    started = time.perf_counter()
    result = operation()
    elapsed = time.perf_counter() - started
    after = csr_artifact_metrics.snapshot()["counters"]
    counters = {key: value - before.get(key, 0) for key, value in after.items()}
    return result, {
        "stage": name,
        "seconds": round(elapsed, 6),
        "counters": {key: value for key, value in counters.items() if value},
    }


def assert_equal(left, right):
    for field in dataclasses.fields(left):
        a, b = getattr(left, field.name), getattr(right, field.name)
        if isinstance(a, np.ndarray):
            np.testing.assert_array_equal(a, b)
        elif dataclasses.is_dataclass(a):
            assert_equal(a, b)
        else:
            assert a == b, field.name


def compare_grouping(reader):
    if reader.trees_per_batch != 1:
        raise ValueError("Grouping comparison requires a v2 or v3 input")
    totals = {size: 0 for size in (1, 8, 16, 32, 64)}
    checked = 0
    shards = np.unique(np.linspace(0, len(reader._shards) - 1, 8, dtype=int))
    for shard_index in shards:
        shard = reader._shards[shard_index]
        ipc = reader._open_shard(int(shard_index), shard)
        count = min(64, ipc.num_record_batches)
        start = max(0, ipc.num_record_batches // 2 - count // 2)
        rows = [ipc.get_batch(index) for index in range(start, start + count)]
        for group_size in totals:
            output = pa.BufferOutputStream()
            with pa.ipc.new_file(output, rows[0].schema, options=pa.ipc.IpcWriteOptions(compression="zstd")) as writer:
                for offset in range(0, count, group_size):
                    group = pa.Table.from_batches(rows[offset:offset + group_size]).combine_chunks()
                    writer.write_table(group)
            data = output.getvalue()
            totals[group_size] += data.size
            if group_size == 32:
                regrouped = pa.ipc.open_file(data)
                offset = 0
                for batch_index in range(regrouped.num_record_batches):
                    batch = regrouped.get_batch(batch_index)
                    for row in range(batch.num_rows):
                        assert_equal(_decode_genealogy(rows[offset]), _decode_genealogy(batch.slice(row, 1)))
                        checked += 1
                        offset += 1
    return {
        "sampled_trees": checked,
        "sampled_shards": len(shards),
        "all_decoded_fields_equal": True,
        "variants": [
            {"trees_per_batch": size, "compressed_bytes": value,
             "reduction_percent": round(100 * (1 - value / totals[1]), 3)}
            for size, value in totals.items()
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact")
    parser.add_argument("--trees", default="0,1,0", help="Ordered tree indexes, including repeats")
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--compare-grouping", action="store_true")
    args = parser.parse_args()
    if args.repeats < 1:
        parser.error("--repeats must be positive")
    indices = [int(value) for value in args.trees.split(",")]
    report = {"artifact": args.artifact, "runs": []}
    for _ in range(args.repeats):
        reader, opened = timed_stage("cold_reader_open", lambda: CSRArtifactReader(args.artifact))
        with reader:
            run = {"format": reader.format, "stages": [opened]}
            for index in indices:
                tree, read = timed_stage(f"read_tree_{index}", lambda: reader.tree_at_index(index))
                rendered, render = timed_stage(
                    f"render_tree_{index}",
                    lambda: serialize_csr_genealogies(
                        [tree], global_min_time=reader.global_min_time,
                        global_max_time=reader.global_max_time,
                    ),
                )
                render["response_bytes"] = len(rendered["buffer"])
                run["stages"].extend([read, render])
            report["runs"].append(run)
            if args.compare_grouping and "grouping" not in report:
                report["grouping"] = compare_grouping(reader)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
