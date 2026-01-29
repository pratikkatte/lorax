# Lorax

**Lorax** is an essential tool for the **interactive exploration and visualization of Ancestral Recombination Graphs (ARGs)**.

> Visit the official Lorax Website: [https://lorax.in/](https://lorax.in/)

## Local Installation and Usage

### Option 1: Using the Pre-built Docker Image (Recommended)

The simplest way to get started is by pulling the image directly from Docker Hub.

```bash
docker pull pratikkatte7/lorax
```
### Option 2: Building the Docker Image from Source

If you prefer to build the image locally, follow these steps:

1. Clone the Repository
```bash
git clone https://github.com/pratikkatte/lorax.git
cd lorax
```
2. Built the docker image. 

```bash
docker build -t lorax .
```

### Running Lorax and Accessing the Interface

Once the Docker image is available (either pulled or built), you can run the container and access the web interface.

#### Running the Container

Use the following command to run Lorax. It maps the container's internal port 80 to your machine's port 80 (or any other port you specify).

```bash
# Maps container port 80 to host port 80
docker run -it -p 80:80 lorax
```

> ⚠️ Note: If port 80 is in use on your system, you can choose a different host port, such as 5173:
> ```bash
> docker run -it -p 5173:80 lorax
> ```
-- The tool can be accessed via http://localhost:80. You can provide any other port. For instance 5173, http://localhost:5173

### Accessing the Tool

After running the container, open your web browser and navigate to the appropriate address:

- If you used port 80: http://localhost:80/
> If you used other port: http://localhost:[port]/

## Using Your Own ARG Data Files
Lorax supports files in `.trees`, `.tsz` (tskit format) or `.csv` format.

1. Simple File Upload via Web Interface

For smaller files, you can easily use the dedicated upload panel located within the Lorax web page once the tool is running.

2. Mounting a Local Directory (Recommended for Large Datasets)

This method is the easiest and fastest when working with large ARG files, as it avoids slow web uploads by directly sharing your file system with the container.

To make a local directory of your data available inside the container, use the -v (volume mount) flag:

- Example: If your ARG files are located in a folder named ts_files in your current directory (`$(pwd)`), use this command:
> ```
> docker run -it -p 80:80 -v $(pwd)/ts_files:/app/UPLOADS/ts_files lorax
> ```

After the volume is mounted, your files will be accessible by Lorax when you use the interface.

---

## Monorepo Docker (single container, port 3000)

This repo can also be built as a **single container** that includes:
- `packages/backend` (FastAPI + Socket.IO) running internally on `127.0.0.1:8080`
- `packages/website` served by **nginx on port 3000**
- same-origin proxying so the browser only needs **port 3000**

### Build

```bash
docker build -t lorax-monorepo .
```

### Run

```bash
docker run --rm -p 3000:3000 lorax-monorepo
```

Then open: `http://localhost:3000`

### Mount local data (recommended)

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/ts_files:/app/UPLOADS/ts_files" \
  lorax-monorepo
```

---

## Maintainer

**Pratik Katte** \
Department of Biomolecular Engineering & Bioinformatics \
University of California, Santa Cruz
