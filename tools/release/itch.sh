#!/usr/bin/env bash
# Builds the free web demo and zips it for itch.io (index.html at the zip root, nothing else).
#   bash tools/release/itch.sh        → build/release/dead-swarm-demo-itch.zip
# The full game zip (for private playtests) is built too: build/release/dead-swarm-full.zip
set -euo pipefail
cd "$(dirname "$0")/../.."
DS_DEMO=1 DS_OUT=build/demo node tools/build.js
node tools/build.js
mkdir -p build/release
rm -f build/release/dead-swarm-demo-itch.zip build/release/dead-swarm-full.zip
(cd build/demo && zip -q -9 ../release/dead-swarm-demo-itch.zip index.html)
(cd build && zip -q -9 release/dead-swarm-full.zip index.html)
for z in build/release/dead-swarm-demo-itch.zip build/release/dead-swarm-full.zip; do
  echo "$z  $(du -k "$z" | cut -f1) KB"; unzip -l "$z" | sed -n '4p'
done
