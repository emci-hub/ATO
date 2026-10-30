import { campaignById } from '@/lib/quests/content';
import { fromSave, newRun, replayRun, resolveScene, rewindsUsed, type ActiveRun, type CampaignLookup, type Chapter, type RunPick, type RunSave } from '@/lib/quests/run';
import { STATS } from '@/lib/quests/types';
import type { QuestCampaign } from '@/lib/quests/types';

/**
 * Read a saved run back (ATO-BUILD PHASE-14, R15). Never throws.
 *
 * 1. Parse inside try/catch; refuse anything too big or the wrong shape.
 * 2. Replay the picks against the CURRENT content (redirects followed). The
 *    stats, flags and scene come from the replay, never from the file, so a
 *    hand-edited save can't move them and a content update re-routes cleanly.
 * 3. A pick or scene that no longer exists restarts that chapter: the picks
 *    from earlier chapters are kept, the endings tracker is untouched (it is
 *    a separate key), and `notice: 'restarted'` asks the screen for a kind note.
 *    A save whose campaign and run can be read but nothing else restarts the run.
 */
export const SAVE_LIMITS = {
  maxChars: 32_000,
  maxHistory: 200,
  maxFlags: 64,
  maxTyped: 200,
  maxIdChars: 80,
} as const;

export type MigrateResult =
  | { run: ActiveRun; restarted: boolean }
  | { run: null; why: 'empty' | 'corrupt' | 'unknown_campaign' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= SAVE_LIMITS.maxIdChars;
const idList = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(isId);

function isPick(v: unknown): v is RunPick {
  return (
    isObj(v) &&
    isId(v.sceneId) &&
    isId(v.choiceId) &&
    typeof v.undone === 'boolean' &&
    (v.roll === undefined || (Number.isInteger(v.roll) && (v.roll as number) >= 1 && (v.roll as number) <= 20))
  );
}

/** Shape check only; values that the replay rebuilds (stats, flags, scene) are only type-checked. */
export function isRunSave(v: unknown): v is RunSave {
  if (!isObj(v)) return false;
  if (!isId(v.campaignId) || !isId(v.runId)) return false;
  if (!Number.isInteger(v.contentVersion)) return false;
  if (!(v.sceneId === null || isId(v.sceneId))) return false;
  if (!Array.isArray(v.history) || v.history.length > SAVE_LIMITS.maxHistory || !v.history.every(isPick)) return false;
  if (!isObj(v.stats) || !STATS.every((s) => Number.isFinite((v.stats as Record<string, unknown>)[s]))) return false;
  if (!idList(v.flags, SAVE_LIMITS.maxFlags) || !idList(v.typedDone, SAVE_LIMITS.maxTyped)) return false;
  if (!isObj(v.rewinds) || !Object.entries(v.rewinds).every(([k, n]) => ['1', '2', '3', '4'].includes(k) && Number.isInteger(n) && (n as number) >= 0)) {
    return false;
  }
  if (v.mode !== 'me' && v.mode !== 'fun') return false;
  if (!(v.notice === undefined || v.notice === 'restarted')) return false;
  return true;
}

function migrate(campaign: QuestCampaign, save: RunSave): { run: ActiveRun; restarted: boolean } {
  const base = { ...save, contentVersion: campaign.contentVersion };
  const full = replayRun(campaign, save.runId, save.history);
  const savedScene = save.sceneId === null ? null : (resolveScene(campaign, save.sceneId)?.id ?? '?');
  if (full.brokenAt === null && full.sceneId === savedScene) {
    return {
      run: fromSave(campaign, {
        ...base,
        sceneId: full.sceneId,
        stats: full.stats,
        flags: full.flags,
        history: full.history,
        rewinds: rewindsUsed(campaign, full.history),
      }),
      restarted: false,
    };
  }
  // Restart the chapter the replay stopped in; when it reached the end, the chapter of the last live pick.
  const lastLive = [...full.history].reverse().find((p) => !p.undone);
  const stopScene = full.sceneId ?? lastLive?.sceneId;
  const chapter: Chapter = (stopScene ? resolveScene(campaign, stopScene)?.chapter : undefined) ?? 1;
  const live = full.brokenAt === null ? save.history : save.history.slice(0, full.brokenAt);
  const cut = replayRun(campaign, save.runId, live, chapter);
  const typed = new Set(cut.history.map((p) => p.sceneId));
  return {
    run: fromSave(campaign, {
      ...base,
      sceneId: cut.sceneId,
      stats: cut.stats,
      flags: cut.flags,
      history: cut.history,
      rewinds: rewindsUsed(campaign, cut.history),
      typedDone: save.typedDone.filter((id) => typed.has(id)),
      notice: 'restarted',
    }),
    restarted: true,
  };
}

export function migrateSave(raw: string | null | undefined, lookup: CampaignLookup = campaignById): MigrateResult {
  if (raw == null || raw === '') return { run: null, why: 'empty' };
  if (raw.length > SAVE_LIMITS.maxChars) return { run: null, why: 'corrupt' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { run: null, why: 'corrupt' };
  }
  if (!isObj(parsed) || !isId(parsed.campaignId)) return { run: null, why: 'corrupt' };
  const campaign = lookup(parsed.campaignId);
  if (!campaign) return { run: null, why: 'unknown_campaign' };
  try {
    if (isRunSave(parsed)) return migrate(campaign, parsed);
  } catch {
    // fall through to a fresh run below
  }
  // The campaign and run are readable, the rest is not: restart the run, kindly.
  if (!isId(parsed.runId)) return { run: null, why: 'corrupt' };
  const mode = parsed.mode === 'me' ? 'me' : 'fun';
  return { run: { ...newRun(campaign, parsed.runId, mode), notice: 'restarted' }, restarted: true };
}
