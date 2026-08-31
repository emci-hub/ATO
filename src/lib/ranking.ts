/**
 * Forced-ranking sort. Optional-depth, one trait axis per round.
 * Drag order is an explicit self-report → `self_tap` (direct, sticky).
 * Soft-ask: yields if Does-Sage-know-you or a completeness claim already
 * has this week's slot. Extra six axes are the scenario swipe-deck.
 */
import { localYmd } from '@/lib/local-date';
import {
  applyRankingWeek,
  emptySageKnowsState,
  hasUnfilledTraitAxis,
  sageKnowsWeekKey,
  weekSlotTaken,
  youTabSlotTaken,
  type SageKnowsState,
} from '@/lib/sage-knows';
import {
  EXTRA_AXES,
  TRAIT_AXES,
  emptyTraitState,
  mergeTraitWrite,
  type TraitAxis,
  type TraitState,
  type TraitValues,
} from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const RANKING_MIN_ITEMS = 4;
export const RANKING_MAX_ITEMS = 5;

export interface RankingItem {
  id: string;
  text: string;
  /** 1 = high pole of the axis, 0 = low pole. */
  loading: number;
}

export interface RankingPrompt {
  axis: TraitAxis;
  items: RankingItem[];
  order: string[];
  weekKey: string;
}

function items(
  axis: TraitAxis,
  rows: Array<[string, number]>,
): RankingItem[] {
  return rows.map(([text, loading], index) => ({
    id: `${axis}_${index}`,
    text,
    loading,
  }));
}

/**
 * Plain behavioral lines, graded along one axis. Never names a framework.
 * 4–5 per round. Loadings are high-pole → low pole.
 */
export const RANKING_ROUNDS: Record<TraitAxis, RankingItem[]> = {
  openness: items('openness', [
    ['I like trying a path nobody around me has used yet', 1],
    ['A new idea is usually worth a look', 0.75],
    ['I mix the familiar with the occasional new thing', 0.5],
    ['I tend to stick with what already works', 0.25],
    ['I stick with the known path unless I have to change', 0],
  ]),
  conscientiousness: items('conscientiousness', [
    ['I see a plan through even when it gets dull', 1],
    ['I like having a plan and mostly follow it', 0.75],
    ['I plan some things and leave others open', 0.5],
    ['I keep plans loose and change them as I go', 0.25],
    ['I keep it loose and decide in the moment', 0],
  ]),
  extraversion: items('extraversion', [
    ['I get going when I am around people', 1],
    ['A full room is usually fine with me', 0.75],
    ['I can go either way on people time', 0.5],
    ['I like a smaller circle most days', 0.25],
    ['Quiet time is how I reset', 0],
  ]),
  agreeableness: items('agreeableness', [
    ['I go along when it keeps things easy', 1],
    ['I will bend if it keeps the peace', 0.75],
    ['I weigh going along against holding my ground', 0.5],
    ['I hold my view even when it rubs a bit', 0.25],
    ['I hold my ground even when it would be easier not to', 0],
  ]),
  steadiness: items('steadiness', [
    ['I stay even when things wobble', 1],
    ['Most wobble I can shake off', 0.75],
    ['Some wobble lands, some I shake off', 0.5],
    ['I feel it when things start to wobble', 0.25],
    ['I feel it strongly when things wobble', 0],
  ]),
  attachment_anxiety: items('attachment_anxiety', [
    ['I worry people will pull away', 1],
    ['Closeness sometimes brings a worry they will leave', 0.75],
    ['Sometimes I worry about that, sometimes I do not', 0.5],
    ['I do not spend much time on whether people will leave', 0.25],
    ["Whether people stick around just isn't something I think about", 0],
  ]),
  attachment_avoidance: items('attachment_avoidance', [
    ['I keep some distance even with people I like', 1],
    ['I like a bit of space once things get close', 0.75],
    ['I mix closeness with a bit of distance', 0.5],
    ['I stay close once I am in, with a little room', 0.25],
    ["Once someone's in, I don't hold back at all", 0],
  ]),
  conflict_assertiveness: items('conflict_assertiveness', [
    ['In a disagreement I put my own point on the table', 1],
    ['I say what I need, even if it is a bit sharp', 0.75],
    ['I sometimes push and sometimes wait', 0.5],
    ['I wait to see if it blows over', 0.25],
    ['I step back rather than push', 0],
  ]),
  conflict_cooperativeness: items('conflict_cooperativeness', [
    ['I look for something the other person can live with', 1],
    ['I try to leave them a way through', 0.75],
    ['I split attention between my outcome and theirs', 0.5],
    ['I protect my outcome first, then see what is left', 0.25],
    ['Getting my outcome comes first, plain and simple', 0],
  ]),
  autonomy: items('autonomy', [
    ['I want to do it my own way', 1],
    ['I would rather pick the path than be handed one', 0.75],
    ['I mix doing it my way with a path that is already there', 0.5],
    ['A path someone else set is usually fine', 0.25],
    ["I don't mind following someone else's plan at all", 0],
  ]),
  competence: items('competence', [
    ['I feel I can handle a hard thing', 1],
    ['Hard things are usually in reach', 0.75],
    ['Some hard things I can handle, some I cannot', 0.5],
    ['A hard thing makes me pause', 0.25],
    ['I doubt I can pull a hard thing off', 0],
  ]),
  relatedness: items('relatedness', [
    ['A day needs a real connection with someone to land', 1],
    ['I want a real check-in with someone most days', 0.75],
    ['Some days I want connection, some I do not need it', 0.5],
    ['A day can land without much of it', 0.25],
    ["A day's fine on its own, connection or not", 0],
  ]),
  growth_mindset: items('growth_mindset', [
    ['After a miss I look for what to change so I can try again', 1],
    ['A miss is usually a chance to look at what went wrong', 0.75],
    ['After a miss I sometimes look for what to change and sometimes take it as closed', 0.5],
    ['A miss often feels like the end of that path', 0.25],
    ['After a miss I treat it as a sign I am not good at that', 0],
  ]),
  locus_of_control: items('locus_of_control', [
    ['When it falls apart I look at what I might have done differently', 1],
    ['I look first at what was in my hands', 0.75],
    ['I sometimes look at what I might change and sometimes at what was out of my hands', 0.5],
    ['I often figure it was mostly out of my hands', 0.25],
    ['When it falls apart I figure it was bound to happen', 0],
  ]),
  self_efficacy: items('self_efficacy', [
    ['Facing a big task I feel I can pull it off', 1],
    ['A big task is usually something I can do', 0.75],
    ['Facing a big task I sometimes feel I can pull it off and sometimes do not', 0.5],
    ['A big task makes me unsure', 0.25],
    ['A big task leaves me genuinely unsure I can do it', 0],
  ]),
};

