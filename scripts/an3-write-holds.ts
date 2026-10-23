/**
 * AN3 — write `<clip>/ms.json` (`ms` + per-frame `holds`) for every streetwear hero's
 * Idle / Walk / Dash / Attack / Skill / Hurt / Faint raw folder. Run once, then
 * `npm run art:pack -- --family heroes --skin streetwear` (or the usual pack call).
 *
 * Totals match the old flat cadence (Walk 800, Dash 400, Attack 520, Skill 560, Hurt 840,
 * Faint 770), so anything timed off a clip's length (attack gate, one-shot end) is
 * unchanged. Only the Idle changes length: 1300 ms (the game used 4 x 120 = 480).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'art-src/pixellab');

/** frames -> holds. A clip whose frame count is not listed is skipped (and reported). */
const HOLDS: Record<string, Record<number, number[]>> = {
  Idle: { 4: [400, 250, 400, 250] },
  Walk: { 8: [120, 80, 120, 80, 120, 80, 120, 80] },
  Dash: { 8: [40, 40, 50, 60, 60, 50, 50, 50] },
  Attack: { 8: [90, 70, 45, 40, 45, 60, 80, 90], 6: [70, 60, 35, 35, 80, 110] },
  Skill: { 8: [100, 80, 60, 45, 45, 60, 80, 90] },
  Hurt: { 6: [70, 90, 130, 170, 180, 200] },
  Faint: { 7: [80, 80, 90, 100, 110, 130, 180] },
};

let written = 0;
const skipped: string[] = [];
for (const hero of fs.readdirSync(BASE).filter((d) => /^hero\..+\.streetwear$/.test(d))) {
  for (const gen of fs.readdirSync(path.join(BASE, hero), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const anims = path.join(BASE, hero, gen.name, 'raw/animations');
    if (!fs.existsSync(anims)) continue;
    for (const clip of Object.keys(HOLDS)) {
      const dir = path.join(anims, clip);
      const east = path.join(dir, 'east');
      if (!fs.existsSync(east)) continue;
      const frames = fs.readdirSync(east).filter((f) => /^frame_\d+\.png$/.test(f)).length;
      const holds = HOLDS[clip][frames];
      if (!holds) {
        skipped.push(`${hero}/${gen.name}/${clip} (${frames} frames)`);
        continue;
      }
      const total = holds.reduce((a, b) => a + b, 0);
      const ms = Math.round(total / frames);
      fs.writeFileSync(path.join(dir, 'ms.json'), `${JSON.stringify({ ms, holds })}\n`);
      written += 1;
    }
  }
}
console.log(`wrote ${written} ms.json files`);
if (skipped.length > 0) console.log(`skipped (no pattern for this frame count):\n  ${skipped.join('\n  ')}`);
