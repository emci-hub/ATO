/**
 * Outer ceiling for one user TAP that asks the `ai-library` Edge Function for a
 * card (a Legends reveal or a deep dive). Past this the button shows its note +
 * retry instead of a spinner. Lived in `generate.ts` until roadmap A5 removed
 * the old `ai-generate` client path.
 */
export const AI_TAP_TIMEOUT_MS = 45000;
