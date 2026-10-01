/**
 * Pet eggs, grades, shiny and trade-up (2026-09-30) — pure rules, no React.
 *
 *   - Three eggs (Knight / Wizard / Village), each with a themed hero pool.
 *     The HERO is an even split within the chosen egg.
 *   - The GRADE (Common / Rare / Epic / Legendary) is rolled per pet, not per
 *     hero (like Marvel Snap variants), from the care band at Child:
 *     Poor 70/22/6/2 · Good 60/27/9/4 · Great 50/31/13/6 · Perfect 42/34/16/8.
 *   - SHINY is a separate 1-in-50 roll that stacks with any grade.
 *   - All three come from ONE seed stored when the egg is chosen, and are
 *     locked when the pet reaches Child: reopening the app, the clock or aging
 *     again can never reroll them. The odds shown are `gradeOdds` /
 *     `heroOdds` — the same functions `rollPet` uses.
 *   - Grade and shiny are looks only (never a stat, never the sprite colour
 *     for grade). Release / rebirth leave a shard of the pet's grade; 5 shards
 *     of a grade → a ticket guaranteeing the next grade or better.
 */

import { heroName } from './heroes-data';

export const EGG_TYPES = ['knight', 'wizard', 'village'] as const;
export type EggType = (typeof EGG_TYPES)[number];

export const EGG_LABEL: Record<EggType, string> = { knight: 'Knight', wizard: 'Wizard', village: 'Village' };
export const EGG_EMOJI: Record<EggType, string> = { knight: '🛡', wizard: '🔮', village: '🌸' };
export const EGG_COLOR: Record<EggType, string> = { knight: '#8FB7D9', wizard: '#9B7BFF', village: '#FF9EC7' };
export const EGG_BLURB: Record<EggType, string> = {
  knight: 'Swords and armour.',
  wizard: 'Magic and the dark arts.',
  village: 'Town, nature and beasts.',
};
/** The Baby looks like the egg's creep — these themed lines' young look. */
export const EGG_LINE: Record<EggType, string> = {
  knight: 'line_knight',
  wizard: 'line_wizard',
  village: 'line_village',
};

/** Themed hero pools — every hero with art, each in exactly one egg. */
export const EGG_POOLS: Record<EggType, readonly string[]> = {
  knight: ['aurex', 'oni', 'raven', 'void-raven', 'archangel'],
  wizard: ['morwen', 'corvus', 'maldrath', 'velkhar', 'frost-lich'],
  village: ['neon-viper', 'elowen', 'kael', 'sak', 'cyber-shinobi', 'kitsune'],
};

export function heroEgg(heroId: string): EggType | null {
  return EGG_TYPES.find((egg) => EGG_POOLS[egg].includes(heroId)) ?? null;
}

/** Old themed lines → their hero (save migration). */
export const THEMED_LINE_HERO: Record<string, string> = {
  line_knight: 'raven',
  line_wizard: 'maldrath',
  line_village: 'elowen',
};

/** The hero a pet line stands for (themed → its grown hero, solo_X → X). */
export function heroOfLine(line: string): string | null {
  if (THEMED_LINE_HERO[line]) return THEMED_LINE_HERO[line];
  return line.startsWith('solo_') ? line.slice(5) : null;
}

/* ------------------------------------------------------------- grades --- */

export const GRADES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABEL: Record<Grade, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};
export const GRADE_STARS: Record<Grade, number> = { common: 1, rare: 2, epic: 3, legendary: 4 };
export const GRADE_COLOR: Record<Grade, string> = {
  common: '#9AA4B2',
  rare: '#3FA9FF',
  epic: '#B06BFF',
  legendary: '#FFC83D',
};

export function gradeRank(grade: Grade): number {
  return GRADES.indexOf(grade);
}

export function nextGrade(grade: Grade): Grade | null {
  const i = gradeRank(grade);
  return i + 1 < GRADES.length ? GRADES[i + 1] : null;
}

/** A grade never by colour alone: its stars AND its word ("★★★ Epic"). */
export function gradeTag(grade: Grade): string {
  return `${'★'.repeat(GRADE_STARS[grade])} ${GRADE_LABEL[grade]}`;
}

