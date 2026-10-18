#!/bin/sh
# simtest matrix: every weapon at Lv1/3/5 and every evolution (god, 150 shamblers, minute 8, 1 min), then a 3-minute normal run each.
cd "${DS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
export DS_OUT=build/weapons
W="pistol sawblade drones sentry chainsaw mortar tesla cleaver molotov boombox rockets cryo claymores flamethrower holywater dogs"
E="akimbo buzzsaw droneswarm bunker reaper carpetbomb stormgrid twincleavers napalm blockparty rocketbarrage flashfreeze proxfield dragonsbreath sanctuary k9unit"
fail=0
for w in $W; do for L in 1 3 5; do
  out=$(node tools/simtest.js --give $w:$L --spawn shambler:150 --t 8 --minutes 1 --god 2>&1); echo "$out" | grep -q EXCEPTION && { echo "FAIL $w:$L"; echo "$out"; fail=1; }
  echo "$w:$L $(echo "$out" | head -1 | sed 's/ticks=[0-9]* //; s/ms=.*//')"
done; done
for e in $E; do
  out=$(node tools/simtest.js --give $e --spawn shambler:150 --t 8 --minutes 1 --god 2>&1); echo "$out" | grep -q EXCEPTION && { echo "FAIL $e"; echo "$out"; fail=1; }
  echo "$e $(echo "$out" | head -1 | sed 's/ticks=[0-9]* //; s/ms=.*//')"
done
echo "--- 3-minute normal runs (no god, director on, bot kite)"
for w in $W; do
  out=$(node tools/simtest.js --give $w:5 --minutes 3 --seed 3 2>&1); echo "$out" | grep -q EXCEPTION && { echo "FAIL normal $w"; echo "$out"; fail=1; }
  echo "$w:5 $(echo "$out" | head -1 | sed 's/ticks=[0-9]* //')"
done
for e in $E; do
  out=$(node tools/simtest.js --give $e --minutes 3 --seed 3 2>&1); echo "$out" | grep -q EXCEPTION && { echo "FAIL normal $e"; echo "$out"; fail=1; }
  echo "$e $(echo "$out" | head -1 | sed 's/ticks=[0-9]* //')"
done
echo "matrix done fail=$fail"
