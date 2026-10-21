/**
 * Parked screens stay parked.
 * Run: npm run check:rebuilt
 *
 * The screen-isolation pass (`docs/ISOLATION_PLAN.md`) parks screens rather than
 * deleting them: the route stays registered and mountable, it renders a visible
 * `(Rebuilt)` label so an on-device pass never reads it as a crash, and every
 * backend call behind it is disconnected. This check is what makes
 * "disconnected" a durable property instead of a one-time cleanup that drifts
 * back the first time someone wires a parked screen up from memory.
 *
 * SCOPE — whole-file parks only. `PARKED_SCREENS` asserts a file has *no*
 * backend imports at all, which is only true of a screen parked in its entirety.
 * Home, Explore and Questions keep real backend imports for their still-active
 * folds, so they must never be listed here; their fold-level parks get bespoke
 * assertions in each screen's own check script (the `explore-check.ts` pattern).
 * See ISOLATION_PLAN §5.3.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isTabParked } from '../src/lib/nav/nav-order';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

/**
 * Scoped to real code, not comments: a parked screen's docstring names the
 * modules it was disconnected from on purpose, explaining what was removed and
 * why.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

const NOTICE = 'src/components/rebuilt-notice.tsx';

/**
 * Screens parked in their entirety. Each later card in ISOLATION_PLAN §5 adds
 * its screen here: Around (Card 2), Legends + Roll (Card 3), Week (Card 4).
 */
const PARKED_SCREENS: { rel: string; label: string }[] = [
  // Sage left this list 2026-10-14: the tab was replaced by Insights and the
  // placeholder deleted; /sage is a redirect (check:tab-rename).
  { rel: 'src/app/(tabs)/around.tsx', label: 'Around' },
  // Legends was rebuilt 2026-10-08 as the museum of legends (src/lib/legend-figures):
  // its gates are pinned in legend-roster-check.ts, no-auto-ai-check.ts and
  // milestones-check.ts instead.
  { rel: 'src/app/(tabs)/roll.tsx', label: 'Roll' },
  // Card F (2026-09-15): everything outside the Home / Questions / Explore
  // spine. `you.tsx` is NOT here on purpose — it is parked but deliberately
  // keeps sign out, delete account and AI consent alive (App Store 5.1.1(v)),
  // so it still reaches supabase and cannot satisfy the zero-backend rule.
  // Its kept-controls contract is pinned at the bottom of THIS file instead
  // (`delete-account-check.ts` is a live check and is excluded from the gate,
  // so it cannot carry an App Store invariant).
  // Circle was rebuilt 2026-10-21 as a plain friend list with Message; pinned at the bottom of this file.
  { rel: 'src/app/week.tsx', label: 'This week' },
  // Chat was rebuilt 2026-10-21 (master plan Step 14) as the end-to-end encrypted Circle chat; its
  // rules are pinned in circle-chat-check.ts instead.
];

/**
 * A parked screen may not reach the backend by any route. `.rpc(` catches a
 * direct RPC call; the named helpers catch the shared libs that wrap one.
 */
const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /supabase/, label: 'a supabase client' },
  { pattern: /generateText|claimAiCall/, label: 'a model call or quota claim' },
  { pattern: /\.rpc\(/, label: 'a direct RPC call' },
  { pattern: /updateTraits|mergeTraitWrite/, label: 'a trait write' },
  { pattern: /fetchTraitTracks/, label: 'a trait-track read' },
  { pattern: /record_check/, label: 'a Check write' },
];

// ---------------------------------------------------------------------------
// The shared component itself.
// ---------------------------------------------------------------------------

assert.ok(existsSync(resolve(root, NOTICE)), `${NOTICE} must exist — it is the one placeholder every parked screen renders`);
const notice = read(NOTICE);

assert.match(notice, /export function RebuiltNotice/);
assert.match(notice, /export const REBUILT_NOTICE_COPY/);
ok('RebuiltNotice and REBUILT_NOTICE_COPY are exported');

// The visible promise: a parked screen reads as deliberate, not broken.
assert.match(notice, /\(Rebuilt\)/);
ok('the notice renders a visible (Rebuilt) label');

/**
 * The import restriction is the whole point of the component: a placeholder
 * that could pull in live data is not a placeholder. ISOLATION_PLAN §3.1 names
 * the themed primitives; `react-native` and `@/constants/theme` are also
 * allowed here because a StyleSheet and layout spacing constants carry no data.
 */
const ALLOWED_NOTICE_IMPORTS = new Set([
  'react-native',
  '@/components/themed-text',
  '@/components/themed-view',
  '@/constants/theme',
  '@/hooks/use-theme',
  '@/lib/theme/chrome',
]);

