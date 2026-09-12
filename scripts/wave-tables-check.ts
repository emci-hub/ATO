/**
 * Wave director / table checks. Run: npx tsx scripts/wave-tables-check.ts
 *
 * Guards the W2 wave tables against the silent-empty failure where every entry
 * parsed to null (the parser read a `phase` field the JSON never carried) and
 * each wave quietly fell back to the all-swarm `defaultSchedule` — so players
 * saw the same minion every wave, and boss waves spawned no boss.
 *
 * Asserts:
 *   - each phase table is non-empty and its wave numbers are unique + 1..N,
 *   - every authored wave parses to a non-null WaveDef (tables actually load),
 *   - the parsed def count equals the authored count (no entries dropped),
 *   - every authored wave schedules at least one spawn event,
 *   - the roster roles are present and reach the schedule
 *     (trial w3 tank, trial w5 / main w5+w10 boss).
 *
 * Pure data + director logic — no React, network, or keys.
 */
import assert from 'node:assert/strict';

import rawWaveTables from '../src/play/data/wave-tables.json';
import { buildSchedule, waveDefFor, waveDefsFor } from '../src/play/director';

type Phase = 'trial' | 'main';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const PHASES: readonly Phase[] = ['trial', 'main'];
const raw = rawWaveTables as Record<Phase, Array<{ wave: number }>>;

let authored = 0;
for (const phase of PHASES) {
  const list = raw[phase];
  assert.ok(Array.isArray(list) && list.length > 0, `${phase}: table must be non-empty`);
  const waves = list.map((entry) => entry.wave);
  assert.equal(new Set(waves).size, waves.length, `${phase}: duplicate wave numbers`);
  const sorted = [...waves].sort((a, b) => a - b);
  sorted.forEach((wave, index) =>
    assert.equal(wave, index + 1, `${phase}: wave numbers must be contiguous 1..N`),
  );
  for (const entry of list) {
    const def = waveDefFor(phase, entry.wave);
    assert.ok(def, `${phase} w${entry.wave}: parsed to null — the table did not load`);
    const schedule = buildSchedule(def, null);
    assert.ok(schedule.length > 0, `${phase} w${entry.wave}: schedule has no spawn events`);
    authored += 1;
  }
}

// The exact regression: entries authored in JSON but dropped by the parser.
const parsed = PHASES.reduce((total, phase) => total + waveDefsFor(phase).length, 0);
assert.equal(
  parsed,
  authored,
  `parsed ${parsed} defs but ${authored} are authored — entries were dropped`,
);
ok(`all ${authored} authored waves parse and schedule spawn events`);

// Roster coverage: the wave-feel roles are actually authored, not just typed.
function rolesIn(phase: Phase, wave: number): Set<string> {
  const def = waveDefFor(phase, wave);
  assert.ok(def, `${phase} w${wave} missing`);
  return new Set(def.groups.map((group) => group.role));
}
assert.ok(rolesIn('trial', 1).has('swarm'), 'trial w1 is a swarm wave');
assert.ok(rolesIn('trial', 2).has('runner'), 'trial w2 introduces runners');
assert.ok(rolesIn('trial', 3).has('tank'), 'trial w3 introduces a tank');
assert.ok(rolesIn('trial', 5).has('boss'), 'trial w5 is the boss wave');
assert.ok(rolesIn('main', 5).has('boss'), 'main w5 is a boss wave');
assert.ok(rolesIn('main', 10).has('boss'), 'main w10 is the final boss wave');
ok('authored tables cover swarm, runner, tank and boss groups');

// Roles must survive flattening into spawn events (what the engine consumes).
const trial3 = buildSchedule(waveDefFor('trial', 3)!, null);
assert.ok(trial3.some((event) => event.role === 'tank'), 'trial w3 schedule includes tank spawns');
const trial5 = buildSchedule(waveDefFor('trial', 5)!, { size: 1, burstHpPct: null });
assert.ok(trial5.some((event) => event.role === 'boss'), 'trial w5 schedule includes a boss spawn');
ok('schedules carry tank (trial w3) and boss (trial w5) roles end-to-end');

console.log(`\nAll ${passed} wave-table checks passed.`);
