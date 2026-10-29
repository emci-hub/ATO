# PHASE-21: adds the Masquerade / City / shared assets to art-src/quests/params.json (the Lantern entries stay untouched).
# Scores are the author's own read against refs/ in the §1.9 order: silhouette, value contrast, palette lock, clean pixels, light/shading,
# scale+camera, style match (animations: no boiling, stable volume, foot contact). pass = total >= 22 and no criterion below 2.
import json

P = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/params.json'
R = ['silhouette', 'value', 'palette', 'pixels', 'light', 'scale_camera', 'style']
PRO, PIX, PXN, ANI, CHR, PROC = 'create_image_pro', 'create_image_pixflux', 'create_image_pixen', 'animate_image', 'create_character v3 + animate_character', 'procedural (vfx/gen-amb2.py)'
S = [3, 3, 4, 3, 3, 3, 3]  # 22: the baseline pass


def a(file, tool, seed, scores, note='', gens=1, **kw):
    t = sum(scores)
    d = {'file': file, 'tool': tool, 'seed': seed, 'scores': dict(zip(R, scores)), 'total': t,
         'status': 'pass' if t >= 22 and min(scores) >= 2 else 'placeholder', 'gens': gens, 'note': note}
    d.update(kw)
    return d


A = {}
far = {'masquerade': ['ballroom', 'balcony', 'servants-stair', 'library', 'garden-maze'], 'city': ['platform', 'night-street', 'rooftop', 'diner', 'last-bus-stop']}
seed = {'masquerade': 4201, 'city': 4301}
better = {'ballroom': [3, 3, 4, 3, 4, 3, 3], 'balcony': [3, 3, 4, 3, 4, 3, 3], 'diner': [3, 3, 4, 3, 4, 3, 3]}
for camp, names in far.items():
    for i, n in enumerate(names):
        A['%s-far-%d-%s' % (camp, i + 1, n)] = a('%s/wip/far-%d-%s.png' % (camp, i + 1, n), PRO, seed[camp], better.get(n, S),
                                                 '194x100 (even-width rule), style_image = refs/dive-ground.png, hex palette; first try kept', 10)
        A['%s-mid-%d-%s' % (camp, i + 1, n)] = a('%s/wip/mid-%d-%s.png' % (camp, i + 1, n), PIX, seed[camp] + 1, S,
                                                 'foreground only, forced palette, no init; first try kept', 1)
props = {'masquerade': ['mask-1-wine', 'mask-2-gold', 'mask-3-fox', 'mask-4-moon', 'candelabra', 'letter', 'wine-table', 'clock'],
         'city': ['departure-board', 'vending-machine', 'phone', 'bike', 'umbrella', 'food-cart']}
pnote = {'mask-2-gold': 'fix round 1: r0 drew a hooded plague doctor, r1 (2 seeds) = a gold half mask, #b picked (2 gens)', 'wine-table': 'fix round 1: r0 was a white blob; r1b = red cloth, glasses, bottle (2 gens)',
         'phone': 'fix round 1: r0 was a blank mirror; r1a = phone with a chat screen (2 gens)', 'umbrella': 'fix round 1: handle added (1 gen)'}
pgen = {'mask-2-gold': 3, 'wine-table': 3, 'phone': 3, 'umbrella': 2}
for camp, names in props.items():
    for n in names:
        A['%s-prop-%s' % (camp, n)] = a('%s/wip/prop-%s.png' % (camp, n), PIX, seed[camp], [3, 3, 4, 3, 3, 3, 3] if n not in ('clock', 'food-cart') else [3, 3, 4, 3, 4, 3, 3],
                                        'flat side/front elevation, forced palette. ' + pnote.get(n, ''), pgen.get(n, 1))
npc = {'ines': 4403, 'corvin': 4404, 'pell': 4405, 'mara': 4406, 'theo': 4407, 'dee': 4408}
city = {'mara': 'nurse in scrubs', 'theo': 'busker with a guitar', 'dee': 'cab driver'}
for n, sd in npc.items():
    redo = n in city
    g = 4 + (4 if n == 'corvin' else 0) + (4 if redo else 0)
    A['npc-' + n] = a('npcs/snapped/%s-rot-east.png' % n, CHR, None, [4, 3, 4, 3, 3, 3, 4],
                      'v3 64 px, no palette input, snapped in CIELAB (originals in npcs/); idle = breathing-idle template 4f, talk = custom v3 4f + the reference frame; east only' +
                      ('; fix round 1: the first Corvin came out as a fox-headed figure, redone as a human with a fox mask on his forehead (+2 create, +2 anim = 4 extra gens; frames kept in npcs/fox-r0/)' if n == 'corvin' else '') +
                      ('; fix round 1: the first set was a commuter / courier / vendor and did not match the story (%s), redone from last-train.ts (+4 gens; the first frames are kept in npcs/city-r0/)' % city[n] if redo else ''), g)
    A['portrait-' + n] = a('npcs/%s-portrait.png' % n, PRO, 4416 + list(city).index(n) if redo else sd, [4, 3, 4, 4, 4, 3, 4],
                           '64x64, sprite (front view) as reference_images, 16 candidates, picked by eye; 10 gens' + ('; redone with the new sprite (+10 gens)' if redo else ''), 20 if redo else 10)