function clamp01(value: number): number {
  const n = Math.min(1, Math.max(0, value));
  return Math.round(n * 100) / 100;
}

function hashSeed(seed: string): number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Stable shuffle so a refresh in the same week does not jumble the round. */
export function shuffleIds(ids: readonly string[], seed: string): string[] {
  const next = [...ids];
  let a = hashSeed(seed);
  for (let i = next.length - 1; i > 0; i -= 1) {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    const j = a % (i + 1);
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...list];
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function loadingOf(items: RankingItem[], id: string): number {
  return items.find((item) => item.id === id)?.loading ?? 0.5;
}

function weighted(order: readonly string[], round: RankingItem[]): number {
  const n = order.length;
  const denom = Math.max(1, n - 1);
  return order.reduce((sum, id, rank) => {
    const weight = (n - 1 - rank) / denom;
    return sum + loadingOf(round, id) * weight;
  }, 0);
}

/**
 * Rank order → 0–1 on the axis. Most-me at index 0. Range-normalized so a
 * perfect high-pole sort is 1 and a perfect low-pole sort is 0.
 */
export function scoreRankingOrder(round: RankingItem[], order: readonly string[]): number {
  if (order.length < RANKING_MIN_ITEMS) return 0.5;
  const n = order.length;
  const raw = weighted(order, round);
  const desc = [...round].sort((a, b) => b.loading - a.loading).map((item) => item.id);
  const asc = [...round].sort((a, b) => a.loading - b.loading).map((item) => item.id);
  const max = weighted(desc.slice(0, n), round);
  const min = weighted(asc.slice(0, n), round);
  if (max === min) return 0.5;
  return clamp01((raw - min) / (max - min));
}

export function pickRankingAxis(values: TraitValues, last: TraitAxis | null): TraitAxis | null {
  const unfilled = TRAIT_AXES.filter(
    (axis) => values[axis] == null && !(EXTRA_AXES as readonly string[]).includes(axis),
  );
  if (unfilled.length === 0) return null;
  if (last == null) return unfilled[0] ?? null;
  const start = TRAIT_AXES.indexOf(last);
  for (let step = 1; step <= TRAIT_AXES.length; step += 1) {
    const axis = TRAIT_AXES[(start + step) % TRAIT_AXES.length];
    if (unfilled.includes(axis)) return axis;
  }
  return unfilled[0] ?? null;
}

export function rankingRoundFor(axis: TraitAxis): RankingItem[] {
  return RANKING_ROUNDS[axis];
}

/**
 * Standalone ranking for one axis — no weekly Ask slot, no Home.
 * Same RANKING_ROUNDS + self_tap merge as the weekly mechanic.
 */
export function rankingPromptForAxis(
  axis: TraitAxis,
  seed: string = 'standalone',
): RankingPrompt | null {
  const round = rankingRoundFor(axis);
  if (round.length < RANKING_MIN_ITEMS || round.length > RANKING_MAX_ITEMS) return null;
  if (round.some((item) => containsFrameworkTerm(item.text))) return null;
  const order = shuffleIds(
    round.map((item) => item.id),
    `${seed}:${axis}`,
  );
  return { axis, items: round, order, weekKey: seed };
}

export interface ForcedPick {
  axis: TraitAxis;
  high: RankingItem;
  low: RankingItem;
}

/**
 * Compare-two, pick-one using the high and low poles of RANKING_ROUNDS.
 * Writes self_tap. Not merged into Infinite Questions.
 */
export function forcedPickForAxis(axis: TraitAxis): ForcedPick | null {
  const round = rankingRoundFor(axis);
  const high = round.find((item) => item.loading === 1);
  const low = round.find((item) => item.loading === 0);
  if (!high || !low) return null;
  if (containsFrameworkTerm(high.text) || containsFrameworkTerm(low.text)) return null;
  return { axis, high, low };
}

export function scoreForcedPick(_pick: ForcedPick, pole: 'high' | 'low'): number {
  return pole === 'high' ? 0.8 : 0.2;
}

export function applyForcedPickWrite(
  current: TraitState,
  axis: TraitAxis,
  pole: 'high' | 'low',
  nowIso: string = new Date().toISOString(),
): TraitState {
  const pick = forcedPickForAxis(axis);
  if (!pick) return current;
  return mergeTraitWrite(current, { [axis]: scoreForcedPick(pick, pole) }, 'self_tap', [axis], nowIso);
}

export function resolveRanking(input: {
  values: TraitValues;
  knows: SageKnowsState;
  now?: Date;
  timeZone: string;
}): RankingPrompt | null {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone || 'UTC';
  const todayYmd = localYmd(now, timeZone);
  const weekKey = sageKnowsWeekKey(todayYmd);

  if (youTabSlotTaken(input.knows, weekKey) === 'completeness') return null;
  if (weekSlotTaken(input.knows, weekKey)) return null;
  if (!hasUnfilledTraitAxis(input.values)) return null;

  const axis = pickRankingAxis(input.values, input.knows.ranking_last_axis);
  if (!axis) return null;
  const round = rankingRoundFor(axis);
  if (round.length < RANKING_MIN_ITEMS || round.length > RANKING_MAX_ITEMS) return null;
  if (round.some((item) => containsFrameworkTerm(item.text))) return null;

  const order = shuffleIds(
    round.map((item) => item.id),
    `${weekKey}:${axis}`,
  );
  return { axis, items: round, order, weekKey };
}

/** Direct write. Same sticky merge as a tap-form. */
export function applyRankingWrite(
  current: TraitState,
  axis: TraitAxis,
  order: readonly string[],
  nowIso: string = new Date().toISOString(),
): TraitState {
  const value = scoreRankingOrder(rankingRoundFor(axis), order);
  return mergeTraitWrite(current, { [axis]: value }, 'self_tap', [axis], nowIso);
}

export function rankingWritePreview(axis: TraitAxis, order: readonly string[]): number {
  return scoreRankingOrder(rankingRoundFor(axis), order);
}

export { applyRankingWeek, emptySageKnowsState };
