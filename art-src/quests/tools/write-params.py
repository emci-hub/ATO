# Writes art-src/quests/params.json: per-asset critique scores (§1.9 rubric), tool + seed, status. Scores are the author's own
# read of each asset next to refs/ (criteria in order: silhouette, value contrast, palette lock, clean pixels, light/shading,
# scale+camera, style match / animation). pass = total >= 22 and no criterion below 2. Fails keep a placeholder.
import json

R = ['silhouette', 'value', 'palette', 'pixels', 'light', 'scale_camera', 'style']
PIX = 'create_image_pixflux'
PRO = 'create_image_pro'


def a(file, tool, seed, scores, note='', gens=1, **kw):
    t = sum(scores)
    d = {'file': file, 'tool': tool, 'seed': seed, 'scores': dict(zip(R, scores)), 'total': t,
         'status': 'pass' if t >= 22 and min(scores) >= 2 else 'placeholder', 'gens': gens, 'note': note}
    d.update(kw)
    return d


A = {
    'far-1-gate': a('lantern/wip/far-1-gate.png', PRO, 4101, [3, 3, 4, 3, 3, 3, 3], 'approved style anchor plate (test 02)', 10),
    'far-2-fork': a('lantern/wip/far-2-fork.png', PRO, 4101, [3, 3, 4, 3, 4, 3, 3], 'real fork, glow right', 10),
    'far-3-bridge': a('lantern/wip/far-3-bridge.png', PRO, 4101, [3, 3, 4, 3, 3, 3, 3], 'bridge, lantern post, cyan below', 10),
    'far-4-lake': a('lantern/wip/far-4-lake.png', PRO, 4101, [3, 3, 4, 3, 3, 3, 3], 'cyan lake in a dome; floor band is stone', 10),
    'far-5-daylight': a('lantern/wip/far-5-daylight.png', PRO, 4101, [3, 3, 4, 3, 4, 3, 3], 'warm daylight shaft, ending-card light', 10),
    'mid-1-rockarch': a('lantern/wip/mid-1-rockarch.png', PIX, 4102, [3, 3, 4, 3, 3, 3, 3], 'edge arches, empty centre (fresh generation, no init)'),
    'mid-2-fork': a('lantern/wip/mid-2-fork.png', PIX, 4101, [3, 3, 4, 3, 3, 3, 3], 'beam + rope left, rock right'),
    'mid-3-bridge': a('lantern/wip/mid-3-bridge.png', PIX, 4101, [3, 3, 4, 3, 3, 3, 3], 'rope posts both edges (thin, subtle)'),
    'mid-4-lake': a('lantern/wip/mid-4-lake-r4.png', PIX, 4104, [3, 3, 4, 3, 3, 3, 3], 'fix round 2: flat side-view crystal spikes; r1 filled the frame, r2 was isometric, r3 black blocks', 5),
    'mid-5-daylight': a('lantern/wip/mid-5-daylight.png', PIX, 4101, [3, 3, 4, 3, 3, 3, 3], 'fallen beams + rocks at the edges'),
    'prop-lantern': a('lantern/wip/prop-lantern.png', PIX, 4101, [3, 3, 4, 3, 3, 3, 3], '32x32 (min canvas; spec 12x16 is below the 32x32 minimum area): atlas can crop'),
    'prop-rope-bridge': a('lantern/wip/prop-rope-bridge.png', PIX, 4101, [3, 3, 4, 3, 3, 3, 3], '64x32'),
    'prop-raft': a('lantern/wip/prop-raft.png', PIX, 4101, [3, 2, 4, 3, 3, 2, 3], 'top-down 3/4 view, wrong camera; fix r1 (flat elevation, 2 seeds) came back too thin/messy; fix r2 (flat side view, logs + pole, seeds 4104/4105) still thin: placeholder after 2 rounds', 5),
    'prop-mine-cart': a('lantern/wip/prop-mine-cart.png', PIX, 4101, [3, 3, 4, 3, 3, 3, 3], '48x40'),
    'prop-glow-crystal': a('lantern/wip/prop-crystal-r2.png', PIX, 4102, [3, 3, 4, 3, 3, 3, 3], 'fix r1: flat spikes on a rock (r0 was isometric)', 3),
    'prop-ration-crate': a('lantern/wip/prop-crate-r4.png', PIX, 4104, [3, 3, 4, 3, 3, 3, 3], 'fix round 2: flat front view (r0 3/4 box, r1 frame-like); low contrast brown on brown', 5),
    'ground-1-gate': a('lantern/wip/ground-1-r3.png', PRO, 4102, [2, 3, 4, 3, 3, 2, 2], 'placeholder: 3 tries (pixflux perspective tiles; Pro r1 near-black; Pro r3 has a white band on top). The far plate carries its own floor band', 21),
    'ground-2-fork': a('lantern/wip/ground-2-r2.png', PRO, 4101, [3, 3, 4, 3, 3, 3, 3], 'fix round: Pro with the far plate as reference_images; rubble floor in the plate colours', 11),
    'ground-3-bridge': a('lantern/wip/ground-3-r3.png', PRO, 4102, [3, 3, 4, 3, 3, 3, 3], 'fix round 2 (r1 was white); brown planks', 21),
    'ground-4-lake': a('lantern/wip/ground-4-r2.png', PRO, 4101, [3, 3, 4, 3, 3, 3, 3], 'fix round: dark shore stones', 12),
    'ground-5-daylight': a('lantern/wip/ground-5-r2.png', PRO, 4101, [3, 3, 4, 3, 3, 3, 3], 'fix round: warm rubble floor', 11),
    'npc-rook': a('npcs/snapped/rook-rot-east.png', 'create_character v3 (64)', None, [4, 3, 4, 4, 4, 4, 4], 'v3 has no palette input, so frames are snapped afterwards in CIELAB (tools/snap-palette.py; the RGB-distance snap dulled them, LAB keeps hue); originals beside the snapped/ folder. Idle (template, 4f) + talk (v3, 4f+ref frame), east only', 4),
    'npc-vey': a('npcs/snapped/vey-rot-east.png', 'create_character v3 (64)', None, [4, 3, 4, 4, 4, 4, 4], 'same as Rook', 4),
    'portrait-rook': a('npcs/rook-portrait.png', PRO, 4401, [4, 4, 4, 4, 4, 3, 4], 'with the sprite as reference (first try without it: wrong person, 20/28 fail); 16 candidates, #1 picked', 11),
    'portrait-vey': a('npcs/vey-portrait.png', PRO, 4402, [4, 4, 4, 4, 4, 3, 4], 'same; #0 picked', 11),
    **{('icon-' + n): a('icons/%s.png' % n, PRO, 4506, [3, 3, 4, 3, 3, 3, 3], '16x16, picked from 64 candidates' + (' (fix round 1: simplified prompt, max_colors 8)' if n in ('stat-laurel', 'u3-ledger', 'u3-swords') else ''), 10 if n not in ('stat-laurel', 'u3-ledger', 'u3-swords') else 20) for n in ['stat-supplies', 'stat-heart', 'stat-laurel', 'u3-explore', 'u3-ledger', 'u3-quote', 'u3-swords', 'u3-hourglass', 'rewind']},
    'vfx-v1-sparkle': a('vfx/v1-sparkle-burst-strip.png', 'procedural (vfx/gen-vfx.py)', None, [3, 3, 4, 4, 3, 3, 3], '32x32, 6f @83 ms; PixelLab vfx_workbench tried once (free), came out 31x23 white specks, not on palette', 0),
    'vfx-v2-dust': a('vfx/v2-dust-puff-strip.png', 'procedural', None, [3, 3, 4, 3, 3, 3, 3], '32x16, 5f @60/60/80/100/120 ms', 0),
    'vfx-v3-up': a('vfx/v3-stat-up-strip.png', 'procedural', None, [4, 3, 4, 4, 3, 3, 3], '16x16, 4f @80 ms, green', 0),
    'vfx-v3-down': a('vfx/v3-stat-down-strip.png', 'procedural', None, [4, 3, 4, 4, 3, 3, 3], '16x16, 4f @80 ms, warm amber (never red: no bad pole)', 0),
    'ambient-a-l3-drip': a('vfx/a-l3-drip-strip.png', 'procedural', None, [3, 3, 4, 3, 3, 3, 3], '16x32, 6f @100 ms then hold 1.2 s on f0; redrawn after review (stalactite shading, bigger drop)', 0, ms=[100, 100, 100, 100, 100, 100], hold_ms=1200),
}
for n in ['druid', 'champion', 'witch']:
    A['hero-' + n] = a('heroes/snapped/%s-idle-0.png' % n, 'create_character v3 import + animate_character', None, [3, 3, 4, 3, 3, 3, 3],
                       'figure 64 px on 88 canvas; idle template 4f @300/300/400/300; talk + react v3 4f; east only; snapped to the palette in CIELAB (tools/snap-palette.py; originals beside it). If emci prefers the unsnapped colours (PIXELLAB_ANIMATION §4), use the originals: palette criterion drops to 2 (20/28)', 4)
for n in ['ratkin-treasure-hunter', 'death-knight', 'abyssal-assassin', 'arcane-engineer', 'demon-guardian', 'seraphic-cleric', 'crystal-berserker']:
    A['hero-' + n] = a('heroes/snapped/%s-idle-000.png' % n, 'create_character v3 import + animate_character', None, [3, 3, 4, 3, 3, 3, 3], 'H1 idle only, 4f, east; snapped in CIELAB; 2 gens', 2)
# gens are per asset incl. its own fix rounds; 13 more gens went to rejected first tests (test plate 01, batch-1 fork plate + 2 gate mids) and the first wrong-person portraits (2). Total spent is in credits.md (342).
json.dump({'style_card': 'art-src/quests/STYLE.md', 'rubric': R, 'assets': A}, open('C:/Users/lil_e/Desktop/ATO/art-src/quests/params.json', 'w'), indent=1)
p = [k for k, v in A.items() if v['status'] == 'pass']
print(len(A), 'assets;', len(p), 'pass;', 'placeholder:', [k for k, v in A.items() if v['status'] != 'pass'])
