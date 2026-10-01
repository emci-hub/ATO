/**
 * Play save ordering (v27). The Shine Stone sheet waits for this before it
 * shows a hit, and a storage reload that started before the latest commit is
 * dropped — otherwise a player can see "it worked" on pet A and, after a
 * stale reload, spend that same Stone on pet B.
 *
 * No React Native here: the checks import it under plain Node.
 */

let epoch = 0;
let queue: Promise<void> = Promise.resolve();

/** How many commits have been published. A reload records this before it reads. */
export function saveEpoch(): number {
  return epoch;
}

/** Mark a new commit. Returns the epoch that commit owns. */
export function bumpSaveEpoch(): number {
  epoch += 1;
  return epoch;
}

/** True when nothing has committed since `started` (the reload may apply). */
export function saveIsCurrent(started: number): boolean {
  return started === epoch;
}

/**
 * Run `save` after every save already queued. The returned promise rejects
 * when this save rejects; a rejection does not block the next one.
 */
export function enqueuePlaySave(save: () => Promise<void>): Promise<void> {
  const run = queue.then(save, save);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Resolves when every save queued so far has finished (success or failure). */
export function whenPlaySavesSettled(): Promise<void> {
  return queue;
}
