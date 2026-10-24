/**
 * Tracery-style expander (syntax from Kate Compton / Apache-2.0; see
 * docs/story/NOTICE-tracery.txt). Extensions: filter by categoryId + setting
 * + lean, compatibility tags, and `{=slot}` / `[key:value]` reuse.
 */
import { fnv1a } from '@/lib/daily-line/bank';
import type { CategoryId } from '@/lib/categories';
import type { StoryAngle } from '@/lib/ai-library/story';
import type { TraitLean } from '@/lib/traits';
import {
  BANNED_PATTERNS,
  type EndingSpec,
  type FillIssue,
  type FillResult,
  type PronounSet,
  type Reader,
  type SlotSpec,
  type Template,
  type VerbForm,
  type WordEntry,
} from '@/lib/story-library/types';

import type { GrammarEntry, StoryGrammar } from './types';

export interface ExpandContext {
  categoryId: CategoryId;
  setting: StoryAngle;
  lean: TraitLean;
  seed: string;
  room?: string;
}

function asEntries(symbol: StoryGrammar[string] | undefined): GrammarEntry[] {
  if (symbol == null) return [];
  if (typeof symbol === 'string') return [{ text: symbol }];
  return [...symbol].map((row) => (typeof row === 'string' ? { text: row } : row));
}

function compatible(entry: GrammarEntry, ctx: ExpandContext, state: Record<string, string>): boolean {
  if (entry.keys?.categoryId && entry.keys.categoryId !== ctx.categoryId) return false;
  if (entry.keys?.setting && entry.keys.setting !== ctx.setting) return false;
  if (entry.keys?.lean && entry.keys.lean !== ctx.lean) return false;
  if (entry.tags?.settings && !entry.tags.settings.includes(ctx.setting)) return false;
  const room = state.room ?? ctx.room;
  if (room && entry.tags?.rooms && !entry.tags.rooms.includes(room)) return false;
  return true;
}

function applyMods(text: string, mods: string[], entry: GrammarEntry | undefined): string {
  let out = text;
  for (const mod of mods) {
    if (mod === 'cap') out = out.charAt(0).toUpperCase() + out.slice(1);
    else if (mod === 'a' || mod === 'the') {
      const article = entry?.gram?.article ?? (mod === 'the' ? 'the' : /^[aeiou]/i.test(out) ? 'an' : 'a');
      out = article === 'none' ? out : `${article} ${out}`;
    }
    else if (mod === 'it') out = entry?.gram?.pronoun ?? 'it';
    else if (mod === 's') out = entry?.gram?.plural ? out : `${out}s`;
  }
  return out;
}

function keyedName(name: string, ctx: ExpandContext): string {
  return `${name}__${ctx.categoryId}__${ctx.lean}`;
}

export function expandGrammar(grammar: StoryGrammar, start: string, ctx: ExpandContext): { text: string; state: Record<string, string> } {
  const state: Record<string, string> = ctx.room ? { room: ctx.room } : {};
  let counter = 0;

  const pick = (name: string): { text: string; entry?: GrammarEntry } => {
    const keyed = asEntries(grammar[keyedName(name, ctx)]);
    const plain = asEntries(grammar[name]);
    const pool = (keyed.length > 0 ? keyed : plain).filter((row) => compatible(row, ctx, state));
    if (pool.length === 0) return { text: '' };
    const index = fnv1a(`${ctx.seed}|${name}|${counter}`) % pool.length;
    counter += 1;
    return { text: pool[index]!.text, entry: pool[index] };
  };

  const expandOnce = (raw: string, depth: number): string => {
    if (depth > 20) return raw;
    let out = raw.replace(/\[([a-zA-Z]+):([^\]]+)\]/g, (_m, key: string, value: string) => {
      state[key] = value;
      return '';
    });
    out = out.replace(/\{lean:([^|]+)\|([^}]+)\}/g, (_m, high: string, low: string) =>
      ctx.lean === 'high' ? high : low,
    );
    out = out.replace(/\{=([a-zA-Z]+)\}/g, (_m, key: string) => state[key] ?? '');
    out = out.replace(/#([a-zA-Z]+)((?:\.[a-z]+)*)#/g, (_m, name: string, modStr: string) => {
      if (state[name]) return applyMods(state[name], modStr ? modStr.slice(1).split('.') : [], undefined);
      const picked = pick(name);
      const expanded = expandOnce(picked.text, depth + 1);
      const first = expanded.split('\n')[0] ?? expanded;
      if (!state[name] && first) state[name] = first.replace(/\.$/, '');
      return applyMods(expanded, modStr ? modStr.slice(1).split('.') : [], picked.entry);
    });
    return out;
  };

  return { text: expandOnce(start, 0).replace(/[ \t]{2,}/g, ' ').trim(), state };
}

