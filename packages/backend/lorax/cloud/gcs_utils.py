from google.cloud import storage
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import zoneinfo
import aiofiles
import asyncio
import requests
import aiohttp
import os

BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")

def get_gcs_client():
    return storage.Client()


async def _download_gcs_file_direct(bucket_name: str, blob_path: str, local_path: str):
    """
    Internal: Download a public GCS blob to a local file.

    Args:
        bucket_name (str): Name of the public GCS bucket (e.g. "lorax_projects")
        blob_path (str): Path inside the bucket (e.g. "1000Genomes/1kg_chr20.trees.tsz")
        local_path (str): Local destination path (e.g. "uploads/1kg_chr20.trees.tsz")
    """
    url = f"https://storage.googleapis.com/{bucket_name}/{blob_path}"
    Path(local_path).parent.mkdir(parents=True, exist_ok=True)

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Failed to download {url} (HTTP {resp.status})")

            async with aiofiles.open(local_path, "wb") as f:
                while chunk := await resp.content.read(1024 * 1024):  # 1 MB chunks
                    await f.write(chunk)

    return Path(local_path)


async def download_gcs_file(bucket_name: str, blob_path: str, local_path: str):
    """
    Asynchronously download a public GCS blob to a local file.
    Uses disk cache if available for automatic caching and eviction.

    Args:
        bucket_name (str): Name of the public GCS bucket (e.g. "lorax_projects")
        blob_path (str): Path inside the bucket (e.g. "1000Genomes/1kg_chr20.trees.tsz")
        local_path (str): Local destination path (e.g. "uploads/1kg_chr20.trees.tsz")

    Returns:
        Path to the downloaded file
    """
    # Import here to avoid circular imports
    from lorax.context import disk_cache_manager

    if disk_cache_manager.enabled:
        # Use disk cache for managed downloads
        async def download_func(path: str):
            await _download_gcs_file_direct(bucket_name, blob_path, path)

        cached_path = await disk_cache_manager.get_or_download(
            bucket_name, blob_path, download_func
        )

        # If local_path differs from cached path, create a symlink or copy
        local_path_obj = Path(local_path)
        if cached_path != local_path_obj:
            local_path_obj.parent.mkdir(parents=True, exist_ok=True)
            # Symlink to cached file (avoid duplicate storage)
            if local_path_obj.exists() or local_path_obj.is_symlink():
                local_path_obj.unlink()
            try:
                local_path_obj.symlink_to(cached_path)
            except OSError:
                # Fallback: just return cached path if symlink fails
                return cached_path

        return local_path_obj
    else:
        # Direct download without caching
        return await _download_gcs_file_direct(bucket_name, blob_path, local_path)


async def download_gcs_file_cached(
    bucket_name: str,
    blob_path: str,
    disk_cache_manager=None
) -> Optional[Path]:
    """
    Download a GCS file using the disk cache manager.

    This is the preferred method for production use - it handles:
    - Distributed locking (prevents duplicate downloads across workers)
    - LRU eviction (manages disk space)
    - Access time tracking

    Args:
        bucket_name: GCS bucket name
        blob_path: Path within bucket
        disk_cache_manager: Optional cache manager (uses global if not provided)

    Returns:
        Path to cached file, or None if download failed
    """
    if disk_cache_manager is None:
        from lorax.context import disk_cache_manager

    if not disk_cache_manager.enabled:
        return None

    async def download_func(local_path: str):
        await _download_gcs_file_direct(bucket_name, blob_path, local_path)

    try:
        return await disk_cache_manager.get_or_download(
            bucket_name, blob_path, download_func
        )
    except Exception as e:
        print(f"Failed to download {blob_path} from GCS: {e}")
        return None

def get_public_gcs_dict(
    bucket_name: str,
    sid: str,
    prefix: str = "",
    projects=None,
    include_uploads: bool = False,
    uploads_sid: str | None = None,
):
    if projects is None:
        projects = {}
    api_url = f"https://storage.googleapis.com/storage/v1/b/{bucket_name}/o"
    params = {"prefix": '', "fields": "items(name)"}
    resp = requests.get(api_url, params=params)
    resp.raise_for_status()
    items = resp.json().get("items", [])

    for item in items:
        name = item['name']
        path_parts = name.split("/")
        
        # Must have at least a top-level directory (e.g., 'folder/')
        if len(path_parts) < 2:
            continue
        name_first = path_parts[0]
        second_part = path_parts[1]

        # Handle Uploads filtering
        if name_first == 'Uploads':
            if not include_uploads:
                continue
            if not uploads_sid or second_part != uploads_sid:
                continue
            # Require a filename component
            if len(path_parts) < 3:
                continue

        if name_first not in projects:
            projects[name_first] = {'folder': name_first,'files': [], 'description': ''}

        if name_first != 'Uploads' and second_part:
            if second_part not in projects[name_first]['files']:
                projects[name_first]['files'].append(second_part)
        elif name_first == 'Uploads':
            filename = path_parts[2]
            if filename not in projects[name_first]['files']:
                projects[name_first]['files'].append(filename)
    return projects
    
async def upload_to_gcs(bucket_name: str, local_path: Path, sid: str):
    """
    Upload file to GCS under session-specific folder.

    Args:
        bucket_name (str): Target GCS bucket
        local_path (Path): Local file to upload
        sid (str): Session ID (used as prefix)
    """
    blob_path = f"Uploads/{sid}/{local_path.name}"

    # Use executor to avoid blocking event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _upload_file_sync, bucket_name, local_path, blob_path)
    return f"https://storage.googleapis.com/{bucket_name}/{blob_path}"

def _upload_file_sync(bucket_name: str, local_path: Path, blob_path: str):
    """Synchronous helper called within a thread executor."""
    client = get_gcs_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(str(local_path))
    blob.custom_time = datetime.utcnow()
    pacific_tz = zoneinfo.ZoneInfo("America/Los_Angeles")
    now_pacific = datetime.now(pacific_tz)

    # Convert to UTC (GCS expects UTC timestamps)
    now_utc = now_pacific.astimezone(timezone.utc)

    # Assign custom_time so GCS lifecycle rule can delete it after 7 days
    blob.custom_time = now_utc
    blob.patch()
    # blob.make_public()  # Optional: make public for browser access
    print(f"Uploaded {local_path.name} to gs://{bucket_name}/{blob_path}")