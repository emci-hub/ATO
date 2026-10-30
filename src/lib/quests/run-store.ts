import { campaignById } from '@/lib/quests/content';
import { migrateSave, type MigrateResult } from '@/lib/quests/migrate-save';
import { toSave, type CampaignLookup, type RunAction, type RunState } from '@/lib/quests/run';
import type { QuestCampaign } from '@/lib/quests/types';

/**
 * Quests saves on the device (ATO-BUILD PHASE-14). Every key is under
 * `ato.quests.`, so `clearLocalAccountData` (deny by default) wipes them on
 * sign-out and account deletion; nothing here holds a user id.
 *
 * The storage is passed in (`createRunStore(kv)`) so the offline check can run
 * it on a Map; the app uses `runStore`, which reaches AsyncStorage lazily.
 */
export const QUEST_RUN_KEY = 'ato.quests.run.v1';
/** Endings found + as-me evidence stamps per campaign. Separate from the run so a restart keeps it. */
export const QUEST_PROGRESS_KEY = 'ato.quests.progress.v1';
/** PHASE-23's tutorial flag; listed here so every Quests key lives in one place. */
export const QUEST_TUTORIAL_KEY = 'ato.quests.tutorial.v1';

export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface QuestProgress {
  /** Ending ids found, per campaign. */
  endings: Record<string, string[]>;
  /** Completion times (ISO) of as-me runs, per campaign. A UX mirror only (R09). */
  evidence: Record<string, string[]>;
}

const EMPTY: QuestProgress = { endings: {}, evidence: {} };
const MAX_STAMPS = 20;

function parseProgress(raw: string | null): QuestProgress {
  if (!raw) return { endings: {}, evidence: {} };
  try {
    const v = JSON.parse(raw) as unknown;
    const map = (m: unknown): Record<string, string[]> => {
      if (typeof m !== 'object' || m === null || Array.isArray(m)) return {};
      const out: Record<string, string[]> = {};
      for (const [k, list] of Object.entries(m)) {
        if (Array.isArray(list)) out[k] = list.filter((x): x is string => typeof x === 'string').slice(-MAX_STAMPS);
      }
      return out;
    };
    const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
    return { endings: map(o.endings), evidence: map(o.evidence) };
  } catch {
    return { endings: {}, evidence: {} };
  }
}

/** "N of M endings found": only ids that are still endings of this campaign count. */
export function endingsFound(progress: QuestProgress, campaign: QuestCampaign): { found: number; total: number } {
  const ids = new Set(progress.endings[campaign.id] ?? []);
  return { found: campaign.endings.filter((e) => ids.has(e.id)).length, total: campaign.endings.length };
}

export function createRunStore(kv: KV, lookup: CampaignLookup = campaignById) {
  const quiet = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      console.log('[quests] storage skipped:', err instanceof Error ? err.message : err);
      return fallback;
    }
  };

  const loadProgress = () => quiet(async () => parseProgress(await kv.getItem(QUEST_PROGRESS_KEY)), EMPTY);
  const writeProgress = (p: QuestProgress) => quiet(() => kv.setItem(QUEST_PROGRESS_KEY, JSON.stringify(p)), undefined);

  // Every read-then-write runs one at a time, in call order, so two quick taps
  // can't lose an ending or a stamp, and an older save never lands last.
  let queue: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  const addEnding = async (campaignId: string, endingId: string) => {
    const p = await loadProgress();
    const list = p.endings[campaignId] ?? [];
    if (list.includes(endingId)) return;
    await writeProgress({ ...p, endings: { ...p.endings, [campaignId]: [...list, endingId] } });
  };
  const addEvidence = async (campaignId: string, now: Date) => {
    const p = await loadProgress();
    const list = [...(p.evidence[campaignId] ?? []), now.toISOString()].slice(-MAX_STAMPS);
    await writeProgress({ ...p, evidence: { ...p.evidence, [campaignId]: list } });
  };
  const writeRun = (state: RunState) =>
    quiet(() => (state.phase === 'select' ? kv.removeItem(QUEST_RUN_KEY) : kv.setItem(QUEST_RUN_KEY, JSON.stringify(toSave(state)))), undefined);

  return {
    /**
     * The saved run, migrated to the current content; null when there is none
     * (or it was unreadable). A run that resumes on its ending (killed on the
     * last beat) marks that ending found here, since no step will.
     */
    loadRun: (): Promise<MigrateResult> =>
      inTurn(async () => {
        const result = await quiet(async () => migrateSave(await kv.getItem(QUEST_RUN_KEY), lookup), {
          run: null,
          why: 'corrupt' as const,
        });
        if (result.run?.endingId) await addEnding(result.run.campaignId, result.run.endingId);
        return result;
      }),
    saveRun: (state: RunState) => inTurn(() => writeRun(state)),
    clearRun: () => inTurn(() => quiet(() => kv.removeItem(QUEST_RUN_KEY), undefined)),
    loadProgress: () => inTurn(loadProgress),
    recordEnding: (campaignId: string, endingId: string) => inTurn(() => addEnding(campaignId, endingId)),
    recordEvidence: (campaignId: string, now: Date) => inTurn(() => addEvidence(campaignId, now)),

    /**
     * The side effects of one reducer step: save after every change (so after
     * every commit), mark the ending found whenever one is showing (it counts
     * once), and on the Said screen either keep the evidence stamp ("finish",
     * as-me only) or drop the run with nothing kept ("I was messing around").
     */
    afterAction: (prev: RunState, action: RunAction, next: RunState, now: Date): Promise<void> =>
      inTurn(async () => {
        const shown = next.phase !== 'select' ? next : prev;
        if (shown.phase !== 'select' && shown.endingId) await addEnding(shown.campaignId, shown.endingId);
        if (action.type === 'finish' && prev.phase === 'said' && prev.mode === 'me') await addEvidence(prev.campaignId, now);
        if (prev !== next) await writeRun(next);
      }),
  };
}

export type RunStore = ReturnType<typeof createRunStore>;

/** AsyncStorage, imported on first use so this module stays importable off-device. */
const asyncStorageKV: KV = {
  async getItem(key) {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.removeItem(key);
  },
};

export const runStore = createRunStore(asyncStorageKV);
