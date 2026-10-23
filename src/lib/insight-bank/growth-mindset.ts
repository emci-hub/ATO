/** Growth (growth_mindset): Learning (high) and Settled (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const GROWTH_MINDSET_IDEAS: readonly InsightIdea[] = [
  idea('ftw_growth_mindset_h_01', ['growth_mindset:high'], {
    focus: [
      'When you make a mistake, you tend to think about what you’d do differently next time.',
      'You usually see a failure as a chance to learn something.',
      'When something goes wrong, you tend to look for the lesson in it.',
    ],
    why: 'Learning from mistakes helps you improve, but not every mistake needs a lesson; some can just be let go.',
    try: [
      'Write down one lesson from a recent mistake, then close the note, so you move on.',
      'Let one small mistake go today without picking it apart, so you get a break.',
    ],
    watch: [
      'Notice when learning from a mistake turns into dwelling on it.',
      'Notice which lessons you actually use.',
    ],
  }),
  idea('ftw_growth_mindset_h_02', ['growth_mindset:high'], {
    focus: [
      'When you finish a project, you tend to ask how you could have done better.',
      'You usually want feedback, even when it’s hard to hear.',
      'When your boss gives notes, you tend to see them as useful rather than personal.',
    ],
    why: 'Seeking feedback helps you grow fast, but asking too often can make others feel they have to critique you.',
    try: [
      'Ask for feedback on one specific thing, so the answer is easy to give.',
      'Celebrate one thing that went well before asking what to improve, so you see the good too.',
    ],
    watch: [
      'Notice when you focus on the feedback and skip the praise.',
      'Notice which feedback actually helped you.',
    ],
  }),
  idea('ftw_growth_mindset_h_03', ['growth_mindset:high'], {
    focus: [
      'When something is hard, you tend to see it as a chance to get better.',
      'You usually enjoy a challenge more than an easy task.',
      'When you’re learning something new, you tend to keep going even when it’s frustrating.',
    ],
    why: 'Your love of challenge helps you grow, but rest and easy wins matter for you too.',
    try: [
      'Do one easy thing you enjoy today, so you get a break from pushing.',
      'Pick one goal to focus on this month, so your energy doesn’t spread too thin.',
    ],
    watch: [
      'Notice when you pick the hard option just because it’s hard.',
      'Notice how you feel after an easy, fun day.',
    ],
  }),
  idea('ftw_growth_mindset_h_04', ['growth_mindset:high'], {
    focus: [
      'When a friend says they’re bad at something, you tend to tell them they can learn it.',
      'You usually believe people can improve with practice.',
      'When someone gives up, you tend to encourage them to try again.',
    ],
    why: 'Your belief in growth can lift people up, but sometimes a friend just needs you to listen.',
    try: [
      'Ask a friend if they want encouragement or just to vent, so you give them what they need.',
      'Share a time you struggled and improved, so your encouragement feels real.',
    ],
    watch: [
      'Notice when a friend wants to be heard, not coached.',
      'Notice how people respond to your encouragement.',
    ],
  }),
  idea('ftw_growth_mindset_h_05', ['growth_mindset:high'], {
    focus: [
      'When you look at your life, you tend to see things you want to improve.',
      'You usually have a few self-improvement goals going at once.',
      'When you have free time, you tend to spend it learning something.',
    ],
    why: 'Wanting to grow keeps your life interesting, but it can make you forget to enjoy your life as it is now.',
    try: [
      'Write down three things you like about your life right now, so you see what’s already good.',
      'Take one evening off from self-improvement, so you get time to just enjoy.',
    ],
    watch: [
      'Notice when improving feels like pressure instead of fun.',
      'Notice what you already do well.',
    ],
  }),
  idea('ftw_growth_mindset_h_06', ['growth_mindset:high', 'locus_of_control:high'], {
    focus: [
      'When something goes wrong, you tend to look at what you could do better and make a plan.',
      'You usually take responsibility for setbacks and work out how to improve.',
      'When a plan fails, you tend to ask what you can change next time.',
    ],
    why: 'Owning your part helps you improve, but not every setback is something you could have changed.',
    try: [
      'Write down one part of a recent setback that wasn’t up to you, so you don’t carry all of it.',
      'Pick one change to make next time and let the rest go, so you can move forward.',
    ],
    watch: [
      'Notice when you take blame for something outside your control.',
      'Notice how often your plans actually work.',
    ],
  }),
  idea('ftw_growth_mindset_l_01', ['growth_mindset:low'], {
    focus: [
      'When choosing what to do, you tend to stick with things you’re already good at.',
      'You usually prefer doing what you know you can do well.',
      'When a new skill feels hard, you tend to decide it’s just not for you.',
    ],
    why: 'Sticking to your strengths makes sense, but some skills only feel hard to you at the start.',
    try: [
      'Try one new skill for ten minutes today, so you see how it feels after the start.',
      'Ask a friend how long it took them to learn something, so you know the slow start is normal.',
    ],
    watch: [
      'Notice when you decide you’re bad at something after one try.',
      'Notice how much easier things get with practice.',
    ],
  }),
  idea('ftw_growth_mindset_l_02', ['growth_mindset:low'], {
    focus: [
      'When something isn’t working, you tend to accept it rather than try to change it.',
      'You usually feel at peace with how things are.',
      'When a friend pushes you to change something, you tend to feel it’s fine as it is.',
    ],
    why: 'Being content saves you stress, but small changes might make some things easier for you.',
    try: [
      'Pick one small thing that bugs you and change it this week, so you see if it helps.',
      'Ask a friend what they’ve changed recently, so you get one new idea.',
    ],
    watch: [
      'Notice when something bothers you more than you let on.',
      'Notice whether a small change would be worth it.',
    ],
  }),
  idea('ftw_growth_mindset_l_03', ['growth_mindset:low'], {
    focus: [
      'When you get critical feedback, you tend to take it as a judgment of you as a person.',
      'You usually take criticism as a sign you’re not good at something.',
      'When your work is critiqued, you tend to feel discouraged for a while.',
    ],
    why: 'Feedback can sting, but it’s usually about one piece of your work, not about you as a person.',
    try: [
      'Write down one specific thing to try from the feedback, so it becomes a step, not a judgment.',
      'Ask the person what they think went well, so you get the full picture.',
    ],
    watch: [
      'Notice when feedback makes you want to quit.',
      'Notice how often feedback helped you later.',
    ],
  }),
  idea('ftw_growth_mindset_l_04', ['growth_mindset:low'], {
    focus: [
      'When things are going fine, you tend to see no reason to change them.',
      'You usually feel happy with the skills and routines you already have.',
      'When others talk about self-improvement, you tend to feel it’s not for you.',
    ],
    why: 'Being happy with what you have is a strength, and growth can be small and easy when you want it.',
    try: [
      'Pick one thing you enjoy and learn one new fact about it, so growth feels fun.',
      'Watch one short video about a hobby you like, so you learn without pressure.',
    ],
    watch: [
      'Notice what you’re curious about.',
      'Notice when you feel like trying something new.',
    ],
  }),
  idea('ftw_growth_mindset_l_05', ['growth_mindset:low'], {
    focus: [
      'When something new doesn’t work out at first, you tend to stop trying.',
      'You usually move on quickly when a new hobby feels hard.',
      'When you struggle at the start, you tend to think you’re not made for it.',
    ],
    why: 'Moving on saves you frustration, but many skills feel awkward for everyone at the start.',
    try: [
      'Give a new skill three tries before deciding, so you see past the awkward start.',
      'Write down one thing you got better at over time, so you remember it’s possible.',
    ],
    watch: [
      'Notice when you quit right after the first hard moment.',
      'Notice how others struggle at the start too.',
    ],
  }),
  idea('ftw_growth_mindset_l_06', ['growth_mindset:low', 'openness:low'], {
    focus: [
      'You tend to stick with the activities and skills you already know and enjoy.',
      'When friends try new hobbies, you usually prefer to stay with what you like.',
      'You tend to feel happiest doing the things you’ve done for years.',
    ],
    why: 'Knowing what you enjoy is a strength, but a small new thing can add some fun to your week.',
    try: [
      'Join a friend for one new activity this month, so you try it with someone you trust.',
      'Pick one familiar hobby and try a new version of it, so it feels new but safe.',
    ],
    watch: [
      'Notice when you say no to something new out of habit.',
      'Notice which old favorites still make you happy.',
    ],
  }),
  idea('ftw_growth_mindset_h_07', ['growth_mindset:high'], {
    focus: [
      'When you want to get better at something, you tend to ask people who are good at it for feedback.',
      'You usually seek out advice from others who are further along than you.',
      'When you hit a plateau, you tend to look for a new way to practice.',
    ],
    why: 'Seeking feedback speeds up your learning, but too many opinions at once can make it hard to know what to do next.',
    try: [
      'Pick one person and one question to ask about your skill, so the feedback is focused.',
      'Write down one change to try this week, and try only that one, so you can tell whether it helps.',
    ],
    watch: [
      'Notice which feedback changes how you practice.',
      'Notice how you feel after hearing too many views at once.',
    ],
  }),
  idea('ftw_growth_mindset_h_08', ['growth_mindset:high'], {
    focus: [
      'When you see a skill someone else has, you tend to wonder how you could learn it.',
      'You usually take someone’s talent as a sign of practice and not luck.',
      'When a friend does something impressive, you tend to ask how they got there.',
    ],
    why: 'Seeing skill as something learned keeps you open, but it can push you to chase many skills at once.',
    try: [
      'Choose one skill you want most this month and put the others on a list, so you can focus.',
      'Ask the friend for the first step they took, so you start small.',
    ],
    watch: [
      'Notice how many skills you’re trying to build at the same time.',
      'Notice which one you would miss most if you dropped it.',
    ],
  }),
  idea('ftw_growth_mindset_h_09', ['growth_mindset:high'], {
    focus: [
      'When you compare yourself with others, you tend to compare with where you were before.',
      'You usually measure your progress against your own past more than against other people.',
      'When you feel behind, you tend to look at how far you’ve come.',
    ],
    why: 'Looking at your own progress keeps you steady, but you can miss that you are doing better than you think.',
    try: [
      'Write down three things you can do now that you couldn’t a year ago, so your progress is visible.',
      'Tell a friend about one thing you improved at this month, so you enjoy it.',
    ],
    watch: [
      'Notice when you only look ahead and not back.',
      'Notice what you got better at that you didn’t plan on.',
    ],
  }),
  idea('ftw_growth_mindset_h_10', ['growth_mindset:high'], {
    focus: [
      'When you finish learning something, you tend to start looking for the next thing to learn.',
      'You usually feel restless once you’ve reached a level you were aiming for.',
      'After you master a task, you tend to look for a harder version.',
    ],
    why: 'Looking ahead all the time keeps you growing, but it can mean you don’t stop to enjoy what you’ve learned.',
    try: [
      'Keep using a new skill for a full week before you start the next one, so it sticks.',
      'Tell someone what you just learned, so you enjoy it and make it last.',
    ],
    watch: [
      'Notice how quickly you move on from a finished goal.',
      'Notice how you feel when you stay with something you know.',
    ],
  }),
  idea('ftw_growth_mindset_h_11', ['growth_mindset:high'], {
    focus: [
      'When you fail at something, you tend to break down what went wrong.',
      'You usually look for the lesson after a setback, and often find one.',
      'When a plan doesn’t work, you tend to treat it as information.',
    ],
    why: 'Learning from setbacks makes you stronger, but looking for a lesson right away can leave little time to feel disappointed.',
    try: [
      'Give yourself one evening to be disappointed before you analyze, so the lesson comes with some rest.',
      'Tell a friend what went wrong and how it felt, so you share the feeling and not just the plan.',
    ],
    watch: [
      'Notice whether you jump past the feeling to the fix.',
      'Notice how you feel after you let the disappointment sit.',
    ],
  }),
  idea('ftw_growth_mindset_h_12', ['growth_mindset:high'], {
    focus: [
      'When someone tells you that you’re naturally good at something, you tend to say you worked at it.',
      'You usually point to practice when you get a compliment on a skill.',
      'When someone calls your skill natural, you tend to feel it leaves out the effort.',
    ],
    why: 'Giving credit to practice reminds you that you can improve, but the person was likely trying to praise you.',
    try: [
      'Say “thanks” first and mention your practice second, so the compliment lands.',
      'Tell a friend what you practice, so they see how you got there.',
    ],
    watch: [
      'Notice how people react when you mention the work behind it.',
      'Notice which parts of your skill came easily to you.',
    ],
  }),
  idea('ftw_growth_mindset_l_07', ['growth_mindset:low'], {
    focus: [
      'When a class or training is offered, you tend to skip it if you already do the job well.',
      'You usually feel you know enough about your work and don’t need much more.',
      'When your boss suggests learning something new, you tend to ask whether it is really needed.',
    ],
    why: 'Knowing your job well makes you dependable, but a field can change in small ways that are easy to miss.',
    try: [
      'Read one short article about your field this week, so you stay current without a big commitment.',
      'Ask a coworker what changed in your area lately, so you hear it from someone close.',
    ],
    watch: [
      'Notice how much has changed since you last learned something at work.',
      'Notice what training you would pick if you had to pick one.',
    ],
  }),
  idea('ftw_growth_mindset_l_08', ['growth_mindset:low'], {
    focus: [
      'When you try something and aren’t good at first, you tend to feel it’s not for you.',
      'You usually stop an activity when the first few tries feel awkward.',
      'When you start from zero, you tend to feel uncomfortable and want to go back to what you know.',
    ],
    why: 'Wanting to be good at things is natural, but almost everyone feels awkward at the start, and it usually passes for you too.',
    try: [
      'Give a new activity three tries before you decide, so you see past the awkward start.',
      'Tell a friend you’re new at something, so you feel free to be bad at it.',
    ],
    watch: [
      'Notice what you feel in the first ten minutes of something new.',
      'Notice how it feels on the third try.',
    ],
  }),
  idea('ftw_growth_mindset_l_09', ['growth_mindset:low'], {
    focus: [
      'When you describe yourself, you tend to say things like “I’m just not good at that.”',
      'You usually think of your skills as set, so you stick to what suits you.',
      'When someone suggests you try a new skill, you tend to say it’s not your thing.',
    ],
    why: 'Knowing your strengths helps you choose well, but saying “not my thing” too early can close doors you might enjoy.',
    try: [
      'Change “I can’t” to “I can’t yet” in your head once today, so the door stays open.',
      'Pick one skill you’ve said you can’t do and try the first small step, so you test it.',
    ],
    watch: [
      'Notice how often you say you’re not good at something.',
      'Notice how many of those things you’ve actually tried.',
    ],
  }),
  idea('ftw_growth_mindset_l_10', ['growth_mindset:low'], {
    focus: [
      'When your life feels stable, you tend to want to keep it that way.',
      'You usually find a steady routine more comforting than a chance to change.',
      'When someone says “you could grow,” you tend to feel you’re fine as you are.',
    ],
    why: 'Being content is worth a lot, but small changes can keep you steady while giving you something fresh.',
    try: [
      'Add one small thing to your week that is new, so your stability has some variety.',
      'Ask yourself what you would change if nothing could go wrong, so you hear what you actually want.',
    ],
    watch: [
      'Notice what you feel when someone suggests a change.',
      'Notice what you would miss if nothing ever changed.',
    ],
  }),
  idea('ftw_growth_mindset_l_11', ['growth_mindset:low'], {
    focus: [
      'When you get negative feedback, you tend to take it as proof you are not good at something.',
      'You usually feel discouraged for a while after hearing what you did wrong.',
      'When your work is corrected, you tend to feel it reflects on you as a whole.',
    ],
    why: 'Feedback can feel personal when you care about your work, but it is usually about one piece of it and not about you.',
    try: [
      'Ask the person which one thing to change first, so the feedback becomes a single step.',
      'Write the feedback down and read it the next day, so it feels smaller.',
    ],
    watch: [
      'Notice how big the feedback seems on the day and the day after.',
      'Notice how many of your skills were not mentioned at all.',
    ],
  }),
  idea('ftw_growth_mindset_l_12', ['growth_mindset:low'], {
    focus: [
      'When you’ve found a way that works, you tend to use it again and again.',
      'You usually don’t look for new methods once something is working fine.',
      'When a task goes well, you tend to repeat the same steps next time.',
    ],
    why: 'Repeating what works makes you efficient, but a better method may be out there that you’d find with a small test.',
    try: [
      'Try one small change to a routine task this week, so you see whether it helps.',
      'Ask a coworker how they do the same task, so you compare notes.',
    ],
    watch: [
      'Notice which tasks you could do faster with a new method.',
      'Notice how you feel when you change one step.',
    ],
  }),
];
