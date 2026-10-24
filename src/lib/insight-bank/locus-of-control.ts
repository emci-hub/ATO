/** Ownership (locus_of_control): Accountable (high) and Accepting (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const LOCUS_OF_CONTROL_IDEAS: readonly InsightIdea[] = [
  idea("ftw_locus_of_control_h_01", ["locus_of_control:high"], {
    focus: [
      "Your answers suggest you look at the part of a problem you could steer.",
      "From your answers, you look at the part of a problem you could steer.",
      "The pattern in your answers is that you look at the part of a problem you could steer.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_02", ["locus_of_control:high"], {
    focus: [
      "The catch in your answers is a blame that lands only on you.",
      "What this can cost you is a blame that lands only on you.",
      "A cost worth naming for you is a blame that lands only on you.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_03", ["locus_of_control:high"], {
    focus: [
      "Someone else might notice that you look for the part you could steer instead of blaming the day.",
      "From the outside, you look for the part you could steer instead of blaming the day.",
      "Other people can see that you look for the part you could steer instead of blaming the day.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_04", ["locus_of_control:high"], {
    focus: [
      "What you might miss is the part that was actually outside your hands.",
      "Your answers leave room to miss the part that was actually outside your hands.",
      "A thing you might skip is the part that was actually outside your hands.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_05", ["locus_of_control:high"], {
    focus: [
      "The helpful side for you shows up when a steerable part is worth finding.",
      "Your answers also show a use when a steerable part is worth finding.",
      "There is a use for you when a steerable part is worth finding.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_06", ["locus_of_control:high", "conscientiousness:high"], {
    focus: [
      "Your answers suggest two things at once: you look at your part, and you finish the plan.",
      "Both can be true for you in the same week: you look at your part, and you finish the plan.",
      "In the same week, you look at your part, and you finish the plan.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_l_01", ["locus_of_control:low"], {
    focus: [
      "Your answers suggest you figure a bad outcome was bound to happen.",
      "From your answers, you figure a bad outcome was bound to happen.",
      "The pattern in your answers is that you figure a bad outcome was bound to happen.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_02", ["locus_of_control:low"], {
    focus: [
      "The catch in your answers is a cause that ignores a real lever.",
      "What this can cost you is a cause that ignores a real lever.",
      "A cost worth naming for you is a cause that ignores a real lever.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_03", ["locus_of_control:low"], {
    focus: [
      "Someone else might notice that you treat the outcome as bound to happen even when a lever is visible.",
      "From the outside, you treat the outcome as bound to happen even when a lever is visible.",
      "Other people can see that you treat the outcome as bound to happen even when a lever is visible.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_04", ["locus_of_control:low"], {
    focus: [
      "What you might miss is a lever you could have used.",
      "Your answers leave room to miss a lever you could have used.",
      "A thing you might skip is a lever you could have used.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_05", ["locus_of_control:low"], {
    focus: [
      "The helpful side for you shows up when some outcomes really are outside the choice.",
      "Your answers also show a use when some outcomes really are outside the choice.",
      "There is a use for you when some outcomes really are outside the choice.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_06", ["locus_of_control:low", "steadiness:high"], {
    focus: [
      "Your answers suggest two things at once: you blame the day, and you shake a bad day off.",
      "Both can be true for you in the same week: you blame the day, and you shake a bad day off.",
      "In the same week, you blame the day, and you shake a bad day off.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea('ftw_locus_of_control_h_07', ['locus_of_control:high'], {
    focus: [
      'When something goes wrong that you only partly caused, you tend to take more of the blame than is fair.',
      'You usually look first at your own part when a group effort fails.',
      'When a friend makes a bad choice, you tend to wonder if you should have stopped them.',
    ],
    why: 'Owning your part builds trust, but taking more than your share can leave you feeling guilty about things you couldn’t control.',
    try: [
      'Write down what part of a problem was yours and what part wasn’t, so you see where the line is.',
      'Ask a friend how much of an issue they think was on you, so you get another view.',
    ],
    watch: [
      'Notice how much of a problem you assign to yourself.',
      'Notice what other things played a part.',
    ],
  }),
  idea('ftw_locus_of_control_h_08', ['locus_of_control:high'], {
    focus: [
      'When you face a problem you can’t fix, you tend to keep looking for something you can do.',
      'You usually find it hard to accept that some things are out of your hands.',
      'When a situation drags on, you tend to feel responsible for finding a solution.',
    ],
    why: 'Looking for what you can do keeps you active, but some situations need patience more than action.',
    try: [
      'List what is in your control and what isn’t, then pick one thing from the first list, so you act where it counts.',
      'Set aside the unchangeable part for the day, so your attention goes where it can help.',
    ],
    watch: [
      'Notice when you try to fix something that needs time.',
      'Notice how you feel after you let one thing go.',
    ],
  }),
  idea('ftw_locus_of_control_h_09', ['locus_of_control:high'], {
    focus: [
      'When you want to change something about your life, you tend to start with a small action right away.',
      'You usually believe your effort will change how things go.',
      'When a habit isn’t working, you tend to look for what you can do about it.',
    ],
    why: 'Believing in your effort gets you moving, but results sometimes take longer than you expect, and that can feel like failure.',
    try: [
      'Set a check-in date a month out for your next change, so you judge it over a fair stretch.',
      'Celebrate the effort you put in this week, even if the result isn’t there yet, so you keep going.',
    ],
    watch: [
      'Notice how soon you expect results.',
      'Notice how you feel when effort doesn’t show yet.',
    ],
  }),
  idea('ftw_locus_of_control_h_10', ['locus_of_control:high'], {
    focus: [
      'When friends or family are struggling, you tend to want to help them solve it.',
      'You usually offer a plan to a person who just wanted to vent.',
      'When someone you love has a problem, you tend to feel you should be doing something.',
    ],
    why: 'Wanting to help comes from care, but people can feel pressured when you give a plan and not a listening ear.',
    try: [
      'Ask “do you want ideas or just a listener?” before you respond, so you give what’s needed.',
      'Wait to give your first suggestion until the person has finished talking, so they feel heard.',
    ],
    watch: [
      'Notice how often you jump to solutions.',
      'Notice how the person reacts when you listen first.',
    ],
  }),
  idea('ftw_locus_of_control_h_11', ['locus_of_control:high'], {
    focus: [
      'When you plan for a big event, you tend to think about everything that could go wrong and prepare for it.',
      'You usually believe good planning prevents most problems.',
      'When a trip or project is coming up, you tend to take charge of the details.',
    ],
    why: 'Planning prevents a lot of trouble, but some surprises will happen anyway, and over-planning can leave you tired.',
    try: [
      'Plan for the top three risks only, so you still have time for the rest.',
      'Say “we’ll figure it out” about one detail, so you practice leaving room for surprises.',
    ],
    watch: [
      'Notice which of your plans were never needed.',
      'Notice how you handle a surprise you didn’t plan for.',
    ],
  }),
  idea('ftw_locus_of_control_h_12', ['locus_of_control:high'], {
    focus: [
      'When you do well, you tend to credit your effort and your choices.',
      'You usually see your results as something you earned.',
      'When someone says you’re lucky, you tend to feel it misses the work you put in.',
    ],
    why: 'Seeing your success as earned keeps you driven, but timing and help usually played a part too.',
    try: [
      'Name one lucky break or helpful person behind your last success, so you see the whole picture.',
      'Thank the person who helped you, so they know their part mattered.',
    ],
    watch: [
      'Notice what luck or help played a part in your wins.',
      'Notice how you feel about other people’s success.',
    ],
  }),
  idea('ftw_locus_of_control_l_07', ['locus_of_control:low'], {
    focus: [
      'When you miss out on something, you tend to say the timing wasn’t right.',
      'You usually put a disappointment down to circumstances instead of your choices.',
      'When a plan doesn’t work out, you tend to say it wasn’t meant to be.',
    ],
    why: 'Accepting circumstances keeps you from beating yourself up, but you may also skip a lesson that could help next time.',
    try: [
      'Ask yourself one question after a disappointment: “Was there anything I could do next time?” so you take what’s useful.',
      'Tell a friend what happened and ask what they’d try, so you hear a different view.',
    ],
    watch: [
      'Notice when “bad timing” is the whole story and when it isn’t.',
      'Notice what you would do differently next time.',
    ],
  }),
  idea('ftw_locus_of_control_l_08', ['locus_of_control:low'], {
    focus: [
      'When you’re at work and a decision gets made above you, you tend to accept it and adapt.',
      'You usually go with changes at work without pushing back.',
      'When your team’s plan changes, you tend to shrug and carry on.',
    ],
    why: 'Adapting keeps you steady, but a change that affects you may go ahead without your view if you don’t share it.',
    try: [
      'Share one concern with your boss next time something changes, so your view is on the record.',
      'Ask what’s behind a change, so you understand it and can plan around it.',
    ],
    watch: [
      'Notice what you would say if you thought it would be heard.',
      'Notice how your boss reacts when you ask questions.',
    ],
  }),
  idea('ftw_locus_of_control_l_09', ['locus_of_control:low'], {
    focus: [
      'When you set a goal, you tend to say you’ll see how it goes.',
      'You usually prefer to leave results open instead of promising yourself an outcome.',
      'You tend to take a new project as it comes.',
    ],
    why: 'Taking things as they come keeps pressure low, but without a small plan you may drift away from what you wanted.',
    try: [
      'Write one small step for this week on your goal, so it has a place in your days.',
      'Tell a friend what you hope for, so you have someone to check with.',
    ],
    watch: [
      'Notice which goals fade without a plan.',
      'Notice how a small step changes how real the goal feels.',
    ],
  }),
  idea('ftw_locus_of_control_l_10', ['locus_of_control:low'], {
    focus: [
      'When someone close is upset about something that happened, you tend to say these things happen.',
      'You usually respond to bad news with a calm “it is what it is.”',
      'When a friend feels it’s all their fault, you tend to tell them it wasn’t.',
    ],
    why: 'Your calm can help a friend feel less alone with it, but a friend may want to talk through what happened before letting go.',
    try: [
      'Ask a friend what happened before you reassure them, so they feel heard.',
      'Say “that sounds hard” first, then add your view, so the comfort lands.',
    ],
    watch: [
      'Notice how quickly you move to “it is what it is.”',
      'Notice how a friend reacts when you ask for more detail.',
    ],
  }),
  idea('ftw_locus_of_control_l_11', ['locus_of_control:low'], {
    focus: [
      'When your health or money gets worse, you tend to think it’s partly out of your hands.',
      'You usually find big outcomes hard to link to your daily choices.',
      'When a result is far away, you tend to put your effort into the present instead.',
    ],
    why: 'Not blaming yourself keeps you calm, but some small daily choices do add up to big results over time.',
    try: [
      'Pick one small daily habit that helps your health or money, so you can watch it add up.',
      'Set a reminder to check one result in a month, so the link between effort and outcome shows.',
    ],
    watch: [
      'Notice which daily choices changed something later.',
      'Notice how it feels to see a small effort pay off.',
    ],
  }),
  idea('ftw_locus_of_control_l_12', ['locus_of_control:low'], {
    focus: [
      'When you have a stressful week, you tend to remind yourself you can only do so much.',
      'You usually let go of the parts of a problem you can’t change.',
      'When a deadline slips, you tend to say you did what you could.',
    ],
    why: 'Letting go protects your time, but some parts you wrote off as out of your hands might have had a simple fix.',
    try: [
      'Check each stressful item and ask “is there a small thing I can do?” so you catch easy fixes.',
      'Ask someone for help with one item, so you test what is possible.',
    ],
    watch: [
      'Notice which parts you let go of first.',
      'Notice whether any of them could have been fixed with a simple step.',
    ],
  }),
];
