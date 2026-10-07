/** Independence & closeness: Independence (x) and Connection (y) (map). */
import type { MapCard } from './define';

export const CAT_INDEPENDENCE: MapCard = {
  shape: 'map',
  cells: {
    // Self-directed + Connected
    hh: {
      summary: [
        'You tend to like doing things your own way, and you also need close people around you.',
        'When you make plans, you usually want freedom and good company at the same time.',
        'You tend to want both independence and real connection.',
      ],
      strength: [
        'You can lead your own life and still keep close friendships.',
        'You tend to bring people into your plans without losing your own direction.',
        'You usually know what you want and who you want it with.',
      ],
      watchOut: [
        'Sometimes you want company on your terms, which can be hard for friends to match.',
        'Because you want both, you might feel pulled between your plans and your people.',
        'Sometimes you decide alone and then expect others to join in.',
      ],
      tryThis: [
        'Ask a friend what they’d like to do next, so the next plan isn’t just yours.',
        'Pick one evening for your own plans and one for friends, so you get both.',
        'Tell a close friend about a plan before you decide, so they feel included.',
      ],
    },
    // Self-directed + Self-contained
    hl: {
      summary: [
        'You tend to do things your own way and feel fine spending a lot of time on your own.',
        'When you have free time, you usually spend it on your own projects.',
        'You tend to rely on yourself more than on other people.',
      ],
      strength: [
        'You usually handle things on your own and don’t need much help.',
        'You tend to know your own mind and follow it.',
        'You can enjoy your own company for long stretches.',
      ],
      watchOut: [
        'Sometimes friends feel left out because you don’t reach out much.',
        'Because you’re fine alone, you might miss signs that someone wants more contact.',
        'Sometimes you handle hard things alone when help was there for you.',
      ],
      tryThis: [
        'Text one friend this week just to check in, so they know you think of them.',
        'Invite someone to join part of a solo plan, so you share it without losing your space.',
        'Ask for help with one small thing, so people get a chance to show up.',
      ],
    },
    // Guided + Connected
    lh: {
      summary: [
        'You tend to feel best making plans with the people close to you and following their lead.',
        'When there’s a decision, you usually want input from friends or family.',
        'You tend to enjoy being part of a team more than going your own way.',
      ],
      strength: [
        'You tend to be a great teammate and easy to plan with.',
        'You usually value what other people think.',
        'You tend to keep people close by including them.',
      ],
      watchOut: [
        'Sometimes your own wishes get lost in what the group wants.',
        'Because you like input, you might wait for others before deciding.',
        'Sometimes you feel unsure when you have to choose alone.',
      ],
      tryThis: [
        'Make one small choice today without asking anyone, so you practice trusting yourself.',
        'Suggest the next plan with your friends, so your ideas get a turn.',
        'Write down what you want before a group decision, so you bring your own view.',
      ],
    },
    // Guided + Self-contained
    ll: {
      summary: [
        'You tend to like clear direction and a quiet life without many social demands.',
        'When you work, you usually prefer clear steps and time on your own.',
        'You tend to be content with a simple routine and a small circle of friends.',
      ],
      strength: [
        'You tend to be low-drama and easy to work with.',
        'You usually follow a plan well and do it quietly.',
        'You can be content without needing a lot from people.',
      ],
      watchOut: [
        'Sometimes you wait for direction that nobody gives you.',
        'Because you keep to yourself, people might not know what you need.',
        'Sometimes your friendships fade because nobody reaches out.',
      ],
      tryThis: [
        'Set one small goal for yourself this week, so you choose the direction.',
        'Text one friend to say hi, so the friendship stays warm.',
        'Tell someone at work how you like to get instructions, so you get what you need.',
      ],
    },
  },
};
