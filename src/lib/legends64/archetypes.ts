import { POLE_COMBOS } from '@/lib/legends64/classify';

/**
 * Static archetype-name content for the 64-archetype system (core loop
 * redesign §4, docs/CORE_LOOP_REDESIGN_PLAN.md).
 *
 * Adapted from `docs/archive/LEGENDS_ARCHETYPES_DRAFT.md` — a captured
 * conversational design that already worked out this exact structure (64
 * codes, 8 core x 8 modifier, 6 skins, "Modifier + Core, no articles") and
 * the plan's own worked example ('People-First Creative Director') comes
 * from it. That file's own header says "conversational design only...
 * not signed off as final copy... needs another pass together first" —
 * so this content ships behind `LEGENDS64_COPY_REVIEWED = false` (same
 * `*_COPY_REVIEWED` gate convention as `sage-story.ts`/`category-batch.ts`)
 * until emci reads it, same as any other unreviewed copy per CLAUDE.md.
 *
 * A first draft of this file invented its own content instead of using the
 * archive draft, and used a per-code-family join style that read fine for
 * two skins but produced broken/run-on names for the other four (a review
 * pass caught it before ship). Adopting the archive draft's actual content
 * fixes this for real: every entry across all 6 skins is a short noun/
 * epithet phrase, so a single uniform "descriptor + role" join (see
 * `archetypeName` below) reads correctly for all 384 combinations — no
 * per-skin template needed.
 *
 * Revised 2026-09-09 per emci's content pass: several Modifier entries
 * from the archive draft were nouns (matching Core, which is always a
 * noun/role) rather than adjectives, which read fine alone but doubled up
 * grammatically once joined with a Core noun. Modifiers only (Cores are
 * untouched, already correct as nouns) were corrected to adjective forms
 * across gaming (all 8), anime (2), funny (3), and dark (2) — real and
 * godType were already adjectives, left as-is. This same pass also
 * resolved the earlier-flagged 'Senpai Senpai' collision (anime
 * core-code LHL vs. modifier-code LLH): LLH's modifier is now 'Deadpan'
 * (was 'Watchful' until the 2026-10-09 name formula), not a repeated word.
 */

/**
 * Name styles v2 (emci, 2026-10-05): Plain ('real') became Primal Genius
 * ('primal', the new default), and High Fantasy, Corporate Realist and
 * Oxymoron were added. Primal Genius, Corporate Realist and Oxymoron are
 * THREE words: the extra word comes from Growth x Composure x Playfulness
 * (THIRD_WORDS below). Every word is still earned from three traits. A saved
 * 'real' choice is no longer a style, so it opens as the default.
 */
export type LegendSkin =
  | 'primal'
  | 'gaming'
  | 'godType'
  | 'anime'
  | 'funny'
  | 'dark'
  | 'highFantasy'
  | 'corporate'
  | 'oxymoron';

export const LEGEND_SKINS: readonly LegendSkin[] = [
  'primal',
  'highFantasy',
  'corporate',
  'oxymoron',
  'gaming',
  'godType',
  'anime',
  'funny',
  'dark',
];

/**
 * The new words are draft until emci reads them (the six older styles were
 * approved 2026-10-02, LEGENDS64_COPY_REVIEWED below).
 */
export const NAME_STYLES_V2_COPY_REVIEWED = false;

export function isLegendSkin(value: unknown): value is LegendSkin {
  return typeof value === 'string' && (LEGEND_SKINS as readonly string[]).includes(value);
}

export const DEFAULT_LEGEND_SKIN: LegendSkin = 'primal';

/** Unreviewed — see this file's header. Gate any UI render on this, matching sage-story.ts/category-batch.ts's convention. */
// emci approved 2026-10-02, with 13 words replaced in the funny, dark and
// anime styles (names that stung on a share card, slang that dates, and
// untranslated terms). The names now show on the identity card and share image.
// Back to draft 2026-10-09: the name formula replaced words in every style.
export const LEGENDS64_COPY_REVIEWED = false;

type PoleComboMap = Readonly<Record<string, string>>;
type SkinMap = Readonly<Record<LegendSkin, PoleComboMap>>;

/**
 * Core role word, per skin, per 3-letter code (conscientiousness x
 * extraversion x openness — see classify.ts's CORE_AXES order; matches
 * the archive draft's C-E-O code order exactly, so HHH here = draft's
 * 'CEO', LHH = draft's 'cEO', etc.).
 */
