#!/usr/bin/env python3
"""Build and validate a self-contained Lorax release."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = REPO_ROOT.parent / "lorax-plugin"


def run(*command: str, cwd: Path = REPO_ROOT, env: dict[str, str] | None = None) -> None:
    merged_env = None
    if env:
        import os

        merged_env = {**os.environ, **env}
    print(f"+ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=cwd, env=merged_env, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--use-existing-frontend",
        action="store_true",
        help="Package already-generated static files instead of rebuilding them.",
    )
    args = parser.parse_args()

    if not args.use_existing_frontend:
        if not PLUGIN_ROOT.joinpath("package-lock.json").is_file():
            raise SystemExit(
                "A sibling lorax-plugin checkout is required for a reproducible release build.\n"
                f"Expected: {PLUGIN_ROOT}"
            )
        run("npm", "ci")
        run("npm", "ci", cwd=PLUGIN_ROOT)
        run(
            "npm",
            "--workspace",
            "packages/website",
            "run",
            "build",
            env={"VITE_API_BASE": "/api"},
        )
        run(sys.executable, "packages/app/scripts/sync_ui_assets.py")
        run(sys.executable, "packages/app/scripts/sync_jbrowse_assets.py")

    static_index = REPO_ROOT / "packages/app/lorax_app/static/index.html"
    if not static_index.is_file():
        raise SystemExit(
            "Bundled frontend is missing. Run without --use-existing-frontend "
            "or generate the static assets first."
        )

    # The upstream JBrowse application archive includes its own large demo and
    # test datasets. Lorax does not serve them and they do not belong in a
    # production wheel.
    jbrowse_test_data = REPO_ROOT / "packages/app/lorax_app/static/jbrowse/test_data"
    if jbrowse_test_data.exists():
        shutil.rmtree(jbrowse_test_data)
        print(f"Removed generated JBrowse test data: {jbrowse_test_data}")

    project = tomllib.loads(REPO_ROOT.joinpath("pyproject.toml").read_text())
    version = project["project"]["version"]
    run(sys.executable, "-m", "build")

    artifacts = sorted(REPO_ROOT.joinpath("dist").glob(f"lorax_arg-{version}*"))
    wheels = [artifact for artifact in artifacts if artifact.suffix == ".whl"]
    if len(wheels) != 1:
        raise SystemExit(f"Expected one wheel for {version}, found {len(wheels)}")

    run(sys.executable, "-m", "twine", "check", *(str(path) for path in artifacts))
    run(sys.executable, "scripts/verify_wheel.py", str(wheels[0]))
    print(f"Release artifacts are ready in {REPO_ROOT / 'dist'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
