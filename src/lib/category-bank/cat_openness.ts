/** Openness to life: Curiosity + Sociability (bar). */
import type { BarCard } from './define';

export const CAT_OPENNESS: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'When a friend texts a new place, you say yes and ask who else can come.',
        'You open the group chat and name a spot nobody in it has tried yet.',
        'A new name on the plan gets you out the door before the time is even set.',
      ],
      strength: [
        'You turn a maybe in the chat into a time, a place and a head count.',
        'You meet someone new at the table and already have a next plan with them.',
        'When the group is stuck on the same bar, you name a different one and people go.',
      ],
      watchOut: [
        'Sometimes you book the next new place before your friends have finished the last one.',
        'Because you say yes fast, a quieter friend can end up somewhere they never picked.',
        'Sometimes your week fills with new plans and the couch never gets an evening.',
      ],
      tryThis: [
        'Ask a quieter friend which place they want, so the next plan starts with them.',
        'Leave one night this week empty, so you can sit still.',
        'Go back to one place you already like, so the usual gets a turn.',
      ],
    },
    mid: {
      summary: [
        'You will try a new place with friends, but you still keep one night for the spot you already like.',
        'You try the new cafe when a friend is going, and you keep your own table when the day ran long.',
        'You split the week between a night out and a night on the couch with a show you already know.',
      ],
      strength: [
        'You can do a loud Friday and a quiet Sunday, so different friends can plan with you.',
        'You pick a new place because you want it, not only because the chat is loud about it.',
        'You show up for the group dinner and still leave when you need the walk home alone.',
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
        'You pick the same table, the same two friends and a plan you already know you’ll like.',
        'When you get a free evening, you go back to the place and the people that already work.',
        'You would rather a small table and a known menu than a room full of new names.',
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
