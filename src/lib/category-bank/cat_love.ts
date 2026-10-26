/**
 * Love & closeness: Reassurance (x) and Personal space (y) (map).
 * Both axes are private: this card's tags never leave the app.
 */
import type { MapCard } from './define';

export const CAT_LOVE: MapCard = {
  shape: 'map',
  cells: {
    // Watchful + Private
    hh: {
      summary: [
        'You want to feel close to someone, but you also pull back when things feel too close.',
        'When a relationship matters, you worry about it and you also need your own space.',
        'You wonder where you stand with someone, and you still keep part of your day private.',
      ],
      strength: [
        'You notice small changes in how someone acts toward you, a shorter text or a quieter night.',
        'You care a lot about your relationships, even on the days you don’t show it.',
        'You think carefully before you let someone see the parts of your life you keep private.',
      ],
      watchOut: [
        'Sometimes you pull away right when you most want a sign that they are still there.',
        'Sometimes you worry and still say nothing about it.',
        'Sometimes people can’t tell what you need.',
      ],
      tryThis: [
        'Tell one person close to you one thing you need, so they don’t have to guess.',
        'Write down what you’re worried about before you pull back, so you can see it on the page.',
        'Text a short check-in to someone you care about.',
      ],
    },
    // Watchful + Close
    hl: {
      summary: [
        'A quiet stretch without contact can worry you.',
        'When you are close to someone, you want to talk often.',
        'You want the effort you put into a relationship to be matched.',
      ],
      strength: [
        'You stay open and warm with the people you love.',
        'You put real effort into staying close to people.',
        'You reach out when someone in your life goes quiet.',
      ],
      watchOut: [
        'Sometimes a slow reply feels like distance to you when it is only a busy afternoon.',
        'Sometimes a short reply hurts you after a long text.',
        'Sometimes you reach out only to calm a worry.',
      ],
      tryThis: [
        'Put your phone away for twenty minutes after you send a message.',
        'Tell your partner or a friend how often you like to talk.',
        'Plan something you enjoy alone tonight, so a quiet hour can feel good.',
      ],
    },
    // Trusting + Private
    lh: {
      summary: [
        'You feel relaxed with someone close, and you still like plenty of your own space.',
        'When you’re close to someone, you don’t worry much, and you keep your own plans.',
        'You trust people, and you still keep a lot of your life to yourself.',
      ],
      strength: [
        'You give people room, and a quiet day doesn’t make you jealous.',
        'You stay calm in a relationship, even when the texts are few.',
        'You can keep your own life going and stay close to someone.',
      ],
      watchOut: [
        'Sometimes people close to you want more contact, or more sharing, than you offer.',
        'Sometimes a partner reads your quiet as you not caring.',
        'Sometimes you keep your feelings so private that the other person feels shut out.',
      ],
      tryThis: [
        'Tell someone close one thing you’re feeling this week, so they know you better.',
        'Ask your partner or a close friend if they want more contact, so you can meet them halfway.',
        'Send a short message to someone you love, so they hear from you first.',
      ],
    },
    // Trusting + Close
    ll: {
      summary: [
        'You feel safe being close to people, and you don’t worry much about where you stand.',
        'When you’re in a relationship, you share openly and you trust the other person.',
        'You enjoy being close, and you feel settled once you are in a relationship.',
      ],
      strength: [
        'You make the people with you feel loved, and they can tell you trust them.',
        'You share what you feel, and you listen when they share back.',
        'You can spend an evening together without worrying about where you stand.',
      ],
      watchOut: [
        'Sometimes you share more than someone new is ready to hear.',
        'Sometimes you miss an early sign that something is off.',
        'Sometimes a person who needs more space feels crowded by how close you get.',
      ],
      tryThis: [
        'Ask a new friend about themselves before you share your news, so they set the pace.',
        'Ask your partner how much time together feels good, so you can match it.',
        'Check whether a new friend keeps small promises, so the trust builds both ways.',
      ],
    },
  },
};
