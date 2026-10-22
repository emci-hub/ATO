/**
 * Fill a backbone from the trait bank.
 *
 * Lookup for a slot, first pool that has anything:
 *   1. that trait + that tier
 *   2. that trait + any tier
 *   3. generic
 * A locked slot reuses the entry already chosen for that lock.
 * Endings: every ending whose facts all match is scored by how many facts it
 * named. The highest score wins. Ties break on a stable hash. The empty
 * `when` is the fallback and always matches at score 0.
 */
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
} from './types';

export const PRONOUNS: Record<PronounSet['id'], PronounSet> = {
  you: { id: 'you', subj: 'you', subjCap: 'You', obj: 'you', poss: 'your', be: 'are', have: 'have', verbForm: 'base' },
  they: { id: 'they', subj: 'they', subjCap: 'They', obj: 'them', poss: 'their', be: 'are', have: 'have', verbForm: 'base' },
  she: { id: 'she', subj: 'she', subjCap: 'She', obj: 'her', poss: 'her', be: 'is', have: 'has', verbForm: 's' },
  he: { id: 'he', subj: 'he', subjCap: 'He', obj: 'him', poss: 'his', be: 'is', have: 'has', verbForm: 's' },
};

export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function neededVerbForm(slot: SlotSpec, reader: Reader): VerbForm | null {
  if (slot.pos !== 'verb') return null;
  if (slot.form === 'agree') return reader.pronoun.verbForm;
  if (slot.form === 'base' || slot.form === 's' || slot.form === 'ed' || slot.form === 'ing') return slot.form;
  return null;
}

function traitOf(slot: SlotSpec, reader: Reader): { trait: string; tier: Reader['dominant']['tier'] | 'any' } {
  if (slot.trait === 'secondary' && reader.secondary) {
    return { trait: reader.secondary.trait, tier: reader.secondary.tier };
  }
  if (slot.trait === 'generic') return { trait: 'generic', tier: 'any' };
  return { trait: reader.dominant.trait, tier: reader.dominant.tier };
}

function formOk(entry: WordEntry, slot: SlotSpec, reader: Reader): boolean {
  if (entry.pos !== slot.pos || entry.frame !== slot.frame) return false;
  if (!slot.tones.includes(entry.tone)) return false;
  if (slot.intensities && !slot.intensities.includes(entry.intensity)) return false;
  if (entry.pos === 'verb') {
    const form = neededVerbForm(slot, reader);
    return form != null && Boolean(entry.forms?.[form]?.trim());
  }
  if (entry.pos === 'noun') {
    if (slot.form !== 'singular' && slot.form !== 'plural') return false;
    if (entry.number !== slot.form) return false;
    if (slot.article === 'auto' && !entry.article) return false;
    return Boolean(entry.text?.trim());
  }
  if (entry.pos === 'phrase') return slot.form === 'clause' && Boolean(entry.text?.trim());
  return slot.form === 'clause' && Boolean(entry.text?.trim());
}

/** Entries that are allowed to fill this slot, before the trait fallback ladder. */
export function compatible(entry: WordEntry, slot: SlotSpec, reader: Reader): boolean {
  return formOk(entry, slot, reader);
}

function ladder(entries: readonly WordEntry[], slot: SlotSpec, reader: Reader): { name: 'trait-tier' | 'trait-any' | 'generic'; rows: WordEntry[] }[] {
  const want = traitOf(slot, reader);
  const base = entries.filter((entry) => compatible(entry, slot, reader));
  const steps: { name: 'trait-tier' | 'trait-any' | 'generic'; pred: (entry: WordEntry) => boolean }[] = [
    { name: 'trait-tier', pred: (entry) => entry.trait === want.trait && entry.tier === want.tier },
    { name: 'trait-any', pred: (entry) => entry.trait === want.trait && entry.tier === 'any' },
    { name: 'generic', pred: (entry) => entry.trait === 'generic' },
  ];
  return steps.map((step) => ({ name: step.name, rows: base.filter(step.pred) }));
}

export function selectEntry(
  entries: readonly WordEntry[],
  slot: SlotSpec,
  reader: Reader,
  seed: string,
  avoid: ReadonlySet<string>,
): { entry: WordEntry | null; via: 'trait-tier' | 'trait-any' | 'generic' | 'none' } {
  const steps = ladder(entries, slot, reader);
  const pickFrom = (rows: WordEntry[], name: string): WordEntry => rows[fnv1a(`${seed}|${slot.id}|${name}`) % rows.length]!;
  for (const step of steps) {
    const fresh = step.rows.filter((entry) => !avoid.has(entry.id));
    if (fresh.length > 0) return { entry: pickFrom(fresh, step.name), via: step.name };
  }
  for (const step of steps) {
    if (step.rows.length > 0) return { entry: pickFrom(step.rows, `${step.name}-repeat`), via: step.name };
  }
  return { entry: null, via: 'none' };
}

