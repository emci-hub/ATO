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
      'Ask whoever you’re going with how much they like to plan, so you can meet in the middle.',
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
      'Notice the old habits you once had to learn too.',
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
];
