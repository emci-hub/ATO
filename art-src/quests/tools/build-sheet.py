# Builds art-src/quests/lantern-sheet.png (2x contact sheet) and the palette report from the files in art-src/quests/.
import os, glob, urllib.request
from PIL import Image, ImageDraw

Q = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/'
W = Q + 'lantern/wip/'
JOBS = {'mid-2-fork': '1bb4133c-4c74-4780-a592-15ea2b4bfbbd', 'mid-3-bridge': 'fb9b73cf-906b-4556-a66c-00dd16c98937',
        'mid-4-lake': '2643a678-1ca1-4a34-aed6-8812ec90abf5', 'mid-5-daylight': '77f398fa-7b70-4b56-b6f0-d173e61ee379',
        'ground-2-tunnel': '0e980be2-cfe9-4764-94d7-03b540627d1e', 'ground-3-planks': '1a944d86-daa1-41fe-937b-6a57890d9533',
        'ground-4-shore': 'b7babfd5-783b-4b4a-ab1b-c8d1a2066e1b', 'ground-5-sunlit': '281a62cf-9c6c-4c75-8cf9-60ec62bce7fb'}
for n, j in JOBS.items():
    p = W + n + '.png'
    if not os.path.exists(p):
        r = urllib.request.Request('https://api.pixellab.ai/mcp/images/%s/download' % j, headers={'User-Agent': 'Mozilla/5.0'})
        open(p, 'wb').write(urllib.request.urlopen(r, timeout=60).read())

pal = set(open(Q + 'palette.txt').read().upper().split())
def off(path):
    im = Image.open(path).convert('RGBA')
    px = set('#%02X%02X%02X' % c[:3] for c in im.getdata() if c[3] > 0)
    return len(px), len(px - pal)

print('palette report (colours, outside palette):')
for p in sorted(glob.glob(W + '*.png') + glob.glob(Q + 'icons/*.png') + glob.glob(Q + 'vfx/*-[0-9].png') + glob.glob(Q + 'npcs/*portrait.png') + glob.glob(Q + 'heroes/snapped/*-idle-0*.png') + glob.glob(Q + 'npcs/snapped/*-idle-0.png')):
    n = os.path.relpath(p, Q)
    if 'check' in n or 'picks' in n or 'fix1' in n: continue
    print(' ', n, off(p))

L = lambda n: Image.open(W + n + '.png').convert('RGBA')
rook = Image.open(Q + 'npcs/rook-rot-east.png').convert('RGBA')
scenes = [('1 flooded gate', 'far-1-gate', 'mid-1-rockarch', None), ('2 tunnel fork', 'far-2-fork', 'mid-2-fork', 'ground-2-r2'),
          ('3 toll bridge', 'far-3-bridge', 'mid-3-bridge', 'ground-3-r3'), ('4 singing lake', 'far-4-lake', 'mid-4-lake-r4', 'ground-4-r2'),
          ('5 daylight crack', 'far-5-daylight', 'mid-5-daylight', 'ground-5-r2')]
def scene(far, mid, ground, hero):
    s = L(far)
    if ground: s.alpha_composite(L(ground), (0, 76))
    s.alpha_composite(hero, (70, 100 - 64 - 4 + 4))
    s.alpha_composite(L(mid), (0, 0))
    return s
S = 2
sheet = Image.new('RGBA', (3 * (194 * S + 12) + 12, 4000), (20, 22, 36, 255))
d = ImageDraw.Draw(sheet)
def label(x, y, t): d.text((x, y), t, fill=(200, 210, 220, 255))
y = 8; label(12, y, 'LANTERN: far + mid + hero (Rook, 64 px) per location. Ground strips shown in the next row.'); y += 14
for i, (t, f, m, g) in enumerate(scenes):
    x = 12 + (i % 3) * (194 * S + 12)
    if i % 3 == 0 and i: y += 100 * S + 22
    label(x, y, t); sheet.alpha_composite(scene(f, m, g, rook).resize((194 * S, 100 * S), Image.NEAREST), (x, y + 12))
