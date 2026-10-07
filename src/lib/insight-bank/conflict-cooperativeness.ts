/** Compromise (conflict_cooperativeness): Giving (high) and Steadfast (low). */
import { idea, type InsightIdea } from './define';

export const CONFLICT_COOPERATIVENESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_conflict_cooperativeness_h_01', ['conflict_cooperativeness:high'], {
    focus: [
      'When there’s a disagreement, you tend to look for a solution that works for everyone.',
      'You usually try to find a middle ground when people want different things.',
      'When friends can’t agree, you tend to suggest a plan that gives each person something.',
    ],
    why: 'Looking out for everyone helps groups get along, but your own needs can get traded away in the process.',
    try: [
      'Before you suggest a middle ground, say what you’d choose for yourself, so your needs count too.',
      'Ask the group to pick between two options, so you don’t have to solve it alone.',
    ],
    watch: [
      'Notice when the plan you found works for everyone except you.',
      'Notice how often the fix comes from you.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_02', ['conflict_cooperativeness:high'], {
    focus: [
      'When you plan something with others, you tend to ask what works for everyone first.',
      'You usually check in with people before you decide something that affects them.',
      'When a partner is upset, you tend to ask what they need before you share your side.',
    ],
    why: 'Checking in makes people feel cared for, but your side of things deserves the same attention.',
    try: [
      'Next time you check in with someone, share one thing you need too, so it goes both ways.',
      'Write down what you want before a group decision, so you don’t lose track of it.',
    ],
    watch: [
      'Notice when nobody asks what you need.',
      'Notice how decisions turn out when you share your view early.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_03', ['conflict_cooperativeness:high'], {
    focus: [
      'When a coworker asks to swap shifts or tasks, you tend to say yes to help them out.',
      'You usually adjust your plans to fit what your team needs.',
      'When your boss asks you to be flexible, you tend to make it work even if it costs you.',
    ],
    why: 'Being flexible makes you a great teammate, but people might start expecting it from you without asking.',
    try: [
      'Next time someone asks for a swap, ask for something back, so the trade feels fair.',
      'Say no to one small request this week, so your flexibility stays your choice.',
    ],
    watch: [
      'Notice when people come to you first because they expect a yes.',
      'Notice whether your help is ever returned.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_04', ['conflict_cooperativeness:high'], {
    focus: [
      'When a group project goes well, you tend to give the credit to others.',
      'You usually let others take the lead or the credit, even when you did a lot.',
      'When there’s praise to share at work, you tend to point it toward your team.',
    ],
    why: 'Sharing credit builds trust, but your boss and coworkers might not see how much you actually did.',
    try: [
      'Tell your boss about one thing you did well this week, so your work is seen.',
      'Write down your part in a recent project, so you know your own contribution.',
    ],
    watch: [
      'Notice when you play down your own part.',
      'Notice whether people know what you actually do.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_05', ['conflict_cooperativeness:high'], {
    focus: [
      'When two friends argue, you tend to be the one who helps them make up.',
      'You usually end up in the middle when people around you disagree.',
      'When family members clash, you tend to try to keep everyone happy.',
    ],
    why: 'Helping people get along is kind, but being in the middle of other people’s problems can wear you out.',
    try: [
      'Next time two people argue, let them talk it out first, so you’re not doing their work.',
      'Tell a friend you’d rather stay out of it this time, so you get a break.',
    ],
    watch: [
      'Notice how often you’re pulled into conflicts that aren’t yours.',
      'Notice how you feel after helping two people make up.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_06', ['conflict_cooperativeness:high', 'agreeableness:high'], {
    focus: [
      'When people want different things, you tend to give way so everyone else is happy.',
      'You usually put keeping everyone happy ahead of getting what you want.',
      'When there’s a choice to make, you tend to pick whatever upsets the fewest people.',
    ],
    why: 'You make groups feel easy and kind, but the person whose wishes get skipped most often might be you.',
    try: [
      'Pick the next group activity yourself, so your wishes get a turn.',
      'Tell a friend one thing you’d honestly prefer, so they can make room for it.',
    ],
    watch: [
      'Notice when you agree to keep things easy for everyone else.',
      'Notice how often your first choice actually happens.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_01', ['conflict_cooperativeness:low'], {
    focus: [
      'When you know what you need, you tend to stick to it even when others push back.',
      'You usually keep your position in a disagreement instead of meeting halfway.',
      'When a plan doesn’t work for you, you tend to say no instead of finding a middle ground.',
    ],
    why: 'Knowing what you need keeps you from being pushed around, but others might feel you won’t bend.',
    try: [
      'Next time you disagree, name one part of the other person’s view you can accept, so they feel heard.',
      'Ask what matters most to the other person, so you can see if both needs fit.',
    ],
    watch: [
      'Notice when holding firm matters and when it’s just habit.',
      'Notice how the other person reacts when you don’t budge.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_02', ['conflict_cooperativeness:low'], {
    focus: [
      'When you’re negotiating, you tend to focus on getting what you came for.',
      'You usually know what you want from a deal and keep pushing for it.',
      'When a coworker wants a different approach, you tend to stick with yours.',
    ],
    why: 'Being clear about your goals helps you get results, but working relationships need the other side to win sometimes too.',
    try: [
      'Offer one small thing in your next negotiation, so the other side leaves happy too.',
      'Ask a coworker what they’d need to agree, so you find the fastest way to a yes.',
    ],
    watch: [
      'Notice how people feel after they negotiate with you.',
      'Notice when giving a little would get you more.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_03', ['conflict_cooperativeness:low'], {
    focus: [
      'When people ask you to change your plans, you tend to keep them as they are.',
      'You usually protect your own time, even when someone else wants it.',
      'When a friend asks for a last-minute favor, you tend to say no if it gets in the way.',
    ],
    why: 'Protecting your time helps you get things done, but friends might feel let down when you won’t make room.',
    try: [
      'Say yes to one small favor this week, so friends know you’re there when it counts.',
      'Offer a different time when you turn someone down, so they still feel wanted.',
    ],
    watch: [
      'Notice when a small change would cost you very little.',
      'Notice how friends ask you for help.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_04', ['conflict_cooperativeness:low'], {
    focus: [
      'When something seems unfair, you tend to keep your position even if it makes things awkward.',
      'You usually stand by what you think is right, even if the group disagrees.',
      'When others want to drop an issue, you tend to keep pushing if it matters to you.',
    ],
    why: 'Standing by your principles makes you dependable, but people might need you to pick which issues are worth it.',
    try: [
      'Pick the one issue that matters most this week, so you put your energy where it counts.',
      'Ask yourself if you’d still care about this next month, so you know when to let it go.',
    ],
    watch: [
      'Notice which disagreements still matter to you a week later.',
      'Notice how much energy you spend on small issues.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_05', ['conflict_cooperativeness:low'], {
    focus: [
      'When making a decision, you tend to trust your own judgment over what others suggest.',
      'You usually decide what’s best for you without needing everyone to agree.',
      'When friends give you advice, you tend to listen and then do what you planned.',
    ],
    why: 'Trusting yourself keeps you steady, but others might stop offering you ideas if they never seem to change anything.',
    try: [
      'Take one suggestion from a friend this week and try it, so they know their ideas count.',
      'Ask someone you trust for input before your next decision, so you see another angle.',
    ],
    watch: [
      'Notice when someone’s advice was actually useful.',
      'Notice whether people still share their ideas with you.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_06', ['conflict_cooperativeness:low', 'conflict_assertiveness:high'], {
    focus: [
      'In a disagreement, you tend to say what you think and stick with it.',
      'You usually argue your side clearly and don’t give in easily.',
      'When you disagree with someone, you tend to keep making your case until it’s settled.',
    ],
    why: 'You’re clear and strong in a debate, but the other person might leave feeling like they lost.',
    try: [
      'Next time you win a point, thank the other person for their view, so they don’t feel shut down.',
      'Ask the other person what would make it fair for them, so it ends well for both.',
    ],
    watch: [
      'Notice how the other person feels after the disagreement ends.',
      'Notice when winning the point cost you more than it was worth.',
    ],
  }),
];
