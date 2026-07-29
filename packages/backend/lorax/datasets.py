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
    "resolve_dataset_context",
]
