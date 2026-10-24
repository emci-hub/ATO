/** Self-belief (self_efficacy): Bold (high) and Hesitant (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const SELF_EFFICACY_IDEAS: readonly InsightIdea[] = [
  idea("ftw_self_efficacy_h_01", ["self_efficacy:high"], {
    focus: [
      "Your answers suggest you expect to finish a big task once it is started.",
      "From your answers, you expect to finish a big task once it is started.",
      "The pattern in your answers is that you expect to finish a big task once it is started.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_02", ["self_efficacy:high"], {
    focus: [
      "The catch in your answers is a start that ignores the size.",
      "What this can cost you is a start that ignores the size.",
      "A cost worth naming for you is a start that ignores the size.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_03", ["self_efficacy:high"], {
    focus: [
      "Someone else might notice that you start a big task and expect to finish it.",
      "From the outside, you start a big task and expect to finish it.",
      "Other people can see that you start a big task and expect to finish it.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_04", ["self_efficacy:high"], {
    focus: [
      "What you might miss is the size of the task.",
      "Your answers leave room to miss the size of the task.",
      "A thing you might skip is the size of the task.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_05", ["self_efficacy:high"], {
    focus: [
      "The helpful side for you shows up when expecting to finish can get the task going.",
      "Your answers also show a use when expecting to finish can get the task going.",
      "There is a use for you when expecting to finish can get the task going.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_06", ["self_efficacy:high", "openness:high"], {
    focus: [
      "Your answers suggest two things at once: you expect to finish, and you try new things.",
      "Both can be true for you in the same week: you expect to finish, and you try new things.",
      "In the same week, you expect to finish, and you try new things.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_l_01", ["self_efficacy:low"], {
    focus: [
      "Your answers suggest you pause before trusting a big task can be finished.",
      "From your answers, you pause before trusting a big task can be finished.",
      "The pattern in your answers is that you pause before trusting a big task can be finished.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_02", ["self_efficacy:low"], {
    focus: [
      "The catch in your answers is a pause that never becomes a start.",
      "What this can cost you is a pause that never becomes a start.",
      "A cost worth naming for you is a pause that never becomes a start.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_03", ["self_efficacy:low"], {
    focus: [
      "Someone else might notice that you pause on a big task even when a small version is available.",
      "From the outside, you pause on a big task even when a small version is available.",
      "Other people can see that you pause on a big task even when a small version is available.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_04", ["self_efficacy:low"], {
    focus: [
      "What you might miss is the small version that was available.",
      "Your answers leave room to miss the small version that was available.",
      "A thing you might skip is the small version that was available.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_05", ["self_efficacy:low"], {
    focus: [
      "The helpful side for you shows up when a pause can be a careful read.",
      "Your answers also show a use when a pause can be a careful read.",
      "There is a use for you when a pause can be a careful read.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_06", ["self_efficacy:low", "competence:low"], {
    focus: [
      "Your answers suggest two things at once: you pause on the big task, and you doubt the hard task.",
      "Both can be true for you in the same week: you pause on the big task, and you doubt the hard task.",
      "In the same week, you pause on the big task, and you doubt the hard task.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea('ftw_self_efficacy_h_07', ['self_efficacy:high'], {
    focus: [
      'When a job posting asks for skills you only partly have, you tend to apply anyway.',
      'You usually go for an opportunity even when you don’t meet every requirement.',
      'You tend to say you’ll grow into a chance that stretches you.',
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
      'You tend to expect to improve fast when you try something new.',
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
