"""
Lorax CLI - Command-line interface for the Lorax backend server.

Usage:
    lorax serve --reload              # Development mode with auto-reload
    lorax serve --host 0.0.0.0 --port 8080 --reload
    lorax serve --gunicorn --workers 4  # Production mode with gunicorn
    lorax config show                 # Show current configuration
    lorax config set cache.ts_cache_size 3  # Set a config value
"""
import os
import sys
import json
from pathlib import Path
import click


# Default config path for local/conda mode
DEFAULT_CONFIG_PATH = Path.home() / ".lorax" / "config.yaml"


@click.group()
@click.version_option(version="1.0.0", prog_name="lorax")
def main():
    """Lorax Backend CLI - Tree visualization and analysis server."""
    pass


@main.group()
def config():
    """Manage Lorax configuration."""
    pass


@config.command("show")
def config_show():
    """Show current configuration."""
    from lorax.modes import CURRENT_MODE, CURRENT_CONFIG, get_cache_dir, get_uploads_dir

    click.echo(f"Mode: {CURRENT_MODE}")
    click.echo(f"")
    click.echo("Cache Configuration:")
    click.echo(f"  TS Cache Size: {CURRENT_CONFIG.ts_cache_size}")
    click.echo(f"  Config Cache Size: {CURRENT_CONFIG.config_cache_size}")
    click.echo(f"  Metadata Cache Size: {CURRENT_CONFIG.metadata_cache_size}")
    click.echo(f"")
    click.echo("Disk Cache:")
    click.echo(f"  Enabled: {CURRENT_CONFIG.disk_cache_enabled}")
    click.echo(f"  Max Size: {CURRENT_CONFIG.disk_cache_max_gb} GB")
    click.echo(f"  Directory: {get_cache_dir(CURRENT_CONFIG)}")
    click.echo(f"")
    click.echo("Connection Limits:")
    click.echo(f"  Max Sockets Per Session: {CURRENT_CONFIG.max_sockets_per_session}")
    click.echo(f"  Enforce Limits: {CURRENT_CONFIG.enforce_connection_limits}")
    click.echo(f"")
    click.echo("Directories:")
    click.echo(f"  Data Dir: {CURRENT_CONFIG.data_dir}")
    click.echo(f"  Uploads Dir: {get_uploads_dir(CURRENT_CONFIG)}")
    click.echo(f"")
    click.echo("Requirements:")
    click.echo(f"  Redis Required: {CURRENT_CONFIG.require_redis}")
    click.echo(f"  GCS Required: {CURRENT_CONFIG.require_gcs}")


@config.command("init")
@click.option("--force", is_flag=True, help="Overwrite existing config file")
def config_init(force: bool):
    """Initialize a config file for local mode."""
    config_path = DEFAULT_CONFIG_PATH

    if config_path.exists() and not force:
        click.echo(f"Config file already exists: {config_path}")
        click.echo("Use --force to overwrite")
        return

    # Create default config
    default_config = """# Lorax Local Configuration
# This file is used when running in local/conda mode

mode: local

data_dir: ~/.lorax

cache:
  ts_cache_size: 5
  config_cache_size: 2
  metadata_cache_size: 10

disk_cache:
  enabled: false
  max_gb: 10

server:
  host: 127.0.0.1
  port: 8080
  open_browser: true
"""

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(default_config)
    click.echo(f"Created config file: {config_path}")


@config.command("path")
def config_path():
    """Show config file path."""
    click.echo(DEFAULT_CONFIG_PATH)


@main.command("cache-status")
def cache_status():
    """Show cache statistics."""
    import asyncio
    from lorax.context import disk_cache_manager

    async def get_stats():
        return await disk_cache_manager.get_stats()

    stats = asyncio.run(get_stats())

    click.echo("Disk Cache Status:")
    if not stats.get("enabled"):
        click.echo("  Disabled")
    else:
        click.echo(f"  Directory: {stats.get('cache_dir')}")
        click.echo(f"  Size: {stats.get('total_size_mb', 0)} MB / {stats.get('max_size_mb', 0)} MB ({stats.get('usage_percent', 0)}%)")
        click.echo(f"  Files: {stats.get('file_count', 0)}")


@main.command("cache-clear")
@click.confirmation_option(prompt="Are you sure you want to clear the disk cache?")
def cache_clear():
    """Clear the disk cache."""
    import asyncio
    from lorax.context import disk_cache_manager

    async def clear():
        await disk_cache_manager.clear()

    asyncio.run(clear())
    click.echo("Disk cache cleared")


