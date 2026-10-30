# PHASE-21: picks the chosen candidates, snaps non-palette PixelLab output (pixen emblems, animate_image frames) to palette.png in CIELAB
# and writes the final files: emblems/<axis>.png, shared/{d20,d20-tumble-N,badge-*}.png, vfx/a-m2-curtain-N, a-m3-dancers-N, a-c3-train-N
# (+ -strip / -strip@2x). Forced-palette pixflux output (d20, badges) is copied as is. Raw downloads stay in */wip and emblems/cand.
import shutil
import numpy as np
from PIL import Image

Q = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/'
pal = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in open(Q + 'palette.txt').read().split()], dtype=float)


def lab(rgb):
    rgb = np.asarray(rgb, dtype=float) / 255
    l = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = l @ M.T / np.array([0.95047, 1, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


pl = lab(pal)


def snap(im):
    a = np.array(im.convert('RGBA'))
    m = a[..., 3] >= 128
    idx = ((lab(a[..., :3].reshape(-1, 3))[:, None, :] - pl[None]) ** 2).sum(-1).argmin(1)
    r = np.zeros_like(a)
    r[..., :3] = pal[idx].reshape(a.shape[0], a.shape[1], 3).astype(np.uint8)
    r[..., 3] = np.where(m, 255, 0)
    r[~m, :3] = 0
    return Image.fromarray(r)


def strip(frames, name):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        f.save(Q + 'vfx/%s-%d.png' % (name, i))
        s.alpha_composite(f, (i * w, 0))
    s.save(Q + 'vfx/%s-strip.png' % name)
    s.resize((s.width * 2, s.height * 2), Image.NEAREST).save(Q + 'vfx/%s-strip@2x.png' % name)


# emblems (pixen, no palette input): the picked candidate per lean
EMB = {'openness': 'openness', 'conscientiousness': 'conscientiousness', 'extraversion': 'extraversion', 'agreeableness': 'agreeableness-r1a',
       'c_assert': 'c_assert', 'c_coop': 'c_coop-r1a', 'autonomy': 'autonomy', 'playfulness': 'playfulness-r1a',
       'self_efficacy': 'self_efficacy', 'locus_of_control': 'locus_of_control-r1b'}
for k, v in EMB.items():
    snap(Image.open(Q + 'emblems/cand/%s.png' % v)).save(Q + 'emblems/%s.png' % k)

# shared: d20 (+ 8f tumble, raw frame 0 is the input), badges
shutil.copy(Q + 'shared/wip/d20-r1a.png', Q + 'shared/d20.png')
for i in range(8):
    snap(Image.open(Q + 'shared/wip/d20-tumble-%d.png' % (i + 1))).save(Q + 'shared/d20-tumble-%d.png' % i)
for k, v in (('lantern', 'badge-lantern'), ('masquerade', 'badge-masquerade-r1b'), ('city', 'badge-city')):
    shutil.copy(Q + 'shared/wip/%s.png' % v, Q + 'shared/badge-%s.png' % k)

# ambient (animate_image frames; index 0 is the input frame and is dropped)
strip([snap(Image.open(Q + 'masquerade/wip/amb-m2-curtain-raw-%d.png' % i)) for i in range(1, 7)], 'a-m2-curtain')
strip([snap(Image.open(Q + 'masquerade/wip/amb-m3-dancers-r2-%d.png' % i)) for i in range(1, 9)], 'a-m3-dancers')
strip([snap(Image.open(Q + 'city/wip/amb-c3-train-raw-%d.png' % i)) for i in range(1, 9)], 'a-c3-train')
print('ok')
