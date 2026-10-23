/**
 * Story settings, shared by the free template Story (story-v3, story-bank).
 *
 * The Story was a shared-library AI kind from wave93 until 2026-10-22 (roadmap
 * A3 / S4): it has been free templates since 2026-10-14, so the AI prompt, the
 * bucket keys and the checks were removed and `ai-library` no longer accepts
 * `kind: 'story'`. Only the settings the templates are written for stay here.
 */
export const STORY_ANGLES = {
  friends: 'a plan with friends',
  work: 'a task at work or school',
  home: 'a weekend at home, an errand or a family visit',
} as const;
export type StoryAngle = keyof typeof STORY_ANGLES;
