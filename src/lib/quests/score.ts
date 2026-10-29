import { QUEST_AXES } from '@/lib/quests/types';
import type { QuestCampaign, QuestScene } from '@/lib/quests/types';
import { clamp01, effectiveStability, nudgedSecondaryValue, trackFor, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';

/**
 * Quests scoring (ATO-BUILD PHASE-13). Pure: no I/O, no clock (the caller
 * passes `now`). Turns one finished run's picks into at most three small
 * game-track nudges. The server re-checks everything (PHASE-17); the 7- and
 * 30-day rules here are only a mirror for the Said screen.
 *
 * Per axis a (undone picks skipped, for-fun runs never count):
 *   P = Σ w·pole, W = Σ w over every tagged pick; lean L = P / W.
 *   Primary picks = picks made in a scene whose primaryAxis is a; n = distinct
 *   such scenes. C = share of primary picks whose tag on a agrees with sign(L)
 *   (a primary pick with no tag on a never agrees).
 *   Eligible: n ≥ 3, C ≥ 0.67, |L| ≥ 0.33.
 *   s = 0.5 + 0.3·L; g = 0.25·C·min(1, n/4)·(1 − 0.6·stab_report).
 *   to = nudgedSecondaryValue(game, s, g), |to − game| ≤ 0.08.
 */
export const SCORE = {
  minScenes: 3,
  minConsistency: 0.67,
  minLean: 0.33,
  sampleSpread: 0.3,
  maxWeight: 0.25,
  fullWeightScenes: 4,
  stabilityDamp: 0.6,
  maxAxesPerRun: 3,
  maxDelta: 0.08,
  axisCooldownDays: 7,
  evidenceWindowDays: 30,
  /** Contradiction guard: report stability at or above this … */
  contradictionStability: 0.4,
  /** … and s on the other side of 0.5 from the report value, more than this apart. */
  contradictionGap: 0.3,
  /** Game value used when the axis has no game track yet. */
  neutralGame: 0.5,
} as const;

const DAY_MS = 86_400_000;
const QUEST_AXIS_SET: readonly string[] = QUEST_AXES;

/** One logged pick (PHASE-14 writes these). */
export interface QuestPick {
  sceneId: string;
  choiceId: string;
  undone?: boolean;
}

export interface AxisLean {
  axis: TraitAxis;
  /** Σ w·pole */
  P: number;
  /** Σ w */
  W: number;
  /** P / W, −1…1 */
  lean: number;
  /** n: distinct primary scenes picked in. */
  scenes: number;
  primaryPicks: number;
  agreeing: number;
  /** C, 0…1 */
  consistency: number;
  eligible: boolean;
}

export type AxisStatus =
  | 'apply'
  | 'not_enough'
  | 'contradiction'
  | 'cooldown'
  | 'over_limit'
  | 'not_counted';

export interface AxisVerdict extends AxisLean {
  status: AxisStatus;
  /** Present on every eligible axis. */
  s?: number;
  g?: number;
  from?: number;
  to?: number;
  delta?: number;
}

export interface ScoreInput {
  campaign: QuestCampaign;
  picks: readonly QuestPick[];
  mode: 'me' | 'fun';
  now: Date;
  /** The player's trait tracks (report + game). */
  tracks: readonly TraitTrack[];
  /** Last time a Quest result was applied, per axis (ISO). */
  lastAppliedAt?: Partial<Record<TraitAxis, string>>;
  /** Completion times (ISO) of earlier as-me runs of this campaign that counted as evidence. */
  priorEvidenceRuns?: readonly string[];
}

export interface RunScore {
  /** False for a for-fun run or a second as-me run inside 30 days. */
  counts: boolean;
  why?: 'for_fun' | 'evidence_window';
  /** Every axis the run touched, QUEST_AXES order. */
  axes: AxisVerdict[];
  /** The writes, highest C·|L| first (≤ 3). */
  apply: AxisVerdict[];
  /** Axes for the "Not enough to say" list. */
  notEnough: TraitAxis[];
}

const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Picks that count: not undone, pointing at a real scene and choice. */
function livePicks(campaign: QuestCampaign, picks: readonly QuestPick[]) {
  const byId = new Map<string, QuestScene>(campaign.scenes.map((s) => [s.id, s]));
  const out: { scene: QuestScene; choice: QuestScene['choices'][number] }[] = [];
  for (const p of picks) {
    if (p.undone) continue;
    const scene = byId.get(p.sceneId);
    const choice = scene?.choices.find((c) => c.id === p.choiceId);
    if (scene && choice) out.push({ scene, choice });
  }
  return out;
}

/** Lean, consistency and n for every allowed axis the picks touched. */
export function axisLeans(campaign: QuestCampaign, picks: readonly QuestPick[]): AxisLean[] {
  const live = livePicks(campaign, picks);
  const out: AxisLean[] = [];
  for (const axis of QUEST_AXES) {
    let P = 0;
    let W = 0;
    for (const { choice } of live) {
      for (const t of choice.tags) {
        if (t.axis !== axis) continue;
        P += t.w * t.pole;
        W += t.w;
      }
    }
    const primary = live.filter((x) => x.scene.primaryAxis === axis);
    if (W === 0 && primary.length === 0) continue;
    const lean = W > 0 ? P / W : 0;
    const dir = sign(lean);
    const agreeing = primary.filter((x) => dir !== 0 && x.choice.tags.some((t) => t.axis === axis && t.pole === dir)).length;
    const scenes = new Set(primary.map((x) => x.scene.id)).size;
    const consistency = primary.length > 0 ? agreeing / primary.length : 0;
    out.push({
      axis,
      P,
      W,
      lean,
      scenes,
      primaryPicks: primary.length,
      agreeing,
      consistency,
      eligible: scenes >= SCORE.minScenes && consistency >= SCORE.minConsistency && Math.abs(lean) >= SCORE.minLean,
    });
  }
  return out;
}

/** s = 0.5 + 0.3·L, kept inside 0.2…0.8. */
export function sampleFromLean(lean: number): number {
  const L = Math.max(-1, Math.min(1, lean));
  return 0.5 + SCORE.sampleSpread * L;
}

/** g = 0.25·C·min(1, n/4)·(1 − 0.6·stab_report). */
export function evidenceWeight(consistency: number, scenes: number, reportStability: number): number {
  return (
    SCORE.maxWeight *
    clamp01(consistency) *
    Math.min(1, Math.max(0, scenes) / SCORE.fullWeightScenes) *
    (1 - SCORE.stabilityDamp * clamp01(reportStability))
  );
}

/** The new game-track value: nudgedSecondaryValue, then |Δ| ≤ 0.08. No game track yet = start at 0.5. */
export function previewGameValue(game: number | null, s: number, g: number): number {
  const from = game == null ? SCORE.neutralGame : clamp01(game);
  const to = nudgedSecondaryValue(from, s, g);
  return Math.max(from - SCORE.maxDelta, Math.min(from + SCORE.maxDelta, to));
}

/** Report stability ≥ 0.4 and s on the other side of 0.5 from the report value, more than 0.3 away. */
export function isContradiction(s: number, report: { value: number; stability: number } | null): boolean {
  if (!report || report.stability < SCORE.contradictionStability) return false;
  const opposite = (s - 0.5) * (report.value - 0.5) < 0;
  return opposite && Math.abs(s - report.value) > SCORE.contradictionGap;
}

const within = (iso: string, now: Date, days: number): boolean => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < days * DAY_MS; // a future stamp (clock change) is inside the window
};

