import { POLE_COMBOS } from '@/lib/legends64/classify';

/**
 * Static archetype-name content for the 64-archetype system (core loop
 * redesign §4, docs/CORE_LOOP_REDESIGN_PLAN.md).
 *
 * Name styles v5 (emci, 2026-10-12): per-style templates, no shared token
 * across styles, Legendary ★ overrides on the all-High (all-Low for Mythic
 * and Anime) combo. Word banks and templates are pinned by `check:legends64`
 * against `ato-titles-v5.csv`. A saved style id is unchanged — titles
 * recompute from locked codes, so no save migration.
 *
 * Name styles v2 (emci, 2026-10-05): Plain ('real') became Primal Genius
 * ('primal', the new default), and High Fantasy, Corporate Realist and
 * Oxymoron were added. Primal Genius, Corporate Realist and Oxymoron still
 * earn a third word from Growth x Composure x Playfulness (THIRD_WORDS).
 * A saved 'real' choice is no longer a style, so it opens as the default.
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
 * The words in the four newer styles. emci approved them 2026-10-09 with the
 * name formula; v5 (2026-10-12) replaced the banks and templates.
 */
export const NAME_STYLES_V2_COPY_REVIEWED = true;

export function isLegendSkin(value: unknown): value is LegendSkin {
  return typeof value === 'string' && (LEGEND_SKINS as readonly string[]).includes(value);
}

export const DEFAULT_LEGEND_SKIN: LegendSkin = 'primal';

/** Unreviewed — see this file's header. Gate any UI render on this, matching sage-story.ts/category-batch.ts's convention. */
// emci approved 2026-10-02, with 13 words replaced in the funny, dark and
// anime styles. The 2026-10-09 name formula replaced words in every style.
// v5 (2026-10-12) is the approved fun pass: new templates + banks + Legendary ★.
export const LEGENDS64_COPY_REVIEWED = true;

type PoleComboMap = Readonly<Record<string, string>>;
type SkinMap = Readonly<Record<LegendSkin, PoleComboMap>>;

/**
 * Core role word, per skin, per 3-letter code (conscientiousness x
 * extraversion x openness — see classify.ts's CORE_AXES order).
 */
export const CORE_ROLES: SkinMap = {
  primal: {
    HHH: 'Pathfinder',
    HHL: 'Wrangler',
    HLH: 'Tinkerer',
    HLL: 'Fossil Fan',
    LHH: 'Muralist',
    LHL: 'Crooner',
    LLH: 'Stargazer',
    LLL: 'Burrower',
  },
  highFantasy: {
    HHH: 'Paladin',
    HHL: 'Knight-Errant',
    HLH: 'Wizard',
    HLL: 'Scribe',
    LHH: 'Bard',
    LHL: 'Innkeeper',
    LLH: 'Druid',
    LLL: 'Truffle-Hunter',
  },
  corporate: {
    HHH: 'Founder',
    HHL: 'Scheduler',
    HLH: 'Strategist',
    HLL: 'Quant',
    LHH: 'Creative',
    LHL: 'Schmoozer',
    LLH: 'Consultant',
    LLL: 'Contractor',
  },
  oxymoron: {
    HHH: 'Ambassador',
    HHL: 'Enforcer',
    HLH: 'Inventor',
    HLL: 'Tactician',
    LHH: 'Impresario',
    LHL: 'Emcee',
    LLH: 'Poet',
    LLL: 'Loafer',
  },
  // Team roles, never "Boss" (emci, 2026-10-09).
  gaming: {
    HHH: 'Raid Leader',
    HHL: 'Lobby Host',
    HLH: 'Theorycrafter',
    HLL: 'Frontline Tank',
    LHH: 'Shot Caller',
    LHL: 'Pocket Healer',
    LLH: 'Speedrunner',
    LLL: 'Side-Quest NPC',
  },
  // Mythic reads "The {role} Who {verb}" (see composeName).
  godType: {
    HHH: 'Storm-Herald',
    HHL: 'Oathbinder',
    HLH: 'Artificer',
    HLL: 'Weaver',
    LHH: 'Reveler',
    LHL: 'Hearth-Warden',
    LLH: 'Oracle',
    LLL: 'Mist-Walker',
  },
  anime: {
    HHH: 'Chosen One',
    HHL: 'Council President',
    HLH: 'Rival',
    HLL: 'Library Ghost',
    LHH: 'Comic Relief',
    LHL: 'Club Captain',
    LLH: 'Transfer Student',
    LLL: 'Background Extra',
  },
  funny: {
    HHH: 'Main Character',
    HHL: 'Designated Driver',
    HLH: 'Mad Scientist',
    HLL: 'Hall Monitor',
    LHH: 'Party Crasher',
    LHL: 'Mom Friend',
    LLH: 'Group-Chat Lurker',
    LLL: 'Homebody',
  },
  dark: {
    HHH: 'Conqueror',
    HHL: 'Dread Tyrant',
    HLH: 'Necromancer',
    HLL: 'Crypt Curator',
    LHH: 'Puppeteer',
    LHL: 'Warlock',
    LLH: 'Heretic',
    LLL: 'Reaper',
  },
};

