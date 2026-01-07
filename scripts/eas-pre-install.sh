#!/usr/bin/env bash
set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "ios" ]]; then
  echo "eas-pre-install: skipping (platform=${EAS_BUILD_PLATFORM:-unknown})"
  exit 0
fi

install_gem() {
  local gem_name="$1"
  local gem_version="$2"

  if gem list -i "$gem_name" -v "$gem_version" >/dev/null 2>&1; then
    echo "✅ $gem_name ($gem_version) already installed"
    return 0
  fi

  echo "⬇️ Installing $gem_name ($gem_version)"
  if sudo -n true 2>/dev/null; then
    sudo gem install "$gem_name" -v "$gem_version" --no-document --source https://rubygems.org
  else
    gem install "$gem_name" -v "$gem_version" --no-document --source https://rubygems.org
  fi
}

install_gem "cocoapods" "~> 1.15"
install_gem "cocoapods-spm" "~> 0.1"

echo "✅ cocoapods and cocoapods-spm ready for iOS build"