/** v26 room nameplate: stars + the grade word, always (never colour alone). */
export function nameplateText(grade: Grade, shiny: boolean): string {
  return `${gradeTag(grade)}${shiny ? ' ✨' : ''}`;
}

/** "Legendary Kitsune"; other grades just the hero's name. */

export function gradedName(grade: Grade | null, name: string): string {
  return grade === 'legendary' ? `Legendary ${name}` : name;
}

/* ---------------------------------------------------------------- care --- */

export const CARE_BANDS = ['poor', 'good', 'great', 'perfect'] as const;
export type CareBand = (typeof CARE_BANDS)[number];

export const CARE_BAND_LABEL: Record<CareBand, string> = {
  poor: 'Poor',
  good: 'Good',
  great: 'Great',
  perfect: 'Perfect',
};

/** Grade weights (percent, each row sums to 100) per care band. */
export const BAND_WEIGHTS: Record<CareBand, Record<Grade, number>> = {
  poor: { common: 70, rare: 22, epic: 6, legendary: 2 },
  good: { common: 60, rare: 27, epic: 9, legendary: 4 },
  great: { common: 50, rare: 31, epic: 13, legendary: 6 },
  perfect: { common: 42, rare: 34, epic: 16, legendary: 8 },
};

/** Score at or above which each band starts. */
/** Perfect at 80: warm ~90% of the egg + a skilled round + 2 activities
 * (45 + 25 + 10). Tapping everything without skill tops out at 77 (Great). */
export const CARE_BAND_MIN: Record<CareBand, number> = { poor: 0, good: 35, great: 60, perfect: 80 };

/** Egg warmth: 4 pips, starts at 3, loses one per 90s of egg time; a tap adds
 * one. The egg's care is the share of its 5 minutes spent at 3+ pips. */
export const WARMTH_MAX = 4;
export const WARMTH_START = 3;
export const WARMTH_WARM = 3;
export const WARMTH_DROP_MS = 90_000;
export const CARE_EGG_POINTS = 50;
/** Baby skill (v25): a round PASSED with 70%+ = 25, any other pass = 12, a
 * fail = 0 (mashing fails now, so it can never reach Perfect). */
export const CARE_SKILL_POINTS = 25;
export const CARE_ROUND_POINTS = 12;
export const CARE_SKILL_SHARE = 0.7;
/** Baby activity: +5 each for fed, trained, dived (bit flags). */
export const CARE_ACT = { fed: 1, trained: 2, dived: 4 } as const;
export const CARE_ACT_POINTS = 5;

export type CareInput = {
  /** Egg time spent at 3+ warmth, and the egg's full length. */
  warmMs: number;
  eggMs: number;
  /** Best skill points earned in Baby (0, 12 or 25). */
  skill: number;
  /** Activity bit flags (CARE_ACT). */
  acts: number;
};

export function careScore(input: CareInput): number {
  const eggShare = input.eggMs > 0 ? Math.max(0, Math.min(1, input.warmMs / input.eggMs)) : 0;
  const egg = Math.round(CARE_EGG_POINTS * eggShare);
  const skill = Math.max(0, Math.min(CARE_SKILL_POINTS, input.skill));
  let acts = 0;
  for (const bit of Object.values(CARE_ACT)) if (input.acts & bit) acts += CARE_ACT_POINTS;
  return egg + skill + acts;
}

export function careBand(score: number): CareBand {
  if (score >= CARE_BAND_MIN.perfect) return 'perfect';
  if (score >= CARE_BAND_MIN.great) return 'great';
  if (score >= CARE_BAND_MIN.good) return 'good';
  return 'poor';
}

/** Skill points a finished Baby round earns: a pass with 70%+ is skilled. */
export function roundSkillPoints(outcome: { pass: boolean; quality: number }): number {
  if (!outcome.pass) return 0;
  return outcome.quality >= CARE_SKILL_SHARE ? CARE_SKILL_POINTS : CARE_ROUND_POINTS;
}

/* ---------------------------------------------------------------- odds --- */

/* --------------------------------------------------------------- pity --- */

/** Legendary pity (Part D): the 40th egg since your last Legendary is always
 * Legendary; from the 30th the Legendary share climbs a step each egg. The
 * position is "eggs since the last Legendary" before this egg reveals. */