/**
 * Modifier slot, per skin, per 3-letter code (agreeableness x
 * conflict_assertiveness x relatedness — classify.ts MODIFIER_AXES).
 * How a person acts in most styles; High Fantasy holds a place
 * (`{Role} of the {Place}`); Mythic holds a verb; Dark holds the epithet
 * (`{Role} the {Epithet}`).
 */
export const MODIFIER_DESCRIPTORS: SkinMap = {
  primal: {
    HHH: 'Grinning',
    HHL: 'Breezy',
    HLH: 'Snuggly',
    HLL: 'Moonstruck',
    LHH: 'Fierce',
    LHL: 'Stubborn',
    LLH: 'Dry-Witted',
    LLL: 'Stoic',
  },
  highFantasy: {
    HHH: 'Tavern',
    HHL: 'Court',
    HLH: 'Glade',
    HLL: 'Stars',
    LHH: 'Vanguard',
    LHL: 'Anvil',
    LLH: 'Riddles',
    LLL: 'Moors',
  },
  corporate: {
    HHH: 'Visionary',
    HHL: 'Win-Win',
    HLH: 'On-Brand',
    HLL: 'Documented',
    LHH: 'Disruptive',
    LHL: 'Escalating',
    LLH: 'Contrarian',
    LLL: 'Async',
  },
  // Always the SOFT half of the paradox, so every name contradicts.
  oxymoron: {
    HHH: 'Polite',
    HHL: 'Cheerful',
    HLH: 'Huggable',
    HLL: 'Mellow',
    LHH: 'Friendly',
    LHL: 'Low-Key',
    LLH: 'Bashful',
    LLL: 'Whispering',
  },
  gaming: {
    HHH: 'MVP',
    HHL: 'Hype',
    HLH: 'Clutch',
    HLL: 'Stealth-Mode',
    LHH: 'Tryhard',
    LHL: 'Salty',
    LLH: 'Min-Maxing',
    LLL: 'Solo-Queue',
  },
  godType: {
    HHH: 'Rallies',
    HHL: 'Bargains',
    HLH: 'Listens',
    HLL: 'Wonders',
    LHH: 'Charges',
    LHL: 'Haggles',
    LLH: 'Smirks',
    LLL: 'Vanishes',
  },
  anime: {
    HHH: 'Secretly-Sweet',
    HHL: 'Sunshine',
    HLH: 'Ice-Cool',
    HLL: 'Daydreaming',
    LHH: 'Ride-or-Die',
    LHL: 'Unstoppable',
    LLH: 'Mysterious',
    LLL: 'Lone-Wolf',
  },
  funny: {
    HHH: 'Smooth-Talking',
    HHL: 'Snack-Bringing',
    HLH: 'Overthinking',
    HLL: 'Playlist-Hogging',
    LHH: 'Receipt-Saving',
    LHL: 'No-Filter',
    LLH: 'Eyebrow-Raising',
    LLL: 'Emoji-Only',
  },
  dark: {
    HHH: 'Adored',
    HHL: 'Alluring',
    HLH: 'Velvet-Gloved',
    HLL: 'Elegant',
    LHH: 'Relentless',
    LHL: 'Unrepentant',
    LLH: 'Sinister',
    LLL: 'Cold-Blooded',
  },
};

/**
 * The third word, per three-word style, per 3-letter code (growth_mindset x
 * steadiness x playfulness — classify.ts THIRD_AXES order).
 * Primal Genius: a physical state after the comma. Corporate Realist: a noun
 * domain (`{Describer} {Role} of {Domain}`). Oxymoron: always the SHARP half.
 */
export const THIRD_WORDS: Readonly<Partial<Record<LegendSkin, PoleComboMap>>> = {
  primal: {
    HHH: 'Caffeinated',
    HHL: 'Hungry',
    HLH: 'Sugar-High',
    HLL: 'Dawn-Ready',
    LHH: 'Sun-Warmed',
    LHL: 'Well-Rested',
    LLH: 'Barefoot',
    LLL: 'Nocturnal',
  },
  corporate: {
    HHH: 'Synergy',
    HHL: 'KPIs',
    HLH: 'Inboxes',
    HLL: 'Focus',
    LHH: 'Pivots',
    LHL: 'Overtime',
    LLH: 'Memes',
    LLL: 'Pings',
  },
  oxymoron: {
    HHH: 'Anarchist',
    HHL: 'Overachiever',
    HLH: 'Firestarter',
    HLL: 'Kingpin',
    LHH: 'Troublemaker',
    LHL: 'Hardliner',
    LLH: 'Wildcard',
    LLL: 'Outlaw',
  },
};

/**
 * Rare override when every used code is all-High (all-Low for Mythic and
 * Anime). 1 of 64 in a two-word style, 1 of 512 in a three-word style.
 */
