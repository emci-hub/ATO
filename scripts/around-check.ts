/**
 * Wave 2 Stage 1 — Around data layer. Run: npm run check:around
 *
 * Phone fetches static Storage JSON. Edmtrain is pulled only by the refresh job.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { AROUND_CITIES, DEFAULT_AROUND_CITY } from '../src/constants/around-cities';
import { edmtrainEvents, edmtrainLocationId } from '../src/lib/around/edmtrain-api';
import { aroundEmptyCopy, fetchWeekendJson } from '../src/lib/around/fetch';
import { mapEdmtrainEvents } from '../src/lib/around/map-edmtrain';
import { slugifyCity } from '../src/lib/around/slug';
import { collectTicketLinks, ticketKindForUrl } from '../src/lib/around/tickets';
import { addDays, weekendWindow } from '../src/lib/around/weekend';

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

const env = loadEnv();
Object.assign(process.env, env);

assert.deepEqual(
  AROUND_CITIES.map((c) => c.slug),
  ['calgary'],
);
assert.equal(DEFAULT_AROUND_CITY.slug, 'calgary');
ok('Wave 2 city list is Calgary only');

assert.equal(slugifyCity('Calgary, AB'), 'calgary');
assert.equal(slugifyCity('Calgary AB'), 'calgary');
assert.equal(slugifyCity('  Edmonton  '), 'edmonton');
assert.equal(slugifyCity('???'), null);
ok('city is slugified from typed text, not GPS');

assert.equal(aroundEmptyCopy(), 'nothing this weekend');
ok('empty copy is honest, not an error');

assert.equal(ticketKindForUrl('https://edmtrain.com/event/123'), 'edmtrain');
assert.equal(ticketKindForUrl('https://ra.co/events/1'), 'ra');
assert.equal(ticketKindForUrl('https://shotgun.live/x'), 'shotgun');
assert.equal(ticketKindForUrl('https://dice.fm/event/x'), 'dice');
const links = collectTicketLinks('https://edmtrain.com/e/1', ['https://ra.co/events/1']);
assert.equal(links[0].kind, 'edmtrain');
assert.equal(links[1].kind, 'ra');
ok('ticket links classify Edmtrain / RA / Shotgun / DICE; Edmtrain stays first');

const window = weekendWindow('America/Edmonton', new Date('2026-08-26T18:00:00Z'));
assert.equal(window.start, '2026-08-28');
assert.equal(window.end, '2026-08-30');
assert.equal(addDays('2026-08-28', 2), '2026-08-30');
ok('weekend window is Fri–Sun in the city timezone');

const mapped = mapEdmtrainEvents('calgary', '2026-08-28', '2026-08-30', [
  {
    id: 99,
    name: 'Warehouse',
    date: '2026-08-29',
    ages: '18+',
    link: 'https://edmtrain.com/calgary-ab?event=99',
    ticketLink: 'https://dice.fm/event/99',
    artistList: [{ name: 'Test Act' }],
    venue: { name: 'The Palais' },
    liveStreamInd: false,
  },
  {
    id: 100,
    date: '2026-08-29',
    link: 'https://edmtrain.com/calgary-ab?event=100',
    liveStreamInd: true,
    artistList: [{ name: 'Stream Only' }],
  },
  {
    id: 101,
    date: '2026-09-04',
    link: 'https://edmtrain.com/calgary-ab?event=101',
    artistList: [{ name: 'Next Week' }],
  },
]);
assert.equal(mapped.shows.length, 1);
assert.equal(mapped.shows[0].name, 'Warehouse');
assert.equal(mapped.shows[0].links[0].url, 'https://edmtrain.com/calgary-ab?event=99');
assert.equal(mapped.source, 'edmtrain');
const emptyMapped = mapEdmtrainEvents('nowhere', '2026-08-28', '2026-08-30', []);
assert.equal(emptyMapped.shows.length, 0);

// Live Calgary listing on 2026-08-26: RIOT, Palace Theatre, Sat Aug 29.
// Event page https://edmtrain.com/calgary-ab/riot-529397 — not scraped into Storage.
const riot = mapEdmtrainEvents('calgary', '2026-08-28', '2026-08-30', [
  {
    id: 529397,
    name: 'RIOT',
    date: '2026-08-29',
    link: 'https://edmtrain.com/calgary-ab/riot-529397',
    artistList: [{ name: 'RIOT' }],
    venue: { name: 'Palace Theatre Calgary' },
    liveStreamInd: false,
  },
]);
assert.equal(riot.shows.length, 1);
assert.equal(riot.shows[0].id, 'edmtrain:529397');
assert.equal(riot.shows[0].name, 'RIOT');
assert.equal(riot.shows[0].venueName, 'Palace Theatre Calgary');
assert.equal(riot.shows[0].links[0].kind, 'edmtrain');
assert.equal(riot.shows[0].links[0].url, 'https://edmtrain.com/calgary-ab/riot-529397');
ok('mapper keeps real shows, drops livestreams/out-of-window, empty list stays empty');
ok('real Calgary Edmtrain show (RIOT Aug 29) maps into weekend JSON');

const root = path.resolve(__dirname, '..');
const aroundScreen = fs.readFileSync(path.join(root, 'src/app/(tabs)/around.tsx'), 'utf8');
const refreshFn = fs.readFileSync(path.join(root, 'supabase/functions/refresh-around/index.ts'), 'utf8');
const you = fs.readFileSync(path.join(root, 'src/app/(tabs)/you.tsx'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src/app/onboarding.tsx'), 'utf8');
assert.match(aroundScreen, /aroundEmptyCopy/);
assert.doesNotMatch(aroundScreen, /heat map|heatmap/i);
assert.match(refreshFn, /weekend\.json/);
assert.match(refreshFn, /EDMTRAIN_CLIENT_KEY/);
assert.match(you, /CityPicker/);
assert.match(onboarding, /CityPicker/);
ok('Around keeps honest empty + no heatmap; city is typed at setup; job writes weekend.json');

const fnCities = fs.readFileSync(path.join(root, 'supabase/functions/refresh-around/around.ts'), 'utf8');
assert.match(fnCities, /edmtrainCity: 'Calgary'/);
assert.match(fnCities, /edmtrainState: 'Alberta'/);
ok('refresh job looks up Calgary, Alberta — not hardcoded fetch URLs per screen');

async function live() {
  const base = env.EXPO_PUBLIC_SUPABASE_URL;
  assert.ok(base, 'EXPO_PUBLIC_SUPABASE_URL missing');

  const emptyUrl = `${base.replace(/\/$/, '')}/storage/v1/object/public/around/nowhere/weekend.json`;
  const emptyRes = await fetch(emptyUrl, { headers: { Accept: 'application/json' } });
  assert.ok(emptyRes.status === 400 || emptyRes.status === 404, `nowhere should 404, got ${emptyRes.status}`);
  const nowhereLoad = await fetchWeekendJson('nowhere');
  assert.equal(nowhereLoad.status, 'empty');
  ok('city/weekend with no object returns 404 (honest empty, not fake shows)');

  const clientKey = env.EDMTRAIN_CLIENT_KEY || process.env.EDMTRAIN_CLIENT_KEY;
  if (!clientKey) {
    console.log('  ⚠ EDMTRAIN_CLIENT_KEY not in .env.local — live Edmtrain pull skipped until the key is applied at edmtrain.com/developer-api and set as an Edge Function secret.');
  } else {
    const calgary = AROUND_CITIES[0];
    const locationId = await edmtrainLocationId(calgary.edmtrainCity, calgary.edmtrainState, clientKey);
    ok(`Calgary is a live Edmtrain location (id ${locationId})`);

    const { start, end } = weekendWindow(calgary.timeZone);
    const weekendEvents = await edmtrainEvents(locationId, start, end, clientKey);
    const weekendJson = mapEdmtrainEvents(calgary.slug, start, end, weekendEvents as never[]);
    if (weekendJson.shows.length > 0) {
      assert.ok(weekendJson.shows[0].links[0].url.includes('edmtrain.com'));
      ok(`Calgary this weekend has ${weekendJson.shows.length} real Edmtrain show(s) in the JSON`);
    } else {
      const laterEnd = addDays(start, 60);
      const upcoming = await edmtrainEvents(locationId, start, laterEnd, clientKey);
      const upcomingJson = mapEdmtrainEvents(calgary.slug, start, laterEnd, upcoming as never[]);
      assert.ok(
        upcomingJson.shows.length > 0,
        'Calgary returned 0 events for 60 days — check the API key and coverage',
      );
      ok(
        `Calgary this weekend is honestly empty (${start}–${end}); ${upcomingJson.shows.length} real upcoming Edmtrain show(s) mapped into JSON outside that window`,
      );
    }
  }
}

live()
  .then(() => {
    console.log(`\naround-check: ${passed}/${passed} passed`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