export const PITY_HARD = 40;
export const PITY_SOFT_FROM = 30;

/** Which egg this is since the last Legendary (1 = the first one after it). */
export function pityEggNumber(since: number): number {
  return Math.max(0, Math.floor(since)) + 1;
}

/** Eggs left until a Legendary is certain, counting the next one (1 = the
 * next egg is guaranteed). */
export function eggsUntilLegendary(since: number): number {
  return Math.max(1, PITY_HARD - Math.max(0, Math.floor(since)));
}

/** The Legendary share (percent) at a pity position: the base share up to
 * egg 29, then a straight climb so egg 30 is one step of eleven up and egg 40
 * is 100%. */
export function pityLegendaryPct(basePct: number, since: number): number {
  const n = pityEggNumber(since);
  if (n >= PITY_HARD) return 100;
  if (n < PITY_SOFT_FROM) return basePct;
  const step = (n - PITY_SOFT_FROM + 1) / (PITY_HARD - PITY_SOFT_FROM + 1);
  return basePct + (100 - basePct) * step;
}

/** The counter after a reveal: back to 0 on a Legendary, else one more
 * (never past the guaranteed egg). */
export function pityAfterReveal(since: number, grade: Grade): number {
  return grade === 'legendary' ? 0 : Math.min(PITY_HARD - 1, Math.max(0, Math.floor(since)) + 1);
}

/**
 * Grade odds (percent) for a band, with an optional ticket's minimum grade:
 * grades below it are removed and the rest scaled back up to 100. Then pity
 * (`since` = eggs since the last Legendary) lifts the Legendary share and
 * scales the others down to make room. This is exactly what `rollPet` rolls
 * against.
 */
export function gradeOdds(band: CareBand, minGrade: Grade | null = null, since = 0): Record<Grade, number> {
  const w = BAND_WEIGHTS[band];
  const floor = minGrade ? gradeRank(minGrade) : 0;
  const total = GRADES.reduce((sum, g) => sum + (gradeRank(g) >= floor ? w[g] : 0), 0);
  const out = {} as Record<Grade, number>;
  for (const g of GRADES) out[g] = gradeRank(g) >= floor ? (w[g] / total) * 100 : 0;
  if (pityEggNumber(since) >= PITY_HARD) return { common: 0, rare: 0, epic: 0, legendary: 100 };
  const legend = pityLegendaryPct(out.legendary, since);
  if (legend === out.legendary) return out;
  const rest = 100 - out.legendary;
  const k = rest > 0 ? (100 - legend) / rest : 0;
  for (const g of GRADES) out[g] = g === 'legendary' ? legend : out[g] * k;
  return out;
}

/** Hero odds within an egg: an even split. */
export function heroOdds(egg: EggType): { hero: string; pct: number }[] {
  const pool = EGG_POOLS[egg];
  return pool.map((hero) => ({ hero, pct: 100 / pool.length }));
}

export const SHINY_ODDS = 1 / 50;

/* ------------------------------------------------------- egg pacing --- */

/** Eggs a day (Part D): the first two are free, then each costs more shells;
 * at most six a day. Passing the daily challenge adds one free egg (once a
 * day). An egg picked with a trade-up ticket brings its own egg and never
 * counts. */
export const FREE_EGGS_PER_DAY = 2;
export const DAILY_EGG_BONUS = 1;
export const EXTRA_EGG_PRICES: readonly number[] = [10, 20, 40, 80];
export const EGGS_PER_DAY_MAX = FREE_EGGS_PER_DAY + EXTRA_EGG_PRICES.length;

/** What the next egg costs today: 0 = free, a shell price, or null = none
 * left today. `used` = eggs already picked today (tickets not counted). */
export function nextEggPrice(used: number, dailyEgg: boolean): number | null {
  const n = Math.max(0, Math.floor(used));
  if (n >= EGGS_PER_DAY_MAX) return null;
  const free = FREE_EGGS_PER_DAY + (dailyEgg ? DAILY_EGG_BONUS : 0);
  if (n < free) return 0;
  return EXTRA_EGG_PRICES[Math.min(EXTRA_EGG_PRICES.length - 1, n - free)];
}

/* ------------------------------------------------- shine stones + styles --- */

