/**
 * AN4 — install the approved engine breathing Idles for the creeps, boss and towers.
 * Same recipe as AN2 (heroes): archive the old Idle under art-src/archive/2026-10/, copy the
 * engine's east + west frames into `<id>/migrated/raw/animations/Idle/`, write `Idle/ms.json`
 * ({ms: mean, holds: [400,250,400,250]}). Directions the engine did not build (creep / boss
 * north + south) stay as they were. Run once, then `art:pack` (+ `art:sync`, `anim:library`).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'art-src/pixellab');
const ARCHIVE = path.join(ROOT, 'art-src/archive/2026-10');
const GEN = 'engine-breathing-idle-20261023';
const IDS = [
  'creep.knight',
  'creep.village-girl',
  'creep.wizard',
  'boss.oni',
  'tower.ghost',
  'tower.lux',
  'tower.viper',
];
const HOLDS = [400, 250, 400, 250];

for (const id of IDS) {
  const set = `${id}.streetwear`;
  const idle = path.join(BASE, set, 'migrated/raw/animations/Idle');
  const engine = path.join(BASE, set, GEN);
  const archive = path.join(ARCHIVE, `${set}-Idle-pre-engine-20261023`);
  if (!fs.existsSync(archive)) fs.cpSync(idle, archive, { recursive: true });
  for (const dir of ['east', 'west']) {
    const from = path.join(engine, dir);
    const to = path.join(idle, dir);
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from).filter((n) => /^frame_\d+\.png$/.test(n))) {
      fs.copyFileSync(path.join(from, f), path.join(to, f));
    }
  }
  const ms = Math.round(HOLDS.reduce((a, b) => a + b, 0) / HOLDS.length);
  fs.writeFileSync(path.join(idle, 'ms.json'), `${JSON.stringify({ ms, holds: HOLDS })}\n`);
  console.log(`installed ${set}`);
}
