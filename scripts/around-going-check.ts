/**
 * Wave 2 Stage 2 — I'm going + colors. Run: npm run check:around-going
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { NIGHT_GOING_AGE_YEARS, isAtLeastAge } from '../src/lib/age';
import { COLOR_BLOB_MIN, showRequires18 } from '../src/lib/around/ages';
import { aroundEmptyCopy, fetchWeekendJson } from '../src/lib/around/fetch';
import { FIXTURE_CITY, FIXTURE_WEEKEND } from '../src/lib/around/fixture';
import { slugifyCity } from '../src/lib/around/slug';
import { colorHueFromShowUp } from '../src/lib/color';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const file = path.resolve('.env.local');
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

async function main() {
  Object.assign(process.env, loadEnv());

  assert.equal(showRequires18('18+'), true);
  assert.equal(showRequires18('19+'), true);
  assert.equal(showRequires18('18 and over'), true);
  assert.equal(showRequires18('All Ages'), false);
  assert.equal(showRequires18('16+'), false);
  assert.equal(showRequires18(null), false);
  ok('18+ gate reads ages flags; all-ages / 16+ / null are open');

  const seventeen = `${new Date().getFullYear() - 17}-06-15`;
  const adult = `${new Date().getFullYear() - 20}-06-15`;
  assert.equal(isAtLeastAge(seventeen, NIGHT_GOING_AGE_YEARS), false);
  assert.equal(isAtLeastAge(adult, NIGHT_GOING_AGE_YEARS), true);
  ok('17 is blocked from 18+ nights; 20 is not');

  assert.equal(colorHueFromShowUp('building something'), 94);
  assert.equal(colorHueFromShowUp('running hot'), 68);
  assert.equal(COLOR_BLOB_MIN, 3);
  ok('color hue is stable; blob threshold is 3');

  assert.equal(FIXTURE_WEEKEND.shows.length, 2);
  assert.equal(FIXTURE_WEEKEND.shows[0].id, 'ato:test-warehouse');
  assert.equal(showRequires18(FIXTURE_WEEKEND.shows[0].ages), false);
  assert.equal(FIXTURE_WEEKEND.shows[1].id, 'ato:test-18plus');
  assert.equal(showRequires18(FIXTURE_WEEKEND.shows[1].ages), true);
  ok('fixture seeds an all-ages show and an 18+ show');

  assert.equal(slugifyCity('fixture'), 'fixture');
  ok('typed city fixture slugifies without GPS');

  const root = path.resolve(__dirname, '..');
  const aroundScreen = fs.readFileSync(path.join(root, 'src/app/(tabs)/around.tsx'), 'utf8');
  assert.match(aroundScreen, /I'm going/);
  assert.match(aroundScreen, /aroundEmptyCopy/);
  assert.doesNotMatch(aroundScreen, /heat map|heatmap/i);
  assert.doesNotMatch(aroundScreen, /\$\{colors\.length\}|\$\{faces\.length\}|people going/i);
  ok("Around has I'm going, honest empty, no heatmap, no raw counts in copy");

  const fetchSrc = fs.readFileSync(path.join(root, 'src/lib/around/fetch.ts'), 'utf8');
  assert.match(fetchSrc, /FIXTURE_CITY/);
  assert.doesNotMatch(fetchSrc, /live GPS|geolocation/i);
  ok('fixture city is local; city is still not GPS');

  const fixture = await fetchWeekendJson(FIXTURE_CITY);
  assert.equal(fixture.status, 'ok');
  if (fixture.status === 'ok') {
    assert.equal(fixture.payload.shows.length, 2);
  }
  ok('fixture city returns seeded shows');

  const empty = await fetchWeekendJson('nowhere');
  assert.equal(empty.status, 'empty');
  assert.equal(aroundEmptyCopy(), 'nothing this weekend');
  ok('unknown city stays honest-empty');

  console.log(`\naround-going-check: ${passed}/${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
