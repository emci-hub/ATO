/** Drive: Independence + Confidence + Connection (bar). */
import type { BarCard } from './define';

export const CAT_DRIVE: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You set your own goals and want the people close to you involved.',
        'You want the people you care about with you when you reach a goal.',
        'You work harder when the task is yours, the bar is high, and a friend is in the room.',
      ],
      strength: [
        'You take the goal in your own hands and bring your full attention to the first hour of it.',
        'You stay committed to difficult tasks even when progress feels slow.',
        'You show up reliably for your goals and for the people working with you.',
      ],
      watchOut: [
        'Sometimes you stack so many goals that rest gets pushed to next week.',
        'Sometimes you expect the same pace from the people next to you.',
        'Sometimes you start before you’ve checked whether the others are ready to go.',
      ],
      tryThis: [
        'Pick one goal to pause this week so you can focus on the rest.',
        'Ask a teammate or a friend how their goal is going.',
        'Take one evening off the goal list, so you come back with something left.',
      ],
    },
    mid: {
      summary: [
        'Some tasks motivate you right away, while others wait until they become urgent.',
        'You push hard for the work you care about and put less into the task that feels like a chore.',
        'You can push hard on a goal, but it depends on who is with you and what the work is for.',
      ],
      strength: [
        'You save your best hours for the work that matters to you and leave the other tasks for later.',
        'You can work alone at your desk or with people, depending on what the task needs.',
        'You usually know which goal is worth a late night and which one can wait until Monday.',
      ],
      watchOut: [
        'Sometimes a task you don’t care about sits there until it is due tomorrow.',
        'Sometimes people don’t know when you’ll be fully in.',
        'Sometimes you wait to feel like starting, and the task is still sitting there at dinner.',
      ],
      tryThis: [
        'Pick one task you’ve been avoiding and do ten minutes now, so it starts moving.',
        'Write down why one boring task matters, so you have a reason to finish it.',
        'Ask a friend or coworker to do one task with you, so it feels less like a chore.',
      ],
    },
    low: {
      summary: [
        'You work best with a clear next step and a steady pace, not a big goal you have to invent.',
        'When a goal looks big, you prefer having someone point out the next step.',
        'You pick a calm plan with clear steps over a push you have to lead alone.',
      ],
      strength: [
        'You follow a clear plan and do the work carefully, one step at a time.',
        'You think before you jump into a new task, which saves you from having to redo work.',
        'You can feel fine without chasing the next big goal.',
      ],
      watchOut: [
        'Sometimes you wait for someone else to name the goal instead of naming one yourself.',
        'Sometimes a chance passes before you feel ready to take it.',
        'Sometimes you doubt a task you would actually do well once you started.',
      ],
      tryThis: [
        'Set one small goal for yourself this week, so the direction is one you picked.',
        'Write down one thing you did well recently, so you can see it on the page.',
        'Ask a friend to check in on one goal with you, so you are not carrying it alone.',
      ],
    },
  },
};