/**
 * Story Library filler. Same file as the Tracery expander so there is one
 * text engine. `expandGrammar` above is unchanged.
 *
 * Slot lookup, first fresh pool that has anything:
 *   1. that trait + that tier
 *   2. that trait + any tier
 *   3. generic
 * Only after every fresh pool is empty does a step repeat an avoided entry.
 * A locked slot reuses the entry already chosen for that lock.
 * Endings: every ending whose facts all match is scored by how many facts it
 * named. The highest score wins. Ties break on a stable hash. The empty
 * `when` is the fallback and always matches at score 0.
 */
export const PRONOUNS: Record<PronounSet['id'], PronounSet> = {
  you: { id: 'you', subj: 'you', subjCap: 'You', obj: 'you', poss: 'your', be: 'are', have: 'have', verbForm: 'base' },
  they: { id: 'they', subj: 'they', subjCap: 'They', obj: 'them', poss: 'their', be: 'are', have: 'have', verbForm: 'base' },
  she: { id: 'she', subj: 'she', subjCap: 'She', obj: 'her', poss: 'her', be: 'is', have: 'has', verbForm: 's' },
  he: { id: 'he', subj: 'he', subjCap: 'He', obj: 'him', poss: 'his', be: 'is', have: 'has', verbForm: 's' },
};

function neededVerbForm(spec: SlotSpec, reader: Reader): VerbForm | null {
  if (spec.pos !== 'verb') return null;
  if (spec.form === 'agree') return reader.pronoun.verbForm;
  if (spec.form === 'base' || spec.form === 's' || spec.form === 'ed' || spec.form === 'ing') return spec.form;
  return null;
}

function traitOf(spec: SlotSpec, reader: Reader): { trait: string; tier: Reader['dominant']['tier'] | 'any' } {
  if (spec.trait === 'secondary' && reader.secondary) {
    return { trait: reader.secondary.trait, tier: reader.secondary.tier };
  }
  if (spec.trait === 'generic') return { trait: 'generic', tier: 'any' };
  return { trait: reader.dominant.trait, tier: reader.dominant.tier };
}

function formOk(entry: WordEntry, spec: SlotSpec, reader: Reader): boolean {
  if (entry.pos !== spec.pos || entry.frame !== spec.frame) return false;
  if (!spec.tones.includes(entry.tone)) return false;
  if (spec.intensities && !spec.intensities.includes(entry.intensity)) return false;
  if (entry.pos === 'verb') {
    const form = neededVerbForm(spec, reader);
    return form != null && Boolean(entry.forms?.[form]?.trim());
  }
  if (entry.pos === 'noun') {
    if (spec.form !== 'singular' && spec.form !== 'plural') return false;
    if (entry.number !== spec.form) return false;
    if (spec.article === 'auto' && !entry.article) return false;
    return Boolean(entry.text?.trim());
  }
  if (entry.pos === 'phrase') return spec.form === 'clause' && Boolean(entry.text?.trim());
  return spec.form === 'clause' && Boolean(entry.text?.trim());
}

/** Entries that may fill this slot, before the trait fallback ladder. */
export function librarySlotCompatible(entry: WordEntry, spec: SlotSpec, reader: Reader): boolean {
  return formOk(entry, spec, reader);
}

function ladder(
  entries: readonly WordEntry[],
  spec: SlotSpec,
  reader: Reader,
): { name: 'trait-tier' | 'trait-any' | 'generic'; rows: WordEntry[] }[] {
  const want = traitOf(spec, reader);
  const base = entries.filter((entry) => formOk(entry, spec, reader));
  const steps: { name: 'trait-tier' | 'trait-any' | 'generic'; pred: (entry: WordEntry) => boolean }[] = [
    { name: 'trait-tier', pred: (entry) => entry.trait === want.trait && entry.tier === want.tier },
    { name: 'trait-any', pred: (entry) => entry.trait === want.trait && entry.tier === 'any' },
    { name: 'generic', pred: (entry) => entry.trait === 'generic' },
  ];
  return steps.map((step) => ({ name: step.name, rows: base.filter(step.pred) }));
}

function normSentence(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
}

