"""Common runtime dispatcher for Lorax dataset storage backends."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from lorax.artifacts.runtime import (
    ArtifactDatasetContext,
    context_for_session,
    is_artifact_session,
)
from lorax.cache import get_file_context


def log_dataset_backend(
    backend: str,
    source_path: str,
    *,
    artifact_path: str | None = None,
    reason: str | None = None,
) -> None:
    """Print the selected dataset backend regardless of logging configuration."""
    if backend.startswith("csr-v"):
        label = f"CSR v{backend.removeprefix('csr-v')} artifact"
    elif backend == "csv":
        label = "CSV source"
    else:
        label = "TreeSequence source"

    details = [f'source="{source_path}"']
    if artifact_path:
        details.append(f'artifact="{artifact_path}"')
    if reason:
        details.append(f'reason="{reason}"')
    print(f"[Lorax] Dataset backend: {label} | {' | '.join(details)}", flush=True)


@dataclass(frozen=True)
class LegacyDatasetContext:
    file_path: str
    file_context: Any
    dataset_backend: str = "legacy"

    @property
    def is_artifact(self) -> bool:
        return False


@dataclass(frozen=True)
class CSVDatasetContext:
    file_path: str
    file_context: Any
    dataset_backend: str = "csv"

    @property
    def is_artifact(self) -> bool:
        return False


async def resolve_dataset_context(session: Any):
    """Resolve a session to one of the shared CSR, legacy, or CSV contexts."""
    if is_artifact_session(session):
        context = await asyncio.to_thread(context_for_session, session)
        if context is None:
            raise RuntimeError("Artifact session has no readable context")
        return context

    file_path = getattr(session, "file_path", None)
    if not file_path:
        raise RuntimeError("No file loaded")
    file_context = await get_file_context(file_path)
    if file_context is None:
        raise RuntimeError("Dataset could not be loaded")
    if str(file_path).lower().endswith(".csv"):
        return CSVDatasetContext(str(file_path), file_context)
    return LegacyDatasetContext(str(file_path), file_context)


def dataset_backend(context: Any) -> str:
    if isinstance(context, ArtifactDatasetContext):
        return f"csr-v{context.schema_version}"
    return str(getattr(context, "dataset_backend", "legacy"))


__all__ = [
    "CSVDatasetContext",
    "LegacyDatasetContext",
    "dataset_backend",
    "log_dataset_backend",
    "resolve_dataset_context",
]
