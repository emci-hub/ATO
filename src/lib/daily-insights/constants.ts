import { STORY_MAP_CATEGORY_LEAN_TODO } from '@/lib/story-v3/lean-phrases';

/** Bump when a bank line or card shape changes. (LIBRARY_VERSION is the AI library's; not ours.) */
export const DAILY_INSIGHTS_BANK_VERSION = 2;

/**
 * Love, Independence and Structure leans are provisional until emci signs off;
 * their lines are hidden in prod. Only a dev override may flip this at runtime
 * (`resolveShowProvisional`), never a production build.
 */
export const DAILY_INSIGHTS_SHOW_PROVISIONAL = false;

/** The map categories whose high/low is not signed off. Reused, not redefined. */
export const DAILY_INSIGHTS_PROVISIONAL_CATEGORIES = STORY_MAP_CATEGORY_LEAN_TODO;
