/**
 * The Sage tab is an inert placeholder while Talk is rebuilt.
 * Run: npm run check:sage-load
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

const sage = read('src/app/(tabs)/sage.tsx');

// The route must still exist and export a screen: pulling the tab would need a
// native build, which is the whole reason this is a placeholder and not a
// deletion.
assert.match(sage, /export default function SageScreen/);
ok('the Sage route is still registered and mountable');

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
ok('the placeholder imports nothing from the deleted lane');

// Mounting must not spend money or hit the network.
assert.doesNotMatch(sageCode, /generateText|claimAiCall|generateDailyInsight/);
assert.doesNotMatch(sageCode, /fetchSageMessages|peekSageMessages|addSageMessage/);
assert.doesNotMatch(sageCode, /supabase/);
ok('mounting Sage claims no quota, calls no model, and reads no messages');

// The consent ASK lives on Home. It is no longer a gate anywhere
// (2026-09-15): when the real conversational Sage is rebuilt on this tab,
// that exchange is the one thing ai_consent is allowed to gate.
assert.doesNotMatch(sageCode, /AiConsentCard|setAiConsent/);
assert.match(read('src/app/(tabs)/index.tsx'), /AiConsentCard/);
ok('the AI-consent ask lives on Home, not on the inert Sage tab');

// The placeholder has to say it is a placeholder. A blank tab reads as broken.
assert.match(sage, /rebuil/i);
ok('the placeholder states that Talk is being rebuilt');

console.log(`\n${passed} sage-load checks passed`);
