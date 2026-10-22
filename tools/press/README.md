# Press kit

Art for the itch.io page (later the Steam page), drawn by the game itself. Nothing here is committed output: run it.

```bash
bash tools/release/itch.sh          # builds build/demo (the demo) and build (full), zips both into build/release/
python3 tools/press/kit.py          # shots + gif + art → build/press/
python3 tools/press/kit.py art      # just the art (needs build/press/screenshots/clean from a shots run)
```

- `kit.py shots`: six screenshots at 1920×1080, PNG and JPG. They're staged on the full build with its dev hooks, but
  only with what the demo contains (Maple Hollow, Normal, Rook or Juno). The menu shot comes from the demo build. Each
  scene also saves a HUD-free copy in `screenshots/clean/`, which the art uses.
- `kit.py gif`: a 6 s clip of the daylight horde. Playwright records video, then ffmpeg palettes it into a GIF of about
  2.7 MB, 560×315.
- `kit.py art` (`art.py`): HTML templates rendered with the game's embedded fonts and paper textures:
  - logo (transparent, a variant for light backgrounds, and one on dark);
  - cover 630×500 and 2×; banner 960×300 and 2×; share card 1200×630;
  - background tiles;
  - an icon (the game's own Shambler on a red splat) at 512/256/128/64/32, plus `favicon.ico`.

Page copy and where each file goes: `docs/itch-page.md`.
