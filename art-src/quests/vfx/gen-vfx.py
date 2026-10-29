# Procedural Quests VFX + ambient (PHASE-15). Run: python -I art-src/quests/vfx/gen-vfx.py
# Every colour is from art-src/quests/palette.png. Output: frames + one horizontal strip per clip in this folder.
import math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
C = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
WHITE, ICE, CYAN, TEAL, DEEP = C('#ffffff'), C('#8ff8e2'), C('#22d3ee'), C('#0b8a8f'), C('#0b5e65')
DUST1, DUST2, DUST3 = C('#c7dcd0'), C('#9babb2'), C('#7f708a')
GOLD, AMBER, GREEN, MINT = C('#f9c22b'), C('#f79617'), C('#1ebc73'), C('#91db69')
STONE, WATER = C('#625565'), C('#4d9be6')


def canvas(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def put(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def star(im, cx, cy, r, c):
    """4-point star: plus of arm length r."""
    for d in range(-r, r + 1):
        put(im, cx + d, cy, c)
        put(im, cx, cy + d, c)


def disc(im, cx, cy, r, c):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r // 2:
                put(im, x, y, c)


def strip(frames, name, scale=2):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.alpha_composite(f, (i * w, 0))
        f.save(os.path.join(HERE, '%s-%d.png' % (name, i)))
    s.save(os.path.join(HERE, '%s-strip.png' % name))
    bg = Image.new('RGBA', (s.width * scale, s.height * scale), (30, 32, 50, 255))
    bg.alpha_composite(s.resize((s.width * scale, s.height * scale), Image.NEAREST))
    bg.convert('RGB').save(os.path.join(HERE, '%s-strip@%dx.png' % (name, scale)))


# V1 sparkle burst 32x32, 6 frames, 83 ms: star points fly out, shrink, fade
v1 = []
cols = [WHITE, ICE, CYAN, CYAN, TEAL, DEEP]
for k in range(6):
    f = canvas(32, 32)
    if k == 0:
        star(f, 16, 16, 3, WHITE)
        disc(f, 16, 16, 1, WHITE)
    else:
        r = 3 + k * 2
        arm = max(0, 2 - k // 3)
        for a in range(8):
            ang = a * math.pi / 4 + 0.2
            x, y = round(16 + r * math.cos(ang)), round(16 + r * math.sin(ang))
            if a % 2 == 0:
                star(f, x, y, arm + (1 if k < 3 else 0), cols[k])
            else:
                put(f, x, y, cols[min(k + 1, 5)])
    v1.append(f)
strip(v1, 'v1-sparkle-burst')

# V2 dust puff 32x16, 5 frames at 60/60/80/100/120 ms: two puffs push sideways along the ground, then thin out
v2 = []
specs = [(2, 4, DUST1), (3, 7, DUST1), (3, 10, DUST2), (2, 12, DUST2), (1, 14, DUST3)]
for k, (r, off, c) in enumerate(specs):
    f = canvas(32, 16)
    gy = 12
    for sgn in (-1, 1):
        cx = 16 + sgn * off
        disc(f, cx, gy - (1 if k < 3 else 0) - (k > 0), r, c)
        if k in (1, 2):
            disc(f, cx - sgn * 3, gy + 1, max(1, r - 2), DUST2)
        if k >= 3:  # break apart into specks
            put(f, cx + sgn * 3, gy - 3, DUST3)
            put(f, cx - sgn * 2, gy - 4, DUST3)
    v2.append(f)
strip(v2, 'v2-dust-puff')


def arrow(f, cx, top, c, up=True):
    """7 wide chevron arrow, 8 tall."""
    rows = [(0, 1), (1, 3), (2, 5), (3, 7), (4, 3), (5, 3), (6, 3), (7, 3)]
    for dy, wd in rows:
        y = top + dy if up else top + 7 - dy
        for dx in range(-(wd // 2), wd // 2 + 1):
            put(f, cx + dx, y, c)


# V3 stat up / down 16x16, 4 frames at 80 ms: arrow rises (up) or sinks (down) and fades. Down is warm amber, never red.
up, down = [], []
for k in range(4):
    fu = canvas(16, 16)
    arrow(fu, 8, 7 - k * 2, [WHITE, MINT, GREEN, GREEN][k], True)
    if k < 3:
        put(fu, 3, 12 - k * 2, MINT)
        put(fu, 13, 10 - k * 2, MINT)
    up.append(fu)
    fd = canvas(16, 16)
    arrow(fd, 8, 1 + k * 2, [WHITE, GOLD, AMBER, AMBER][k], False)
    if k < 3:
        put(fd, 3, 3 + k * 2, GOLD)
        put(fd, 13, 5 + k * 2, GOLD)
    down.append(fd)
strip(up, 'v3-stat-up')
strip(down, 'v3-stat-down')

# A-L3 drip 16x32, 6 frames at 100 ms plus a 1.2 s hold on frame 0: drop swells on a stalactite, falls, splashes
dr = []
DARK, MID, LIGHT, INK = C('#3e3546'), C('#625565'), C('#7f708a'), C('#2e222f')
for k in range(6):
    f = canvas(16, 32)
    # stalactite: 8 rows tall, tapers from 12 px to a 2 px tip, ink outline, lit from the top-left
    for y in range(0, 8):
        half = max(1, 6 - y * 5 // 7)
        for x in range(8 - half, 8 + half):
            c = LIGHT if x == 8 - half + 1 else (DARK if x >= 8 + half - 2 else MID)
            put(f, x, y, c)
        put(f, 8 - half - 1, y, INK); put(f, 8 + half, y, INK)
    put(f, 7, 8, INK); put(f, 8, 8, MID); put(f, 9, 8, INK); put(f, 8, 9, INK)
    if k == 1:  # drop swells at the tip
        put(f, 8, 10, CYAN); put(f, 7, 11, CYAN); put(f, 8, 11, WHITE); put(f, 9, 11, CYAN); put(f, 8, 12, TEAL)
    elif k == 2:  # falling, stretched
        put(f, 8, 15, ICE); put(f, 8, 16, CYAN); put(f, 8, 17, CYAN); put(f, 8, 18, TEAL)
    elif k == 3:
        put(f, 8, 24, ICE); put(f, 8, 25, CYAN); put(f, 8, 26, CYAN); put(f, 8, 27, TEAL)
    elif k == 4:  # splash crown on the floor line (y=30)
        for dx, dy in ((-4, 28), (-2, 27), (2, 27), (4, 28)):
            put(f, 8 + dx, dy, ICE)
        for dx in range(-3, 4):
            put(f, 8 + dx, 30, CYAN)
        put(f, 8, 29, WHITE)
    elif k == 5:  # ripple fades
        for dx in (-5, -4, 4, 5):
            put(f, 8 + dx, 30, CYAN)
        put(f, 8, 30, TEAL)
    for x in range(2, 14):  # wet floor line
        put(f, x, 31, DEEP)
    dr.append(f)
strip(dr, 'a-l3-drip')
print('ok')
