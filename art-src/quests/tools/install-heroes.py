# PHASE-21 H4 walk + H5 triumph for the 3 main heroes. Unzips the PixelLab character downloads into heroes/raw-h45/<hero>/, then writes
# heroes/<hero>-walk-0..7.png and heroes/<hero>-triumph-0..6.png on one 128x128 canvas: every frame's lowest pixel sits on the same
# baseline row (foot contact; the template drifts 79-82 rows), x is shifted by ONE offset per clip (centre of the clip's median frame).
# tools/snap-palette.py then snaps them to the palette in CIELAB.
import io, os, urllib.request, zipfile
import numpy as np
from PIL import Image

Q = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/heroes/'
IDS = {'druid': '3b7d6fcb-1407-4aa7-b181-d82f3f2844a1', 'champion': 'e4da9a96-f2e2-4596-be44-19d1088af2ba', 'witch': 'd5d8122a-0496-496d-bb28-d313ba16a8b3'}
C, BASE = 128, 118


def fetch(h):
    d = Q + 'raw-h45/' + h
    if not os.path.isdir(d):
        r = urllib.request.Request('https://api.pixellab.ai/mcp/characters/%s/download' % IDS[h], headers={'User-Agent': 'Mozilla/5.0'})
        zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(r).read())).extractall(d)
    return d


def clip_dir(root, key):
    base = root + '/Idle/animations/'
    for n in sorted(os.listdir(base)):
        if key in n:
            return base + n + '/east/'
    raise SystemExit('no clip %s in %s' % (key, root))


def place(frames, out, tag):
    boxes = [f.getchannel('A').getbbox() for f in frames]
    cx = int(np.median([(b[0] + b[2]) / 2 for b in boxes]))
    for i, (f, b) in enumerate(zip(frames, boxes)):
        im = Image.new('RGBA', (C, C))
        dx, dy = C // 2 - cx, BASE - b[3]
        im.paste(f, (dx, dy), f)
        im.save(Q + '%s-%s-%d.png' % (out, tag, i))


for h in IDS:
    root = fetch(h)
    for tag, key in (('walk', 'walk'), ('triumph', 'triumph')):
        d = clip_dir(root, key)
        fs = sorted(os.listdir(d))
        if tag == 'triumph' and len(fs) == 7:
            fs = fs[1:]  # frame 0 is the reference pose (v3 custom clips return it first)
        place([Image.open(d + f).convert('RGBA') for f in fs], h, tag)
print('ok')
