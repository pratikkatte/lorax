"""Runtime discovery and shared contexts for artifact-backed datasets."""

from __future__ import annotations

import json
import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from lorax.artifacts.csr_builder import (
    CSR_ARTIFACT_FORMAT,
    CSR_ARTIFACT_SCHEMA_VERSION,
    CSR_ARTIFACT_V2_FORMAT,
    CSR_ARTIFACT_V2_SCHEMA_VERSION,
    CSR_ARTIFACT_V4_FORMAT,
    CSR_ARTIFACT_V4_SCHEMA_VERSION,
    artifact_path_for_source,
)
from lorax.artifacts.csr_reader import (
    CSRArtifactCorruptError,
    CSRArtifactError,
    CSRArtifactReader,
)
from lorax.artifacts.metrics import csr_artifact_metrics
from lorax.artifacts.storage import (
    ArtifactStore,
    gcs_artifact_location,
    normalize_artifact_location,
    open_artifact_store,
)
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
    manifest: dict[str, Any] | None = field(default=None, repr=False, compare=False)
    manifest_version: str | None = None
    store: ArtifactStore | None = field(default=None, repr=False, compare=False)


@dataclass
class ArtifactDatasetContext:
    artifact_directory: str
    fingerprint: str
    artifact_format: str
    schema_version: int
    capabilities: dict[str, bool]
    config: dict[str, Any]
    reader: CSRArtifactReader
    validated_at: float = field(default_factory=time.monotonic)

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
        source_path: str | Path,
        artifact_directory: str | Path,
        payload: dict[str, Any],
        *,
        manifest_version: str | None = None,
        store: ArtifactStore | None = None,
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
            (CSR_ARTIFACT_V4_FORMAT, CSR_ARTIFACT_V4_SCHEMA_VERSION),
        }:
            return None
        return ResolvedArtifact(
            source_path=str(source_path),
            artifact_directory=normalize_artifact_location(artifact_directory),
            fingerprint=str(fingerprint),
            artifact_format=str(artifact_format),
            schema_version=int(schema_version),
            manifest=payload,
            manifest_version=manifest_version,
            store=store,
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
                store = open_artifact_store(artifact_path)
                data, version = store.read_manifest()
                manifest = json.loads(data)
                resolved = self._resolved_from_manifest(
                    source_path,
                    artifact_path,
                    manifest,
                    manifest_version=version,
                    store=store,
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
                for auxiliary in (manifest.get("inputs") or {}).values():
                    auxiliary_path = Path(str(auxiliary["path"]))
                    auxiliary_stat = auxiliary_path.stat()
                    if (
                        int(auxiliary["size_bytes"]) != auxiliary_stat.st_size
                        or int(auxiliary["mtime_ns"]) != auxiliary_stat.st_mtime_ns
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

    def resolve_gcs(
        self,
        bucket_name: str,
        source_blob_path: str,
    ) -> ResolvedArtifact | None:
        """Resolve an adjacent CSR artifact directly from a GCS prefix."""
        artifact_location = gcs_artifact_location(bucket_name, source_blob_path)
        with self._lock:
            if artifact_location in self._unhealthy:
                csr_artifact_metrics.increment("resolution.unhealthy")
                return None
        try:
            store = open_artifact_store(artifact_location)
            data, version = store.read_manifest()
            manifest = json.loads(data)
            resolved = self._resolved_from_manifest(
                f"gs://{bucket_name}/{source_blob_path}",
                artifact_location,
                manifest,
                manifest_version=version,
                store=store,
            )
            if resolved is None:
                csr_artifact_metrics.increment("resolution.corrupt_manifest")
                return None
            source_metadata = manifest["source"]
            if str(source_metadata["sha256"]) != str(manifest["fingerprint"]):
                raise ValueError("Manifest source fingerprint is inconsistent")

            source_parent, separator, source_name = source_blob_path.rpartition("/")
            source_store = open_artifact_store(
                f"gs://{bucket_name}/{source_parent}"
                if separator
                else f"gs://{bucket_name}"
            )
            try:
                source_size = source_store.size(source_name)
            except FileNotFoundError:
                # Artifact-only buckets are supported. The logical source path
                # still identifies the dataset presented to the frontend.
                source_size = None
            if (
                source_size is not None
                and source_size != int(source_metadata["size_bytes"])
            ):
                csr_artifact_metrics.increment("resolution.stale")
                return None
            return resolved
        except FileNotFoundError:
            csr_artifact_metrics.increment("resolution.missing")
            return None
        except Exception as exc:
            csr_artifact_metrics.increment("resolution.corrupt_manifest")
            logger.warning(
                "Unable to resolve GCS artifact %s: %s",
                artifact_location,
                exc,
            )
            return None

    def mark_unhealthy(self, artifact_directory: str | Path) -> None:
        artifact_key = normalize_artifact_location(artifact_directory)
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
        revalidate_seconds: float = 60.0,
    ):
        self.max_contexts = max(1, int(max_contexts))
        self.max_open_shards = max(1, int(max_open_shards))
        self.revalidate_seconds = max(0.0, float(revalidate_seconds))
        self._lock = threading.RLock()
        self._contexts: OrderedDict[str, ArtifactDatasetContext] = OrderedDict()

    def open(self, resolved: ResolvedArtifact) -> ArtifactDatasetContext:
        artifact_key = normalize_artifact_location(resolved.artifact_directory)
        with self._lock:
            cached = self._contexts.pop(artifact_key, None)
            if cached is not None:
                if (
                    cached.fingerprint == resolved.fingerprint
                    and cached.artifact_format == resolved.artifact_format
                    and cached.schema_version == resolved.schema_version
                    and (resolved.manifest is None or cached.reader.manifest == resolved.manifest)
                    and (resolved.manifest_version is None or cached.reader.manifest_version == resolved.manifest_version)
                ):
                    self._contexts[artifact_key] = cached
                    if resolved.manifest is not None:
                        cached.validated_at = time.monotonic()
                    if resolved.store is not None and resolved.store is not cached.reader._store:
                        resolved.store.close()
                    csr_artifact_metrics.increment("context.hit")
                    return cached
                cached.close()
            csr_artifact_metrics.increment("context.miss")
            with csr_artifact_metrics.timer("context.open"):
                reader = CSRArtifactReader.open(
                    resolved.artifact_directory,
                    max_open_shards=self.max_open_shards,
                    manifest=resolved.manifest,
                    manifest_version=resolved.manifest_version,
                    store=resolved.store,
                )
            if str(reader.manifest["fingerprint"]) != resolved.fingerprint:
                reader.close()
                raise CSRArtifactCorruptError("Artifact fingerprint changed while opening")
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
        artifact_location = normalize_artifact_location(artifact_directory)
        with self._lock:
            cached = self._contexts.get(artifact_location)
            if cached is not None and time.monotonic() - cached.validated_at < self.revalidate_seconds:
                if expected_fingerprint is not None and cached.fingerprint != expected_fingerprint:
                    raise CSRArtifactCorruptError("Artifact fingerprint does not match session")
                self._contexts.move_to_end(artifact_location)
                csr_artifact_metrics.increment("context.hit")
                return cached
            store = open_artifact_store(artifact_location)
            try:
                data, version = store.read_manifest()
                payload = json.loads(data)
                fingerprint = str(payload["fingerprint"])
                if expected_fingerprint is not None and fingerprint != expected_fingerprint:
                    raise CSRArtifactCorruptError("Artifact fingerprint does not match session")
                resolved = ArtifactResolver._resolved_from_manifest(
                    str(payload.get("source", {}).get("path", "")),
                    artifact_location, payload, manifest_version=version, store=store,
                )
                if resolved is None:
                    raise CSRArtifactCorruptError("Unsupported artifact manifest")
                csr_artifact_metrics.increment("context.revalidation")
                return self.open(resolved)
            except Exception:
                store.close()
                self.discard(artifact_location)
                raise

    def discard(self, artifact_directory: str | Path) -> None:
        artifact_key = normalize_artifact_location(artifact_directory)
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
    if not is_artifact_session(session):
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
    return getattr(session, "dataset_backend", "legacy") in {"csr-v2", "csr-v3", "csr-v4"}


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
