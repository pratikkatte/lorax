"""Runtime discovery and shared contexts for artifact-backed datasets."""

from __future__ import annotations

import json
import logging
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from lorax.artifacts.csr_builder import (
    CSR_ARTIFACT_FORMAT,
    CSR_ARTIFACT_SCHEMA_VERSION,
    CSR_ARTIFACT_V2_FORMAT,
    CSR_ARTIFACT_V2_SCHEMA_VERSION,
    artifact_path_for_source,
)
from lorax.artifacts.csr_reader import (
    CSRArtifactCorruptError,
    CSRArtifactError,
    CSRArtifactReader,
)
from lorax.artifacts.metrics import csr_artifact_metrics
from lorax.constants import (
    CSR_CONTEXT_CACHE_SIZE,
    CSR_MAX_OPEN_SHARDS,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResolvedArtifact:
    source_path: str
    artifact_directory: str
    fingerprint: str
    artifact_format: str
    schema_version: int


@dataclass
class ArtifactDatasetContext:
    artifact_directory: str
    fingerprint: str
    artifact_format: str
    schema_version: int
    capabilities: dict[str, bool]
    config: dict[str, Any]
    reader: CSRArtifactReader

    @property
    def is_artifact(self) -> bool:
        return True

    @property
    def dataset_backend(self) -> str:
        return f"csr-v{self.schema_version}"

    def close(self) -> None:
        self.reader.close()


class ArtifactResolver:
    """Resolve a source path to its validated adjacent CSR artifact."""

    def __init__(self):
        self._lock = threading.RLock()
        self._unhealthy: set[str] = set()

    @staticmethod
    def _resolved_from_manifest(
        source_path: Path,
        artifact_directory: Path,
        payload: dict[str, Any],
    ) -> ResolvedArtifact | None:
        fingerprint = payload.get("fingerprint")
        artifact_format = payload.get("format")
        schema_version = payload.get("schema_version")
        if not all(
            value is not None
            for value in (
                fingerprint,
                artifact_format,
                schema_version,
            )
        ):
            return None
        if (str(artifact_format), int(schema_version)) not in {
            (CSR_ARTIFACT_V2_FORMAT, CSR_ARTIFACT_V2_SCHEMA_VERSION),
            (CSR_ARTIFACT_FORMAT, CSR_ARTIFACT_SCHEMA_VERSION),
        }:
            return None
        return ResolvedArtifact(
            source_path=str(source_path),
            artifact_directory=str(artifact_directory),
            fingerprint=str(fingerprint),
            artifact_format=str(artifact_format),
            schema_version=int(schema_version),
        )

    def resolve(self, source: str | Path) -> ResolvedArtifact | None:
        source_path = Path(source).expanduser().resolve()
        artifact_path = artifact_path_for_source(source_path)
        with self._lock:
            artifact_key = str(artifact_path)
            if artifact_key in self._unhealthy:
                csr_artifact_metrics.increment("resolution.unhealthy")
                return None
            manifest_path = artifact_path / "manifest.json"
            if not manifest_path.is_file():
                csr_artifact_metrics.increment("resolution.missing")
                return None
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                resolved = self._resolved_from_manifest(
                    source_path,
                    artifact_path,
                    manifest,
                )
                source_metadata = manifest["source"]
                if str(source_metadata["sha256"]) != str(manifest["fingerprint"]):
                    raise ValueError("Manifest source fingerprint is inconsistent")
                stat = source_path.stat()
                if (
                    int(source_metadata["size_bytes"]) != stat.st_size
                    or int(source_metadata["mtime_ns"]) != stat.st_mtime_ns
                ):
                    csr_artifact_metrics.increment("resolution.stale")
                    return None
            except FileNotFoundError:
                csr_artifact_metrics.increment("resolution.source_missing")
                return None
            except Exception:
                csr_artifact_metrics.increment("resolution.corrupt_manifest")
                return None
            if resolved is None:
                csr_artifact_metrics.increment("resolution.corrupt_manifest")
                return None
            return resolved

    def mark_unhealthy(self, artifact_directory: str | Path) -> None:
        artifact_key = str(Path(artifact_directory).expanduser().resolve())
        with self._lock:
            self._unhealthy.add(artifact_key)
        csr_artifact_metrics.increment("artifact.marked_unhealthy")

    def reset(self) -> None:
        with self._lock:
            self._unhealthy.clear()


class ArtifactContextRegistry:
    """Process-local bounded LRU of shared readers keyed by artifact path."""

    def __init__(
        self,
        *,
        max_contexts: int = CSR_CONTEXT_CACHE_SIZE,
        max_open_shards: int = CSR_MAX_OPEN_SHARDS,
    ):
        self.max_contexts = max(1, int(max_contexts))
        self.max_open_shards = max(1, int(max_open_shards))
        self._lock = threading.RLock()
        self._contexts: OrderedDict[str, ArtifactDatasetContext] = OrderedDict()

    def open(self, resolved: ResolvedArtifact) -> ArtifactDatasetContext:
        artifact_key = str(
            Path(resolved.artifact_directory).expanduser().resolve()
        )
        with self._lock:
            cached = self._contexts.pop(artifact_key, None)
            if cached is not None:
                if cached.fingerprint == resolved.fingerprint:
                    self._contexts[artifact_key] = cached
                    csr_artifact_metrics.increment("context.hit")
                    return cached
                cached.close()
            csr_artifact_metrics.increment("context.miss")
            with csr_artifact_metrics.timer("context.open"):
                reader = CSRArtifactReader.open(
                    resolved.artifact_directory,
                    max_open_shards=self.max_open_shards,
                )
            context = ArtifactDatasetContext(
                artifact_directory=resolved.artifact_directory,
                fingerprint=resolved.fingerprint,
                artifact_format=reader.format,
                schema_version=reader.schema_version,
                capabilities=dict(reader.capabilities),
                config=reader.frontend_config(),
                reader=reader,
            )
            self._contexts[artifact_key] = context
            while len(self._contexts) > self.max_contexts:
                _artifact_path, evicted = self._contexts.popitem(last=False)
                evicted.close()
                csr_artifact_metrics.increment("context.eviction")
            return context

    def open_path(
        self,
        artifact_directory: str | Path,
        *,
        expected_fingerprint: str | None = None,
    ) -> ArtifactDatasetContext:
        manifest_path = Path(artifact_directory) / "manifest.json"
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        fingerprint = str(payload["fingerprint"])
        if expected_fingerprint is not None and fingerprint != expected_fingerprint:
            raise CSRArtifactCorruptError("Artifact fingerprint does not match session")
        resolved = ResolvedArtifact(
            source_path=str(payload.get("source", {}).get("path", "")),
            artifact_directory=str(Path(artifact_directory).expanduser().resolve()),
            fingerprint=fingerprint,
            artifact_format=str(payload["format"]),
            schema_version=int(payload["schema_version"]),
        )
        return self.open(resolved)

    def discard(self, artifact_directory: str | Path) -> None:
        artifact_key = str(
            Path(artifact_directory).expanduser().resolve()
        )
        with self._lock:
            context = self._contexts.pop(artifact_key, None)
        if context is not None:
            context.close()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "contexts": len(self._contexts),
                "artifact_directories": list(self._contexts),
                "fingerprints": [
                    context.fingerprint for context in self._contexts.values()
                ],
                "max_contexts": self.max_contexts,
                "max_open_shards": self.max_open_shards,
            }

    def close(self) -> None:
        with self._lock:
            contexts = list(self._contexts.values())
            self._contexts.clear()
        for context in contexts:
            context.close()


artifact_resolver = ArtifactResolver()
artifact_context_registry = ArtifactContextRegistry()


def context_for_session(session: Any) -> ArtifactDatasetContext | None:
    if getattr(session, "dataset_backend", "legacy") not in {"csr-v2", "csr-v3"}:
        return None
    artifact_path = getattr(session, "artifact_path", None)
    fingerprint = getattr(session, "artifact_fingerprint", None)
    if not artifact_path:
        return None
    return artifact_context_registry.open_path(
        artifact_path,
        expected_fingerprint=fingerprint,
    )


def is_artifact_session(session: Any) -> bool:
    return getattr(session, "dataset_backend", "legacy") in {"csr-v2", "csr-v3"}


def capability_error_payload(exc: CSRArtifactError) -> dict[str, Any]:
    code = getattr(exc, "code", "CSR_ARTIFACT_ERROR")
    return {"code": code, "error": str(exc)}


__all__ = [
    "ArtifactContextRegistry",
    "ArtifactDatasetContext",
    "ArtifactResolver",
    "ResolvedArtifact",
    "artifact_context_registry",
    "artifact_resolver",
    "capability_error_payload",
    "context_for_session",
    "is_artifact_session",
]
