/**
 * Extract changed player-facing lines for an AGENT copy review against
 * docs/voice-guide.md. This script calls no model and needs no API key.
 *
 * Run: npm run copy:review            (prints the queue to stdout)
 *      npm run copy:review -- --out docs/copy-review-queue.md
 * Self-check (no writes): npm run copy:review -- --self-test
 *
 * Diff base is COPY_REVIEW_BASE, else origin/main, else this repo's default
 * branch (master). The reviewing agent reads the queue, edits the lines by
 * hand under the voice guide, and logs each change in docs/copy-review-log.md.
 * See docs/copy-review.md, "Agent review (no API)".
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
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

/** Player-facing sources. Question scores, daily lines, and legend biography stay out. */
const ALLOW = [
  'src/lib/story-library/lines.ts',
  'src/lib/story-library/legend-lines.ts',
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

function main(): void {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }
  const { base, note, lines } = collect();
  const guide = readFileSync(GUIDE, 'utf8');
  const out = [
    `# Copy review queue`,
    '',
    `Base: ${base} (${note}). Lines: ${lines.length}. Generated by scripts/copy-review.ts; no model was called.`,
    '',
    'Reviewer (an agent or a person): apply docs/voice-guide.md to each line below. Keep every {slot}, keep it one line,',
    `edit the source by hand, and log old/new/reason in ${path.relative(ROOT, LOG)}.`,
    '',
    '## Review brief',
    '',
    reviewBeforeQueue(guide, lines),
    '',
  ].join('\n');
  const at = process.argv.indexOf('--out');
  if (at > -1 && process.argv[at + 1]) {
    writeFileSync(path.join(ROOT, process.argv[at + 1]!), out, 'utf8');
    console.log(`copy:review: wrote ${lines.length} line(s) to ${process.argv[at + 1]}`);
  } else {
    console.log(out);
  }
}

main();
