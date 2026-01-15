"""
Lorax CLI - Command-line interface for the Lorax backend server.

Usage:
    lorax serve --reload              # Development mode with auto-reload
    lorax serve --host 0.0.0.0 --port 8080 --reload
    lorax serve --gunicorn --workers 4  # Production mode with gunicorn
"""
import os
import sys
import click


@click.group()
@click.version_option(version="1.0.0", prog_name="lorax")
def main():
    """Lorax Backend CLI - Tree visualization and analysis server."""
    pass


@main.command()
@click.option(
    "--host",
    default="0.0.0.0",
    help="Host to bind to (default: 0.0.0.0)"
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
def serve(host: str, port: int, reload: bool, gunicorn: bool, workers: int, config: str):
    """Start the Lorax backend server.
    
    Examples:
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
        _run_with_uvicorn(host, port, reload)


def _run_with_uvicorn(host: str, port: int, reload: bool):
    """Run the server with uvicorn (development mode)."""
    import uvicorn
    
    click.echo(f"Starting Lorax server with uvicorn on {host}:{port}")
    if reload:
        click.echo("Auto-reload enabled")
    
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
