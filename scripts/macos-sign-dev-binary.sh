#!/usr/bin/env bash
# Sign the Tauri dev binary with a stable identifier so Screen Recording TCC
# survives rebuilds better than linker ad-hoc signing (CDHash churn).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${DANGO_DEV_BIN:-$ROOT/src-tauri/target/debug/dango}"
IDENTIFIER="${DANGO_CODE_IDENTIFIER:-io.github.nikethai.dango}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macos-sign-dev-binary: skip (not macOS)"
  exit 0
fi

if [[ ! -x "$BIN" ]]; then
  echo "macos-sign-dev-binary: binary not found: $BIN" >&2
  exit 1
fi

# Prefer a real Apple Development cert (TeamID-stable). Fall back to ad-hoc with fixed -i.
IDENTITY="${DANGO_CODESIGN_IDENTITY:-}"
if [[ -z "$IDENTITY" ]]; then
  IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null | awk -F'\"' '/Apple Development|Developer ID Application|Mac Developer/{print $2; exit}')"
fi
if [[ -z "$IDENTITY" ]]; then
  IDENTITY="-"
fi

echo "macos-sign-dev-binary: signing"
echo "  binary:     $BIN"
echo "  identity:   $IDENTITY"
echo "  identifier: $IDENTIFIER"

# --force replaces linker-signed ad-hoc identity.
# Do not use --options runtime for debug (can break local dylib loading).
codesign --force --sign "$IDENTITY" --identifier "$IDENTIFIER" "$BIN"
codesign -dv --verbose=2 "$BIN" 2>&1 | sed -n '1,12p'
echo "macos-sign-dev-binary: done"
