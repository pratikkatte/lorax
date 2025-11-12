from google.cloud import storage
from pathlib import Path
import aiofiles
import asyncio
import requests
import aiohttp
import os

BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")

def get_gcs_client():
    return storage.Client()

async def download_gcs_file(bucket_name: str, blob_path: str, local_path: str):
    """
    Asynchronously download a public GCS blob to a local file.

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

# def get_public_gcs_dict(bucket_name: str, prefix: str = ""):
#     """List all objects under a public GCS bucket and return dict {folder: [file_urls]}"""
#     api_url = f"https://storage.googleapis.com/storage/v1/b/{bucket_name}/o"
#     params = {"prefix": prefix, "fields": "items(name)"}
#     resp = requests.get(api_url, params=params)
#     resp.raise_for_status()
#     items = resp.json().get("items", [])
    
#     result = []
#     index = -1
#     project_name = None

#     print("items", items)
#     for item in items:
#         name = item["name"]
#         if not name.endswith("/"):  # skip directory placeholder objects
#             parts = name.split("/", 1)
#             if len(parts) == 2:
#                 folder, filename = parts
#                 # result.setdefault(folder, []).append(
#                 #     f"https://storage.googleapis.com/{bucket_name}/{name}"
#                 # )
#                 result[index]['files'].append(f"{name.split('/')[-1]}")
#         else:
#             project_name = name.split("/")[0]
#             index += 1
#             result.append({
#                 'name': project_name,
#                 'folder': project_name,
#                 'description': 'something about the project',
#                 'files': []
#             })
#     return result


def get_public_gcs_dict(bucket_name: str, prefix: str = "", allowed_folders: dict[str, str] = {}):
    api_url = f"https://storage.googleapis.com/storage/v1/b/{bucket_name}/o"
    params = {"prefix": prefix, "fields": "items(name)"}
    resp = requests.get(api_url, params=params)
    resp.raise_for_status()
    items = resp.json().get("items", [])

    grouped = {}
    for item in items:
        name = item["name"]
        parts = name.split("/", 1)
        if len(parts) == 2:  # has a folder prefix
            folder, filename = parts
            if filename != '' and folder in allowed_folders.keys(): grouped.setdefault(folder, []).append(filename)
        # else:
            # grouped.setdefault("root", []).append(parts[0])

    return {
        allowed_folders[k]: {"folder": k, "files": v, "description": 'something about the project'} for k, v in grouped.items()
        }


async def upload_to_gcs(bucket_name: str, local_path: Path, sid: str):
    """
    Upload file to GCS under session-specific folder.

    Args:
        bucket_name (str): Target GCS bucket
        local_path (Path): Local file to upload
        sid (str): Session ID (used as prefix)
    """
    blob_path = f"{sid}/{local_path.name}"

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
    # blob.make_public()  # Optional: make public for browser access
    print(f"✅ Uploaded {local_path.name} to gs://{bucket_name}/{blob_path}")