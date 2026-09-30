# Publish chromosome 2 under its original name

The temporary `_v4` rollout naming is superseded by
[stable artifact publication](publish-csr-artifacts.md).

Use `1kg_chr2.trees.tsz.artifact` in Google Storage and keep existing dataset
URLs unchanged. The current reader selects the format from the manifest.
The new publisher can reuse the temporary `_v4` upload and delete it, along
with superseded data, only after the canonical dataset loads and renders
successfully in production.

Do not use the earlier raw `rsync` commands to overwrite an active artifact:
its old manifest could otherwise point at partially replaced shard files.
