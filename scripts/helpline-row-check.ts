/**
 * The one static helpline row in Settings (emci 2026-10-14). It replaced the
 * crisis system, which existed only because Sage read what people typed.
 *
 * Pins: the exact copy, that it is static (no network, no detection, no
 * generated number, no region guess), that it renders on You (Settings), and
 * that the crisis system is really gone — no crisis card, no crisis lab, no
 * crisis-day gate left in the app.
 * Run: npm run check:helpline-row
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:helpline-row'], 'tsx ./scripts/helpline-row-check.ts');
ok('wired as check:helpline-row (check:ota-gate runs every check:* script)');

const row = read('src/components/helpline-row.tsx');
/** The component is React Native, so its constants are read from source. */
function constant(name: string): string {
  const match = row.match(new RegExp(`export const ${name} = '([^']*)';`));
  assert.ok(match, `${name} is a plain string constant`);
  return match[1]!;
}
const HELPLINE_TITLE = constant('HELPLINE_TITLE');
const HELPLINE_US_CA = constant('HELPLINE_US_CA');
const HELPLINE_ELSEWHERE = constant('HELPLINE_ELSEWHERE');
const HELPLINE_URL = constant('HELPLINE_URL');
const HELPLINE_DANGER = constant('HELPLINE_DANGER');
assert.equal(HELPLINE_TITLE, 'Need to talk to someone?');
assert.equal(HELPLINE_US_CA, 'US/Canada: call or text 988');
assert.match(HELPLINE_ELSEWHERE, /findahelpline\.com/);
assert.equal(HELPLINE_URL, 'https://findahelpline.com');
assert.equal(HELPLINE_DANGER, 'If you’re in danger, call your local emergency number.');
ok('the copy is exactly emci’s: 988 for US/Canada, findahelpline.com elsewhere, local emergency number');

// Code only: the doc comment is allowed to explain what the row is not.
const rowCode = row.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(rowCode, /supabase|fetch\(|generateText|useEffect|AsyncStorage|region|detect/i);
assert.doesNotMatch(rowCode, /\bTextInput\b/);
// Only the two fixed links: the 988 dialer and findahelpline.com.
const urls = [...row.matchAll(/openURL\(([^)]*)\)/g)].map((m) => m[1]!.trim());
assert.deepEqual(urls.sort(), ["'tel:988'", 'HELPLINE_URL'].sort());
ok('static: no network, no storage, no detection, no region guess; two fixed links only');

const you = read('src/app/settings.tsx');
assert.match(read('src/app/(tabs)/you.tsx'), /router\.push\('\/settings'\)/, 'You routes to Settings');
assert.doesNotMatch(read('src/app/(tabs)/you.tsx'), /<HelplineRow/, 'the row left You with the other settings');
assert.match(you, /import \{ HelplineRow \} from '@\/components\/helpline-row';/);
assert.equal((you.match(/<HelplineRow \/>/g) ?? []).length, 1, 'exactly one helpline row');
// It sits in the Settings section (after the Settings heading).
assert.ok(you.indexOf('<HelplineRow />') > you.indexOf('{SETTINGS_TITLE}'), 'the row is in Settings');
ok('one row, rendered on the Settings screen (moved off You, IA P1)');

// The crisis system is gone, not hidden.
for (const gone of [
  'src/components/crisis-card.tsx',
  'src/components/crisis-region-picker.tsx',
  'src/app/crisis-lab.tsx',
  'src/lib/crisis',
]) {
  assert.ok(!existsSync(resolve(root, gone)), `${gone} is deleted`);
}
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const gates: string[] = [];
for (const file of walk(resolve(root, 'src'))) {
  const src = readFileSync(file, 'utf8');
  if (/\bcrisisToday\b|\bcrisisYesterday\b|\bcrisisActive\b|\bisCrisisActive\b|\bCrisisCard\b|@\/lib\/crisis\//.test(src)) {
    gates.push(relative(root, file).replace(/\\/g, '/'));
  }
}
assert.deepEqual(gates, [], `crisis gates left: ${gates.join(', ')}`);
ok('no crisis card, lab, detection or crisis-day gate anywhere in src/');

console.log(`\nhelpline-row: ${passed} checks passed`);
