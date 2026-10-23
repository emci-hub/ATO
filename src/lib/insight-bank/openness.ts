/** Curiosity (openness): Adventurous (high) and Familiar (low). */
import { idea, type InsightIdea } from './define';

export const OPENNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_openness_h_01', ['openness:high'], {
    focus: [
      'When you pick a place to eat, you tend to choose somewhere you’ve never been over a sure thing.',
      'You usually try the new thing on the menu, even when you already know what you like.',
      'Given the choice, you tend to go for the place or plan you haven’t tried yet.',
    ],
    why: 'Trying new things keeps you interested, but it can mean skipping the sure thing you’d actually enjoy more.',
    try: [
      'Next time you order, ask yourself what you’d pick if newness didn’t count, so you choose on purpose.',
      'Pick one old favorite this week and go back to it, so you can see what it still gives you.',
    ],
    watch: [
      'Notice whether you pick something because it’s new or because you actually want it.',
      'Notice how you feel about a familiar plan once you’re actually there.',
    ],
  }),
  idea('ftw_openness_h_02', ['openness:high'], {
    focus: [
      'You tend to get excited starting new projects, but finishing them can feel slow once they stop being new.',
      'When a project stops feeling new, you tend to lose interest before it’s done.',
      'Starting something new comes easily to you, but the last stretch of a project can drag.',
    ],
    why: 'New ideas give you energy, so the slow middle of a project can feel like nothing’s happening even when you’re close.',
    try: [
      'Pick one half-finished project and write down the next small step, so it’s easier to pick back up.',
      'Before you start anything new this week, spend ten minutes on something you already started.',
    ],
    watch: [
      'Notice when a new idea shows up right as an old project gets boring.',
      'Notice how close to done your unfinished projects actually are.',
    ],
  }),
  idea('ftw_openness_h_03', ['openness:high'], {
    focus: [
      'When someone mentions something you don’t know about, you tend to ask a lot of questions.',
      'You usually get curious when a coworker or friend brings up something unfamiliar.',
      'When a conversation turns to a topic you’ve never heard of, you tend to dig in.',
    ],
    why: 'Your curiosity helps people feel interesting, but sometimes it can pull the conversation away from what they wanted to say.',
    try: [
      'Next time a friend tells you something new, ask how they feel about it, so it stays about them.',
      'Look up one thing you were curious about this week, so the question doesn’t just sit in your head.',
    ],
    watch: [
      'Notice when your questions move the conversation somewhere the other person didn’t mean to go.',
      'Notice which topics you keep coming back to when you have free time.',
    ],
  }),
  idea('ftw_openness_h_04', ['openness:high'], {
    focus: [
      'When your week starts to look the same every day, you tend to get restless fast.',
      'You usually feel bored by routines sooner than the people around you do.',
      'Doing the same thing every day tends to wear on you faster than it does for most people.',
    ],
    why: 'Variety keeps you engaged, but some routines are what free up your time and energy for the new stuff you like.',
    try: [
      'Change one small thing in your routine today, like your route or lunch spot, so the day feels less flat.',
      'Pick one routine that actually helps you and keep it as is this week, so you can see what it saves you.',
    ],
    watch: [
      'Notice whether you’re bored of a routine or just tired that day.',
      'Notice which parts of your week you’d miss if they changed.',
    ],
  }),
  idea('ftw_openness_h_05', ['openness:high'], {
    focus: [
      'When you travel, you tend to want to wander and find things instead of following a plan.',
      'On a trip, you usually prefer exploring over sticking to a list of sights.',
      'You tend to enjoy finding things by chance more than planning every stop ahead.',
    ],
    why: 'Leaving room for surprises can make plans more fun for you, but people traveling with you might want to know what’s next.',
    try: [
      'Before your next outing with friends, plan just one fixed stop, so everyone has something to count on.',
      'Ask whoever you’re going with how much they like to plan, so you can find a plan you both like.',
    ],
    watch: [
      'Notice when the people with you seem unsure about what’s happening next.',
      'Notice how a little planning changes how much you enjoy the day.',
    ],
  }),
  idea('ftw_openness_h_06', ['openness:high', 'extraversion:high'], {
    focus: [
      'When friends suggest a new place or plan, you tend to say yes and bring more people along.',
      'You usually jump at new plans with friends and love turning them into a group thing.',
      'When there’s something new to try, you tend to want company to try it with.',
    ],
    why: 'Your mix of curiosity and energy makes plans happen, but quieter friends might feel pulled into more than they wanted.',
    try: [
      'Next time you invite a group, text one quieter friend separately, so they can say yes or no easily.',
      'Ask a friend what new thing they’ve wanted to try, so the next plan is theirs.',
    ],
    watch: [
      'Notice who goes quiet when a new plan gets bigger.',
      'Notice whether you enjoy the new thing or mostly the crowd around it.',
    ],
  }),
  idea('ftw_openness_l_01', ['openness:low'], {
    focus: [
      'When you go out to eat, you tend to order what you already know you like.',
      'You usually go back to the same few places because you know they’re good.',
      'When choosing where to go, you tend to stick with the spots you already trust.',
    ],
    why: 'Knowing what you like saves you time and disappointment, but it can mean missing something you’d enjoy just as much.',
    try: [
      'Next time you order, try one side or drink you haven’t had before, so the risk stays small.',
      'Ask a friend for their favorite spot nearby and save it for a day you feel like trying something.',
    ],
    watch: [
      'Notice whether you choose your usual because you want it or because it’s easier.',
      'Notice how often a new thing turns out fine when you do try it.',
    ],
  }),
  idea('ftw_openness_l_02', ['openness:low'], {
    focus: [
      'When work changes a process that already worked, you tend to feel frustrated before you see the point.',
      'You usually prefer the way things already work over a new system at your job.',
      'When your boss brings in a new tool, you tend to miss the old way for a while.',
    ],
    why: 'You value what’s proven, which protects you from change for its own sake, but it can make good changes feel harder at first.',
    try: [
      'Write down one thing the new way does better, so you’re judging it on more than how new it feels.',
      'Give a new process one honest week before deciding, so your first reaction isn’t the final one.',
    ],
    watch: [
      'Notice whether your doubt about a change is about the change itself or just the newness.',
      'Notice how many things you rely on now were new to you once.',
    ],
  }),
  idea('ftw_openness_l_03', ['openness:low'], {
    focus: [
      'When you want to relax, you tend to rewatch a show you already love instead of starting a new one.',
      'You usually pick a familiar movie or playlist when you’re tired.',
      'After a long day, you tend to go back to the shows and songs you already know.',
    ],
    why: 'Familiar things help you rest because they take no effort, and that’s a real need, not a lack of curiosity.',
    try: [
      'Keep your comfort show for tonight, and save one new recommendation for a day you have more energy.',
      'Ask a friend what they’re watching, so you have one new option ready when you want it.',
    ],
    watch: [
      'Notice which moods make you want something familiar.',
      'Notice when you’re in the mood for something new and actually have the energy for it.',
    ],
  }),
  idea('ftw_openness_l_04', ['openness:low'], {
    focus: [
      'When you plan time off, you tend to go somewhere you’ve been before and know you’ll enjoy.',
      'You usually prefer a trip you know will be good over a gamble on somewhere new.',
      'When you get a free weekend, you tend to spend it doing what you already know you like.',
    ],
    why: 'Going back to what you know makes your time off reliable, but friends might read it as not wanting to try their ideas.',
    try: [
      'Next time a friend suggests a new plan, say yes to one small part of it, so they know you’re open.',
      'Look up one new thing near a place you already love, so you can try it without losing the familiar trip.',
    ],
    watch: [
      'Notice how you react the first time someone suggests a plan you haven’t done.',
      'Notice whether a familiar plan still feels as good as it did.',
    ],
  }),
  idea('ftw_openness_l_05', ['openness:low'], {
    focus: [
      'When someone shares a new idea, you tend to want proof it works before you get on board.',
      'You usually wait to see if a new idea holds up before you say yes to it.',
      'When a friend is excited about something new, you tend to ask how it’ll actually work.',
    ],
    why: 'Your caution catches problems early, but people sharing ideas with you might feel shut down if the questions come first.',
    try: [
      'Next time someone shares an idea, say one thing you like before your first question, so they keep talking.',
      'Pick one new idea you dismissed recently and give it a second look, so it gets a fair shot.',
    ],
    watch: [
      'Notice whether your first reply to a new idea is a question or a doubt.',
      'Notice how people react when you push back on something they’re excited about.',
    ],
  }),
  idea('ftw_openness_l_06', ['openness:low', 'conscientiousness:high'], {
    focus: [
      'You tend to keep routines that work and follow them closely, even when others want to change them.',
      'When you’ve found a system that works, you usually keep using it exactly the same way.',
      'You tend to trust your proven routines and stick to them, even when someone suggests a new way.',
    ],
    why: 'Your routines make you reliable, but they can make it hard to notice when a small change would save you time.',
    try: [
      'Pick one routine and ask yourself if it still saves time, so you keep it for a reason.',
      'Ask a coworker how they handle a task you both do, so you can borrow one idea if it helps.',
    ],
    watch: [
      'Notice when you follow a routine even though the reason for it is gone.',
      'Notice how you feel when someone does your task a different way.',
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
      'When you choose between two things, you tend to like the one that’s less common.',
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
    why: 'New plans give you energy, but a free day with no rest in it can leave you tired by the time Monday comes.',
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
      'When you cook or clean, you tend to follow the same steps every time.',
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
      'When you shop, you tend to go back to the brands and styles you already trust.',
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
