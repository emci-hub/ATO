/**
 * Quests atlas check (ATO-BUILD PHASE-22).
 * Run: npm run check:quest-atlas
 *
 * Budget (§1.9, raise a limit only with a `// raised: <reason>` note):
 *  - each atlas 2048 x 2048 or smaller, 12 or fewer files in assets/quests, 4 MB or less;
 *  - no loose PNGs (every PNG is a named atlas), no stale atlas JSON or art-keys.ts;
 * Integrity:
 *  - R20: every frame has 2 px of padding filled by edge extrude, and no two frames' cells overlap;
 *  - every campaign location, ending, prop, cast member, axis emblem and clip frame the content
 *    names exists in the atlas;
 *  - the stage code keeps the art rules (atlas-sprite is the only image reader, one frame callback).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ATLAS_ANIMS,
  ATLAS_FRAMES,
  ATLAS_NAMES,
  ATLAS_SIZES,
  QUEST_CAST_KEYS,
  QUEST_EMBLEM_FOR_AXIS,
  QUEST_ENDING_ART_KEYS,
  QUEST_HERO_KEYS,
  QUEST_LOCATION_KEYS,
  QUEST_PROP_KEYS,
} from '../src/lib/quests/art-keys';
import { QUEST_CAMPAIGNS } from '../src/lib/quests/content';
import { QUEST_AXES } from '../src/lib/quests/types';
import { type AtlasJson, MAX_SIDE, PAD, renderArtKeys } from './build-quest-atlas';
import { decodePng } from './quest-png';

const ROOT = join(__dirname, '..');
const DIR = join(ROOT, 'assets', 'quests');
let failed = 0;
function ok(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}\n     ${(e as Error).message}`);
  }
}

const MAX_FILES = 12;
const MAX_BYTES = 4 * 1024 * 1024;

const files = existsSync(DIR) ? readdirSync(DIR) : [];
const json = ATLAS_NAMES.map((n) => JSON.parse(readFileSync(join(DIR, `${n}.json`), 'utf8')) as AtlasJson);
const pngs = ATLAS_NAMES.map((n) => decodePng(readFileSync(join(DIR, `${n}.png`)), `${n}.png`));

ok('12 or fewer files under assets/quests, no loose PNGs', () => {
  assert.ok(files.length <= MAX_FILES, `${files.length} files`);
  const expected = new Set(ATLAS_NAMES.flatMap((n) => [`${n}.png`, `${n}.json`]));
  const stray = files.filter((f) => !expected.has(f));
  assert.deepEqual(stray, [], `unlisted files in assets/quests: ${stray.join(', ')}`);
});

ok('each atlas is 2048 x 2048 or smaller and matches its JSON', () => {
  ATLAS_NAMES.forEach((n, i) => {
    assert.ok(pngs[i].w <= MAX_SIDE && pngs[i].h <= MAX_SIDE, `${n} is ${pngs[i].w}x${pngs[i].h}`);
    assert.deepEqual([json[i].width, json[i].height], [pngs[i].w, pngs[i].h], `${n}.json size differs from the PNG`);
    assert.deepEqual([...ATLAS_SIZES[i]], [pngs[i].w, pngs[i].h], `art-keys.ts size for ${n} is stale`);
  });
});

ok('4 MB or less in total', () => {
  const bytes = files.reduce((s, f) => s + statSync(join(DIR, f)).size, 0);
  assert.ok(bytes <= MAX_BYTES, `${(bytes / 1024 / 1024).toFixed(2)} MB`);
});

ok('art-keys.ts is fresh (regenerated from the atlas JSON)', () => {
  const now = readFileSync(join(ROOT, 'src', 'lib', 'quests', 'art-keys.ts'), 'utf8');
  assert.equal(now, renderArtKeys(json), 'run npm run build:quest-atlas and commit the result');
});

ok('R20: 2 px padding filled by edge extrude; cells never overlap', () => {
  assert.equal(PAD, 2);
  json.forEach((a, i) => {
    const img = pngs[i];
    const px = (x: number, y: number) => img.d.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4).join(',');
    const cells: { key: string; x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const [key, f] of Object.entries(a.frames)) {
      const cell = { key, x0: f.x - PAD, y0: f.y - PAD, x1: f.x + f.w + PAD, y1: f.y + f.h + PAD };
      assert.ok(cell.x0 >= 0 && cell.y0 >= 0 && cell.x1 <= img.w && cell.y1 <= img.h, `${a.name}/${key} leaves the atlas`);
      for (let y = cell.y0; y < cell.y1; y++) {
        for (let x = cell.x0; x < cell.x1; x++) {
          const sx = Math.min(f.x + f.w - 1, Math.max(f.x, x));
          const sy = Math.min(f.y + f.h - 1, Math.max(f.y, y));
          if (sx === x && sy === y) continue;
          assert.equal(px(x, y), px(sx, sy), `${a.name}/${key}: padding pixel (${x},${y}) is not the edge extrude`);
        }
      }
      cells.push(cell);
    }
    cells.sort((p, q) => p.x0 - q.x0);
    for (let p = 0; p < cells.length; p++) {
      for (let q = p + 1; q < cells.length && cells[q].x0 < cells[p].x1; q++) {
        const overlap = cells[q].y0 < cells[p].y1 && cells[p].y0 < cells[q].y1;
        assert.ok(!overlap, `${a.name}: cells ${cells[p].key} and ${cells[q].key} overlap`);
      }
    }
  });
});

ok('every clip frame exists and every frame has sane numbers', () => {
  for (const [k, a] of Object.entries(ATLAS_ANIMS)) {
    const times = typeof a.ms === "number" ? [a.ms] : a.ms;
    assert.ok(a.n >= 2 && times.every((t) => t >= 30) && (typeof a.ms === "number" || a.ms.length === a.n), `${k}: ${a.n} frames at ${a.ms} ms`);
    for (let i = 0; i < a.n; i++) assert.ok(ATLAS_FRAMES[`${k}.${i}`], `clip ${k} lacks frame ${i}`);
  }
  for (const [k, f] of Object.entries(ATLAS_FRAMES)) {
    assert.ok(f[0] >= 0 && f[0] < ATLAS_NAMES.length, `${k}: atlas index`);
    assert.ok(f[3] > 0 && f[4] > 0 && (f[9] === 1 || f[9] === 2), `${k}: size or scale`);
  }
});

const real = QUEST_CAMPAIGNS.filter((c) => !c.isSample);
const artCampaign = (loc: string) => loc.split('.')[0];
/** Cast ids with no approved sprite: the stage skips them and the scene text carries them. */
const NO_SPRITE = new Set(['elder']);

