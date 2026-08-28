/**
 * Library grounding for Sage. Runtime reads only ### For Sage paraphrase
 * lines from the synced markdown — never Source lines, never teaching copy.
 *
 * An entry is eligible only when it connects to something real: a named
 * knocks_you_off domain, a filled trait axis, a stored fact, or (Talk) the
 * typed line. Existence in library.md is not enough.
 */
import { LIBRARY_MARKDOWN } from './content.generated';
import type { VoiceMe } from './types';

export const LIBRARY_ENTRY_IDS = [
  'sleep',
  'workload',
  'conflict',
  'communication',
  'health',
  'money',
  'sdt',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
] as const;

export type LibraryEntryId = (typeof LIBRARY_ENTRY_IDS)[number];

export interface LibraryEntry {
  id: LibraryEntryId;
  paraphrases: string[];
}

const HEADING_TO_ID: Record<string, LibraryEntryId> = {
  Sleep: 'sleep',
  Workload: 'workload',
  Conflict: 'conflict',
  Communication: 'communication',
  Health: 'health',
  Money: 'money',
  'Self-Determination Theory': 'sdt',
  'Growth mindset': 'growth_mindset',
  'Locus of control': 'locus_of_control',
  'Self-efficacy': 'self_efficacy',
};

const AGENCY_IDS: readonly LibraryEntryId[] = [
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
];

/** Keyword hits for facts and Talk. No bare "work" — that false-positives a time fact. */
const KEYWORDS: Record<LibraryEntryId, string[]> = {
  sleep: ['sleep', 'slept', 'bedtime', 'insomnia', 'last night', 'short night'],
  workload: ['workload', 'pile', 'deadline', 'overwork', 'whole list', 'stacked day', 'no real stop'],
  conflict: ['conflict', 'fight', 'argument', 'disagreement', 'you always', 'you never'],
  communication: ['what to say', 'hard conversation', 'told them', 'left out', 'one ask'],
  health: ['health', 'workout', 'sick', 'pill next', 'shoes by the door'],
  money: ['money', 'rent', 'bills', 'spend', 'checkout', 'pay the buffer'],
  sdt: ['their own way', 'path someone else', 'real connection'],
  growth_mindset: ['after a miss', 'try again', 'not good at that'],
  locus_of_control: ['bound to happen', 'first thought'],
  self_efficacy: ["i've got this", 'pull this off', 'pull this one off'],
};

