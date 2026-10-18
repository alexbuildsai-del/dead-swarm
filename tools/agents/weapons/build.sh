#!/bin/sh
# isolated build of the weapons module (full-name prefixes so other agents' 20_/21_ web files aren't pulled in)
cd "${DS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && DS_OUT=build/weapons DS_ONLY=20_weapons,21_evolutions,22_gear,30_draw_weapons node tools/build.js