export function scoreRun(input: ScoreInput): RunScore {
  const { campaign, picks, mode, now, tracks } = input;
  const leans = axisLeans(campaign, picks);
  const why: RunScore['why'] =
    mode === 'fun'
      ? 'for_fun'
      : (input.priorEvidenceRuns ?? []).some((iso) => within(iso, now, SCORE.evidenceWindowDays))
        ? 'evidence_window'
        : undefined;

  const axes: AxisVerdict[] = leans.map((x) => {
    if (!x.eligible) return { ...x, status: 'not_enough' };
    const report = trackFor(tracks, x.axis, 'report');
    const game = trackFor(tracks, x.axis, 'quest');
    const stab = effectiveStability(report, now);
    const s = sampleFromLean(x.lean);
    const g = evidenceWeight(x.consistency, x.scenes, stab);
    const from = game ? clamp01(game.value) : SCORE.neutralGame;
    const to = previewGameValue(game ? game.value : null, s, g);
    const base = { ...x, s, g, from, to, delta: to - from };
    if (why) return { ...base, status: 'not_counted' };
    if (isContradiction(s, report ? { value: report.value, stability: stab } : null)) return { ...base, status: 'contradiction' };
    const last = input.lastAppliedAt?.[x.axis];
    if (last && within(last, now, SCORE.axisCooldownDays)) return { ...base, status: 'cooldown' };
    return { ...base, status: 'apply' };
  });

  const rank = (v: AxisVerdict) => v.consistency * Math.abs(v.lean);
  const order = (a: AxisVerdict, b: AxisVerdict) =>
    rank(b) - rank(a) || b.scenes - a.scenes || QUEST_AXIS_SET.indexOf(a.axis) - QUEST_AXIS_SET.indexOf(b.axis);
  const ranked = axes.filter((v) => v.status === 'apply').sort(order);
  for (const v of ranked.slice(SCORE.maxAxesPerRun)) v.status = 'over_limit';
  const apply = ranked.slice(0, SCORE.maxAxesPerRun);

  return {
    counts: !why,
    ...(why ? { why } : {}),
    axes,
    apply,
    notEnough: axes.filter((v) => v.status === 'not_enough').map((v) => v.axis),
  };
}