y += 100 * S + 22
label(12, y, 'ground strips 194x24 (x2), pasted into scenes 2-5 above; strip 1 (gate) is a placeholder (white band), the gate plate keeps its own floor'); y += 14
for i, g in enumerate(['ground-1-r3', 'ground-2-r2', 'ground-3-r3', 'ground-4-r2', 'ground-5-r2']):
    x = 12 + (i % 3) * (194 * S + 12)
    if i == 3: y += 24 * S + 6
    sheet.alpha_composite(L(g).resize((194 * S, 24 * S), Image.NEAREST), (x, y))
y += 24 * S + 20
label(12, y, 'PROPS (x2): lantern, rope bridge, raft, mine cart, glow crystal, ration crate'); y += 14
x = 12
for n in ['prop-lantern', 'prop-rope-bridge', 'prop-raft', 'prop-mine-cart', 'prop-crystal-r2', 'prop-crate-r4']:
    im = L(n); sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, y)); x += im.width * S + 12
y += 40 * S + 16
label(12, y, 'NPCs (x2): Rook / Vey idle f0, talk f2, portrait 64 (portraits at x2)'); y += 14
x = 12
for n in ['rook', 'vey']:
    for part in ['idle-0', 'talk-2']:
        im = Image.open(Q + 'npcs/snapped/%s-%s.png' % (n, part)).convert('RGBA'); sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, y)); x += im.width * S + 6
    im = Image.open(Q + 'npcs/%s-portrait.png' % n).convert('RGBA'); sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, y)); x += im.width * S + 24
y += 88 * S + 16
label(12, y, 'HEROES (x2): idle f0 for all 10 (first 3 also have talk + react clips)'); y += 14
x = 12
names = ['druid', 'champion', 'witch', 'ratkin-treasure-hunter', 'death-knight', 'abyssal-assassin', 'arcane-engineer', 'demon-guardian', 'seraphic-cleric', 'crystal-berserker']
for i, n in enumerate(names):
    im = Image.open(Q + 'heroes/snapped/%s-idle-%s.png' % (n, '0' if i < 3 else '000')).convert('RGBA')
    if x + im.width * S > sheet.width - 8: x = 12; y += 130 * S + 6
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, y)); x += im.width * S + 4
y += 130 * S + 16
label(12, y, 'ICONS (x4): stats supplies / heart / laurel · approach explore / ledger / quote / swords / hourglass · rewind'); y += 14
x = 12
for n in ['stat-supplies', 'stat-heart', 'stat-laurel', 'u3-explore', 'u3-ledger', 'u3-quote', 'u3-swords', 'u3-hourglass', 'rewind']:
    im = Image.open(Q + 'icons/%s.png' % n).convert('RGBA'); sheet.alpha_composite(im.resize((im.width * 4, im.height * 4), Image.NEAREST), (x, y)); x += im.width * 4 + 10
y += 64 + 16
label(12, y, 'VFX (x2): sparkle burst, dust puff, stat up, stat down, drip (frame strips)'); y += 14
for n in ['v1-sparkle-burst', 'v2-dust-puff', 'v3-stat-up', 'v3-stat-down', 'a-l3-drip']:
    im = Image.open(Q + 'vfx/%s-strip.png' % n).convert('RGBA')
    if x > 800 or n == 'v1-sparkle-burst': x = 12
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, y))
    x += im.width * S + 20
    if n in ('v1-sparkle-burst', 'v2-dust-puff'): y += 32 * S + 6; x = 12
    elif n == 'v3-stat-down': pass
y += 32 * S + 16
sheet = sheet.crop((0, 0, sheet.width, y))
sheet.convert('RGB').save(Q + 'lantern-sheet.png'); print(sheet.size)
