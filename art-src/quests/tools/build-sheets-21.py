# PHASE-21 contact sheets for emci: masquerade-sheet.png, city-sheet.png, shared-sheet.png (art-src/quests/). Plates are far + mid
# composited, 2x; everything else is nearest-neighbour scaled so it is readable. Rebuild after any asset change.
import glob
from PIL import Image, ImageDraw

Q = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/'
BG = (46, 34, 47, 255)
PANEL = (70, 62, 90, 255)


def load(p):
    return Image.open(Q + p).convert('RGBA')


class Sheet:
    def __init__(self, w):
        self.w, self.rows = w, []

    def label(self, text):
        self.rows.append(('t', text))

    def row(self, ims, scale, gap=8):
        self.rows.append(('i', [(im.resize((im.width * scale, im.height * scale), Image.NEAREST), im) for im in ims], gap))

    def render(self, path):
        h = 10
        for r in self.rows:
            h += 22 if r[0] == 't' else max(i[0].height for i in r[1]) + 10
        out = Image.new('RGBA', (self.w, h), BG)
        d = ImageDraw.Draw(out)
        y = 6
        for r in self.rows:
            if r[0] == 't':
                d.text((6, y + 4), r[1], fill=(251, 255, 134, 255))
                y += 22
            else:
                x = 6
                for big, _ in r[1]:
                    out.alpha_composite(big, (x, y))
                    x += big.width + r[2]
                y += max(i[0].height for i in r[1]) + 10
        out.save(Q + path)
        print(path, out.size)


def plate(camp, i, name):
    f = load('%s/wip/far-%d-%s.png' % (camp, i, name))
    f.alpha_composite(load('%s/wip/mid-%d-%s.png' % (camp, i, name)))
    return f


def strip(prefix, n, folder='npcs/snapped/'):
    return [load('%s%s-%d.png' % (folder, prefix, i)) for i in range(n)]


def campaign(camp, locs, props, npcs, endings, amb, title):
    s = Sheet(2100)
    s.label('%s: 5 locations, far + mid composited (2x)' % title)
    s.row([plate(camp, i + 1, n) for i, n in enumerate(locs)][:5], 2)
    s.label('props (3x)')
    s.row([load('%s/wip/prop-%s.png' % (camp, p)) for p in props], 3)
    s.label('NPCs: portrait (3x) | east | idle x4 | talk x5 (2x)')
    for n in npcs:
        ims = [load('npcs/%s-portrait.png' % n)]
        s.row(ims, 3)
        s.row([load('npcs/snapped/%s-rot-east.png' % n)] + strip(n + '-idle', 4) + strip(n + '-talk', 5), 2, 2)
    s.label('ambient loops (frames left to right)')
    for a, scale in amb:
        n = len(glob.glob(Q + 'vfx/%s-[0-9].png' % a))
        s.row([load('vfx/%s-%d.png' % (a, i)) for i in range(n)], scale)
    s.label('ending cards (2x)')
    s.row([load('endings/%s.png' % e) for e in endings], 2)
    return s


m = campaign('masquerade', ['ballroom', 'balcony', 'servants-stair', 'library', 'garden-maze'],
             ['mask-1-wine', 'mask-2-gold', 'mask-3-fox', 'mask-4-moon', 'candelabra', 'letter', 'wine-table', 'clock'],
             ['ines', 'corvin', 'pell'],
             ['masquerade.ending-last-waltz', 'masquerade.ending-quiet-exit', 'masquerade.ending-unmasked-together', 'masquerade.ending-clock-twice'],
             [('a-m1-candle-flame', 4), ('a-m2-curtain', 2), ('a-m3-dancers', 2)], 'MASQUERADE')
m.render('masquerade-sheet.png')

c = campaign('city', ['platform', 'night-street', 'rooftop', 'diner', 'last-bus-stop'],
             ['departure-board', 'vending-machine', 'phone', 'bike', 'umbrella', 'food-cart'],
             ['mara', 'theo', 'dee'],
             ['city.ending-night-bus-crew', 'city.ending-sunrise-walk', 'city.ending-diner-dawn', 'city.ending-first-train'],
             [('a-c2-rain-tile', 2), ('a-c3-train', 1)], 'CITY')
c.render('city-sheet.png')

s = Sheet(2100)
s.label('H4 walk east, 8f (1x, 128 canvas, feet on one baseline)')
for h in ['druid', 'champion', 'witch']:
    s.row([load('heroes/snapped/%s-walk-%d.png' % (h, i)) for i in range(8)], 1, 0)
s.label('H5 triumph, 6f then hold the last frame 400 ms')
s.row([load('heroes/snapped/%s-triumph-%d.png' % (h, i)) for h in ['druid', 'champion', 'witch'] for i in (0, 2, 5)], 1, 0)
s.label('V5 d20 static + 8f tumble (4x)')
s.row([load('shared/d20.png')] + [load('shared/d20-tumble-%d.png' % i) for i in range(8)], 4)
s.label('lean emblems 24x24 (6x): openness, conscientiousness, extraversion, agreeableness, c_assert, c_coop, autonomy, playfulness, self_efficacy, locus_of_control')
s.row([load('emblems/%s.png' % e) for e in ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'c_assert', 'c_coop', 'autonomy', 'playfulness', 'self_efficacy', 'locus_of_control']], 6)
s.label('campaign badges 32x32 (5x): lantern, masquerade, city')
s.row([load('shared/badge-%s.png' % k) for k in ('lantern', 'masquerade', 'city')], 5)
s.label('Lantern ending cards (2x)')
s.row([load('endings/lantern.ending-%s.png' % e) for e in ['singing-deep', 'long-way-home', 'rooks-lantern', 'toll-forward']], 2)
s.render('shared-sheet.png')
