# 🧬 Lorax: Visualization Framework for Ancestral Recombination Graphs

**Lorax** is an interactive, GPU-accelerated platform for exploring Ancestral Recombination Graphs (ARGs) and **tree sequence data. It provides real-time visualization and querying of genomic relationships at population scale.

---

## Features

* Tree-sequence visualization: Explore recombination-aware local trees.
* GPU-accelerated rendering: Powered by WebGL and Deck.gl.
* Real-time updates: WebSocket-based communication via Socket.IO.
* Flexible data formats: Supports `.trees`, `.tsz`, and `.jsonl` formats.
* Scalable backend: Async FastAPI with Redis-based session handling.

---

## Installation with Docker

### Clone the Repository

```bash
git clone https://github.com/pratikkatte/lorax.git
cd lorax
```

### Build the Docker Image

```bash
docker build -t lorax .
```

### Run the Container

```bash
docker run -it -p 80:80 lorax
```

Once running, visit **[http://localhost/](http://localhost/)** in your browser to access the Lorax UI.


---

## Citation

NA
---

## Maintainer

**Pratik Katte**
Department of Biomolecular Engineering & Bioinformatics
University of California, Santa Cruz
[https://pratikkatte.github.io](https://pratikkatte.github.io)
