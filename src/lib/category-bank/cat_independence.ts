/** Independence & closeness: Independence (x) and Connection (y) (map). */
import type { MapCard } from './define';

export const CAT_INDEPENDENCE: MapCard = {
  shape: 'map',
  cells: {
    // Self-directed + Connected
    hh: {
      summary: [
        'You like doing a thing your own way, and you still want close people around while you do it.',
        'When you make a plan, you want room to shape it and someone you like in it.',
        'You want your own say and a real connection in the same week.',
      ],
      strength: [
        'You can run your own week and still keep your close friendships in it.',
        'You bring people into your plans without handing them the whole direction.',
        'You know what you want and who you want in the room for it.',
      ],
      watchOut: [
        'Sometimes you want company on your terms, which can be hard for a friend to match.',
        'Because you want both, you might feel pulled between your plan and your people.',
        'Sometimes you decide alone and then expect others to join what you already chose.',
      ],
      tryThis: [
        'Ask a friend what they would like to do next, so the next plan isn’t only yours.',
        'Pick one evening for your own plans and one for friends, so you get both.',
        'Tell a close friend about a plan before you decide, so they feel included.',
      ],
    },
    // Self-directed + Self-contained
    hl: {
      summary: [
        'You do things your own way, and you feel fine spending a long stretch on your own.',
        'When you have free time, you spend it on your own projects.',
        'You rely on yourself more than you rely on other people.',
      ],
      strength: [
        'You handle things on your own, and you don’t need much help to finish them.',
        'You pick the evening your way, then you spend it that way.',
        'You can enjoy your own company for a long stretch of days.',
      ],
      watchOut: [
        'Sometimes friends feel left out because you don’t reach out much.',
        'Because you feel fine on your own, you might miss a sign that someone wants more contact.',
        'Sometimes you handle a hard thing alone even though someone nearby could help.',
      ],
      tryThis: [
        'Text one friend this week just to check in, so they know you thought of them.',
        'Invite someone into part of a solo plan, so you share it and keep your own space.',
        'Ask for help with one small thing, so someone gets a chance to show up.',
      ],
    },
    // Guided + Connected
    lh: {
      summary: [
        'You feel best making plans with the people close to you, and you like them to lead.',
        'When there’s a decision, you want a word from friends or family before you pick.',
        'You enjoy being on a team more than heading off on your own.',
      ],
      strength: [
        'People like planning with you, and you do your share of the shared tasks.',
        'You ask what other people think, and you use what they tell you.',
        'You keep people close by putting them in the plan.',
      ],
      watchOut: [
        'Sometimes your own wishes get lost in what the group wants.',
        'Because you like their input, you might wait for others before you decide.',
        'Sometimes you feel unsure when you have to choose with nobody else in the room.',
      ],
      tryThis: [
        'Make one small choice today without asking anyone, so you practice your own pick.',
        'Suggest the next plan with your friends, so your idea gets a turn.',
        'Write down what you want before a group decision, so you bring your own view.',
      ],
    },
    // Guided + Self-contained
    ll: {
      summary: [
        'You like clear direction, and a quiet week without a lot of social demands.',
        'When you work, you prefer clear steps and time on your own.',
        'A simple routine and a small circle of friends is enough for you.',
      ],
      strength: [
        'You keep things calm, and people find you easy to work beside.',
        'You follow a plan well, and you do it without a lot of noise.',
        'You can feel content without needing a lot from other people.',
      ],
      watchOut: [
        'Sometimes you wait for a direction that nobody ends up giving you.',
        'Because you keep to yourself, people might not know what you need.',
        'Sometimes a friendship fades because nobody, you included, sends the text.',
      ],
      tryThis: [
        'Choose one small thing to do on your own this week, so the plan is yours.',
        'Text one friend to say hi, so the friendship stays warm.',
        'Tell someone at work how you like to get instructions, so you get what you need.',
      ],
    },
  },
};