@main.command()
@click.option(
    "--host",
    default="127.0.0.1",
    help="Host to bind to (default: 127.0.0.1 for local, 0.0.0.0 for production)"
)
@click.option(
    "--port",
    default=8080,
    type=int,
    help="Port to bind to (default: 8080)"
)
@click.option(
    "--reload",
    is_flag=True,
    help="Enable auto-reload for development"
)
@click.option(
    "--gunicorn",
    is_flag=True,
    help="Use gunicorn for production (requires lorax[prod])"
)
@click.option(
    "--workers",
    default=4,
    type=int,
    help="Number of gunicorn workers (default: 4, only used with --gunicorn)"
)
@click.option(
    "--config",
    default=None,
    type=click.Path(exists=True),
    help="Path to gunicorn config file (optional)"
)
@click.option(
    "--open-browser",
    is_flag=True,
    help="Open browser automatically (for local mode)"
)
def serve(host: str, port: int, reload: bool, gunicorn: bool, workers: int, config: str, open_browser: bool):
    """Start the Lorax backend server.

    Examples:
        # Local mode (opens browser)
        lorax serve --open-browser

        # Development mode (with auto-reload)
        lorax serve --reload

        # Specify host/port
        lorax serve --host 0.0.0.0 --port 8080 --reload

        # Production mode (with gunicorn)
        lorax serve --gunicorn --workers 4
    """
    if gunicorn:
        _run_with_gunicorn(host, port, workers, config)
    else:
        _run_with_uvicorn(host, port, reload, open_browser)


def _run_with_uvicorn(host: str, port: int, reload: bool, open_browser: bool = False):
    """Run the server with uvicorn (development/local mode)."""
    import uvicorn

    click.echo(f"Starting Lorax server with uvicorn on {host}:{port}")
    if reload:
        click.echo("Auto-reload enabled")

    # Open browser if requested (in a separate thread to not block server start)
    if open_browser:
        import threading
        import webbrowser
        import time

        def open_browser_delayed():
            time.sleep(1.5)  # Wait for server to start
            url = f"http://{host}:{port}" if host != "0.0.0.0" else f"http://127.0.0.1:{port}"
            click.echo(f"Opening browser: {url}")
            webbrowser.open(url)

        threading.Thread(target=open_browser_delayed, daemon=True).start()

    uvicorn.run(
        "lorax.lorax_app:sio_app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )


def _run_with_gunicorn(host: str, port: int, workers: int, config: str):
    """Run the server with gunicorn (production mode)."""
    try:
        import gunicorn.app.base
    except ImportError:
        click.echo(
            "Error: gunicorn is not installed. "
            "Install with: pip install lorax[prod]",
            err=True
        )
        sys.exit(1)
    
    from gunicorn.app.base import BaseApplication
    
    class LoraxApplication(BaseApplication):
        def __init__(self, app_uri: str, options: dict = None):
            self.app_uri = app_uri
            self.options = options or {}
            super().__init__()
        
        def load_config(self):
            for key, value in self.options.items():
                if key in self.cfg.settings and value is not None:
                    self.cfg.set(key.lower(), value)
        
        def load(self):
            # Return the app URI string for gunicorn to import
            return None
    
    bind = f"{host}:{port}"
    
    options = {
        "bind": bind,
        "workers": workers,
        "worker_class": "uvicorn.workers.UvicornWorker",
        "timeout": 0,
        "graceful_timeout": 0,
        "keepalive": 0,
        "accesslog": "-",
        "errorlog": "-",
        "loglevel": "info",
    }
    
    # Load custom config if provided
    if config:
        click.echo(f"Loading gunicorn config from: {config}")
        # The config file will be loaded by gunicorn
        options["config"] = config
    
    click.echo(f"Starting Lorax server with gunicorn on {bind}")
    click.echo(f"Workers: {workers}")
    
    # Use subprocess to run gunicorn with the app
    import subprocess
    
    cmd = [
        sys.executable, "-m", "gunicorn",
        "-b", bind,
        "-w", str(workers),
        "-k", "uvicorn.workers.UvicornWorker",
        "--timeout", "0",
        "--graceful-timeout", "0",
        "--access-logfile", "-",
        "--error-logfile", "-",
        "--log-level", "info",
    ]
    
    if config:
        cmd.extend(["-c", config])
    
    cmd.append("lorax.lorax_app:sio_app")
    
    subprocess.run(cmd)


if __name__ == "__main__":
    main()
