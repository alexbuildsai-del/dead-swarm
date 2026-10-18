#!/usr/bin/env python3
"""Crop the centre of each screenshot (around the survivor) and tile them 2-up with labels.
python3 tools/agents/weapons/crop.py OUT.png img1 img2 ... [CROP=W,H env, default 1000,560]"""
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]; fs = sys.argv[2:]
cw, ch = [int(v) for v in os.environ.get('CROP', '1000,560').split(',')]
cols = int(os.environ.get('COLS', 2))
tiles = []
for f in fs:
    im = Image.open(f).convert('RGB'); W, H = im.size
    x0 = (W - cw) // 2; y0 = (H - ch) // 2
    t = im.crop((x0, y0, x0 + cw, y0 + ch))
    d = ImageDraw.Draw(t); lab = os.path.basename(f).replace('.png', '')
    d.rectangle((0, 0, 10 + 9 * len(lab), 22), fill=(0, 0, 0)); d.text((5, 5), lab, fill=(255, 255, 0))
    tiles.append(t)
rows = (len(tiles) + cols - 1) // cols
g = Image.new('RGB', (cw * cols, ch * rows), (0, 0, 0))
for i, t in enumerate(tiles): g.paste(t, ((i % cols) * cw, (i // cols) * ch))
g.save(out)
