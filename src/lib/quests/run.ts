import { campaignById } from '@/lib/quests/content';
import { resolveCheck } from '@/lib/quests/d20';
import { SCORE, type QuestPick } from '@/lib/quests/score';
import { LIMITS } from '@/lib/quests/strings';
import { STATS } from '@/lib/quests/types';
import type { FlagGate, QuestCampaign, QuestChoice, QuestEnding, QuestScene, Stat, StoryLine } from '@/lib/quests/types';

/**
 * Quests run engine (ATO-BUILD PHASE-14). Pure reducer: no I/O, no clock.
 *
 *   select → scene → commit → beat → scene … → ending → said → select
 *
 * The picks log is the run: stats, flags and the scene are always what
 * replaying the live (not undone) picks from the first scene gives. Rewind and
 * a resumed save both replay, so a d20 roll (seeded by run, scene and choice)
 * can never come out differently. The 30-day rule here only labels a run "for
 * fun" on screen; the server decides what counts (R09, PHASE-17).
 */
export type RunPhase = 'select' | 'scene' | 'commit' | 'beat' | 'ending' | 'said';
export type RunMode = 'me' | 'fun';
export type Chapter = QuestScene['chapter'];

/** One logged pick, exactly what score.ts reads, plus the roll for the screen. */
export interface RunPick extends QuestPick {
  undone: boolean;
  /** The d20 roll when the choice had a check. */
  roll?: number;
}

/** The AsyncStorage shape (`ato.quests.run.v1`). */
export interface RunSave {
  campaignId: string;
  contentVersion: number;
  runId: string;
  /** null = the story has ended and the ending is showing. */
  sceneId: string | null;
  history: RunPick[];
  stats: Record<Stat, number>;
  flags: string[];
  /** Rewinds used, per chapter ("1"…"4"). */
  rewinds: Partial<Record<string, number>>;
  mode: RunMode;
  /** Scenes whose text has finished typing (shown in full from then on). */
  typedDone: string[];
  /** Set when a save could not be followed and the chapter restarted. */
  notice?: 'restarted';
}

export type RunState =
  | { phase: 'select' }
  | (RunSave & {
      phase: Exclude<RunPhase, 'select'>;
      /** The choice tapped in the commit phase. */
      pending?: string;
      /** Set in the ending and said phases. */
      endingId?: string;
    });
export type ActiveRun = Exclude<RunState, { phase: 'select' }>;

export type RunAction =
  | { type: 'start'; campaignId: string; runId: string; mode: RunMode }
  | { type: 'typed'; sceneId: string }
  | { type: 'select'; choiceId: string }
  | { type: 'cancel' }
  | { type: 'commit' }
  | { type: 'continue' }
  | { type: 'rewind' }
  /** Said screen: keep the run. */
  | { type: 'finish' }
  /** Said screen: "I was messing around". */
  | { type: 'discard' }
  | { type: 'dismissNotice' };

export type CampaignLookup = (id: string) => QuestCampaign | undefined;

export const RUN = {
  rewindsPerChapter: 1,
  /** Redirect hops followed before an id counts as unknown. */
  maxRedirects: 5,
} as const;

export const SELECT: RunState = { phase: 'select' };
const DAY_MS = 86_400_000;

// --- content helpers -----------------------------------------------------------

export const clampStat = (n: number): number => Math.max(0, Math.min(LIMITS.statMax, Math.round(n)));

export const gateOpen = (gate: FlagGate | undefined, flags: readonly string[]): boolean =>
  !gate || ((gate.flags ?? []).every((f) => flags.includes(f)) && !(gate.notFlags ?? []).some((f) => flags.includes(f)));

/** The live scene an id points at, following retired redirects; undefined = unknown. */
export function resolveScene(campaign: QuestCampaign, id: string): QuestScene | undefined {
  let s = campaign.scenes.find((x) => x.id === id);
  for (let hops = 0; s?.retired && s.redirect && hops < RUN.maxRedirects; hops += 1) {
    const to = s.redirect;
    s = campaign.scenes.find((x) => x.id === to);
  }
  return s && !s.retired ? s : undefined;
}

/** Where a move lands: redirects followed, gated scenes skipped to their `next`. null = the end. */
export function enterScene(campaign: QuestCampaign, id: string | null, flags: readonly string[]): string | null {
  let cur = id;
  for (let hops = 0; cur !== null && hops <= campaign.scenes.length; hops += 1) {
    const s = resolveScene(campaign, cur);
    if (!s) return null;
    if (gateOpen(s.requires, flags)) return s.id;
    cur = s.next;
  }
  return null;
}

