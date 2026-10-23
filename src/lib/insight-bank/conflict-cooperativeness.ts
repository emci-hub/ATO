/** Compromise (conflict_cooperativeness): Giving (high) and Steadfast (low). */
import { idea, type InsightIdea } from './define';

export const CONFLICT_COOPERATIVENESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_conflict_cooperativeness_h_01', ['conflict_cooperativeness:high'], {
    focus: [
      'A disagreement comes up, and you usually look for a fix that works for every person at the table.',
      'People want different nights, and you can hunt for a time that gives each of them something.',
      'Friends can’t agree on the plan, and you usually offer one that gives each person part of what they wanted.',
    ],
    why: 'Looking out for the whole table helps the group get along, but your own pick can get traded away while you build the fix.',
    try: [
      'Before you suggest a compromise, say what you’d choose for yourself, so your need is in the talk too.',
      'Ask the group to pick between two options, so you aren’t the only one solving it.',
    ],
    watch: [
      'Notice when the plan you built works for the group and not for your own night.',
      'Notice how often the fix in the chat comes from you.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_02', ['conflict_cooperativeness:high'], {
    focus: [
      'Planning with other people, you usually ask what works for everyone before you name a time.',
      'You can check with people before you decide something that lands on their calendar too.',
      'A partner is upset, and you usually ask what they need before you say your side of it.',
    ],
    why: 'Checking first makes people feel cared for, but your side of the same plan deserves the same minute.',
    try: [
      'Next time you check in with someone, share one thing you need too, so the talk goes both ways.',
      'Write what you want before a group decision, so you don’t lose it once the chat gets loud.',
    ],
    watch: [
      'Notice when nobody asks what you need from the plan.',
      'Notice how the decision goes when you share your view early.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_03', ['conflict_cooperativeness:high'], {
    focus: [
      'A coworker asks to swap a shift, and you usually say yes to help them out.',
      'You can move your own plans so the team’s schedule works, even when yours was already set.',
      'Your boss asks you to be flexible, and you usually make it work even when it costs your evening.',
    ],
    why: 'Moving your evening for the team makes you easy to schedule, but people might expect the yes before they’ve asked.',
    try: [
      'Next time someone asks to swap a shift, ask for something back, so the trade is fair.',
      'Say no to one small request this week, so the flexibility stays a choice you made.',
    ],
    watch: [
      'Notice when coworkers come to you first because they expect you to say yes.',
      'Notice whether the help you gave ever comes back.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_04', ['conflict_cooperativeness:high'], {
    focus: [
      'A group project goes well, and you usually hand the credit to the other names on it.',
      'You can let someone else take the lead, or the praise, even when you did a lot of the file.',
      'Praise shows up at work, and you usually point it toward the team instead of your own part.',
    ],
    why: 'Sharing the credit builds trust on the team, but your boss might not see how much of the file was yours.',
    try: [
      'Tell your boss one thing you did well this week, so your part of the work is seen.',
      'Write down your part in a recent project, so the work you did is on the page.',
    ],
    watch: [
      'Notice when you play down your own part of the project.',
      'Notice whether people know what you actually did on the file.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_05', ['conflict_cooperativeness:high'], {
    focus: [
      'Two friends argue, and you usually become the one who helps them make up.',
      'You can end up in the middle when two friends disagree, with texts coming from both of them.',
      'Family members clash, and you usually try to keep every person at the table comfortable.',
    ],
    why: 'Helping people get along is kind, but sitting in the middle of a fight that isn’t yours can wear you out.',
    try: [
      'Next time two people argue, let them talk it out first, so you aren’t doing their work.',
      'Tell a friend you’d rather stay out of it this time, so you get a break from the middle.',
    ],
    watch: [
      'Notice how often you’re pulled into a fight that isn’t yours.',
      'Notice how you feel after you’ve helped two people make up.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_06', ['conflict_cooperativeness:high', 'agreeableness:high'], {
    focus: [
      'People want different things, and you usually give way so everyone else leaves happy.',
      'In the group chat, you can let the easy plan win over the place you actually wanted.',
      'A choice comes up, and you usually pick the option that upsets the fewest people.',
    ],
    why: 'You keep group plans easy for other people, but the wish that gets skipped most often might be yours.',
    try: [
      'Pick the next group activity yourself, so your wish gets a turn.',
      'Tell a friend one plan you’d honestly prefer, so they can make room for it.',
    ],
    watch: [
      'Notice when you agree so the night stays easy for everyone else.',
      'Notice how often your first choice is the one that actually happens.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_01', ['conflict_cooperativeness:low'], {
    focus: [
      'You know what you need from a plan, and you usually stick to it even when others push in the chat.',
      'In a disagreement about the time, you can keep your slot instead of moving it to match theirs.',
      'A plan doesn’t work for you, and you usually say no instead of building a middle version.',
    ],
    why: 'Knowing what you need keeps people from overriding you, but they might feel you won’t move even on a small piece.',
    try: [
      'Next time you disagree, name one part of their view you can accept, so they feel heard.',
      'Ask what matters most to the other person, so you can see whether both needs can fit.',
    ],
    watch: [
      'Notice when keeping your position matters and when it’s just the habit.',
      'Notice how the other person reacts when you don’t move.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_02', ['conflict_cooperativeness:low'], {
    focus: [
      'In a negotiation you usually stay on the result you came in wanting, the number or the task.',
      'You can know what you want from a deal and keep the talk on that, even if they want to wander.',
      'A coworker wants a different approach, and you usually stick with the one you already picked.',
    ],
    why: 'A clear goal helps you get the result, but a working relationship needs the other side to leave with something too.',
    try: [
      'Offer one small thing they asked for in the next negotiation, so they leave with something too.',
      'Ask a coworker what they’d need in order to agree, so you find a faster yes.',
    ],
    watch: [
      'Notice how people seem after they’ve negotiated with you.',
      'Notice when giving a little would have gotten you more.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_03', ['conflict_cooperativeness:low'], {
    focus: [
      'People ask you to change your plans, and you usually keep the evening the way you booked it.',
      'You can protect your own time, even when someone else wants that hour.',
      'A friend asks for a last-minute favor, and you usually say no if it gets in the way of your plan.',
    ],
    why: 'Protecting the hour helps you finish what you planned, but friends might feel let down when you won’t move it.',
    try: [
      'Say yes to one small favor this week, so a friend sees you’ll help when it matters.',
      'Offer another evening when you turn a plan down, so they still feel wanted.',
    ],
    watch: [
      'Notice when a small change to the plan would cost you very little.',
      'Notice how friends ask you for help, and how often.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_04', ['conflict_cooperativeness:low'], {
    focus: [
      'Something looks unfair, and you usually keep your position even if the room gets awkward.',
      'You can stand by what you think is right, even when the group chat wants to drop it.',
      'Others want to leave an issue, and you usually keep pushing if it still matters to you.',
    ],
    why: 'Standing by what you think is right makes you dependable, but people might need you to pick which issues are worth the fight.',
    try: [
      'Pick the one issue that matters most this week, so your hours go where they count.',
      'Ask yourself if this issue would still matter next month, so you know when to drop it.',
    ],
    watch: [
      'Notice which disagreements still matter to you once a week has passed.',
      'Notice how much of your week goes to small issues.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_05', ['conflict_cooperativeness:low'], {
    focus: [
      'Making a decision, you usually trust your own judgment over the suggestions in the chat.',
      'You can decide what’s best for you without waiting for everyone to agree.',
      'Friends give you advice, and you usually listen, then do the thing you already planned.',
    ],
    why: 'Trusting your own call keeps you steady, but people might stop offering ideas if those ideas never change the plan.',
    try: [
      'Take one suggestion from a friend this week and try it, so they know the idea counted.',
      'Ask someone you trust for a view before your next decision, so you see another angle.',
    ],
    watch: [
      'Notice when someone’s advice was actually useful on the decision.',
      'Notice whether people still send you their ideas.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_06', ['conflict_cooperativeness:low', 'conflict_assertiveness:high'], {
    focus: [
      'In a disagreement you usually say what you think and stay with it until the talk ends.',
      'You can argue your side clearly and not give in easily, even after a long back-and-forth.',
      'You disagree with someone, and you usually keep making the case until it’s settled.',
    ],
    why: 'You can state your side clearly and stay with it, but the other person might leave feeling like they lost.',
    try: [
      'Next time you win a point, thank them for their view, so the talk doesn’t end with them silent.',
      'Ask the other person what would make it fair for them, so it can end well for both.',
    ],
    watch: [
      'Notice how the other person seems after the disagreement ends.',
      'Notice when winning the point cost you more than the point was worth.',
    ],
  }),
];
