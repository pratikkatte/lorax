"""Local Phlag project discovery for adjacent Newick CSR artifacts."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from lorax.artifacts.runtime import artifact_resolver


PHLAG_PROJECT_NAME = "Phlag Avian"
PHLAG_MAMMALIAN_PROJECT_NAME = "Phlag Mammalian"
PHLAG_PROJECT_NAMES = {PHLAG_PROJECT_NAME, PHLAG_MAMMALIAN_PROJECT_NAME}
_PHLAG_PROJECT_ALIASES = {
    "phlag avian": PHLAG_PROJECT_NAME,
    "phlag mammalian": PHLAG_MAMMALIAN_PROJECT_NAME,
}
_CHROMOSOME_PATTERN = re.compile(
    r"^gene_trees-Stiller2024-(chr(?:[1-9]|1[0-9]|2[0-8]|Z))-sorted\.nwk\.gz$"
)
_MAMMALIAN_PATTERN = re.compile(r"^alltrees\.tree\.gz$")


def _project_metadata(project_name: str) -> dict[str, Any]:
    """Return display and provenance metadata for a Phlag project."""
    if project_name == PHLAG_PROJECT_NAME:
        return {
            "display_name": "Phlag Avian — Stiller et al. (2024)",
            "description": "Avian gene trees from Stiller et al. (2024).",
            "references": [
                {
                    "label": "Dataset on Zenodo",
                    "url": "https://zenodo.org/records/19713363",
                },
                {
                    "label": "Stiller et al. (2024)",
                    "url": "https://www.nature.com/articles/s41586-024-07323-1",
                },
                {
                    "label": "Phlag",
                    "url": "https://academic.oup.com/bioinformatics/article/42/Supplement_1/btag273/8726330",
                },
            ],
        }
    if project_name == PHLAG_MAMMALIAN_PROJECT_NAME:
        return {
            "display_name": "Phlag Mammalian",
            "description": (
                "Phlag-inferred mammalian chromosome 3 gene trees from the Zoonomia "
                "alignment data."
            ),
            "references": [
                {
                    "label": "Dataset on Zenodo",
                    "url": "https://zenodo.org/records/19713368",
                },
                {
                    "label": "Source alignment study",
                    "url": "https://www.science.org/doi/10.1126/science.abl8189",
                },
                {
                    "label": "Phlag",
                    "url": "https://academic.oup.com/bioinformatics/article/42/Supplement_1/btag273/8726330",
                },
            ],
        }
    return {}


def _canonical_project_name(project_name: str) -> str | None:
    """Match Phlag project-name spellings without regard to capitalization."""
    return _PHLAG_PROJECT_ALIASES.get(project_name.casefold())


def phlag_file_entry(project: str, filename: str) -> dict[str, str]:
    """Return a UI label while retaining the storage filename as ``name``."""
    if project == PHLAG_PROJECT_NAME:
        match = _CHROMOSOME_PATTERN.match(filename)
        if match is not None:
            return {
                "name": filename,
                "display_name": f"Chromosome {match.group(1).removeprefix('chr')}",
            }
    elif project == PHLAG_MAMMALIAN_PROJECT_NAME and _MAMMALIAN_PATTERN.match(filename):
        return {"name": filename, "display_name": "Mammals — Chromosome 3"}
    return {"name": filename, "display_name": filename}


def decorate_phlag_projects(projects: dict[str, dict[str, Any]]) -> None:
    """Add readable Phlag labels to projects listed from local disk or GCS."""
    for listed_name, project in list(projects.items()):
        project_name = _canonical_project_name(listed_name)
        if project_name is None:
            continue
        project.update(_project_metadata(project_name))
        files = project.get("files", [])
        if isinstance(files, list):
            project["files"] = [
                (
                    phlag_file_entry(project_name, filename)
                    if isinstance(filename, str)
                    else filename
                )
                for filename in files
                if isinstance(filename, (str, dict))
            ]
        if listed_name != project_name:
            projects[project_name] = project
            del projects[listed_name]


def _workspace_root() -> Path | None:
    """Find a checkout root containing the optional local Phlag data.

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
        **_project_metadata(PHLAG_PROJECT_NAME),
        "folder": str(phlag_data_directory()),
        "files": [phlag_file_entry(PHLAG_PROJECT_NAME, source.name) for source in sources],
        "artifact_backed": True,
    }


def mammalian_project() -> dict[str, Any] | None:
    sources = mammalian_artifact_backed_sources()
    if not sources:
        return None
    return {
        **_project_metadata(PHLAG_MAMMALIAN_PROJECT_NAME),
        "folder": str(mammalian_data_directory()),
        "files": [
            phlag_file_entry(PHLAG_MAMMALIAN_PROJECT_NAME, source.name)
            for source in sources
        ],
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
    project_name = _canonical_project_name(project)
    if project_name == PHLAG_PROJECT_NAME:
        directory = phlag_data_directory()
        pattern = _CHROMOSOME_PATTERN
    elif project_name == PHLAG_MAMMALIAN_PROJECT_NAME:
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
    "decorate_phlag_projects",
    "mammalian_artifact_backed_sources",
    "mammalian_data_directory",
    "mammalian_project",
    "phlag_data_directory",
    "phlag_file_entry",
    "phlag_project",
    "phlag_projects",
    "resolve_phlag_source",
]
