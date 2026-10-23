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
    why: 'Knowing what you need keeps people from overriding you, but they might feel you won’t bend.',
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
  idea('ftw_conflict_cooperativeness_h_07', ['conflict_cooperativeness:high'], {
    focus: [
      'When you and a partner want different things, you tend to offer to meet in the middle first.',
      'You usually suggest a compromise before the other person has said what they want.',
      'In a disagreement, you tend to move toward the other person’s side early.',
    ],
    why: 'Offering to meet in the middle shows you care, but giving up ground too soon can leave your own wish unheard.',
    try: [
      'Say what you want in one sentence before you offer a compromise, so both wishes are on the table.',
      'Ask the other person to share their view first, so you can see how far apart you really are.',
    ],
    watch: [
      'Notice how often the compromise is closer to the other person’s wish than yours.',
      'Notice what you gave up in your last few agreements.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_08', ['conflict_cooperativeness:high'], {
    focus: [
      'When a friend picks a movie or a restaurant, you tend to go along even if you had another idea.',
      'You usually let others choose when the choice is small.',
      'When a group can’t decide, you tend to say whatever works for everyone.',
    ],
    why: 'Letting others pick makes plans smooth, but you may end up doing things you don’t enjoy most of the time.',
    try: [
      'Pick one small choice a week and say what you want, so your wishes get a regular turn.',
      'Suggest an option when the group is stuck, so you help decide and not just follow.',
    ],
    watch: [
      'Notice how often you pick last.',
      'Notice how a friend reacts when you share a preference.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_09', ['conflict_cooperativeness:high'], {
    focus: [
      'When a coworker is overloaded, you tend to offer to take something off their plate.',
      'You usually cover for a teammate who is struggling, even when your own list is long.',
      'When a team has a gap, you tend to step in without being asked.',
    ],
    why: 'Helping out builds trust, but it can quietly turn into your job, and others may not see how much you carry.',
    try: [
      'Tell your boss what you’re covering for the team, so your effort is visible.',
      'Offer help for a set time, like one afternoon, so the favor has a clear end.',
    ],
    watch: [
      'Notice who often gets your help and who gives it back.',
      'Notice how full your own list is when you offer.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_10', ['conflict_cooperativeness:high'], {
    focus: [
      'When someone is angry with you, you tend to agree quickly to calm things down.',
      'You usually try to end an argument fast by giving the other person what they ask for.',
      'When a talk gets heated, you tend to say what the other person wants to hear.',
    ],
    why: 'Calming things down helps in the moment, but agreeing before you mean it can build up into resentment.',
    try: [
      'Take a short pause before you agree in a heated talk, so you answer from what you think.',
      'Say “I want to think about that” when a request feels too big, so you have room to answer well.',
    ],
    watch: [
      'Notice when you agree and don’t mean it.',
      'Notice how you feel an hour after giving in.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_11', ['conflict_cooperativeness:high'], {
    focus: [
      'When two coworkers disagree, you tend to look for the point they both can accept.',
      'You usually help others find common ground instead of choosing a side.',
      'When friends disagree about a plan, you tend to suggest a mix of both ideas.',
    ],
    why: 'Finding common ground keeps teams together, but sometimes one idea is simply better and a mix makes it worse for you all.',
    try: [
      'Ask the group which idea they’d choose if they had to pick one, so you test whether a mix is needed.',
      'Give your own view on which idea is stronger, so the group hears your judgment.',
    ],
    watch: [
      'Notice when a mix of two ideas turns out worse than either.',
      'Notice whether you share your own pick or only the middle.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_h_12', ['conflict_cooperativeness:high'], {
    focus: [
      'When you and a friend both want the last say, you tend to let them have it.',
      'You usually let go of being right if it keeps the peace.',
      'When someone argues a point, you tend to drop yours to avoid a long debate.',
    ],
    why: 'Letting go of being right saves energy, but a point you drop may be one worth keeping.',
    try: [
      'Keep one point you believe in during your next debate, so you practice staying with it kindly.',
      'Say “I see it differently, and that’s okay,” so you can disagree without a fight.',
    ],
    watch: [
      'Notice which points you drop that you still believe.',
      'Notice how a friend reacts when you hold your view calmly.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_07', ['conflict_cooperativeness:low'], {
    focus: [
      'When someone suggests a middle option, you tend to feel you’re giving up too much.',
      'You usually see a compromise as losing part of what you wanted.',
      'When a deal asks you to meet halfway, you tend to ask whether halfway is fair.',
    ],
    why: 'Holding to what you need protects your interests, but a middle option can sometimes give you most of what you want.',
    try: [
      'Write down what you’d accept before a talk, so you know your real limits.',
      'Ask what each side gets in a compromise before you decide, so you judge it on the whole.',
    ],
    watch: [
      'Notice what part of a compromise feels like a loss.',
      'Notice whether the middle option was actually worse for you.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_08', ['conflict_cooperativeness:low'], {
    focus: [
      'When a group changes the plan, you tend to stay with the one you made.',
      'You usually keep your own plan when others want to change theirs.',
      'When friends decide to go somewhere else, you tend to say you’ll do your own thing.',
    ],
    why: 'Following your own plan keeps you reliable to yourself, but friends might feel you don’t want to join them.',
    try: [
      'Join the group for the first hour and then head to your own plan, so you share some time.',
      'Tell the group why your plan matters to you, so they know it isn’t about them.',
    ],
    watch: [
      'Notice how friends react when you stay with your plan.',
      'Notice whether you’d have enjoyed the new plan.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_09', ['conflict_cooperativeness:low'], {
    focus: [
      'When you work on a team project, you tend to want it done your way.',
      'You usually have a clear idea of how a task should go and push to keep it.',
      'When a teammate does a task differently than you would, you tend to redo it.',
    ],
    why: 'A clear sense of the right way gets you good results, but teammates may feel their work isn’t trusted.',
    try: [
      'Let a teammate finish a task their way once this week, so you see what they bring.',
      'Name the goal you both share before you talk about how, so the method is easier to flex.',
    ],
    watch: [
      'Notice how often you redo someone’s work.',
      'Notice whether their way turned out fine.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_10', ['conflict_cooperativeness:low'], {
    focus: [
      'When you disagree with a friend about something that matters to you, you tend to hold firm.',
      'You usually don’t change your position to keep a conversation easy.',
      'When someone pushes you to agree, you tend to dig in more.',
    ],
    why: 'Standing firm shows people where you stand, but pushing back hard can make the other person stop listening.',
    try: [
      'Repeat back what the other person said before you answer, so they know they were heard.',
      'Say what you can agree on first, so your disagreement has some common ground.',
    ],
    watch: [
      'Notice when the other person stops talking after you hold firm.',
      'Notice whether you would have moved if they had asked in a different way.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_11', ['conflict_cooperativeness:low'], {
    focus: [
      'When you set a deadline or a rule, you tend to keep to it even when others ask for more time.',
      'You usually hold a limit you set, even when it causes a little friction.',
      'When someone asks you to make an exception, you tend to say the rule is the rule.',
    ],
    why: 'Holding to a limit keeps things fair, but a small exception can sometimes help a person at little cost to you.',
    try: [
      'Ask what the exception is really for before you answer, so you decide on the reason.',
      'Pick one small rule to bend this week for someone who needs it, so you see what changes.',
    ],
    watch: [
      'Notice which rules you hold most firmly and why.',
      'Notice how people respond when you explain the reason.',
    ],
  }),
  idea('ftw_conflict_cooperativeness_l_12', ['conflict_cooperativeness:low'], {
    focus: [
      'When you plan a trip with others, you tend to know what you want and say it.',
      'You usually push for the plan you think is best for the group.',
      'When a group is deciding, you tend to argue for your option until the end.',
    ],
    why: 'Knowing what you want helps a group decide, but others may stop offering ideas if yours always lead.',
    try: [
      'Ask each person for one must-have before you plan, so everyone gets something.',
      'Let someone else choose one part of the plan, so the trip feels shared.',
    ],
    watch: [
      'Notice whether the others sound excited about the plan.',
      'Notice who contributes ideas and who goes along.',
    ],
  }),
];