/** A Shine Stone (Part D): a 10% chance to make a revealed non-shiny pet
 * shiny. Every miss adds a glimmer (per player); with 5 glimmers the next
 * Stone always works, and a success clears them. */
export const STONE_ODDS = 0.1;
export const GLIMMER_PITY = 5;
/** Every 5th day played gives a Shine Stone. */
export const STONE_EVERY_DAYS = 5;

/** The Guide's plain-word timelines (days), from `npm run sim:collect` — the
 * sim fails when its results drift past them, so the words stay true. */
export const COLLECT_TIMELINES = {
  /** Playing every day (a few eggs + the daily egg), 9 in 10 find a Legendary by then. */
  legendaryRegularDays: 7,
  /** With the free eggs only, a Legendary is certain by then (the hard pity). */
  legendaryCertainDays: Math.ceil(PITY_HARD / FREE_EGGS_PER_DAY),
  /** With a Shine Stone every few days, most players have a shiny by then. */
  shinyRegularDays: 7,
} as const;

/** The roll for the `used`-th Stone ever (0-based), from the saved sequence
 * seed — the same Stone always rolls the same, so closing the app can't
 * change it. */
export function stoneRoll(seq: number, used: number): number {
  return seededRng((seq ^ Math.imul(Math.max(0, Math.floor(used)) + 1, 0x9e3779b1)) >>> 0)();
}

export function stoneSucceeds(seq: number, used: number, glimmers: number): boolean {
  return glimmers >= GLIMMER_PITY || stoneRoll(seq, used) < STONE_ODDS;
}

/** Shiny styles: `classic` is the hero's own shiny colour (natural shinies
 * and Shine Stones); the rest only come from a Prism Stone, which is a Shop
 * preview in this build — never usable. */
export const SHINY_STYLES = ['classic', 'aurora', 'ember', 'frost', 'void', 'gold', 'prism'] as const;
export type ShinyStyle = (typeof SHINY_STYLES)[number];
export type PrismStyle = Exclude<ShinyStyle, 'classic'>;
export const PRISM_STYLES: readonly PrismStyle[] = ['aurora', 'ember', 'frost', 'void', 'gold', 'prism'];

export const SHINY_STYLE_LABEL: Record<ShinyStyle, string> = {
  classic: 'Classic',
  aurora: 'Aurora',
  ember: 'Ember',
  frost: 'Frost',
  void: 'Void',
  gold: 'Gold',
  prism: 'Prism',
};
/** Prism Stone odds (percent, sum 100) — shown on the Shop preview. */
export const PRISM_STYLE_ODDS: Record<PrismStyle, number> = { aurora: 24, ember: 22, frost: 22, void: 16, gold: 10, prism: 6 };
export const PRISM_STYLE_COLOR: Record<PrismStyle, string> = {
  aurora: '#4FFFD2',
  ember: '#FF6A3D',
  frost: '#9FD8FF',
  void: '#7B4DFF',
  gold: '#FFC83D',
  prism: '#FF4FD8',
};
/** Sparkle colour per style (Prism: rainbow, drawn by the overlay). */
export const SHINY_SPARKLE: Record<ShinyStyle, string> = {
  classic: '#FFF6C8',
  aurora: '#C9FFF0',
  ember: '#FFD2B8',
  frost: '#E6F6FF',
  void: '#D9C9FF',
  gold: '#FFF0B8',
  prism: 'rainbow',
};

/** A Prism style from a uniform draw u in [0, 1) — `PRISM_STYLE_ODDS` exactly. */
export function prismStyleFor(u: number): PrismStyle {
  let x = Math.max(0, Math.min(0.999999, u)) * 100;
  for (const s of PRISM_STYLES) {
    if (x < PRISM_STYLE_ODDS[s]) return s;
    x -= PRISM_STYLE_ODDS[s];
  }
  return PRISM_STYLES[PRISM_STYLES.length - 1];
}

export function isShinyStyle(v: unknown): v is ShinyStyle {
  return typeof v === 'string' && (SHINY_STYLES as readonly string[]).includes(v);
}

/* ---------------------------------------------------------------- roll --- */

