/**
 * check:copy-flags — roadmap v2 step A4 (emci, 2026-10-23: "accept all my picks").
 * Run: npm run check:copy-flags
 *
 * Pins the copy-flag decision table, one row per `*_COPY_REVIEWED` constant:
 *   accepted = `true` in code, listed as ACCEPTED in docs/master-plan.md Ledger A
 *   read     = still `false`: emci reads it first; flipping it is his call
 *   retired  = gates nothing; the flag and its dead code were deleted in step A5 (2026-10-23), so it must not be declared
 * A false flag never hides a surface (a draft badge shows only while PRE_LAUNCH_DEV; the one real effect is the
 * category push). So no flag may be added, flipped or dropped without this table and Ledger A saying why.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

type Decision = 'accepted' | 'read' | 'retired';

/** Every flag that was `false` on 2026-10-22 (17), by decision. Flags already `true` before A4 are listed in TRUE_BEFORE. */
export const DECISIONS: Record<string, { file: string; decision: Decision }> = {
  INSIGHT_BANK_COPY_REVIEWED: { file: 'src/lib/insight-bank/index.ts', decision: 'accepted' },
  CATEGORY_BANK_COPY_REVIEWED: { file: 'src/lib/category-bank/index.ts', decision: 'accepted' },
  STORY_BANK_COPY_REVIEWED: { file: 'src/lib/story-bank/index.ts', decision: 'accepted' },
  DAILY_PICK_COPY_REVIEWED: { file: 'src/lib/daily-pick/bank.ts', decision: 'accepted' },
  BANK_COPY_REVIEWED: { file: 'src/lib/questions/bank-sets.ts', decision: 'accepted' },
  STAGED_INTAKE_COPY_REVIEWED: { file: 'src/lib/questions/staged-intake-copy.ts', decision: 'accepted' },
  POLISH_COPY_REVIEWED: { file: 'src/lib/polish-copy.ts', decision: 'accepted' },
  TEAM_COPY_REVIEWED: { file: 'src/lib/ai-library/teams.ts', decision: 'accepted' },
  CATEGORY_DEEP_DIVE_COPY_REVIEWED: { file: 'src/lib/category-deep-dive/flags.ts', decision: 'accepted' },
  PROFILE_CARD_COPY_REVIEWED: { file: 'src/lib/profile-history.ts', decision: 'read' },
  CIRCLE_COMPARE_COPY_REVIEWED: { file: 'src/play/circle-compare.ts', decision: 'read' },
  LEGEND_FIGURES_COPY_REVIEWED: { file: 'src/lib/legend-figures/flags.ts', decision: 'read' },
  CATEGORY_STATEMENTS_COPY_REVIEWED: { file: 'src/lib/category-statements/flags.ts', decision: 'read' },
  // Retired: the flag and its AI writer were deleted in A5. `file` is where it used to live.
  DAILY_INSIGHT_COPY_REVIEWED: { file: 'src/lib/insight/generate-insight.ts', decision: 'retired' },
  TITLE_COPY_REVIEWED: { file: 'src/lib/sage-title.ts', decision: 'retired' },
  STORY_COPY_REVIEWED: { file: 'src/lib/sage-story.ts', decision: 'retired' },
  CATEGORY_READ_COPY_REVIEWED: { file: 'src/lib/rolls/category-read.ts', decision: 'retired' },
};

/** Already `true` before step A4 (emci read or approved them earlier). */
export const TRUE_BEFORE = [
  'CIRCLE_VISITS_COPY_REVIEWED',
  'VISITORS_COPY_REVIEWED',
  'POLE_COPY_REVIEWED',
  'BUDDY_COPY_REVIEWED',
  'CATEGORY_BAND_COPY_REVIEWED',
  'CATEGORY_COPY_REVIEWED',
  'PET_KNOWS_YOU_COPY_REVIEWED',
  'CONCEPT_COPY_REVIEWED',
  'DAILY_LINE_COPY_REVIEWED',
  'QUESTION_VOICE_COPY_REVIEWED',
  'PROFILE_FILL_COPY_REVIEWED',
  'NAME_STYLES_V2_COPY_REVIEWED',
  'LEGENDS64_COPY_REVIEWED',
  'EIGHT_BALL_COPY_REVIEWED',
];

/**
 * Flags added after A4 (not part of the 17-flag ledger). Each stays `false` until emci ticks its review doc,
 * and only ticked rows ship (so false never hides a surface that is already live).
 */
export const AFTER_A4: Record<string, { file: string }> = {
  // PHASE-11c (2026-10-27): docs/almanac-review.md, loaded by `npm run load:almanac`.
  ALMANAC_COPY_REVIEWED: { file: 'src/lib/almanac/index.ts' },
};

