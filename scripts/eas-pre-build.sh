#!/usr/bin/env bash
set -euo pipefail

# EAS iOS builds occasionally fail with:
#   module map file '.../GeneratedModuleMaps-iphoneos/Cmlx.modulemap' not found
# This is caused by cocoapods-spm injecting a -fmodule-map-file flag for an SPM
# Clang target that Xcode does not generate a modulemap for during Archive.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IOS_DIR="${ROOT_DIR}/ios"
PODS_DIR="${IOS_DIR}/Pods"

if [[ ! -d "${IOS_DIR}" ]]; then
  echo "[eas-pre-build] No ios directory found; skipping iOS project cleanup."
  exit 0
fi

if [[ ! -d "${PODS_DIR}" ]]; then
  echo "[eas-pre-build] No ios/Pods directory found; skipping CocoaPods cleanup."
  exit 0
fi

echo "[eas-pre-build] Sanitising iOS generated projects (modulemaps + explicit modules)…"

python_patch_file() {
  local file="$1"
  python3 - "$file" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
  data = path.read_text(encoding="utf-8", errors="ignore")
except Exception:
  sys.exit(0)

orig = data

# 1) Remove any stale -fmodule-map-file flag pointing at Cmlx.modulemap (or any raw token)
data = re.sub(r'-fmodule-map-file(=|\s+)[^\s"\']*Cmlx\.modulemap[^\s"\']*', '', data, flags=re.I)
data = re.sub(r'[^\s"\']*Cmlx\.modulemap[^\s"\']*', '', data, flags=re.I)

# 2) Force explicit modules OFF anywhere it was set to YES
data = re.sub(
  r'(_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES|SWIFT_ENABLE_EXPLICIT_MODULES)\s*=\s*YES\s*;',
  r'\1 = NO;',
  data,
)
data = re.sub(
  r'(_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES|SWIFT_ENABLE_EXPLICIT_MODULES)\s*=\s*YES\s*$',
  r'\1 = NO',
  data,
  flags=re.M,
)

# 3) If this is an .xcconfig, ensure the setting exists (even if it wasn't present)
if path.suffix.lower() == ".xcconfig":
  if not re.search(r'(^|\n)\s*SWIFT_ENABLE_EXPLICIT_MODULES\s*=\s*', data):
    data = data.rstrip() + "\n\n# Force-disable Explicitly Built Modules for archive stability\nSWIFT_ENABLE_EXPLICIT_MODULES = NO\n"
  if not re.search(r'(^|\n)\s*_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES\s*=\s*', data):
    data = data.rstrip() + "_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES = NO\n"

if data != orig:
  path.write_text(data, encoding="utf-8")
PY
}

echo "[eas-pre-build] (1/3) Patching xcconfig and pbxproj files…"

# CocoaPods xcconfigs + any other generated xcconfigs
while IFS= read -r f; do
  python_patch_file "$f"
done < <(find "${IOS_DIR}" -type f \( -name "*.xcconfig" -o -path "*/project.pbxproj" \) 2>/dev/null || true)

echo "[eas-pre-build] (2/3) Verifying explicit modules are disabled in key CocoaPods support configs…"

# Some CI environments set SWIFT_ENABLE_EXPLICIT_MODULES implicitly; ensuring it's present in the
# aggregate Pods configs makes the setting flow into the app target too.
while IFS= read -r f; do
  if [[ -f "$f" ]]; then
    python_patch_file "$f"
  fi
done < <(find "${PODS_DIR}/Target Support Files" -maxdepth 2 -type f -name "*.xcconfig" 2>/dev/null || true)

echo "[eas-pre-build] (3/3) Fail-fast sanity checks…"

if grep -Rqi "Cmlx\.modulemap" "${IOS_DIR}"; then
  echo "[eas-pre-build] ERROR: Cmlx.modulemap references still present after patching."
  echo "[eas-pre-build] Showing remaining hits (first 80):"
  grep -Rni "Cmlx\.modulemap" "${IOS_DIR}" | head -n 80 || true
  exit 1
fi

if grep -Rqi "SWIFT_ENABLE_EXPLICIT_MODULES[[:space:]]*=[[:space:]]*YES" "${IOS_DIR}"; then
  echo "[eas-pre-build] ERROR: SWIFT_ENABLE_EXPLICIT_MODULES is still YES somewhere under ios/."
  echo "[eas-pre-build] Showing remaining hits (first 80):"
  grep -Rni "SWIFT_ENABLE_EXPLICIT_MODULES[[:space:]]*=[[:space:]]*YES" "${IOS_DIR}" | head -n 80 || true
  exit 1
fi

echo "[eas-pre-build] ✅ iOS modulemap + explicit module settings sanitised. Proceeding with build."