/** mulberry32 — a small, well-mixed 32-bit PRNG. Same seed = same draws. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh egg seed (uint32). */
export function newEggSeed(rng: () => number = Math.random): number {
  return Math.floor(rng() * 4294967296) >>> 0;
}

export type PetRoll = { hero: string; grade: Grade; shiny: boolean };

/**
 * The pet's hero, grade and shiny — from the stored seed, the care band at
 * Child and the pity position stamped on the pet. Pure and deterministic:
 * the same inputs always give the same pet. Draw order is fixed (hero,
 * grade, shiny).
 */
export function rollPet(
  seed: number,
  egg: EggType,
  band: CareBand,
  minGrade: Grade | null = null,
  since = 0,
): PetRoll {
  const rng = seededRng(seed);
  const pool = EGG_POOLS[egg];
  const hero = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const odds = gradeOdds(band, minGrade, since);
  let u = rng() * 100;
  let grade: Grade = GRADES[GRADES.length - 1];
  for (const g of GRADES) {
    if (odds[g] <= 0) continue;
    if (u < odds[g]) {
      grade = g;
      break;
    }
    u -= odds[g];
  }
  const shiny = rng() < SHINY_ODDS;
  return { hero, grade, shiny };
}

/* ------------------------------------------------- stars, dyes, shards --- */

export const STAR_MAX = 5;
export const DYE_STARS = 3;
export const SHARDS_PER_TICKET = 5;

/** Stars for a hero: one per copy obtained, up to 5. */
export function heroStars(copies: number): number {
  return Math.max(0, Math.min(STAR_MAX, Math.floor(copies)));
}

/** A hero's dye can be worn at 3★ — and never on a shiny. */
export function dyeApplies(stars: number, dyeOn: boolean, shiny: boolean): boolean {
  return !shiny && dyeOn && stars >= DYE_STARS;
}

/** Fixed recolours per hero (hue targets): the shiny colour and the 3★ dye. */
export const HERO_SHINY_COLOR: Record<string, string> = {
  aurex: '#39E6B0',
  oni: '#8C7BFF',
  raven: '#FF6FAE',
  'void-raven': '#FFD166',
  archangel: '#7CF5FF',
  morwen: '#FF8A3D',
  corvus: '#9CFF6B',
  maldrath: '#FFE14D',
  velkhar: '#4DD2FF',
  'frost-lich': '#FF5FA2',
  'neon-viper': '#B9FF4D',
  elowen: '#6B8CFF',
  kael: '#FF7A59',
  sak: '#5FF0D2',
  'cyber-shinobi': '#FFB347',
  kitsune: '#6FE0FF',
};
export const HERO_DYE_COLOR: Record<string, string> = {
  aurex: '#FF4D6D',
  oni: '#3DDC97',
  raven: '#5AA9FF',
  'void-raven': '#C77DFF',
  archangel: '#FFB84D',
  morwen: '#4DE1FF',
  corvus: '#FF5CCB',
  maldrath: '#6BFFB8',
  velkhar: '#FF9F43',
  'frost-lich': '#A3FF5C',
  'neon-viper': '#FF6B9A',
  elowen: '#FFD35C',
  kael: '#59D9FF',
  sak: '#FF7AE0',
  'cyber-shinobi': '#7C9CFF',
  kitsune: '#B98CFF',
};

/** A shiny's colour: its hero's own for Classic, else the Prism style's. */
export function shinyColorFor(hero: string, style: ShinyStyle | null): string | null {
  if (style == null || style === 'classic') return HERO_SHINY_COLOR[hero] ?? null;
  return PRISM_STYLE_COLOR[style];
}

/* --------------------------------------------------------------- hall --- */

/** Hall cap: when over, drop the oldest Common, then Rare, then Epic.
 * Legendary and shiny entries are pinned and never dropped (the Hall only
 * goes over the cap if everything left is pinned). */
export function trimHall<T extends { grade: Grade; shiny: boolean }>(entries: readonly T[], max: number): T[] {
  const out = [...entries];
  for (const drop of ['common', 'rare', 'epic'] as const) {
    while (out.length > max) {
      const i = out.findIndex((e) => e.grade === drop && !e.shiny);
      if (i < 0) break;
      out.splice(i, 1);
    }
  }
  return out;
}

/* -------------------------------------------------------- the hero book --- */

