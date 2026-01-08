#!/usr/bin/env bash
set -euo pipefail

# EAS iOS builds occasionally fail with:
#   module map file '.../GeneratedModuleMaps-iphoneos/Cmlx.modulemap' not found
# This is caused by cocoapods-spm injecting a -fmodule-map-file flag for an SPM
# Clang target that Xcode does not generate a modulemap for during Archive.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IOS_DIR="${ROOT_DIR}/ios"
PODS_DIR="${IOS_DIR}/Pods"

if [[ ! -d "${PODS_DIR}" ]]; then
  echo "[eas-pre-build] No ios/Pods directory found; skipping Cmlx modulemap cleanup."
  exit 0
fi

echo "[eas-pre-build] Scanning for Cmlx.modulemap references under ios/Pods…"

# 1) Strip from all CocoaPods-generated xcconfig files
XC_LIST=$(find "${PODS_DIR}/Target Support Files" -name "*.xcconfig" 2>/dev/null || true)
if [[ -n "${XC_LIST}" ]]; then
  while IFS= read -r f; do
    if grep -qi "Cmlx\.modulemap" "${f}"; then
      echo "[eas-pre-build] Stripping Cmlx.modulemap from: ${f}"
      # Remove only the modulemap flag/path to keep other flags intact.
      tmp="$(mktemp)"
      awk 'BEGIN{IGNORECASE=1} {
        line=$0
        if (line ~ /Cmlx\.modulemap/) {
          gsub(/-fmodule-map-file(=|[[:space:]]+)[^[:space:]\"]*Cmlx\.modulemap[^[:space:]\"]*/, "", line)
          gsub(/[^[:space:]\"]*Cmlx\.modulemap[^[:space:]\"]*/, "", line)
        }
        print line
      }' "${f}" > "${tmp}"
      mv "${tmp}" "${f}"
    fi
  done <<< "${XC_LIST}"
fi

# 2) Strip from Pods.xcodeproj build settings (pbxproj)
PBXPROJ="${PODS_DIR}/Pods.xcodeproj/project.pbxproj"
if [[ -f "${PBXPROJ}" ]] && grep -qi "Cmlx\.modulemap" "${PBXPROJ}"; then
  echo "[eas-pre-build] Stripping Cmlx.modulemap from: ${PBXPROJ}"
  tmp="$(mktemp)"
  awk 'BEGIN{IGNORECASE=1} {
    line=$0
    if (line ~ /Cmlx\.modulemap/) {
      gsub(/-fmodule-map-file(=|[[:space:]]+)[^[:space:]\"]*Cmlx\.modulemap[^[:space:]\"]*/, "", line)
      gsub(/[^[:space:]\"]*Cmlx\.modulemap[^[:space:]\"]*/, "", line)
    }
    print line
  }' "${PBXPROJ}" > "${tmp}"
  mv "${tmp}" "${PBXPROJ}"
fi

# 3) Sanity: fail-fast if still present (makes CI logs clearer)
if grep -Rqi "Cmlx\.modulemap" "${PODS_DIR}"; then
  echo "[eas-pre-build] ERROR: Cmlx.modulemap references still present after cleanup."
  echo "[eas-pre-build] Showing remaining hits (first 50):"
  grep -Rni "Cmlx\.modulemap" "${PODS_DIR}" | head -n 50 || true
  exit 1
fi

echo "[eas-pre-build] ✅ Cmlx.modulemap references removed. Proceeding with build."