ok('every location has far, mid and blur art; ground where the campaign has it', () => {
  for (const loc of QUEST_LOCATION_KEYS) {
    for (const layer of ['far', 'mid', 'blur']) assert.ok(ATLAS_FRAMES[`plate.${loc}.${layer}`], `no ${layer} plate for ${loc}`);
  }
  for (const loc of QUEST_LOCATION_KEYS.filter((l) => l.startsWith('lantern.'))) assert.ok(ATLAS_FRAMES[`plate.${loc}.ground`], `no ground for ${loc}`);
});

ok('every content art key resolves (locations, endings, props, cast)', () => {
  for (const c of real) {
    for (const s of c.scenes) {
      assert.ok(QUEST_LOCATION_KEYS.includes(s.art.location), `${c.id}/${s.id}: location ${s.art.location}`);
      const camp = artCampaign(s.art.location);
      for (const p of s.art.props ?? []) assert.ok(ATLAS_FRAMES[`prop.${camp}.${p.id}`], `${c.id}/${s.id}: no prop art "${p.id}" in ${camp}`);
      for (const n of (s.art.cast ?? []).filter((c) => !NO_SPRITE.has(c))) {
        assert.ok(QUEST_CAST_KEYS.includes(n), `${c.id}/${s.id}: no NPC art for "${n}"`);
        for (const f of [`npc.${n}.idle.0`, `npc.${n}.talk.0`, `npc.${n}.portrait`]) assert.ok(ATLAS_FRAMES[f], `${f} missing`);
      }
    }
    for (const e of c.endings) assert.ok(ATLAS_FRAMES[`end.${e.art}`], `${c.id}/${e.id}: no ending card ${e.art}`);
  }
  for (const e of QUEST_ENDING_ART_KEYS) assert.ok(ATLAS_FRAMES[`end.${e}`], `ending card ${e}`);
  for (const p of QUEST_PROP_KEYS) assert.ok(ATLAS_FRAMES[`prop.${p}`], `prop ${p}`);
});

ok('every quest axis has an emblem; every hero has an idle clip; UI frames exist', () => {
  for (const axis of QUEST_AXES) assert.ok(ATLAS_FRAMES[`emblem.${QUEST_EMBLEM_FOR_AXIS[axis]}`], `no emblem for ${axis}`);
  for (const h of QUEST_HERO_KEYS) assert.ok(ATLAS_ANIMS[`hero.${h}.idle`], `no idle clip for hero ${h}`);
  for (const k of ['d20', 'd20.tumble.0', 'badge.lantern', 'badge.masquerade', 'badge.city', 'ui.rewind', 'ui.stat-supplies', 'vfx.sparkle.0', 'vfx.stat-up.0', 'vfx.stat-down.0', 'vfx.dust.0']) {
    assert.ok(ATLAS_FRAMES[k], `${k} missing`);
  }
});

ok('the stage reads art only through atlas-sprite and keeps one frame callback', () => {
  const stage = readFileSync(join(ROOT, 'src/components/quests/stage.tsx'), 'utf8');
  const sprite = readFileSync(join(ROOT, 'src/components/quests/atlas-sprite.tsx'), 'utf8');
  assert.match(sprite, /overflow: 'hidden'/);
  assert.match(sprite, /@\/lib\/quests\/art-keys/);
  assert.doesNotMatch(stage, /expo-image/, 'stage must draw art through AtlasSprite');
  assert.doesNotMatch(sprite, /useFrameCallback\(/, 'the stage owns the only frame callback');
  assert.doesNotMatch(stage + sprite, /<Pattern/, 'no SVG <Pattern>');
  for (const n of ATLAS_NAMES) assert.match(sprite, new RegExp(`assets/quests/${n}\\.png`), `${n}.png is not required by atlas-sprite`);
});

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nquest-atlas: all checks passed');
