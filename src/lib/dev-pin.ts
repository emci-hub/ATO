/**
 * The dev PIN — ONE lock for the whole app, and it is Divecore's.
 *
 * Divecore's hub already has a "Dev" PIN box (`play/dev-unlock-row.tsx`) backed
 * by a session-only local lock (`play/dev-lock.ts`). The main app reuses that
 * exact lock rather than keeping a second one: entering the PIN on You unlocks
 * the app's dev tools AND Divecore's kit, and the other way round.
 *
 * Soft gate, by design (see dev-lock.ts): the PIN is compared in the app, no
 * server call, in memory only — a cold start is locked again. It keeps stray
 * taps out; it is not security. Everything that needs real protection is
 * enforced on the server regardless of this lock (root-only tools, the
 * clear-all function, AI limits).
 *
 * Pre-launch only: with PRE_LAUNCH_DEV off this is always false, so a public
 * build has no PIN door at all.
 */
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { usePlayDevUnlocked } from '@/play/dev-lock';

/** True once the dev PIN has been entered this session (and only pre-launch). */
export function useDevPinUnlocked(): boolean {
  const unlocked = usePlayDevUnlocked();
  return PRE_LAUNCH_DEV && unlocked;
}

/** Whether the PIN box should be offered at all. */
export const DEV_PIN_AVAILABLE = PRE_LAUNCH_DEV;
