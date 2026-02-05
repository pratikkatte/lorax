# lorax-arg

**Lorax**—an interactive visualization stack for **ancestral recombination graphs (ARGs)** and **tree sequences** used by genomics and evolutionary biology teams. 

- CLI entrypoint: `lorax` (alias: `lorax-arg`)

## Key features
- Interactive ARG visualization for `.trees` / `.tsz` (tskit) and `.csv` metadata
- GPU-accelerated deck.gl rendering with pan/zoom and genome/time grids
- Single-port deployment: UI + API + websockets on the same origin
- Works for local datasets (simple upload) and lab/server deployments

## Quick start (pip)

```bash
python -m pip install "lorax-arg>=0.1.1"
lorax --port 3000
# open http://localhost:3000
```

From the UI, upload your ARG (`.trees`, `.tsz`) or CSV metadata file. For larger datasets, mount a host directory when running via Docker, or pre-load a file with `lorax --file <path>`.
