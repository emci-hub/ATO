/**
 * Shared action pacing for Play's risky-press screens (Dive, Merge).
 *
 * Both flows want the same anti-mash rhythm: a short "searching…" beat before
 * the result lands, and a cooldown after it before the next tap is accepted.
 * The Dev kit's "Skip Dive delays" toggle short-circuits both for fast tests.
 *
 * `busy` locks every action button. `splashCopy` non-null renders the beat
 * (before the action commits); while busy with null copy we are in the short
 * post-result cooldown (result visible, buttons locked). Timers are cleaned up
 * on unmount so navigating away mid-beat cannot fire a late resolve.
 */
import { useEffect, useRef, useState } from 'react';

/** Beat before a result lands (0.8–1.2s) and the input lockout after it. */
export const ACTION_SPLASH_MS = 950;
export const ACTION_COOLDOWN_MS = 650;

export function usePacedAction(skipDelays: boolean) {
  const [busy, setBusy] = useState(false);
  const [splashCopy, setSplashCopy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  /** Lock input, show `label` as the beat, run `action`, then cooldown. */
  const act = (label: string, action: () => Promise<boolean>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const finish = () => {
      void action().then(() => {
        setSplashCopy(null);
        if (skipDelays) {
          busyRef.current = false;
          setBusy(false);
        } else {
          timers.current.push(
            setTimeout(() => {
              busyRef.current = false;
              setBusy(false);
            }, ACTION_COOLDOWN_MS),
          );
        }
      });
    };
    if (skipDelays) {
      setSplashCopy(null);
      finish();
    } else {
      setSplashCopy(label);
      timers.current.push(setTimeout(finish, ACTION_SPLASH_MS));
    }
  };

  /** True while a beat or cooldown is running (buttons disabled). */
  const showSplash = busy && splashCopy != null;

  return { act, busy, splashCopy, showSplash };
}
