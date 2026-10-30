/**
 * Load emci's ticked Almanac cards into the app (ATO-BUILD PHASE-11c).
 *
 *   npm run load:almanac                  ticked cards only (what ships)
 *   npm run load:almanac -- --assign      give every row without an id its id, write them into the doc
 *   npm run load:almanac -- --all         DRAFT mode: every row, for local development only. Never commit it:
 *                                          `check:almanac-bank` refuses a generated file written this way.
 *   npm run load:almanac -- --dry-run
 *
 * Same shape as the daily line (docs/daily-line-review.md → load:daily-line → generated TS), with one
 * change: ids live IN the review doc. A daily-line id is a hash of its text, so a typo fix would change
 * it (red team M2). Here an id is a slug `alm_<kind>_<target>_<nn>`, assigned once and kept; the text
 * can be edited. Every id ever written stays in the doc ([r] = retired, never shown, id kept) and in
 * the generated ledger; the loader refuses to run if a ledger id disappears from the doc.
 *
 * Doc format
 *   ### `kind | target`          target: any · openness:high · openness:high+autonomy:low · halloween/peak
 *                                · full_moon (a micro-event) · season_sparks · month_masks · week_openness
 *                                (optional `@0,6` = local weekdays, 0 = Sunday)
 *   - [ ] `alm_line_any_01` text ~~ alt text          (alt is used when a slot has no value)
 *   - [x] ticked by emci · [r] retired
 *   basepick rows (to 368 in 11d):  prompt || option [H] || option [L]
 *   event Pick rows:                prompt || option || option [out]   ([out] = "it's just a day for me")
 *   archetype rows:                 a year-recap name, one per trait band
 *
 * Offline. No sign-in, no model call, no database call.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { MONTH_THEMES, SEASONS, monthArc, seasonArc, weekArc } from '../src/lib/almanac/arcs';
import { EVENT_IDS, MICRO_IDS, isGentleEvent } from '../src/lib/almanac/events';
import { ALMANAC_MAX_CHARS, ALMANAC_SLOTS, slotsIn } from '../src/lib/almanac/slots';
import { ALMANAC_KINDS, ALMANAC_PHASES, type AlmanacLeanKey, type AlmanacPhase } from '../src/lib/almanac/types';
import { fnv1a, parseLeanTag } from '../src/lib/daily-line/bank';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';
import { tipRuleViolation } from '../src/lib/voice/clear-voice';
import { readerLabelHit } from '../src/lib/voice/clinical';
import { matchingFrameworkTerms } from '../src/lib/voice/framework-fence';

const ROOT = path.resolve(__dirname, '..');
export const REVIEW_FILE = 'docs/almanac-review.md';
export const OUT_TS = 'src/lib/almanac/bank.generated.ts';
export const DRAFT_MARK = 'DRAFT MODE';

/** Doc kinds: the engine's card kinds, plus the two that are not cards. */
export const DOC_KINDS = [...ALMANAC_KINDS, 'basepick', 'archetype'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const MAX_OPTION_CHARS = 40;
export const MAX_ARCHETYPE_CHARS = 32;
/** Worst-case length of each slot's value, for the 120-character check. */
export const SLOT_MAX_CHARS: Readonly<Record<string, number>> = {
  name: 20,
  axis: 14,
  axisPct: 3,
  pairAxis: 14,
  pairPct: 3,
  peerFrac: 12,
  streak: 3,
  pickShare: 4,
  lastPick: 40,
  eventName: 22,
  daysInto: 2,
};
/** Slots an event card always has while its event is live. */
const EVENT_SLOTS = new Set(['eventName', 'daysInto']);

// ---------------------------------------------------------------- parsing

export interface DocRow {
  /** 1-based line in the doc. */
  line: number;
  mark: ' ' | 'x' | 'r';
  id: string | null;
  kind: DocKind;
  targetRaw: string;
  /** Everything after the id, as written. */
  body: string;
}

export interface Target {
  slug: string;
  axes?: AlmanacLeanKey[];
  axis?: TraitAxis;
  event?: string;
  phase?: AlmanacPhase;
  arc?: string;
  weekday?: number[];
}

export const ARC_IDS: readonly string[] = [
  ...SEASONS.map((s) => seasonArc(s.id)),
  ...MONTH_THEMES.map((m) => monthArc(m.id)),
  ...TRAIT_AXES.map((a) => weekArc(a)),
];

export function readReviewFile(markdown: string): { rows: DocRow[]; unreadable: string[]; lines: string[] } {
  const lines = markdown.split(/\r?\n/);
  const rows: DocRow[] = [];
  const unreadable: string[] = [];
  let heading: { kind: DocKind; target: string } | null = null;
  lines.forEach((raw, i) => {
    if (/^###\s/.test(raw)) {
      const m = /^###\s+`([a-z]+)\s*\|\s*([^`]+?)\s*`\s*$/.exec(raw);
      if (m && (DOC_KINDS as readonly string[]).includes(m[1]!)) heading = { kind: m[1] as DocKind, target: m[2]! };
      else {
        heading = null;
        unreadable.push(`line ${i + 1}: ${raw.trim()}`);
      }
      return;
    }
    if (/^##?\s/.test(raw)) {
      heading = null;
      return;
    }
    if (!/^\s*[-*]\s*\[/.test(raw)) return;
    const m = /^- \[( |x|X|r)\]\s+(?:`(alm_[a-z0-9_]+)`\s+)?(\S.*?)\s*$/.exec(raw);
    if (!m || !heading) {
      unreadable.push(`line ${i + 1}: ${raw.trim()}`);
      return;
    }
    rows.push({
      line: i + 1,
      mark: m[1] === 'X' ? 'x' : (m[1] as ' ' | 'x' | 'r'),
      id: m[2] ?? null,
      kind: heading.kind,
      targetRaw: heading.target,
      body: m[3]!,
    });
  });
  return { rows, unreadable, lines };
}

/** Null target = the heading's target is not one this app knows (the string says why). */
export function parseTarget(kind: DocKind, raw: string): Target | string {
  const [main, days] = raw.split('@') as [string, string | undefined];
  const out: Target = { slug: '' };
  let weekday: number[] | undefined;
  if (days !== undefined) {
    weekday = days.split(',').map((d) => Number(d.trim()));
    if (weekday.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return `weekdays must be 0-6: ${raw}`;
    out.weekday = weekday;
  }
  const slug = (s: string) => s.replace(/:high/g, '_h').replace(/:low/g, '_l').replace(/[+/:]/g, '_');
  out.slug = slug(main);

  if (kind === 'basepick') {
    if (!(TRAIT_AXES as readonly string[]).includes(main)) return `basepick target must be a trait: ${raw}`;
    out.axis = main as TraitAxis;
    return out;
  }
  if (kind === 'archetype') {
    const keys = parseLeanTag(main);
    if (!keys || keys.length !== 1) return `archetype target must be one band like openness:high: ${raw}`;
    out.axes = keys as AlmanacLeanKey[];
    return out;
  }
  if (main === 'any') return out;
  if (main.includes('/')) {
    const [event, phase] = main.split('/') as [string, string];
    if (!(EVENT_IDS as readonly string[]).includes(event) && !(MICRO_IDS as readonly string[]).includes(event)) {
      return `unknown event \`${event}\``;
    }
    if (!(ALMANAC_PHASES as readonly string[]).includes(phase)) return `unknown phase \`${phase}\``;
    out.event = event;
    out.phase = phase as AlmanacPhase;
    return out;
  }
  if ((EVENT_IDS as readonly string[]).includes(main) || (MICRO_IDS as readonly string[]).includes(main)) {
    out.event = main;
    return out;
  }
  if (ARC_IDS.includes(main)) {
    out.arc = main;
    return out;
  }
  const keys = parseLeanTag(main);
  if (keys && keys.length >= 1) {
    out.axes = keys as AlmanacLeanKey[];
    return out;
  }
  return `unknown target \`${raw}\``;
}

export interface PickOption {
  text: string;
  /** 0.8 = [H], 0.2 = [L]; absent on an event Pick. */
  value?: 0.8 | 0.2;
  out?: true;
}

export interface ParsedBody {
  text: string;
  alt?: string;
  options?: [PickOption, PickOption];
  problems: string[];
}

export function parseBody(kind: DocKind, body: string): ParsedBody {
  const problems: string[] = [];
  if (kind === 'basepick' || kind === 'pick') {
    const parts = body.split(' || ').map((p) => p.trim());
    if (parts.length !== 3 || parts.some((p) => !p)) {
      return { text: parts[0] ?? '', problems: ['a Pick row is `prompt || option || option`'] };
    }
    const options = parts.slice(1).map((p): PickOption => {
      const m = /^(.*?)\s*\[(H|L|out)\]$/.exec(p);
      if (!m) return { text: p };
      if (m[2] === 'out') return { text: m[1]!, out: true };
      return { text: m[1]!, value: m[2] === 'H' ? 0.8 : 0.2 };
    });
    return { text: parts[0]!, options: options as [PickOption, PickOption], problems };
  }
  const split = body.split(' ~~ ');
  if (split.length > 2) problems.push('more than one ` ~~ ` alt');
  const text = split[0]!.trim();
  const alt = split[1]?.trim();
  return { text, ...(alt ? { alt } : {}), problems };
}

// ---------------------------------------------------------------- rules

function sampleFill(template: string): string {
  return template.replace(/\{([A-Za-z]+)\}/g, (_all, slot: string) =>
    slot === 'axis' || slot === 'pairAxis' ? 'Adventurous' : slot === 'name' ? 'Sam' : slot === 'eventName' ? 'Halloween' : slot === 'lastPick' ? 'the loud option' : slot === 'peerFrac' ? '6 in 10' : '4',
  );
}

function maxFill(template: string): string {
  return template.replace(/\{([A-Za-z]+)\}/g, (_all, slot: string) => 'x'.repeat(SLOT_MAX_CHARS[slot] ?? 0));
}

/** Rules every shown string follows: length, slots, fence, label, formatting. Core content policy: meaning, never word bans. */
export function stringProblems(text: string, label: string, hasEvent: boolean, isAlt = false): string[] {
  const out: string[] = [];
  if (!text.trim()) return [`${label} is empty`];
  if (text !== text.trim() || /\s{2}/.test(text)) out.push(`${label} has stray spaces`);
  const used = slotsIn(text);
  const unknown = used.filter((s) => !(ALMANAC_SLOTS as readonly string[]).includes(s));
  if (unknown.length > 0) out.push(`${label} uses an unknown slot {${unknown.join('}, {')}}`);
  if (/[{}]/.test(text.replace(/\{[A-Za-z]+\}/g, ''))) out.push(`${label} has a stray brace`);
  if (isAlt && used.length > 0) out.push(`${label} (alt) must not use slots`);
  const longest = maxFill(text).trim().length;
  if (longest > ALMANAC_MAX_CHARS) out.push(`${label} is ${longest} characters at its longest (max ${ALMANAC_MAX_CHARS})`);
  const sample = sampleFill(text);
  const terms = matchingFrameworkTerms(sample);
  if (terms.length > 0) out.push(`${label} names the model: ${terms.join(', ')}`);
  const verdict = readerLabelHit(sample);
  if (verdict) out.push(`${label} pins a label on the reader (${verdict})`);
  if (/#|!{2,}/.test(text)) out.push(`${label} has a hashtag or shouting`);
  void hasEvent;
  return out;
}

/** Every problem with one row, or []. Cheap and offline. */
export function rowProblems(row: DocRow, target: Target, parsed: ParsedBody): string[] {
  const where = row.id ?? `line ${row.line}`;
  const out: string[] = parsed.problems.map((p) => `${where}: ${p}`);
  const tag = (s: string) => `${where}: ${s}`;
  if (row.kind === 'basepick') {
    if (!parsed.options) return out;
    out.push(...stringProblems(parsed.text, 'prompt', false).map(tag));
    const [a, b] = parsed.options;
    for (const o of parsed.options) {
      out.push(...stringProblems(o.text, 'option', false).map(tag));
      if (o.text.length > MAX_OPTION_CHARS) out.push(tag(`option "${o.text}" is over ${MAX_OPTION_CHARS} characters`));
      if (o.out) out.push(tag('a trait Pick has no [out] option'));
    }
    if (!(a.value && b.value && a.value !== b.value)) out.push(tag('a trait Pick needs one [H] and one [L] option'));
    if (slotsIn(parsed.text).length > 0) out.push(tag('a Pick has no slots'));
    return out;
  }
  if (row.kind === 'pick') {
    if (!parsed.options) return out;
    out.push(...stringProblems(parsed.text, 'prompt', true).map(tag));
    for (const o of parsed.options) {
      out.push(...stringProblems(o.text, 'option', true).map(tag));
      if (o.text.length > MAX_OPTION_CHARS) out.push(tag(`option "${o.text}" is over ${MAX_OPTION_CHARS} characters`));
      if (o.value) out.push(tag('an event Pick carries no trait value ([H]/[L])'));
    }
    if (target.axes) out.push(tag('an event Pick carries no trait lean (it is shared by everyone)'));
    if (!target.event) out.push(tag('an event Pick needs an event heading'));
    const outs = parsed.options.filter((o) => o.out).length;
    const gentle = !!target.event && isGentleEvent(target.event);
    if (gentle && outs !== 1) out.push(tag('a gentle-day Pick needs exactly one [out] ("just a day for me") option'));
    if (!gentle && outs > 0) out.push(tag('[out] belongs on gentle days only'));
    return out;
  }
  if (row.kind === 'archetype') {
    if (parsed.text.length > MAX_ARCHETYPE_CHARS) out.push(tag(`name is over ${MAX_ARCHETYPE_CHARS} characters`));
    if (slotsIn(parsed.text).length > 0) out.push(tag('a name has no slots'));
    out.push(...stringProblems(parsed.text, 'name', false).map(tag));
    return out;
  }
  const hasEvent = !!target.event;
  out.push(...stringProblems(parsed.text, 'text', hasEvent).map(tag));
  if (parsed.alt) out.push(...stringProblems(parsed.alt, 'alt', hasEvent, true).map(tag));
  const needsAlt = slotsIn(parsed.text).some((s) => !(hasEvent && EVENT_SLOTS.has(s)));
  if (needsAlt && !parsed.alt) out.push(tag('uses a slot that can be empty, so it needs an alt (` ~~ alt text`)'));
  if (row.kind === 'try') {
    const v = tipRuleViolation(sampleFill(parsed.text), 'try');
    if (v) out.push(tag(`try (clear voice): ${v}`));
  }
  if (target.weekday && row.kind !== 'reflect' && row.kind !== 'line') out.push(tag('weekdays are for reflect and line cards'));
  return out;
}

// ---------------------------------------------------------------- ids

export function idPrefix(kind: DocKind, slug: string): string {
  return `alm_${kind}_${slug}_`;
}

/** Fill in missing ids (the next free number per kind + target). Returns the rewritten doc lines. */
export function assignIds(rows: readonly DocRow[], lines: readonly string[]): { lines: string[]; assigned: number; problems: string[] } {
  const out = [...lines];
  const next = new Map<string, number>();
  const problems: string[] = [];
  const bump = (prefix: string, n: number) => next.set(prefix, Math.max(next.get(prefix) ?? 0, n));
  for (const row of rows) {
    if (!row.id) continue;
    const m = /^(.*_)(\d+)$/.exec(row.id);
    if (m) bump(m[1]!, Number(m[2]));
  }
  let assigned = 0;
  for (const row of rows) {
    if (row.id) continue;
    const target = parseTarget(row.kind, row.targetRaw);
    if (typeof target === 'string') {
      problems.push(`line ${row.line}: ${target}`);
      continue;
    }
    const prefix = idPrefix(row.kind, target.slug);
    const n = (next.get(prefix) ?? 0) + 1;
    next.set(prefix, n);
    const id = `${prefix}${String(n).padStart(2, '0')}`;
    out[row.line - 1] = `- [${row.mark}] \`${id}\` ${row.body}`;
    assigned += 1;
  }
  return { lines: out, assigned, problems };
}

// ---------------------------------------------------------------- the plan

export interface Entry {
  row: DocRow;
  target: Target;
  parsed: ParsedBody;
}

export interface LoadPlan {
  entries: Entry[];
  /** Rows that will ship (ticked, or all non-retired in draft mode). */
  picked: Entry[];
  problems: string[];
}

export function planLoad(rows: readonly DocRow[], mode: { all: boolean }): LoadPlan {
  const entries: Entry[] = [];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const row of rows) {
    const target = parseTarget(row.kind, row.targetRaw);
    if (typeof target === 'string') {
      problems.push(`line ${row.line}: ${target}`);
      continue;
    }
    if (!row.id) {
      problems.push(`line ${row.line}: no id yet (run \`npm run load:almanac -- --assign\`)`);
      continue;
    }
    if (ids.has(row.id)) problems.push(`${row.id}: id used twice`);
    ids.add(row.id);
    const prefix = idPrefix(row.kind, target.slug);
    if (!row.id.startsWith(prefix) || !/^\d{2,}$/.test(row.id.slice(prefix.length))) {
      problems.push(`${row.id}: id does not match its heading (expected ${prefix}<nn>)`);
    }
    entries.push({ row, target, parsed: parseBody(row.kind, row.body) });
  }
  const picked = entries.filter((e) => e.row.mark !== 'r' && (mode.all || e.row.mark === 'x'));
  for (const e of picked) problems.push(...rowProblems(e.row, e.target, e.parsed));
  return { entries, picked, problems };
}

/** Duplicate text across every live row (fnv1a of the normalised text), and against `extra` (the 64 shipped Picks). */
export function duplicateProblems(entries: readonly Entry[], extra: readonly string[] = []): string[] {
  const seen = new Map<number, string>();
  const out: string[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  for (const text of extra) seen.set(fnv1a(norm(text)), 'a shipped Pick');
  for (const e of entries) {
    if (e.row.mark === 'r') continue;
    const key = fnv1a(norm(e.parsed.text));
    const prior = seen.get(key);
    if (prior) out.push(`${e.row.id}: same text as ${prior}`);
    else seen.set(key, e.row.id ?? `line ${e.row.line}`);
  }
  return out;
}

// ---------------------------------------------------------------- output

interface GenCard {
  id: string;
  kind: string;
  axes?: AlmanacLeanKey[];
  event?: string;
  phase?: AlmanacPhase;
  arc?: string;
  weekday?: number[];
  text: string;
  alt?: string;
  reviewed: true;
}

export function cardsFrom(picked: readonly Entry[]): GenCard[] {
  return picked
    .filter((e) => e.row.kind !== 'basepick' && e.row.kind !== 'archetype')
    .map((e): GenCard => {
      const c: GenCard = { id: e.row.id!, kind: e.row.kind, text: e.parsed.text, reviewed: true };
      if (e.target.axes) c.axes = e.target.axes;
      if (e.target.event) c.event = e.target.event;
      if (e.target.phase) c.phase = e.target.phase;
      if (e.target.arc) c.arc = e.target.arc;
      if (e.target.weekday) c.weekday = e.target.weekday;
      if (e.parsed.alt) c.alt = e.parsed.alt;
      return {
        id: c.id,
        kind: c.kind,
        ...(c.axes ? { axes: c.axes } : {}),
        ...(c.event ? { event: c.event } : {}),
        ...(c.phase ? { phase: c.phase } : {}),
        ...(c.arc ? { arc: c.arc } : {}),
        ...(c.weekday ? { weekday: c.weekday } : {}),
        text: c.text,
        ...(c.alt ? { alt: c.alt } : {}),
        reviewed: true,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function renderTs(entries: readonly Entry[], picked: readonly Entry[], draft: boolean): string {
  const cards = cardsFrom(picked);
  const basePicks = picked
    .filter((e) => e.row.kind === 'basepick')
    .map((e) => ({ id: e.row.id!, axis: e.target.axis!, prompt: e.parsed.text, options: e.parsed.options! }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const eventPickOptions: Record<string, PickOption[]> = {};
  for (const e of picked) if (e.row.kind === 'pick') eventPickOptions[e.row.id!] = e.parsed.options!;
  const archetypes: Record<string, { id: string; name: string }> = {};
  for (const e of picked) if (e.row.kind === 'archetype') archetypes[e.target.axes![0]!] = { id: e.row.id!, name: e.parsed.text };
  const ledger = entries.map((e) => e.row.id!).sort();
  const payload = JSON.stringify({ cards, basePicks, eventPickOptions, archetypes });
  const version = cards.length + basePicks.length + Object.keys(archetypes).length === 0 ? 0 : (fnv1a(payload) % 1_000_000) + 1;
  const rows = (items: readonly unknown[]) => items.map((item) => `  ${JSON.stringify(item)},`).join('\n');
  return `/**
 * GENERATED by \`npm run load:almanac\` from docs/almanac-review.md.${draft ? `\n * ${DRAFT_MARK}: every row, ticked or not. Local development only; never commit this.` : ''}
 * Do not edit by hand: tick rows in the review file and run the loader.
 *
 * ${cards.length} cards, ${basePicks.length} base Picks, ${Object.keys(archetypes).length} year archetypes${draft ? '' : ' (ticked only)'}.
 * The ledger lists every id ever written to the review doc (ticked or not, retired too).
 */
import type { TraitAxis } from '@/lib/traits';

import type { AlmanacCard } from './types';

/** Changes whenever any shipped card changes (the engine's cache key). 0 = nothing shipped. */
export const GENERATED_BANK_VERSION = ${version};

export const GENERATED_CARDS: readonly AlmanacCard[] = [
${rows(cards)}
] as readonly AlmanacCard[];

export interface GeneratedPickOption {
  text: string;
  /** 0.8 = the trait's high end, 0.2 = its low end. Absent on an event Pick. */
  value?: number;
  /** "It's just a day for me": the way out on a gentle day. */
  out?: boolean;
}

export interface GeneratedBasePick {
  /** Review-doc id. PHASE-11d appends these to the Pick bank as p65… in this order. */
  id: string;
  axis: TraitAxis;
  prompt: string;
  options: readonly [GeneratedPickOption, GeneratedPickOption];
}

/** The new base Picks (304 when the whole bank is ticked; 64 ship today, 368 = 16 × 23). */
export const GENERATED_BASE_PICKS: readonly GeneratedBasePick[] = [
${rows(basePicks)}
] as readonly GeneratedBasePick[];

/** Options for the event Pick cards above, by card id. */
export const GENERATED_EVENT_PICK_OPTIONS: Readonly<Record<string, readonly [GeneratedPickOption, GeneratedPickOption]>> = ${JSON.stringify(eventPickOptions, null, 2)} as Readonly<Record<string, readonly [GeneratedPickOption, GeneratedPickOption]>>;

/** Year-recap archetype names, by band (\`openness:high\`). */
export const GENERATED_YEAR_ARCHETYPES: Readonly<Record<string, { id: string; name: string }>> = ${JSON.stringify(archetypes, null, 2)};

export const ALMANAC_ID_LEDGER: readonly string[] = [
${ledger.map((id) => `  ${JSON.stringify(id)},`).join('\n')}
];
`;
}

/** Ids already in the generated file's ledger, or [] when there is no file yet. */
export function ledgerIdsFrom(generated: string): string[] {
  const at = generated.indexOf('export const ALMANAC_ID_LEDGER');
  if (at < 0) return [];
  return [...generated.slice(at).matchAll(/"(alm_[a-z0-9_]+)"/g)].map((m) => m[1]!);
}

export function readGenerated(): string {
  try {
    return readFileSync(path.join(ROOT, OUT_TS), 'utf8');
  } catch {
    return '';
  }
}

export function ledgerProblems(entries: readonly Entry[], generated: string): string[] {
  const live = new Set(entries.map((e) => e.row.id));
  return ledgerIdsFrom(generated)
    .filter((id) => !live.has(id))
    .map((id) => `${id} was in the ledger but is gone from the doc (ids are never deleted: mark the row [r])`);
}

function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const assign = args.includes('--assign');
  const dryRun = args.includes('--dry-run');
  const docPath = path.join(ROOT, REVIEW_FILE);
  let { rows, unreadable, lines } = readReviewFile(readFileSync(docPath, 'utf8'));
  const problems: string[] = unreadable.map((u) => `could not read this row or heading (check the format): ${u}`);

  if (assign) {
    const result = assignIds(rows, lines);
    problems.push(...result.problems);
    if (result.assigned > 0 && problems.length === 0 && !dryRun) {
      writeFileSync(docPath, result.lines.join('\n'), 'utf8');
      console.log(`Assigned ${result.assigned} ids in ${REVIEW_FILE}.`);
      ({ rows, unreadable, lines } = readReviewFile(readFileSync(docPath, 'utf8')));
    }
  }

  const plan = planLoad(rows, { all });
  problems.push(...plan.problems);
  problems.push(...ledgerProblems(plan.entries, readGenerated()));
  const ticked = rows.filter((r) => r.mark === 'x').length;
  console.log(`${rows.length} rows in ${REVIEW_FILE}, ${ticked} ticked, ${plan.picked.length} ${all ? 'taken (--all, draft mode)' : 'shipping'}.`);
  if (problems.length > 0) {
    console.log(`\nNot loaded. ${problems.length} thing(s) to fix:`);
    for (const p of problems.slice(0, 60)) console.log(`  - ${p}`);
    if (problems.length > 60) console.log(`  … and ${problems.length - 60} more`);
    process.exit(1);
  }
  if (dryRun) {
    console.log('Dry run: everything checks out, nothing written.');
    return;
  }
  writeFileSync(path.join(ROOT, OUT_TS), renderTs(plan.entries, plan.picked, all), 'utf8');
  console.log(`Wrote ${OUT_TS}.${all ? ' DRAFT MODE: do not commit.' : ''}`);
}

if (require.main === module) main();