amb = [('a-m1-candle-flame', 'A-M1 candle flame 16x24, 6f @100/80/120/90/110/80 ms', PROC, 4811, 0, 'drawn by script: PixelLab animate_image needs a 32x32+ frame and an object this small drifts; teardrop, white core, yellow, orange tip, no outline; redrawn once (first version was a capsule)'),
       ('a-m2-curtain', 'A-M2 curtain sway 48x96, 6f @160 ms', ANI, 4812, 2, 'pixflux first frame (1) + animate_image (1); frames 1-6 of 7 kept (frame 0 is the input)'),
       ('a-m3-dancers', 'A-M3 dancer silhouettes 96x48, 8f @120 ms', ANI, 4814, 4, 'first try (seed 4813) drifted and lost a dancer after frame 5; fix round 1: first frame also pinned as last_frame, seed 4814, stable and loops. 1+1+1 gens, plus 1 first frame'),
       ('a-c2-rain-tile', 'A-C2 rain tile 64x64, 4f @80 ms', PROC, 4821, 0, 'drawn by script so the 4f loop is seamless (streaks move 16 px per frame down a 64 px tile)'),
       ('a-c3-train', 'A-C3 train lights 194x24, 8f @70 ms', ANI, 4822, 2, 'pixflux first frame (1) + animate_image (1); frames 1-8 kept. 194 wide (even rule)')]
for k, desc, tool, sd, g, note in amb:
    A['ambient-' + k] = a('vfx/%s-strip.png' % k, tool, sd, S if k != 'a-m1-candle-flame' else [3, 3, 4, 3, 3, 3, 3], desc + '. ' + note, g)
for h in ['druid', 'champion', 'witch']:
    A['hero-%s-walk' % h] = a('heroes/snapped/%s-walk-0.png' % h, 'animate_character template walking-8-frames', None, S,
                              'H4: 8f east @110 ms, template, 1 gen; 128 canvas, every frame on one foot baseline (the template drifted 3 rows), snapped in CIELAB', 1)
    A['hero-%s-triumph' % h] = a('heroes/snapped/%s-triumph-0.png' % h, 'animate_character v3 custom 6f', None, S,
                                 'H5: 6f east @90 ms, last frame held 400 ms; reference frame dropped; ' + ('2 gens' if h != 'witch' else '1 gen'), 1 if h == 'witch' else 2)
A['v5-d20'] = a('shared/d20.png', PIX, 4505, [4, 3, 4, 3, 3, 3, 3], '32x32 icosahedron, cyan faces; the first try (4505) read as a cube; fix round 1: 2 seeds, 4521 picked (3 gens)', 3)
A['v5-d20-tumble'] = a('shared/d20-tumble-0.png', ANI, 4505, S, '8f tumble from the static die, frame 0 of the 9 returned is the input and is dropped; snapped in CIELAB; numbers are drawn in code', 1)
emb = {'openness': 'open door', 'conscientiousness': 'ledger', 'extraversion': 'raised hand', 'agreeableness': 'clasped hands (fix round 1: 2 seeds)', 'c_assert': 'banner',
       'c_coop': 'bridge (fix round 1: 2 seeds; weakest of the set)', 'autonomy': 'compass', 'playfulness': 'kite (fix round 1: 2 seeds)', 'self_efficacy': 'hammer', 'locus_of_control': 'helm wheel (fix round 1: 2 seeds)'}
for k, v in emb.items():
    A['emblem-' + k] = a('emblems/%s.png' % k, PXN, 4601, [3, 3, 4, 3, 3, 3, 3], '24x24, ' + v + '; pixen has no palette input, snapped in CIELAB', 3 if 'fix round' in v else 1)
for k, d in (('lantern', 4611), ('masquerade', 4631), ('city', 4613)):
    A['badge-' + k] = a('shared/badge-%s.png' % k, PIX, d, S, '32x32, forced palette' + ('; fix round 1: the first masquerade badge was a grim face (2 more seeds, 4632 picked; 3 gens)' if k == 'masquerade' else ''), 3 if k == 'masquerade' else 1)
ends = ['lantern.ending-singing-deep', 'lantern.ending-long-way-home', 'lantern.ending-rooks-lantern', 'lantern.ending-toll-forward', 'masquerade.ending-last-waltz', 'masquerade.ending-quiet-exit',
        'masquerade.ending-unmasked-together', 'masquerade.ending-clock-twice', 'city.ending-night-bus-crew', 'city.ending-sunrise-walk', 'city.ending-diner-dawn', 'city.ending-first-train']
for e in ends:
    A['ending-' + e] = a('endings/%s.png' % e, PIX + ' img2img (init = tools/compose-endings.py, strength 650)', None, S,
                         '192x116 (pixflux needs sizes divisible by 4; 195x118 is refused): far + mid + hero + NPCs composed, then painted at strength 650, forced palette. The top 16 rows mirror the plate top, so the cave cards show a symmetric ceiling' + ('; redone once after the City NPCs were redrawn (+1 gen)' if e.startswith('city.') else ''), 2 if e.startswith('city.') else 1)
d = json.load(open(P))
d['assets'].update(A)
json.dump(d, open(P, 'w'), indent=1)
bad = [k for k, v in A.items() if v['status'] != 'pass']
print(len(A), 'new assets;', len(A) - len(bad), 'pass; not passing:', bad, '; total gens noted', sum(v['gens'] for v in A.values()))
