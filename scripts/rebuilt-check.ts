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
 * why. `sage.tsx` names `generateText` in exactly that way.
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
  { rel: 'src/app/(tabs)/sage.tsx', label: 'Sage' },
  { rel: 'src/app/(tabs)/around.tsx', label: 'Around' },
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

console.log(`\n${passed} rebuilt checks passed`);