function surface(entry: WordEntry, slot: SlotSpec, reader: Reader): string {
  if (entry.pos === 'verb') {
    const form = neededVerbForm(slot, reader)!;
    return entry.forms![form];
  }
  const text = entry.text ?? '';
  if (entry.pos === 'noun' && slot.article === 'auto' && entry.article && entry.article !== 'none') {
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
  const aVowel = /\ba ([aeiou])/gi;
  const anConsonant = /\ban ([bcdfghjklmnpqrstvwxyz])/gi;
  if (aVowel.test(text)) issues.push({ code: 'article', detail: 'a before a vowel' });
  if (anConsonant.test(text)) issues.push({ code: 'article', detail: 'an before a consonant' });
  if (/\b(a|an|the) \1\b/i.test(text)) issues.push({ code: 'article', detail: 'doubled article' });
  return issues;
}

function bannedIssues(text: string): FillIssue[] {
  return BANNED_PATTERNS.filter((re) => re.test(text)).map((re) => ({
    code: 'banned' as const,
    detail: re.source,
  }));
}

function agreementIssues(text: string, reader: Reader, picks: { slot: SlotSpec; entry: WordEntry; said: string }[]): FillIssue[] {
  const issues: FillIssue[] = [];
  for (const pick of picks) {
    if (pick.slot.pos !== 'verb' || pick.slot.form !== 'agree') continue;
    const want = pick.entry.forms?.[reader.pronoun.verbForm];
    if (want && pick.said !== want) {
      issues.push({ code: 'agreement', detail: `${pick.slot.id} said "${pick.said}" for ${reader.pronoun.id}, wanted "${want}"` });
    }
  }
  if (reader.pronoun.verbForm === 's' && /\b(they|you) (pauses|checks|dives|flinches|waits|nods|reads|grins|laughs|stops)\b/i.test(text)) {
    issues.push({ code: 'agreement', detail: 'plural or you paired with a third-person verb' });
  }
  if (reader.pronoun.verbForm === 'base' && /\b(she|he) (pause|check|dive|flinch|wait|nod|read|grin|laugh|stop) (when|for|before)\b/i.test(text)) {
    issues.push({ code: 'agreement', detail: 'she or he paired with a base verb' });
  }
  if (reader.pronoun.id === 'you' || reader.pronoun.id === 'they') {
    if (/\b(You|They) is\b/.test(text) || /\b(you|they) has\b/.test(text)) {
      issues.push({ code: 'agreement', detail: 'you/they used a singular auxiliary' });
    }
  } else if (/\b(She|He) are\b/.test(text) || /\b(she|he) have\b/.test(text)) {
    issues.push({ code: 'agreement', detail: 'she/he used a plural auxiliary' });
  }
  return issues;
}

export interface FillOptions {
  /** Entry ids to skip until the pool would otherwise be empty. */
  avoid?: readonly string[];
  /** When true, a draft entry or template is an issue. Shipping renders set this. */
  requireApproved?: boolean;
}

export function fill(template: Template, reader: Reader, entries: readonly WordEntry[], seed: string, options: FillOptions = {}): FillResult {
  const issues: FillIssue[] = [];
  const avoid = new Set(options.avoid ?? []);
  const locks = new Map<string, WordEntry>();
  const picks: Record<string, string> = {};
  const surfaces: Record<string, string> = {};
  const picked: { slot: SlotSpec; entry: WordEntry; said: string }[] = [];

  if (options.requireApproved && template.status !== 'approved') {
    issues.push({ code: 'unapproved', detail: template.id });
  }

  for (const slot of template.slots) {
    let entry = slot.lock ? locks.get(slot.lock) ?? null : null;
    if (!entry) {
      const selected = selectEntry(entries, slot, reader, seed, avoid);
      entry = selected.entry;
      if (entry && slot.lock) locks.set(slot.lock, entry);
    }
    if (!entry) {
      issues.push({ code: 'empty-slot', detail: slot.id });
      surfaces[slot.id] = `{${slot.id}}`;
      continue;
    }
    if (options.requireApproved && entry.status !== 'approved') {
      issues.push({ code: 'unapproved', detail: entry.id });
    }
    const said = surface(entry, slot, reader);
    picks[slot.id] = entry.id;
    surfaces[slot.id] = said;
    picked.push({ slot, entry, said });
    avoid.add(entry.id);
  }

  const ending = template.body.includes('{ending}') ? selectEnding(template, reader, seed) : null;
  if (template.body.includes('{ending}') && !ending) {
    issues.push({ code: 'missing-ending', detail: template.id });
  }

  const tokens: Record<string, string> = {
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
