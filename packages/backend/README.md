# Lorax Backend

The Lorax backend server for tree visualization and analysis.

## Installation

```bash
cd packages/backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the backend package
pip install -e .

# For production with gunicorn support:
pip install -e ".[prod]"
```

## Usage

### Start the Backend Server

```bash
# Development mode (with auto-reload)
lorax serve --reload

# Or specify host/port
lorax serve --host 0.0.0.0 --port 8080 --reload

LORAX_MODE=local lorax serve --reload

# Production mode (gunicorn + uvicorn worker class)
python -m gunicorn -c packages/backend/gunicorn_config.py lorax.lorax_app:sio_app

# Override worker count at runtime (default: min(4, max(2, cpu_cores)))
WEB_CONCURRENCY=3 python -m gunicorn -c packages/backend/gunicorn_config.py lorax.lorax_app:sio_app
```

### Use Preprocessed CSR Artifacts

CSR artifacts are an opt-in, preprocessed representation of a `.trees` or
`.trees.tsz` source file. When available, Lorax discovers an adjacent artifact
directory named `<source-file>.artifact` and uses it for supported operations.

Enable artifact-backed loading during local development:

```bash
LORAX_MODE=local LORAX_CSR_ARTIFACTS_ENABLED=1 \
  lorax-backend serve --host 127.0.0.1 --port 8080 --reload
```

For example, the artifact for
`~/.lorax/projects/1000Genomes/1kg_chr2.trees.tsz` is stored at
`~/.lorax/projects/1000Genomes/1kg_chr2.trees.tsz.artifact/`.

If `LORAX_CSR_ARTIFACTS_ENABLED` is unset, it defaults to `false` in local and
development modes and `true` in production. In legacy mode, messages such as
`Using cached FileContext: ...` are expected and do not indicate that the
artifact is being read.

#### Read CSR Artifacts Directly From GCS

The backend can also open an adjacent artifact prefix in GCS without first
downloading the source or artifact directory. For a source object at
`gs://my-bucket/Example/data.trees`, the artifact must use this layout:

```text
gs://my-bucket/Example/data.trees  # optional once the artifact is published
gs://my-bucket/Example/data.trees.artifact/manifest.json
gs://my-bucket/Example/data.trees.artifact/breakpoints.npy
gs://my-bucket/Example/data.trees.artifact/shards.arrow
gs://my-bucket/Example/data.trees.artifact/<other indexes and shards>
```

An artifact-only prefix is listed in the frontend as the logical
`Example/data.trees` dataset. In-progress and obsolete artifact prefixes are
not listed.

Public artifacts are read anonymously by default, so no Google login or local
credentials are required. Test the artifact reader directly:

```bash
./.venv/bin/python packages/backend/scripts/smoke_gcs_artifact.py \
  gs://my-bucket/Example/data.trees.artifact --tree-index 0
```

Start the local backend against the same bucket:

```bash
LORAX_MODE=local \
GCS_BUCKET_NAME=my-bucket \
LORAX_CSR_ARTIFACTS_ENABLED=1 \
lorax-backend serve --host 127.0.0.1 --port 8080 --reload
```

The frontend API is unchanged. The backend loads small indexes once and uses
seekable GCS reads for the Arrow shard needed by a viewport. The range-read
chunk size defaults to 256 KiB and can be changed with
`LORAX_GCS_ARTIFACT_CHUNK_BYTES` (rounded down to a 256 KiB multiple).
Cloud byte ranges and decoded genealogy batches each have a separate 32 MiB
LRU limit per reader. Startup indexes are downloaded and checksum-verified
once; feature sidecars are checked when first used. `--verify` still hashes
every file and checks all genealogy batches. Session contexts revalidate their
manifest every 60 seconds and discard caches when the manifest generation changes.

The production VM startup script enables artifact loading by default. Set the
instance metadata `LORAX_CSR_ARTIFACTS_ENABLED=0` to opt out. Check
`/memory_status` → `csr_artifacts.enabled` and the `load_file` response's
`config.artifact_format` to distinguish an artifact load from a source fallback.

#### Opt into compact v4 artifacts

