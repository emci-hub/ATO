/** Structure vs. spontaneity: Curiosity (x) and Follow-through (y) (map). */
import type { MapCard } from './define';

export const CAT_STRUCTURE: MapCard = {
  shape: 'map',
  cells: {
    // Adventurous + Structured
    hh: {
      summary: [
        'You tend to love new ideas, and you also plan carefully to make them happen.',
        'When something new excites you, you usually turn it into a clear plan.',
        'You tend to mix curiosity with good follow-through.',
      ],
      strength: [
        'You usually make new ideas real instead of just talking about them.',
        'You tend to plan trips, projects and changes well.',
        'You can bring both fresh ideas and a solid plan.',
      ],
      watchOut: [
        'Sometimes you plan so many new things that there’s no time left for you to rest.',
        'Because you plan carefully, surprises inside your new plans can frustrate you.',
        'Sometimes you expect others to keep up with both your ideas and your schedule.',
      ],
      tryThis: [
        'Leave one day this week with no plan, so you have room to rest.',
        'Pick one new idea to finish before starting another, so your plans don’t pile up.',
        'Ask the people in your plan what pace works for them, so they can keep up.',
      ],
    },
    // Adventurous + Flexible
    hl: {
      summary: [
        'You tend to follow new ideas and go with the moment instead of sticking to a plan.',
        'When something new comes up, you usually jump in and figure it out as you go.',
        'You tend to enjoy surprises and keep your plans loose.',
      ],
      strength: [
        'You usually adapt quickly and enjoy the unexpected.',
        'You tend to find fun in last-minute changes.',
        'You can try new things without needing everything figured out.',
      ],
      watchOut: [
        'Sometimes things you start don’t get finished.',
        'Because you keep plans loose, people who plan ahead might feel unsure about you.',
        'Sometimes your small tasks pile up while you chase something new.',
      ],
      tryThis: [
        'Pick one unfinished thing and do the next small step today, so it moves forward.',
        'Put two tasks on your calendar this week, so they get a time.',
        'Text a friend a clear yes or no about a plan, so they can plan around you.',
      ],
    },
    // Familiar + Structured
    lh: {
      summary: [
        'You tend to like routines that work and plans you can count on.',
        'When you find a way of doing things that works, you usually stick to it.',
        'You tend to feel best with a clear plan and familiar steps.',
      ],
      strength: [
        'You tend to be reliable and organized.',
        'You usually get things done the same good way each time.',
        'People can count on you to keep a plan on track.',
      ],
      watchOut: [
        'Sometimes a sudden change throws off your whole day.',
        'Because you trust your routines, you might miss a better way.',
        'Sometimes you stick with a plan after it’s stopped working for you.',
      ],
      tryThis: [
        'Change one small thing in your routine today, so change feels easier.',
        'Ask a coworker how they do a task you both do, so you can borrow one idea.',
        'Leave one hour unplanned this week, so surprises have room.',
      ],
    },
    // Familiar + Flexible
    ll: {
      summary: [
        'You tend to like what you know and take each day as it comes.',
        'When it comes to plans, you usually keep things simple and loose.',
        'You tend to be easygoing about schedules and happy with your usual things.',
      ],
      strength: [
        'You tend to stay relaxed and easy to be around.',
        'You usually don’t stress about plans changing.',
        'You know what you enjoy and don’t overthink it.',
      ],
      watchOut: [
        'Sometimes your tasks without a deadline drift for a long time.',
        'Because you take each day as it comes, bigger goals can slip.',
        'Sometimes you miss new things because the usual is easier.',
      ],
      tryThis: [
        'Set a deadline for one task you’ve been putting off, so it gets done.',
        'Try one small new thing this week, so your routine gets a little fresh.',
        'Write down one goal for this month, so the days have a direction.',
      ],
    },
  },
};
