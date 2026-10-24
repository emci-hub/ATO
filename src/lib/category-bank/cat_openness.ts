/** Openness to life: Curiosity + Sociability (bar). */
import type { BarCard } from './define';

export const CAT_OPENNESS: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You say yes to something new, and you want other people in on it.',
        'You name a new option while the familiar one is still on the table.',
        'A new option can get you moving before the details are settled.',
      ],
      strength: [
        'You turn a maybe into a real plan, with a time and the people who want to come.',
        'You meet someone new and you already want a next plan with them.',
        'When other people stick with the usual, you name a different option.',
      ],
      watchOut: [
        'Sometimes you start the next new thing before the last one is finished.',
        'Because you say yes fast, someone quieter can end up in a plan they never picked.',
        'Sometimes your week fills with new plans and you have no evening left.',
      ],
      tryThis: [
        'Ask a quieter friend which place they want, so the next plan starts with them.',
        'Leave one night this week empty, so you can sit still.',
        'Go back to one place you already like, so the usual gets a turn.',
      ],
    },
    mid: {
      summary: [
        'You will try something new with other people, and you still keep time for what you already like.',
        'You try the new option when someone is going with you, and you keep the known one when the day ran long.',
        'You split the week between time with people and time for something you already know.',
      ],
      strength: [
        'You can do a busy day with people and a quiet day, so different plans can include you.',
        'You pick a new option because you want it, not only because other people are loud about it.',
        'You show up for the group plan and you still leave when you need time to yourself.',
      ],
      watchOut: [
        'Sometimes you say no to a new place only because that day already ran long.',
        'Because you can go either way, you might join a plan that doesn’t fit the night you needed.',
        'Sometimes you wait for the right evening and the invite is already gone.',
      ],
      tryThis: [
        'Say yes to one new place this week, so the usual week gets one fresh night.',
        'Plan one night in and one night out, so both parts of your week have a slot.',
        'Text a friend one new thing you want to try, so it has a day and a time.',
      ],
    },
    low: {
      summary: [
        'You stick with a few people you already like and a plan you already know.',
        'When you get a free evening, you go back to the people and the plans that already work.',
        'You pick a small known group over a room full of new people.',
      ],
      strength: [
        'You know the places you like, and you put them on the calendar on purpose.',
        'Your close friends get the whole evening, because you are not splitting it across a crowd.',
        'Friends can plan with you, because you name the place and the time and you stick to them.',
      ],
      watchOut: [
        'Sometimes you skip a new place you might have liked once you were in the door.',
        'Because you keep the usual plan, friends can stop texting you the new ones.',
        'Sometimes you miss a person you would have liked, because the room felt too new.',
      ],
      tryThis: [
        'Say yes to one small new thing this week, so a new place gets one try.',
        'Invite one close friend to a new place with you, so you are not walking in alone.',
        'Ask a friend what they tried lately, so you hear about a new place with no plan attached.',
      ],
    },
  },
};
