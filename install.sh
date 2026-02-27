#!/usr/bin/env bash
set -euo pipefail

# barf installer — downloads the correct binary from GitHub Releases
# Usage: curl -fsSL <raw-url>/install.sh | bash
#   or:  bash install.sh [--install-dir /path/to/bin]

REPO="danielstedman/barf-ts"
INSTALL_DIR="${HOME}/.local/bin"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)      echo "Unsupported OS: ${OS}. Use install.ps1 on Windows." >&2; exit 1 ;;
esac

case "${ARCH}" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)             echo "Unsupported architecture: ${ARCH}" >&2; exit 1 ;;
esac

BINARY="barf-${os}-${arch}"

echo "Detecting platform: ${os}-${arch}"
echo "Binary: ${BINARY}"

# Prefer gh CLI for private repos; fall back to curl with GITHUB_TOKEN
if command -v gh &>/dev/null; then
  echo "Downloading latest release via gh CLI..."
  TAG="$(gh release view --repo "${REPO}" --json tagName -q .tagName)"
  gh release download "${TAG}" --repo "${REPO}" --pattern "${BINARY}" --dir /tmp --clobber
else
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    echo "Error: gh CLI not found and GITHUB_TOKEN not set." >&2
    echo "Install gh (https://cli.github.com) or export GITHUB_TOKEN." >&2
    exit 1
  fi
  echo "Downloading latest release via curl..."
  TAG="$(curl -fsSL -H "Authorization: token ${GITHUB_TOKEN}" \
    "https://api.github.com/repos/${REPO}/releases/latest" | grep -o '"tag_name":"[^"]*"' | head -1 | cut -d'"' -f4)"
  ASSET_URL="$(curl -fsSL -H "Authorization: token ${GITHUB_TOKEN}" \
    "https://api.github.com/repos/${REPO}/releases/tags/${TAG}" \
    | grep -o "\"browser_download_url\":\"[^\"]*${BINARY}\"" | head -1 | cut -d'"' -f4)"
  curl -fsSL -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/octet-stream" \
    -o "/tmp/${BINARY}" "${ASSET_URL}"
fi

mkdir -p "${INSTALL_DIR}"
mv "/tmp/${BINARY}" "${INSTALL_DIR}/barf"
chmod +x "${INSTALL_DIR}/barf"

echo ""
echo "Installed barf to ${INSTALL_DIR}/barf"
echo ""

# Check PATH
if ! echo "${PATH}" | tr ':' '\n' | grep -qx "${INSTALL_DIR}"; then
  echo "NOTE: ${INSTALL_DIR} is not in your PATH."
  echo "Add it:  export PATH=\"${INSTALL_DIR}:\${PATH}\""
  echo ""
fi

echo "Prerequisites:"
echo "  - claude CLI (required): https://claude.ai/download"
echo "  - gh CLI (optional, for GitHub Issues provider): https://cli.github.com"
echo ""
echo "Get started:  cd your-project && barf init"
