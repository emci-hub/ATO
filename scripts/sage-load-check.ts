/**
 * Sage is gone (2026-10-14): Insights replaced the tab and Talk was deleted,
 * not rebuilt. This check now pins that the old route only redirects, the
 * Talk lane stays deleted, and mounting Insights costs nothing.
 * Run: npm run check:sage-load
 *
 * History below kept for context.
 *
 * Rewritten 2026-09-14. This file used to pin Talk's cold-open cost — no card
 * router on mount, history loaded lazily, the Talk router imported only on
 * send. Talk's entire backend (routeTalkReply, the local/remote/gemini provider
 * layer, select-provider, the voice config) has since been deleted and the
 * screen reduced to a registered route rendering a "being rebuilt" card.
 *
 * The promise worth keeping is narrower but still real, and it is the one that
 * would actually bite during a rebuild: **mounting the Sage tab must cost
 * nothing.** No model call, no quota claim, no message fetch, no consent
 * prompt, and above all no import of the deleted lane — which is exactly the
 * mistake someone would make wiring Talk back up from memory.
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

const sage = read('src/app/(tabs)/insights.tsx');

// The Sage tab is gone; /sage is kept only as a redirect to Insights.
assert.ok(!existsSync(resolve(root, 'src/app/(tabs)/sage.tsx')), 'the Sage tab route is deleted');
assert.match(read('src/app/sage.tsx'), /<Redirect href="\/insights" \/>/);
assert.match(sage, /export default function InsightsScreen/);
ok('the Sage tab is gone; /sage redirects to the Insights screen');

// The deleted lane must stay deleted. Each of these is a real file that no
// longer exists; an import of any of them would not compile, but asserting it
// here names the mistake instead of leaving a confusing module-not-found.
for (const gone of [
  'src/lib/voice/talk.ts',
  'src/lib/voice/select-provider.ts',
  'src/lib/voice/config.ts',
  'src/lib/voice/providers/index.ts',
  'src/lib/voice/providers/prompt.ts',
  'src/lib/voice/providers/remote.ts',
  'src/lib/voice/providers/local.ts',
  'src/lib/voice/providers/gemini.ts',
  'src/lib/voice/providers/types.ts',
]) {
  assert.ok(!existsSync(resolve(root, gone)), `${gone} must stay deleted — Talk is rebuilt against generateText, not the old provider layer`);
}
ok('the voice provider layer and Talk backend stay deleted');

// Scoped to real code, not comments: the file's own docstring names these
// modules on purpose, explaining what was removed and why.
const sageCode = sage
  .split('\n')
  .filter((line) => {
    const t = line.trimStart();
    return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
  })
  .join('\n');
// Asserted against all non-comment code, not just lines starting with
// `import` — a multi-line import statement would slip past that filter.
assert.doesNotMatch(sageCode, /voice\/talk|voice\/providers|select-provider/);
ok('Insights imports nothing from the deleted lane');

// Mounting must not spend money or hit the network.
assert.doesNotMatch(sageCode, /generateText|claimAiCall|generateDailyInsight/);
assert.doesNotMatch(sageCode, /fetchSageMessages|peekSageMessages|addSageMessage/);
assert.doesNotMatch(sageCode, /supabase/);
ok('mounting Insights claims no quota, calls no model, and reads no messages');

// The consent ask lives on Home -- the only surface that generates today.
// (2026-09-15: ai_consent gates generation on the insight, the question
// rotation and Explore. When the real conversational Sage is rebuilt on this
// tab it joins that list; the inert placeholder asks nothing.)
assert.doesNotMatch(sageCode, /AiConsentCard|setAiConsent/);
assert.match(read('src/app/(tabs)/index.tsx'), /AiConsentCard/);
ok('the AI-consent ask lives on Home (Legends + deep dives), not on Insights');

// Talk was deleted, not parked: no Talk copy is left to render.
assert.doesNotMatch(read('src/lib/sage-copy.ts'), /TALK_LEDE|TALK_EMPTY|TALK_COMPOSER_PLACEHOLDER/);
ok('the Talk copy is deleted');

console.log(`\n${passed} sage-load checks passed`);
