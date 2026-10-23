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
        'You tend to want to feel close to people, but you also pull back when things get very close.',
        'When a relationship matters, you usually worry about it and also need your space.',
        'You tend to wonder where you stand with people while keeping some of yourself private.',
      ],
      strength: [
        'You tend to notice small changes in how people act toward you.',
        'You care a lot about your relationships, even if you don’t show it often.',
        'You usually think carefully before letting someone close.',
      ],
      watchOut: [
        'Sometimes you pull away right when you most want reassurance.',
        'Because you notice so much, you might worry and still not say anything.',
        'Sometimes people can’t tell what you need because you keep it private.',
      ],
      tryThis: [
        'Tell one person close to you one thing you need, so they don’t have to guess.',
        'Write down what you’re worried about before pulling back, so you can see it clearly.',
        'Text someone you care about a short check-in, so the connection stays open.',
      ],
    },
    // Watchful + Close
    hl: {
      summary: [
        'You tend to want lots of closeness and contact, and quiet stretches can worry you.',
        'When you’re close to someone, you usually want to talk often and feel unsure on quiet days.',
        'You tend to give a lot in relationships and want to know it’s returned.',
      ],
      strength: [
        'You tend to be open and warm with the people you love.',
        'You usually put real effort into staying close.',
        'You tend to notice how people are doing and reach out.',
      ],
      watchOut: [
        'Sometimes a slow reply can feel like distance to you when it isn’t.',
        'Because you give so much, you might feel hurt when it isn’t matched right away.',
        'Sometimes you reach out to calm a worry rather than to connect.',
      ],
      tryThis: [
        'Put your phone away for twenty minutes after sending a message, so you’re not waiting on it.',
        'Tell your partner or a friend how often you like to talk, so you both know.',
        'Plan something you enjoy alone tonight, so quiet time feels good.',
      ],
    },
    // Trusting + Private
    lh: {
      summary: [
        'You tend to feel relaxed in relationships and like having plenty of your own space.',
        'When you’re close to someone, you usually don’t worry much and you keep your independence.',
        'You tend to trust people and also keep a lot of your life to yourself.',
      ],
      strength: [
        'You usually give people room and don’t get jealous easily.',
        'You tend to stay calm in relationships, even when things are quiet.',
        'You can keep your own life going while being close to someone.',
      ],
      watchOut: [
        'Sometimes people close to you want more contact or sharing than you offer.',
        'Because you’re relaxed, a partner might read it as you not caring.',
        'Sometimes you keep your feelings so private that others feel shut out.',
      ],
      tryThis: [
        'Tell someone close one thing you’re feeling this week, so they know you better.',
        'Ask your partner or a close friend if they’d like more contact, so you can meet them.',
        'Send a short message to someone you love, so they hear from you first.',
      ],
    },
    // Trusting + Close
    ll: {
      summary: [
        'You tend to feel safe being close to people, and you don’t worry much about where you stand.',
        'When you’re in a relationship, you usually share openly and trust the other person.',
        'You tend to enjoy closeness and feel settled in it.',
      ],
      strength: [
        'You usually make people feel loved and trusted.',
        'You tend to share your feelings and listen well.',
        'You can be close to someone without much worry.',
      ],
      watchOut: [
        'Sometimes you share more than someone new is ready for.',
        'Because you trust easily, you might miss early signs that something’s off.',
        'Sometimes people who need more space feel a bit crowded by your closeness.',
      ],
      tryThis: [
        'Ask a new friend about themselves before sharing your own news, so they open up at their pace.',
        'Ask your partner how much time together feels good to them, so you can match it.',
        'Pay attention to whether a new friend keeps small promises, so trust can build both ways.',
      ],
    },
  },
};