/** The scene's lines: the first variant whose gate is open, else the base lines. */
export function sceneLines(scene: QuestScene, flags: readonly string[]): StoryLine[] {
  return scene.variants?.find((v) => gateOpen(v.requires, flags))?.lines ?? scene.lines;
}

/** First ending whose `when` matches; the last one is the fallback. */
export function pickEnding(campaign: QuestCampaign, stats: Record<Stat, number>, flags: readonly string[]): QuestEnding {
  const match = campaign.endings.find(
    (e) =>
      gateOpen(e.when, flags) &&
      Object.entries(e.when.minStat ?? {}).every(([stat, min]) => stats[stat as Stat] >= (min ?? 0)),
  );
  return match ?? campaign.endings[campaign.endings.length - 1];
}

/** The picks log score.ts expects. */
export const picksOf = (run: Pick<RunSave, 'history'>): QuestPick[] =>
  run.history.map(({ sceneId, choiceId, undone }) => ({ sceneId, choiceId, undone }));

/** "Play as me" turns into "for fun" when an as-me run of this campaign counted in the last 30 days. */
export function startMode(
  chosen: RunMode,
  priorEvidence: readonly string[],
  now: Date,
): { mode: RunMode; why?: 'evidence_window' } {
  if (chosen === 'fun') return { mode: 'fun' };
  const inside = priorEvidence.some((iso) => {
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && now.getTime() - t < SCORE.evidenceWindowDays * DAY_MS; // a future stamp is inside
  });
  return inside ? { mode: 'fun', why: 'evidence_window' } : { mode: 'me' };
}

// --- replay --------------------------------------------------------------------

interface Position {
  sceneId: string | null;
  stats: Record<Stat, number>;
  flags: string[];
}

/** One pick from a position. The check rolls on the stats shown with its odds (before the choice's own change). */
function step(campaign: QuestCampaign, runId: string, at: Position, scene: QuestScene, choice: QuestChoice) {
  const stats = { ...at.stats };
  for (const stat of STATS) stats[stat] = clampStat(stats[stat] + (choice.stats?.[stat] ?? 0));
  const flags = [...at.flags];
  for (const f of choice.setFlags ?? []) if (!flags.includes(f)) flags.push(f);
  const d20 = choice.check ? resolveCheck(choice.check, at.stats, runId, scene.id, choice.id) : undefined;
  const target = choice.check ? (d20?.success ? choice.check.success : choice.check.fail) : (choice.next ?? scene.next);
  const pick: RunPick = { sceneId: scene.id, choiceId: choice.id, undone: false, ...(d20 ? { roll: d20.roll } : {}) };
  return { at: { sceneId: enterScene(campaign, target, flags), stats, flags }, pick };
}

export const startPosition = (campaign: QuestCampaign): Position => ({
  sceneId: enterScene(campaign, campaign.firstScene, []),
  stats: { ...campaign.startStats },
  flags: [],
});

export interface Replay extends Position {
  history: RunPick[];
  /** Index of the first live pick that no longer fits the content; null = all fit. */
  brokenAt: number | null;
}

/**
 * Replay a picks log from the first scene. Undone picks are kept (ids mapped
 * through redirects) and change nothing; an undone pick whose scene or choice
 * is gone is dropped. `stopBeforeChapter` stops at the first live pick made in
 * that chapter or a later one (a chapter restart).
 */
export function replayRun(
  campaign: QuestCampaign,
  runId: string,
  history: readonly RunPick[],
  stopBeforeChapter?: Chapter,
): Replay {
  let at = startPosition(campaign);
  const out: RunPick[] = [];
  for (let i = 0; i < history.length; i += 1) {
    const p = history[i];
    const scene = resolveScene(campaign, p.sceneId);
    const choice = scene?.choices.find((c) => c.id === p.choiceId);
    if (p.undone) {
      // A restarted chapter gets its Rewind back, so its undone picks go too.
      if (stopBeforeChapter !== undefined && scene && scene.chapter >= stopBeforeChapter) continue;
      if (scene && choice) out.push({ sceneId: scene.id, choiceId: choice.id, undone: true, ...(p.roll ? { roll: p.roll } : {}) });
      continue;
    }
    if (!scene || !choice || at.sceneId !== scene.id) return { ...at, history: out, brokenAt: i };
    if (stopBeforeChapter !== undefined && scene.chapter >= stopBeforeChapter) return { ...at, history: out, brokenAt: null };
    const next = step(campaign, runId, at, scene, choice);
    at = next.at;
    out.push(next.pick);
  }
  return { ...at, history: out, brokenAt: null };
}

// --- reducer -------------------------------------------------------------------

/** Phase after landing somewhere: a scene, or the ending. */
function landed(campaign: QuestCampaign, run: RunSave): ActiveRun {
  if (run.sceneId === null) {
    return { ...run, phase: 'ending', endingId: pickEnding(campaign, run.stats, run.flags).id };
  }
  return { ...run, phase: 'scene' };
}

