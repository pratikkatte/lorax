"""Runtime discovery and shared contexts for artifact-backed datasets."""

from __future__ import annotations

import json
import logging
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from lorax.artifacts.csr_builder import source_locator_key
from lorax.artifacts.csr_reader import (
    CSRArtifactCorruptError,
    CSRArtifactError,
    CSRArtifactReader,
)
from lorax.artifacts.metrics import csr_artifact_metrics
from lorax.constants import (
    CSR_ARTIFACT_ROOT,
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
    """Resolve canonical source paths to validated local CSR artifacts."""

    def __init__(self, artifact_root: str | Path = CSR_ARTIFACT_ROOT):
        self.artifact_root = Path(artifact_root).expanduser().resolve()
        self._lock = threading.RLock()
        self._manifest_index: dict[str, ResolvedArtifact] | None = None
        self._unhealthy: set[str] = set()

    @property
    def locator_directory(self) -> Path:
        return self.artifact_root / "locators"

    def _allowed_artifact_path(self, value: str | Path) -> Path | None:
        candidate = Path(value).expanduser().resolve()
        try:
            candidate.relative_to(self.artifact_root)
        except ValueError:
            return None
        return candidate

    @staticmethod
    def _resolved_from_payload(
        source_path: Path,
        payload: dict[str, Any],
    ) -> ResolvedArtifact | None:
        artifact_directory = payload.get("artifact_directory")
        fingerprint = payload.get("fingerprint")
        artifact_format = payload.get("format")
        schema_version = payload.get("schema_version")
        if not all(
            value is not None
            for value in (
                artifact_directory,
                fingerprint,
                artifact_format,
                schema_version,
            )
        ):
            return None
        return ResolvedArtifact(
            source_path=str(source_path),
            artifact_directory=str(artifact_directory),
            fingerprint=str(fingerprint),
            artifact_format=str(artifact_format),
            schema_version=int(schema_version),
        )

    def _read_locator(self, source_path: Path) -> ResolvedArtifact | None:
        locator_name = f"{source_locator_key(source_path)}.json"
        locator = next(
            (
                directory / locator_name
                for directory in (self.locator_directory, self.artifact_root / ".locators")
                if (directory / locator_name).is_file()
            ),
            None,
        )
        if locator is None:
            return None
        try:
            payload = json.loads(locator.read_text(encoding="utf-8"))
        except Exception:
            csr_artifact_metrics.increment("resolution.corrupt_locator")
            return None
        if str(Path(payload.get("source_path", "")).expanduser().resolve()) != str(
            source_path
        ):
            return None
        if source_path.exists():
            stat = source_path.stat()
            if (
                int(payload.get("source_size_bytes", -1)) != stat.st_size
                or int(payload.get("source_mtime_ns", -1)) != stat.st_mtime_ns
            ):
                csr_artifact_metrics.increment("resolution.stale")
                return None
        resolved = self._resolved_from_payload(source_path, payload)
        if resolved is None:
            return None
        allowed = self._allowed_artifact_path(resolved.artifact_directory)
        if allowed is None:
            csr_artifact_metrics.increment("resolution.outside_root")
            return None
        return ResolvedArtifact(
            source_path=resolved.source_path,
            artifact_directory=str(allowed),
            fingerprint=resolved.fingerprint,
            artifact_format=resolved.artifact_format,
            schema_version=resolved.schema_version,
        )

    def _scan_manifests(self) -> dict[str, ResolvedArtifact]:
        index: dict[str, ResolvedArtifact] = {}
        patterns = ("v3/*/manifest.json", "v2/*/manifest.json", "*/manifest.json")
        seen: set[Path] = set()
        for pattern in patterns:
            for manifest_path in self.artifact_root.glob(pattern):
                resolved_manifest = manifest_path.resolve()
                if resolved_manifest in seen:
                    continue
                seen.add(resolved_manifest)
                try:
                    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
                    source_path = Path(payload["source"]["path"]).expanduser().resolve()
                    resolved = ResolvedArtifact(
                        source_path=str(source_path),
                        artifact_directory=str(manifest_path.parent.resolve()),
                        fingerprint=str(payload["fingerprint"]),
                        artifact_format=str(payload["format"]),
                        schema_version=int(payload["schema_version"]),
                    )
                except Exception:
                    continue
                allowed = self._allowed_artifact_path(resolved.artifact_directory)
                if allowed is None:
                    continue
                current = index.get(str(source_path))
                if current is None or resolved.schema_version > current.schema_version:
                    index[str(source_path)] = resolved
        return index

    def resolve(self, source: str | Path) -> ResolvedArtifact | None:
        source_path = Path(source).expanduser().resolve()
        with self._lock:
            resolved = self._read_locator(source_path)
            resolved_from_locator = resolved is not None
            if resolved is None:
                if self._manifest_index is None:
                    self._manifest_index = self._scan_manifests()
                resolved = self._manifest_index.get(str(source_path))
            if resolved is None:
                csr_artifact_metrics.increment("resolution.miss")
                return None
            if resolved.fingerprint in self._unhealthy:
                csr_artifact_metrics.increment("resolution.unhealthy")
                return None
            artifact_path = Path(resolved.artifact_directory)
            if not (artifact_path / "manifest.json").is_file():
                csr_artifact_metrics.increment("resolution.missing")
                return None
            if source_path.exists() and not resolved_from_locator:
                try:
                    manifest = json.loads(
                        (artifact_path / "manifest.json").read_text(encoding="utf-8")
                    )
                    source_metadata = manifest["source"]
                    stat = source_path.stat()
                    if (
                        int(source_metadata["size_bytes"]) != stat.st_size
                        or int(source_metadata["mtime_ns"]) != stat.st_mtime_ns
                    ):
                        csr_artifact_metrics.increment("resolution.stale")
                        return None
                except Exception:
                    csr_artifact_metrics.increment("resolution.corrupt_manifest")
                    return None
            return resolved

    def mark_unhealthy(self, fingerprint: str) -> None:
        with self._lock:
            self._unhealthy.add(str(fingerprint))
        csr_artifact_metrics.increment("artifact.marked_unhealthy")

    def reset(self) -> None:
        with self._lock:
            self._manifest_index = None
            self._unhealthy.clear()


class ArtifactContextRegistry:
    """Process-local bounded LRU of shared readers keyed by fingerprint."""

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
        with self._lock:
            cached = self._contexts.pop(resolved.fingerprint, None)
            if cached is not None:
                self._contexts[resolved.fingerprint] = cached
                csr_artifact_metrics.increment("context.hit")
                return cached
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
            self._contexts[resolved.fingerprint] = context
            while len(self._contexts) > self.max_contexts:
                _fingerprint, evicted = self._contexts.popitem(last=False)
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

    def discard(self, fingerprint: str) -> None:
        with self._lock:
            context = self._contexts.pop(str(fingerprint), None)
        if context is not None:
            context.close()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "contexts": len(self._contexts),
                "fingerprints": list(self._contexts),
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
