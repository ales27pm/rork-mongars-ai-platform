#!/usr/bin/env bash
set -euo pipefail

echo "[eas][ruby] Ruby: $(ruby -v)"
echo "[eas][ruby] Gem : $(gem -v)"

echo "[eas][ruby] GEM_HOME=${GEM_HOME:-<unset>}"
echo "[eas][ruby] GEM_PATH=${GEM_PATH:-<unset>}"

install_gem_if_missing() {
  local name="$1"
  local version="${2:-}"

  if gem list -i "$name" > /dev/null 2>&1; then
    echo "[eas][ruby] gem '$name' already installed"
    return 0
  fi

  if [[ -n "$version" ]]; then
    echo "[eas][ruby] Installing gem '$name' ($version)…"
    gem install "$name" -v "$version" --no-document
  else
    echo "[eas][ruby] Installing gem '$name' (latest)…"
    gem install "$name" --no-document
  fi
}

install_gem_if_missing "cocoapods-spm"

ruby -e "require 'cocoapods-spm'; puts '[eas][ruby] cocoapods-spm: OK'"
