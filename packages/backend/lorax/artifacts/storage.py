"""Storage-neutral access to the files that make up a CSR artifact."""

from __future__ import annotations

import hashlib
import io
import os
from pathlib import Path
from typing import Any, BinaryIO
from urllib.parse import unquote, urlsplit

import numpy as np
import pyarrow as pa
from google.api_core.exceptions import NotFound


def is_gcs_location(location: str | Path) -> bool:
    return str(location).startswith("gs://")


def normalize_artifact_location(location: str | Path) -> str:
    raw = str(location)
    if is_gcs_location(raw):
        parsed = urlsplit(raw)
        if not parsed.netloc:
            raise ValueError(f"Invalid GCS URI: {raw}")
        prefix = unquote(parsed.path.lstrip("/")).rstrip("/")
        return f"gs://{parsed.netloc}/{prefix}" if prefix else f"gs://{parsed.netloc}"
    return str(Path(raw).expanduser().resolve())


def gcs_artifact_location(bucket_name: str, source_blob_path: str) -> str:
    source_blob_path = source_blob_path.strip("/")
    return normalize_artifact_location(
        f"gs://{bucket_name}/{source_blob_path}.artifact"
    )


class ArtifactStore:
    """Synchronous object access used by the synchronous artifact reader."""

    remote = False
    location: str

    def read_bytes(self, name: str) -> bytes:
        raise NotImplementedError

    def size(self, name: str) -> int:
        raise NotImplementedError

    def open_binary(self, name: str) -> BinaryIO:
        raise NotImplementedError

    def open_arrow(self, name: str) -> pa.NativeFile:
        raise NotImplementedError

    def load_numpy(self, name: str) -> np.ndarray:
        raise NotImplementedError

    def verify(
        self,
        name: str,
        metadata: dict[str, Any],
        *,
        checksum: bool,
    ) -> None:
        try:
            actual_size = self.size(name)
        except (FileNotFoundError, NotFound) as exc:
            raise FileNotFoundError(f"Missing artifact file: {name}") from exc
        if actual_size != int(metadata["size_bytes"]):
            raise ValueError(f"Size mismatch for {name}")
        if not checksum:
            return
        digest = hashlib.sha256()
        with self.open_binary(name) as source:
            while chunk := source.read(8 * 1024 * 1024):
                digest.update(chunk)
        if digest.hexdigest() != metadata["sha256"]:
            raise ValueError(f"Checksum mismatch for {name}")


class LocalArtifactStore(ArtifactStore):
    def __init__(self, location: str | Path):
        self.root = Path(location).expanduser().resolve()
        self.location = str(self.root)

    def _path(self, name: str) -> Path:
        return self.root / name

    def read_bytes(self, name: str) -> bytes:
        return self._path(name).read_bytes()

    def size(self, name: str) -> int:
        path = self._path(name)
        if not path.is_file():
            raise FileNotFoundError(path)
        return path.stat().st_size

    def open_binary(self, name: str) -> BinaryIO:
        return self._path(name).open("rb")

    def open_arrow(self, name: str) -> pa.NativeFile:
        return pa.memory_map(str(self._path(name)), "r")

    def load_numpy(self, name: str) -> np.ndarray:
        return np.load(self._path(name), mmap_mode="r", allow_pickle=False)


class GCSArtifactStore(ArtifactStore):
    """Seekable GCS access; BlobReader turns seeks into HTTP Range requests."""

    remote = True

    def __init__(self, location: str, *, client=None):
        self.location = normalize_artifact_location(location)
        parsed = urlsplit(self.location)
        if parsed.scheme != "gs" or not parsed.netloc:
            raise ValueError(f"Invalid GCS artifact URI: {location}")
        if client is None:
            from lorax.cloud.gcs_utils import (
                get_anonymous_gcs_client,
                get_gcs_client,
            )

            auth_mode = os.getenv(
                "LORAX_GCS_ARTIFACT_AUTH", "anonymous"
            ).strip().lower()
            if auth_mode == "anonymous":
                client = get_anonymous_gcs_client()
            elif auth_mode in {"authenticated", "adc"}:
                client = get_gcs_client()
            else:
                raise ValueError(
                    "LORAX_GCS_ARTIFACT_AUTH must be 'anonymous' or "
                    "'authenticated'"
                )
        self.bucket_name = parsed.netloc
        self.prefix = unquote(parsed.path.lstrip("/")).rstrip("/")
        self.bucket = client.bucket(self.bucket_name)
        self._sizes: dict[str, int] = {}
        try:
            requested_chunk_size = int(
                os.getenv(
                    "LORAX_GCS_ARTIFACT_CHUNK_BYTES",
                    str(4 * 1024 * 1024),
                )
            )
        except ValueError:
            requested_chunk_size = 4 * 1024 * 1024
        # google-cloud-storage requires read chunks to be multiples of 256 KiB.
        quantum = 256 * 1024
        self.chunk_size = max(quantum, requested_chunk_size // quantum * quantum)

    def _blob(self, name: str):
        object_name = f"{self.prefix}/{name}" if self.prefix else name
        return self.bucket.blob(object_name)

    def read_bytes(self, name: str) -> bytes:
        return self._blob(name).download_as_bytes()

    def size(self, name: str) -> int:
        cached = self._sizes.get(name)
        if cached is not None:
            return cached
        blob = self._blob(name)
        try:
            blob.reload()
        except NotFound as exc:
            raise FileNotFoundError(name) from exc
        if blob.size is None:
            raise FileNotFoundError(name)
        size = int(blob.size)
        self._sizes[name] = size
        return size

    def open_binary(self, name: str) -> BinaryIO:
        return self._blob(name).open("rb", chunk_size=self.chunk_size)

    def open_arrow(self, name: str) -> pa.NativeFile:
        # Arrow IPC seeks to its footer and then to requested record batches.
        # Wrapping BlobReader preserves that access pattern over GCS ranges.
        return pa.PythonFile(self.open_binary(name), mode="r")

    def load_numpy(self, name: str) -> np.ndarray:
        # NPY indexes are loaded once. Large genealogy data remains in ranged
        # Arrow shard reads rather than being downloaded wholesale.
        return np.load(io.BytesIO(self.read_bytes(name)), allow_pickle=False)


def open_artifact_store(
    location: str | Path,
    *,
    gcs_client=None,
) -> ArtifactStore:
    if is_gcs_location(location):
        return GCSArtifactStore(str(location), client=gcs_client)
    return LocalArtifactStore(location)


__all__ = [
    "ArtifactStore",
    "GCSArtifactStore",
    "LocalArtifactStore",
    "gcs_artifact_location",
    "is_gcs_location",
    "normalize_artifact_location",
    "open_artifact_store",
]
