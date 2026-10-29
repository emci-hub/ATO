# Snaps hero + NPC frames to art-src/quests/palette.png by nearest colour in CIELAB (§1.9 step 6). Originals stay; output goes to
# a `snapped/` folder next to them. (An RGB-distance snap dulled the heroes; LAB keeps hue.)
import glob, os
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
n = 0
for d in ('heroes', 'npcs'):
    os.makedirs(Q + d + '/snapped', exist_ok=True)
    for f in glob.glob(Q + d + '/*.png'):
        b = os.path.basename(f)
        if not any(k in b for k in ('-idle-', '-talk-', '-react-', '-rot-east', '-walk-', '-triumph-')) or 'check' in b or 'compare' in b:
            continue
        a = np.array(Image.open(f).convert('RGBA'))
        m = a[..., 3] >= 128
        idx = ((lab(a[..., :3].reshape(-1, 3))[:, None, :] - pl[None]) ** 2).sum(-1).argmin(1)
        r = np.zeros_like(a)
        r[..., :3] = pal[idx].reshape(a.shape[0], a.shape[1], 3).astype(np.uint8)
        r[..., 3] = np.where(m, 255, 0)
        r[~m, :3] = 0
        Image.fromarray(r).save(Q + d + '/snapped/' + b)
        n += 1
print(n, 'frames snapped')
