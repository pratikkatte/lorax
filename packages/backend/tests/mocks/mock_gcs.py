"""
Mock GCS (Google Cloud Storage) for Testing

Local filesystem-based mock that implements the GCS interface
used by Lorax for file storage and retrieval.
"""

import os
import shutil
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


@dataclass
class MockBlob:
    """Represents a mock GCS blob."""
    name: str
    bucket_name: str
    local_path: Path
    size: int = 0
    etag: Optional[str] = None

    @property
    def exists(self) -> bool:
        return self.local_path.exists()

    def download_to_filename(self, destination: str):
        """Download blob to local file."""
        shutil.copy2(self.local_path, destination)

    def upload_from_filename(self, source: str):
        """Upload local file to blob."""
        self.local_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, self.local_path)
        self.size = Path(source).stat().st_size


class MockGCSBucket:
    """
    Mock GCS bucket backed by local filesystem.

    Implements the subset of GCS API used by Lorax:
    - blob()
    - list_blobs()
    """

    def __init__(self, bucket_name: str, base_dir: Optional[Path] = None):
        self.name = bucket_name
        self.base_dir = base_dir or Path("/tmp/mock_gcs") / bucket_name
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._blobs: Dict[str, MockBlob] = {}

    def blob(self, name: str) -> MockBlob:
        """Get a blob reference."""
        if name not in self._blobs:
            local_path = self.base_dir / name
            self._blobs[name] = MockBlob(
                name=name,
                bucket_name=self.name,
                local_path=local_path,
                size=local_path.stat().st_size if local_path.exists() else 0
            )
        return self._blobs[name]

    def list_blobs(self, prefix: str = "") -> List[MockBlob]:
        """List all blobs with optional prefix filter."""
        blobs = []
        for path in self.base_dir.rglob("*"):
            if path.is_file():
                rel_path = path.relative_to(self.base_dir)
                name = str(rel_path)
                if name.startswith(prefix):
                    blob = self.blob(name)
                    blobs.append(blob)
        return blobs

    def upload_file(self, local_path: str, blob_name: str) -> MockBlob:
        """Upload a file to the bucket."""
        blob = self.blob(blob_name)
        blob.upload_from_filename(local_path)
        return blob

    def download_file(self, blob_name: str, destination: str) -> bool:
        """Download a file from the bucket."""
        blob = self.blob(blob_name)
        if not blob.exists:
            return False
        blob.download_to_filename(destination)
        return True

    def exists(self, blob_name: str) -> bool:
        """Check if a blob exists."""
        blob = self.blob(blob_name)
        return blob.exists

    def delete_blob(self, blob_name: str) -> bool:
        """Delete a blob."""
        blob = self.blob(blob_name)
        if blob.exists:
            blob.local_path.unlink()
            del self._blobs[blob_name]
            return True
        return False

    def clear(self):
        """Clear all blobs in the bucket."""
        if self.base_dir.exists():
            shutil.rmtree(self.base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._blobs.clear()


class MockGCSClient:
    """Mock GCS client for testing."""

    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path("/tmp/mock_gcs")
        self._buckets: Dict[str, MockGCSBucket] = {}

    def bucket(self, bucket_name: str) -> MockGCSBucket:
        """Get a bucket reference."""
        if bucket_name not in self._buckets:
            self._buckets[bucket_name] = MockGCSBucket(
                bucket_name=bucket_name,
                base_dir=self.base_dir / bucket_name
            )
        return self._buckets[bucket_name]

    def list_buckets(self) -> List[MockGCSBucket]:
        """List all buckets."""
        return list(self._buckets.values())

    def cleanup(self):
        """Clean up all mock data."""
        for bucket in self._buckets.values():
            bucket.clear()
        self._buckets.clear()


# Async wrapper functions matching Lorax's gcs_utils interface
async def mock_download_gcs_file(bucket_name: str, blob_path: str, destination: str) -> bool:
    """Mock async GCS download."""
    client = MockGCSClient()
    bucket = client.bucket(bucket_name)
    return await asyncio.to_thread(bucket.download_file, blob_path, destination)


async def mock_upload_to_gcs(bucket_name: str, local_path: Path, sid: str) -> str:
    """Mock async GCS upload."""
    client = MockGCSClient()
    bucket = client.bucket(bucket_name)
    blob_name = f"Uploads/{sid}/{local_path.name}"
    await asyncio.to_thread(bucket.upload_file, str(local_path), blob_name)
    return f"gs://{bucket_name}/{blob_name}"
