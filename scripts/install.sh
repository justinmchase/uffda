#!/usr/bin/env bash
# Install the Uffda CLIs from a GitHub Release onto Linux.
# Installs Deno `uffda` and the Rust preview `uffdar` for the host architecture.
# Usage:
#   curl -fsSL https://github.com/justinmchase/uffda/releases/latest/download/install.sh | bash
#   UFFDA_VERSION=0.1.2 bash install.sh
#   bash install.sh 0.1.2
set -euo pipefail

REPO="${UFFDA_REPO:-justinmchase/uffda}"
PREFIX="${UFFDA_INSTALL_DIR:-${HOME}/.local/bin}"
VERSION_INPUT="${1:-${UFFDA_VERSION:-latest}}"

uname_s="$(uname -s)"
if [[ "${uname_s}" != "Linux" ]]; then
  echo "install.sh currently supports Linux only (found ${uname_s})." >&2
  echo "Use the uffda-setup GitHub Action for other platforms." >&2
  exit 1
fi

arch="$(uname -m)"
case "${arch}" in
  x86_64|amd64) target="x86_64-unknown-linux-gnu" ;;
  aarch64|arm64) target="aarch64-unknown-linux-gnu" ;;
  *)
    echo "Unsupported Linux architecture: ${arch}" >&2
    exit 1
    ;;
esac

api="https://api.github.com/repos/${REPO}/releases"
tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT
release_json="${tmpdir}/release.json"

fetch_release() {
  local url="$1"
  if curl -fsSL "${url}" -o "${release_json}"; then
    return 0
  fi
  return 1
}

if [[ "${VERSION_INPUT}" == "latest" ]]; then
  if ! fetch_release "${api}/latest"; then
    echo "Unable to resolve latest release for ${REPO}" >&2
    exit 1
  fi
else
  bare="${VERSION_INPUT#v}"
  if ! fetch_release "${api}/tags/${bare}" &&
    ! fetch_release "${api}/tags/v${bare}"; then
    echo "Unable to resolve release tag ${VERSION_INPUT} for ${REPO}" >&2
    exit 1
  fi
fi

tag_name="$(
  # shellcheck disable=SC2016
  sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' "${release_json}" | head -n1
)"
if [[ -z "${tag_name}" ]]; then
  echo "Unable to parse release tag_name" >&2
  exit 1
fi

version="${tag_name#v}"
base="https://github.com/${REPO}/releases/download/${tag_name}"

download_with_retry() {
  local url="$1"
  local out="$2"
  local attempt
  for attempt in 1 2 3 4 5; do
    if curl -fsSL "${url}" -o "${out}"; then
      return 0
    fi
    sleep "${attempt}"
  done
  return 1
}

install_asset() {
  local command_name="$1"
  local asset="$2"
  local sums_name="$3"
  local sums_path="${tmpdir}/${sums_name}"

  if ! download_with_retry "${base}/${asset}" "${tmpdir}/${asset}"; then
    echo "Failed to download ${asset}" >&2
    exit 1
  fi
  if [[ ! -f "${sums_path}" ]]; then
    if ! download_with_retry "${base}/${sums_name}" "${sums_path}"; then
      echo "Failed to download ${sums_name}" >&2
      exit 1
    fi
  fi

  local expected actual
  expected="$(
    awk -v name="${asset}" '$2 == name { print $1; exit }' "${sums_path}"
  )"
  if [[ -z "${expected}" ]]; then
    echo "No checksum entry for ${asset} in ${sums_name}" >&2
    exit 1
  fi

  actual="$(sha256sum "${tmpdir}/${asset}" | awk '{ print $1 }')"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "Checksum mismatch for ${asset}" >&2
    echo "expected: ${expected}" >&2
    echo "actual:   ${actual}" >&2
    exit 1
  fi

  install -m 0755 "${tmpdir}/${asset}" "${PREFIX}/${command_name}"
  echo "Installed ${command_name} ${version} (${target}) to ${PREFIX}/${command_name}"
}

mkdir -p "${PREFIX}"
install_asset "uffda" "uffda-${version}-${target}" "SHA256SUMS"
install_asset "uffdar" "uffdar-${version}-${target}" "UFFDAR-SHA256SUMS"

if ! command -v uffda >/dev/null 2>&1 || ! command -v uffdar >/dev/null 2>&1; then
  echo "Add ${PREFIX} to your PATH to use uffda and uffdar." >&2
fi