export function selectEntry(
  entries: readonly WordEntry[],
  spec: SlotSpec,
  reader: Reader,
  seed: string,
  avoid: ReadonlySet<string>,
  avoidText: ReadonlySet<string> = new Set(),
): { entry: WordEntry | null; via: 'trait-tier' | 'trait-any' | 'generic' | 'none' } {
  const steps = ladder(entries, spec, reader);
  // Shift by the slot id so two slots on the same seed do not land on the same index.
  const pickFrom = (rows: WordEntry[], name: string): WordEntry => {
    const hash = fnv1a(`${seed}|${name}`);
    const index = (hash >>> (spec.id.length % 16)) % rows.length;
    return rows[index]!;
  };
  const textFresh = (entry: WordEntry) => !avoidText.has(normSentence(surface(entry, spec, reader)));
  for (const step of steps) {
    const fresh = step.rows.filter((entry) => !avoid.has(entry.id) && textFresh(entry));
    if (fresh.length > 0) return { entry: pickFrom(fresh, step.name), via: step.name };
  }
  for (const step of steps) {
    const unseen = step.rows.filter(textFresh);
    if (unseen.length > 0) return { entry: pickFrom(unseen, `${step.name}-repeat`), via: step.name };
  }
  for (const step of steps) {
    if (step.rows.length > 0) return { entry: pickFrom(step.rows, `${step.name}-text`), via: step.name };
  }
  return { entry: null, via: 'none' };
}

function surface(entry: WordEntry, spec: SlotSpec, reader: Reader): string {
  if (entry.pos === 'verb') {
    const form = neededVerbForm(spec, reader)!;
    return entry.forms![form];
  }
  const text = entry.text ?? '';
  if (entry.pos === 'noun' && spec.article === 'auto' && entry.article && entry.article !== 'none') {
    return `${entry.article} ${text}`;
  }
  return text;
}

function endingScore(ending: EndingSpec, reader: Reader): number | null {
  const facts = [reader.dominant, reader.secondary].filter((row): row is NonNullable<typeof row> => row != null);
  const when = ending.when;
  const bare = !when.trait && !when.tier && !when.alsoTrait && !when.alsoTier;
  if (bare) return 0;

  let score = 0;
  let used: (typeof facts)[number] | null = null;
  if (when.trait) {
    const hit = facts.find((fact) => fact.trait === when.trait && (!when.tier || fact.tier === when.tier));
    if (!hit) return null;
    used = hit;
    score += when.tier ? 2 : 1;
  } else if (when.tier) {
    if (reader.dominant.tier !== when.tier) return null;
    score += 1;
  }
  if (when.alsoTrait) {
    const hit = facts.find(
      (fact) => fact !== used && fact.trait === when.alsoTrait && (!when.alsoTier || fact.tier === when.alsoTier),
    );
    if (!hit) return null;
    score += when.alsoTier ? 2 : 1;
  }
  return score;
}

export function selectEnding(template: Template, reader: Reader, seed: string): EndingSpec | null {
  let best = -1;
  let tied: EndingSpec[] = [];
  for (const ending of template.endings) {
    const score = endingScore(ending, reader);
    if (score == null) continue;
    if (score > best) {
      best = score;
      tied = [ending];
    } else if (score === best) tied.push(ending);
  }
  if (tied.length === 0) return null;
  const index = fnv1a(`${seed}|ending`) % tied.length;
  return tied[index]!;
}

function pronounMap(reader: Reader): Record<string, string> {
  const name = reader.pronoun.id === 'you' ? 'You' : reader.name;
  const beName = reader.pronoun.id === 'you' ? 'are' : 'is';
  return {
    Name: name,
    beName,
    Subj: reader.pronoun.subjCap,
    subj: reader.pronoun.subj,
    poss: reader.pronoun.poss,
    obj: reader.pronoun.obj,
    be: reader.pronoun.be,
    have: reader.pronoun.have,
  };
}

function applyTokens(raw: string, tokens: Record<string, string>): string {
  return raw.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (whole, name: string) => (name in tokens ? tokens[name]! : whole));
}

