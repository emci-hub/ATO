/**
 * Draft candidate daily lines with the live model, for emci to read.
 * Run: npm run draft:daily-line -- [--lines 4] [--per-request 4] [--max-requests 18] [--only solo|pairs] [--verbose] [--dry-run]
 *
 * WHAT IT DOES: loops over every key set the bank has (32 single leans + the
 * two-trait tensions), asks the model for a few new lines per key, runs each
 * one through the same mechanical rules as `check:daily-line`, and writes the
 * survivors to docs/daily-line-candidates.md as a checklist.
 *
 * WHAT IT NEVER DOES: write src/lib/daily-line/bank.ts. A candidate joins the
 * bank only when emci has read it and it is copied in by hand.
 *
 * HOW MANY REQUESTS: key sets are batched `--per-request` at a time, so the
 * full bank (about 76 key sets) is about 19 requests at the default of 4. The
 * signed-in account has 20 AI calls a day, so the default stops at 18 and
 * leaves two for the app. It resumes: a key set that already has candidates in
 * the review file is skipped, so running it again the next day finishes the
 * rest. It also stops cleanly the moment the server says the quota is used up.
 *
 * LIVE: signs in as the dev-test user (or ATO_LIVE_EMAIL / ATO_LIVE_PASSWORD)
 * and spends that account's real quota, same road as the app. Not part of the
 * offline gate.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  DAILY_LINES,
  DAILY_LINE_MAX_CHARS,
  axisOfKey,
  bankKeySets,
  type LineKey,
} from '../src/lib/daily-line/bank';
import { AXIS_EDITOR_COPY } from '../src/lib/sage-knows';
import { TRAIT_BAND_PHRASES } from '../src/lib/trait-bands';
import type { TraitLean } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { STYLE_BLOCK } from '../src/lib/voice/style-checklist';
import { completeViaEdgeLive, signInForLiveAi } from './live-ai';

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'docs/daily-line-candidates.md');

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}
function numberFlag(name: string, fallback: number): number {
  const raw = Number(flag(name));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const LINES_PER_KEY = numberFlag('lines', 4);
const KEYS_PER_REQUEST = numberFlag('per-request', 4);
const MAX_REQUESTS = numberFlag('max-requests', 18);
const ONLY = flag('only');
const VERBOSE = process.argv.includes('--verbose');
/** Prints the first prompt and exits. No sign-in, no model call, no quota. */
const DRY_RUN = process.argv.includes('--dry-run');

function tagOf(keys: readonly LineKey[]): string {
  return keys.join('+');
}

function describeKey(key: LineKey): string {
  const axis = axisOfKey(key);
  const lean = key.slice(key.indexOf(':') + 1) as TraitLean;
  return `${AXIS_EDITOR_COPY[axis].label}: leans toward "${TRAIT_BAND_PHRASES[axis][lean]}"`;
}

function examplesFor(keys: readonly LineKey[]): string[] {
  const tag = tagOf(keys);
  return DAILY_LINES.filter((line) => tagOf(line.keys) === tag)
    .slice(0, 2)
    .map((line) => line.text);
}

export function buildDraftPrompt(batch: readonly (readonly LineKey[])[]): string {
  const blocks = batch
    .map((keys) => {
      const who = keys.map((key) => `  - ${describeKey(key)}`).join('\n');
      const examples = examplesFor(keys)
        .map((text) => `  - ${text}`)
        .join('\n');
      return `KEY ${tagOf(keys)}\n The person:\n${who}\n Lines we already have (match the register, do not reuse or paraphrase):\n${examples}`;
    })
    .join('\n\n');

  return `Write short daily lines for the ATO app. Each line is the one sentence a person sees when they open the app in the morning. It should feel like a friend who noticed something true about them, a little sharp, never cruel.

${STYLE_BLOCK}

HARD RULES for every line
1. ${DAILY_LINE_MAX_CHARS} characters at most. One or two short sentences.
2. Second person. Never the words "you are" or "you're" (the anchors above use "you're"; these lines must not). Use "tends to", "leans", "usually", "lately".
3. Never the word "always". No type names, no test names, no clinical or psychology terms.
4. The first sentence names the pattern. The second gives a small turn: a question to check, or one tiny thing to try today.
5. When a key has two traits, the line must be about how the two pull against or feed each other, not a list of both.
6. No emoji, no exclamation marks, no hashtags, no mention of the app.
7. Every line must be clearly different in idea from the lines we already have for that key.

For each key below, write ${LINES_PER_KEY} new lines.

${blocks}

Respond with JSON only:
{"items":[{"key":"<the KEY string exactly as given>","lines":["<line>","<line>"]}]}`;
}

interface Verdict {
  line: string;
  reason: string | null;
}

const BANK_TEXTS = new Set(DAILY_LINES.map((line) => line.text.toLowerCase()));

