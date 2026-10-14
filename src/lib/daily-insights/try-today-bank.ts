/**
 * 🎯 Try this today — 44 hand-written lines, one per category × lean × mode.
 * Stored copy, picked on the phone, never a model call. Ids are forever.
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
  line('cat_steadiness', 'high', 'stretch', 'light', 'Say yes to one unplanned thing. Chaos is just plans with confetti.'),
  line('cat_steadiness', 'low', 'strength', 'plain', "Ride your restless energy: knock out the task you've been circling, fast."),
  line('cat_steadiness', 'low', 'stretch', 'plain', 'Finish one small thing before starting a new one. Just one.'),
  line('cat_openness', 'high', 'strength', 'light', "Try one food, song or show you've never tried."),
  line('cat_openness', 'high', 'stretch', 'light', 'Rewatch an old favourite. Comfort counts as culture.'),
  line('cat_openness', 'low', 'strength', 'plain', 'Teach someone your go-to recipe, route or trick. Reliable is a superpower.'),
  line('cat_openness', 'low', 'stretch', 'dark', "Take a different road home. If it's worse, it was research."),
  line('cat_drive', 'high', 'strength', 'plain', 'Pick the hardest task and do it before lunch.'),
  line('cat_drive', 'high', 'stretch', 'light', 'Take a real 20-minute break. Productivity can wait in the lobby.'),
  line('cat_drive', 'low', 'strength', 'light', "Do one thing only because it's fun. That counts."),
  line('cat_drive', 'low', 'stretch', 'plain', 'Set one 10-minute goal and tick it off.'),
  line('cat_agency', 'high', 'strength', 'plain', 'Fix one annoying thing nobody else will.'),
  line('cat_agency', 'high', 'stretch', 'plain', "Ask for help on something you'd normally solo."),
  line('cat_agency', 'low', 'strength', 'plain', 'Notice one thing that went right today, and that you caused it.'),
  line('cat_agency', 'low', 'stretch', 'light', 'Make one decision in under 10 seconds. Lunch counts.'),
  line('cat_social', 'high', 'strength', 'plain', 'Introduce two people who should know each other.'),
  line('cat_social', 'high', 'stretch', 'dark', 'Spend one hour with zero chats. Your phone will survive. Probably.'),
  line('cat_social', 'low', 'strength', 'plain', 'Send one thoughtful text instead of showing up. Quality over crowds.'),
  line('cat_social', 'low', 'stretch', 'plain', 'Say one extra sentence to someone you usually just nod at.'),
  line('cat_communication', 'high', 'strength', 'plain', 'Settle one small debate kindly, with both sides winning.'),
  line('cat_communication', 'high', 'stretch', 'light', 'Listen to a full story without adding yours. Bite your tongue, gently.'),
  line('cat_communication', 'low', 'strength', 'light', "Write the message you'd usually say out loud. Edit is your friend."),
  line('cat_communication', 'low', 'stretch', 'plain', 'Share one small preference out loud today. Pizza toppings count.'),
  line('cat_love', 'high', 'strength', 'plain', 'Tell someone one specific thing you like about them.'),
  line('cat_love', 'high', 'stretch', 'dark', "Give someone space today. The silence isn't plotting. Probably."),
  line('cat_love', 'low', 'strength', 'light', 'Plan a solo treat. Self-company is still company.'),
  line('cat_love', 'low', 'stretch', 'plain', 'Answer one "how are you" honestly.'),
  line('cat_independence', 'high', 'strength', 'light', 'Take yourself on a solo mission. Tell nobody the plan.'),
  line('cat_independence', 'high', 'stretch', 'plain', 'Let someone else pick the plan today.'),
  line('cat_independence', 'low', 'strength', 'plain', 'Start a group plan for the weekend.'),
  line('cat_independence', 'low', 'stretch', 'plain', 'Do one errand alone, on purpose.'),
  line('cat_levity', 'high', 'strength', 'light', 'Make one person laugh before noon.'),
  line('cat_levity', 'high', 'stretch', 'light', 'Sit with one serious moment without a joke. Hard mode.'),
  line('cat_levity', 'low', 'strength', 'plain', 'Be the honest one in a room full of jokes.'),
  line('cat_levity', 'low', 'stretch', 'light', 'Send a meme. Any meme. We believe in you.'),
  line('cat_structure', 'high', 'strength', 'plain', 'Plan tomorrow in three bullet points.'),
  line('cat_structure', 'high', 'stretch', 'dark', 'Leave one hour with no plan at all. The calendar will cope. Barely.'),
  line('cat_structure', 'low', 'strength', 'light', 'Say yes to the first fun idea of the day.'),
  line('cat_structure', 'low', 'stretch', 'light', 'Write one to-do list. Then ignore half of it, proudly.'),
  line('cat_resilience', 'high', 'strength', 'plain', "Volunteer for the task everyone's scared of."),
  line('cat_resilience', 'high', 'stretch', 'plain', 'Admit one thing is hard, out loud.'),
  line('cat_resilience', 'low', 'strength', 'plain', 'Do one thing that always calms you, guilt-free.'),
  line('cat_resilience', 'low', 'stretch', 'dark', 'Try one tiny thing you might get wrong. Low stakes, good story.'),
];

const BY_ID = new Map(TRY_TODAY_BANK.map((row) => [row.id, row]));

export function tryTodayLineById(id: string): TryTodayLine | null {
  return BY_ID.get(id) ?? null;
}
