"""Box mockups for docs/divecore-layout-spec.md. Run: python3 docs/divecore/mockups/draw-mockups.py docs/divecore/mockups (needs Pillow)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
OUT = sys.argv[1]
K = 2
FONT = os.path.join(os.path.dirname(__file__), '../../../assets/play/fonts/DepartureMono-Regular.otf')
def f(s): return ImageFont.truetype(FONT, s * K)
DEV = {'max': dict(w=430, h=932, top=59, bot=34, name='430×932 Pro Max'), 'se': dict(w=375, h=667, top=20, bot=0, name='375×667 SE')}
INK = (11, 16, 32); CYAN = (0, 229, 255); MUST = (224, 165, 38); PAPER = (236, 232, 222); DIM = (120, 130, 150)
COL = {'safe': (60, 20, 60), 'top': (34, 52, 70), 'lane': (58, 52, 20), 'stage': (18, 60, 48), 'dock': (52, 36, 62), 'tab': (40, 40, 46), 'float': (0, 0, 0)}

def regions(dev, kind):
    d = DEV[dev]; tab = 56 + max(d['bot'], 8); pad = max(d['bot'], 8)
    if kind == 'tabbed': spec = [('TopBar', 44, 'top'), ('NoticeLane', 40, 'lane'), ('Stage', None, 'stage'), ('ActionDock', 64, 'dock'), ('TabBar', tab, 'tab')]
    if kind == 'setup': spec = [('TopBar', 44, 'top'), ('NoticeLane', 40, 'lane'), ('Stage', None, 'stage'), ('ActionDock', 120, 'dock'), ('TabBar', tab, 'tab')]
    if kind == 'wave': spec = [('TopBar', 44, 'top'), ('NoticeLane', 28, 'lane'), ('Stage', None, 'stage'), ('ActionDock', 120, 'dock'), ('pad', pad, 'safe')]
    if kind == 'dive': spec = [('TopBar', 44, 'top'), ('NoticeLane', 28, 'lane'), ('Stage', None, 'stage'), ('ActionDock', 152, 'dock'), ('pad', pad, 'safe')]
    fixed = d['top'] + sum(h for _, h, _ in spec if h)
    out = [('safe top', d['top'], 'safe')] + [(n, h if h else d['h'] - fixed, c) for n, h, c in spec]
    y = 0; res = []
    for n, h, c in out: res.append((n, y, h, c)); y += h
    return res

def box(dr, x0, y0, x1, y1, fill=None, line=None, w=1):
    dr.rectangle([x0 * K, y0 * K, x1 * K - 1, y1 * K - 1], fill=fill, outline=line, width=w * K)

def text(dr, x, y, s, size=11, fill=PAPER, anchor='la'):
    dr.text((x * K, y * K), s, font=f(size), fill=fill, anchor=anchor)

def phone(dev, kind, title, extra):
    d = DEV[dev]; W, H = d['w'], d['h']
    im = Image.new('RGB', ((W + 140) * K, (H + 40) * K), (250, 250, 250)); dr = ImageDraw.Draw(im)
    text(dr, 1, 4, f'{title} · {d["name"]}', 12, (20, 20, 20))
    oy = 30
    box(dr, 0, oy, W + 2, oy + H + 2, INK, (20, 20, 20))
    regs = regions(dev, kind)
    for n, y, h, c in regs:
        box(dr, 1, oy + 1 + y, W + 1, oy + 1 + y + h, COL[c])
        lab = f'Stage {h} pt · {round(100 * h / H)}%' if n == 'Stage' else f'{n} {h}'
        dr.line([((W + 2) * K, (oy + 1 + y) * K), ((W + 8) * K, (oy + 1 + y) * K)], fill=(120, 120, 120), width=K)
        text(dr, W + 8, oy + 1 + y + min(h / 2, 40) if h > 14 else oy + 1 + y + h / 2, lab, 10 if n != 'Stage' else 11, (0, 120, 140) if n == 'Stage' else (60, 60, 60), 'lm')
    R = {n: (y + oy + 1, h) for n, y, h, c in regs}
    extra(dr, W, R, dev)
    sy, sh = R['Stage']; box(dr, 1, sy, W + 1, sy + sh, None, CYAN, 1)
    return im

def btn(dr, x0, y0, x1, y1, s, fill=(70, 78, 92), tc=PAPER, size=11):
    box(dr, x0, y0, x1, y1, fill, (0, 0, 0), 1); text(dr, (x0 + x1) / 2, (y0 + y1) / 2, s, size, tc, 'mm')

def topbar(dr, W, R, items='1,240 Caps · 10/10 Tokens'):
    y, h = R['TopBar']; text(dr, 16, y + h / 2, items, 11, PAPER, 'lm')

def tabs(dr, W, R, names=('Block', 'Turf War', 'Hideout', 'Locker'), on='Hideout'):
    y, h = R['TabBar']; n = len(names); cw = (W - 16) / n
    for i, s in enumerate(names):
        x = 8 + i * cw
        text(dr, x + cw / 2, y + 22, s, 10, MUST if s == on else DIM, 'mm')

def hideout(dr, W, R, dev, claim=False, names=('Block', 'Turf War', 'Hideout', 'Locker')):
    topbar(dr, W, R)
    y, h = R['NoticeLane']; text(dr, 16, y + h / 2, 'RAVEN · CHILD · HUNGER ■■□□ · MOOD ■■■□' + ('' if not claim else ''), 10, PAPER, 'lm')
    if claim: btn(dr, W - 92, y + 6, W - 16, y + h - 6, 'Claim', MUST, INK, 10)
    sy, sh = R['Stage']
    rw = min(W - 16, sh * 352 / 576 * 1.0); rh = rw * 576 / 352
    if rh > sh - 64: rh = sh - 64; rw = rh * 352 / 576
    x0 = (W - rw) / 2; box(dr, x0, sy + 4, x0 + rw, sy + 4 + rh, (80, 50, 40), (0, 0, 0))
    text(dr, W / 2, sy + 4 + rh / 2, 'room (pet, spots)', 11, PAPER, 'mm')
    by = sy + sh - 56
    for i, s in enumerate(['Hideout', 'Loft', 'Call']):
        btn(dr, W / 2 - 84 + i * 58, by, W / 2 - 84 + i * 58 + 52, by + 48, s, (60, 60, 70), PAPER, 9)
    dy, dh = R['ActionDock']; btn(dr, 16, dy + 8, W / 2 - 4, dy + 56, 'Feed'); btn(dr, W / 2 + 4, dy + 8, W - 16, dy + 56, 'Info')
    tabs(dr, W, R, names=names)

def board(dr, W, R, top_fixed):
    sy, sh = R['Stage']; bw = W - 16; by = top_fixed
    box(dr, 8, by, 8 + bw, by + bw, (60, 66, 72), (0, 0, 0))
    text(dr, W / 2, by + bw / 2, f'board {bw}×{bw} (width-sized)', 11, PAPER, 'mm')
    if by + bw < sy + sh - 20: text(dr, W / 2, (by + bw + sy + sh) / 2, 'street art continues (stage content)', 9, DIM, 'mm')

def setup(dr, W, R, dev):
    topbar(dr, W, R); y, h = R['NoticeLane']; text(dr, 16, y + h / 2, 'Trial wave 1 · Easy', 10, PAPER, 'lm')
    board(dr, W, R, BOARD_Y[dev])
    dy, dh = R['ActionDock']
    text(dr, 16, dy + 18, 'Setup ▲  map · drops · replays', 10, CYAN, 'lm')
    btn(dr, 16, dy + 36, W - 16, dy + 84, 'Call wave', MUST, INK, 12)
    tabs(dr, W, R, on='Turf War')

def wave(dr, W, R, dev):
    y, h = R['TopBar']; text(dr, 16, y + h / 2, 'TRIAL WAVE 1 · 80 caps', 11, PAPER, 'lm'); text(dr, W - 16, y + h / 2, 'II', 12, PAPER, 'rm')
    y, h = R['NoticeLane']; text(dr, 16, y + h / 2, 'Coach: drag your Avatar to the thick.', 9, PAPER, 'lm')
    board(dr, W, R, BOARD_Y[dev])
    dy, dh = R['ActionDock']
    btn(dr, 16, dy + 8, W - 16, dy + 56, 'Cast · Root Veil', (200, 40, 50))
    cw = (W - 32 - 24) / 4
    for i, s in enumerate(['Pounce', '1×', '2×', 'Leave']):
        btn(dr, 16 + i * (cw + 8), dy + 64, 16 + i * (cw + 8) + cw, dy + 112, s, MUST if s == '1×' else (70, 78, 92), INK if s == '1×' else PAPER, 10)

def dive(dr, W, R, dev):
    y, h = R['TopBar']; text(dr, 16, y + h / 2, '‹  Tunnels · stop 2/5', 11, PAPER, 'lm'); text(dr, W - 16, y + h / 2, '10/10', 11, PAPER, 'rm')
    y, h = R['NoticeLane']; text(dr, 16, y + h / 2, 'Found a snack', 9, PAPER, 'lm')
    sy, sh = R['Stage']; text(dr, W / 2, sy + sh / 2, 'subway picture (fills the stage)', 11, PAPER, 'mm')
    dy, dh = R['ActionDock']
    text(dr, 16, dy + 16, 'Bag ▣□□□   Heat ▰▱▱▱ 18%', 10, PAPER, 'lm')
    btn(dr, 16, dy + 32, W / 2 - 4, dy + 80, 'Local · safer 18%'); btn(dr, W / 2 + 4, dy + 32, W - 16, dy + 80, 'Express · richer 34%', (200, 40, 50))
    btn(dr, 16, dy + 88, W - 16, dy + 136, 'Head up', MUST, INK)

BOARD_Y = {'max': 1 + 30 + 59 + 44 + 40, 'se': 1 + 30 + 20 + 44 + 40}

def side(ims, path, gap=16):
    W = sum(i.width for i in ims) + gap * (len(ims) - 1); H = max(i.height for i in ims)
    o = Image.new('RGB', (W, H), (250, 250, 250)); x = 0
    for i in ims: o.paste(i, (x, 0)); x += i.width + gap
    o = o.quantize(colors=64); o.save(path, optimize=True)

def blockscreen(dr, W, R, dev):
    topbar(dr, W, R); y, h = R['NoticeLane']; text(dr, 16, y + h / 2, 'Research ready', 10, PAPER, 'lm')
    sy, sh = R['Stage']
    rows = [('Pet · Hunger ■■□□ Mood ■■■□', 64), ('Turf War · wave 1 next', 64), ('Underground · 10/10 tokens', 64)]
    yy = sy + 16
    for t, hh in rows:
        box(dr, 16, yy, W - 16, yy + hh, (40, 44, 56), (0, 0, 0)); text(dr, 28, yy + hh / 2, t, 10, PAPER, 'lm'); yy += hh + 12
    text(dr, W / 2, yy + 20, '(list screen: no map)', 9, DIM, 'mm')
    dy, dh = R['ActionDock']; btn(dr, 16, dy + 8, W - 16, dy + 56, 'Claim', MUST, INK)
    tabs(dr, W, R, on='Block')

def oldsetup(dr, W, R, dev):
    # Current scrolling setup, drawn from the measured numbers (Pro Max).
    sy = R['Stage'][0]
    text(dr, 16, sy + 30, 'TURF WAR', 16, PAPER, 'lm'); text(dr, 16, sy + 70, 'Protect the Basecore Path… (2 lines)', 9, DIM, 'lm')
    by = 319 + 31; bw = 406
    box(dr, 12, by, 12 + bw, by + bw, (60, 66, 72), (0, 0, 0)); text(dr, W / 2, by + bw / 2, 'board 406² (scrolls)', 11, PAPER, 'mm')
    text(dr, W / 2, by + bw + 40, '↓ effects · wave card · drops · replays ↓', 9, DIM, 'mm')
    text(dr, W / 2, by + bw + 70, '“Call wave” is 650 pt further down', 10, MUST, 'mm')
    tabs(dr, W, R, on='Turf War')

screens = [('hideout', 'tabbed', 'Hideout', hideout), ('turf-setup', 'setup', 'Turf War setup', setup), ('turf-wave', 'wave', 'Turf War wave', wave), ('dive', 'dive', 'Underground / Dive', dive)]
for fn, kind, title, draw in screens:
    side([phone('max', kind, title, draw), phone('se', kind, title, draw)], f'{OUT}/{fn}.png')
# Question (a)
A1 = phone('max', 'tabbed', '(a1) No Block: Hideout is home', lambda dr, W, R, dev: hideout(dr, W, R, dev, claim=True, names=('Turf War', 'Hideout', 'Locker')))
A2 = phone('max', 'tabbed', '(a2) Keep a small Block tab', blockscreen)
side([A1, A2], f'{OUT}/question-a.png')
# Question (b)
def b1open(dr, W, R, dev):
    setup(dr, W, R, dev)
    sy, sh = R['Stage']; dy, dh = R['ActionDock']
    top = sy + sh * 0.35
    box(dr, 4, top, W - 4, dy + dh, (20, 26, 40), CYAN, 1)
    text(dr, 16, top + 18, 'Setup sheet (FloatLayer, over the board)', 10, CYAN, 'lm')
    for i, t in enumerate(['Map · ATO · Trial 1', 'Drops this wave', 'Replays', 'Effects · Full']):
        text(dr, 24, top + 50 + i * 30, t, 10, PAPER, 'lm')
    btn(dr, 16, dy + 36, W - 16, dy + 84, 'Call wave', MUST, INK, 12)
B1 = phone('max', 'setup', '(b1) Fixed board + Setup sheet', setup)
B1o = phone('max', 'setup', '(b1) …sheet pulled up', b1open)
B2 = phone('max', 'tabbed', '(b2) Keep setup scrolling (today)', oldsetup)
side([B1, B1o, B2], f'{OUT}/question-b.png')
