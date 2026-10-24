/**
 * Review changed player-facing lines against docs/voice-guide.md.
 *
 * Run: npm run copy:review
 * Self-check (no key, no writes): npm run copy:review -- --self-test
 *
 * Diff base is COPY_REVIEW_BASE, else origin/main, else this repo's default
 * branch (master). The model key is the server secret GEMINI_API_KEY, with
 * DEEPSEEK_API_KEY if Gemini is missing or fails. Neither key is hardcoded.
 * If both are unset, the script warns and exits 0 so a build is not blocked.
 *
 * A rewrite is written back only when it keeps the same slots and stays one
 * line. The log is docs/copy-review-log.md. Deterministic checks are separate
 * and still run after this.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';

import {
  parseCopyReviewResponse,
  reviewBeforeQueue,
  sameSlots,
  unknownSlot,
  type CopyFix,
  type CopyLine,
} from '../src/lib/voice/copy-review-prompt';

const ROOT = path.resolve(__dirname, '..');
const GUIDE = path.join(ROOT, 'docs/voice-guide.md');
const LOG = path.join(ROOT, 'docs/copy-review-log.md');
const BATCH = 12;

/** Player-facing sources. Question scores, daily lines, and legend biography stay out. */
const ALLOW = [
  'src/lib/story-library/lines.ts',
  'src/lib/insight-bank',
  'src/lib/category-bank',
  'src/lib/story-v3',
  'src/lib/polish-copy.ts',
  'src/lib/push-policy.ts',
  'src/components',
  'src/app',
];

const SKIP_FILE = [
  /^src\/play\//,
  /^assets\/play\//,
  /^src\/app\/play\.tsx$/,
  /^src\/lib\/questions\//,
  /^src\/lib\/daily-line\//,
  /^src\/lib\/legend-figures\//,
  /^src\/lib\/traits\.ts$/,
  /^src\/lib\/dev-mode\.ts$/,
  /generated/,
  /\.test\.tsx?$/,
];

