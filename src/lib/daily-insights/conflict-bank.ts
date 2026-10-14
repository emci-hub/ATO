/**
 * 🗣️ How you argue — five styles in our own words (no framework names).
 * Stored copy, never a model call.
 */
import type { ConflictLine, ConflictStyleId } from './types';

export const CONFLICT_BANK: readonly ConflictLine[] = [
  {
    id: 'straight_shooter',
    title: 'Straight shooter',
    text: 'You say what you think and aim to win the point.',
    strength: 'Nobody wonders where you stand.',
    watchOut: 'Winning the point can lose the room.',
    tryLine: 'Ask one question before your next counterpoint.',
  },
  {
    id: 'team_fixer',
    title: 'Team fixer',
    text: 'You push for an answer that works for everyone.',
    strength: 'You turn fights into plans.',
    watchOut: 'Not every spat needs a full meeting.',
    tryLine: 'Let one minor snag go unsolved today.',
  },
  {
    id: 'deal_maker',
    title: 'Deal maker',
    text: 'You meet in the middle and move on.',
    strength: 'Things get settled fast.',
    watchOut: 'Fast can mean nobody gets what they wanted.',
    tryLine: "Say what you'd want if you didn't have to compromise.",
  },
  {
    id: 'quiet_exit',
    title: 'Quiet exit',
    text: "You'd rather step out than step in.",
    strength: "You don't waste energy on small fights.",
    watchOut: 'Big things can rot in the quiet. Ominously.',
    tryLine: "Bring up one small thing while it's still small.",
  },
  {
    id: 'peacekeeper',
    title: 'Peacekeeper',
    text: 'You keep things smooth, even if you give ground.',
    strength: 'People feel safe around you.',
    watchOut: 'Your needs can quietly vanish.',
    tryLine: 'Say "I\'d prefer…" once this week.',
  },
];

export function conflictLineFor(id: ConflictStyleId): ConflictLine | null {
  return CONFLICT_BANK.find((row) => row.id === id) ?? null;
}
