#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script_path="${project_root}/scripts/create_zenodo_archive.sh"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

make_repo() {
  local repo_path="$1"
  local readme_text="$2"

  mkdir -p "${repo_path}"
  git -C "${repo_path}" init -q
  git -C "${repo_path}" config user.name "Lorax Test"
  git -C "${repo_path}" config user.email "lorax-test@example.com"
  printf '%s\n' "${readme_text}" > "${repo_path}/README.md"
  printf 'MIT\n' > "${repo_path}/LICENSE"
  git -C "${repo_path}" add README.md LICENSE
  git -C "${repo_path}" commit -q -m "initial commit"
  git -C "${repo_path}" tag v0.1.0
}

main_repo="${tmp_dir}/lorax"
plugin_repo="${tmp_dir}/lorax-plugin"
make_repo "${main_repo}" "Lorax main source"
make_repo "${plugin_repo}" "Lorax plugin source"

(
  cd "${main_repo}"
  "${script_path}" v0.1.0 "${plugin_repo}"
)

archive="${main_repo}/dist/zenodo/lorax-zenodo-v0.1.0.zip"
test -f "${archive}"

listing="$(unzip -Z1 "${archive}")"
grep -qx 'lorax-zenodo-v0.1.0/MANIFEST.md' <<< "${listing}"
grep -qx 'lorax-zenodo-v0.1.0/lorax/README.md' <<< "${listing}"
grep -qx 'lorax-zenodo-v0.1.0/lorax-plugin/README.md' <<< "${listing}"
grep -qx 'lorax-zenodo-v0.1.0/lorax_COMMIT.txt' <<< "${listing}"
grep -qx 'lorax-zenodo-v0.1.0/lorax-plugin_COMMIT.txt' <<< "${listing}"

extract_dir="${tmp_dir}/extract"
mkdir -p "${extract_dir}"
unzip -q "${archive}" 'lorax-zenodo-v0.1.0/MANIFEST.md' -d "${extract_dir}"

main_sha="$(git -C "${main_repo}" rev-parse v0.1.0)"
plugin_sha="$(git -C "${plugin_repo}" rev-parse v0.1.0)"
manifest="${extract_dir}/lorax-zenodo-v0.1.0/MANIFEST.md"
grep -q "lorax commit: ${main_sha}" "${manifest}"
grep -q "lorax-plugin commit: ${plugin_sha}" "${manifest}"
