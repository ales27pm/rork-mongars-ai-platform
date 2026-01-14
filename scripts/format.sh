#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "Gemfile" ]]; then
  bundle install --jobs 4 --retry 3
fi

npx prettier --write --ignore-unknown \
  scripts/eas-pre-install.sh \
  scripts/eas-pre-build.sh \
  ios/Podfile \
  modules/native-llm/ios/NativeLLM.podspec \
  plugins/withMLXPods.js \
  .gitignore \
  SECURITY.md
