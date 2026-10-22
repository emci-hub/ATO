/**
 * Story Library prototype types.
 *
 * Self-contained. This folder does not import the app. Trait ids here are the
 * same strings as `TRAIT_AXES` in src/lib/traits.ts, and tiers are the same
 * bands as `traitBand` (low < 0.35, high >= 0.65, otherwise mid).
 */

export type Tier = 'low' | 'mid' | 'high';

export type Pos = 'verb' | 'adj' | 'noun' | 'phrase';

export type VerbForm = 'base' | 's' | 'ed' | 'ing';

export type NounNumber = 'singular' | 'plural';

/** What a slot asks for. `agree` picks base or -s from the subject pronoun. */
export type SlotForm = 'agree' | VerbForm | NounNumber | 'clause';

export type Tone = 'calm' | 'steady' | 'warm' | 'dry' | 'bright';

export type Intensity = 'soft' | 'plain' | 'sharp';

export type Article = 'a' | 'an' | 'the' | 'none';

export type Approval = 'draft' | 'validated' | 'approved';

export type StoryKind = 'insight' | 'legend' | 'explore' | 'play';

export interface VerbForms {
  base: string;
  s: string;
  ed: string;
  ing: string;
}

export interface PronounSet {
  id: 'you' | 'they' | 'she' | 'he';
  subj: string;
  subjCap: string;
  obj: string;
  poss: string;
  /** Present-tense be: you/they are, she/he is. */
  be: 'are' | 'is';
  /** Present-tense have: you/they have, she/he has. */
  have: 'have' | 'has';
  /** Content verbs from the bank: you/they use base, she/he use -s. */
  verbForm: 'base' | 's';
}

export interface WordEntry {
  id: string;
  pos: Pos;
  /** Surface text for adj, noun, and phrase. Verbs use `forms` instead. */
  text?: string;
  forms?: VerbForms;
  /** A real trait id, or `generic` for the fallback that always fits the frame. */
  trait: string | 'generic';
  tier: Tier | 'any';
  /**
   * The sentence frame this entry was written for. A slot only accepts an
   * entry with the same frame, so "laugh" cannot fall into "through the vault".
   */
  frame: string;
  tone: Tone;
  intensity: Intensity;
  article?: Article;
  number?: NounNumber;
  status: Approval;
}

export interface SlotSpec {
  id: string;
  pos: Pos;
  form: SlotForm;
  frame: string;
  /** Whose trait bank fills this slot. */
  trait: 'dominant' | 'secondary' | 'generic';
  /** Entry tone must be one of these. */
  tones: readonly Tone[];
  /** Entry intensity must be one of these. Omit to allow any. */
  intensities?: readonly Intensity[];
  /** Slots that share a lock reuse one entry for the whole story. */
  lock?: string;
  /** Nouns: `auto` prepends the entry's article. `none` uses the bare text. */
  article?: 'auto' | 'none';
}

export interface EndingWhen {
  trait?: string;
  tier?: Tier;
  alsoTrait?: string;
  alsoTier?: Tier;
}

export interface EndingSpec {
  id: string;
  /**
   * Every listed fact must match. An empty object is the fallback (score 0).
   * More matched facts beat fewer. A combo (trait + alsoTrait) beats a single trait.
   */
  when: EndingWhen;
  /** May use pronoun tokens and already-picked `{slotId}`s. */
  text: string;
}

export interface Template {
  id: string;
  kind: StoryKind;
  version: number;
  status: Approval;
  /** Readable backbone. Slots are `{slotId}`. See PRONOUN_TOKENS. */
  body: string;
  slots: SlotSpec[];
  endings: EndingSpec[];
}

export interface TraitFact {
  trait: string;
  tier: Tier;
}

export interface Reader {
  /** Proper name for third-person backbones. Ignored when the pronoun is `you`. */
  name: string;
  pronoun: PronounSet;
  dominant: TraitFact;
  /** Optional second trait. Verbs stay on the dominant; adjectives may use this. */
  secondary?: TraitFact;
}

export interface FillIssue {
  code: 'empty-slot' | 'missing-ending' | 'leftover' | 'banned' | 'article' | 'agreement' | 'unapproved' | 'gap';
  detail: string;
}

export interface FillResult {
  text: string;
  picks: Record<string, string>;
  endingId: string | null;
  issues: FillIssue[];
}

export interface StoryLibrary {
  version: string;
  templates: Template[];
  entries: WordEntry[];
}

/** Tokens the filler replaces. Slot ids must not use these names. */
export const PRONOUN_TOKENS = ['Name', 'beName', 'Subj', 'subj', 'poss', 'obj', 'be', 'have', 'ending'] as const;

export const BANNED_PATTERNS: readonly RegExp[] = [
  /\bTODO\b/i,
  /\blorem\b/i,
  /\bundefined\b/i,
  /\bnull\b/i,
  /\bnarcissist\b/i,
  /\byou are clearly\b/i,
  /\byou're so toxic\b/i,
];
