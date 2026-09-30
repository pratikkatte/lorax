# CSR loading and compaction validation — 2026-09-28

## Implemented

- Startup indexes are checksum-verified and decoded from the same download.
- Resolution passes its manifest and GCS object metadata to the reader.
- Session contexts avoid network access until their 60-second revalidation;
  changed manifest generations invalidate readers even when the source hash
  and manifest contents are unchanged.
- GCS uses generation-pinned objects, a 32 MiB byte-range LRU, 256 KiB
  read-ahead, and coalesced larger reads. Decoded genealogy batches have a
  separate 32 MiB LRU. Feature sidecars are checked on first use.
- Opt-in v4 batches contain 32 consecutive trees with every existing field.
  Random access, partial final batches, build checkpoints, verification,
  feature services, and sessions support v4. v3 remains the build default;
  v2/v3 and existing Phlag v2 artifacts remain readable.
- The production VM startup script now enables artifacts by default, with
  an instance metadata override. `/memory_status` reports the enablement flag.

## Direct cloud-reader measurements

Dataset: `gs://lorax_projects/1000Genomes/1kg_chr2.trees.tsz.artifact`.
The published v3 manifest matches the local chromosome 2 backup. It contains
2,119,205 trees and 1,030 genealogy shards; the local directory totals
193,940,455,803 bytes.

| Measurement | Before | Updated reader |
| --- | --- | --- |
| Startup requests | 29 | 4 |
| Startup transfer | 34.2 MB | 17,087,345 bytes |
| Startup elapsed | 7.005 seconds, one run | 1.120–3.428 seconds, three runs; median 1.191 |
| First tree transfer | 4.26 MB | 341,858 bytes, plus object metadata |
| Revisit tree 0 after tree 1 | 4,194,305 bytes downloaded | No network requests |
| Revisit elapsed | 0.389 seconds | 0.0010–0.0017 seconds |

The updated reader meets the requested startup budget of less than 18 MB and
at most eight requests. These are measurements from this machine using fresh
readers, not browser page-load measurements or a controlled network benchmark.
The SDK operation counters do not separately count automatic retry attempts.

The benchmark separates startup, tree reading, and render serialization. In
the three updated runs, reading tree 0 took 0.228–0.364 seconds and serializing
it took 0.0008–0.0016 seconds. Reading distant tree 1,000,000 took
0.234–0.332 seconds and transferred 492,930 bytes plus object metadata.

## Lossless compaction sample

The reproducible comparison samples 64 adjacent trees near the midpoint of
each of eight evenly distributed shards, for 512 trees total. Every decoded
field, including mutation data and unknown mutation times, matched after
regrouping. It does not rewrite the existing artifact.

| Trees per compressed batch | Sample bytes | Reduction |
| --- | ---: | ---: |
| 1 | 45,815,240 | — |
| 8 | 11,453,560 | 75.0% |
| 16 | 8,490,632 | 81.5% |
| 32 | 7,029,520 | 84.7% |
| 64 | 6,399,904 | 86.0% |

These figures are sampled IPC sizes, not a full rebuilt dataset or a claim of
equivalent cloud latency reduction.

## Tests

The 83 artifact/compaction/height-normalization unit cases and six selected
socket integration cases pass. Coverage includes v2/v3/v4, serial and parallel
v4 builds, command-line verification, resumed builds, batch/shard boundaries,
partial batches, random/repeated navigation, render parity, metadata,
mutations, lineage, source-free feature access, integrity checks, generation
changes, and bounded cache eviction.

Broader related unit checks passed 106 cases with one existing failure:
`test_legacy_artifact_decode_normalizes_children_layout_and_mutation_x`
omits the required `normalize_tree_heights` argument. A broader socket run
also exposed three existing failures: `test_connect_with_expired_session`,
`test_load_file_missing_file_param_returns_terminal_failure`, and
`test_load_file_missing_file_returns_terminal_failure`. All four were
reproduced against an isolated copy of unchanged HEAD.

The production startup script passes `bash -n`; the patch passes
`git diff --check`.

## Hosted verification and remaining rollout

A live `load_file` request to `https://api.lorax.in` for chromosome 2 succeeded
in 9.281 seconds but returned `interval_source: inline` and no
`artifact_format`. The backend subsequently reported zero artifact contexts
and no artifact counters. The hosted dataset is currently using the legacy
source path, despite the healthy artifact in the public bucket. The previous
VM startup script did not set `LORAX_CSR_ARTIFACTS_ENABLED`, whose application
default is false.

