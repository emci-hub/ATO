# PHASE-21: copies the downloaded v3 NPC frames (npcs/raw/<name>/Idle/...) into npcs/ with the Lantern file names
# (<n>-rot-east, <n>-idle-0..3, <n>-talk-0..4); tools/snap-palette.py then snaps them to the palette in CIELAB.
import os, shutil

Q = 'C:/Users/lil_e/Desktop/ATO/art-src/quests/npcs/'
for n in ['ines', 'corvin', 'pell', 'mara', 'theo', 'dee']:
    base = Q + 'raw/%s/Idle/' % n
    shutil.copy(base + 'rotations/east.png', Q + '%s-rot-east.png' % n)
    shutil.copy(base + 'rotations/south.png', Q + '%s-rot-south.png' % n)
    for clip, name in (('idle', 'idle'), ('talk', 'talk')):
        d = base + 'animations/%s_%s/east/' % (n, clip)
        for i, f in enumerate(sorted(os.listdir(d))):
            shutil.copy(d + f, Q + '%s-%s-%d.png' % (n, name, i))
print('ok')
