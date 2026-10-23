/** Self-belief (self_efficacy): Bold (high) and Hesitant (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const SELF_EFFICACY_IDEAS: readonly InsightIdea[] = [
  idea('ftw_self_efficacy_h_01', ['self_efficacy:high'], {
    focus: [
      'When someone asks if you can handle something, you tend to say yes right away.',
      'You usually believe you can figure out whatever comes your way.',
      'When a challenge comes up, you tend to trust you’ll find a way.',
    ],
    why: 'Your confidence helps you take on new things, but saying yes too quickly can leave you with too much to do.',
    try: [
      'Before you say yes next time, ask for a day to think, so you’re sure you have room.',
      'Write down what you’ve already agreed to this week, so you know your load.',
    ],
    watch: [
      'Notice when you agree before you know the details.',
      'Notice how often your quick yes works out.',
    ],
  }),
  idea('ftw_self_efficacy_h_02', ['self_efficacy:high'], {
    focus: [
      'When you set a goal, you tend to aim high.',
      'You usually go for big goals that others might think are too much.',
      'When planning your year, you tend to pick goals that stretch you.',
    ],
    why: 'Big goals push you forward, but missing one can feel bigger than it should.',
    try: [
      'Break your biggest goal into one step for this week, so it feels doable.',
      'Write down one goal you’ve already reached, so you see your progress.',
    ],
    watch: [
      'Notice how you feel when a goal takes longer than planned.',
      'Notice the small wins along the way.',
    ],
  }),
  idea('ftw_self_efficacy_h_03', ['self_efficacy:high'], {
    focus: [
      'When something unexpected happens, you tend to feel ready to deal with it.',
      'You usually stay confident when plans suddenly change.',
      'When there’s a problem, you tend to jump in and start solving it.',
    ],
    why: 'Your confidence in a crisis helps others feel safe, but taking a moment to think can make your plan better.',
    try: [
      'Take one minute to think before acting in your next surprise, so your plan is clear.',
      'Ask someone else for their idea before you jump in, so you have more options.',
    ],
    watch: [
      'Notice when acting fast skips a better option.',
      'Notice how others feel when you take charge.',
    ],
  }),
  idea('ftw_self_efficacy_h_04', ['self_efficacy:high'], {
    focus: [
      'When someone gives you advice, you tend to feel you already know what to do.',
      'You usually trust your own way of doing things over others’ tips.',
      'When you start something new, you tend to skip the instructions and figure it out.',
    ],
    why: 'Trusting yourself saves time, but a tip from someone else can make things easier for you.',
    try: [
      'Read the instructions for one new thing this week, so you see if it saves time.',
      'Ask an expert one question before you start, so you avoid a common mistake.',
    ],
    watch: [
      'Notice when a tip you ignored would have helped.',
      'Notice how often you figure things out on your own.',
    ],
  }),
  idea('ftw_self_efficacy_h_05', ['self_efficacy:high'], {
    focus: [
      'When a friend doubts themselves, you tend to tell them they can do it.',
      'You usually believe in people and tell them so.',
      'When someone is nervous about a challenge, you tend to cheer them on.',
    ],
    why: 'Your belief can lift others, but some people need practical help from you more than encouragement.',
    try: [
      'Ask a nervous friend what would help them most, so your support fits.',
      'Offer to help a friend with one step of a scary task, so they’re not alone.',
    ],
    watch: [
      'Notice when a friend needs help, not just encouragement.',
      'Notice how your confidence affects the people around you.',
    ],
  }),
  idea('ftw_self_efficacy_h_06', ['self_efficacy:high', 'openness:high'], {
    focus: [
      'When something new comes up, you tend to say yes and trust you’ll figure it out.',
      'You usually jump into new things without worrying much about how they’ll go.',
      'When a chance comes up, you tend to go for it even if you’ve never done it before.',
    ],
    why: 'Your mix of curiosity and confidence helps you try a lot, but a little planning can help new things go smoother.',
    try: [
      'Before your next new thing, write down one thing that could go wrong, so you’re ready.',
      'Ask someone who’s done it before for one tip, so you start smarter.',
    ],
    watch: [
      'Notice when your confidence carries you through something new.',
      'Notice when a little prep would have helped.',
    ],
  }),
  idea('ftw_self_efficacy_l_01', ['self_efficacy:low'], {
    focus: [
      'When something big comes up, you tend to wonder if you can handle it.',
      'You usually doubt yourself before a challenge.',
      'When someone asks you to take on more, you tend to feel unsure you can do it.',
    ],
    why: 'Doubt can make you careful, but it can also stop you from trying things you’d handle fine.',
    try: [
      'Write down one hard thing you handled before, so you remember you can do it.',
      'Start with the smallest part of the task today, so it feels doable.',
    ],
    watch: [
      'Notice when your doubt is louder than the facts.',
      'Notice how things go once you start.',
    ],
  }),
  idea('ftw_self_efficacy_l_02', ['self_efficacy:low'], {
    focus: [
      'When you need to start something hard, you tend to put it off.',
      'You usually wait until you feel ready before you start, and that can take a while.',
      'When a task feels big, you tend to delay starting it.',
    ],
    why: 'Waiting until you feel ready makes sense, but the ready feeling often comes after you start.',
    try: [
      'Set a timer for five minutes and start the task, so you get past the beginning.',
      'Pick the easiest first step and do it now, so you build some momentum.',
    ],
    watch: [
      'Notice how you feel after just starting.',
      'Notice which tasks you put off most.',
    ],
  }),
  idea('ftw_self_efficacy_l_03', ['self_efficacy:low'], {
    focus: [
      'When you finish something, you tend to check with someone before you feel sure it’s good.',
      'You usually want a second opinion before you trust your work.',
      'When you make a decision, you tend to ask others if it’s the right one.',
    ],
    why: 'Checking with others is careful, but your own judgment might be better than you think.',
    try: [
      'Send one piece of work this week without asking first, so you practice trusting yourself.',
      'Write down your own answer before asking, so you can see if you were right.',
    ],
    watch: [
      'Notice how often your first answer was right.',
      'Notice how you feel when you trust yourself.',
    ],
  }),
  idea('ftw_self_efficacy_l_04', ['self_efficacy:low'], {
    focus: [
      'When an opportunity looks hard, you tend to let it pass.',
      'You usually pick safer options over challenges.',
      'When there’s a chance to try something new at work, you tend to hold back.',
    ],
    why: 'Choosing safe options protects you from failing, but it can also keep you from finding out what you can do.',
    try: [
      'Say yes to one small challenge this week, so you see what you can handle.',
      'Ask a friend to try something new with you, so it feels less scary.',
    ],
    watch: [
      'Notice when you say no out of doubt, not lack of interest.',
      'Notice how you feel after trying something hard.',
    ],
  }),
  idea('ftw_self_efficacy_l_05', ['self_efficacy:low'], {
    focus: [
      'When something goes wrong, you tend to think it proves you can’t do it.',
      'You usually remember your mistakes more than your wins.',
      'When you struggle, you tend to tell yourself you’re not good enough.',
    ],
    why: 'Being hard on yourself can feel normal, but it can make each challenge feel bigger than it is.',
    try: [
      'Write down one win from this week, so you have proof you’re doing okay.',
      'Talk to yourself like you’d talk to a friend after a mistake, so you stay kind.',
    ],
    watch: [
      'Notice how you talk to yourself after a mistake.',
      'Notice when you skip over your own wins.',
    ],
  }),
  idea('ftw_self_efficacy_l_06', ['self_efficacy:low', 'competence:low'], {
    focus: [
      'When you face something new, you tend to doubt both your skills and your chances.',
      'You usually feel unsure you can do hard things, even when you’ve done them before.',
      'When work gets challenging, you tend to worry you’re not up to it.',
    ],
    why: 'Doubts like these are common, and they tend to shrink as you try things and see how they go.',
    try: [
      'Write down three things you’ve done that once felt too hard, so you see your track record.',
      'Pick one small challenge this week and finish it, so you have a fresh win.',
    ],
    watch: [
      'Notice when your doubts turn out to be wrong.',
      'Notice how much you’ve done that once felt hard.',
    ],
  }),
  idea('ftw_self_efficacy_h_07', ['self_efficacy:high'], {
    focus: [
      'When a job posting asks for skills you only partly have, you tend to apply anyway.',
      'You usually go for an opportunity even when you don’t meet every requirement.',
      'When a chance comes up that stretches you, you tend to say you’ll grow into it.',
    ],
    why: 'Applying anyway opens doors that cautious people miss, but a stretch with no support can leave you scrambling.',
    try: [
      'Ask someone who has done the role what the first three months are like, so you know what you’re taking on.',
      'Write the one skill you most need to learn before you start, so you begin with a plan.',
    ],
    watch: [
      'Notice how ready you are on day one of something new.',
      'Notice who you can ask when you hit a gap.',
    ],
  }),
  idea('ftw_self_efficacy_h_08', ['self_efficacy:high'], {
    focus: [
      'When you say yes to a lot, you tend to trust you’ll find time for all of it.',
      'You usually take on more than your calendar allows because you believe you’ll manage.',
      'When a new project comes in, you tend to say yes before you check what’s already there.',
    ],
    why: 'Believing you can manage a lot gets you opportunities, but an overfull plan leaves you with no room for the unexpected.',
    try: [
      'Look at your week before you say yes to the next request, so the answer fits.',
      'Drop one commitment this week, so you keep room for what matters most.',
    ],
    watch: [
      'Notice how many things you’re juggling right now.',
      'Notice which one you would drop first.',
    ],
  }),
  idea('ftw_self_efficacy_h_09', ['self_efficacy:high'], {
    focus: [
      'When you face a risk, like a move or a career change, you tend to focus on what could go right.',
      'You usually back yourself in big decisions.',
      'When people warn you about a risk, you tend to feel you can handle it.',
    ],
    why: 'Backing yourself lets you take chances that pay off, but warnings can carry real facts you’d want to hear.',
    try: [
      'Ask someone who has done it what went wrong for them, so you plan for the real risks.',
      'Write your backup plan on one page, so your bold move has a safety net.',
    ],
    watch: [
      'Notice which warnings you wave away fastest.',
      'Notice whether any of them came true.',
    ],
  }),
  idea('ftw_self_efficacy_h_10', ['self_efficacy:high'], {
    focus: [
      'When you start learning something hard, you tend to believe you’ll get there with effort.',
      'You usually stay confident through the early, clumsy stage of a new skill.',
      'When you try something new, you tend to expect to improve fast.',
    ],
    why: 'Confidence keeps you practicing, but progress can slow down, and expecting fast gains may feel discouraging then.',
    try: [
      'Set a small weekly goal for a new skill, like two practice sessions, so progress feels steady.',
      'Write down your level now, so you can see your growth in a month.',
    ],
    watch: [
      'Notice how you feel when progress slows.',
      'Notice how far you’ve come since you started.',
    ],
  }),
  idea('ftw_self_efficacy_h_11', ['self_efficacy:high'], {
    focus: [
      'When someone asks you to speak up or present, you tend to say yes.',
      'You usually feel okay being in front of a group, even when you’re not fully ready.',
      'When there’s a chance to share your ideas, you tend to take it.',
    ],
    why: 'Being willing to speak puts your ideas in front of people, but a bit of preparation can make them land better.',
    try: [
      'Write your main point in one sentence before you speak, so the talk has a clear center.',
      'Practice once out loud before a presentation, so you catch what needs fixing.',
    ],
    watch: [
      'Notice how your talks go when you prepare and when you don’t.',
      'Notice what questions you wish you’d prepared for.',
    ],
  }),
  idea('ftw_self_efficacy_h_12', ['self_efficacy:high'], {
    focus: [
      'When a friend feels unsure, you tend to push them to go for it.',
      'You usually encourage others to take a chance because you would.',
      'When someone is nervous about a new step, you tend to tell them they’ll be fine.',
    ],
    why: 'Your belief can lift a friend, but a nervous person may need to feel their worry is heard before they can act.',
    try: [
      'Ask a nervous friend what worries them most before you encourage them, so your support fits.',
      'Offer to help with one small first step, so the push comes with real help.',
    ],
    watch: [
      'Notice how a friend reacts to a push compared with a question.',
      'Notice whether your encouragement matches how they feel.',
    ],
  }),
  idea('ftw_self_efficacy_l_07', ['self_efficacy:low'], {
    focus: [
      'When a job or opportunity looks like a stretch, you tend to wait until you feel fully ready.',
      'You usually apply only when you meet every requirement.',
      'When you see a chance you’d love, you tend to find reasons you’re not ready.',
    ],
    why: 'Being careful keeps you from jumping in too early, but waiting for full readiness can mean the chance is gone.',
    try: [
      'Go for one thing where you meet most of the requirements, so you see how it goes.',
      'Ask someone who has the role how they started, so you see that they weren’t ready either.',
    ],
    watch: [
      'Notice how many chances you’ve passed on because you weren’t ready.',
      'Notice how ready the people who got them were.',
    ],
  }),
  idea('ftw_self_efficacy_l_08', ['self_efficacy:low'], {
    focus: [
      'When you have to start something hard, you tend to picture how it could go wrong.',
      'You usually spend a while imagining problems before you take the first step.',
      'When a task feels big, you tend to think of all the ways it might fail.',
    ],
    why: 'Imagining problems helps you prepare, but too much of it can keep you from starting at all.',
    try: [
      'Write the three most likely problems and one fix for each, then start, so the worry becomes a plan.',
      'Do just five minutes of the task today, so starting stops feeling so big.',
    ],
    watch: [
      'Notice how many of your imagined problems happen.',
      'Notice how you feel five minutes in.',
    ],
  }),
  idea('ftw_self_efficacy_l_09', ['self_efficacy:low'], {
    focus: [
      'When someone pushes you to try something new, you tend to ask who else is going.',
      'You usually need time and reassurance before you take on a new challenge.',
      'When an idea is new to you, you tend to want someone to go with you.',
    ],
    why: 'Wanting support is sensible, but waiting for the right person can slow a step you could take on your own.',
    try: [
      'Take the first step of a new thing on your own, even a tiny one, so you see you can.',
      'Ask a friend to check in after, and not to come along, so you still get support.',
    ],
    watch: [
      'Notice how much of a challenge you can do alone.',
      'Notice how you feel afterward when you did it yourself.',
    ],
  }),
  idea('ftw_self_efficacy_l_10', ['self_efficacy:low'], {
    focus: [
      'When you have to speak up in a group, you tend to rehearse in your head and then stay quiet.',
      'You usually have a thought ready but doubt it’s worth saying.',
      'When someone asks for your view, you tend to say you have no strong opinion.',
    ],
    why: 'Doubting your view keeps you from sharing, but the thought you hold back may be useful to the people around you.',
    try: [
      'Share one thought in the next meeting, even a short one, so you build the habit.',
      'Write your idea in the chat if speaking feels hard, so it still gets heard.',
    ],
    watch: [
      'Notice how often someone else says what you were thinking.',
      'Notice how the group reacts when you do speak.',
    ],
  }),
  idea('ftw_self_efficacy_l_11', ['self_efficacy:low'], {
    focus: [
      'When you succeed at something, you tend to say it was easy or that you were lucky.',
      'You usually find it hard to count a win as proof of your ability.',
      'When a task goes well, you tend to expect the next one to go badly.',
    ],
    why: 'Staying modest keeps you grounded, but discounting wins hides the evidence that you can do hard things.',
    try: [
      'Write down three things you did well this month, so you have a record.',
      'Tell a friend about one win without adding “but,” so it stays a win.',
    ],
    watch: [
      'Notice how quickly you shrink a success.',
      'Notice how many wins you could list from this year.',
    ],
  }),
  idea('ftw_self_efficacy_l_12', ['self_efficacy:low'], {
    focus: [
      'When you make a plan, you tend to build in extra time and backups because you doubt it will go smoothly.',
      'You usually prepare for the worst case before you start.',
      'When something is uncertain, you tend to wait for more information before you act.',
    ],
    why: 'Careful planning protects you from problems, but extra buffers and waiting for certainty can use up the time you have.',
    try: [
      'Set a date to decide, so waiting for more information has an end.',
      'Start on a small part of the plan now, so you learn what works while you plan the rest.',
    ],
    watch: [
      'Notice how much information you need before you act.',
      'Notice when more information stopped changing your choice.',
    ],
  }),
];