/** The value of `export const NAME = true|false` in a source text, or null when it is not declared there. */
export function flagValue(src: string, name: string): boolean | null {
  // Anchored to the start of a line, so a commented-out `// export const …` never counts.
  const m = new RegExp(`^export const ${name}\\s*(?::\\s*boolean\\s*)?=\\s*(true|false)\\b`, 'm').exec(src);
  return m ? m[1] === 'true' : null;
}

/** Every `*_COPY_REVIEWED` declaration in a source text, however it is written (typed, let, not exported, alias). */
export function scanFlags(src: string): { name: string; value: boolean | 'other' }[] {
  const out: { name: string; value: boolean | 'other' }[] = [];
  for (const m of src.matchAll(/^[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Z0-9_]+_COPY_REVIEWED)\b[^=\n]*=\s*([^;\n]+)/gm)) {
    const raw = m[2]!.trim();
    out.push({ name: m[1]!, value: /^true\b/.test(raw) ? true : /^false\b/.test(raw) ? false : 'other' });
  }
  return out;
}

/** Flags that deliberately alias another flag (`= OTHER_FLAG`) instead of holding their own value. */
export const ALIASES = ['UNLOCK_COPY_REVIEWED'];

/** Does the decision agree with the code? accepted → true; read → false; retired → not declared at all. */
export function decisionHolds(value: boolean | null, decision: Decision): boolean {
  if (decision === 'retired') return value === null;
  if (value === null) return false;
  return decision === 'accepted' ? value === true : value === false;
}

/** Ledger A names the flag under the right heading (ACCEPTED / READ / RETIRED). */
export function ledgerLists(ledger: string, name: string, decision: Decision): boolean {
  const heading = { accepted: 'ACCEPTED', read: 'READ', retired: 'RETIRED' }[decision];
  const start = ledger.indexOf(`**${heading}`);
  if (start < 0) return false;
  const next = ledger.slice(start + 1).search(/\n {2}- \*\*[A-Z]/);
  const block = next < 0 ? ledger.slice(start) : ledger.slice(start, start + 1 + next);
  const short = name.replace(/_COPY_REVIEWED$/, '');
  return new RegExp(`\`${short}\``).test(block);
}

function allFlagFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) allFlagFiles(rel, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

// 1. The table matches the code, flag by flag.
for (const [name, row] of Object.entries(DECISIONS)) {
  // A retired flag's file may be gone or trimmed; it must simply not declare the flag any more.
  const value = row.decision === 'retired' ? null : flagValue(read(row.file), name);
  assert.ok(decisionHolds(value, row.decision), `${name} is ${value} in ${row.file} but the decision is "${row.decision}"`);
}
const counts = (d: Decision) => Object.values(DECISIONS).filter((row) => row.decision === d).length;
assert.deepEqual([counts('accepted'), counts('read'), counts('retired')], [9, 4, 4], '9 accepted, 4 to read, 4 retired');
ok('17 flags: 9 accepted (true), 4 to read (false), 4 retired (deleted); each matches its code');

// 2. Pairs: the rule itself.
assert.equal(decisionHolds(true, 'accepted'), true, 'pass: an accepted flag is true');
assert.equal(decisionHolds(false, 'accepted'), false, 'fail case: an accepted flag that is still false');
assert.equal(decisionHolds(false, 'read'), true, 'pass: a flag to read stays false');
assert.equal(decisionHolds(true, 'read'), false, 'fail case: a flag to read that someone flipped without his read');
assert.equal(decisionHolds(null, 'retired'), true, 'pass: a retired flag is gone from the code');
assert.equal(decisionHolds(true, 'retired'), false, 'fail case: a retired flag that came back as true');
assert.equal(decisionHolds(false, 'retired'), false, 'fail case: a retired flag that came back as false');
assert.equal(decisionHolds(null, 'accepted'), false, 'fail case: a flag that is not declared in its file');
assert.equal(flagValue('export const X_COPY_REVIEWED = true; // note', 'X_COPY_REVIEWED'), true);
assert.equal(flagValue('export const X_COPY_REVIEWED = false;', 'X_COPY_REVIEWED'), false);
assert.equal(flagValue('// X_COPY_REVIEWED = true', 'X_COPY_REVIEWED'), null, 'a comment is not a declaration');
assert.equal(
  flagValue('// export const X_COPY_REVIEWED = false;\nexport const X_COPY_REVIEWED = true;', 'X_COPY_REVIEWED'),
  true,
  'pass: a commented-out line above the real one is ignored',
);
assert.equal(flagValue('// export const X_COPY_REVIEWED = true;', 'X_COPY_REVIEWED'), null, 'fail case: only a comment, no declaration');
// The scanner sees every way a flag can be written, so none slips in unlisted.
const sample = [
  'export const A_COPY_REVIEWED = true; // note',
  'export const B_COPY_REVIEWED: boolean = false;',
  'export let C_COPY_REVIEWED = false;',
  'const D_COPY_REVIEWED = true;',
  'export const E_COPY_REVIEWED = A_COPY_REVIEWED;',
  '// export const F_COPY_REVIEWED = true;',
].join('\n');
assert.deepEqual(
  scanFlags(sample).map((f) => `${f.name}=${f.value}`),
  ['A_COPY_REVIEWED=true', 'B_COPY_REVIEWED=false', 'C_COPY_REVIEWED=false', 'D_COPY_REVIEWED=true', 'E_COPY_REVIEWED=other'],
  'typed, let, non-exported and alias flags are all found; a comment is not',
);
ok('pass/fail pairs: accepted must be true; read and retired must stay false; comments, typed, let and alias flags handled');

// 3. No flag is added or flipped silently: every declared flag in src/ is in the table or in TRUE_BEFORE.
const declared = new Map<string, boolean | 'other'>();
const aliases: string[] = [];
for (const rel of allFlagFiles('src')) {
  for (const f of scanFlags(read(rel))) {
    if (f.value === 'other') aliases.push(f.name);
    else declared.set(f.name, f.value);
  }
}
// A retired flag is deliberately NOT known: if it is declared again, the scan below fails it.
const known = new Set([
  ...Object.entries(DECISIONS).filter(([, row]) => row.decision !== 'retired').map(([name]) => name),
  ...TRUE_BEFORE,
  ...Object.keys(AFTER_A4),
]);
/** Names a scan finds that no decision covers (aliases must be listed in ALIASES). */
export function unlisted(found: string[], knownNames: Set<string>, aliasNames: string[], aliasFound: string[]): string[] {
  return [...found.filter((n) => !knownNames.has(n)), ...aliasFound.filter((n) => !aliasNames.includes(n))];
}
const unknown = unlisted([...declared.keys()], known, ALIASES, aliases);
assert.deepEqual(unknown, [], `new *_COPY_REVIEWED flag(s) with no decision in scripts/copy-flags-check.ts and Ledger A: ${unknown.join(', ')}`);
for (const name of TRUE_BEFORE) assert.equal(declared.get(name), true, `${name} was true before A4 and must stay true`);
for (const [name, row] of Object.entries(AFTER_A4)) {
  assert.equal(flagValue(read(row.file), name), false, `${name} stays false until emci ticks its review doc`);
}
assert.equal(
  [...declared.entries()].filter(([name, v]) => v === false && !(name in AFTER_A4)).length,
  4,
  'exactly 4 flags are false: the 4 to read (the 4 retired ones are deleted; later flags are listed in AFTER_A4)',
);
// Pairs on the real helper: an unlisted literal flag and an unlisted alias are both caught; a listed alias passes.
assert.deepEqual(unlisted(['A'], new Set(['A']), ALIASES, ['UNLOCK_COPY_REVIEWED']), [], 'pass: known flag + the listed alias');
assert.deepEqual(unlisted(['A', 'NEW_COPY_REVIEWED'], new Set(['A']), ALIASES, []), ['NEW_COPY_REVIEWED'], 'fail case: a new unlisted flag');
assert.deepEqual(unlisted([], new Set(), ALIASES, ['SNEAKY_COPY_REVIEWED']), ['SNEAKY_COPY_REVIEWED'], 'fail case: a new unlisted alias');
assert.deepEqual(aliases, ALIASES, 'the only alias in src/ is UNLOCK_COPY_REVIEWED');
ok('every *_COPY_REVIEWED in src/ has a decision; the 14 earlier ones stay true; exactly 4 stay false');

// 4. Ledger A records each decision under the right heading.
const ledgerStart = read('docs/master-plan.md').indexOf('Copy flags (step A4');
assert.ok(ledgerStart > 0, 'Ledger A has the copy-flag entry');
const ledger = read('docs/master-plan.md').slice(ledgerStart);
for (const [name, row] of Object.entries(DECISIONS)) {
  assert.ok(ledgerLists(ledger, name, row.decision), `Ledger A does not list ${name} under ${row.decision.toUpperCase()}`);
}
assert.equal(ledgerLists(ledger, 'STORY_BANK_COPY_REVIEWED', 'accepted'), true, 'pass: STORY_BANK is under ACCEPTED');
assert.equal(ledgerLists(ledger, 'STORY_BANK_COPY_REVIEWED', 'retired'), false, 'fail case: STORY_BANK is not under RETIRED');
assert.equal(ledgerLists(ledger, 'CATEGORY_STATEMENTS_COPY_REVIEWED', 'accepted'), false, 'fail case: the push flag is not accepted');
assert.match(ledger, /\*\*HIDDEN:\*\* none/, 'Ledger A says nothing is hidden');
ok('Ledger A lists every flag under its decision and says nothing is hidden');

// 5. The one real effect: the category push stays off while its flag is false.
assert.match(read('src/lib/push-insight.ts'), /if \(!CATEGORY_STATEMENTS_COPY_REVIEWED\) return null;/, 'the push is gated by the flag');
ok('the category push line still waits for emci’s read (CATEGORY_STATEMENTS stays false)');

console.log(`\n${passed} copy-flag checks passed`);
