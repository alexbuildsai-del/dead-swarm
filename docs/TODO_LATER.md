# Dead Swarm: left for later

These were parked so the game could be playtested first. None of them blocks a run, a save, or the menus.

## Balance
- **Mid meta on Normal is 78%, against a target of about 65%.** Fresh Normal hits its target at 26%. Before tuning anything, recalibrate the simulator's "mid" profile (`profileSave('mid')` in `src/sim/80_meta.js`) against `tools/balance/campaign.js` saves at run 15. Campaigns log `SAVE@15`; the calibration run was stopped. The profile spends about 45% of the Safehouse plus Second Wind and Head Start, which is probably more than a real run-15 save. If it still runs high after that, trim Safehouse per-rank effects rather than base difficulty, since that would also move the fresh number.
- **Survivor spread on late Nightmare:** Rook and Mira each cleared 17% (n=18), Big Tomas 94%. A first pass is in but hasn't been measured yet:
  - Rook: crit 8%
  - Mira: HP 110, might 1.12
  - Tomas: HP 160
- **Evolution damage shares:** the top three average 23–25% when present (Akimbo, Carpet Bomb, Napalm). The weakest are Drone Swarm 6%, Reaper 8% and K9 Unit 8%. A second pass is in but hasn't been measured yet:
  - Drone Swarm: 36/26
  - Reaper: 72
  - K9: 70
  - Carpet Bomb: 44
- **Mid meta on Nightmare is 0% (n=54).** "Well under" is met, but it might feel like a wall. Consider a gentler Nightmare step for players with partial meta.
- **Bulls are the top killer at 21% of deaths.** Watch this in playtests.
- **Re-run the verification matrix after these changes:** `tools/balance/final.sh <tag>`, then `node tools/balance/tables.js results/<tag>_all.jsonl`.
- **Economy:** full Safehouse took 24–26 runs in two campaigns at cost ×1.2; it is now ×1.3 (total 14,515), so expect about 28–30 runs. Re-check that with two campaigns.

## QA leftovers
Everything P0–P3 from the review is fixed and re-verified (`tools/agents/review/FINDINGS.md`, fix log at the bottom). The leftovers are minor:
- **First-use hitches** still reach 60–135 ms in the elite-wave and boss scenarios on headless software canvas. The target was 50 ms. Sprite builds per frame are now 0–8, so the remaining cost is canvas rasterisation. Re-measure on a real phone with GPU canvas before doing more.
- **High quality at DPR 2** in headless Chromium runs at about 41 fps with 700 zombies. Auto quality steps down, and low quality holds 60 fps. Check on real devices.
- **Short portrait phones** (375×667 and smaller): four level-up cards can't all fit above the DASH/ULT corner. The buttons are hidden and inert while an overlay is open and taps have a 350 ms grace, so nothing can be picked blind, but a tidier layout would help.
- **Test scripts:**
  - `layout.py`'s crate stage can be pre-empted by an extra level-up at 1920×1080. The script should clear queued level-ups first.
  - `saves_browser.py` case 6 looks for `deadswarm.save.prereset`; the real key is `deadswarm.save.bak.prereset`.
  - Case 5 doesn't really test a broken restore. `resume_fallback.py` covers it.
- **Blocked storage:** the end screen doesn't repeat the "saving is blocked" warning. The menu and boot toast do show it.
- **Mastery XP ×8 retune:** saves made before it would drop mastery levels. There are no saves in the wild yet. If it ever changes again after launch, add a schema migration.
- **Daily score formula** is written in two places: `80_meta.js` and the rules text in `21_ui_more.js`.
- **Banner bounds:** `04_hud.js` copies the banner rectangle from `03_fx.js` to keep the call-in card clear. Exposing the bounds from FX would remove the duplication.

## Docs
- DESIGN.md §16 holds the verification results from the last full matrix. Update it after the next balance pass.
