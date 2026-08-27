/**
 * Home-only Nudge (internal zGlitch). Run: npm run check:nudge
 *
 * Talk_style is never a signal. Empty slot when there is no real recent
 * skip / knock-in-text / safe fact. Safety gates match cut: crisis, two
 * days in a row, cruel filter, Do required.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { findNudgeSignal, NUDGE_INTERNAL_NAME, resolveNudge } from '../src/lib/voice/nudge';
import { NUDGE_LABEL } from '../src/lib/sage-copy';
import type { CheckHistory } from '../src/lib/voice/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(NUDGE_LABEL, 'Nudge');
assert.equal(NUDGE_INTERNAL_NAME, 'zGlitch');
ok('user-facing label is Nudge; internal name stays zGlitch');

const emptyHistory: CheckHistory[] = [];

assert.equal(
  findNudgeSignal({ knocksYouOff: 'sleep', facts: [], history: emptyHistory }),
  null,
);
assert.equal(
  resolveNudge({
    knocksYouOff: 'sleep',
    facts: [],
    history: emptyHistory,
    hasDo: true,
  }),
  null,
);
ok('talk_style-only (no skip, knock-in-text, or fact) renders empty');

const twoSkips: CheckHistory[] = [
  { day: 1, status: 'skipped', read: 'Keep it small.', do: 'After coffee, sit one minute.' },
  { day: 2, status: 'skipped', read: 'Still here.', do: 'After coffee, write one line.' },
];
const skipNudge = resolveNudge({
  knocksYouOff: '',
  facts: [],
  history: twoSkips,
  hasDo: true,
});
assert.ok(skipNudge && skipNudge.length > 0);
assert.match(skipNudge, /Do/);
assert.doesNotMatch(skipNudge, /quiet|even|loud|talk_style/i);
ok('2+ skips in last 7 is a real signal');

const knockHistory: CheckHistory[] = [
  {
    day: 1,
    status: 'done',
    read: 'Sleep ran the week, not you.',
    do: 'After coffee, put the phone in another room.',
  },
];
const knockNudge = resolveNudge({
  knocksYouOff: 'sleep',
  facts: [],
  history: knockHistory,
  hasDo: true,
});
assert.ok(knockNudge && /sleep/i.test(knockNudge));
ok('knock chip that actually showed up in recent Read/Do is a real signal');

assert.equal(
  findNudgeSignal({
    knocksYouOff: 'sleep',
    facts: [],
    history: [{ day: 1, status: 'done', read: 'The kettle is on.', do: 'After coffee, sit one minute.' }],
  }),
  null,
);
ok('having a knock chip without it showing up in recent text is not a signal');

const factNudge = resolveNudge({
  knocksYouOff: '',
  facts: ['I finish work at four'],
  history: [{ day: 1, status: 'done', read: 'One day.', do: 'After coffee, sit one minute.' }],
  hasDo: true,
});
assert.ok(factNudge && factNudge.includes('I finish work at four'));
ok('stored safe fact is a real signal');

assert.equal(
  findNudgeSignal({
    knocksYouOff: '',
    facts: ['I want to die tomorrow'],
    history: [{ day: 1, status: 'done', read: 'One day.', do: 'After coffee, sit one minute.' }],
  }),
  null,
);
ok('crisis-keyword facts are not used as Nudge signal');

assert.equal(
  resolveNudge({
    knocksYouOff: '',
    facts: ['I finish work at four'],
    history: twoSkips,
    hasDo: false,
  }),
  null,
);
ok('no Do → no Nudge');

assert.equal(
  resolveNudge({
    knocksYouOff: '',
    facts: ['I finish work at four'],
    history: twoSkips,
    hasDo: true,
    crisisToday: true,
  }),
  null,
);
assert.equal(
  resolveNudge({
    knocksYouOff: '',
    facts: ['I finish work at four'],
    history: twoSkips,
    hasDo: true,
    crisisYesterday: true,
  }),
  null,
);
assert.equal(
  resolveNudge({
    knocksYouOff: '',
    facts: ['I finish work at four'],
    history: twoSkips,
    hasDo: true,
    crisisDetected: true,
  }),
  null,
);
ok('crisis today / yesterday / detected → empty');

assert.equal(
  resolveNudge({
    knocksYouOff: '',
    facts: ['I finish work at four'],
    history: [
      {
        day: 1,
        status: 'done',
        read: 'One day.',
        do: 'After coffee, sit one minute.',
        nudge: 'Yesterday already had a Nudge.',
      },
    ],
    hasDo: true,
  }),
  null,
);
ok('two days in a row is gated');

const home = read('src/app/(tabs)/index.tsx');
const circle = read('src/app/(tabs)/circle.tsx');
const dawn = read('src/app/dawn.tsx');
const sage = read('src/app/(tabs)/sage.tsx');
const widget = read('targets/widget/widgets.swift');
const push = read('src/lib/push-copy.ts');
const todayCard = read('src/lib/today-card.ts');
const copy = read('src/lib/sage-copy.ts');
const nudgeSrc = read('src/lib/voice/nudge.ts');

assert.match(home, /NUDGE_LABEL/);
assert.match(home, /SAGE_NPC_LABEL|homeSageLabel/);
assert.match(copy, /Sage · npc/);
assert.doesNotMatch(circle, /NUDGE_LABEL|nudge_text|Nudge/);
assert.doesNotMatch(dawn, /NUDGE_LABEL/);
assert.doesNotMatch(sage, /NUDGE_LABEL|Sage · npc/);
assert.doesNotMatch(widget, /[Nn]udge|npc/i);
assert.doesNotMatch(push, /[Nn]udge/);
assert.match(todayCard, /storage\.set\('read'/);
assert.match(todayCard, /storage\.set\('do'/);
assert.doesNotMatch(todayCard, /storage\.set\('nudge'/);
assert.doesNotMatch(home + circle + dawn + sage + copy, /ATOsophy|Sync/);
assert.doesNotMatch(nudgeSrc, /me\.talk_style|talk_style:/);
ok('Nudge is Home-only; Circle/widget/push/Talk/Dawn have none; no ATOsophy/Sync; talk_style is not an input');

console.log(`\n${passed} checks passed`);
