"""Local PHLaG project discovery for adjacent Newick CSR artifacts."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from lorax.artifacts.runtime import artifact_resolver


PHLAG_PROJECT_NAME = "PHLaG"
PHLAG_MAMMALIAN_PROJECT_NAME = "PHLaG Mammalian"
PHLAG_PROJECT_NAMES = {PHLAG_PROJECT_NAME, PHLAG_MAMMALIAN_PROJECT_NAME}
_CHROMOSOME_PATTERN = re.compile(
    r"^gene_trees-Stiller2024-(chr(?:[1-9]|1[0-9]|2[0-8]|Z))-sorted\.nwk\.gz$"
)
_MAMMALIAN_PATTERN = re.compile(r"^alltrees\.tree\.gz$")


def _workspace_root() -> Path | None:
    """Find a checkout root containing the optional local PHLaG data.

    The source checkout has ``phlag/data`` alongside ``packages``, but the
    production image contains only ``packages/backend``.  Do not assume a
    fixed number of parent directories: that made importing this module fail
    in the container before the application could start.
    """

    module_path = Path(__file__).resolve()
    for parent in module_path.parents:
        if (parent / "phlag" / "data").is_dir():
            return parent
    return None


_WORKSPACE_ROOT = _workspace_root()
_WORKSPACE_DEFAULT = (
    _WORKSPACE_ROOT
    / "phlag"
    / "data"
    / "bo1929-phlag-avian-analysis-454f29a"
    / "sorted_genetrees"
    if _WORKSPACE_ROOT is not None
    else Path("/__lorax_phlag_data_unavailable__")
)
_MAMMALIAN_WORKSPACE_DEFAULT = (
    _WORKSPACE_ROOT / "phlag" / "data" / "bo1929-phlag-mammalian-analysis-a011ac3"
    if _WORKSPACE_ROOT is not None
    else Path("/__lorax_phlag_data_unavailable__")
)


def phlag_data_directory() -> Path:
    configured = os.getenv("LORAX_PHLAG_DATA_DIR", "").strip()
    return (
        Path(configured).expanduser().resolve()
        if configured
        else _WORKSPACE_DEFAULT.resolve()
    )


def mammalian_data_directory() -> Path:
    configured = os.getenv("LORAX_PHLAG_MAMMALIAN_DATA_DIR", "").strip()
    return (
        Path(configured).expanduser().resolve()
        if configured
        else _MAMMALIAN_WORKSPACE_DEFAULT.resolve()
    )


def _chromosome_sort_key(filename: str) -> tuple[int, int]:
    match = _CHROMOSOME_PATTERN.match(filename)
    if match is None:
        return (2, 0)
    suffix = match.group(1).removeprefix("chr")
    return (1, 0) if suffix == "Z" else (0, int(suffix))


def artifact_backed_sources() -> list[Path]:
    directory = phlag_data_directory()
    if not directory.is_dir():
        return []
    sources = []
    for source in directory.iterdir():
        if not source.is_file() or _CHROMOSOME_PATTERN.match(source.name) is None:
            continue
        if artifact_resolver.resolve(source) is not None:
            sources.append(source)
    return sorted(sources, key=lambda path: _chromosome_sort_key(path.name))


def mammalian_artifact_backed_sources() -> list[Path]:
    directory = mammalian_data_directory()
    if not directory.is_dir():
        return []
    sources = []
    for source in directory.iterdir():
        if not source.is_file() or _MAMMALIAN_PATTERN.match(source.name) is None:
            continue
        if artifact_resolver.resolve(source) is not None:
            sources.append(source)
    return sorted(sources)


def phlag_project() -> dict[str, Any] | None:
    sources = artifact_backed_sources()
    if not sources:
        return None
    return {
        "folder": str(phlag_data_directory()),
        "files": [source.name for source in sources],
        "description": (
            "PHLaG avian gene trees — preprocessed CSR artifacts with genomic "
            "positions and Newick branch lengths"
        ),
        "artifact_backed": True,
    }


def mammalian_project() -> dict[str, Any] | None:
    sources = mammalian_artifact_backed_sources()
    if not sources:
        return None
    return {
        "folder": str(mammalian_data_directory()),
        "files": [source.name for source in sources],
        "description": (
            "PHLaG mammalian chromosome 3 gene trees — preprocessed CSR "
            "artifact with human genomic positions and Newick branch lengths"
        ),
        "artifact_backed": True,
    }


def phlag_projects() -> dict[str, dict[str, Any]]:
    projects = {}
    avian = phlag_project()
    mammalian = mammalian_project()
    if avian is not None:
        projects[PHLAG_PROJECT_NAME] = avian
    if mammalian is not None:
        projects[PHLAG_MAMMALIAN_PROJECT_NAME] = mammalian
    return projects


def resolve_phlag_source(project: str, filename: str) -> Path | None:
    if Path(filename).name != filename:
        return None
    if project == PHLAG_PROJECT_NAME:
        directory = phlag_data_directory()
        pattern = _CHROMOSOME_PATTERN
    elif project == PHLAG_MAMMALIAN_PROJECT_NAME:
        directory = mammalian_data_directory()
        pattern = _MAMMALIAN_PATTERN
    else:
        return None
    if pattern.match(filename) is None:
        return None
    source = directory / filename
    if not source.is_file() or artifact_resolver.resolve(source) is None:
        return None
    return source.resolve()


__all__ = [
    "PHLAG_PROJECT_NAME",
    "PHLAG_MAMMALIAN_PROJECT_NAME",
    "PHLAG_PROJECT_NAMES",
    "artifact_backed_sources",
    "mammalian_artifact_backed_sources",
    "mammalian_data_directory",
    "mammalian_project",
    "phlag_data_directory",
    "phlag_project",
    "phlag_projects",
    "resolve_phlag_source",
]
