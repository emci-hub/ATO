"""Side-by-side GIF + frame strip for the art engine (build tooling only).

Input: one JSON spec written by run.ts: {"reportDir", "hero", "items": [{"dir", "columns": [{"label", "frames", "ms"}]}]}.
Each column loops on its own clock; all columns share one crop box so nothing jitters.
Output (reportDir): <dir>-compare-3x.gif, <dir>-compare-1x.gif, <dir>-frames-4x.png
"""
import json
import os
import sys

from PIL import Image, ImageDraw

BG = (30, 32, 44, 255)
STEP_MS = 50
TIMELINE_MS = 5200


def load(path):
    return Image.open(path).convert("RGBA")


def union_box(images):
    box = None
    for im in images:
        b = im.getchannel("A").point(lambda a: 255 if a > 0 else 0).getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box


def frame_at(frames, ms, t):
    total = sum(ms)
    t = t % total
    for im, d in zip(frames, ms):
        if t < d:
            return im
        t -= d
    return frames[-1]


def paste_on_bg(im, box, scale):
    c = im.crop(box)
    bg = Image.new("RGBA", c.size, BG)
    bg.alpha_composite(c)
    return bg.resize((c.width * scale, c.height * scale), Image.NEAREST)


def render_gif(item, box, scale, out):
    cols = item["columns"]
    loaded = [[load(f) for f in c["frames"]] for c in cols]
    w = (box[2] - box[0]) * scale
    h = (box[3] - box[1]) * scale
    label_h = 14
    gap = 4
    canvas_w = len(cols) * w + (len(cols) - 1) * gap
    canvas_h = h + label_h
    out_frames = []
    for t in range(0, TIMELINE_MS, STEP_MS):
        canvas = Image.new("RGBA", (canvas_w, canvas_h), BG)
        d = ImageDraw.Draw(canvas)
        for i, c in enumerate(cols):
            im = frame_at(loaded[i], c["ms"], t)
            x = i * (w + gap)
            canvas.paste(paste_on_bg(im, box, scale), (x, label_h))
            d.text((x + 2, 1), c["label"], fill=(255, 220, 80, 255))
        out_frames.append(canvas.convert("RGB"))
    out_frames[0].save(
        out, save_all=True, append_images=out_frames[1:], duration=STEP_MS, loop=0, optimize=False
    )


def render_strip(item, box, out, scale=4):
    cols = item["columns"]
    loaded = [[load(f) for f in c["frames"]] for c in cols]
    w = (box[2] - box[0]) * scale
    h = (box[3] - box[1]) * scale
    n = max(len(fs) for fs in loaded)
    label_w = 90
    gap = 4
    canvas = Image.new("RGBA", (label_w + n * (w + gap), len(cols) * (h + gap)), BG)
    d = ImageDraw.Draw(canvas)
    for r, c in enumerate(cols):
        y = r * (h + gap)
        d.text((4, y + 4), c["label"], fill=(255, 220, 80, 255))
        for i, im in enumerate(loaded[r]):
            canvas.paste(paste_on_bg(im, box, scale), (label_w + i * (w + gap), y))
    canvas.convert("RGB").save(out)


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out_dir = spec["reportDir"]
    os.makedirs(out_dir, exist_ok=True)
    for item in spec["items"]:
        all_images = [load(f) for c in item["columns"] for f in c["frames"]]
        box = union_box(all_images)
        if box is None:
            continue
        pad = 3
        box = (max(0, box[0] - pad), max(0, box[1] - pad), box[2] + pad, box[3] + pad)
        d = item["dir"]
        render_gif(item, box, 3, os.path.join(out_dir, f"{d}-compare-3x.gif"))
        render_gif(item, box, 1, os.path.join(out_dir, f"{d}-compare-1x.gif"))
        render_strip(item, box, os.path.join(out_dir, f"{d}-frames-4x.png"))
        print(f"art-engine: wrote {d} GIFs + frame strip -> {out_dir}")


main()
