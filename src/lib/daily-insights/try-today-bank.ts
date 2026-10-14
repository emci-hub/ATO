/**
 * 🎯 Try this today — 44 hand-written lines, one per category × lean × mode.
 * Stored copy, picked on the phone, never a model call. Ids are forever.
 *
 * Every task is free, solo, under 15 minutes and fine to skip, with no money,
 * driving, alcohol, food, quitting a job or an ex (emci 2026-10-14; rule 10b,
 * `taskSafetyViolations`). Lines that broke it were rewritten in place, ids kept.
 *
 * Lean meaning follows STORY_LEAN_PHRASES (Love high = lean in close,
 * Independence high = own way, Structure high = planner). The three map
 * categories are provisional until emci signs their leans off.
 */
import type { CategoryId } from '@/lib/categories';
import type { TraitLean } from '@/lib/traits';

import type { InsightMode, TryTodayLine } from './types';

const PROVISIONAL: readonly CategoryId[] = ['cat_love', 'cat_independence', 'cat_structure'];

function line(
  categoryId: CategoryId,
  lean: TraitLean,
  mode: InsightMode,
  tone: TryTodayLine['tone'],
  text: string,
): TryTodayLine {
  return {
    id: `${categoryId}.${lean}.${mode}`,
    categoryId,
    lean,
    mode,
    setting: 'any',
    text,
    tone,
    ...(PROVISIONAL.includes(categoryId) ? { provisional: true } : {}),
  };
}

export const TRY_TODAY_BANK: readonly TryTodayLine[] = [
  line('cat_steadiness', 'high', 'strength', 'plain', 'Be the calm one today: when plans wobble, offer the fix first.'),
  line('cat_steadiness', 'high', 'stretch', 'light', 'Let one small plan change without fixing it. Chaos is just plans with confetti.'),
  line('cat_steadiness', 'low', 'strength', 'plain', "Ride your restless energy: knock out the task you've been circling, fast."),
  line('cat_steadiness', 'low', 'stretch', 'plain', 'Finish one small thing before starting a new one. Just one.'),
  line('cat_openness', 'high', 'strength', 'light', "Play one song you'd never pick. Five minutes, no commitment."),
  line('cat_openness', 'high', 'stretch', 'light', 'Rewatch an old favourite. Comfort counts as culture.'),
  line('cat_openness', 'low', 'strength', 'plain', 'Write down your go-to trick for a task you nail. Reliable is a superpower.'),
  line('cat_openness', 'low', 'stretch', 'dark', "Change one tiny habit today. If it's worse, it was research."),
  line('cat_drive', 'high', 'strength', 'plain', 'Give the hardest task ten minutes before noon.'),
  line('cat_drive', 'high', 'stretch', 'light', 'Take a real 10-minute break. Productivity can wait in the lobby.'),
  line('cat_drive', 'low', 'strength', 'light', "Pick something purely because it's fun. That counts."),
  line('cat_drive', 'low', 'stretch', 'plain', 'Set one 10-minute goal and tick it off.'),
  line('cat_agency', 'high', 'strength', 'plain', 'Fix one annoying thing nobody else will.'),
  line('cat_agency', 'high', 'stretch', 'plain', "Ask for help on something you'd normally solo."),
  line('cat_agency', 'low', 'strength', 'plain', 'Notice one thing that went right today, and that you caused it.'),
  line('cat_agency', 'low', 'stretch', 'light', 'Make one decision in under 10 seconds. Socks count.'),
  line('cat_social', 'high', 'strength', 'plain', 'Introduce two people who should know each other.'),
  line('cat_social', 'high', 'stretch', 'dark', 'Spend ten minutes with zero chats. Your phone will survive. Probably.'),
  line('cat_social', 'low', 'strength', 'plain', 'Send one thoughtful text instead of showing up. Quality over crowds.'),
  line('cat_social', 'low', 'stretch', 'plain', 'Say one extra sentence to someone you usually just nod at.'),
  line('cat_communication', 'high', 'strength', 'plain', 'Settle one small debate kindly, with both sides winning.'),
  line('cat_communication', 'high', 'stretch', 'light', 'Listen to a full story without adding yours. Bite your tongue, gently.'),
  line('cat_communication', 'low', 'strength', 'light', "Write the message you'd usually say out loud. Edit is your friend."),
  line('cat_communication', 'low', 'stretch', 'plain', 'Share one small preference out loud today. Song picks count.'),
  line('cat_love', 'high', 'strength', 'plain', 'Tell someone one specific thing you like about them.'),
  line('cat_love', 'high', 'stretch', 'dark', "Give someone space today. The silence isn't plotting. Mostly."),
  line('cat_love', 'low', 'strength', 'light', 'Give yourself ten quiet minutes. Self-company is still company.'),
  line('cat_love', 'low', 'stretch', 'plain', 'Answer one "how are you" honestly.'),
  line('cat_independence', 'high', 'strength', 'light', 'Take yourself on a solo mission. Tell nobody the plan.'),
  line('cat_independence', 'high', 'stretch', 'plain', 'Let someone else pick the plan today.'),
  line('cat_independence', 'low', 'strength', 'plain', 'Send one person an idea for a plan. Just the idea.'),
  line('cat_independence', 'low', 'stretch', 'plain', 'Do one errand alone, on purpose.'),
  line('cat_levity', 'high', 'strength', 'light', 'Make one person laugh before noon.'),
  line('cat_levity', 'high', 'stretch', 'light', 'Sit with one serious moment without a joke. Hard mode.'),
  line('cat_levity', 'low', 'strength', 'plain', 'Be the honest one in a room full of jokes.'),
  line('cat_levity', 'low', 'stretch', 'light', 'Send a meme. Any meme. We believe in you.'),
  line('cat_structure', 'high', 'strength', 'plain', 'Plan tomorrow in three bullet points.'),
  line('cat_structure', 'high', 'stretch', 'dark', 'Leave ten minutes unplanned on purpose. The calendar will cope. Barely.'),
  line('cat_structure', 'low', 'strength', 'light', 'Do the first small, free, fun idea you get today.'),
  line('cat_structure', 'low', 'stretch', 'light', 'Write one to-do list. Then ignore half of it, proudly.'),
  line('cat_resilience', 'high', 'strength', 'plain', "Volunteer for the task everyone's scared of."),
  line('cat_resilience', 'high', 'stretch', 'plain', 'Admit one thing is hard, out loud.'),
  line('cat_resilience', 'low', 'strength', 'plain', 'Use your favourite calm-down move, guilt-free.'),
  line('cat_resilience', 'low', 'stretch', 'dark', 'Try one tiny thing you might get wrong. Low stakes, good story.'),
];

const BY_ID = new Map(TRY_TODAY_BANK.map((row) => [row.id, row]));

export function tryTodayLineById(id: string): TryTodayLine | null {
  return BY_ID.get(id) ?? null;
}
