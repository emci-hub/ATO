# PHASE-21 procedural ambients (free, 0 gens): A-M1 candle flame (16x24, 6f uneven 80-120 ms) and A-C2 rain tile (64x64, 4f @80 ms,
# seamless: every streak moves 16 px per frame down a 64 px tile, so frame 4 == frame 0). Palette: art-src/quests/palette.png colours only.
import math, random
from PIL import Image

Q = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/vfx/'
WHITE, PALE, YEL, ORG, DEEP = (255, 255, 255), (251, 255, 134), (249, 194, 43), (247, 150, 23), (251, 107, 29)


def flame(f):
    im = Image.new('RGBA', (16, 24), (0, 0, 0, 0))
    px = im.load()
    # the wick (dark) at the bottom, then a teardrop whose height, lean and width flicker per frame
    h = [13, 15, 12, 16, 13, 14][f]
    lean = [0, 1, 0, -1, 0, 1][f]
    wid = [8.0, 7.0, 8.4, 6.6, 7.8, 7.2][f]
    base = 20
    for y in range(base - h, base + 1):
        t = (base - y) / h  # 0 at the bottom, 1 at the tip
        half = wid / 2 * math.sin(math.pi * min(1, (t + 0.02) ** 0.6))  # teardrop: widest low, tapering to a point
        cx = 7.5 + lean * t * t * 2.6
        for x in range(16):
            d = abs(x - cx)
            if d <= half:
                core = d <= half * 0.42 and 0.08 < t < 0.6
                mid = d <= half * 0.72 and t < 0.85
                c = WHITE if core else YEL if mid else ORG if t < 0.85 else DEEP
                px[x, y] = c + (255,)
    # wick
    for y in (21, 22):
        px[7, y] = (46, 34, 47, 255)
    px[8, 21] = (46, 34, 47, 255)
    return im


def rain(f):
    rnd = random.Random(4821)
    im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    px = im.load()
    streaks = []
    for i in range(16):
        streaks.append((rnd.randrange(64), rnd.randrange(64), 6 + (i % 3)))
    for i, (x0, y0, ln) in enumerate(streaks):
        y = (y0 + 16 * f) % 64
        col = (143, 211, 255, 255) if i % 3 else (77, 155, 230, 255)
        for k in range(ln):  # a thin diagonal: 1 px right per 3 px down
            xx = (x0 + k // 3) % 64
            yy = (y + k) % 64
            px[xx, yy] = col
    return im


def strip(frames, name):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        fr.save(Q + '%s-%d.png' % (name, i))
        s.alpha_composite(fr, (i * w, 0))
    s.save(Q + name + '-strip.png')
    s.resize((s.width * 2, s.height * 2), Image.NEAREST).save(Q + name + '-strip@2x.png')


strip([flame(i) for i in range(6)], 'a-m1-candle-flame')
strip([rain(i) for i in range(4)], 'a-c2-rain-tile')
print('ok')
