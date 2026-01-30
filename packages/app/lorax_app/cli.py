from __future__ import annotations

import os
import shutil
import subprocess
import sys
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
@click.option("--reload", is_flag=True, help="Enable auto-reload (developer use).")
@click.option("--open-browser/--no-open-browser", default=True, show_default=True)
@click.pass_context
def main(
    ctx: click.Context,
    file_path: Path | None,
    host: str,
    port: int,
    reload: bool,
    open_browser: bool,
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
        _serve(file=file, host=host, port=port, reload=reload, open_browser=open_browser)


@main.command("build")
@click.option(
    "--with-ui/--no-ui",
    default=True,
    show_default=True,
    help="Build the website and sync static assets before packaging.",
)
def build_package(with_ui: bool):
    """Build the pip package from the repo root (requires `python -m build`)."""
    try:
        import build as _  # noqa: F401
    except ImportError as exc:
        raise click.ClickException(
            "Missing build dependency. Install with: python -m pip install -U build"
        ) from exc

    repo_root = _repo_root()
    vendored = repo_root / "packages" / "app" / "lorax"
    if vendored.exists():
        click.echo(f"Removing vendored backend package at {vendored}")
        shutil.rmtree(vendored)
    if with_ui:
        click.echo("Building website UI and syncing static assets")
        subprocess.run(["npm", "ci"], check=True, cwd=repo_root)
        subprocess.run(
            ["npm", "--workspace", "packages/website", "run", "build"],
            check=True,
            cwd=repo_root,
            env={**os.environ, "VITE_API_BASE": "/api"},
        )
        subprocess.run(
            [sys.executable, "packages/app/scripts/sync_ui_assets.py"],
            check=True,
            cwd=repo_root,
        )
    click.echo(f"Building pip package from {repo_root}")
    subprocess.run([sys.executable, "-m", "build", str(repo_root)], check=True)


@main.command("publish")
@click.option(
    "--repository",
    type=click.Choice(["pypi", "testpypi", "both"], case_sensitive=False),
    default="both",
    show_default=True,
    help="Upload to PyPI/TestPyPI using ~/.pypirc credentials.",
)
def publish_package(repository: str):
    """Publish built artifacts in dist/ to PyPI and/or TestPyPI."""
    repo_root = _repo_root()
    dist_dir = repo_root / "dist"
    if not dist_dir.exists():
        raise click.ClickException(f"dist/ not found at {dist_dir}. Run `lorax build` first.")

    artifacts = sorted(dist_dir.glob("*"))
    if not artifacts:
        raise click.ClickException(f"No artifacts found in {dist_dir}. Run `lorax build` first.")

    targets = []
    repo_choice = repository.lower()
    if repo_choice in ("testpypi", "both"):
        targets.append("testpypi")
    if repo_choice in ("pypi", "both"):
        targets.append("pypi")

    for target in targets:
        click.echo(f"Uploading artifacts to {target}")
        subprocess.run(
            [sys.executable, "-m", "twine", "upload", "--repository", target, "dist/*"],
            check=True,
            cwd=repo_root,
        )


def _repo_root() -> Path:
    repo_root = Path(__file__).resolve().parents[3]
    pyproject = repo_root / "pyproject.toml"
    if not pyproject.exists():
        raise click.ClickException(
            f"Repo root not found (expected {pyproject}). Run from the repo checkout."
        )
    return repo_root


def _serve(file: Path | None, host: str, port: int, reload: bool, open_browser: bool) -> None:
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

    if open_browser:
        threading.Thread(target=open_browser_delayed, daemon=True).start()

    click.echo(f"Starting Lorax app on {host}:{port}")
    uvicorn.run(
        "lorax_app.app:asgi_app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
