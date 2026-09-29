/**
 * Player-facing copy for a hero (EFFECTS_PLAN roster + the 2026-09-28 Dress
 * redesign). Pure, so `check:hero-copy` can pin every line.
 *
 * Two honest lines, because a hero means different things depending on how it
 * is used, and the old roster said neither:
 *
 * - **As Avatar** it is art + its Veil skill. The Veils barely differ (every
 *   one slows for 2000ms; radius 23-27, slow 30-36%), so this line states the
 *   actual numbers instead of implying a unique playstyle — a red-team finding
 *   (2026-09-28): copy built on those numbers would oversell the variety.
 * - **As a bound tower** the hero's BEHAVIOR fires, carrying the ACTIVE
 *   LEGEND's element (2026-09-28 — the Legend overrides the hero's element;
 *   the hero's own element is its affinity, a damage bonus when it matches).
 *   So the tower line takes the Legend's element, never the hero's own.
 */
import { heroById, type HeroDef } from '@/play/heroes-data';
import { BEHAVIOR_LABEL, ELEMENT_LABEL, type Behavior, type Element } from '@/play/kits';
import { skillById } from '@/play/skills-data';

/** One-line "what this does as a bound tower": "Chain · Spark — arcs between foes". */
export const BEHAVIOR_EFFECT: Record<Behavior, string> = {
  burst: 'one heavy hit at a time',
  splash: 'blasts a group at once',
  dot: 'burns down over time',
  slow: 'holds the lane back',
  chain: 'arcs between foes',
  pull: 'drags them back down the path',
};

/** What the element adds on top of the behavior. */
export const ELEMENT_EFFECT: Record<Element, string> = {
  ember: 'sets them alight',
  tide: 'chills and slows',
  spark: 'jumps to a second foe',
  root: 'snares, and hits tanks harder',
  void: 'makes them take more damage',
};

export type HeroStatus = 'active' | 'bound' | 'owned' | 'locked';

export const HERO_STATUS_LABEL: Record<HeroStatus, string> = {
  active: 'Active',
  bound: 'Tower',
  owned: 'Owned',
  locked: 'Locked',
};

/** The hero's attack with the active Legend: "Chain · Fire — arcs between
 * foes, sets them alight". The behavior is the hero's; the element is the
 * Legend's (that is what `defend.ts` fires). */
export function heroTowerLine(hero: HeroDef, legendElement: Element): string {
  const behavior = hero.kit.behavior;
  return `${BEHAVIOR_LABEL[behavior]} · ${ELEMENT_LABEL[legendElement]} — ${BEHAVIOR_EFFECT[behavior]}, ${ELEMENT_EFFECT[legendElement]}`;
}

/** The hero's Avatar role: its Veil, with the numbers that actually differ. */
export function heroAvatarLine(hero: HeroDef): string {
  const skill = skillById(hero.skillId);
  const slow = Math.round(skill.slow_pct * 100);
  const secs = Math.round(skill.slow_ms / 100) / 10;
  const damage = skill.damage > 0 ? `, ${skill.damage} damage` : '';
  return `${skill.name} — slows nearby foes ${slow}% for ${secs}s${damage}`;
}

/** How a locked hero is earned (the authored hint, never an internal id). */
export function heroUnlockLine(hero: HeroDef): string {
  return hero.acquire;
}

export function heroStatusOf(
  heroId: string,
  opts: { activeHeroId: string; ownedIds: readonly string[]; boundIds: readonly string[] },
): HeroStatus {
  if (heroId === opts.activeHeroId) return 'active';
  if (opts.boundIds.includes(heroId)) return 'bound';
  return opts.ownedIds.includes(heroId) ? 'owned' : 'locked';
}

/** True when setting this hero as the Avatar would silently drop its bound
 * tower — the Dress grid asks for a second tap in that case (red team,
 * 2026-09-28: `setAvatarHero` unbinds with no warning today). */
export function setAvatarUnbinds(heroId: string, boundIds: readonly string[]): boolean {
  return boundIds.includes(heroId);
}

/** What is shared no matter which hero you pick — the line the old screen was
 * missing, and the reason its "swap freely" copy misled. It must also name the
 * one real cost: `setAvatarHero` unbinds that hero's tower (review, 2026-09-28
 * — an earlier draft of this line claimed nothing is lost, which was false). */
export const HERO_SHARED_NOTE =
  'Your bag, tokens and campaign progress stay the same whichever hero you pick — only your look and Veil change. One catch: a hero bound as a tower gives up that tower when you fight as it.';

/** Guard for a hero id that is no longer in `heroes.json` (a stale save). */
export function heroDisplayName(heroId: string): string {
  return heroById(heroId)?.name ?? heroId;
}
