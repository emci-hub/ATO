/** Independence (autonomy): Self-directed (high) and Guided (low). */
import { idea, type InsightIdea } from './define';

export const AUTONOMY_IDEAS: readonly InsightIdea[] = [
  idea("ftw_autonomy_h_01", ["autonomy:high"], {
    focus: [
      "Your answers suggest you want to do a task in a way you chose.",
      "From your answers, you want to do a task in a way you chose.",
      "The pattern in your answers is that you want to do a task in a way you chose.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_02", ["autonomy:high"], {
    focus: [
      "The catch in your answers is a way that ignores a good set path.",
      "What this can cost you is a way that ignores a good set path.",
      "A cost worth naming for you is a way that ignores a good set path.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_03", ["autonomy:high"], {
    focus: [
      "Someone else might notice that you pick your own way even when a set path is available.",
      "From the outside, you pick your own way even when a set path is available.",
      "Other people can see that you pick your own way even when a set path is available.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_04", ["autonomy:high"], {
    focus: [
      "What you might miss is a set path that would have worked.",
      "Your answers leave room to miss a set path that would have worked.",
      "A thing you might skip is a set path that would have worked.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_05", ["autonomy:high"], {
    focus: [
      "The helpful side for you shows up when a self-chosen way can fit better.",
      "Your answers also show a use when a self-chosen way can fit better.",
      "There is a use for you when a self-chosen way can fit better.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_06", ["autonomy:high", "relatedness:low"], {
    focus: [
      "Your answers suggest two things at once: you choose the way, and you can skip the tie.",
      "Both can be true for you in the same week: you choose the way, and you can skip the tie.",
      "In the same week, you choose the way, and you can skip the tie.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_l_01", ["autonomy:low"], {
    focus: [
      "Your answers suggest you follow a path that is already set.",
      "From your answers, you follow a path that is already set.",
      "The pattern in your answers is that you follow a path that is already set.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_02", ["autonomy:low"], {
    focus: [
      "The catch in your answers is a path that was never questioned.",
      "What this can cost you is a path that was never questioned.",
      "A cost worth naming for you is a path that was never questioned.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_03", ["autonomy:low"], {
    focus: [
      "Someone else might notice that you take the set path even when your own way is available.",
      "From the outside, you take the set path even when your own way is available.",
      "Other people can see that you take the set path even when your own way is available.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_04", ["autonomy:low"], {
    focus: [
      "What you might miss is a way you would have chosen.",
      "Your answers leave room to miss a way you would have chosen.",
      "A thing you might skip is a way you would have chosen.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_05", ["autonomy:low"], {
    focus: [
      "The helpful side for you shows up when a set path can be the right one.",
      "Your answers also show a use when a set path can be the right one.",
      "There is a use for you when a set path can be the right one.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_06", ["autonomy:low", "relatedness:high"], {
    focus: [
      "Your answers suggest two things at once: you take the set path, and you need a real tie.",
      "Both can be true for you in the same week: you take the set path, and you need a real tie.",
      "In the same week, you take the set path, and you need a real tie.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea('ftw_autonomy_h_07', ['autonomy:high'], {
    focus: [
      'When you learn a new tool or skill, you tend to dive in and work it out yourself.',
      'You usually skip the tutorial and figure things out by trying them.',
      'When something is new, you tend to prefer exploring it alone before asking anyone.',
    ],
    why: 'Learning by doing makes the skill yours, but a quick tip from someone who knows can save you hours.',
    try: [
      'Ask one person how they use a tool you’re learning, so you can pick up a shortcut.',
      'Set a time limit on figuring something out alone, so you know when to ask.',
    ],
    watch: [
      'Notice how much time you spend solving something others could explain in a minute.',
      'Notice what you enjoy most about working it out yourself.',
    ],
  }),
  idea('ftw_autonomy_h_08', ['autonomy:high'], {
    focus: [
      'When you plan your day, you tend to want to set the order and the pace yourself.',
      'You usually do your best work when you pick when and how to do it.',
      'When your schedule is set by someone else, you tend to feel restless.',
    ],
    why: 'Setting your own pace keeps you going, but teammates may need to know when you’ll be available.',
    try: [
      'Share your plan for the day with one teammate, so they know when to expect your work.',
      'Pick a fixed time each day for messages, so you keep your pace without leaving people waiting.',
    ],
    watch: [
      'Notice which parts of your day you want to control most.',
      'Notice how others respond when they do not know what you are working on.',
    ],
  }),
  idea('ftw_autonomy_h_09', ['autonomy:high'], {
    focus: [
      'When someone offers advice you didn’t ask for, you tend to hear it as a sign they doubt you.',
      'You usually prefer to reach your own conclusion before hearing what others think.',
      'When people tell you what to do, you tend to want to do the opposite.',
    ],
    why: 'Deciding for yourself keeps your choices your own, even when advice has useful facts.',
    try: [
      'Say “thanks, I’ll think about it” to unwanted advice, so you keep both the peace and your choice.',
      'Pick one piece of advice you got this month and test it, so you see whether it holds up.',
    ],
    watch: [
      'Notice when you reject advice before you’ve heard all of it.',
      'Notice how often advice turns out to be useful.',
    ],
  }),
  idea('ftw_autonomy_h_10', ['autonomy:high'], {
    focus: [
      'When you travel, you tend to want your own plan, even with a group.',
      'You usually need some time on a trip to wander off on your own.',
      'When friends plan everything together, you tend to want a free block of your own.',
    ],
    why: 'Having your own time keeps you enjoying the trip, but the group may wonder if you’d rather be elsewhere.',
    try: [
      'Tell the group early which block of time you’d like to keep for yourself, so they plan around it.',
      'Join one group activity fully before you go off alone, so everyone feels included.',
    ],
    watch: [
      'Notice how the group feels when you step away.',
      'Notice how you feel when you return to working with others.',
    ],
  }),
  idea('ftw_autonomy_h_11', ['autonomy:high'], {
    focus: [
      'When you share a job with someone, you tend to split it so each of you has your own part.',
      'You usually prefer to own a piece of the work from start to finish.',
      'You tend to want a clear area that is yours when you work on a team.',
    ],
    why: 'Owning your own piece still requires checking that the parts fit together.',
    try: [
      'Check in with your teammate halfway through a split job, so the pieces fit at the end.',
      'Share what you’re planning for your part in two sentences, so others can plan around it.',
    ],
    watch: [
      'Notice when pieces of your work don’t match what teammates expected.',
      'Notice how early you share what you’re doing.',
    ],
  }),
  idea('ftw_autonomy_h_12', ['autonomy:high'], {
    focus: [
      'When you ask for help, you tend to want it on your terms without anyone taking over.',
      'You usually accept help best when it leaves the decision to you.',
      'When someone helps you too much, you tend to feel your choices are being taken away.',
    ],
    why: 'Wanting to stay in charge keeps you invested, but helpers may not know how much help you want unless you tell them.',
    try: [
      'Tell a helper what you want from them, like “just check my numbers,” so they match what you need.',
      'Thank someone for help and say how it made your job easier, so they know what worked.',
    ],
    watch: [
      'Notice how much help feels right and how much feels like too much.',
      'Notice how people react when you say what you need.',
    ],
  }),
  idea('ftw_autonomy_l_07', ['autonomy:low'], {
    focus: [
      'When you get an open-ended task, you tend to want to know what a good result looks like first.',
      'You usually do your best when the goal and steps are clear.',
      'When there are no instructions, you tend to feel unsure where to start.',
    ],
    why: 'Clear goals help you do solid work, but waiting for them can slow you down when no one has time to explain.',
    try: [
      'Write down what you think a good result looks like and check it with the person who asked before you start.',
      'Ask one question about the goal before you begin, so you know what to aim at.',
    ],
    watch: [
      'Notice how long you wait for instructions before you begin.',
      'Notice how much you can do before you need an answer.',
    ],
  }),
  idea('ftw_autonomy_l_08', ['autonomy:low'], {
    focus: [
      'When a friend or partner makes a decision for both of you, you tend to feel relieved.',
      'You usually feel glad when someone else picks the plan and you can join in.',
      'When you have too many choices, you tend to ask someone else to decide.',
    ],
    why: 'Letting others decide takes pressure off you, but over time your own wishes may not get a chance to be heard.',
    try: [
      'Pick one small decision this week and make it yourself, so you build the habit.',
      'Tell a friend your top choice before you ask what they think, so your view is in the mix.',
    ],
    watch: [
      'Notice which decisions you hand over and which you keep.',
      'Notice how it feels to decide something small on your own.',
    ],
  }),
  idea('ftw_autonomy_l_09', ['autonomy:low'], {
    focus: [
      'When you start at a new place, you tend to learn best by following someone who knows the ropes.',
      'You usually pick up a routine faster when someone shows you.',
      'You tend to watch how others do things before you start when you join a team.',
    ],
    why: 'Learning from people who know saves you time, but you may need to step out on your own before you feel ready.',
    try: [
      'Ask your guide to watch you do one task on your own, so you get feedback while you try.',
      'Suggest one small change you noticed, so you start to add your own touch.',
    ],
    watch: [
      'Notice when you could try something before being shown.',
      'Notice how others react when you offer an idea.',
    ],
  }),
  idea('ftw_autonomy_l_10', ['autonomy:low'], {
    focus: [
      'When your manager checks in on your work, you tend to find it helpful.',
      'You usually like to know you’re on the right track from someone you trust.',
      'When a mentor gives direction, you tend to follow it closely.',
    ],
    why: 'Regular check-ins keep your work on course, but relying on them too much can leave you waiting when no one is around.',
    try: [
      'Write down one decision you can make without checking, so you start to trust your call.',
      'Ask your manager what you can decide on your own, so you know where the line is.',
    ],
    watch: [
      'Notice which decisions you check that you already know the answer to.',
      'Notice how your confidence changes when you make a call on your own.',
    ],
  }),
  idea('ftw_autonomy_l_11', ['autonomy:low'], {
    focus: [
      'When you plan something for yourself, you tend to ask what others would do first.',
      'You usually look for a model to follow before you make your own plan.',
      'You tend to copy a routine that works for someone else when you set up a new one.',
    ],
    why: 'Using proven examples saves you from guessing, but a routine that fits someone else may not fit you.',
    try: [
      'Change one part of a borrowed routine to suit you, so it becomes yours.',
      'Write what you like about the plan you copied, so you know what to keep.',
    ],
    watch: [
      'Notice which parts of a borrowed plan don’t fit you.',
      'Notice what you would choose with no example to follow.',
    ],
  }),
  idea('ftw_autonomy_l_12', ['autonomy:low'], {
    focus: [
      'When a group has a leader you trust, you tend to be happy to follow.',
      'You usually do well in a team where someone sets the direction.',
      'When someone else takes charge of a project, you tend to feel you can focus on your part.',
    ],
    why: 'Trusting a leader lets you focus on doing your part well, but a leader may want your ideas and not know you have them.',
    try: [
      'Share one idea with your leader this week, so they hear what you think.',
      'Offer to lead a small piece of the project, so you practice setting direction.',
    ],
    watch: [
      'Notice when you have a view you don’t share.',
      'Notice how your leader reacts when you offer an idea.',
    ],
  }),
];
