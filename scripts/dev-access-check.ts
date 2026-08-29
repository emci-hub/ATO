/**
 * Dev-access grants, hub gating, never-grantable lock. Run: npm run check:dev-access
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  canSeeDevLab,
  canSeeHubSection,
  GRANTABLE_CAPABILITIES,
  NEVER_GRANTABLE,
} from '../src/lib/dev-access';
import {
  TRACE_SECTIONS,
  TRACE_STEP_TYPES,
  appendTraceStep,
  eventsForSection,
  parseDevTraceSteps,
  type DevTraceEvent,
  type DevTraceStep,
} from '../src/lib/dev-trace';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.deepEqual([...GRANTABLE_CAPABILITIES], ['card', 'traits', 'quota', 'fence', 'trace']);
assert.deepEqual([...NEVER_GRANTABLE], ['profile-pause', 'profile-delete', 'access-review']);
ok('grantable vs never-grantable capability lists are locked');

assert.equal(canSeeDevLab({ isDev: true, isRoot: false, capabilities: [] }), true);
assert.equal(canSeeDevLab({ isDev: false, isRoot: true, capabilities: [] }), true);
assert.equal(canSeeDevLab({ isDev: false, isRoot: false, capabilities: ['card'] }), true);
assert.equal(canSeeDevLab({ isDev: false, isRoot: false, capabilities: [] }), false);
assert.equal(canSeeDevLab({ isDev: false, isRoot: false, capabilities: ['access-review'] }), false);
ok('hub is visible for __DEV__, root, or a grantable capability — not a fake never-grantable token');

assert.equal(canSeeHubSection('access', { isDev: true, isRoot: false, capabilities: ['card'] }), false);
assert.equal(canSeeHubSection('grants', { isDev: true, isRoot: false, capabilities: ['trace'] }), false);
assert.equal(canSeeHubSection('profiles', { isDev: false, isRoot: false, capabilities: ['card'] }), false);
assert.equal(canSeeHubSection('access', { isDev: false, isRoot: true, capabilities: [] }), true);
assert.equal(canSeeHubSection('card', { isDev: false, isRoot: false, capabilities: ['card'] }), true);
assert.equal(canSeeHubSection('traits', { isDev: false, isRoot: false, capabilities: ['card'] }), false);
ok('access / grants / profiles stay root-only even in __DEV__; grantable tabs follow the row');

const sql = read('supabase/migrations/dev_access.sql');
assert.match(sql, /constraint dev_access_grants_capability_grantable/);
assert.match(sql, /check \(capability in \('card', 'traits', 'quota', 'fence', 'trace'\)\)/);
assert.doesNotMatch(sql, /check \(capability in \([^)]*profile-delete/);
assert.match(sql, /capability_not_grantable/);
assert.match(sql, /create function public\.root_pause_profile/);
assert.match(sql, /create function public\.root_delete_profile/);
assert.match(sql, /perform public\.require_root\(\)/);
assert.match(sql, /interval '30 minutes'/);
assert.match(sql, /remaining = 20/);
assert.match(sql, /interval '7 days'/);
assert.match(sql, /record_dev_trace/);
assert.match(sql, /Never accepts a target user_id/);
ok('SQL CHECK and set_dev_access_grants reject never-grantable capabilities; pause/delete are require_root');

const hub = read('src/app/dev-lab.tsx');
assert.match(hub, /canSeeDevLab/);
assert.match(hub, /function GrantsPanel/);
assert.match(hub, /function ProfilesPanel/);
assert.match(hub, /function TraceCapture/);
assert.match(hub, /NEVER_GRANTABLE/);
assert.match(hub, /Never grantable/);
assert.match(hub, /deleteProfile/);
assert.match(hub, /pauseProfile/);
assert.match(hub, /listPendingAccessRequests/);
ok('hub has Grants, Profiles, Trace, and Access; never-grantable rows are labeled');

const layout = read('src/app/_layout.tsx');
assert.match(layout, /<Stack\.Protected guard=\{isAuthed && hasMe\}>[\s\S]*name="dev-lab"/);
assert.doesNotMatch(layout, /<Stack\.Protected guard=\{__DEV__\}>[\s\S]*name="dev-lab"/);
ok('dev-lab is on the authed stack so TestFlight can open it');

const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /canSeeDevLab/);
assert.match(home, /router\.push\('\/dev-lab'\)/);
ok('Home Dev Tools Hub row uses the same root/grant gate');

assert.match(read('src/app/(tabs)/index.tsx'), /traceSurface: 'dawn'/);
assert.match(read('src/app/dawn.tsx'), /traceSurface: 'dawn'/);
assert.match(read('src/app/(tabs)/sage.tsx'), /recordOwnDevTrace/);
assert.match(read('src/components/explore-panel.tsx'), /recordOwnDevTrace/);
assert.match(read('src/components/missed-check-card.tsx'), /traceSurface: 'dawn'/);
assert.match(read('src/lib/voice/router.ts'), /recordTrace/);
assert.match(read('src/lib/voice/talk.ts'), /recordTrace/);
assert.match(read('src/lib/explore/route.ts'), /recordTrace/);
ok('Sage / Explore / Dawn production paths pass own-account recordTrace');

const recordFn = read('supabase/migrations/dev_access.sql');
assert.match(recordFn, /user_id = uid/);
assert.doesNotMatch(recordFn.slice(recordFn.indexOf('create function public.record_dev_trace')), /p_user_id/);
ok('record_dev_trace has no target user_id argument');

const stepsSql = read('supabase/migrations/dev_trace_steps.sql');
assert.match(stepsSql, /add column if not exists steps jsonb/);
assert.match(stepsSql, /step_type \(context_gather\|model_call\|guard_check\|output\)/);
assert.match(stepsSql, /p_steps jsonb default/);
assert.match(stepsSql, /surface in \('sage', 'explore', 'dawn', 'talk'\)/);
assert.match(stepsSql, /Never accepts a target user_id/);
assert.doesNotMatch(stepsSql, /p_user_id/);
assert.match(recordFn, /interval '30 minutes'/);
assert.match(recordFn, /remaining = 20/);
assert.match(recordFn, /interval '7 days'/);
ok('steps column + p_steps keep own-account Trace; talk is an allowed surface');

assert.deepEqual(
  TRACE_SECTIONS.map((row) => row.id),
  ['dawn', 'talk', 'explore'],
);
assert.deepEqual([...TRACE_STEP_TYPES], ['context_gather', 'model_call', 'guard_check', 'output']);
const built: DevTraceStep[] = [];
appendTraceStep(built, {
  step_type: 'context_gather',
  label: 'ME',
  input_summary: 'name=Riley',
  output_summary: 'checks=2',
  status: 'ok',
});
appendTraceStep(built, {
  step_type: 'guard_check',
  label: 'jargon',
  input_summary: 'draft',
  output_summary: 'flagged: introvert',
  status: 'flagged',
});
assert.equal(built[0].step_order, 1);
assert.equal(built[1].step_order, 2);
assert.equal(parseDevTraceSteps(built).length, 2);
const sample: DevTraceEvent[] = [
  {
    id: '1',
    createdAt: '',
    surface: 'dawn',
    libraryLines: [],
    traitSignals: {},
    rawBefore: null,
    rawAfter: null,
    guardFired: null,
    steps: built,
  },
  {
    id: '2',
    createdAt: '',
    surface: 'talk',
    libraryLines: [],
    traitSignals: {},
    rawBefore: null,
    rawAfter: null,
    guardFired: null,
    steps: [],
  },
];
assert.equal(eventsForSection(sample, 'dawn').length, 1);
assert.equal(eventsForSection(sample, 'talk')[0].id, '2');
ok('generic step helper orders steps and filters by registered section id');

console.log(`\ndev-access-check: ${passed}/${passed} passed`);
