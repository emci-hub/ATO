/** Structure vs. spontaneity: Curiosity (x) and Follow-through (y) (map). */
import type { MapCard } from './define';

export const CAT_STRUCTURE: MapCard = {
  shape: 'map',
  cells: {
    // Adventurous + Structured
    hh: {
      summary: [
        'You love a new idea, and you also write the steps so it actually happens.',
        'When something new gets you going, you turn it into times, steps and a finish.',
        'You pair a curious idea with real follow-through, from the first note to the done list.',
      ],
      strength: [
        'You make a new idea real instead of only talking about it in the chat.',
        'You plan a trip, a project or a change with the steps written down.',
        'You can bring a fresh idea and a solid plan to the same table.',
      ],
      watchOut: [
        'Sometimes you plan so many new things that there’s no evening left for you to rest.',
        'Because you plan with care, a surprise inside your new plan can frustrate you.',
        'Sometimes you expect other people to keep up with both your ideas and your calendar.',
      ],
      tryThis: [
        'Leave one day this week with no plan, so you have room to rest.',
        'Pick one new idea to finish before you start another, so the plans don’t pile up.',
        'Ask the people in your plan what pace works for them, so they can keep up.',
      ],
    },
    // Adventurous + Flexible
    hl: {
      summary: [
        'You follow a new idea in the moment instead of sticking to a list you wrote earlier.',
        'When something new comes up, you jump in and sort it out as you go.',
        'You like a surprise, and you keep the plan loose on purpose.',
      ],
      strength: [
        'You shift quickly, and you can enjoy a turn you didn’t expect.',
        'You can find something good in a last-minute change of plan.',
        'You can try a new thing without every step figured out first.',
      ],
      watchOut: [
        'Sometimes a thing you start doesn’t get a finish.',
        'Because you keep plans loose, someone who plans ahead can feel unsure about you.',
        'Sometimes your small tasks pile up while you go after something new.',
      ],
      tryThis: [
        'Pick one unfinished thing and do the next small step today, so it moves.',
        'Put two tasks on your calendar this week, so each one has a time.',
        'Text a friend a clear yes or no about a plan, so they can plan around you.',
      ],
    },
    // Familiar + Structured
    lh: {
      summary: [
        'You like a routine that already works, and a plan you can count on.',
        'When you find a way of doing something that works, you stick with it.',
        'You feel best with a clear plan and steps you already know.',
      ],
      strength: [
        'You keep a plan organized, and people can rely on you to hold it.',
        'You get a thing done the same solid way each time you do it.',
        'When a plan slips, people can count on you to put it back on the calendar.',
      ],
      watchOut: [
        'Sometimes a sudden change throws your whole day off.',
        'Because you trust your routine, you might miss a better way to do the task.',
        'Sometimes you stick with a plan after it has stopped working for you.',
      ],
      tryThis: [
        'Change one small thing in your routine today, so a change feels smaller next time.',
        'Ask a coworker how they do a task you both share, so you can borrow one idea.',
        'Leave one hour unplanned this week, so a surprise has somewhere to land.',
      ],
    },
    // Familiar + Flexible
    ll: {
      summary: [
        'You like what you already know, and you take each day as it shows up.',
        'With plans, you keep them simple and you keep them loose.',
        'A shifting schedule doesn’t bother you, and you’re happy with your usual things.',
      ],
      strength: [
        'You stay relaxed when a plan moves, and people find that easy to be around.',
        'A changed plan doesn’t stress you out.',
        'You know what you enjoy, and you don’t talk yourself out of it.',
      ],
      watchOut: [
        'Sometimes a task with no deadline drifts for a long time on your list.',
        'Because you take each day as it comes, a bigger goal of yours can slip.',
        'Sometimes you miss a new thing because the usual one is easier to reach.',
      ],
      tryThis: [
        'Set a deadline for one task you’ve been putting off, so it gets a finish.',
        'Try one small new thing this week, so the usual week has one new piece.',
        'Write down one goal for this month, so the days have a direction.',
      ],
    },
  },
};
