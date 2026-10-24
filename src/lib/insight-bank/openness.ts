/** Curiosity (openness): Adventurous (high) and Familiar (low). */
import { idea, type InsightIdea } from './define';

export const OPENNESS_IDEAS: readonly InsightIdea[] = [
  idea("ftw_openness_h_01", ["openness:high"], {
    focus: [
      "Your answers suggest you like trying new things, even when a favorite is right there.",
      "From your answers, you like trying new things, even when a favorite is right there.",
      "The pattern in your answers is that you like trying new things, even when a favorite is right there.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_02", ["openness:high"], {
    focus: [
      "The catch in your answers is passing on something that would have been more fun.",
      "What this can cost you is passing on something that would have been more fun.",
      "A cost worth naming for you is passing on something that would have been more fun.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_03", ["openness:high"], {
    focus: [
      "Someone else might notice that you reach for a new option even when a favorite is still there.",
      "From the outside, you reach for a new option even when a favorite is still there.",
      "Other people can see that you reach for a new option even when a favorite is still there.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_04", ["openness:high"], {
    focus: [
      "What you might miss is a favorite you would have enjoyed.",
      "Your answers leave room to miss a favorite you would have enjoyed.",
      "A thing you might skip is a favorite you would have enjoyed.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_05", ["openness:high"], {
    focus: [
      "The helpful side for you shows up when the new option is actually the better one.",
      "Your answers also show a use when the new option is actually the better one.",
      "There is a use for you when the new option is actually the better one.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_06", ["openness:high", "extraversion:high"], {
    focus: [
      "Your answers suggest two things at once: you try new things, and you want people around.",
      "Both can be true for you in the same week: you try new things, and you want people around.",
      "In the same week, you try new things, and you want people around.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_01", ["openness:low"], {
    focus: [
      "Your answers suggest you stick with something you already know you like.",
      "From your answers, you stick with something you already know you like.",
      "The pattern in your answers is that you stick with something you already know you like.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_02", ["openness:low"], {
    focus: [
      "The catch in your answers is skipping a change that would have been better.",
      "What this can cost you is skipping a change that would have been better.",
      "A cost worth naming for you is skipping a change that would have been better.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_03", ["openness:low"], {
    focus: [
      "Someone else might notice that you stay with a known favorite even when a new option waits.",
      "From the outside, you stay with a known favorite even when a new option waits.",
      "Other people can see that you stay with a known favorite even when a new option waits.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_04", ["openness:low"], {
    focus: [
      "What you might miss is a new option you would have liked.",
      "Your answers leave room to miss a new option you would have liked.",
      "A thing you might skip is a new option you would have liked.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_05", ["openness:low"], {
    focus: [
      "The helpful side for you shows up when the favorite still fits.",
      "Your answers also show a use when the favorite still fits.",
      "There is a use for you when the favorite still fits.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_06", ["openness:low", "conscientiousness:high"], {
    focus: [
      "Your answers suggest two things at once: you keep a known favorite, and you finish the plan.",
      "Both can be true for you in the same week: you keep a known favorite, and you finish the plan.",
      "In the same week, you keep a known favorite, and you finish the plan.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea('ftw_openness_h_07', ['openness:high'], {
    focus: [
      'When a friend recommends a book, show or podcast, you tend to start it that same week.',
      'You usually say yes to a recommendation right away and start it before your current one is done.',
      'When someone you trust says “you’d love this,” you tend to try it quickly.',
    ],
    why: 'Saying yes to recommendations keeps your days interesting, but a growing pile can leave you with many things half-finished.',
    try: [
      'Finish or drop one thing you’ve started this week, so a new one doesn’t crowd it out.',
      'Write your recommendations in one list and pick one a week, so none get lost.',
    ],
    watch: [
      'Notice how many things you have going at once.',
      'Notice whether you’re still enjoying what you started last week.',
    ],
  }),
  idea('ftw_openness_h_08', ['openness:high'], {
    focus: [
      'When you learn something new, you tend to want to tell someone about it right away.',
      'You usually share the interesting thing you just read or heard, even when no one asked.',
      'When a topic grabs you, you tend to bring it up with friends and coworkers.',
    ],
    why: 'Sharing what you learn makes conversations lively, but others might not be as interested in the topic as you are.',
    try: [
      'Next time you share something, ask the other person what they’ve been into lately, so it goes both ways.',
      'Tell a friend one thing you learned in a single sentence, so they can ask for more if they want.',
    ],
    watch: [
      'Notice when the person you’re talking to stops asking questions.',
      'Notice which topics get a friend’s full attention.',
    ],
  }),
  idea('ftw_openness_h_09', ['openness:high'], {
    focus: [
      'When someone describes their life or job, you tend to find it more interesting than they expect.',
      'You usually want to hear how other people see things, even when it’s very different from you.',
      'When you meet someone with a different background, you tend to ask a lot of questions.',
    ],
    why: 'Your interest in other views helps people open up, but some questions can feel like too much from someone they just met.',
    try: [
      'Next time you meet someone new, let them lead where the conversation goes, so they stay comfortable.',
      'Pick one friend with a very different view and ask what shaped it, so you hear their full story.',
    ],
    watch: [
      'Notice when a person gives short answers to your questions.',
      'Notice which conversations leave you with a new way of thinking.',
    ],
  }),
  idea('ftw_openness_h_10', ['openness:high'], {
    focus: [
      'When you shop or spend money, you tend to be drawn to the unusual option over the safe one.',
      'You usually pick the item that looks different, even when a standard one would work fine.',
      'You tend to like the less common one when you choose between two things.',
    ],
    why: 'Unusual choices can feel more like you, but they sometimes cost more or turn out harder to use than a plain version.',
    try: [
      'Before you buy something unusual, ask yourself how you’ll use it next week, so the choice holds up.',
      'Pick one plain, reliable thing you own and notice how often you use it, so you see what it gives you.',
    ],
    watch: [
      'Notice whether you still like an unusual pick a month later.',
      'Notice how often you choose the odd one just because it’s different.',
    ],
  }),
  idea('ftw_openness_h_11', ['openness:high'], {
    focus: [
      'When you have a day with nothing planned, you tend to wander into something you didn’t expect.',
      'You usually fill an open day with something new instead of resting.',
      'On a free day, you tend to look for something different to do rather than a quiet one.',
    ],
    why: 'New plans get you going, but a free day with no rest in it can leave you tired by the time Monday comes.',
    try: [
      'Plan one new thing and one slow hour for your next free day, so you get both.',
      'Ask yourself tonight whether you want something new or something easy tomorrow, so you choose on purpose.',
    ],
    watch: [
      'Notice how tired you feel after a full free day.',
      'Notice whether you want something new or just something different from work.',
    ],
  }),
  idea('ftw_openness_h_12', ['openness:high'], {
    focus: [
      'When someone tells you a rule is just how things are done, you tend to ask why.',
      'You usually question a habit or rule at work that no one else seems to notice.',
      'When your team does something the same way every time, you tend to wonder if there’s a better way.',
    ],
    why: 'Questioning how things are done can find better ways, but coworkers might hear it as criticism of what they built, even when you mean well.',
    try: [
      'Before you suggest a change, ask a coworker how the current way started, so your idea fits what they know.',
      'Write your idea down and share it with one person first, so you hear their view before the group does.',
    ],
    watch: [
      'Notice how coworkers react when you ask why something is done a certain way.',
      'Notice whether your idea solves a problem others feel too.',
    ],
  }),
  idea('ftw_openness_l_07', ['openness:low'], {
    focus: [
      'When you get a new phone or app, you tend to keep your old settings and way of using it.',
      'You usually learn a new tool only as much as you need to get your task done.',
      'When an app changes its layout, you tend to feel annoyed until you get used to it.',
    ],
    why: 'Sticking with what works saves effort, but an update can sometimes include a feature that would save you time.',
    try: [
      'Spend five minutes looking at what changed in an app you use every day, so you know what’s new.',
      'Ask a friend which feature of an app they use most, so you can try one thing from them.',
    ],
    watch: [
      'Notice whether your annoyance at a change fades after a few days.',
      'Notice which tools you use the same way every day.',
    ],
  }),
  idea('ftw_openness_l_08', ['openness:low'], {
    focus: [
      'When someone invites you to something outside your usual plans, you tend to say you’ll think about it.',
      'You usually need time to warm up to an invitation that isn’t part of your normal week.',
      'When a friend suggests something new, you tend to ask a lot of questions before you agree.',
    ],
    why: 'Taking time to decide keeps you from plans you wouldn’t enjoy, but friends might feel your “maybe” means no.',
    try: [
      'Next time a friend invites you somewhere new, give a yes or no within a day, so they can plan.',
      'Ask the friend what the plan involves, so you can say yes to the parts that suit you.',
    ],
    watch: [
      'Notice how often a plan you doubted turned out fine.',
      'Notice which questions you ask before saying yes.',
    ],
  }),
  idea('ftw_openness_l_09', ['openness:low'], {
    focus: [
      'When you have a task you’ve done before, you tend to do it the same way every time.',
      'You usually stick to the method you learned first, even when someone shows you a shortcut.',
      'You tend to follow the same steps every time you cook or clean.',
    ],
    why: 'A set way of doing things makes you quick and sure, but a shortcut from someone else could save you a step.',
    try: [
      'Next time someone shows you a different way to do a chore, try it once, so you see if it’s faster.',
      'Check how long a routine task takes today, so you know what your usual way costs.',
    ],
    watch: [
      'Notice when you reject a new method before trying it.',
      'Notice how much time your usual way actually takes.',
    ],
  }),
  idea('ftw_openness_l_10', ['openness:low'], {
    focus: [
      'When you talk with someone about big ideas or what-ifs, you tend to bring it back to what’s real.',
      'You usually prefer to talk about things that happened over things that might happen.',
      'When a friend talks about an unusual theory, you tend to ask for the facts behind it.',
    ],
    why: 'Staying with what’s real keeps conversations clear, but a friend sharing a what-if might just want you to play along.',
    try: [
      'Next time a friend shares a what-if, answer with one idea of your own before asking for facts, so they feel heard.',
      'Pick a what-if question to ask a friend this week, so you see how they think.',
    ],
    watch: [
      'Notice when a friend’s idea gets quieter after your first question.',
      'Notice which what-if topics you actually enjoy.',
    ],
  }),
  idea('ftw_openness_l_11', ['openness:low'], {
    focus: [
      'When you decorate or pick clothes, you tend to choose things you know you like over a new style.',
      'You usually wear and buy the same kinds of things because they work for you.',
      'You tend to go back to the brands and styles you already trust when you shop.',
    ],
    why: 'Knowing your own taste saves time and money, but a small change now and then can show you something you like even more.',
    try: [
      'Try one item that’s a little different from your usual this month, so you test your taste.',
      'Ask a friend what they’d pick for you, so you see one new option without much risk.',
    ],
    watch: [
      'Notice whether you pick the usual because you love it or because it’s easy.',
      'Notice what you’d change if you had no cost to think about.',
    ],
  }),
  idea('ftw_openness_l_12', ['openness:low'], {
    focus: [
      'When you’re at work and a new project comes up, you tend to prefer ones that look like past work.',
      'You usually do your best work on tasks that follow a pattern you’ve already learned.',
      'When your boss offers you something unfamiliar, you tend to worry about getting it wrong.',
    ],
    why: 'Doing what you know well makes you dependable, but staying with familiar tasks can leave out chances to grow.',
    try: [
      'Next time a new task comes up, ask your boss what support you’d have, so it feels less risky.',
      'Pick one small part of a new task you could try first, so you build up to the whole thing.',
    ],
    watch: [
      'Notice which new tasks you turn down and why.',
      'Notice how you feel once you’ve done an unfamiliar task a second time.',
    ],
  }),
];
