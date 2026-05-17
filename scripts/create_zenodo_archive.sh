#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/create_zenodo_archive.sh TAG [PLUGIN_REPO] [OUTPUT_DIR]

Create a single Zenodo-ready source archive containing:
  - lorax at TAG
  - lorax-plugin at TAG
  - MANIFEST.md with repository URLs and commit SHAs

Arguments:
  TAG          Git tag to archive from both repositories, for example v1.2.0.
  PLUGIN_REPO Optional path to lorax-plugin. Defaults to ../lorax-plugin.
  OUTPUT_DIR  Optional output directory. Defaults to dist/zenodo.

Example:
  scripts/create_zenodo_archive.sh v1.2.0 ../lorax-plugin
EOF
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

repo_root() {
  git -C "$1" rev-parse --show-toplevel 2>/dev/null ||
    die "not a Git repository: $1"
}

commit_for_tag() {
  local repo="$1"
  local tag="$2"

  git -C "${repo}" rev-parse --verify --quiet "${tag}^{commit}" ||
    die "tag '${tag}' was not found in ${repo}"
}

origin_url() {
  local repo="$1"

  git -C "${repo}" remote get-url origin 2>/dev/null || printf 'unknown'
}

ensure_clean_worktree() {
  local repo="$1"
  local label="$2"

  if ! git -C "${repo}" diff --quiet || ! git -C "${repo}" diff --cached --quiet; then
    die "${label} has uncommitted changes; commit or stash them before creating a citable archive"
  fi

  if [ -n "$(git -C "${repo}" ls-files --others --exclude-standard)" ]; then
    die "${label} has untracked files; commit, remove, or ignore them before creating a citable archive"
  fi
}

archive_repo() {
  local repo="$1"
  local tag="$2"
  local destination="$3"

  mkdir -p "${destination}"
  git -C "${repo}" archive --format=tar "${tag}" | tar -xf - -C "${destination}"
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

[ "$#" -ge 1 ] || {
  usage >&2
  exit 2
}

tag="$1"
plugin_arg="${2:-../lorax-plugin}"
output_arg="${3:-dist/zenodo}"

case "${tag}" in
  *..* | */* | *\\* | *[[:space:]]* | '')
    die "unsupported tag for archive filename: '${tag}'"
    ;;
esac

require_command git
require_command tar
require_command zip
require_command date

lorax_repo="$(repo_root ".")"
plugin_repo="$(repo_root "${plugin_arg}")"

case "${output_arg}" in
  /*) output_dir="${output_arg}" ;;
  *) output_dir="${lorax_repo}/${output_arg}" ;;
esac

ensure_clean_worktree "${lorax_repo}" "lorax"
ensure_clean_worktree "${plugin_repo}" "lorax-plugin"

lorax_commit="$(commit_for_tag "${lorax_repo}" "${tag}")"
plugin_commit="$(commit_for_tag "${plugin_repo}" "${tag}")"
lorax_url="$(origin_url "${lorax_repo}")"
plugin_url="$(origin_url "${plugin_repo}")"
generated_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

bundle_name="lorax-zenodo-${tag}"
archive_name="${bundle_name}.zip"
mkdir -p "${output_dir}"
archive_path="${output_dir}/${archive_name}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

bundle_dir="${tmp_dir}/${bundle_name}"
mkdir -p "${bundle_dir}"

archive_repo "${lorax_repo}" "${tag}" "${bundle_dir}/lorax"
archive_repo "${plugin_repo}" "${tag}" "${bundle_dir}/lorax-plugin"

printf '%s\n' "${lorax_commit}" > "${bundle_dir}/lorax_COMMIT.txt"
printf '%s\n' "${plugin_commit}" > "${bundle_dir}/lorax-plugin_COMMIT.txt"

cat > "${bundle_dir}/MANIFEST.md" <<EOF
# Lorax Zenodo Archive ${tag}

This archive contains source snapshots for the Lorax software release and the
Lorax metadata widget plugin. It is intended for manual upload to Zenodo as a
single software record so one DOI can cite both repositories together.

Generated at: ${generated_at}

## Included repositories

- lorax repository: ${lorax_url}
- lorax tag: ${tag}
- lorax commit: ${lorax_commit}

- lorax-plugin repository: ${plugin_url}
- lorax-plugin tag: ${tag}
- lorax-plugin commit: ${plugin_commit}

## Archive layout

- lorax/: source exported from the lorax repository at ${tag}
- lorax-plugin/: source exported from the lorax-plugin repository at ${tag}
- lorax_COMMIT.txt: exact lorax commit SHA
- lorax-plugin_COMMIT.txt: exact lorax-plugin commit SHA

EOF

rm -f "${archive_path}"
(
  cd "${tmp_dir}"
  zip -qr "${archive_path}" "${bundle_name}"
)

printf 'Created Zenodo archive: %s\n' "${archive_path}"
printf 'lorax commit: %s\n' "${lorax_commit}"
printf 'lorax-plugin commit: %s\n' "${plugin_commit}"