function loadEnvFile(): void {
  const file = path.join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function hasRef(name: string): boolean {
  try {
    execSync(`git rev-parse --verify ${name}`, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** "main" in the request. This repo's default branch is master. */
export function resolveBase(): { ref: string; note: string } {
  const fromEnv = process.env.COPY_REVIEW_BASE?.trim();
  if (fromEnv) return { ref: fromEnv, note: 'COPY_REVIEW_BASE' };
  if (hasRef('origin/main')) return { ref: 'origin/main', note: 'origin/main' };
  if (hasRef('main')) return { ref: 'main', note: 'main' };
  if (hasRef('origin/master')) return { ref: 'origin/master', note: 'master (no main branch)' };
  return { ref: 'master', note: 'master (no main branch)' };
}

function allowedFile(file: string): boolean {
  if (SKIP_FILE.some((re) => re.test(file))) return false;
  return ALLOW.some((prefix) => file === prefix || file.startsWith(`${prefix}/`) || file.startsWith(prefix));
}

function decodeQuoted(body: string): string {
  return body.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function quotedStrings(line: string): string[] {
  const found: string[] = [];
  const re = /(["'])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const match of line.matchAll(re)) {
    found.push(decodeQuoted(match[2] ?? ''));
  }
  return found;
}

export function isPlayerLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 16 || trimmed.length > 400) return false;
  if (!/[A-Za-z]/.test(trimmed) || !/\s/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length < 3) return false;
  if (/^(src\/|@\/|\.\/|https?:)/.test(trimmed)) return false;
  if (/=>|\bfunction\b|\bimport\b|\bexport\b|\brequire\(/.test(trimmed)) return false;
  if (/^[a-z0-9_.:/-]+$/.test(trimmed)) return false;
  return true;
}

/** Added player-facing strings in a unified diff. */
export function playerLinesFromDiff(diff: string): CopyLine[] {
  const lines: CopyLine[] = [];
  let file = '';
  let seen = 0;
  for (const raw of diff.split(/\r?\n/)) {
    const header = /^diff --git a\/(.+?) b\//.exec(raw);
    if (header) {
      file = header[1] ?? '';
      continue;
    }
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
    if (!file || !allowedFile(file)) continue;
    const source = raw.slice(1);
    for (const text of quotedStrings(source)) {
      if (!isPlayerLine(text)) continue;
      seen += 1;
      lines.push({ id: `${file}#${seen}`, file, text });
    }
  }
  return lines;
}

export function acceptFix(before: string, fix: CopyFix): string | null {
  const next = fix.newText.trim();
  if (!next || next === before.trim()) return 'empty or unchanged';
  if (next.length < before.length * 0.45 || next.length > before.length * 2.2) return 'length out of range';
  if (/!/.test(next) || /\p{Extended_Pictographic}/u.test(next)) return 'exclamation or emoji';
  if (/\bthe answers\b/i.test(next)) return 'quiz voice';
  const slot = unknownSlot(next);
  if (slot) return `unknown slot {${slot}}`;
  if (!sameSlots(before, next)) return 'slots changed';
  if (!fix.reason.trim()) return 'no reason';
  return null;
}

function escapeForSource(text: string, quote: '"' | "'"): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
  return quote === '"' ? escaped.replace(/"/g, '\\"') : escaped.replace(/'/g, "\\'");
}

/** Replace one exact player line in a file's text. Returns null when it is not found once. */
export function replaceLine(source: string, before: string, after: string): string | null {
  const hits: { index: number; quote: '"' | "'" }[] = [];
  for (const quote of ['"', "'"] as const) {
    const needle = quote + escapeForSource(before, quote) + quote;
    let from = 0;
    while (from < source.length) {
      const at = source.indexOf(needle, from);
      if (at < 0) break;
      hits.push({ index: at, quote });
      from = at + needle.length;
    }
  }
  if (hits.length !== 1) return null;
  const hit = hits[0]!;
  const needle = hit.quote + escapeForSource(before, hit.quote) + hit.quote;
  const replacement = hit.quote + escapeForSource(after, hit.quote) + hit.quote;
  return source.slice(0, hit.index) + replacement + source.slice(hit.index + needle.length);
}

function collect(): { base: string; note: string; lines: CopyLine[] } {
  const { ref, note } = resolveBase();
  const diff = git(`diff -U0 ${ref}...HEAD -- ${ALLOW.join(' ')}`);
  return { base: ref, note, lines: playerLinesFromDiff(diff) };
}

async function completeGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY ?? '';
  if (!key) throw new Error('gemini_key_missing');
  const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('Gemini empty');
  return text;
}

async function completeDeepSeek(prompt: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY ?? '';
  if (!key) throw new Error('deepseek_key_missing');
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('DeepSeek empty');
  return text;
}

async function complete(prompt: string): Promise<string | null> {
  try {
    return await completeGemini(prompt);
  } catch (err) {
    const why = err instanceof Error ? err.message.slice(0, 80) : 'gemini failed';
    console.warn(`copy:review: Gemini skipped (${why}). Trying DeepSeek.`);
    try {
      return await completeDeepSeek(prompt);
    } catch (next) {
      const second = next instanceof Error ? next.message.slice(0, 80) : 'deepseek failed';
      console.warn(`copy:review: DeepSeek skipped (${second}).`);
      return null;
    }
  }
}

function appendLog(rows: { file: string; before: string; after: string; reason: string }[]): void {
  if (rows.length === 0) return;
  const stamp = new Date().toISOString();
  const blocks = rows.map(
    (row) => `- file: ${row.file}\n  - old: ${row.before}\n  - new: ${row.after}\n  - reason: ${row.reason}`,
  );
  appendFileSync(LOG, `\n## ${stamp}\n\n${blocks.join('\n\n')}\n`, 'utf8');
}

function selfTest(): void {
  const diff = [
    'diff --git a/src/lib/story-library/lines.ts b/src/lib/story-library/lines.ts',
    '+++ b/src/lib/story-library/lines.ts',
    '+    id: "openness-high-shows-when",',
    '+    text: "The answers put two things together for you: trying something new.",',
    '+    text: "{Subj} will try something new the next time it comes up.",',
    'diff --git a/src/lib/questions/bank.ts b/src/lib/questions/bank.ts',
    '+    prompt: "This question text must stay out of the review.",',
    'diff --git a/src/play/neon-viper.ts b/src/play/neon-viper.ts',
    '+    label: "Play copy must stay out of the review.",',
  ].join('\n');
  const found = playerLinesFromDiff(diff);
  if (found.length !== 2) throw new Error(`self-test collected ${found.length}, expected 2`);
  if (found.some((line) => line.file.includes('questions') || line.file.includes('play'))) {
    throw new Error('self-test collected a no-touch file');
  }
  const guide = readFileSync(GUIDE, 'utf8');
  const prompt = reviewBeforeQueue(guide, found);
  if (!prompt.includes('Meaning first') || !prompt.includes('more than one idea') || !prompt.includes(found[0]!.text)) {
    throw new Error('self-test prompt missed the rubric or the line');
  }
  const parsed = parseCopyReviewResponse(
    '{"fixes":[{"id":"src/lib/story-library/lines.ts#1","new":"You like trying new things, and you turn ordinary tasks into a game.","reason":"Says who and what, with no quiz voice."},{"id":"src/lib/story-library/lines.ts#2","new":"You will try something new the next time it comes up.","reason":"Drops the slot."}]}',
  );
  const first = found[0]!;
  const dropped = found[1]!;
  const ok = parsed[0]!;
  const bad = parsed[1]!;
  if (acceptFix(first.text, ok)) throw new Error('self-test rejected a good rewrite');
  if (!acceptFix(dropped.text, bad)) throw new Error('self-test kept a rewrite that dropped {Subj}');
  const source = '    text: "The answers put two things together for you: trying something new.",\n';
  const rewritten = replaceLine(source, first.text, ok.newText);
  if (!rewritten?.includes('You like trying new things, and you turn ordinary tasks into a game.')) {
    throw new Error('self-test did not splice the line');
  }
  console.log('copy:review self-test');
  console.log(`collected ${found.length} lines (ids and no-touch paths left out)`);
  console.log(`old: ${first.text}`);
  console.log(`new: ${ok.newText}`);
  console.log(`reason: ${ok.reason}`);
  console.log(`rejected: ${acceptFix(dropped.text, bad)}`);
  console.log('copy:review self-test: ok');
}

async function main(): Promise<void> {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }
  loadEnvFile();
  const { base, note, lines } = collect();
  const limit = Number(process.env.COPY_REVIEW_LIMIT ?? '');
  const batchLines = Number.isFinite(limit) && limit > 0 ? lines.slice(0, limit) : lines;
  console.log(`copy:review base: ${base} (${note})`);
  console.log(`player-facing lines: ${lines.length}`);
  if (batchLines.length < lines.length) console.log(`this run reviews ${batchLines.length} (COPY_REVIEW_LIMIT)`);
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const deepseek = Boolean(process.env.DEEPSEEK_API_KEY);
  if (!gemini && !deepseek) {
    console.warn(
      'copy:review: skipped. Neither GEMINI_API_KEY nor DEEPSEEK_API_KEY is set. No lines were rewritten. Builds are not blocked.',
    );
    return;
  }
  console.log(`model key: ${gemini ? 'GEMINI_API_KEY' : 'DEEPSEEK_API_KEY'}`);
  const guide = readFileSync(GUIDE, 'utf8');
  const applied: { file: string; before: string; after: string; reason: string }[] = [];
  const byId = new Map(batchLines.map((line) => [line.id, line]));
  for (let index = 0; index < batchLines.length; index += BATCH) {
    const batch = batchLines.slice(index, index + BATCH);
    const reply = await complete(reviewBeforeQueue(guide, batch));
    if (!reply) {
      console.warn(`copy:review: batch ${index / BATCH + 1} had no model reply. Those lines were left as they are.`);
      continue;
    }
    let fixes: CopyFix[] = [];
    try {
      fixes = parseCopyReviewResponse(reply);
    } catch (err) {
      console.warn(`copy:review: batch ${index / BATCH + 1} reply was not usable (${err instanceof Error ? err.message : 'parse'}).`);
      continue;
    }
    for (const fix of fixes) {
      const line = byId.get(fix.id);
      if (!line) continue;
      const problem = acceptFix(line.text, fix);
      if (problem) {
        console.warn(`copy:review: rejected ${fix.id} (${problem}).`);
        continue;
      }
      const full = path.join(ROOT, line.file);
      const source = readFileSync(full, 'utf8');
      const next = replaceLine(source, line.text, fix.newText);
      if (!next) {
        console.warn(`copy:review: ${fix.id} was not a single exact line in ${line.file}. Left it.`);
        continue;
      }
      writeFileSync(full, next);
      applied.push({ file: line.file, before: line.text, after: fix.newText, reason: fix.reason });
      console.log(`rewrote ${line.file}`);
      console.log(`  old: ${line.text}`);
      console.log(`  new: ${fix.newText}`);
      console.log(`  reason: ${fix.reason}`);
    }
  }
  appendLog(applied);
  console.log(`copy:review: ${applied.length} line(s) rewritten. Run npm run check:player-copy and npm run check:story-library next.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