export function judgeCandidate(line: string, seen: Set<string>): Verdict {
  const text = line.trim();
  const lower = text.toLowerCase();
  let reason: string | null = null;
  if (!text) reason = 'empty';
  else if (text.length > DAILY_LINE_MAX_CHARS) reason = `too long (${text.length})`;
  else if (/\byou are\b|\byou['’]re\b/i.test(text)) reason = 'says "you are"';
  else if (/\balways\b/i.test(text)) reason = 'says "always"';
  else if (/[!#]/.test(text)) reason = 'exclamation mark or hashtag';
  else if (containsFrameworkTerm(text)) reason = 'framework term';
  else if (BANK_TEXTS.has(lower)) reason = 'already in the bank';
  else if (seen.has(lower)) reason = 'duplicate candidate';
  if (!reason) seen.add(lower);
  return { line: text, reason };
}

function parseItems(text: string): Array<{ key: string; lines: string[] }> | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return null;
    const out: Array<{ key: string; lines: string[] }> = [];
    for (const item of parsed.items) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { key?: unknown; lines?: unknown };
      if (typeof row.key !== 'string' || !Array.isArray(row.lines)) continue;
      out.push({ key: row.key.trim(), lines: row.lines.filter((l): l is string => typeof l === 'string') });
    }
    return out;
  } catch {
    return null;
  }
}

function alreadyDrafted(): Set<string> {
  if (!existsSync(OUT_FILE)) return new Set();
  const done = new Set<string>();
  for (const match of readFileSync(OUT_FILE, 'utf8').matchAll(/^### `([^`]+)`/gm)) done.add(match[1]!);
  return done;
}

const HEADER = `# Daily line candidates

Drafted by \`npm run draft:daily-line\`. **Nothing here is in the app.** Tick the
lines you want, and they get copied into \`src/lib/daily-line/bank.ts\` by hand.
Lines the script rejected are listed under each key with the reason, so the
prompt can be fixed if the same mistake keeps coming back.
`;

async function main() {
  let keySets = bankKeySets();
  if (ONLY === 'solo') keySets = keySets.filter((keys) => keys.length === 1);
  if (ONLY === 'pairs') keySets = keySets.filter((keys) => keys.length === 2);
  const done = alreadyDrafted();
  const todo = keySets.filter((keys) => !done.has(tagOf(keys)));

  const batches: LineKey[][][] = [];
  for (let i = 0; i < todo.length; i += KEYS_PER_REQUEST) batches.push(todo.slice(i, i + KEYS_PER_REQUEST));
  console.log(
    `${keySets.length} key sets, ${done.size} already drafted, ${todo.length} to do = ${batches.length} requests ` +
      `(${KEYS_PER_REQUEST} per request, ${LINES_PER_KEY} lines each). This run will make at most ${MAX_REQUESTS}.`,
  );
  if (batches.length === 0) return;
  if (DRY_RUN) {
    console.log(`
----- PROMPT 1 of ${batches.length} (dry run, nothing sent) -----
${buildDraftPrompt(batches[0]!)}`);
    return;
  }

  const session = await signInForLiveAi();
  console.log(`signed in as ${session.email}`);

  const seen = new Set<string>();
  let out = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : HEADER;
  out += `\n## Run ${new Date().toISOString().slice(0, 10)}\n`;
  let requests = 0;
  let kept = 0;
  let rejected = 0;
  let stoppedBy: string | null = null;

  for (const batch of batches) {
    if (requests >= MAX_REQUESTS) {
      stoppedBy = `the --max-requests limit (${MAX_REQUESTS})`;
      break;
    }
    const prompt = buildDraftPrompt(batch);
    if (VERBOSE) console.log(`\n----- PROMPT (${prompt.length} chars) -----\n${prompt}`);

    let items: Array<{ key: string; lines: string[] }> | null = null;
    // One retry on an unreadable answer. Each attempt is a real, counted call.
    for (let attempt = 0; attempt < 2 && !items; attempt += 1) {
      if (requests >= MAX_REQUESTS) break;
      requests += 1;
      try {
        const text = await completeViaEdgeLive(session, 'gemini', {
          prompt,
          temperature: 0.9,
          maxOutputTokens: 1024,
          responseFormat: 'json',
        });
        if (VERBOSE) console.log(`\n----- RESPONSE (${text.length} chars) -----\n${text}`);
        items = parseItems(text);
        if (!items) console.log(`request ${requests}: answer was not readable JSON${attempt === 0 ? ', retrying' : ''}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/quota/i.test(message)) {
          stoppedBy = 'the daily AI quota';
          break;
        }
        console.log(`request ${requests}: ${message}`);
      }
    }
    if (stoppedBy) break;
    if (!items) continue;

    for (const keys of batch) {
      const tag = tagOf(keys);
      const lines = items.find((item) => item.key === tag || item.key === `KEY ${tag}`)?.lines ?? [];
      if (lines.length === 0) continue; // not marked drafted, so the next run retries it
      const verdicts = lines.map((line) => judgeCandidate(line, seen));
      out += `\n### \`${tag}\`\n`;
      for (const v of verdicts.filter((x) => !x.reason)) {
        out += `- [ ] ${v.line}\n`;
        kept += 1;
      }
      for (const v of verdicts.filter((x) => x.reason)) {
        out += `- ~~${v.line}~~ (rejected: ${v.reason})\n`;
        rejected += 1;
      }
    }
    writeFileSync(OUT_FILE, out, 'utf8');
    console.log(`request ${requests}: ${batch.map(tagOf).join(', ')}`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  writeFileSync(OUT_FILE, out, 'utf8');
  const left = keySets.filter((keys) => !alreadyDrafted().has(tagOf(keys))).length;
  console.log(
    `\n${requests} requests made. ${kept} candidates kept, ${rejected} rejected. ${left} key sets still to draft.` +
      (stoppedBy ? ` Stopped by ${stoppedBy}; run it again to continue.` : ''),
  );
  console.log(`Review file: docs/daily-line-candidates.md`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