export const CORE_ROLES: SkinMap = {
  primal: {
    HHH: 'Ringmaster',
    HHL: 'Captain',
    HLH: 'Tinkerer',
    HLL: 'Archivist',
    LHH: 'Artist',
    LHL: 'Host',
    LLH: 'Poet',
    LLL: 'Hermit',
  },
  highFantasy: {
    HHH: 'Guildmaster',
    HHL: 'Knight',
    HLH: 'Wizard',
    HLL: 'Scribe',
    LHH: 'Bard',
    LHL: 'Innkeeper',
    LLH: 'Druid',
    LLL: 'Hermit',
  },
  corporate: {
    HHH: 'Director',
    HHL: 'Manager',
    HLH: 'Strategist',
    HLL: 'Analyst',
    LHH: 'Creative',
    LHL: 'Networker',
    LLH: 'Freelancer',
    LLL: 'Contractor',
  },
  oxymoron: {
    HHH: 'Leader',
    HHL: 'Boss',
    HLH: 'Inventor',
    HLL: 'Planner',
    LHH: 'Showrunner',
    LHL: 'Host',
    LLH: 'Writer',
    LLL: 'Drifter',
  },
  // Team roles, never "Boss" (emci, 2026-10-09).
  gaming: {
    HHH: 'Raid Leader',
    HHL: 'Squad Captain',
    HLH: 'Theorycrafter',
    HLL: 'Main Tank',
    LHH: 'Shot Caller',
    LHL: 'Healer',
    LLH: 'Scout',
    LLL: 'Benchwarmer',
  },
  // Mythic reads "The {role} Who {verb}" (see composeName).
  godType: {
    HHH: 'Herald',
    HHL: 'Sovereign',
    HLH: 'Forgemaster',
    HLL: 'Artisan',
    LHH: 'Reveler',
    LHL: 'Hearthkeeper',
    LLH: 'Oracle',
    LLL: 'Hermit',
  },
  anime: {
    HHH: 'Hero',
    HHL: 'Class President',
    HLH: 'Prodigy',
    HLL: 'Honor Student',
    LHH: 'Sidekick',
    LHL: 'Senpai',
    LLH: 'Transfer Student',
    LLL: 'Ronin',
  },
  funny: {
    HHH: 'Main Character',
    HHL: 'Designated Driver',
    HLH: 'Mad Scientist',
    HLL: 'Hall Monitor',
    LHH: 'Plus-One',
    LHL: 'Mom Friend',
    LLH: 'Tab Collector',
    LLL: 'Homebody',
  },
  dark: {
    HHH: 'Conqueror',
    HHL: 'Tyrant',
    HLH: 'Necromancer',
    HLL: 'Gravekeeper',
    LHH: 'Puppet Master',
    LHL: 'Ringleader',
    LLH: 'Heretic',
    LLL: 'Reaper',
  },
};

/**
 * Modifier descriptor word, per skin, per 3-letter code (agreeableness x
 * conflict_assertiveness x relatedness — see classify.ts's MODIFIER_AXES
 * order; matches the archive draft's A-S-R code order, so HHH here =
 * draft's 'ASR', LHH = draft's 'aSR', etc.). Always how a person acts, never
 * a fancy adjective, never a private trait (no Watchful, Private, Silent).
 * Mythic holds a verb ("The Herald Who Listens").
 */
export const MODIFIER_DESCRIPTORS: SkinMap = {
  primal: {
    HHH: 'Warm',
    HHL: 'Breezy',
    HLH: 'Gentle',
    HLL: 'Dreamy',
    LHH: 'Fierce',
    LHL: 'Stubborn',
    LLH: 'Dry-Witted',
    LLL: 'Stoic',
  },
  highFantasy: {
    HHH: 'Big-Hearted',
    HHL: 'Silver-Tongued',
    HLH: 'Soft-Spoken',
    HLL: 'Starry-Eyed',
    LHH: 'Bold',
    LHL: 'Iron-Willed',
    LLH: 'Wry',
    LLL: 'Unfazed',
  },
  corporate: {
    HHH: 'Optimistic',
    HHL: 'Chill',
    HLH: 'Agreeable',
    HLL: 'Easygoing',
    LHH: 'Blunt',
    LHL: 'Unfiltered',
    LLH: 'Skeptical',
    LLL: 'Heads-Down',
  },
  // Always the SOFT half of the paradox, so every name contradicts.
  oxymoron: {
    HHH: 'Polite',
    HHL: 'Cheerful',
    HLH: 'Gentle',
    HLL: 'Mellow',
    LHH: 'Friendly',
    LHL: 'Low-Key',
    LLH: 'Shy',
    LLL: 'Quiet',
  },
  gaming: {
    HHH: 'Wholesome',
    HHL: 'Upbeat',
    HLH: 'Patient',
    HLL: 'Laid-Back',
    LHH: 'Trash-Talking',
    LHL: 'Blunt',
    LLH: 'Deadpan',
    LLL: 'Unbothered',
  },
  godType: {
    HHH: 'Cheers',
    HHL: 'Laughs',
    HLH: 'Listens',
    HLL: 'Daydreams',
    LHH: 'Charges',
    LHL: 'Insists',
    LLH: 'Smirks',
    LLL: 'Shrugs',
  },
  anime: {
    HHH: 'Prickly-Sweet',
    HHL: 'Genki',
    HLH: 'Shy',
    HLL: 'Dreamy',
    LHH: 'Protective',
    LHL: 'Effortless',
    LLH: 'Deadpan',
    LLL: 'Cool-Headed',
  },
  funny: {
    HHH: 'Charming',
    HHL: 'Unbothered',
    HLH: 'Soft',
    HLL: 'Easy-Breezy',
    LHH: 'Scorekeeping',
    LHL: 'No-Filter',
    LLH: 'Side-Eye',
    LLL: 'Thumbs-Up',
  },
  dark: {
    HHH: 'Beloved',
    HHL: 'Alluring',
    HLH: 'Sympathetic',
    HLL: 'Elegant',
    LHH: 'Relentless',
    LHL: 'Unapologetic',
    LLH: 'Sinister',
    LLL: 'Cold-Blooded',
  },
};