export function newRun(campaign: QuestCampaign, runId: string, mode: RunMode): ActiveRun {
  const at = startPosition(campaign);
  return landed(campaign, {
    campaignId: campaign.id,
    contentVersion: campaign.contentVersion,
    runId,
    sceneId: at.sceneId,
    history: [],
    stats: at.stats,
    flags: at.flags,
    rewinds: {},
    mode,
    typedDone: [],
  });
}

/** Rewinds used per chapter, counted from the undone picks (never read from a file). */
export function rewindsUsed(campaign: QuestCampaign, history: readonly RunPick[]): RunSave['rewinds'] {
  const out: RunSave['rewinds'] = {};
  for (const p of history) {
    const chapter = p.undone ? resolveScene(campaign, p.sceneId)?.chapter : undefined;
    if (chapter) out[String(chapter)] = (out[String(chapter)] ?? 0) + 1;
  }
  return out;
}

/** The pick a Rewind would undo, and whether one is left for its chapter. */
export function rewindTarget(campaign: QuestCampaign, run: RunSave): { index: number; chapter: Chapter } | null {
  for (let i = run.history.length - 1; i >= 0; i -= 1) {
    if (run.history[i].undone) continue;
    const scene = resolveScene(campaign, run.history[i].sceneId);
    if (!scene) return null;
    if ((run.rewinds[String(scene.chapter)] ?? 0) >= RUN.rewindsPerChapter) return null;
    return { index: i, chapter: scene.chapter };
  }
  return null;
}

export function reduceRun(state: RunState, action: RunAction, lookup: CampaignLookup = campaignById): RunState {
  if (action.type === 'start') {
    if (state.phase !== 'select') return state;
    const campaign = lookup(action.campaignId);
    return campaign ? newRun(campaign, action.runId, action.mode) : state;
  }
  if (state.phase === 'select') return state;
  const campaign = lookup(state.campaignId);
  if (!campaign) return SELECT;
  const save = toSave(state);

  switch (action.type) {
    case 'typed':
      return state.typedDone.includes(action.sceneId) ? state : { ...state, typedDone: [...state.typedDone, action.sceneId] };

    case 'select': {
      if (state.phase !== 'scene' && state.phase !== 'commit') return state;
      const scene = state.sceneId ? resolveScene(campaign, state.sceneId) : undefined;
      if (!scene?.choices.some((c) => c.id === action.choiceId)) return state;
      return { ...state, phase: 'commit', pending: action.choiceId };
    }

    case 'cancel':
      return state.phase === 'commit' ? { ...save, phase: 'scene' } : state;

    case 'commit': {
      if (state.phase !== 'commit' || !state.sceneId) return state;
      const scene = resolveScene(campaign, state.sceneId);
      const choice = scene?.choices.find((c) => c.id === state.pending);
      if (!scene || !choice) return state;
      const next = step(campaign, state.runId, state, scene, choice);
      return { ...save, ...next.at, history: [...state.history, next.pick], phase: 'beat' };
    }

    case 'continue':
      if (state.phase === 'beat') return landed(campaign, save);
      if (state.phase === 'ending') return { ...save, phase: 'said', endingId: state.endingId };
      return state;

    case 'rewind': {
      if (state.phase !== 'scene' && state.phase !== 'commit' && state.phase !== 'beat') return state;
      const target = rewindTarget(campaign, state);
      if (!target) return state;
      const history = state.history.map((p, i) => (i === target.index ? { ...p, undone: true } : p));
      const r = replayRun(campaign, state.runId, history);
      return landed(campaign, {
        ...save,
        sceneId: r.sceneId,
        stats: r.stats,
        flags: r.flags,
        history: r.history,
        rewinds: rewindsUsed(campaign, r.history),
      });
    }

    case 'finish':
    case 'discard':
      return state.phase === 'said' ? SELECT : state;

    case 'dismissNotice': {
      if (!state.notice) return state;
      const { notice: _gone, ...rest } = state;
      return rest;
    }
  }
  return state;
}

/** The saved part of a run (phase, pending choice and ending are worked out again). */
export function toSave(run: ActiveRun): RunSave {
  const { phase: _phase, pending: _pending, endingId: _ending, ...save } = run;
  return save;
}

/** Back from a save: in a scene the text shows in full, never typed again. */
export function fromSave(campaign: QuestCampaign, save: RunSave): ActiveRun {
  const run = landed(campaign, save);
  if (run.sceneId && !run.typedDone.includes(run.sceneId)) return { ...run, typedDone: [...run.typedDone, run.sceneId] };
  return run;
}
