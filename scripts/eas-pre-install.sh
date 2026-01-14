#!/usr/bin/env bash
set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "ios" ]]; then
  echo "eas-pre-install: skipping (platform=${EAS_BUILD_PLATFORM:-unknown})"
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export GEM_HOME="${GEM_HOME:-$HOME/.gem}"
export GEM_PATH="${GEM_HOME}:${GEM_PATH:-}"
export PATH="${GEM_HOME}/bin:${PATH}"

echo "eas-pre-install: GEM_HOME=$GEM_HOME"

if ! command -v bundle >/dev/null 2>&1; then
  echo "eas-pre-install: installing bundler"
  gem install bundler --no-document
fi

if [[ -f "Gemfile" ]]; then
  echo "eas-pre-install: running bundle install"
  bundle config set path "${BUNDLE_PATH:-$HOME/.bundle}" >/dev/null
  bundle install --jobs 4 --retry 3
else
  echo "eas-pre-install: Gemfile not found at repo root; skipping bundle install"
fi

echo "eas-pre-install: verifying cocoapods + cocoapods-spm"
bundle exec ruby -e "require 'cocoapods'; require 'cocoapods-spm'; puts 'OK: cocoapods + cocoapods-spm'"
bundle exec pod --version

echo "✅ Ruby deps ready for iOS build"
