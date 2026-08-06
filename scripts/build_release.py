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
        if not PLUGIN_ROOT.is_dir():
            raise SystemExit(
                "A sibling lorax-plugin checkout is required for a release build.\n"
                f"Expected: {PLUGIN_ROOT}"
            )
        workspace_node_modules = REPO_ROOT / "node_modules"
        if workspace_node_modules.is_dir():
            print(f"Using existing workspace dependencies: {workspace_node_modules}")
        elif REPO_ROOT.joinpath("yarn.lock").is_file():
            run("yarn", "install", "--frozen-lockfile")
        elif REPO_ROOT.joinpath("package-lock.json").is_file():
            run("npm", "ci")
        else:
            raise SystemExit(
                "Lorax has no installed workspace dependencies or supported lockfile.\n"
                f"Expected node_modules, yarn.lock, or package-lock.json in: {REPO_ROOT}"
            )
        plugin_node_modules = PLUGIN_ROOT / "node_modules"
        if plugin_node_modules.is_dir():
            print(f"Using existing plugin dependencies: {plugin_node_modules}")
        elif PLUGIN_ROOT.joinpath("package-lock.json").is_file():
            run("npm", "ci", cwd=PLUGIN_ROOT)
        elif PLUGIN_ROOT.joinpath("yarn.lock").is_file():
            run("yarn", "install", "--frozen-lockfile", cwd=PLUGIN_ROOT)
        else:
            raise SystemExit(
                "lorax-plugin has no installed dependencies or supported lockfile.\n"
                f"Expected node_modules, package-lock.json, or yarn.lock in: {PLUGIN_ROOT}"
            )
        run(
            "yarn",
            "--cwd",
            "packages/website",
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