export function parseLibraryEntries(markdown: string): LibraryEntry[] {
  const text = markdown.replace(/\r\n/g, '\n');
  const chunks = text.split(/^## /m).slice(1);
  const entries: LibraryEntry[] = [];
  for (const chunk of chunks) {
    const newline = chunk.indexOf('\n');
    const heading = (newline === -1 ? chunk : chunk.slice(0, newline)).trim();
    const id = HEADING_TO_ID[heading];
    if (!id) continue;
    const sageAt = chunk.search(/^### For Sage\s*$/m);
    if (sageAt < 0) continue;
    const sageBody = chunk.slice(sageAt).replace(/^### For Sage\s*/, '');
    const end = sageBody.search(/\n---|\n## /);
    const block = (end < 0 ? sageBody : sageBody.slice(0, end)).trim();
    const paraphrases = block
      .split('\n')
      .map((line) => line.replace(/^- /, '').trim())
      .filter((line) => line.length > 0);
    if (paraphrases.length === 0) continue;
    entries.push({ id, paraphrases });
  }
  return entries;
}

let cached: LibraryEntry[] | null = null;

export function libraryCatalog(): LibraryEntry[] {
  cached ??= parseLibraryEntries(LIBRARY_MARKDOWN);
  return cached;
}

export function signalPoolFor(me: VoiceMe): string[] {
  const knocks = me.knocks_you_off
    .split(/,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  const facts = (me.facts ?? []).map((fact) => fact.replace(/\.$/, '').trim()).filter(Boolean);
  const extras = [me.show_up, me.current_focus, me.recovery_style].filter(
    (item): item is string => !!item,
  );
  return [...knocks, ...facts, ...extras];
}

function idsMatchingText(text: string): LibraryEntryId[] {
  const lower = text.toLowerCase();
  if (!lower.trim()) return [];
  const hits: LibraryEntryId[] = [];
  for (const id of LIBRARY_ENTRY_IDS) {
    if (KEYWORDS[id].some((word) => lower.includes(word))) hits.push(id);
  }
  return hits;
}

function knockDomainIds(knocks: string): LibraryEntryId[] {
  const parts = knocks
    .split(/,\s*/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && part !== 'something else');
  const ids: LibraryEntryId[] = [];
  for (const part of parts) {
    if (part === 'sleep' || /\bsleep\b/.test(part) || part.includes('slept')) ids.push('sleep');
    if (part === 'workload' || part.includes('workload') || part.includes('overwork')) {
      ids.push('workload');
    }
    if (part === 'people/conflict' || part.includes('conflict') || part.includes('people/')) {
      ids.push('conflict');
    }
    if (part === 'health' || /\bhealth\b/.test(part)) ids.push('health');
    if (part === 'money' || /\bmoney\b/.test(part) || part.includes('rent')) ids.push('money');
  }
  return [...new Set(ids)];
}

function traitEntryIds(me: VoiceMe, day: number): LibraryEntryId[] {
  const ids: LibraryEntryId[] = [];
  if (me.autonomy != null || me.competence != null || me.relatedness != null) ids.push('sdt');
  if (me.conflict_assertiveness != null || me.conflict_cooperativeness != null) ids.push('conflict');
  const agency: LibraryEntryId[] = [];
  if (me.growth_mindset != null) agency.push('growth_mindset');
  if (me.locus_of_control != null) agency.push('locus_of_control');
  if (me.self_efficacy != null) agency.push('self_efficacy');
  if (agency.length === 3) {
    ids.push(agency[(Math.max(day, 1) - 1) % agency.length]!);
  } else {
    ids.push(...agency);
  }
  return [...new Set(ids)];
}

function pick(ids: LibraryEntryId[], day: number): LibraryEntryId | null {
  if (ids.length === 0) return null;
  return ids[(Math.max(day, 1) - 1) % ids.length] ?? null;
}

export interface SelectLibraryOpts {
  day: number;
  /** Talk typed line. Required for Talk — standing knocks are not enough. */
  message?: string;
  surface: 'card' | 'talk';
}

/**
 * 0–2 entries. Cards: today's primary signal (same pool as the local angle),
 * else a filled trait. Talk: only what the typed line connects to.
 */
export function selectLibraryEntries(me: VoiceMe, opts: SelectLibraryOpts): LibraryEntry[] {
  const catalog = libraryCatalog();
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const chosen: LibraryEntryId[] = [];

  if (opts.surface === 'talk') {
    const fromMessage = idsMatchingText(opts.message ?? '');
    chosen.push(...fromMessage.slice(0, 2));
  } else {
    const pool = signalPoolFor(me);
    const signal = pool.length === 0 ? '' : pool[(Math.max(opts.day, 1) - 1) % pool.length]!;
    const fromSignal = idsMatchingText(signal);
    const fromKnock =
      fromSignal.length > 0 ? [] : knockDomainIds(signal).length ? knockDomainIds(signal) : [];
    const domainId = pick([...new Set([...fromSignal, ...fromKnock])], opts.day);
    if (domainId) chosen.push(domainId);
    if (chosen.length === 0) {
      const traitId = pick(traitEntryIds(me, opts.day), opts.day);
      if (traitId) chosen.push(traitId);
    }
  }

  const agencyHits = chosen.filter((id) => (AGENCY_IDS as readonly string[]).includes(id));
  const filtered =
    agencyHits.length >= 3
      ? chosen.filter((id) => !(AGENCY_IDS as readonly string[]).includes(id)).concat(agencyHits[0]!)
      : chosen;

  return [...new Set(filtered)]
    .map((id) => byId.get(id))
    .filter((entry): entry is LibraryEntry => !!entry);
}

export function libraryGroundingBlock(entries: LibraryEntry[]): string {
  if (entries.length === 0) return '';
  const bullets = entries
    .flatMap((entry) => entry.paraphrases)
    .map((line) => `- ${line}`)
    .join('\n');
  return `FRAMING NOTES — shape phrasing and framing only. Do not quote these lines as a block. Do not name a theory, inventory, or "library". Do not add a visible library section to the card or reply.
${bullets}`;
}

/** Phrases that live only in teaching/source copy — must never reach Sage output. */
export const LIBRARY_TEACHING_LEAK =
  /Karasek|Sonnentag|Maslach|CDC \/ AASM|Gottman Institute|Marshall Rosenberg|Wood; Lally|Atomic Habits|Tiny Habits|Thaler on mental buckets|Kahneman|Deci and Richard|Carol S\. Dweck|Julian B\. Rotter|Albert Bandura|Self-Determination Theory|CNVC paid|I–E scale|Mindset Works/i;
