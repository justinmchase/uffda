#!/usr/bin/env bash
# Install the Uffda CLI from a GitHub Release onto Linux.
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
asset="uffda-${version}-${target}"
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

if ! download_with_retry "${base}/${asset}" "${tmpdir}/${asset}"; then
  echo "Failed to download ${asset}" >&2
  exit 1
fi
if ! download_with_retry "${base}/SHA256SUMS" "${tmpdir}/SHA256SUMS"; then
  echo "Failed to download SHA256SUMS" >&2
  exit 1
fi

expected="$(
  awk -v name="${asset}" '$2 == name { print $1; exit }' "${tmpdir}/SHA256SUMS"
)"
if [[ -z "${expected}" ]]; then
  echo "No checksum entry for ${asset} in SHA256SUMS" >&2
  exit 1
fi

actual="$(sha256sum "${tmpdir}/${asset}" | awk '{ print $1 }')"
if [[ "${actual}" != "${expected}" ]]; then
  echo "Checksum mismatch for ${asset}" >&2
  echo "expected: ${expected}" >&2
  echo "actual:   ${actual}" >&2
  exit 1
fi

mkdir -p "${PREFIX}"
install -m 0755 "${tmpdir}/${asset}" "${PREFIX}/uffda"

echo "Installed uffda ${version} (${target}) to ${PREFIX}/uffda"
if ! command -v uffda >/dev/null 2>&1; then
  echo "Add ${PREFIX} to your PATH to use uffda." >&2
fi
