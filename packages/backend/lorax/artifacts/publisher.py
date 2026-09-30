"""Publish immutable artifact files behind a stable, atomically replaced manifest."""

from __future__ import annotations

import base64
import copy
import hashlib
import json
import re
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

import google.auth.credentials
import google_crc32c
import pyarrow as pa
from google.api_core.exceptions import NotFound
from google.cloud import storage

from .csr_reader import CSRArtifactReader


def _json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2) + "\n").encode()


def _safe_name(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name:
        raise ValueError(f"Unsafe artifact filename: {name!r}")
    return name


@dataclass
class PublishFile:
    source_name: str
    name: str
    size_bytes: int
    sha256: str
    path: Path | None = None
    data: bytes | None = None


@dataclass
class Publication:
    manifest: dict
    files: list[PublishFile]

    @property
    def manifest_bytes(self):
        return _json_bytes(self.manifest)


def prepare_publication(artifact_directory: str | Path) -> Publication:
    root = Path(artifact_directory).expanduser().resolve()
    original = (root / "manifest.json").read_bytes()
    digest = hashlib.sha256(original).hexdigest()
    # A build's filenames never collide with the artifact currently being served.
    prefix = f"data/{digest}/"
    with CSRArtifactReader(root) as reader:
        manifest = copy.deepcopy(reader.manifest)
        shards = copy.deepcopy(reader._shards)
    files = []
    for metadata in [*shards, *manifest["indexes"].values()]:
        name = _safe_name(metadata["name"])
        path = (root / name).resolve()
        if not path.is_relative_to(root) or path.stat().st_size != metadata["size_bytes"]:
            raise ValueError(f"Missing or wrong-sized artifact file: {name}")
        if name != manifest["indexes"]["shards"]["name"]:
            files.append(PublishFile(name, prefix + name, metadata["size_bytes"],
                                     metadata["sha256"], path=path))
    shard_meta = manifest["indexes"]["shards"]
    with pa.memory_map(str(root / shard_meta["name"])) as source:
        schema = pa.ipc.open_file(source).schema
    for shard in shards:
        shard["name"] = prefix + shard["name"]
    output = pa.BufferOutputStream()
    with pa.ipc.new_file(output, schema) as writer:
        writer.write_table(pa.Table.from_pylist(shards, schema=schema))
    shard_bytes = output.getvalue().to_pybytes()
    files.append(PublishFile(shard_meta["name"], prefix + shard_meta["name"],
                             len(shard_bytes), hashlib.sha256(shard_bytes).hexdigest(),
                             data=shard_bytes))
    if len({item.name for item in files}) != len(files):
        raise ValueError("Artifact contains duplicate filenames")
    manifest["artifact"]["size_bytes"] += len(shard_bytes) - shard_meta["size_bytes"]
    for metadata in manifest["indexes"].values():
        metadata["name"] = prefix + metadata["name"]
    shard_meta.update(size_bytes=len(shard_bytes), sha256=hashlib.sha256(shard_bytes).hexdigest())
    manifest["publication"] = {"source_manifest_sha256": digest, "file_prefix": prefix}
    return Publication(manifest, files)


class GcloudCredentials(google.auth.credentials.Credentials):
    """Use the existing gcloud login, refreshing without exposing its token."""

    def __init__(self):
        super().__init__()
        self._refresh_lock = threading.Lock()

    def refresh(self, request):
        with self._refresh_lock:
            self.token = subprocess.check_output(
                ["gcloud", "auth", "print-access-token"], text=True,
            ).strip()
            self.expiry = datetime.utcnow() + timedelta(minutes=5)


def _location(client, uri):
    parsed = urlsplit(uri)
    prefix = parsed.path.strip("/")
    if parsed.scheme != "gs" or not parsed.netloc or not prefix.endswith(".artifact"):
        raise ValueError("Expected gs://bucket/project/filename.artifact")
    _safe_name(prefix)
    return client.bucket(parsed.netloc), prefix + "/"


def _read_manifest(bucket, prefix):
    blob = bucket.get_blob(prefix + "manifest.json")
    if blob is None:
        return None, None
    return blob, blob.download_as_bytes(if_generation_match=int(blob.generation))


def _referenced_names(bucket, prefix, manifest):
    indexes = manifest["indexes"]
    meta = indexes["shards"]
    blob = bucket.blob(prefix + _safe_name(meta["name"]))
    data = blob.download_as_bytes()
    if len(data) != meta["size_bytes"] or hashlib.sha256(data).hexdigest() != meta["sha256"]:
        raise ValueError("Existing shard index does not match its manifest")
    rows = pa.ipc.open_file(pa.BufferReader(data)).read_all().to_pylist()
    return {_safe_name(x["name"]) for x in [*indexes.values(), *rows]}


def _matches(blob, item):
    return (blob is not None and blob.size == item.size_bytes
            and (blob.metadata or {}).get("lorax-sha256") == item.sha256)


def _crc32c(path):
    checksum = google_crc32c.Checksum()
    with path.open("rb") as source:
        while block := source.read(8 * 1024 * 1024):
            checksum.update(block)
    return base64.b64encode(checksum.digest()).decode()


def smoke_load(backend_url, project, filename, manifest):
    """Exercise the same load and rendering requests as the hosted website."""
    import requests
    import socketio

    http = requests.Session()
    response = http.post(backend_url.rstrip("/") + "/init-session", timeout=30)
    response.raise_for_status()
    sid = response.json()["sid"]
    sio = socketio.Client(http_session=http, reconnection=False)
    try:
        sio.connect(backend_url, headers={"Cookie": f"lorax_sid={sid}"},
                    transports=["polling", "websocket"], wait_timeout=30)
        loaded = sio.call("load_file", {"lorax_sid": sid, "project": project,
                                        "file": filename}, timeout=120)
        config = loaded.get("config", {})
        if (not loaded.get("ok") or loaded.get("filename") != filename
                or config.get("artifact_format") != manifest["format"]
                or config.get("artifact_fingerprint") != manifest["fingerprint"]
                or config.get("interval_source") != "backend"):
            raise RuntimeError(f"Hosted load did not select the new artifact: {loaded.get('code')}")
        indices = sorted({0, min(32, int(manifest["dataset"]["num_trees"]) - 1),
                          int(manifest["dataset"]["num_trees"]) - 1})
        rendered = sio.call("process_postorder_layout", {
            "lorax_sid": sid, "displayArray": indices, "actualDisplayArray": indices,
            "timeScale": "linear", "request_id": "artifact-publication",
        }, timeout=120)
        if rendered.get("error") or not rendered.get("buffer") or sorted(rendered.get("tree_indices", [])) != indices:
            raise RuntimeError(f"Hosted rendering failed: {rendered.get('error', 'no trees')}")
        intervals = sio.call("query_intervals", {
            "lorax_sid": sid, "start": manifest["dataset"].get("sequence_start", 0),
            "end": manifest["dataset"]["sequence_length"], "maxIntervals": 2,
        }, timeout=30)
        if intervals.get("error") or not intervals.get("count"):
            raise RuntimeError("Hosted rendering fell back from the artifact reader")
        return {"artifact_format": config["artifact_format"], "filename": filename,
                "rendered_trees": indices, "render_bytes": len(rendered["buffer"]),
                "artifact_session_after_render": True}
    finally:
        if sio.connected:
            sio.disconnect()
        http.close()


def publish_artifact(artifact_directory, destination, *, reuse_from=None,
                     backend_url=None, delete_previous=False, remove_reused_prefix=False,
                     workers=8, client=None, report=print, smoke=smoke_load):
    if (delete_previous or remove_reused_prefix) and not backend_url:
        raise ValueError("Deletion requires a successful hosted load via --backend-url")
    publication = prepare_publication(artifact_directory)
    client = client or storage.Client(project="lorax-corbett-r35", credentials=GcloudCredentials())
    bucket, prefix = _location(client, destination)
    source_name = publication.manifest["source"]["name"]
    if prefix.rstrip("/").rsplit("/", 1)[-1] != source_name + ".artifact":
        raise ValueError(f"Use the stable artifact name: {source_name}.artifact")
    project = prefix.rstrip("/").rsplit("/", 1)[0]
    old_blob, old_bytes = _read_manifest(bucket, prefix)
    old_manifest = json.loads(old_bytes) if old_bytes is not None else None
    if old_manifest and old_manifest["fingerprint"] != publication.manifest["fingerprint"]:
        raise ValueError("Refusing to replace an artifact for a different source tree sequence")
    if old_manifest and int(old_manifest["schema_version"]) > int(publication.manifest["schema_version"]):
        raise ValueError("Refusing to downgrade the published artifact format")
    snapshot = {b.name: b for b in client.list_blobs(bucket, prefix=prefix)}
    previous_names = _referenced_names(bucket, prefix, old_manifest) if old_manifest else set()
    reusable, reuse_bucket, reuse_prefix = {}, None, None
    if reuse_from:
        reuse_bucket, reuse_prefix = _location(client, reuse_from)
        if reuse_bucket.name != bucket.name or reuse_prefix == prefix or reuse_prefix.rsplit("/", 2)[0] != project:
            raise ValueError("Reuse must be a separate artifact in the same project and bucket")
        reuse_leaf = reuse_prefix.rstrip("/").rsplit("/", 1)[-1]
        if re.sub(r"_v\d+(?=\.)", "", reuse_leaf) != source_name + ".artifact":
            raise ValueError("Reuse must refer to a version-suffixed copy of this dataset")
        reusable = {b.name[len(reuse_prefix):]: b for b in client.list_blobs(reuse_bucket, prefix=reuse_prefix)}

    def transfer(item):
        name = prefix + item.name
        existing = snapshot.get(name)
        if existing is not None:
            if not _matches(existing, item):
                raise ValueError(f"Conflicting immutable object: {name}")
            return "reused", item.size_bytes
        target = bucket.blob(name)
        target.metadata = {"lorax-sha256": item.sha256}
        target.cache_control = "public,max-age=31536000,immutable"
        reuse = reusable.get(item.source_name) if item.path is not None else None
        # Partial uploads have no manifest. Compare transfer checksums before
        # reusing those bytes, without running a full artifact verification pass.
        if reuse is not None and reuse.size == item.size_bytes and reuse.crc32c == _crc32c(item.path):
            token = None
            while True:
                token, _, _ = target.rewrite(reuse, token=token, if_generation_match=0,
                                            if_source_generation_match=int(reuse.generation))
                if token is None:
                    break
            kind = "copied"
        elif item.path is not None:
            target.upload_from_filename(str(item.path), if_generation_match=0, checksum="crc32c", timeout=180)
            kind = "uploaded"
        else:
            target.upload_from_string(item.data, if_generation_match=0, checksum="crc32c", timeout=180)
            kind = "uploaded"
        if not _matches(target, item):
            raise ValueError(f"Uploaded object metadata mismatch: {name}")
        return kind, item.size_bytes

    total = sum(f.size_bytes for f in publication.files)
    completed = transferred = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(transfer, item) for item in publication.files]
        try:
            for future in as_completed(futures):
                kind, size = future.result()
                completed += 1
                transferred += size
                if completed % 25 == 0 or completed == len(futures):
                    report(json.dumps({"phase": "copy", "files": completed, "total_files": len(futures),
                                       "bytes": transferred, "total_bytes": total, "last_action": kind}))
        except Exception:
            for future in futures:
                future.cancel()
            raise

    new_bytes = publication.manifest_bytes
    cleanup_blob = None
    cleanup_records = []
    if delete_previous or remove_reused_prefix:
        # Persist the exact generations before switching manifests so an
        # interrupted cleanup can resume without scanning/deleting other builds.
        cleanup_name = prefix + publication.manifest["publication"]["file_prefix"] + "publication-cleanup.json"
        cleanup_blob = bucket.get_blob(cleanup_name)
        if cleanup_blob is not None:
            cleanup_state = json.loads(cleanup_blob.download_as_bytes())
            if cleanup_state["manifest_sha256"] != hashlib.sha256(new_bytes).hexdigest():
                raise ValueError("Cleanup checkpoint belongs to another publication")
            cleanup_records = cleanup_state["objects"]
        else:
            live = {item.name for item in publication.files}
            if delete_previous:
                cleanup_records.extend({"name": b.name, "generation": int(b.generation), "kind": "previous"}
                                       for name in previous_names - live
                                       if (b := snapshot.get(prefix + name)) is not None)
            if remove_reused_prefix:
                cleanup_records.extend({"name": b.name, "generation": int(b.generation), "kind": "reused"}
                                       for b in reusable.values())
            cleanup_blob = bucket.blob(cleanup_name)
            cleanup_blob.upload_from_string(_json_bytes({"manifest_sha256": hashlib.sha256(new_bytes).hexdigest(),
                                                         "objects": cleanup_records}),
                                            if_generation_match=0, content_type="application/json")
    if old_bytes != new_bytes:
        target = bucket.blob(prefix + "manifest.json")
        target.cache_control = "no-cache,max-age=0,must-revalidate"
        target.upload_from_string(new_bytes, content_type="application/json", checksum="crc32c",
                                  if_generation_match=int(old_blob.generation) if old_blob else 0)
        published_generation = int(target.generation)
    report(json.dumps({"phase": "published", "destination": destination}))
    try:
        loaded = smoke(backend_url, project, source_name, publication.manifest) if backend_url else None
    except Exception:
        if old_bytes != new_bytes:
            # Restore the previous working entry point, without clobbering any
            # publication that raced with this load check.
            try:
                target = bucket.blob(prefix + "manifest.json")
                if old_bytes is None:
                    target.delete(if_generation_match=published_generation)
                else:
                    target.cache_control = "no-cache,max-age=0,must-revalidate"
                    target.upload_from_string(old_bytes, content_type="application/json",
                                              if_generation_match=published_generation)
                report(json.dumps({"phase": "manifest_restored"}))
            except Exception as restore_error:
                report(json.dumps({"phase": "restore_failed", "error": str(restore_error)}))
        report(json.dumps({"phase": "load_failed", "message": "Old data retained; no cleanup performed"}))
        raise
    report(json.dumps({"phase": "loaded", "result": loaded}))
    if delete_previous or remove_reused_prefix:
        # Give cached readers their normal manifest revalidation window before
        # removing files that a previous reader could still reference.
        if any(record["kind"] == "previous" for record in cleanup_records):
            report(json.dumps({"phase": "cache_grace", "seconds": 65}))
            time.sleep(65)
        _, current = _read_manifest(bucket, prefix)
        if current != new_bytes:
            raise RuntimeError("Another publication changed the manifest; cleanup cancelled")
        live = {prefix + item.name for item in publication.files} | {prefix + "manifest.json"}
        obsolete = []
        for record in cleanup_records:
            if record["kind"] == "previous" and delete_previous:
                allowed_prefix = prefix
            elif record["kind"] == "reused" and remove_reused_prefix and reuse_prefix:
                allowed_prefix = reuse_prefix
            else:
                continue
            if not record["name"].startswith(allowed_prefix) or record["name"] in live:
                raise ValueError("Unsafe object in cleanup checkpoint")
            obsolete.append(record)

        def remove(record):
            try:
                bucket.blob(record["name"]).delete(if_generation_match=record["generation"])
            except NotFound:
                pass

        with ThreadPoolExecutor(max_workers=workers) as pool:
            list(pool.map(remove, obsolete))
        if len(obsolete) == len(cleanup_records):
            cleanup_blob.delete(if_generation_match=int(cleanup_blob.generation))
        report(json.dumps({"phase": "cleaned", "removed_objects": len(obsolete)}))
    return {"destination": destination, "format": publication.manifest["format"], "loaded": loaded}