The default builder format remains v3. v4 keeps the same genealogy fields and
feature sidecars but compresses 32 consecutive trees per Arrow record batch.
v2/v3 remain readable, including existing Phlag v2 datasets. The v4 manifest
records `build.trees_per_batch: 32`; `shards.arrow.batch_count` counts batches,
not trees. Only the final batch within each shard may contain fewer than 32
trees. Format/group size are part of resumable build compatibility.

```bash
./.venv/bin/python packages/backend/scripts/preprocess_treesequence_csr.py \
  /path/to/staging/data.trees.tsz --format-version 4 --workers 4
```

For a staged migration, copy or hard-link the source into a separate staging
directory and build there. Do not use `--force` on the currently served artifact.
Keep the source and completed staging artifact together until publication.
Deploy reader support first, then publish at the existing `<source>.artifact`
prefix with `scripts/publish_csr_artifact.py`. Dataset names and URLs do not
change with the storage format. The publisher switches the manifest only after
all new files are present, checks a hosted load and render, and can delete the
superseded files after success. See [stable artifact publication](docs/publish-csr-artifacts.md)
for sequential chromosome uploads and migration of temporary `_v4` prefixes.
Budget space for both builds during publication: sampled compression savings
are not a full-artifact size guarantee.

Measure startup, tree reads, rendering, and repeat navigation separately:

```bash
./.venv/bin/python packages/backend/scripts/benchmark_csr_artifact.py \
  gs://my-bucket/Example/data.trees.artifact --trees 0,1,0 --repeats 3
./.venv/bin/python packages/backend/scripts/benchmark_csr_artifact.py \
  /path/to/data.trees.artifact --compare-grouping --repeats 1
```

The grouping comparison samples up to 512 trees across eight shards, verifies
all decoded fields, and never rewrites the source artifact. Metrics under
`csr_artifacts.metrics` include `storage.requests`, `storage.transferred_bytes`,
`range_cache.*`, and `batch_cache.*`. Request counters count SDK operations;
automatic SDK retry attempts are not counted separately. Timings describe a
fresh reader in the benchmark process, not browser page-load time.

For a private bucket, opt into Application Default Credentials explicitly:

```bash
LORAX_GCS_ARTIFACT_AUTH=authenticated \
  ./.venv/bin/python packages/backend/scripts/smoke_gcs_artifact.py \
  gs://my-private-bucket/Example/data.trees.artifact
```

### Load-File Backpressure

`load_file` uses a bounded queue and worker slots to prevent CPU-heavy loads from
starving socket responsiveness.

```bash
# Defaults shown
LORAX_LOAD_FILE_MAX_CONCURRENCY=1
LORAX_LOAD_FILE_MAX_QUEUE=8
LORAX_LOAD_FILE_QUEUE_TIMEOUT_SEC=30
```

### Session And Tree Cache TTLs

The backend uses in-memory session and tree-graph caches. Defaults are 1 hour
idle TTL with periodic opportunistic cleanup.

```bash
# Defaults shown
LORAX_COOKIE_MAX_AGE_SEC=3600
LORAX_INMEM_TTL_SEC=3600
LORAX_CACHE_CLEANUP_INTERVAL_SEC=60
```

### Available Commands

```bash
# Show help
lorax --help

# Show serve command help
lorax serve --help

# Show version
lorax --version
```

## Development

```bash
# Run from the repository root and install with dev dependencies
python -m pip install -e ".[dev]"

# Run tests
python -m pytest packages/backend/tests
```

## Project Structure

```
packages/backend/
├── pyproject.toml          # Package configuration
├── gunicorn_config.py      # Gunicorn configuration
├── README.md               # This file
├── requirements.txt        # Minimal legacy runtime list; root pyproject is canonical
└── lorax/                  # Main package
    ├── cli.py              # CLI commands
    ├── lorax_app.py        # FastAPI + Socket.IO app
    ├── routes.py           # HTTP routes
    ├── sockets.py          # Socket.IO events
    ├── handlers.py         # Request handlers
    ├── session_manager.py  # Session management
    ├── manager.py          # Resource management
    ├── context.py          # App context
    ├── utils.py            # Utilities
    ├── config/             # Configuration
    ├── cloud/              # Cloud utilities
    ├── metadata/           # Metadata handling
    ├── tree_graph/         # Tree graph utilities
    └── viz/                # Visualization
```
