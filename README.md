# Lorax

**Interactive visualization and exploration of Ancestral Recombination Graphs (ARGs)**

[![PyPI version](https://img.shields.io/pypi/v/lorax-arg)](https://pypi.org/project/lorax-arg/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue)](https://pypi.org/project/lorax-arg/)

> **Web platform:** [lorax.ucsc.edu](https://lorax.ucsc.edu/) | **Pip package:** [lorax-arg](https://pypi.org/project/lorax-arg/)

![Lorax demo](https://raw.githubusercontent.com/pratikkatte/lorax/main/docs/images/lorax-demo.gif)

## Key Features

- **Scalable rendering** -- Interactive visualization of ARGs at biobank scale using WebGL
- **Genome-wide navigation** -- Traverse genomic coordinates and inspect local genealogies at recombination breakpoints
- **Mutation-aware** -- Trace variant inheritance through local genealogies
- **Metadata integration** -- Filter, color, and subset samples by population labels, phenotypes, or custom annotations
- **Flexible inputs** -- Supports `.trees`, `.trees.tsz` (tskit tree sequences), and CSV-based ARG representations

## Quick Start

### Install with pip (recommended)

```bash
pip install lorax-arg
lorax
```

This opens Lorax in your browser. To load a file directly (preferred for large files):

```bash
lorax --file path/to/your.trees
```

### Run with Docker

```bash
docker pull pratikkatte7/lorax
docker run -it -p 80:80 lorax
```

Then open [http://localhost:80](http://localhost:80) in your browser.

For more installation options (building from source, Docker builds, volume mounting, environment variables), see **[INSTALL.md](INSTALL.md)**.

## Supported Input Formats

| Format | Description |
|---|---|
| `.trees`, `.trees.tsz` | compatible with tskit tree sequences files; `.trees.tsz` is a tszip-compressed variant. |
| `.csv` | One row per recombination interval with genomic position, Newick tree, depth, and optional metadata |

## Use Cases

- Explore signatures of natural selection in local genealogies
- Visualize introgression and admixture across genomic regions
- Trace ancestry of specific samples through population-scale ARGs
- Navigate from GWAS hits or functional annotations to underlying genealogical structure


## Citation

<!-- TODO: Add citation information when available (paper, Zenodo DOI, etc.) -->

If you use Lorax in your research, please cite:

> Lorax: Interactive visualization of Ancestral Recombination Graphs. https://github.com/pratikkatte/lorax

## License

Lorax is released under the [MIT License](LICENSE).

## Maintainer

**Pratik Katte** \
Department of Biomolecular Engineering & Bioinformatics \
University of California, Santa Cruz