function tidy(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function articleIssues(text: string): FillIssue[] {
  const issues: FillIssue[] = [];
  if (/\ba ([aeiou])/i.test(text)) issues.push({ code: 'article', detail: 'a before a vowel' });
  if (/\ban ([bcdfghjklmnpqrstvwxyz])/i.test(text)) issues.push({ code: 'article', detail: 'an before a consonant' });
  if (/\b(a|an|the) \1\b/i.test(text)) issues.push({ code: 'article', detail: 'doubled article' });
  return issues;
}

function bannedIssues(text: string): FillIssue[] {
  return BANNED_PATTERNS.filter((re) => re.test(text)).map((re) => ({
    code: 'banned' as const,
    detail: re.source,
  }));
}

function agreementIssues(text: string, reader: Reader, picks: { spec: SlotSpec; entry: WordEntry; said: string }[]): FillIssue[] {
  const issues: FillIssue[] = [];
  for (const pick of picks) {
    if (pick.spec.pos !== 'verb' || pick.spec.form !== 'agree') continue;
    const want = pick.entry.forms?.[reader.pronoun.verbForm];
    if (want && pick.said !== want) {
      issues.push({ code: 'agreement', detail: `${pick.spec.id} said "${pick.said}" for ${reader.pronoun.id}, wanted "${want}"` });
    }
  }
  // Content verbs are checked against the stored form above. A word like
  // "miss" is already the base, so a trailing -s is not a third-person mark.
  // Auxiliaries are not in the bank, so they are checked on the sentence.
  if (reader.pronoun.verbForm === 'base') {
    if (/\b(You|They) is\b/.test(text) || /\b(you|they) has\b/.test(text)) {
      issues.push({ code: 'agreement', detail: 'you/they used a singular auxiliary' });
    }
  } else if (/\b(She|He) are\b/.test(text) || /\b(she|he) have\b/.test(text)) {
    issues.push({ code: 'agreement', detail: 'she/he used a plural auxiliary' });
  }
  return issues;
}

export interface FillOptions {
  /** Entry ids to skip until every fresh pool is empty. */
  avoid?: readonly string[];
  /**
   * Sentences already used on this card. A slot skips them until every pool
   * is empty, so a closer cannot reprint the shows-up line.
   */
  avoidText?: readonly string[];
  /** When true, a draft entry or template is an issue. Shipping renders set this. */
  requireApproved?: boolean;
  /** Extra tokens such as `{legend}`. Pronouns and slot picks win on a clash. */
  tokens?: Record<string, string>;
}

export function fill(
  template: Template,
  reader: Reader,
  entries: readonly WordEntry[],
  seed: string,
  options: FillOptions = {},
): FillResult {
  const issues: FillIssue[] = [];
  const avoid = new Set(options.avoid ?? []);
  const avoidText = new Set((options.avoidText ?? []).map(normSentence));
  const locks = new Map<string, WordEntry>();
  const picks: Record<string, string> = {};
  const surfaces: Record<string, string> = {};
  const picked: { spec: SlotSpec; entry: WordEntry; said: string }[] = [];

  if (options.requireApproved && template.status !== 'approved') {
    issues.push({ code: 'unapproved', detail: template.id });
  }

  for (const spec of template.slots) {
    let entry = spec.lock ? locks.get(spec.lock) ?? null : null;
    if (!entry) {
      const selected = selectEntry(entries, spec, reader, seed, avoid, avoidText);
      entry = selected.entry;
      if (entry && spec.lock) locks.set(spec.lock, entry);
    }
    if (!entry) {
      issues.push({ code: 'empty-slot', detail: spec.id });
      surfaces[spec.id] = `{${spec.id}}`;
      continue;
    }
    if (options.requireApproved && entry.status !== 'approved') {
      issues.push({ code: 'unapproved', detail: entry.id });
    }
    const said = surface(entry, spec, reader);
    picks[spec.id] = entry.id;
    surfaces[spec.id] = said;
    picked.push({ spec, entry, said });
    avoid.add(entry.id);
    avoidText.add(normSentence(said));
  }

  const ending = template.body.includes('{ending}') ? selectEnding(template, reader, seed) : null;
  if (template.body.includes('{ending}') && !ending) {
    issues.push({ code: 'missing-ending', detail: template.id });
  }

  const tokens: Record<string, string> = {
    ...(options.tokens ?? {}),
    ...pronounMap(reader),
    ...surfaces,
    ending: ending ? ending.text : '',
  };
  let text = applyTokens(template.body, tokens);
  if (ending) text = applyTokens(text, tokens);
  text = tidy(text);

  if (/\{[A-Za-z][^}]*\}/.test(text)) {
    const leftover = text.match(/\{[A-Za-z][^}]*\}/g) ?? [];
    issues.push({ code: 'leftover', detail: leftover.join(' ') });
  }
  issues.push(...articleIssues(text), ...bannedIssues(text), ...agreementIssues(text, reader, picked));

  return { text, picks, endingId: ending?.id ?? null, issues };
}
