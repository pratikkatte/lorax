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

### Load testing

Use the asynchronous load-testing helper to simulate concurrent clients hitting the Lorax backend:

```bash
python load_test.py --base-url http://localhost:8080 --users 50 --requests-per-user 20 --concurrency 15
```

Flags:

* `--base-url` – service root to target (defaults to `http://localhost:8080`).
* `--users` – total virtual users to simulate.
* `--requests-per-user` – number of requests each user makes after session initialization.
* `--concurrency` – maximum number of users running at once.
* `--timeout` – per-request timeout in seconds.
* `--socket-queries` – how many websocket queries to emit per user (also exercises `handle_query`).
* `--project`/`--filename` – which dataset to load via the Socket.IO `load_file` event (targets `handle_upload`).
* `--socket-path` – override the Socket.IO path when it differs from `/socket.io`.


---

## Citation

NA
---

## Maintainer

**Pratik Katte**
Department of Biomolecular Engineering & Bioinformatics
University of California, Santa Cruz
[https://pratikkatte.github.io](https://pratikkatte.github.io)