/** One hero's Collection record: every pet of it that has left (released or
 * reborn) — copies (stars), shinies, grades, forms reached and shiny styles
 * owned — plus the 3★ dye switch. The live pet and the Den's pets are added on
 * top for the view. */
export type PetHeroRecord = {
  copies: number;
  shinies: number;
  grades: Grade[];
  forms: string[];
  dye: boolean;
  /** v27 — shiny styles owned (Classic from a natural shiny or a Stone). */
  styles: ShinyStyle[];
};
export type PetHeroBook = Record<string, PetHeroRecord>;

export const EMPTY_HERO_RECORD: PetHeroRecord = { copies: 0, shinies: 0, grades: [], forms: [], dye: false, styles: [] };

/** Add one pet of `hero` to the book. */
export function addToBook(
  book: PetHeroBook,
  pet: { hero: string; grade: Grade; shiny: boolean; forms: readonly string[]; style?: ShinyStyle | null },
): PetHeroBook {
  const prev = book[pet.hero] ?? EMPTY_HERO_RECORD;
  const style = pet.shiny ? (pet.style ?? 'classic') : null;
  return {
    ...book,
    [pet.hero]: {
      copies: prev.copies + 1,
      shinies: prev.shinies + (pet.shiny ? 1 : 0),
      grades: GRADES.filter((g) => prev.grades.includes(g) || g === pet.grade),
      forms: [...new Set([...prev.forms, ...pet.forms])],
      dye: prev.dye,
      styles: SHINY_STYLES.filter((s) => prev.styles.includes(s) || s === style),
    },
  };
}

/** Every shiny style of a hero owned — the looks-only all-styles card frame. */
export function ownsAllStyles(record: PetHeroRecord | undefined): boolean {
  return record != null && SHINY_STYLES.every((s) => record.styles.includes(s));
}

/** The best grade a hero has reached (null = never found). */
export function bestGrade(record: PetHeroRecord | undefined): Grade | null {
  if (!record || record.grades.length === 0) return null;
  return [...record.grades].sort((a, b) => gradeRank(b) - gradeRank(a))[0];
}

export function parseHeroBook(raw: unknown, validHero: (id: string) => boolean): PetHeroBook {
  const out: PetHeroBook = {};
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) return out;
  for (const [hero, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!validHero(hero) || typeof row !== 'object' || row == null) continue;
    const r = row as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
    const shinies = n(r.shinies);
    // v27: a record from before styles owns Classic if it has any shiny.
    const styles = Array.isArray(r.styles)
      ? SHINY_STYLES.filter((s) => (r.styles as unknown[]).includes(s))
      : shinies > 0
        ? (['classic'] as ShinyStyle[])
        : [];
    out[hero] = {
      copies: n(r.copies),
      shinies,
      grades: Array.isArray(r.grades) ? GRADES.filter((g) => (r.grades as unknown[]).includes(g)) : [],
      forms: Array.isArray(r.forms) ? [...new Set((r.forms as unknown[]).filter((f): f is string => typeof f === 'string'))] : [],
      dye: r.dye === true,
      styles,
    };
  }
  return out;
}

export function emptyGradeCounts(): Record<Grade, number> {
  return { common: 0, rare: 0, epic: 0, legendary: 0 };
}

export function parseGradeCounts(raw: unknown): Record<Grade, number> {
  const out = emptyGradeCounts();
  if (typeof raw !== 'object' || raw == null) return out;
  for (const g of GRADES) {
    const v = (raw as Record<string, unknown>)[g];
    out[g] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }
  return out;
}

/* ---------------------------------------------------------------- name --- */

/** The name the pet goes by: the player's, else its hero's (once revealed),
 * else "Your Knight egg" / "Your pet". */
export function petShownName(pet: { name: string | null; hero: string | null; egg: EggType | null; stage: string }): string {
  if (pet.name) return pet.name;
  const revealed = pet.hero != null && pet.stage !== 'egg' && pet.stage !== 'baby';
  if (revealed && pet.hero) return heroName(pet.hero);
  if (pet.egg) return `Your ${EGG_LABEL[pet.egg]} ${pet.stage === 'egg' ? 'egg' : 'Baby'}`;
  return 'Your pet';
}
