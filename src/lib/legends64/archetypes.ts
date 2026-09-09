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
 * core-code LHL vs. modifier-code LLH): LLH's modifier is now 'Watchful',
 * so code 'LHL-LLH' composes to 'Watchful Senpai', not a repeated word.
 */

export type LegendSkin = 'real' | 'gaming' | 'godType' | 'anime' | 'funny' | 'dark';

export const LEGEND_SKINS: readonly LegendSkin[] = [
  'real',
  'gaming',
  'godType',
  'anime',
  'funny',
  'dark',
];

export function isLegendSkin(value: unknown): value is LegendSkin {
  return typeof value === 'string' && (LEGEND_SKINS as readonly string[]).includes(value);
}

export const DEFAULT_LEGEND_SKIN: LegendSkin = 'real';

/** Unreviewed — see this file's header. Gate any UI render on this, matching sage-story.ts/category-batch.ts's convention. */
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
  real: {
    HHH: 'Founder',
    HHL: 'Executive',
    HLH: 'Inventor',
    HLL: 'Specialist',
    LHH: 'Creative Director',
    LHL: 'Account Manager',
    LLH: 'Consultant',
    LLL: 'Freelancer',
  },
  gaming: {
    HHH: 'Vanguard',
    HHL: 'Warlord',
    HLH: 'Artificer',
    HLL: 'Engineer',
    LHH: 'Bard',
    LHL: 'Ranger',
    LLH: 'Mystic',
    LLL: 'Wanderer',
  },
  godType: {
    HHH: 'Herald',
    HHL: 'Sovereign',
    HLH: 'Forgemaster',
    HLL: 'Artisan',
    LHH: 'Reveler',
    LHL: 'Hearthkeeper',
    LLH: 'Oracle',
    LLL: 'Wildkeeper',
  },
  anime: {
    HHH: 'Hot-Blooded Hero',
    HHL: 'Class President',
    HLH: 'Genius Loner',
    HLL: 'Silent Ace',
    LHH: 'Wildcard Sidekick',
    LHL: 'Senpai',
    LLH: 'Dreaming Outsider',
    LLL: 'Ronin',
  },
  funny: {
    HHH: 'Main Character',
    HHL: 'Group Chat CEO',
    HLH: 'Mad Scientist',
    HLL: 'Spreadsheet Goblin',
    LHH: 'Feral Party Gremlin',
    LHL: 'Group Mom Friend',
    LLH: '3AM Thoughts Poster',
    LLL: 'Airplane Mode Icon',
  },
  dark: {
    HHH: 'Conqueror',
    HHL: 'Usurper',
    HLH: 'Necromancer',
    HLL: 'Gravekeeper',
    LHH: 'Trickster Fiend',
    LHL: 'Cult Leader',
    LLH: 'Wandering Ghost',
    LLL: 'Reaper',
  },
};

/**
 * Modifier descriptor word, per skin, per 3-letter code (agreeableness x
 * conflict_assertiveness x relatedness — see classify.ts's MODIFIER_AXES
 * order; matches the archive draft's A-S-R code order, so HHH here =
 * draft's 'ASR', LHH = draft's 'aSR', etc.).
 */
export const MODIFIER_DESCRIPTORS: SkinMap = {
  real: {
    HHH: 'People-First',
    HHL: 'Self-Made',
    HLH: 'Team-Oriented',
    HLL: 'Independent',
    LHH: 'Results-Driven',
    LHL: 'Self-Reliant',
    LLH: 'Behind-the-Scenes',
    LLL: 'Low-Key',
  },
  gaming: {
    HHH: 'Healing',
    HHL: 'Valiant',
    HLH: 'Supportive',
    HLL: 'Sylvan',
    LHH: 'Fierce',
    LHL: 'Untamed',
    LLH: 'Vigilant',
    LLL: 'Elusive',
  },
  godType: {
    HHH: 'Devoted',
    HHL: 'Radiant',
    HLH: 'Gentle',
    HLL: 'Serene',
    LHH: 'Vengeful',
    LHL: 'Unbending',
    LLH: 'Veiled',
    LLL: 'Solitary',
  },
  anime: {
    HHH: 'Tsundere',
    HHL: 'Genki',
    HLH: 'Dandere',
    HLL: 'Kuudere',
    LHH: 'Protective',
    LHL: 'Kakkoii',
    LLH: 'Watchful',
    LLL: 'Mysterious',
  },
  funny: {
    HHH: 'Rizzy',
    HHL: 'Unbothered',
    HLH: 'Soft',
    HLL: 'Cozy',
    LHH: 'Petty',
    LHL: 'Savage',
    LLH: 'Judgy',
    LLL: 'MIA',
  },
  dark: {
    HHH: 'Beloved',
    HHL: 'Alluring',
    HLH: 'Sympathetic',
    HLL: 'Elegant',
    LHH: 'Ruthless',
    LHL: 'Unrepentant',
    LLH: 'Silent',
    LLL: 'Shadowy',
  },
};

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
 * archetypeName('LHH-HHH', 'real') === 'People-First Creative Director'
 * (the plan's own worked example). Returns null for an invalid code or an
 * unrecognized skin — callers should treat that as a data bug, not a
 * silent fallback (use `isLegendSkin` to validate a persisted/user-chosen
 * skin value before calling this, since an unvalidated runtime string
 * would otherwise need a try/catch here instead of a clean null).
 */
export function archetypeName(code: string, skin: LegendSkin): string | null {
  if (!isLegendSkin(skin)) return null;
  const split = splitArchetypeCode(code);
  if (!split) return null;
  const descriptor = MODIFIER_DESCRIPTORS[skin][split.modifier];
  const role = CORE_ROLES[skin][split.core];
  if (!descriptor || !role) return null;
  return `${descriptor} ${role}`;
}
