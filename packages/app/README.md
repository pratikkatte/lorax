# Lorax

Lorax is a web-native platform for real-time, interactive visualization and exploration of population-scale Ancestral Recombination Graphs.

- CLI entrypoint: `lorax` (alias: `lorax-arg`)

![Lorax demo](https://raw.githubusercontent.com/pratikkatte/lorax/main/docs/images/lorax-demo-2.gif)
## Key features
- Scalable rendering: interactive visualization of ARGs at a biobank scale.
- Genome-wide navigation: Traverse genomic coordinates and inspect local genealogies at recombination breakpoints.
- Mutation-aware: Trace variant inheritance through local genealogies
- Metadata integration: Filter, color, and subset samples by population labels, phenotypes, or custom annotations.
- Flexible inputs: Supports .trees, .trees.tsz (tskit tree sequences), and CSV-based ARG representations

## Quick start (pip)

```bash
pip install lorax-arg
lorax # this opens lorax in a browser

lorax --file # to directly load file on lorax (preferred for large files.)
```
Input Formats
Tree sequences: .trees and .trees.tsz files (compatible with tskit/tsinfer/tsdate, Relate, ARGweaver output)
CSV: One row per recombination interval with columns for genomic position, Newick tree string, tree depth, and optional metadata. Ideal for custom inference pipelines or non-model organisms.

## Use Cases
- Explore signatures of natural selection in local genealogies.
- Visualize introgression and admixture across genomic regions. 
- Trace ancestry of specific samples through population-scale ARGs
- Navigate from GWAS hits or functional annotations to underlying genealogical structure

## Links
Web platform: https://lorax.ucsc.edu
Source code: https://github.com/pratikkatte/lorax