const noticeCode = codeOnly(notice);
const noticeImports = [...noticeCode.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
for (const specifier of noticeImports) {
  assert.ok(
    ALLOWED_NOTICE_IMPORTS.has(specifier),
    `${NOTICE} imports '${specifier}' — the notice may only import themed primitives and layout constants, never data`,
  );
}

// The allowlist above only sees `from '...'`. A side-effect import, a require or
// a dynamic import() would slip past it entirely, so the notice is held to the
// same backend ban as the screens that render it.
for (const { pattern, label } of FORBIDDEN) {
  assert.doesNotMatch(noticeCode, pattern, `${NOTICE} reaches ${label} — a placeholder that can pull live data is not a placeholder`);
}
ok('the notice imports themed primitives only, no data modules');

// ---------------------------------------------------------------------------
// Every whole-file parked screen.
// ---------------------------------------------------------------------------

for (const { rel, label } of PARKED_SCREENS) {
  assert.ok(existsSync(resolve(root, rel)), `${rel} must exist — parking keeps the route, it does not delete it`);
  const source = read(rel);
  const code = codeOnly(source);

  // Pulling a tab would need a native build. That is the whole reason these are
  // placeholders and not deletions.
  assert.match(source, /export default function/, `${label} must still export a mountable route component`);

  // `<RebuiltNotice`, not the bare identifier: an unused import would satisfy
  // the latter, and unused vars are only a lint warning here.
  assert.match(code, /<RebuiltNotice/, `${label} must render RebuiltNotice so the screen reads as parked, not broken`);

  for (const { pattern, label: what } of FORBIDDEN) {
    assert.doesNotMatch(code, pattern, `${label} is parked but still reaches ${what}`);
  }

  ok(`${label} is parked: route intact, notice rendered, backend disconnected`);
}

// ---------------------------------------------------------------------------
// You is parked, but three controls must survive the parking.
// ---------------------------------------------------------------------------

/**
 * emci 2026-09-15 (ISOLATION_PLAN §7 Card F / O-1). App Store guideline
 * 5.1.1(v) requires in-app account deletion; sign out is the only way off an
 * account on a shared device; and AI consent (Apple 5.1.2) is the switch
 * Home's insight and Story generation read, so it has to be revocable
 * somewhere other than the one-time ask on Home.
 *
 * Nothing else offline asserts this — `check:delete-account` is a live check
 * and is excluded from the gate — so a future parking pass that "finished the
 * job" on You would fail App Store review with a green gate. It fails here now.
 */
const YOU = 'src/app/(tabs)/you.tsx';
const youCode = codeOnly(read(YOU));

// INVERTED 2026-10-01 (was: You must still read as parked). emci un-parked You:
// a full-screen "Rebuilt" notice over a half-working screen made the working
// half look broken. The App Store controls below are still pinned.
assert.doesNotMatch(youCode, /<RebuiltNotice/, 'You no longer shows a Rebuilt notice');
assert.ok(youCode.includes('<AtoTokenCard me={me} />'), 'the token balance is visible on You');
// 2026-10-14: the saved-facts list ("Teach Sage") is hidden; the data stays
// until docs/sage-cleanup.md drops it.
assert.ok(!youCode.includes('SageFactsCard'), 'the saved-facts list is hidden on You');
assert.match(youCode, /<DeleteAccountSheet/, 'delete account must stay reachable on You (App Store 5.1.1(v))');
assert.match(youCode, /Delete account/, 'the delete-account control must be labelled');
assert.match(youCode, /supabase\.auth\.signOut\(\)/, 'sign out must stay reachable on You');
assert.match(youCode, /clearLocalAccountData\(\)/, "signing out must still clear this account's local keys");
assert.match(youCode, /setAiConsent\(/, 'AI consent must stay changeable on You (Apple 5.1.2)');
assert.match(youCode, /\{AI_USE_DISCLOSURE\}/, 'the AI-use disclosure must RENDER beside the consent control, not just be imported');
ok('You keeps delete account, sign out and AI consent, and shows tokens; saved facts are hidden');

// ---------------------------------------------------------------------------
// Circle is a real tab again: a friend list that opens chat, with no Divecore UI.
// ---------------------------------------------------------------------------

const circleCode = codeOnly(read('src/app/(tabs)/circle.tsx'));
assert.doesNotMatch(circleCode, /<RebuiltNotice/, 'Circle is a real screen now, not a Rebuilt notice');
assert.match(circleCode, /fetchCircleFriends\(\)/, 'Circle lists friends from the server list the Divecore sheet uses');
assert.match(circleCode, /pathname:\s*'\/chat'/, 'Circle opens the standalone chat route');
const circlePanelsCode = codeOnly(read('src/components/circle-panels.tsx'));
assert.doesNotMatch(circleCode, /@\/play\/(?!circle-(visits|compare)(-store)?['"])/, 'Circle imports no Divecore UI (only the circle stores, copy and types)');
assert.doesNotMatch(circlePanelsCode, /@\/play\/(?!circle-(visits|compare)(-store)?['"])/, 'Circle panels import no Divecore UI');
// Safety tools live in the Circle tab (emci 2026-10-21); visits and gifts stay in Divecore.
for (const f of ['sendCircleRequest', 'respondCircleRequest', 'cancelCircleRequest', 'blockCirclePeer', 'removeCirclePeer', 'reportCirclePeer', 'unblockCirclePeer', 'fetchCircleBlocked', 'fetchCircleRequests']) {
  assert.match(circleCode, new RegExp(`\\b${f}\\(`), `Circle tab calls ${f}`);
}
assert.match(circleCode, /twoTap\.confirm\(`block:/, 'Block takes two taps in the Circle tab');
assert.match(circleCode, /mailto:\$\{CIRCLE_SUPPORT_EMAIL\}/, 'Circle tab carries the support line');
assert.match(circlePanelsCode, /CIRCLE_REPORT_REASON_IDS\.map/, 'Report lists the fixed reasons');
const divecoreSheet = codeOnly(read('src/play/circle-visits-ui.tsx'));
assert.doesNotMatch(divecoreSheet, /blockCirclePeer|reportCirclePeer|sendCircleRequest|respondCircleRequest|unblockCirclePeer|TextInput|circle-compare/, 'the Divecore sheet no longer carries the safety tools');
assert.ok(!isTabParked('circle'), 'Circle is offered in the bar and More');
ok('Circle is a real tab: friends, Message, requests, ⋯ menu (Report/Block), Blocked, support line; no Divecore UI');

console.log(`\n${passed} rebuilt checks passed`);