export const LEGENDARY_POLE: Readonly<Record<LegendSkin, 'HHH' | 'LLL'>> = {
  primal: 'HHH',
  highFantasy: 'HHH',
  corporate: 'HHH',
  oxymoron: 'HHH',
  gaming: 'HHH',
  godType: 'LLL',
  anime: 'LLL',
  funny: 'HHH',
  dark: 'HHH',
};

export const LEGENDARY_TITLES: Readonly<Record<LegendSkin, string>> = {
  primal: 'Pure Sunbeam Energy',
  highFantasy: 'Prophesied Dragon-Tamer',
  corporate: 'Employee of Every Month',
  oxymoron: 'Courteous Apocalypse',
  gaming: 'Undisputed Final Boss',
  godType: 'The Rumor Who Lingers',
  anime: 'Mid-Credits Twist',
  funny: 'Plot Armor Personified',
  dark: 'Beloved Doom Incarnate',
};

/** Whether a style is three words (it needs the third code to be finished). */
export function isThreeWordSkin(skin: LegendSkin): boolean {
  return THIRD_WORDS[skin] != null;
}

/**
 * Legendary ★ title when every code the style uses is the all-High combo
 * (all-Low for Mythic and Anime). Three-word styles need the third code too;
 * without it the regular template still fills in.
 */
export function legendaryName(
  skin: LegendSkin,
  core: string | null | undefined,
  modifier: string | null | undefined,
  third?: string | null,
): string | null {
  if (!isLegendSkin(skin)) return null;
  const pole = LEGENDARY_POLE[skin];
  if (core !== pole || modifier !== pole) return null;
  if (isThreeWordSkin(skin) && third !== pole) return null;
  return LEGENDARY_TITLES[skin];
}

/**
 * Puts the parts in the style's own order (null = not settled yet, shown as
 * "…"). Templates (v5):
 * - Primal: `{Describer} {Role}, {Extra}`
 * - High Fantasy: `{Role} of the {Place}`
 * - Corporate: `{Describer} {Role} of {Domain}`
 * - Oxymoron: `{Soft} {Sharp} {Role}`
 * - Mythic: `The {Role} Who {Verb}`
 * - Dark: `{Role} the {Epithet}`
 * - Gaming, Anime, Funny: `{Describer} {Role}`
 */
export function composeName(
  skin: LegendSkin,
  parts: { third: string | null; descriptor: string | null; role: string | null },
): (string | null)[] {
  if (skin === 'godType') return ['The', parts.role, 'Who', parts.descriptor];
  if (skin === 'dark') return [parts.role, 'the', parts.descriptor];
  if (skin === 'highFantasy') return [parts.role, 'of the', parts.descriptor];
  if (skin === 'primal') return [parts.descriptor, parts.role, parts.third];
  if (skin === 'corporate') return [parts.descriptor, parts.role, 'of', parts.third];
  if (skin === 'oxymoron') return [parts.descriptor, parts.third, parts.role];
  return [parts.descriptor, parts.role];
}

/** Join composed parts for a finished title (drop empty slots and their template words). */
export function joinCompleteName(skin: LegendSkin, parts: readonly (string | null)[]): string {
  if (skin === 'primal') {
    const [descriptor, role, extra] = parts;
    if (descriptor && role && extra) return `${descriptor} ${role}, ${extra}`;
    return [descriptor, role, extra].filter((part): part is string => part != null).join(' ');
  }
  if (skin === 'corporate' && parts[3] == null) {
    return [parts[0], parts[1]].filter((part): part is string => part != null).join(' ');
  }
  return parts.filter((part): part is string => part != null).join(' ');
}

/** Join composed parts while letters are still locking in (missing words are "…"). */
export function joinFormingName(skin: LegendSkin, parts: readonly (string | null)[]): string {
  if (skin === 'primal') {
    return `${parts[0] ?? '…'} ${parts[1] ?? '…'}, ${parts[2] ?? '…'}`;
  }
  return parts
    .map((part) => part ?? '…')
    .filter((part, i, all) => !(part === '…' && all[i - 1] === '…'))
    .join(' ');
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
 * Resolves the display name for a full archetype code under a given skin.
 * Legendary ★ fires only when every code the style uses is the all-High
 * (all-Low for Mythic and Anime) combo. A three-word style without a third
 * code reads as two words (the Legends tab only knows the 64 codes).
 * Returns null for an invalid code or an unrecognized skin.
 */
export function archetypeName(code: string, skin: LegendSkin, third3?: string): string | null {
  if (!isLegendSkin(skin)) return null;
  const split = splitArchetypeCode(code);
  if (!split) return null;
  const descriptor = MODIFIER_DESCRIPTORS[skin][split.modifier];
  const role = CORE_ROLES[skin][split.core];
  if (!descriptor || !role) return null;
  const third = third3 && POLE_COMBOS.includes(third3) ? (THIRD_WORDS[skin]?.[third3] ?? null) : null;
  const legendary = legendaryName(skin, split.core, split.modifier, third3 && POLE_COMBOS.includes(third3) ? third3 : null);
  if (legendary) return legendary;
  return joinCompleteName(skin, composeName(skin, { third, descriptor, role }));
}
