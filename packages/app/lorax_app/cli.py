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


@click.group(
    context_settings={"help_option_names": ["-h", "--help"], "allow_extra_args": True},
    invoke_without_command=True,
)
@click.option("--file", "file_path", type=click.Path(dir_okay=False, path_type=Path))
@click.option("--host", default="127.0.0.1", show_default=True)
@click.option("--port", default=3000, type=int, show_default=True)
@click.pass_context
def main(
    ctx: click.Context,
    file_path: Path | None,
    host: str,
    port: int,
):
    """
    Run Lorax as a single-port app (UI + backend).

    If FILE is provided, it is copied into Lorax uploads and the browser opens
    directly to the viewer route for that file.
    """
    if ctx.invoked_subcommand is None:
        file = file_path
        if file is None and ctx.args:
            candidate = Path(ctx.args[0]).expanduser()
            if candidate.exists() and candidate.is_file():
                file = candidate
            else:
                raise click.ClickException(f"File not found: {candidate}")
        _serve(file=file, host=host, port=port)


def _serve(file: Path | None, host: str, port: int) -> None:
    import uvicorn

    filename = None
    if file is not None:
        filename = _copy_into_uploads(file)

    def open_browser_delayed():
        base = f"http://{host}:{port}" if host != "0.0.0.0" else f"http://127.0.0.1:{port}"
        ready = _wait_for_health(base)
        if not ready:
            click.echo("Warning: /api/health did not respond yet; opening browser anyway.")
        if filename:
            url = f"{base}/{quote(filename)}?project=Uploads"
        else:
            url = f"{base}/"
        click.echo(f"Opening browser: {url}")
        webbrowser.open(url)

    threading.Thread(target=open_browser_delayed, daemon=True).start()

    click.echo(f"Starting Lorax app on {host}:{port}")
    uvicorn.run(
        "lorax_app.app:asgi_app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
