from __future__ import annotations

import shutil
import threading
import time
import webbrowser
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

import click

from lorax.constants import UPLOADS_DIR


_BUILTIN_ASSEMBLY_ALIASES = {
    "hg19": "hg19",
    "h19": "hg19",
    "hg38": "hg38",
    "h38": "hg38",
}

_JBROWSE_ASSEMBLY_REQUIRED_MESSAGE = """--assembly is required when --jbrowse is used.

JBrowse needs a reference genome assembly so it can map the Lorax track onto chromosomes.

Examples:
  lorax --file path/to/file.trees --jbrowse --assembly hg19
  lorax --file path/to/file.trees --jbrowse --assembly hg38
  lorax --file path/to/file.trees --jbrowse --assembly /path/reference.fa.gz
  lorax --file path/to/file.trees --jbrowse --assembly /path/reference.fa.gz,/path/reference.fa.gz.fai,/path/reference.fa.gz.gzi
  lorax --file path/to/file.trees --jbrowse --assembly /path/reference-folder
"""

_FASTA_SUFFIXES = (".fasta.gz", ".fa.gz", ".fna.gz", ".fasta", ".fa", ".fna")


def _copy_into_uploads(src: Path) -> str:
    """
    Copy a user-provided file into the backend's local uploads location.

    Local-mode uploads layout is:
      <UPLOADS_DIR>/Uploads/<filename>
    """
    src = src.expanduser().resolve()
    if not src.exists() or not src.is_file():
        raise click.ClickException(f"File not found: {src}")

    uploads_root = Path(UPLOADS_DIR) / "Uploads"
    uploads_root.mkdir(parents=True, exist_ok=True)

    dest = uploads_root / src.name
    print(f"Copying {src} to {dest}")
    shutil.copy2(src, dest)
    return dest.name


def _wait_for_health(base_url: str, timeout_s: float = 20.0, interval_s: float = 0.5) -> bool:
    """Poll /api/health until the server is ready (or timeout)."""
    deadline = time.monotonic() + timeout_s
    health_url = f"{base_url}/api/health"
    while time.monotonic() < deadline:
        try:
            with urlopen(health_url, timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(interval_s)
    return False


def _assembly_name_from_fasta(path: Path) -> str:
    name = path.name
    for suffix in (*_FASTA_SUFFIXES, ".gz"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return path.stem


def _fasta_from_assembly_dir(path: Path) -> Path:
    candidates = [
        child
        for child in sorted(path.iterdir())
        if child.is_file() and child.name.endswith(_FASTA_SUFFIXES)
    ]
    if not candidates:
        raise click.ClickException(
            f"Assembly folder contains no FASTA files: {path}\n"
            "Expected one .fa, .fasta, .fna, or gzipped equivalent."
        )
    if len(candidates) > 1:
        formatted = ", ".join(child.name for child in candidates)
        raise click.ClickException(
            f"Assembly folder contains multiple FASTA files: {formatted}\n"
            "Please pass the FASTA path directly with --assembly."
        )
    return candidates[0]


def _resolve_jbrowse_assembly(assembly: str | None) -> str | dict[str, str | None]:
    if not assembly:
        raise click.ClickException(_JBROWSE_ASSEMBLY_REQUIRED_MESSAGE)

    raw = assembly.strip()
    builtin = _BUILTIN_ASSEMBLY_ALIASES.get(raw.lower())
    if builtin:
        return builtin

    parts = [Path(part.strip()).expanduser().resolve() for part in raw.split(",") if part.strip()]
    if not parts:
        raise click.ClickException("Assembly is required for JBrowse mode.")
    if len(parts) > 3:
        raise click.ClickException("Use --assembly FASTA[,FAI[,GZI]] for local assembly files.")

    fasta_path = _fasta_from_assembly_dir(parts[0]) if parts[0].is_dir() else parts[0]
    fai_path = parts[1] if len(parts) > 1 else Path(f"{fasta_path}.fai")
    gzi_path = parts[2] if len(parts) > 2 else Path(f"{fasta_path}.gzi")
    requires_gzi = fasta_path.name.endswith(".gz") or len(parts) > 2

    missing = [
        path
        for path in (fasta_path, fai_path, gzi_path if requires_gzi else None)
        if path is not None and (not path.exists() or not path.is_file())
    ]
    if missing:
        formatted = ", ".join(str(path) for path in missing)
        raise click.ClickException(f"Missing FASTA index files: {formatted}")

    return {
        "name": _assembly_name_from_fasta(fasta_path),
        "fasta_path": str(fasta_path),
        "fai_path": str(fai_path),
        "gzi_path": str(gzi_path) if requires_gzi else None,
    }


@click.group(
    context_settings={"help_option_names": ["-h", "--help"], "allow_extra_args": True},
    invoke_without_command=True,
)
@click.option("--file", "file_path", type=click.Path(dir_okay=False, path_type=Path))
@click.option("--host", default="127.0.0.1", show_default=True)
@click.option("--port", default=3000, type=int, show_default=True)
@click.option("--jbrowse", "use_jbrowse", is_flag=True, default=False,
              help="Launch with JBrowse interface instead of the default Lorax UI.")
@click.option("--assembly", default=None,
              help="Genome assembly for JBrowse mode: hg19, hg38, h19, h38, or FASTA[,FAI[,GZI]].")
@click.version_option(package_name="lorax-arg", prog_name="lorax")
@click.pass_context
def main(
    ctx: click.Context,
    file_path: Path | None,
    host: str,
    port: int,
    use_jbrowse: bool,
    assembly: str,
):
    """
    Lorax — interactive ARG viewer. Provide FILE to view trees directly.
    """
    if ctx.invoked_subcommand is None:
        file = file_path
        if file is None and ctx.args:
            candidate = Path(ctx.args[0]).expanduser()
            if candidate.exists() and candidate.is_file():
                file = candidate
            else:
                raise click.ClickException(f"File not found: {candidate}")
        if use_jbrowse:
            assembly = _resolve_jbrowse_assembly(assembly)
        _serve(file=file, host=host, port=port, use_jbrowse=use_jbrowse, assembly=assembly)


def _serve(
    file: Path | None,
    host: str,
    port: int,
    use_jbrowse: bool = False,
    assembly: str | dict[str, str | None] | None = None,
) -> None:
    import uvicorn
    from lorax_app.app import create_asgi_app

    filename = None
    if file is not None:
        filename = _copy_into_uploads(file)

    app = create_asgi_app(jbrowse=use_jbrowse, filename=filename, assembly=assembly)

    def open_browser_delayed():
        base = f"http://{host}:{port}" if host != "0.0.0.0" else f"http://127.0.0.1:{port}"
        ready = _wait_for_health(base)
        if not ready:
            click.echo("Warning: /api/health did not respond yet; opening browser anyway.")
        if use_jbrowse:
            url = f"{base}/"
        elif filename:
            url = f"{base}/{quote(filename)}?project=Uploads"
        else:
            url = f"{base}/"
        click.echo(f"Opening browser: {url}")
        webbrowser.open(url)

    threading.Thread(target=open_browser_delayed, daemon=True).start()

    click.echo(f"Starting Lorax app on {host}:{port}")
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
