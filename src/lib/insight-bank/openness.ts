/** Curiosity (openness): Adventurous (high) and Familiar (low). */
import { idea, type InsightIdea } from './define';

export const OPENNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_openness_h_01', ['openness:high'], {
    focus: [
      'At a restaurant, you usually pick a dish you have never ordered, even when you already know a favorite.',
      'Choosing where to eat, you can skip the usual place for one you have not tried.',
      'The new item on the menu sometimes gets your order before the dish you already like.',
    ],
    why: 'A new place keeps the night interesting, but you can skip the sure dish you would have enjoyed more.',
    try: [
      'Next time you order, ask what you would pick if it did not have to be new, so you choose on purpose.',
      'Pick one old favorite restaurant this week and go back, so you can see what it still gives you.',
    ],
    watch: [
      'Notice whether you pick a dish because it is new or because you actually want it.',
      'Notice how a familiar restaurant feels once you are actually there.',
    ],
  }),
  idea('ftw_openness_h_02', ['openness:high'], {
    focus: [
      'Starting a new project can excite you, and the last stretch can drag once it stops feeling new.',
      'When a project stops feeling new, you usually lose interest before the last pages are done.',
      'A fresh doc is easy for you to open, and the slow middle of an old one can sit untouched.',
    ],
    why: 'A new idea pulls you in, so the slow middle of a project can feel flat even when you are close.',
    try: [
      'Pick one half-finished project and write the next small step, so it is easier to pick back up.',
      'Before you open anything new this week, spend ten minutes on the project you already started.',
    ],
    watch: [
      'Notice when a new idea shows up in your notes right as an old project gets boring.',
      'Notice how close to done the unfinished file on your desk actually is.',
    ],
  }),
  idea('ftw_openness_h_03', ['openness:high'], {
    focus: [
      'When a friend mentions a topic you do not know, you usually ask a string of questions about it.',
      'A coworker bringing up something unfamiliar can pull a lot of questions out of you.',
      'In the group chat, a subject you have never heard of sometimes gets you digging in.',
    ],
    why: 'Your questions can make people feel interesting, but they can also pull the talk away from what the person wanted to say.',
    try: [
      'Next time a friend tells you something new in the chat, ask how they feel about it, so it stays about them.',
      'Look up one thing you were curious about this week, so the question does not just sit in your head.',
    ],
    watch: [
      'Notice when your questions move the talk somewhere the other person did not mean to go.',
      'Notice which topics you keep coming back to when you have a free hour.',
    ],
  }),
  idea('ftw_openness_h_04', ['openness:high'], {
    focus: [
      'When the week starts looking the same, you usually get restless before the people around you do.',
      'The same lunch and the same route can bore you faster than they bore your coworkers.',
      'Doing the same evening every day sometimes has you hunting for a change by Wednesday.',
    ],
    why: 'Variety keeps you engaged, but some routines are what free your time for the new stuff you like.',
    try: [
      'Change one small thing today, like your route or your lunch spot, so the day feels less flat.',
      'Pick one routine that actually helps you and keep it as it is this week, so you can see what it saves.',
    ],
    watch: [
      'Notice whether you are bored of a routine or just tired that day.',
      'Notice which parts of your week you would miss if they changed.',
    ],
  }),
  idea('ftw_openness_h_05', ['openness:high'], {
    focus: [
      'On a trip, you usually want to wander and find things instead of following a written list.',
      'A day out can feel better to you when the next stop is a surprise, not a pinned time.',
      'You sometimes enjoy a place you stumbled on more than the sight you had planned.',
    ],
    why: 'Leaving room for a surprise can make the day more fun for you, but people with you might want to know what is next.',
    try: [
      'Before your next outing with friends, pick one fixed stop, so everyone has a place to count on.',
      'Ask whoever you are going with how much they like to plan, so you can find a shape you both like.',
    ],
    watch: [
      'Notice when the people with you seem unsure about what is happening next.',
      'Notice how one planned stop changes how much you enjoy the day out.',
    ],
  }),
  idea('ftw_openness_h_06', ['openness:high', 'extraversion:high'], {
    focus: [
      'When friends suggest a new place, you usually say yes and start adding more people to the chat.',
      'A new plan with friends can turn, in your hands, into a bigger group before the night arrives.',
      'You sometimes want company for a thing you have not tried, and the invite list grows.',
    ],
    why: 'Your curiosity makes the plans happen, but a quieter friend might feel pulled into more than they wanted.',
    try: [
      'Next time you invite a group, text one quieter friend on their own, so they can say yes or no easily.',
      'Ask a friend what new thing they have wanted to try, so the next plan is theirs.',
    ],
    watch: [
      'Notice who goes quiet when a new plan gets bigger in the chat.',
      'Notice whether you enjoy the new place or mostly the crowd around it.',
    ],
  }),
  idea('ftw_openness_l_01', ['openness:low'], {
    focus: [
      'When you go out to eat, you usually order the dish you already know you like.',
      'You can go back to the same few places because you already know they are good.',
      'Choosing where to go, you sometimes stick with the spot you already trust.',
    ],
    why: 'Knowing what you like saves you a bad meal, but you can miss a dish you would enjoy just as much.',
    try: [
      'Next time you order, try one side or one drink you have not had, so the risk stays small.',
      'Ask a friend for their favorite spot nearby and save it for a day you feel like trying it.',
    ],
    watch: [
      'Notice whether you choose your usual because you want it or because it is easier.',
      'Notice how often a new dish turns out fine once you actually order it.',
    ],
  }),
  idea('ftw_openness_l_02', ['openness:low'], {
    focus: [
      'When work changes a process that already worked, you usually feel frustrated before you see the point.',
      'A new tool from your boss can have you missing the old way for a while.',
      'You sometimes prefer the system that already works over the new one in the work chat.',
    ],
    why: 'You value what is already proven, which protects you from change for its own sake, but a good change can feel harder at first.',
    try: [
      'Write down one thing the new way does better, so you judge it on more than how new it feels.',
      'Give a new process one honest week before you decide, so the first reaction is not the final one.',
    ],
    watch: [
      'Notice whether your doubt is about the change itself or just the newness.',
      'Notice how many tools you rely on now were new to you once.',
    ],
  }),
  idea('ftw_openness_l_03', ['openness:low'], {
    focus: [
      'When you want to relax, you usually rewatch a show you already love instead of starting a new one.',
      'A tired night can send you back to a familiar movie or a playlist you already know.',
      'After a long day, you sometimes reach for the songs and shows you already know by heart.',
    ],
    why: 'Familiar shows help you rest because they take no effort, and that is a real need, not a lack of curiosity.',
    try: [
      'Keep your comfort show for tonight, and save one friend’s recommendation for a day you are more awake.',
      'Ask a friend what they are watching, so you have one new option ready when you want it.',
    ],
    watch: [
      'Notice which moods make you want something familiar on the couch.',
      'Notice when you are in the mood for something new and actually have the hours for it.',
    ],
  }),
  idea('ftw_openness_l_04', ['openness:low'], {
    focus: [
      'When you plan time off, you usually go somewhere you have been and know you will enjoy.',
      'A free weekend can go to the same trip you already trust, rather than a place you have not seen.',
      'You sometimes spend a day off on the walk and the meal you already know you like.',
    ],
    why: 'Going back to a known place makes the time off reliable, but a friend might read it as you not wanting their idea.',
    try: [
      'Next time a friend suggests a new plan, say yes to one small part of it, so they know you will come.',
      'Look up one new cafe near a place you already love, so you can try it without losing the familiar trip.',
    ],
    watch: [
      'Notice how you react the first time someone suggests a plan you have not done.',
      'Notice whether the familiar trip still feels as good as it did last time.',
    ],
  }),
  idea('ftw_openness_l_05', ['openness:low'], {
    focus: [
      'When someone shares a new idea, you usually want proof it works before you get on board.',
      'A friend’s excited pitch can get a how-will-it-work question from you before a yes.',
      'You sometimes wait to see if a new idea holds up before you say yes to it.',
    ],
    why: 'Your caution catches problems early, but a person sharing an idea might feel shut down if the questions come first.',
    try: [
      'Next time someone shares an idea, say one thing you like about it before your first question, so they keep talking.',
      'Pick one new idea you set aside recently and give it a second look, so it gets a fair shot.',
    ],
    watch: [
      'Notice whether your first reply in the chat to a new idea is a question or a doubt.',
      'Notice how people react when you push back on something they are excited about.',
    ],
  }),
  idea('ftw_openness_l_06', ['openness:low', 'conscientiousness:high'], {
    focus: [
      'A routine that works usually gets followed by you the same way, even when someone wants to change it.',
      'Once you have a system, you can keep using it exactly, down to the same order in the morning.',
      'You sometimes trust the proven checklist and stick to it, even when a coworker suggests another way.',
    ],
    why: 'Your morning routine makes you reliable, but it can hide a small change that would save you time.',
    try: [
      'Pick one morning routine and ask yourself if it still saves time, so you keep it for a reason.',
      'Ask a coworker how they handle a task you both do in the same doc, so you can borrow one step if it helps.',
    ],
    watch: [
      'Notice when you follow the morning checklist even though the reason for it is gone.',
      'Notice how you feel when a coworker does your task in a different order.',
    ],
  }),
];
