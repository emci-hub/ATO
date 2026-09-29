/**
 * Player-facing words for the elemental Legend system (2026-09-28). Pure so
 * `check:legends` can pin every line — the numbers shown here are computed from
 * the same functions combat uses, so the screen can never disagree with the
 * fight.
 *
 * Three rules, one sentence each:
 *   1. Your Legend sets the element of your Avatar's and your heroes' attacks.
 *   2. A hero whose own element (affinity) matches your Legend hits harder.
 *   3. Gear whose element matches your Legend gets stronger stats.
 * Plus the stage matchup: a stage's element is weak to one element and
 * resists its own.
 */
import {
  LEGEND_LEVEL_FULL,
  legendForElement,
  legendResistRecovery,
  legendRiderScale,
  type AvatarDef,
} from '@/play/avatars';
import type { TypeTag } from '@/play/engine/type-match';
import type { HeroDef } from '@/play/heroes-data';
import { heroTowerLine } from '@/play/hero-copy';
import { KIT_TUNING, weaknessOf } from '@/play/kit-combat';
import { ELEMENT_LABEL, type Element } from '@/play/kits';
import { getTune } from '@/play/tune';

/* ------------------------------------------------------------- explainers --- */

/** Top of the Legends section in Dress. */
export const LEGEND_EXPLAINER =
  'Your Legend sets the element of every attack — yours and your heroes’. Level it to make that element stronger. Heroes whose affinity matches it hit harder, and gear of its element gets stronger stats (gear comes in Ember, Tide, Spark and Root — never Void). Each Legend keeps its own level, stars and worn gear, so switching Legend switches those too. Some stages favour certain elements.';

/** The one-time first-visit tip in Dress. */
export const LEGEND_FIRST_TIP_TITLE = 'Legends set your element';
export const LEGEND_FIRST_TIP_BODY =
  'Each hero attacks its own way — chain, splash, pull. Your Legend decides what element that attack carries. Match a hero’s affinity or your gear to your Legend for a bonus. Switch Legends to suit the stage — each Legend brings its own level and worn gear with it.';

/* ------------------------------------------------------------ Legend card --- */

/** What the Legend boosts, e.g. "Fire — sets foes alight so they burn over time." */
export function legendBoostLine(def: AvatarDef): string {
  return def.blurb;
}

function pct(n: number): number {
  return Math.round(n * 100);
}

/** Current level effect, e.g. "Lv 7 · element effects ×1.16 · resisted hits −20%". */
export function legendLevelLine(level: number): string {
  const lv = Math.max(1, Math.floor(level));
  const resisted = pct(KIT_TUNING.resistDamage * (1 - legendResistRecovery(lv)));
  return `Lv ${lv} · element effects ×${legendRiderScale(lv).toFixed(2)} · resisted hits −${resisted}%`;
}

/** What the next level adds, or that it is at full strength. */
export function legendNextLine(level: number): string {
  const lv = Math.max(1, Math.floor(level));
  if (lv >= LEGEND_LEVEL_FULL) return 'Element at full strength.';
  const scaleUp = legendRiderScale(lv + 1) - legendRiderScale(lv);
  const recoverUp =
    KIT_TUNING.resistDamage * (legendResistRecovery(lv + 1) - legendResistRecovery(lv)) * 100;
  return `Next level: effects +${scaleUp.toFixed(3)} · resisted hits ${recoverUp.toFixed(1)}% less`;
}

/* ------------------------------------------------------------ hero detail --- */

/** "With Dragonblood Champion: Chain · Fire — arcs between foes, sets them alight." */
export function heroWithLegendLine(hero: HeroDef, legendElement: Element): string {
  return `With ${legendForElement(legendElement).name}: ${heroTowerLine(hero, legendElement)}`;
}

/** "Affinity: Void — +15% damage with a Void Legend (active now)". */
export function heroAffinityLine(hero: HeroDef, legendElement: Element): string {
  const own = hero.kit.element;
  const bonus = pct(getTune().heroAffinityBonus);
  const tail = own === legendElement ? ' (active now)' : '';
  return `Affinity: ${ELEMENT_LABEL[own]} — +${bonus}% damage with a ${ELEMENT_LABEL[own]} Legend${tail}`;
}

export function heroAffinityMatches(hero: HeroDef, legendElement: Element): boolean {
  return hero.kit.element === legendElement;
}

/* ------------------------------------------------------------------- gear --- */

/** "Matches Ember Legend: stats +100%" — only for a matching Power. */
export function gearMatchLine(itemElement: TypeTag, legendElement: Element): string | null {
  if (itemElement !== legendElement) return null;
  return `Matches ${ELEMENT_LABEL[legendElement]} Legend: stats +${pct(getTune().gearMatchBonus)}%`;
}

/* ---------------------------------------------------------- stage matchup --- */

export type StageMatchup =
  | { kind: 'neutral' }
  | {
      kind: 'favoured' | 'resisted' | 'even';
      stage: TypeTag;
      /** The element that beats this stage (+25%). */
      weakTo: TypeTag;
      /** Your Legend's damage change on this stage, in whole percent. */
      legendPct: number;
    };

/** How the active Legend fares on a stage (Legend level softens a resist). */
export function stageMatchupFor(
  stage: TypeTag | null,
  legendElement: Element,
  legendLevel: number,
): StageMatchup {
  if (!stage) return { kind: 'neutral' };
  const weakTo = weaknessOf(stage)!;
  if (legendElement === weakTo) {
    return { kind: 'favoured', stage, weakTo, legendPct: pct(KIT_TUNING.weakDamage - 1) };
  }
  if (legendElement === stage) {
    const loss = KIT_TUNING.resistDamage * (1 - legendResistRecovery(legendLevel));
    return { kind: 'resisted', stage, weakTo, legendPct: -pct(loss) };
  }
  return { kind: 'even', stage, weakTo, legendPct: 0 };
}

/** Short right-hand label on the Defend stage row. */
export function stageMatchupShort(m: StageMatchup): string {
  if (m.kind === 'neutral') return 'neutral';
  if (m.kind === 'favoured') return `your Legend +${m.legendPct}%`;
  if (m.kind === 'resisted') return `your Legend ${m.legendPct}%`;
  return 'your Legend ±0%';
}

/** The explanation under the stage row (tap to open): which Legend to bring. */
export function stageMatchupDetail(m: StageMatchup): string {
  if (m.kind === 'neutral') return 'Neutral stage — every element deals normal damage.';
  const best = legendForElement(m.weakTo);
  return `${ELEMENT_LABEL[m.stage]} stage: ${ELEMENT_LABEL[m.weakTo]} deals +${pct(KIT_TUNING.weakDamage - 1)}%, ${ELEMENT_LABEL[m.stage]} deals −${pct(KIT_TUNING.resistDamage)}% (a levelled Legend softens this). Void is never resisted. Best Legend here: ${best.name} (${ELEMENT_LABEL[m.weakTo]}).`;
}
