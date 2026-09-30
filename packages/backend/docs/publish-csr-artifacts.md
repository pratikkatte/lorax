# Publish artifacts without changing dataset names

The dataset name and its artifact prefix stay stable across format upgrades:

```
1kg_chr2.trees.tsz
gs://lorax_projects/1000Genomes/1kg_chr2.trees.tsz.artifact/manifest.json
```

The manifest selects the format and the files for the current completed build.
Do not add `_v4` to the dataset name or the artifact prefix. Existing website
and UCSC links continue to work after publication; no backend restart is needed.

## Publish one completed local artifact

Run from the repository root using the existing `gcloud auth login` account:

```bash
LORAX_MODE=local .venv/bin/python -u packages/backend/scripts/publish_csr_artifact.py \
  /Users/pratik/.lorax/projects/1000Genomes/1kg_chr2.trees.tsz.artifact \
  gs://lorax_projects/1000Genomes/1kg_chr2.trees.tsz.artifact \
  --backend-url https://api.lorax.in \
  --delete-previous
```

New files are placed in an immutable `data/<build-hash>/` subdirectory inside
the stable artifact prefix. The publisher updates the shard index paths and
atomically replaces the root manifest only after all files finish transferring.
It checks the manifest generation before replacement to detect competing runs.
The current artifact remains readable throughout the upload.

The hosted load must return the expected format and source fingerprint. The
publisher then renders three trees through the production backend before
removing superseded files. It waits 65 seconds for the reader cache to refresh.
It does not run the expensive full `reader.verify()` pass. Cloud transfer
checksums and ordinary reader validation still apply.

Rerun the same command to resume an interrupted upload or cleanup. Generation
preconditions prevent deleting changed objects. Failed load/render checks restore
the previous manifest when this run changed it, leave the previous data in place,
and stop cleanup. Local artifacts and original
`.trees.tsz` files are retained. Bucket soft-delete retention, if enabled, still
applies to removed cloud objects.

## Migrate an existing temporary `_v4` upload

Add these options to reuse matching uploaded files through cloud-side copies
and remove the temporary prefix after the canonical dataset loads successfully:

```bash
--reuse-from gs://lorax_projects/1000Genomes/1kg_chr2_v4.trees.tsz.artifact \
--remove-reused-prefix
```

This also handles partial uploads. Missing files are uploaded from the local
artifact. The final dataset and storage prefix have no version suffix.

## Publish completed chromosomes one at a time

```bash
caffeinate -i bash <<'BASH'
set -euo pipefail
cd /Users/pratik/Documents/work/lorax/lorax
export LORAX_MODE=local
CHR_ROOT=/Users/pratik/.lorax/projects/1000Genomes
mkdir -p "$CHR_ROOT/publish-logs"

for CHR_NUMBER in {1..22}; do
  CHR_NAME="1kg_chr${CHR_NUMBER}.trees.tsz"
  CHR_LOCAL="$CHR_ROOT/$CHR_NAME.artifact"
  if [[ ! -f "$CHR_LOCAL/manifest.json" ]]; then
    echo "Skipping chromosome $CHR_NUMBER: build not complete"
    continue
  fi

  .venv/bin/python -u packages/backend/scripts/publish_csr_artifact.py \
    "$CHR_LOCAL" "gs://lorax_projects/1000Genomes/$CHR_NAME.artifact" \
    --backend-url https://api.lorax.in \
    --delete-previous \
    2>&1 | tee -a "$CHR_ROOT/publish-logs/chr${CHR_NUMBER}.log"
done
BASH
```

Stop any older upload loop before running this command. For a one-time migration
of temporary uploads, use the separate migration options described above.

## Confirm the hosted dataset

Open the original URL, for example:

[Chromosome 2 at the requested coordinates](https://lorax.ucsc.edu/view/1kg_chr2.trees.tsz?project=1000Genomes&genomiccoordstart=109439718&genomiccoordend=133759656).

Its `load_file` response must contain `config.artifact_format: lorax-csr-v4`.
The production `/memory_status` registry should include the canonical artifact
prefix. Global counters alone do not identify a particular browser session.
