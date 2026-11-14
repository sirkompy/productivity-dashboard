#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/.vendor"
mkdir -p "$VENDOR"

clone_at() {
  local name="$1"
  local repo="$2"
  local sha="$3"
  local dir="$VENDOR/$name"

  if [[ ! -d "$dir/.git" ]]; then
    git clone --filter=blob:none "https://github.com/$repo.git" "$dir"
  fi

  git -C "$dir" fetch --depth 1 origin "$sha"
  git -C "$dir" checkout --detach "$sha"
  echo "✓ $name @ $sha"
}

clone_at marketingskills coreyhaines31/marketingskills 1f837447b20bb6f0e72d87b80ece1c221c362c7d
clone_at crawl4ai unclecode/crawl4ai cae74b203a33994f7e13b9052c3b0d5c93daa0e6
clone_at changedetection dgtlmoon/changedetection.io 900a12032a8e15b2cfcbb8a7dc0f7a1d60f39bf3
clone_at claude-seo AgriciDaniel/claude-seo cca7e4a267991aca880efade1fd12e8498caf2ce
clone_at postiz gitroomhq/postiz-app 132859f32d854830ce44b509da87409c3ec10a77

echo
echo "Content stack sources are available under $VENDOR"
echo "These are pinned reference implementations; do not edit them in place."
