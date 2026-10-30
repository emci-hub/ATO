import { useCallback, useEffect, useRef, useState } from 'react';

import { campaignById } from '@/lib/quests/content';
import { SELECT, reduceRun, startMode, type RunAction, type RunMode, type RunState } from '@/lib/quests/run';
import { runStore } from '@/lib/quests/run-store';

/**
 * Drives one Quests run on a screen (ATO-BUILD PHASE-16). The reducer is the
 * only thing that changes a run; every step also goes through
 * `runStore.afterAction` (save after each commit, mark the ending found, keep
 * or drop the evidence stamp), and callers `await` it so two quick taps are
 * saved in the order they were made.
 */
export type RunStatus = 'loading' | 'ready' | 'missing';

const newRunId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function useQuestRun(campaignId: string, opts: { mode: RunMode; fresh: boolean }) {
  const [run, setRun] = useState<RunState>(SELECT);
  const [status, setStatus] = useState<RunStatus>('loading');
  /** True when a saved run was picked up (its text then shows in full). */
  const [resumed, setResumed] = useState(false);
  /** Set when "As me" turned into "for fun" because a counted run is under 30 days old. */
  const [funBecause, setFunBecause] = useState<'evidence_window' | null>(null);
  const runRef = useRef<RunState>(SELECT);

  const put = useCallback((next: RunState) => {
    runRef.current = next;
    setRun(next);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!campaignById(campaignId)) {
        setStatus('missing');
        return;
      }
      if (opts.fresh) await runStore.clearRun();
      const loaded = await runStore.loadRun();
      if (!alive) return;
      if (!opts.fresh && loaded.run && loaded.run.campaignId === campaignId) {
        put(loaded.run);
        setResumed(true);
        setStatus('ready');
        return;
      }
      const progress = await runStore.loadProgress();
      if (!alive) return;
      const now = new Date();
      const { mode, why } = startMode(opts.mode, progress.evidence[campaignId] ?? [], now);
      const action: RunAction = { type: 'start', campaignId, runId: newRunId(), mode };
      const next = reduceRun(SELECT, action);
      put(next);
      setFunBecause(why ?? null);
      setStatus('ready');
      await runStore.afterAction(SELECT, action, next, now);
    })().catch((err) => {
      console.log('[quests] run load failed:', err instanceof Error ? err.message : err);
      if (alive) setStatus('missing');
    });
    return () => {
      alive = false;
    };
    // The route params are read once per mount: a different quest is a different screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  /** One reducer step, then its side effects. The ref moves first, so the next tap sees this state. */
  const dispatch = useCallback(
    async (action: RunAction): Promise<void> => {
      const prev = runRef.current;
      const next = reduceRun(prev, action);
      if (next === prev) return;
      put(next);
      await runStore.afterAction(prev, action, next, new Date());
    },
    [put],
  );

  return { run, status, resumed, funBecause, dispatch };
}
