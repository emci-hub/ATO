# PHASE-21: builds the 12 ending-card init images (194x118): the far plate bottom-aligned (top 18 rows = the plate's own top 18 rows, mirrored),
# the mid layer, the hero (druid, 64 px figure) and the scene's NPCs standing on the floor. PixelLab pixflux img2img (strength 650)
# then paints them into one card (tools/ending cards in params.json).
from PIL import Image

Q = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/'
W, H = 192, 116  # pixflux needs sizes divisible by 4 (the spec's 195x118 is refused); plates are 194 wide, so crop 1 px each side
# card id -> (campaign dir, far plate, mid layer or None, [(sprite, x_center_fraction)], prompt)
CARDS = {
    'lantern.ending-singing-deep': ('lantern', 'far-4-lake', 'mid-4-lake-r4', [('hero', .5)]),
    'lantern.ending-long-way-home': ('lantern', 'far-5-daylight', 'mid-5-daylight', [('hero', .42), ('rook', .62)]),
    'lantern.ending-rooks-lantern': ('lantern', 'far-3-bridge', 'mid-3-bridge', [('hero', .42), ('rook', .6)]),
    'lantern.ending-toll-forward': ('lantern', 'far-2-fork', 'mid-2-fork', [('hero', .5), ('vey', .72)]),
    'masquerade.ending-last-waltz': ('masquerade', 'far-1-ballroom', 'mid-1-ballroom', [('hero', .45), ('ines', .6)]),
    'masquerade.ending-quiet-exit': ('masquerade', 'far-2-balcony', 'mid-2-balcony', [('hero', .5)]),
    'masquerade.ending-unmasked-together': ('masquerade', 'far-5-garden-maze', 'mid-5-garden-maze', [('hero', .42), ('corvin', .6)]),
    'masquerade.ending-clock-twice': ('masquerade', 'far-1-ballroom', 'mid-1-ballroom', [('hero', .5), ('pell', .68)]),
    'city.ending-night-bus-crew': ('city', 'far-5-last-bus-stop', 'mid-5-last-bus-stop', [('hero', .4), ('mara', .52), ('theo', .64), ('dee', .76)]),
    'city.ending-sunrise-walk': ('city', 'far-3-rooftop', 'mid-3-rooftop', [('hero', .45), ('mara', .6)]),
    'city.ending-diner-dawn': ('city', 'far-4-diner', 'mid-4-diner', [('hero', .42), ('mara', .56), ('theo', .7)]),
    'city.ending-first-train': ('city', 'far-1-platform', 'mid-1-platform', [('hero', .45), ('mara', .6)]),
}
NAMES = {'lantern': {'far-1': 'far-1-gate'}}


def sprite(name):
    p = Q + ('heroes/snapped/druid-idle-0.png' if name == 'hero' else 'npcs/snapped/%s-idle-0.png' % name)
    im = Image.open(p).convert('RGBA')
    return im.crop(im.getchannel('A').getbbox())


def build(cid):
    camp, far, mid, cast = CARDS[cid]
    base = Image.new('RGBA', (W, H))
    f = Image.open(Q + '%s/wip/%s.png' % (camp, far)).convert('RGBA').crop((1, 0, 193, 100))
    top = f.crop((0, 0, W, H - f.height)).transpose(Image.FLIP_TOP_BOTTOM)
    base.paste(top, (0, 0))
    base.paste(f, (0, H - f.height))
    if mid:
        m = Image.open(Q + '%s/wip/%s.png' % (camp, mid)).convert('RGBA').crop((1, 0, 193, 100))
        base.alpha_composite(m, (0, H - m.height))
    for who, fx in cast:
        s = sprite(who)
        base.alpha_composite(s, (int(W * fx - s.width / 2), H - 14 - s.height))
    return base


if __name__ == '__main__':
    import os
    os.makedirs(Q + 'endings/init', exist_ok=True)
    sheet = Image.new('RGB', (4 * (W + 4), 3 * (H + 4)), (20, 20, 30))
    for i, cid in enumerate(CARDS):
        b = build(cid)
        b.convert('RGB').save(Q + 'endings/init/%s.png' % cid)
        sheet.paste(b.convert('RGB'), ((i % 4) * (W + 4), (i // 4) * (H + 4)))
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(Q + 'endings/init-sheet.png')
    print('ok', len(CARDS))