/**
 * The third word, per three-word style, per 3-letter code (growth_mindset x
 * steadiness x playfulness — classify.ts THIRD_AXES order).
 * Primal Genius: a primal need or physical state. Corporate Realist: a work
 * habit (opt-in only — a person sees it only by picking that style).
 * Oxymoron: always the SHARP half of the paradox. Never a word that reads as
 * a struggle (low steadiness / growth are private leans).
 */
export const THIRD_WORDS: Readonly<Partial<Record<LegendSkin, PoleComboMap>>> = {
  primal: {
    HHH: 'Caffeinated',
    HHL: 'Hungry',
    HLH: 'Sugar-High',
    HLL: 'Early-Rising',
    LHH: 'Sun-Warmed',
    LHL: 'Well-Rested',
    LLH: 'Barefoot',
    LLL: 'Nocturnal',
  },
  corporate: {
    HHH: 'Podcast-Fed',
    HHL: 'Upskilling',
    HLH: 'Double-Shot',
    HLL: 'Deep-Work',
    LHH: 'Long-Lunch',
    LHL: 'Nine-to-Five',
    LLH: 'Meme-Sharing',
    LLL: 'Reply-All',
  },
  oxymoron: {
    HHH: 'Anarchist',
    HHL: 'Overachiever',
    HLH: 'Firestarter',
    HLL: 'Mastermind',
    LHH: 'Troublemaker',
    LHL: 'Hardliner',
    LLH: 'Wildcard',
    LLL: 'Outlaw',
  },
};

/** Whether a style is three words (it needs the third code to be finished). */
export function isThreeWordSkin(skin: LegendSkin): boolean {
  return THIRD_WORDS[skin] != null;
}

/**
 * Puts the parts in the style's own order (null = not settled yet, shown as
 * "…"). Primal Genius and Corporate Realist: third + descriptor + role
 * ("Hungry Stoic Archivist"). Oxymoron: soft descriptor + sharp third + role
 * ("Polite Anarchist Leader"). Mythic: "The {role} Who {verb}" ("The Herald
 * Who Listens"). Other styles: descriptor + role.
 */
export function composeName(
  skin: LegendSkin,
  parts: { third: string | null; descriptor: string | null; role: string | null },
): (string | null)[] {
  if (skin === 'godType') return ['The', parts.role, 'Who', parts.descriptor];
  if (!isThreeWordSkin(skin)) return [parts.descriptor, parts.role];
  if (skin === 'oxymoron') return [parts.descriptor, parts.third, parts.role];
  return [parts.third, parts.descriptor, parts.role];
}

/** Splits a full code ('HHH-LHL') into its core and modifier halves. */
export function splitArchetypeCode(code: string): { core: string; modifier: string } | null {
  const parts = code.split('-');
  if (parts.length !== 2) return null;
  const [core, modifier] = parts;
  if (!core || !modifier) return null;
  if (!POLE_COMBOS.includes(core) || !POLE_COMBOS.includes(modifier)) return null;
  return { core, modifier };
}

/**
 * Resolves the display name for a full archetype code under a given skin:
 * "descriptor + role, no articles" (the archive draft's own rule), e.g.
 * archetypeName('LHH-LHH', 'highFantasy') === 'Bold Bard', and with a third
 * code archetypeName('LHH-HHH', 'primal', 'HHL') === 'Hungry Warm Artist'. Returns null for an invalid code or an
 * unrecognized skin — callers should treat that as a data bug, not a
 * silent fallback (use `isLegendSkin` to validate a persisted/user-chosen
 * skin value before calling this, since an unvalidated runtime string
 * would otherwise need a try/catch here instead of a clean null).
 */
export function archetypeName(code: string, skin: LegendSkin, third3?: string): string | null {
  if (!isLegendSkin(skin)) return null;
  const split = splitArchetypeCode(code);
  if (!split) return null;
  const descriptor = MODIFIER_DESCRIPTORS[skin][split.modifier];
  const role = CORE_ROLES[skin][split.core];
  if (!descriptor || !role) return null;
  // A three-word style with a third code gets its third word; without one
  // (the Legends tab only knows the 64 codes) it reads as two words.
  const third = third3 && POLE_COMBOS.includes(third3) ? (THIRD_WORDS[skin]?.[third3] ?? null) : null;
  return composeName(skin, { third, descriptor, role })
    .filter((part): part is string => part != null)
    .join(' ');
}
