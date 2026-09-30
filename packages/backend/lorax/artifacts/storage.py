"""Storage-neutral access to the files that make up a CSR artifact."""

from __future__ import annotations

import hashlib
import io
import os
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any, BinaryIO
from urllib.parse import unquote, urlsplit

import numpy as np
import pyarrow as pa
from google.api_core.exceptions import NotFound

from lorax.artifacts.metrics import csr_artifact_metrics

RANGE_CACHE_BYTES = 32 * 1024 * 1024


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

    def read_manifest(self) -> tuple[bytes, str]:
        data = self.read_bytes("manifest.json")
        return data, hashlib.sha256(data).hexdigest()

    def read_verified(self, name: str, metadata: dict[str, Any]) -> bytes:
        data = self.read_bytes(name)
        if len(data) != int(metadata["size_bytes"]):
            raise ValueError(f"Size mismatch for {name}")
        if hashlib.sha256(data).hexdigest() != metadata["sha256"]:
            raise ValueError(f"Checksum mismatch for {name}")
        return data

    def close(self) -> None:
        pass

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


class _GCSRangeReader(io.RawIOBase):
    """Independent cursor over a store's shared, bounded range cache."""

    def __init__(self, store, name: str):
        super().__init__()
        self.store = store
        self.name = name
        self.position = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        self._checkClosed()
        return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        self._checkClosed()
        if whence == io.SEEK_SET:
            position = offset
        elif whence == io.SEEK_CUR:
            position = self.position + offset
        elif whence == io.SEEK_END:
            position = self.store.size(self.name) + offset
        else:
            raise ValueError("Invalid seek origin")
        if position < 0:
            raise ValueError("Negative seek position")
        self.position = position
        return position

    def read(self, size=-1):
        self._checkClosed()
        available = max(0, self.store.size(self.name) - self.position)
        size = available if size is None or size < 0 else min(size, available)
        data = self.store.read_range(self.name, self.position, size)
        self.position += len(data)
        return data

    def readinto(self, buffer):
        data = self.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)


class GCSArtifactStore(ArtifactStore):
    """Generation-pinned GCS reads with an LRU shared by every open shard."""

    remote = True

    def __init__(self, location: str, *, client=None, max_cache_bytes=RANGE_CACHE_BYTES):
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
        self._blobs: dict[str, Any] = {}
        self._ranges: OrderedDict[tuple[str, int], bytes] = OrderedDict()
        self._range_bytes = 0
        self.max_cache_bytes = max(0, int(max_cache_bytes))
        self._lock = threading.RLock()
        try:
            requested_chunk_size = int(
                os.getenv(
                    "LORAX_GCS_ARTIFACT_CHUNK_BYTES",
                    str(256 * 1024),
                )
            )
        except ValueError:
            requested_chunk_size = 256 * 1024
        # Keep the existing environment setting in 256 KiB quanta.
        quantum = 256 * 1024
        self.chunk_size = max(quantum, requested_chunk_size // quantum * quantum)

    def _blob(self, name: str):
        if name not in self._blobs:
            object_name = f"{self.prefix}/{name}" if self.prefix else name
            self._blobs[name] = self.bucket.blob(object_name)
        return self._blobs[name]

    def _download(self, blob, **kwargs) -> bytes:
        csr_artifact_metrics.increment("storage.requests")
        csr_artifact_metrics.increment("storage.download_requests")
        with csr_artifact_metrics.timer("storage.download"):
            try:
                data = blob.download_as_bytes(**kwargs)
            except NotFound as exc:
                raise FileNotFoundError(blob.name) from exc
        csr_artifact_metrics.increment("storage.transferred_bytes", len(data))
        return data

    def read_bytes(self, name: str) -> bytes:
        with self._lock:
            data = self._download(self._blob(name))
            self._sizes[name] = len(data)
            return data

    def read_manifest(self) -> tuple[bytes, str]:
        data = self.read_bytes("manifest.json")
        generation = getattr(self._blob("manifest.json"), "generation", None)
        return data, str(generation) if generation is not None else hashlib.sha256(data).hexdigest()

    def size(self, name: str) -> int:
        cached = self._sizes.get(name)
        if cached is not None:
            return cached
        blob = self._blob(name)
        try:
            csr_artifact_metrics.increment("storage.requests")
            csr_artifact_metrics.increment("storage.metadata_requests")
            blob.reload()
        except NotFound as exc:
            raise FileNotFoundError(name) from exc
        if blob.size is None:
            raise FileNotFoundError(name)
        size = int(blob.size)
        self._sizes[name] = size
        return size

    def open_binary(self, name: str) -> BinaryIO:
        return _GCSRangeReader(self, name)

    def read_range(self, name: str, start: int, length: int) -> bytes:
        if length <= 0:
            return b""
        with self._lock:
            size = self.size(name)
            end = min(size, start + length)
            parts = []
            while start < end:
                page = start // self.chunk_size * self.chunk_size
                key = (name, page)
                data = self._ranges.pop(key, None)
                if data is None:
                    csr_artifact_metrics.increment("range_cache.miss")
                    stop = min(size, page + self.chunk_size)
                    # Coalesce consecutive missing pages for large Arrow batches
                    # and the 8 MiB streaming checksum reads used by verify().
                    while stop < end and (name, stop) not in self._ranges:
                        stop = min(size, stop + self.chunk_size)
                    data = self._download(
                        self._blob(name), start=page, end=stop - 1, checksum=None,
                    )
                    if len(data) != stop - page:
                        raise ValueError(f"Truncated range for {name}")
                    for offset in range(0, len(data), self.chunk_size):
                        cached_page = data[offset:offset + self.chunk_size]
                        if len(cached_page) <= self.max_cache_bytes:
                            self._ranges[name, page + offset] = cached_page
                            self._range_bytes += len(cached_page)
                            self._evict_ranges()
                    parts.append(data[start - page:min(end, stop) - page])
                    start = min(end, stop)
                    continue
                else:
                    csr_artifact_metrics.increment("range_cache.hit")
                self._ranges[key] = data
                stop = min(end, page + len(data))
                parts.append(data[start - page:stop - page])
                start = stop
            return b"".join(parts)

    def _evict_ranges(self) -> None:
        while self._range_bytes > self.max_cache_bytes:
            _, evicted = self._ranges.popitem(last=False)
            self._range_bytes -= len(evicted)
            csr_artifact_metrics.increment("range_cache.eviction")

    def open_arrow(self, name: str) -> pa.NativeFile:
        # Arrow IPC seeks to its footer and then to requested record batches.
        # Independent cursors share cached ranges, including backward seeks.
        return pa.PythonFile(self.open_binary(name), mode="r")

    def load_numpy(self, name: str) -> np.ndarray:
        # NPY indexes are loaded once. Large genealogy data remains in ranged
        # Arrow shard reads rather than being downloaded wholesale.
        return np.load(io.BytesIO(self.read_bytes(name)), allow_pickle=False)

    def close(self) -> None:
        with self._lock:
            self._ranges.clear()
            self._range_bytes = 0
            self._blobs.clear()
            self._sizes.clear()


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
