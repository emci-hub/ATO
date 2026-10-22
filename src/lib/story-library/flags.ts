/**
 * Story Library runtime.
 *
 * Off (this build): Explore deep dives and Legends still use the shared AI
 * library on the server. The client `generateText` fallback is closed either
 * way, so a missing library does not call a model from the phone.
 * On: both surfaces assemble approved library copy on the phone. No model
 * call, no token charge, no AI badge.
 *
 * Kept out of `dev-mode.ts` on purpose: that file also holds Play's
 * everything-free switch, and a Play task must not edit it for this.
 */
function readStoryLibraryRuntime(): boolean {
  return false;
}

export const STORY_LIBRARY_RUNTIME: boolean = readStoryLibraryRuntime();
