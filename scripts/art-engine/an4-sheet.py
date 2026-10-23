"""AN4 review sheet (build tooling only): creeps / boss / towers, current Idle vs engine Idle, east + west.

  python -I scripts/art-engine/an4-sheet.py <out dir> <date stamp> id [id ...]      e.g. creep.knight boss.oni tower.ghost

Reads <id>.streetwear: its live Idle (migrated/raw/animations/Idle/<dir>) and the engine frames
(art-src/pixellab/<id>.streetwear/engine-breathing-idle-<stamp>/<dir>), writes <out>/<id>-idle.gif (one per character)
and <out>/contact-1.png (one row per character: east now | rest | low, then west now | rest | low). Model: an2-sheet.py,
but canvas sizes vary (96 to 264), so the zoom is per kind and nothing assumes 192.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path.cwd()
OUT = Path(sys.argv[1])
STAMP = sys.argv[2]
IDS = sys.argv[3:]
OUT.mkdir(parents=True, exist_ok=True)
BG = (36, 38, 52, 255)
DIRS = ("east", "west")


def zoom_for(cid):
    """(gif zoom, sheet zoom): creeps are 96 px canvases, towers ~240, the boss 264."""
    if cid.startswith("creep."):
        return 5, 4
    if cid.startswith("boss."):
        return 2, 1
    return 2, 2


def frames(folder):
    return [Image.open(p).convert("RGBA") for p in sorted(folder.glob("frame_*.png"))]


def bbox_union(imgs):
    boxes = [i.getchannel("A").point(lambda v: 255 if v > 0 else 0).getbbox() for i in imgs]
    boxes = [b for b in boxes if b]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def load(cid):
    base = ROOT / f"art-src/pixellab/{cid}.streetwear"
    data = {}
    for d in DIRS:
        cur = frames(base / f"migrated/raw/animations/Idle/{d}")
        new = frames(base / f"engine-breathing-idle-{STAMP}/{d}")
        ms = json.loads((base / f"engine-breathing-idle-{STAMP}/engine.json").read_text())["dirs"][d]["ms"]
        data[d] = (cur, new, ms)
    return data


def crop_box(data):
    imgs = [i for d in data.values() for part in d[:2] for i in part]
    b = bbox_union(imgs)
    w, h = imgs[0].size
    return (max(0, b[0] - 4), max(0, b[1] - 4), min(w, b[2] + 4), min(h, b[3] + 4))


def panel(img, box, label, z):
    c = img.crop(box).resize(((box[2] - box[0]) * z, (box[3] - box[1]) * z), Image.NEAREST)
    bg = Image.new("RGBA", c.size, BG)
    bg.alpha_composite(c)
    ImageDraw.Draw(bg).text((3, 2), label, fill=(255, 255, 255, 255))
    return bg


def hstack(cells, gap=6, color=(20, 20, 28, 255)):
    w = sum(c.width for c in cells) + gap * (len(cells) - 1)
    row = Image.new("RGBA", (w, max(c.height for c in cells)), color)
    x = 0
    for c in cells:
        row.paste(c, (x, 0))
        x += c.width + gap
    return row


def char_gif(cid, data):
    z = zoom_for(cid)[0]
    box = crop_box(data)
    ms = data["east"][2]
    out, durs = [], []
    for _ in range(3):
        for fi, m in enumerate(ms):
            cells = []
            for d in DIRS:
                cur, new, _ = data[d]
                cells.append(panel(cur[fi % len(cur)], box, f"{d} now", z))
                cells.append(panel(new[fi % len(new)], box, f"{d} new", z))
            out.append(hstack(cells).convert("P", palette=Image.ADAPTIVE))
            durs.append(m)
    out[0].save(OUT / f"{cid}-idle.gif", save_all=True, append_images=out[1:], duration=durs, loop=0, disposal=2)


def contact(ids, datas):
    rows = []
    for cid in ids:
        data = datas[cid]
        z = zoom_for(cid)[1]
        box = crop_box(data)
        cells = []
        for d in DIRS:
            cur, new, _ = data[d]
            cells.append(panel(cur[0], box, f"{cid} {d} now", z))
            cells.append(panel(new[0], box, "new rest", z))
            low = max(range(len(new)), key=lambda k: _first_row(new[k]))
            cells.append(panel(new[low], box, f"new low (f{low})", z))
        rows.append(hstack(cells))
    W = max(r.width for r in rows)
    H = sum(r.height for r in rows) + 6 * (len(rows) - 1)
    sheet = Image.new("RGB", (W, H), (20, 20, 28))
    y = 0
    for r in rows:
        sheet.paste(r.convert("RGB"), (0, y))
        y += r.height + 6
    sheet.save(OUT / "contact-1.png")


def _first_row(img):
    """Top visible row: the lowest-sunk frame has the largest value."""
    b = img.getchannel("A").getbbox()
    return b[1] if b else 0


datas = {c: load(c) for c in IDS}
for c in IDS:
    char_gif(c, datas[c])
    print("gif", c)
contact(IDS, datas)
print("contact-1")
