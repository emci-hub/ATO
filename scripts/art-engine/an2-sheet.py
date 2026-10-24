"""AN2 review sheets (build tooling only): one GIF per hero (current vs engine, east + west) and contact sheets.

  python -I scripts/art-engine/an2-sheet.py <out dir> <date stamp> hero [hero ...]

Reads each hero's rotations, its live Idle (raw/animations/Idle/<dir>) and the engine frames
(art-src/pixellab/hero.<hero>.streetwear/engine-breathing-idle-<stamp>/<dir>), writes
<out>/<hero>-idle.gif and <out>/contact-<n>.png (five heroes per sheet, current | new, east then west, 2x).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path.cwd()
OUT = Path(sys.argv[1])
STAMP = sys.argv[2]
HEROES = sys.argv[3:]
OUT.mkdir(parents=True, exist_ok=True)
BG = (36, 38, 52, 255)
Z = 2


def frames(folder):
    return [Image.open(p).convert("RGBA") for p in sorted(folder.glob("frame_*.png"))]


def bbox_union(imgs):
    boxes = [i.getchannel("A").point(lambda v: 255 if v > 0 else 0).getbbox() for i in imgs]
    boxes = [b for b in boxes if b]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def load(hero):
    base = ROOT / f"art-src/pixellab/hero.{hero}.streetwear"
    data = {}
    for d in ("east", "west"):
        cur = frames(base / f"migrated/raw/animations/Idle/{d}")
        new = frames(base / f"engine-breathing-idle-{STAMP}/{d}")
        ms = json.loads((base / f"engine-breathing-idle-{STAMP}/engine.json").read_text())["dirs"][d]["ms"]
        data[d] = (cur, new, ms)
    return data


def panel(img, box, label):
    c = img.crop(box).resize(((box[2] - box[0]) * Z, (box[3] - box[1]) * Z), Image.NEAREST)
    bg = Image.new("RGBA", c.size, BG)
    bg.alpha_composite(c)
    ImageDraw.Draw(bg).text((3, 2), label, fill=(255, 255, 255, 255))
    return bg


def hero_gif(hero, data):
    allimgs = [i for d in data.values() for part in d[:2] for i in part]
    box = bbox_union(allimgs)
    box = (max(0, box[0] - 4), max(0, box[1] - 4), min(192, box[2] + 4), min(192, box[3] + 4))
    # timeline: engine ms cycle; the current clip steps through its own frames on the same clock (120 ms each)
    ms = data["east"][2]
    total = sum(ms)
    steps = []
    t = 0
    for m in ms:
        steps.append((t, m))
        t += m
    out = []
    durs = []
    reps = 3
    for _ in range(reps):
        for fi, (_, m) in enumerate(steps):
            cells = []
            for d in ("east", "west"):
                cur, new, _ms = data[d]
                cells.append(panel(cur[fi % len(cur)], box, f"{d} now"))
                cells.append(panel(new[fi % len(new)], box, f"{d} new"))
            w = sum(c.width for c in cells) + 6 * (len(cells) - 1)
            sheet = Image.new("RGBA", (w, cells[0].height), (20, 20, 28, 255))
            x = 0
            for c in cells:
                sheet.paste(c, (x, 0))
                x += c.width + 6
            out.append(sheet.convert("P", palette=Image.ADAPTIVE))
            durs.append(m)
    out[0].save(OUT / f"{hero}-idle.gif", save_all=True, append_images=out[1:], duration=durs, loop=0, disposal=2)
    return box


def contact(group, datas, idx):
    rows = []
    for hero in group:
        data = datas[hero]
        allimgs = [i for d in data.values() for part in d[:2] for i in part]
        box = bbox_union(allimgs)
        box = (max(0, box[0] - 4), max(0, box[1] - 4), min(192, box[2] + 4), min(192, box[3] + 4))
        cells = []
        for d in ("east", "west"):
            cur, new, ms = data[d]
            cells.append(panel(cur[0], box, f"{hero} {d} now"))
            cells.append(panel(new[0], box, "new rest"))
            low = max(range(len(new)), key=lambda k: (new[k].getchannel("A").getbbox() or (0, 0, 0, 0))[1])
            cells.append(panel(new[low], box, f"new low (f{low})"))
        w = sum(c.width for c in cells) + 6 * (len(cells) - 1)
        row = Image.new("RGBA", (w, cells[0].height), (20, 20, 28, 255))
        x = 0
        for c in cells:
            row.paste(c, (x, 0))
            x += c.width + 6
        rows.append(row)
    W = max(r.width for r in rows)
    H = sum(r.height for r in rows) + 6 * (len(rows) - 1)
    sheet = Image.new("RGB", (W, H), (20, 20, 28))
    y = 0
    for r in rows:
        sheet.paste(r.convert("RGB"), (0, y))
        y += r.height + 6
    sheet.save(OUT / f"contact-{idx}.png")


datas = {h: load(h) for h in HEROES}
for h in HEROES:
    hero_gif(h, datas[h])
    print("gif", h)
for i in range(0, len(HEROES), 5):
    contact(HEROES[i : i + 5], datas, i // 5 + 1)
    print("contact", i // 5 + 1)