No production deployment has been performed:

- Google Cloud rejected the read-only instance lookup because the configured
  credentials require interactive reauthentication (`gcloud auth login`).
- The initial free space (8.3 GiB, later approximately 10 GiB) was insufficient
  to retain both complete local artifacts. After explicit approval, local
  chromosome 2 was converted by deleting each old shard only after verifying
  and durably checkpointing its replacement. The original tree sequence and
  the existing cloud v3 artifact remain unchanged.

After restoring cloud authentication, release the reader with artifact
loading enabled. Publish the validated v4 artifact under a separate test
dataset name and confirm the hosted `load_file` response advertises
`lorax-csr-v4`. The [production command guide](publish-chr2-v4.md) includes
backend deployment, manifest-last upload, and testing. The existing cloud
v3 artifact remains available for comparison and rollback. The first v4
rollout does not convert Phlag artifacts.

## Reproduce

### Local artifact conversion

The resumable converter reuses the existing v3 trees, layout, and feature
indexes instead of recomputing them from the tree sequence. It compares every
decoded field, including floating-point bytes and missing mutation times,
before checkpointing each shard. A final reader verification precedes publishing.
The original artifact is preserved by default:

```sh
PYTHONPATH=packages/backend LORAX_MODE=local .venv/bin/python \
  packages/backend/scripts/compact_csr_artifact.py \
  /path/to/1kg_chr2.trees.tsz.artifact_bkp \
  /path/to/1kg_chr2.trees.tsz.artifact \
  --source-file /path/to/1kg_chr2.trees.tsz --workers 4
```

Repeat the same command after an interruption. Its sibling
`.artifact.compacting` directory retains durable checksummed progress. The
destination must not already exist. The original source file is hashed before
refreshing its discovery metadata; this handles a moved source with unchanged
content but a different modification time.

For a deliberately destructive migration with limited disk space, the separate
`--remove-verified-source-shards` option deletes each original shard only after
its verified replacement and checksum checkpoint are flushed to disk. This
makes the old local artifact incomplete, including during conversion. It must
not be used on an artifact serving active readers. Original source files and
feature indexes are preserved. A corrupted completed output on resume stops
the conversion instead of deleting its remaining original.

Local chromosome 2 pilot: the complete first shard (2,527 trees) decreased from
213,989,218 to 30,577,290 bytes (85.71% smaller), with all decoded fields equal.
The pilot lives in `~/.lorax/validation/chr2-v4-pilot`.

Full local conversion completed after approval to remove verified old shards:

| Measurement | Result |
| --- | --- |
| Trees compared field by field | 2,119,205 |
| Shards converted and verified | 1,030 |
| Original artifact data and indexes | 193,940,451,954 bytes |
| v4 artifact data and indexes | 27,307,144,154 bytes |
| Full-dataset reduction | 85.9198% |
| Conversion plus full reader verification | 1,124 seconds |
| Cloud v3 versus local v4 rendering | 112 render comparisons across 14 trees passed |
| Lineage and sampled node/site/individual/population metadata | Matched |
| Original `.trees.tsz` fingerprint | Unchanged |
| Local artifact discovery | Resolves `lorax-csr-v4` |

The complete artifact is now at
`~/.lorax/projects/1000Genomes/1kg_chr2.trees.tsz.artifact`. The old
`.artifact_bkp` directory retains its manifest/indexes for audit but no longer
contains genealogy shards. `MIGRATED-TO-V4.txt` records this explicitly.
Approximately 165 GiB was free after conversion. Reports are saved at
`~/.lorax/validation/chr2-v4-conversion-result.json` and
`~/.lorax/validation/chr2-v4-parity-result.json`. The 14-tree comparison covers
batch/shard boundaries, distant and final trees, linear/log scales, normalized
heights, and sparsification; every genealogy's raw decoded fields were also
compared during compaction. Cloud upload and production deployment are still
pending.

### Reader benchmarks

From the repository root:

```sh
PYTHONPATH=packages/backend LORAX_MODE=local .venv/bin/python \
  packages/backend/scripts/benchmark_csr_artifact.py \
  gs://lorax_projects/1000Genomes/1kg_chr2.trees.tsz.artifact \
  --trees 0,1,0,1000000 --repeats 3

PYTHONPATH=packages/backend LORAX_MODE=local .venv/bin/python \
  packages/backend/scripts/benchmark_csr_artifact.py \
  /path/to/1kg_chr2.trees.tsz.artifact \
  --compare-grouping --repeats 1
```
