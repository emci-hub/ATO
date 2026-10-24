/**
 * ⚡ Superpower / 🪫 Kryptonite — one of each per BAR category (8 × 2 = 16).
 * Map categories never appear here, so nothing in this bank is provisional.
 * Stored copy, never a model call.
 */
import type { CategoryId } from '@/lib/categories';

import type { SuperpowerLine } from './types';

function row(
  categoryId: CategoryId,
  kind: SuperpowerLine['kind'],
  title: string,
  text: string,
  tip: string,
): SuperpowerLine {
  return { categoryId, kind, title, text, tip };
}

export const SUPERPOWER_BANK: readonly SuperpowerLine[] = [
  row('cat_steadiness', 'superpower', 'Calm on tap', 'You stay level even when everyone else wobbles.', 'Be the one who says "here\'s the plan".'),
  row('cat_steadiness', 'kryptonite', 'The wobble', 'Small shakes hit you harder than they should.', 'Name the wobble out loud. It shrinks.'),
  row('cat_openness', 'superpower', 'New-thing magnet', 'Untried paths look like fun to you, not risk.', 'Bring a friend on your next odd idea.'),
  row('cat_openness', 'kryptonite', 'Comfort lock', "New stuff can feel like more effort than it's worth.", 'Try one tiny new thing a week.'),
  row('cat_drive', 'superpower', 'Finish line brain', 'Once you start, you want it done.', 'Pick the one task that matters most first.'),
  row('cat_drive', 'kryptonite', 'Low battery', 'Getting started costs you more than finishing.', 'Make the first step silly-small.'),
  row('cat_agency', 'superpower', 'Main character energy', 'You treat the outcome as yours to shape.', "Use it on one thing you've been putting off."),
  row('cat_agency', 'kryptonite', 'Plot happens to you', 'Some days it feels like life just deals the cards.', "Pick one choice today that's fully yours."),
  row('cat_social', 'superpower', 'People charger', 'Being around people fills your tank.', 'Start the group plan nobody else will.'),
  row('cat_social', 'kryptonite', 'Crowd drain', 'Big groups empty your tank fast.', 'Plan your exit before you arrive.'),
  row('cat_communication', 'superpower', 'Kind but clear', 'You can say the hard thing without a fight.', 'Use it once this week, gently.'),
  row('cat_communication', 'kryptonite', 'Swallowed words', 'You step back instead of pushing your view.', 'Write it down first, then say it.'),
  row('cat_levity', 'superpower', 'Mood lifter', 'You find the funny side when rooms get heavy.', 'Save one joke for the worst meeting.'),
  row('cat_levity', 'kryptonite', 'Straight face', "Jokes don't come easy when things get tense.", 'Let someone else be funny. Laugh anyway.'),
  row('cat_resilience', 'superpower', 'Pressure sharpens', 'Deadlines make you better, not worse.', "Take the scary task. You'll enjoy it, weirdly."),
  row('cat_resilience', 'kryptonite', 'Pressure dent', 'Stress lands hard and lingers.', 'Keep one go-to reset ready.'),
];

export function superpowerLineFor(categoryId: CategoryId, kind: SuperpowerLine['kind']): SuperpowerLine | null {
  return SUPERPOWER_BANK.find((r) => r.categoryId === categoryId && r.kind === kind) ?? null;
}
