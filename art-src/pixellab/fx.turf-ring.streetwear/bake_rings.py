"""Bake the grey/white PixelLab ring sheet into one coloured sheet per element.

grey levels: dark #5c5c5c, mid #b0b0b0, light #ffffff (alpha kept).
dark -> colour * 0.55, mid -> colour, light -> colour mixed 70% to white.
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

src_png, src_json, out_root = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
ELEMENTS = {
    "ember": (0xFB, 0x92, 0x3C),
    "tide": (0x38, 0xBD, 0xF8),
    "root": (0x34, 0xD3, 0x99),
    "spark": (0xFA, 0xCC, 0x15),
    "void": (0xA7, 0x8B, 0xFA),
}
ELEMENTS["root"] = (0x34, 0xD3, 0x99)
LEVELS = {0x5C: 0, 0xB0: 1, 0xFF: 2}


def pick(v):
    return min(LEVELS, key=lambda k: abs(k - v))


def colour(rgb, level):
    r, g, b = rgb
    if level == 0:
        return tuple(int(c * 0.55) for c in rgb)
    if level == 1:
        return rgb
    return tuple(int(c + (255 - c) * 0.7) for c in rgb)


img = Image.open(src_png).convert("RGBA")
for name, rgb in ELEMENTS.items():
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lvl = LEVELS[pick(r)]
            nr, ng, nb = colour(rgb, lvl)
            px[x, y] = (nr, ng, nb, a)
    d = out_root / f"ring{name}"
    d.mkdir(parents=True, exist_ok=True)
    out.save(d / "status.png")
    data = json.loads(src_json.read_text())
    for f in data["frames"]:
        f["filename"] = f["filename"].replace("ato-turf-ring-2-twin-ring", f"ring{name}")
    (d / "status.json").write_text(json.dumps(data, indent=1))
    print("wrote", d)
