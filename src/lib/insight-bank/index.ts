/**
 * The stored Focus · try · watch bank (emci, 2026-10-07). Replaces the
 * AI-written daily insight: Home picks one idea from here, on the device, with
 * no model call, no quota and no AI consent gate, and saves it through the
 * same `insert_daily_insight` RPC the AI insight used.
 *
 * How an idea maps onto a `daily_insights` row:
 *   theme      = the trait tags (`ideaTheme`), the chip row on Home
 *   title      = the focus (one of three wordings)
 *   reflection = why
 *   try_today  = try (one of two)
 *   watch_for  = watch (one of two)
 *
 * The title is how a stored row is matched back to its idea (`ideaForTitle`),
 * which is why every focus wording in the bank must be unique. A row whose
 * title is not in the bank was written by the old AI insight; it is hidden in
 * every history surface and ignored by the picker, never deleted.
 *
 * UNREVIEWED: INSIGHT_BANK_COPY_REVIEWED stays false until emci ticks
 * docs/insight-bank-review.md. Nothing in the app renders the flag (emci,
 * 2026-10-07: no draft badge for this bank).
 */
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { axisOfKey, type LineKey } from '@/lib/daily-line/bank';
import { isShareableLean } from '@/lib/legends64/identity';
import type { TraitLean } from '@/lib/traits';

import { AGREEABLENESS_IDEAS } from './agreeableness';
import { ATTACHMENT_ANXIETY_IDEAS } from './attachment-anxiety';
import { ATTACHMENT_AVOIDANCE_IDEAS } from './attachment-avoidance';
import { AUTONOMY_IDEAS } from './autonomy';
import { COMPETENCE_IDEAS } from './competence';
import { CONFLICT_ASSERTIVENESS_IDEAS } from './conflict-assertiveness';
import { CONFLICT_COOPERATIVENESS_IDEAS } from './conflict-cooperativeness';
import { CONSCIENTIOUSNESS_IDEAS } from './conscientiousness';
import type { InsightIdea } from './define';
import { EXTRAVERSION_IDEAS } from './extraversion';
import { GROWTH_MINDSET_IDEAS } from './growth-mindset';
import { LOCUS_OF_CONTROL_IDEAS } from './locus-of-control';
import { OPENNESS_IDEAS } from './openness';
import { PLAYFULNESS_IDEAS } from './playfulness';
import { RELATEDNESS_IDEAS } from './relatedness';
import { SELF_EFFICACY_IDEAS } from './self-efficacy';
import { STARTER_IDEAS } from './starters';
import { STEADINESS_IDEAS } from './steadiness';

export type { InsightIdea } from './define';

export const INSIGHT_BANK_COPY_REVIEWED = false;

/** Ideas with at least one key, in trait order. */
export const TRAIT_IDEAS: readonly InsightIdea[] = [
  ...OPENNESS_IDEAS,
  ...CONSCIENTIOUSNESS_IDEAS,
  ...EXTRAVERSION_IDEAS,
  ...AGREEABLENESS_IDEAS,
  ...STEADINESS_IDEAS,
  ...ATTACHMENT_ANXIETY_IDEAS,
  ...ATTACHMENT_AVOIDANCE_IDEAS,
  ...CONFLICT_ASSERTIVENESS_IDEAS,
  ...CONFLICT_COOPERATIVENESS_IDEAS,
  ...AUTONOMY_IDEAS,
  ...COMPETENCE_IDEAS,
  ...RELATEDNESS_IDEAS,
  ...GROWTH_MINDSET_IDEAS,
  ...LOCUS_OF_CONTROL_IDEAS,
  ...SELF_EFFICACY_IDEAS,
  ...PLAYFULNESS_IDEAS,
];

export { STARTER_IDEAS };

export const ALL_IDEAS: readonly InsightIdea[] = [...TRAIT_IDEAS, ...STARTER_IDEAS];

const BY_ID = new Map(ALL_IDEAS.map((entry) => [entry.id, entry]));

export function ideaById(id: string): InsightIdea | null {
  return BY_ID.get(id) ?? null;
}

export interface TitleMatch {
  idea: InsightIdea;
  /** Which of the three focus wordings the title is. */
  variant: number;
}

const BY_TITLE = new Map<string, TitleMatch>();
for (const entry of ALL_IDEAS) {
  entry.focus.forEach((text, variant) => BY_TITLE.set(text, { idea: entry, variant }));
}

/**
 * Focus wordings changed by the 2026-10-19 copy review: old wording → current
 * wording. Stored rows are matched by title, so the old text still maps to its
 * idea and variant (today's saved insight and the no-repeat history keep
 * working). Add a line here whenever a focus text is reworded.
 */
export const RETIRED_FOCUS_TEXT: Readonly<Record<string, string>> = {
  "At a restaurant, you usually pick a dish you have never ordered, even when you already know a favorite.":
    "Your answers suggest you like trying new things, even when a favorite is right there.",
  "Choosing where to eat, you can skip the usual place for one you have not tried.":
    "From your answers, you like trying new things, even when a favorite is right there.",
  "The new item on the menu sometimes gets your order before the dish you already like.":
    "The pattern in your answers is that you like trying new things, even when a favorite is right there.",
  "Your answers suggest you like trying something new, even when a familiar option is already there.":
    "Your answers suggest you like trying new things, even when a favorite is right there.",
  "You like a new option even when you already know one you enjoy.":
    "From your answers, you like trying new things, even when a favorite is right there.",
  "Choosing something new can appeal to you even when a familiar choice is right there.":
    "The pattern in your answers is that you like trying new things, even when a favorite is right there.",
  "After a busy week, a quiet night at home usually sounds better to you than a night out.":
    "You recharge with time to yourself.",
  "A calendar full of social plans can leave you tired before the week is over.":
    "From your answers, you recharge with time to yourself.",
  "You sometimes come back to yourself in time alone, especially after a long day around people.":
    "The pattern in your answers is that you recharge with time to yourself.",
  "You usually keep every promise you make, even the ones you said yes to too fast.":
    "Your answers also show a use when the plan is worth finishing.",
  "You usually keep your promises, even the ones you said yes to too fast.":
    "Your answers also show a use when the plan is worth finishing.",
  "You adapt to new plans easily, but small tasks tend to stack up when there’s no deadline.":
    "From your answers, you keep plans loose on purpose.",
  "You handle changing plans well, but small tasks can pile up when there’s no deadline.":
    "From your answers, you keep plans loose on purpose.",
  "You usually see problems as smaller than others do, which can feel like you’re not taking them seriously.":
    "From the outside, you move on from a bad day even when it is still going.",
  "You usually see problems as smaller than others do, so people may feel you’re not taking them seriously.":
    "From the outside, you move on from a bad day even when it is still going.",
  "When something goes wrong, you tend to sleep fine and feel better by morning.":
    "A thing you might skip is a problem that needed another look.",
  "When something goes wrong, you tend to feel more settled by the next day.":
    "A thing you might skip is a problem that needed another look.",
  "You’re usually the person people call when something goes wrong.":
    "Your answers also show a use when the bad day does not need the whole week.",
  "People tend to call you first when something goes wrong.":
    "Your answers also show a use when the bad day does not need the whole week.",
  "A new option can pull you in while a favorite is still available.":
    "From your answers, you like trying new things, even when a favorite is right there.",
  "You can want the new thing and still have a favorite sitting there.":
    "The pattern in your answers is that you like trying new things, even when a favorite is right there.",
  "Starting a new project can excite you, and the last stretch can drag once it stops feeling new.":
    "The catch in your answers is passing on something that would have been more fun.",
  "When a project stops feeling new, you usually lose interest before the last pages are done.":
    "What this can cost you is passing on something that would have been more fun.",
  "A fresh doc is easy for you to open, and the slow middle of an old one can sit untouched.":
    "A cost worth naming for you is passing on something that would have been more fun.",
  "When a friend mentions a topic you do not know, you usually ask a string of questions about it.":
    "Someone else might notice that you reach for a new option even when a favorite is still there.",
  "A coworker bringing up something unfamiliar can pull a lot of questions out of you.":
    "From the outside, you reach for a new option even when a favorite is still there.",
  "In the group chat, a subject you have never heard of sometimes gets you digging in.":
    "Other people can see that you reach for a new option even when a favorite is still there.",
  "When the week starts looking the same, you usually get restless before the people around you do.":
    "What you might miss is a favorite you would have enjoyed.",
  "The same lunch and the same route can bore you faster than they bore your coworkers.":
    "Your answers leave room to miss a favorite you would have enjoyed.",
  "Doing the same evening every day sometimes has you hunting for a change by Wednesday.":
    "A thing you might skip is a favorite you would have enjoyed.",
  "On a trip, you usually want to wander and find things instead of following a written list.":
    "The helpful side for you shows up when the new option is actually the better one.",
  "A day out can feel better to you when the next stop is a surprise, not a pinned time.":
    "Your answers also show a use when the new option is actually the better one.",
  "You sometimes enjoy a place you stumbled on more than the sight you had planned.":
    "There is a use for you when the new option is actually the better one.",
  "When friends suggest a new place, you usually say yes and start adding more people to the chat.":
    "Your answers suggest two things at once: you try new things, and you want people around.",
  "A new plan with friends can turn, in your hands, into a bigger group before the night arrives.":
    "Both can be true for you in the same week: you try new things, and you want people around.",
  "You sometimes want company for a thing you have not tried, and the invite list grows.":
    "In the same week, you try new things, and you want people around.",
  "When you go out to eat, you usually order the dish you already know you like.":
    "Your answers suggest you stick with something you already know you like.",
  "You can go back to the same few places because you already know they are good.":
    "From your answers, you stick with something you already know you like.",
  "Choosing where to go, you sometimes stick with the spot you already trust.":
    "The pattern in your answers is that you stick with something you already know you like.",
  "When work changes a process that already worked, you usually feel frustrated before you see the point.":
    "The catch in your answers is skipping a change that would have been better.",
  "A new tool from your boss can have you missing the old way for a while.":
    "What this can cost you is skipping a change that would have been better.",
  "You sometimes prefer the system that already works over the new one in the work chat.":
    "A cost worth naming for you is skipping a change that would have been better.",
  "When you want to relax, you usually rewatch a show you already love instead of starting a new one.":
    "Someone else might notice that you stay with a known favorite even when a new option waits.",
  "A tired night can send you back to a familiar movie or a playlist you already know.":
    "From the outside, you stay with a known favorite even when a new option waits.",
  "After a long day, you sometimes reach for the songs and shows you already know by heart.":
    "Other people can see that you stay with a known favorite even when a new option waits.",
  "When you plan time off, you usually go somewhere you have been and know you will enjoy.":
    "What you might miss is a new option you would have liked.",
  "A free weekend can go to the same trip you already trust, rather than a place you have not seen.":
    "Your answers leave room to miss a new option you would have liked.",
  "You sometimes spend a day off on the walk and the meal you already know you like.":
    "A thing you might skip is a new option you would have liked.",
  "When someone shares a new idea, you usually want proof it works before you get on board.":
    "The helpful side for you shows up when the favorite still fits.",
  "A friend’s excited pitch can get a how-will-it-work question from you before a yes.":
    "Your answers also show a use when the favorite still fits.",
  "You sometimes wait to see if a new idea holds up before you say yes to it.":
    "There is a use for you when the favorite still fits.",
  "A routine that works usually gets followed by you the same way, even when someone wants to change it.":
    "Your answers suggest two things at once: you keep a known favorite, and you finish the plan.",
  "Once you have a system, you can keep using it exactly, down to the same order in the morning.":
    "Both can be true for you in the same week: you keep a known favorite, and you finish the plan.",
  "You sometimes trust the proven checklist and stick to it, even when a coworker suggests another way.":
    "In the same week, you keep a known favorite, and you finish the plan.",
  "The sink is empty and your laptop is usually still open on the couch past the time you meant to stop.":
    "Your answers suggest you see a plan through once it is started.",
  "A blank Saturday can start with your to-do list, and the couch waits until the last box is checked.":
    "From your answers, you see a plan through once it is started.",
  "Your laundry usually gets folded before you sit down, even when nothing on the list is due.":
    "The pattern in your answers is that you see a plan through once it is started.",
  "A last-minute text that moves dinner can annoy you, even when the new restaurant is one you like.":
    "The catch in your answers is a plan that crowds the rest of the day.",
  "Your calendar still shows 7pm after a friend moves it, and the change can stick on the bus home.":
    "What this can cost you is a plan that crowds the rest of the day.",
  "When Friday’s reservation slides, you sometimes stay irritated even though the new time works.":
    "A cost worth naming for you is a plan that crowds the rest of the day.",
  "In the work chat, you usually post the schedule before anyone else has typed a plan.":
    "Someone else might notice that you keep going until the plan is done.",
  "The shared doc for a group project can sit empty until you fill in the dates yourself.":
    "From the outside, you keep going until the plan is done.",
  "On a friend trip, you sometimes end up holding the booking list because you want it done right.":
    "Other people can see that you keep going until the plan is done.",
  "An email can sit in drafts while you reread it, even when the first version was already fine.":
    "What you might miss is time the plan did not leave you.",
  "Before a hand-in, you usually go over the same paragraph in the doc more than once.":
    "Your answers leave room to miss time the plan did not leave you.",
  "A text with your name on it sometimes gets one more comma fix right before you send it.":
    "A thing you might skip is time the plan did not leave you.",
  "A coworker asks for a favor in chat, you say yes, and the task usually stays on your list until it is done.":
    "The helpful side for you shows up when the plan is worth finishing.",
  "A promise you made too fast on Tuesday can still own your Thursday night.":
    "Your answers also show a use when the plan is worth finishing.",
  "When a friend needs a thing done, your name is usually the first one that comes up in the group chat.":
    "There is a use for you when the plan is worth finishing.",
  "The file is in on time, and you can still be awake at midnight thinking about the slide deck.":
    "Your answers suggest two things at once: you finish the plan, and you feel a bad day longer.",
  "You usually hit the deadline, and the worry about it can outlast the work itself.":
    "Both can be true for you in the same week: you finish the plan, and you feel a bad day longer.",
  "A week of due dates gets finished, while your shoulders can stay tight the whole time.":
    "In the same week, you finish the plan, and you feel a bad day longer.",
  "A moved dinner barely registers for you, but your dry cleaning can sit by the door for days.":
    "Your answers suggest you keep plans loose on purpose.",
  "You handle a shifted meeting fine, and small errands can wait when the calendar does not force them.":
    "From your answers, you keep plans loose on purpose.",
  "With a blank Saturday, the pharmacy run usually waits until you are out of what you needed.":
    "The pattern in your answers is that you keep plans loose on purpose.",
  "When friends ask about Saturday in the chat, your reply is usually closer to the day than a yes.":
    "The catch in your answers is a loose plan that never gets finished.",
  "Your weekend plans usually get a real yes on Saturday morning, not when the group chat asks on Wednesday.":
    "What this can cost you is a loose plan that never gets finished.",
  "A friend trying to book a table can get a maybe from you while the night stays open.":
    "A cost worth naming for you is a loose plan that never gets finished.",
  "Your desk looks messy to a roommate, and you can still pull the charger out of the pile.":
    "Someone else might notice that you leave the plan open even when others want it locked.",
  "The kitchen counter can look chaotic, and you usually know which bag has the keys.":
    "From the outside, you leave the plan open even when others want it locked.",
  "Mail on your dresser sometimes sits there until someone else points at the pile.":
    "Other people can see that you leave the plan open even when others want it locked.",
  "A new morning alarm for a workout can go strong for a week, then you turn it off.":
    "What you might miss is a finish that needed a tighter plan.",
  "You usually open a habit app at full speed, and the streak can fade after a few weeks.":
    "Your answers leave room to miss a finish that needed a tighter plan.",
  "When the same run route gets dull, you sometimes drift off it without a big decision.":
    "A thing you might skip is a finish that needed a tighter plan.",
  "A long text from a friend can sit opened while you wait for the right reply.":
    "The helpful side for you shows up when the day needs room to change.",
  "You usually mean to answer, and the message that needs a real thought can stay unanswered.":
    "Your answers also show a use when the day needs room to change.",
  "A voice note that needs a careful reply can slip past the evening you meant to send one.":
    "There is a use for you when the day needs room to change.",
  "A new idea in your notes can pull you off the half-finished project sitting on the desk.":
    "Your answers suggest two things at once: you keep plans loose, and you try new things.",
  "When a fresh plan shows up, you usually leave the open tab and start the new one.":
    "Both can be true for you in the same week: you keep plans loose, and you try new things.",
  "Your list sometimes holds more new starts than finished projects, because another idea keeps arriving.":
    "In the same week, you keep plans loose, and you try new things.",
  "After a long week, a plan with a friend usually lifts you more than a quiet night on the couch.":
    "Your answers suggest you look for time with other people.",
  "On a quiet evening, the group chat can give you more of a lift than staying in with a show.":
    "From your answers, you look for time with other people.",
  "You sometimes make a plan for tonight even when the people around you want the couch.":
    "The pattern in your answers is that you look for time with other people.",
  "With something on your mind, you usually call a friend before you know what you think.":
    "The catch in your answers is a week with no time left to come back.",
  "A problem at work can stay unclear until you talk it through out loud with your partner.":
    "What this can cost you is a week with no time left to come back.",
  "You sometimes hit call on a hard day instead of sitting with it alone on the bus.":
    "A cost worth naming for you is a week with no time left to come back.",
  "When the group chat goes quiet, you usually type something before the pause has a chance.":
    "Someone else might notice that you pick time with other people over a quiet evening.",
  "In a meeting, you can be the person who talks first once the room goes still.":
    "From the outside, you pick time with other people over a quiet evening.",
  "A lull at dinner sometimes gets filled by you before the quiet person has started a sentence.":
    "Other people can see that you pick time with other people over a quiet evening.",
  "Invites can get a yes from you even when the calendar for that week is already full.":
    "What you might miss is time to yourself after a full week.",
  "Your week usually fills with plans, and then no evening is left that is just yours.":
    "Your answers leave room to miss time to yourself after a full week.",
  "When friends are going out, you sometimes join even on a night you needed the couch.":
    "A thing you might skip is time to yourself after a full week.",
  "At a new job, you can start a conversation with someone you do not know and keep it going.":
    "The helpful side for you shows up when company is what the day needs.",
  "A party usually has you talking with new people before you have found your friends.":
    "Your answers also show a use when company is what the day needs.",
  "You sometimes warm up to a new person fast and like hearing how their week went.":
    "There is a use for you when company is what the day needs.",
  "In a group, you usually bring the joke that gets the table talking.":
    "Your answers suggest two things at once: you want people around, and you turn it into play.",
  "When friends get together, you can be the one pulling a laugh out of a flat moment.":
    "Both can be true for you in the same week: you want people around, and you turn it into play.",
  "A hangout sometimes gets its pace from you joking and keeping the night moving.":
    "In the same week, you want people around, and you turn it into play.",
  "You recharge with time to yourself, especially after a stretch around other people.":
    "You recharge with time to yourself.",
  "Time to yourself is how you come back after being around other people.":
    "From your answers, you recharge with time to yourself.",
  "A stretch around other people can leave you wanting time to yourself afterward.":
    "The pattern in your answers is that you recharge with time to yourself.",
  "In a meeting, you can have a good point and wait until the moment has already passed.":
    "You recharge with time to yourself, and the next plan can feel like too much.",
  "When the group talks fast, your reply usually arrives in your head after the topic has moved.":
    "What this can cost you is a next plan that feels like too much.",
  "In a busy work chat, you sometimes think first, so your message lands after the thread has moved on.":
    "A cost worth naming for you is a next plan that feels like too much.",
  "A ringing phone usually gets a text back from you instead of you picking up.":
    "You recharge with time to yourself after time around other people.",
  "Even with a close friend, you can prefer the chat thread to a phone call.":
    "From the outside, you recharge with time to yourself after time with other people.",
  "An unexpected call sometimes waits while you reply in a message once it stops ringing.":
    "Other people can see that you recharge with time to yourself after time with other people.",
  "At a party, you usually find one person and stay in that conversation most of the night.":
    "You recharge with time to yourself, so a plan you like can still wait.",
  "One long talk with a friend can matter more to you than meeting a room of new people.":
    "Your answers leave room to miss a plan you would have enjoyed.",
  "At a big event, you sometimes look for a quiet corner or a face you already know.":
    "A thing you might skip is a plan you would have enjoyed.",
  "When you are quiet in a group, people can think you are upset or not interested.":
    "You recharge with time to yourself before you add another plan.",
  "Around new people you usually stay quiet, and some of them read that as you not liking them.":
    "Your answers also show a use when you need time to yourself before the next plan.",
  "In a meeting, listening instead of talking can look to coworkers like you stopped following.":
    "There is a use for you when you need time to yourself before the next plan.",
  "You can want the evening alone and still miss a close friend when the week has no plan with them.":
    "You recharge with time to yourself, and you need a real tie.",
  "A big group plan sometimes feels like the wrong shape, because you want quiet and one real person.":
    "Both can be true for you in the same week: you recharge with time to yourself, and you need a real tie.",
  "After a stretch alone, you usually want one real talk with someone close, not a crowded night.":
    "In the same week, you recharge with time to yourself, and you need a real tie.",
  "Friends pick where to eat, and you usually say you’re fine with anything even when you want the noodle place.":
    "Your answers suggest you go along to keep things easy.",
  "On a night out, the group’s pick can win even when you had a different place in mind.":
    "From your answers, you go along to keep things easy.",
  "A group can’t decide, and you usually let everyone else choose while your favorite stays unsaid.":
    "The pattern in your answers is that you go along to keep things easy.",
  "A coworker says something you disagree with, and you usually nod so the meeting stays pleasant.":
    "The catch in your answers is a yes that was not meant.",
  "You can skip the argument even when you think the point in the chat is wrong.":
    "What this can cost you is a yes that was not meant.",
  "A conversation gets tense, and you usually agree just so it gets easier for everyone there.":
    "A cost worth naming for you is a yes that was not meant.",
  "Someone needs help, and you usually drop what you’re doing, even with your own list still open.":
    "Someone else might notice that you give the easy yes even when a blunt no is available.",
  "Friends’ needs can move ahead of the plan you had for your own afternoon.":
    "From the outside, you give the easy yes even when a blunt no is available.",
  "A family member asks for something, and you can say yes before you’ve looked at your day.":
    "Other people can see that you give the easy yes even when a blunt no is available.",
  "Someone is rude to you, and you usually assume they’re having a bad day.":
    "What you might miss is a no you actually meant.",
  "A friend lets you down once, and you can still assume they had a good reason the next time.":
    "Your answers leave room to miss a no you actually meant.",
  "A friend cancels last minute, and you usually assume they have a good reason before you ask.":
    "A thing you might skip is a no you actually meant.",
  "You give feedback, and you usually soften it so much that the main point gets lost in the message.":
    "The helpful side for you shows up when the easy yes keeps the peace.",
  "You can add so many kind words that the real criticism gets lost in the chat.":
    "Your answers also show a use when the easy yes keeps the peace.",
  "A coworker asks for your opinion, and you usually talk about the good part and skip the problem.":
    "There is a use for you when the easy yes keeps the peace.",
  "Something bothers you, and you usually let it go instead of bringing it up in the chat.":
    "Your answers suggest two things at once: you go along, and you step back.",
  "Small annoyances can stay with you, unsent, so the evening stays calm.":
    "Both can be true for you in the same week: you go along, and you step back.",
  "A friend or partner upsets you, and you usually say it’s fine even when it isn’t.":
    "In the same week, you go along, and you step back.",
  "A friend asks for your opinion, and you usually give an honest answer even if it isn’t what they hoped.":
    "Your answers suggest you state a blunt point and stay with it.",
  "You can say what you think, even when other people in the room would soften the same point.":
    "From your answers, you state a blunt point and stay with it.",
  "Someone asks if you like their idea, and you usually tell them the truth about it.":
    "The pattern in your answers is that you state a blunt point and stay with it.",
  "Someone makes a weak argument in the chat, and you usually name the weak part right away.":
    "The catch in your answers is a blunt point that lands harder than it needed to.",
  "You can enjoy a real debate, even when other people would rather drop the topic and eat.":
    "What this can cost you is a blunt point that lands harder than it needed to.",
  "A coworker’s plan has a gap, and you usually say so in front of the whole group.":
    "A cost worth naming for you is a blunt point that lands harder than it needed to.",
  "You don’t want to do something, and you usually say no without much guilt about it.":
    "Someone else might notice that you state the blunt point instead of going along.",
  "Plans that don’t interest you can get a no, even if the rest of the group is going.":
    "From the outside, you state the blunt point instead of going along.",
  "A coworker asks for a favor you don’t have time for, and you can decline without a long apology.":
    "Other people can see that you state the blunt point instead of going along.",
  "Someone is very nice to you right away, and you usually wonder what they want from you.":
    "What you might miss is a softer version that would have landed.",
  "You can take a while to trust people who seem very friendly in the first conversation.":
    "Your answers leave room to miss a softer version that would have landed.",
  "A stranger is very warm, and you usually wait before you answer with the same warmth.":
    "A thing you might skip is a softer version that would have landed.",
  "A group picks a plan you don’t like, and you usually say so instead of going along.":
    "The helpful side for you shows up when the point needs to be said.",
  "In group plans you can push for what you want, rather than agreeing and staying quiet.":
    "Your answers also show a use when the point needs to be said.",
  "Friends choose something you don’t want, and you usually say so in the chat.":
    "There is a use for you when the point needs to be said.",
  "Something bothers you, and you usually bring it up right away and say exactly what you think.":
    "Your answers suggest two things at once: you state a blunt point, and you say it when you disagree.",
  "You can raise a problem as soon as you see it, even when other people would wait until later.":
    "Both can be true for you in the same week: you state a blunt point, and you say it when you disagree.",
  "A coworker does something that bothers you, and you usually tell them directly, the same day.":
    "In the same week, you state a blunt point, and you say it when you disagree.",
  "When something goes wrong at work, you usually stay calm while other people get stressed.":
    "Your answers suggest you shake a bad day off quickly.",
  "A plan that falls apart can leave you steady, even when the people around you are upset.":
    "From your answers, you shake a bad day off quickly.",
  "You sometimes deal with a problem in the work chat without getting upset about it.":
    "The pattern in your answers is that you shake a bad day off quickly.",
  "After an argument, you usually move on while the other person is still upset.":
    "The catch in your answers is a problem that needed more time.",
  "A bad moment can leave you done with it fast, even when your partner is still thinking about it.":
    "What this can cost you is a problem that needed more time.",
  "Once a disagreement is over, you sometimes feel finished before the other person does.":
    "A cost worth naming for you is a problem that needed more time.",
  "When a friend is upset about something small, you usually tell them it is not a big deal.":
    "Someone else might notice that you move on from a bad day even when it is still going.",
  "A worry that looks small to you can have you calming the person down before you have heard the whole story.":
    "From the outside, you move on from a bad day even when it is still going.",
  "You sometimes see a problem as smaller than the person telling it, and they can feel unheard.":
    "Other people can see that you move on from a bad day even when it is still going.",
  "When you get bad news, you usually deal with it and carry on with the rest of the day.":
    "What you might miss is a problem that needed another look.",
  "A hard text lands, and you still make the afternoon meeting.":
    "Your answers leave room to miss a problem that needed another look.",
  "When something goes wrong, you sometimes feel more settled by the next morning.":
    "A thing you might skip is a problem that needed another look.",
  "When friends or family are stressed, they usually come to you because you stay calm.":
    "The helpful side for you shows up when the bad day does not need the whole week.",
  "A crisis in the group chat can land in your messages first.":
    "Your answers also show a use when the bad day does not need the whole week.",
  "You sometimes end up as the person who handles it when something goes wrong in the family.":
    "There is a use for you when the bad day does not need the whole week.",
  "When a partner or a friend is quiet for a day, you usually assume they are just busy.":
    "Your answers suggest two things at once: you shake a bad day off, and you let a gap pass.",
  "A slow reply can sit in your chat without you worrying about what it means.":
    "Both can be true for you in the same week: you shake a bad day off, and you let a gap pass.",
  "When plans with a friend go quiet, you sometimes trust it will work out and leave the thread.":
    "In the same week, you shake a bad day off, and you let a gap pass.",
  "After a conversation, you usually replay what you said and wonder how it came across.":
    "Your answers suggest you feel a bad day for longer than the day itself.",
  "An awkward line can stay with you that night, long after everyone else has forgotten it.":
    "From your answers, you feel a bad day for longer than the day itself.",
  "You sometimes go over a thing you were unsure about once you are back on the couch.":
    "The pattern in your answers is that you feel a bad day for longer than the day itself.",
  "A good thing or a bad thing can hit you harder than it hits the people around you.":
    "The catch in your answers is a hard day that takes over the next one.",
  "You usually feel the ups and downs of the day more than the coworkers in the same room.":
    "What this can cost you is a hard day that takes over the next one.",
  "A small thing going wrong sometimes stays with you for the rest of the afternoon.":
    "A cost worth naming for you is a hard day that takes over the next one.",
  "When your boss gives you notes, you usually hear the criticism louder than the praise.":
    "Someone else might notice that you are still in a bad day after it has moved on.",
  "One critical line in a message can stay with you more than all the good lines around it.":
    "From the outside, you are still in a bad day after it has moved on.",
  "A pointed-out mistake sometimes sits with you for a while after the meeting ends.":
    "Other people can see that you are still in a bad day after it has moved on.",
  "Before a big event, you usually worry through the ways it might go wrong.":
    "What you might miss is the next day, if the bad one takes it over.",
  "A hard conversation on the calendar can make you nervous for days before it happens.":
    "Your answers leave room to miss the next day, if the bad one takes it over.",
  "When something important is coming up, you sometimes picture the bad versions in detail.":
    "A thing you might skip is the next day, if the bad one takes it over.",
  "When someone near you is in a bad mood, you usually feel it too.":
    "The helpful side for you shows up when the hard day deserves an honest read.",
  "Tension in a room can register with you before anyone has said what is wrong.":
    "Your answers also show a use when the hard day deserves an honest read.",
  "If a friend or your partner is upset, you sometimes feel upset along with them.":
    "There is a use for you when the hard day deserves an honest read.",
  "When a partner’s reply is shorter than usual, you usually worry something is wrong.":
    "Your answers suggest two things at once: you feel a bad day longer, and you check they will stay.",
  "A small change in how someone texts you can have you wondering what shifted.":
    "Both can be true for you in the same week: you feel a bad day longer, and you check they will stay.",
  "If someone close seems distant in the chat, you sometimes feel it right away and start to worry.":
    "In the same week, you feel a bad day longer, and you check they will stay.",
  "A friend is slow to text back, and you usually check your phone again before the bus stops.":
    "Your answers suggest you keep checking whether people will pull away.",
  "On the couch, your phone stays face up, and a slow reply can pull your eyes back to the screen.":
    "From your answers, you keep checking whether people will pull away.",
  "A read receipt at dinner can stay with you, and you open the chat again to see if anything new arrived.":
    "The pattern in your answers is that you keep checking whether people will pull away.",
  "A short text from your partner can send you a “you good?” before the night is over.":
    "The catch in your answers is a worry that outruns what was actually said.",
  "At the end of a quiet dinner, you sometimes ask if everything is okay before the check arrives.":
    "What this can cost you is a worry that outruns what was actually said.",
  "You sometimes open old messages when the week has felt shaky, looking for a sign things are still good.":
    "A cost worth naming for you is a worry that outruns what was actually said.",
  "A friend cancels dinner, and you can spend the walk home wondering if you did something wrong.":
    "Someone else might notice that you reread a warm message for a sign people will pull away.",
  "The dropped plan stays on your calendar, and you usually take it personally even when the reason was plain.":
    "From the outside, you reread a warm message for a sign people will pull away.",
  "A friend drops Saturday in the group chat, and you scroll back for something you might have said.":
    "Other people can see that you reread a warm message for a sign people will pull away.",
  "Your partner is quiet in the kitchen after work, and the first thought can be that it is about you.":
    "What you might miss is the part of the message that was actually warm.",
  "A close friend’s texts get shorter than yesterday, and you usually notice before anyone says why.":
    "Your answers leave room to miss the part of the message that was actually warm.",
  "After dinner on the couch, someone close is quieter, and you might replay what you said that morning.":
    "A thing you might skip is the part of the message that was actually warm.",
  "A quieter friendship can push you to offer another evening this week, just to keep it close.":
    "The helpful side for you shows up when a real risk of distance is worth a check.",
  "You sometimes send another text before a friend has answered the last one.":
    "Your answers also show a use when a real risk of distance is worth a check.",
  "After a few days of them not starting the chat, you sometimes reach out more than you did last month.":
    "There is a use for you when a real risk of distance is worth a check.",
  "A day with no text from your partner can feel long, and you usually want a goodnight message.":
    "Your answers suggest two things at once: you check they will stay, and you stay close.",
  "A quiet Sunday with someone close can leave you unsure, even after a week of daily check-ins.":
    "Both can be true for you in the same week: you check they will stay, and you stay close.",
  "Your week sits easier when a call is on the calendar, and a stretch with no plan can worry you.":
    "In the same week, you check they will stay, and you stay close.",
  "A friend is slow to reply, and you usually pocket your phone and finish the bus ride.":
    "Your answers suggest you let a gap in contact pass without dwelling on it.",
  "A few weeks can pass with no text, and you still trust the friendship is fine.":
    "From your answers, you let a gap in contact pass without dwelling on it.",
  "Silence from someone you know usually reads to you as a busy week, not a problem between you.":
    "The pattern in your answers is that you let a gap in contact pass without dwelling on it.",
  "Your partner heads out without you, and you usually take the couch for your own evening.":
    "The catch in your answers is a gap that actually mattered.",
  "Saturday with their friends usually feels fine to you, and you keep the plan you already had.":
    "What this can cost you is a gap that actually mattered.",
  "A few busy days from someone close usually don’t feel personal, and you wait until they’re free.":
    "A cost worth naming for you is a gap that actually mattered.",
  "A cold-sounding text usually reads to you as someone typing between tasks.":
    "Someone else might notice that you let a slow reply sit without treating it as distance.",
  "A one-word reply in the chat usually means busy to you, not a friend who is annoyed.":
    "From the outside, you let a slow reply sit without treating it as distance.",
  "A blunt email from a coworker can look like a full inbox, and you move on to the next one.":
    "Other people can see that you let a slow reply sit without treating it as distance.",
  "A good week with your partner can pass without you asking to hear that things are okay.":
    "What you might miss is a gap that was a real signal.",
  "Dinner can come and go while things are good, and you usually don’t turn it into a talk about the two of you.":
    "Your answers leave room to miss a gap that was a real signal.",
  "A friend’s care usually feels clear to you without a text that spells it out.":
    "A thing you might skip is a gap that was a real signal.",
  "A new person at a party can get your trust quickly, and you might talk about your week on the way home.":
    "The helpful side for you shows up when most gaps are just slow replies.",
  "Over a second coffee, you usually believe a new friend means what they say.":
    "Your answers also show a use when most gaps are just slow replies.",
  "A Saturday promise from a new friend usually sounds true to you, and you plan your weekend around it.":
    "There is a use for you when most gaps are just slow replies.",
  "A night out can leave you with new friends, and you usually don’t replay where you stand on the ride home.":
    "Your answers suggest two things at once: you let a gap pass, and you want people around.",
  "At a full table, you usually feel at ease and assume people are glad you came.":
    "Both can be true for you in the same week: you let a gap pass, and you want people around.",
  "A new group at dinner can feel easy, and you trust they’ll get comfortable with you once the food arrives.":
    "In the same week, you let a gap pass, and you want people around.",
  "After a very close weekend, you usually want a night at home with the door shut.":
    "Your answers suggest you keep some distance once things get close.",
  "You can love someone and still need the couch to yourself before the week starts again.":
    "From your answers, you keep some distance once things get close.",
  "A plan to spend every evening together can leave you feeling crowded in your own kitchen.":
    "The pattern in your answers is that you keep some distance once things get close.",
  "A friend asks how you’re really doing, and you usually say you’re fine and switch the topic.":
    "The catch in your answers is a distance that shuts a good thing out.",
  "Even with people you trust, a hard feeling can stay in your notes app instead of the chat.":
    "What this can cost you is a distance that shuts a good thing out.",
  "When something is hard, you usually deal with it on your own before you tell anyone at all.":
    "A cost worth naming for you is a distance that shuts a good thing out.",
  "A hard week at work usually has you figuring it out alone, even when a friend offered to help.":
    "Someone else might notice that you step back when closeness is on offer.",
  "You can have a problem sitting in your inbox and still not ask, because you’d rather solve it yourself.":
    "From the outside, you step back when closeness is on offer.",
  "When the task list gets too long, you usually push through alone instead of saying it’s too much.":
    "Other people can see that you step back when closeness is on offer.",
  "A partner brings up next year, and you can feel uneasy enough to change the subject at the table.":
    "What you might miss is a closeness you would have wanted.",
  "Future talk over dinner usually has you steering back to this weekend instead.":
    "Your answers leave room to miss a closeness you would have wanted.",
  "Someone asks where the relationship is going, and you usually want more time before you answer.":
    "A thing you might skip is a closeness you would have wanted.",
  "A long hug or a very sweet text can leave you a bit uncomfortable, even from someone you care about.":
    "The helpful side for you shows up when a little room can keep the bond workable.",
  "You usually show care by doing the thing, the ride, the errand, more than by saying it.":
    "Your answers also show a use when a little room can keep the bond workable.",
  "A friend says something very emotional, and you can sit there unsure what to text back.":
    "There is a use for you when a little room can keep the bond workable.",
  "Even in a relationship, you usually keep your own Saturday plan and your own way of doing the errand.":
    "Your answers suggest two things at once: you keep some distance, and you choose the way.",
  "Sharing a kitchen or a calendar, you usually still want to decide the small stuff yourself.":
    "Both can be true for you in the same week: you keep some distance, and you choose the way.",
  "You can be close with someone and still keep the routines that were yours before they moved in.":
    "In the same week, you keep some distance, and you choose the way.",
  "When you’re close to someone, you usually want to share the day and spend a lot of the evening together.":
    "Your answers suggest you stay close once things have started.",
  "A regular text from the people you love can be the part of the day you feel happiest about.":
    "From your answers, you stay close once things have started.",
  "Something happens on the bus, and you usually want to tell your partner or best friend right away.":
    "The pattern in your answers is that you stay close once things have started.",
  "Something bothering you usually goes straight into a text to someone close, the same hour.":
    "The catch in your answers is closeness with no room to breathe.",
  "With people you trust, you usually say the feeling out loud instead of sitting on it.":
    "What this can cost you is closeness with no room to breathe.",
  "A feeling shows up, and you can say it in the kitchen before you’ve had time to edit it.":
    "A cost worth naming for you is closeness with no room to breathe.",
  "A problem at home usually has you asking a friend or your family early, before you’ve tried it alone.":
    "Someone else might notice that you stay in once closeness has started.",
  "On a packed week, you can feel fine texting a trusted friend to take one task.":
    "From the outside, you stay in once closeness has started.",
  "Stuck on a task, you usually reach out instead of sitting with it by yourself all evening.":
    "Other people can see that you stay in once closeness has started.",
  "When you care about someone, you usually show it with a hug, a kind text, and a lot of contact.":
    "What you might miss is a little room you also needed.",
  "You can say how you feel about people out loud, at the table, not only in your head.":
    "Your answers leave room to miss a little room you also needed.",
  "A friend does something kind, and you usually tell them the same day how much it meant.":
    "A thing you might skip is a little room you also needed.",
  "In a relationship, you usually enjoy talking about next month’s plans together over dinner.":
    "The helpful side for you shows up when staying close is the point.",
  "You can like putting long-term dates on a shared calendar with the people you’re close to.":
    "Your answers also show a use when staying close is the point.",
  "When things are going well, you usually want to talk about what’s next, not only tonight.":
    "There is a use for you when staying close is the point.",
  "Your best days usually have people close by and a real conversation, not only a busy calendar.":
    "Your answers suggest two things at once: you stay close, and you need a real tie.",
  "With your friends or your partner in the room, you can feel more like yourself than you do alone.":
    "Both can be true for you in the same week: you stay close, and you need a real tie.",
  "A week without a real talk can leave you flat, even if the work chat was full.":
    "In the same week, you stay close, and you need a real tie.",
  "You disagree in a meeting, and you usually say so before the next slide is up.":
    "Your answers suggest you put a clear point on the table in a disagreement.",
  "A plan in the work chat looks like it won’t work, and you usually say that out loud.":
    "From your answers, you put a clear point on the table in a disagreement.",
  "Something in the shared doc looks wrong, and you can name it in the thread instead of waiting.":
    "The pattern in your answers is that you put a clear point on the table in a disagreement.",
  "You want something from a friend or partner, and you usually ask for it in a plain sentence.":
    "The catch in your answers is a point that takes over the talk.",
  "A friend hints about Friday, and you usually skip the hint and say the time you actually need.":
    "What this can cost you is a point that takes over the talk.",
  "A Friday plan doesn’t work for you, and you usually say so and offer a different time.":
    "A cost worth naming for you is a point that takes over the talk.",
  "Tension with someone can have you wanting to talk it out the same afternoon, not next week.":
    "Someone else might notice that you say the point when staying quiet would be easier.",
  "A tense text usually has you wanting it settled before bed, not left until morning.":
    "From the outside, you say the point when staying quiet would be easier.",
  "A disagreement starts, and you can push for an answer before the other person has sat with it.":
    "Other people can see that you say the point when staying quiet would be easier.",
  "Someone pushes back on your idea, and you usually argue the point harder in the next sentence.":
    "What you might miss is the other person's point.",
  "You can defend your view strongly once other people in the meeting disagree.":
    "Your answers leave room to miss the other person's point.",
  "A coworker challenges your plan, and you usually explain it again, firmer the second time.":
    "A thing you might skip is the other person's point.",
  "Someone gets treated unfairly in the room, and you usually speak up for them before they do.":
    "The helpful side for you shows up when the point needs to be in the talk.",
  "A friend or coworker gets talked over, and you can step in so their sentence gets finished.":
    "Your answers also show a use when the point needs to be in the talk.",
  "A decision looks unfair, and you usually say something even when it isn’t about your own task.":
    "There is a use for you when the point needs to be in the talk.",
  "In a disagreement you usually say what you think, then look for a fix that works for both of you.":
    "Your answers suggest two things at once: you say your point, and you widen the plan.",
  "You can say what you think at dinner and still want both people to leave feeling all right.":
    "Both can be true for you in the same week: you say your point, and you widen the plan.",
  "Friends argue, and you usually share your view, then help them find a plan you can both accept.":
    "In the same week, you say your point, and you widen the plan.",
  "A roommate leaves dishes in the sink, and you usually wash them instead of saying anything.":
    "Your answers suggest you step back in a disagreement even when the point is ready.",
  "Small things that bother you can stay unsaid, and you keep the kitchen quiet.":
    "From your answers, you step back in a disagreement even when the point is ready.",
  "A friend keeps showing up late to the movie, and you usually don’t mention the start time.":
    "The pattern in your answers is that you step back in a disagreement even when the point is ready.",
  "You disagree in a meeting, and you usually keep the point in your notes instead of the room.":
    "The catch in your answers is a point that never gets said.",
  "Your concern can wait until after the meeting, and sometimes it never makes it into a message.":
    "What this can cost you is a point that never gets said.",
  "Your boss suggests something you doubt, and you usually go along with it in the thread.":
    "A cost worth naming for you is a point that never gets said.",
  "You want something, and you usually hint at it instead of asking in a plain sentence.":
    "Someone else might notice that you step back even when the point is ready to say.",
  "You can hope people notice what you need, a ride, a quieter night, without you saying it.":
    "From the outside, you step back even when the point is ready to say.",
  "A plan doesn’t suit you, and you usually go along and hope the evening works out.":
    "Other people can see that you step back even when the point is ready to say.",
  "An argument starts, and you usually stay quiet and wait for the voices to come down.":
    "What you might miss is the point you meant to say.",
  "When people disagree, you can listen more than you talk and keep your view for later.":
    "Your answers leave room to miss the point you meant to say.",
  "Voices get raised in the kitchen, and you usually step back instead of joining in.":
    "A thing you might skip is the point you meant to say.",
  "After a disagreement, you usually apologize first, even when the mistake wasn’t yours.":
    "The helpful side for you shows up when a softer step can keep the talk alive.",
  "You can say sorry to end a tense moment, even if you weren’t the one who was wrong.":
    "Your answers also show a use when a softer step can keep the talk alive.",
  "Tension with a friend can have you apologizing just so the chat can go back to normal.":
    "There is a use for you when a softer step can keep the talk alive.",
  "In a disagreement you usually give in, so the other person leaves happy with the plan.":
    "Your answers suggest two things at once: you step back, and you widen the plan.",
  "A friend wants something different, and you can go with their choice for the night.":
    "Both can be true for you in the same week: you step back, and you widen the plan.",
  "You both want different things, and you usually put their wish ahead of yours.":
    "In the same week, you step back, and you widen the plan.",
  "A disagreement comes up, and you usually look for a fix that works for every person at the table.":
    "Your answers suggest you look for an option the other person can live with.",
  "People want different nights, and you can hunt for a time that gives each of them something.":
    "From your answers, you look for an option the other person can live with.",
  "Friends can’t agree on the plan, and you usually offer one that gives each person part of what they wanted.":
    "The pattern in your answers is that you look for an option the other person can live with.",
  "Planning with other people, you usually ask what works for everyone before you name a time.":
    "The catch in your answers is a plan that gives away too much.",
  "You can check with people before you decide something that lands on their calendar too.":
    "What this can cost you is a plan that gives away too much.",
  "A partner is upset, and you usually ask what they need before you say your side of it.":
    "A cost worth naming for you is a plan that gives away too much.",
  "A coworker asks to swap a shift, and you usually say yes to help them out.":
    "Someone else might notice that you widen the plan so the other person can live with it.",
  "You can move your own plans so the team’s schedule works, even when yours was already set.":
    "From the outside, you widen the plan so the other person can live with it.",
  "Your boss asks you to be flexible, and you usually make it work even when it costs your evening.":
    "Other people can see that you widen the plan so the other person can live with it.",
  "A group project goes well, and you usually hand the credit to the other names on it.":
    "What you might miss is the part you needed to keep.",
  "You can let someone else take the lead, or the praise, even when you did a lot of the file.":
    "Your answers leave room to miss the part you needed to keep.",
  "Praise shows up at work, and you usually point it toward the team instead of your own part.":
    "A thing you might skip is the part you needed to keep.",
  "Two friends argue, and you usually become the one who helps them make up.":
    "The helpful side for you shows up when a plan both people can use is worth finding.",
  "You can end up in the middle when two friends disagree, with texts coming from both of them.":
    "Your answers also show a use when a plan both people can use is worth finding.",
  "Family members clash, and you usually try to keep every person at the table comfortable.":
    "There is a use for you when a plan both people can use is worth finding.",
  "People want different things, and you usually give way so everyone else leaves happy.":
    "Your answers suggest two things at once: you widen the plan, and you go along.",
  "In the group chat, you can let the easy plan win over the place you actually wanted.":
    "Both can be true for you in the same week: you widen the plan, and you go along.",
  "A choice comes up, and you usually pick the option that upsets the fewest people.":
    "In the same week, you widen the plan, and you go along.",
  "You know what you need from a plan, and you usually stick to it even when others push in the chat.":
    "Your answers suggest you protect a chosen outcome in a disagreement.",
  "In a disagreement about the time, you can keep your slot instead of moving it to match theirs.":
    "From your answers, you protect a chosen outcome in a disagreement.",
  "A plan doesn’t work for you, and you usually say no instead of building a middle version.":
    "The pattern in your answers is that you protect a chosen outcome in a disagreement.",
  "In a negotiation you usually stay on the result you came in wanting, the number or the task.":
    "The catch in your answers is an outcome that leaves the other person out.",
  "You can know what you want from a deal and keep the talk on that, even if they want to wander.":
    "What this can cost you is an outcome that leaves the other person out.",
  "A coworker wants a different approach, and you usually stick with the one you already picked.":
    "A cost worth naming for you is an outcome that leaves the other person out.",
  "People ask you to change your plans, and you usually keep the evening the way you booked it.":
    "Someone else might notice that you hold the outcome even when a wider plan is available.",
  "You can protect your own time, even when someone else wants that hour.":
    "From the outside, you hold the outcome even when a wider plan is available.",
  "A friend asks for a last-minute favor, and you usually say no if it gets in the way of your plan.":
    "Other people can see that you hold the outcome even when a wider plan is available.",
  "Something looks unfair, and you usually keep your position even if the room gets awkward.":
    "What you might miss is a wider plan the other person could live with.",
  "You can stand by what you think is right, even when the group chat wants to drop it.":
    "Your answers leave room to miss a wider plan the other person could live with.",
  "Others want to leave an issue, and you usually keep pushing if it still matters to you.":
    "A thing you might skip is a wider plan the other person could live with.",
  "Making a decision, you usually trust your own judgment over the suggestions in the chat.":
    "The helpful side for you shows up when the outcome matters.",
  "You can decide what’s best for you without waiting for everyone to agree.":
    "Your answers also show a use when the outcome matters.",
  "Friends give you advice, and you usually listen, then do the thing you already planned.":
    "There is a use for you when the outcome matters.",
  "In a disagreement you usually say what you think and stay with it until the talk ends.":
    "Your answers suggest two things at once: you protect the outcome, and you say your point.",
  "You can argue your side clearly and not give in easily, even after a long back-and-forth.":
    "Both can be true for you in the same week: you protect the outcome, and you say your point.",
  "You disagree with someone, and you usually keep making the case until it’s settled.":
    "In the same week, you protect the outcome, and you say your point.",
  "Your boss hands you a task, and you usually want to do it your way rather than from their steps.":
    "Your answers suggest you want to do a task in a way you chose.",
  "A set process in the work doc can feel too fixed, and you prefer to choose how the work gets done.":
    "From your answers, you want to do a task in a way you chose.",
  "Someone walks you through every click, and you can push back a little before you’ve even started.":
    "The pattern in your answers is that you want to do a task in a way you chose.",
  "A boss who checks the doc too often can leave you annoyed, and the task gets harder to care about.":
    "The catch in your answers is a way that ignores a good set path.",
  "You usually do your best work once people leave the task with you and stop checking the chat.":
    "What this can cost you is a way that ignores a good set path.",
  "A coworker’s third check-in of the morning can feel like they don’t trust you with the file.":
    "A cost worth naming for you is a way that ignores a good set path.",
  "You usually decide the plan first and tell people after, once it’s already on your calendar.":
    "Someone else might notice that you pick your own way even when a set path is available.",
  "A choice can get made at your kitchen table, with very little input from anyone else.":
    "From the outside, you pick your own way even when a set path is available.",
  "Faced with a decision, you usually work it out alone before you bring it to the group chat.":
    "Other people can see that you pick your own way even when a set path is available.",
  "A rule that doesn’t make sense can have you questioning it, or finding a way around the form.":
    "What you might miss is a set path that would have worked.",
  "You usually want the reason for a rule before you follow it on the next task.":
    "Your answers leave room to miss a set path that would have worked.",
  "A “we’ve always done it this way” at work can make you want to change the step.":
    "A thing you might skip is a set path that would have worked.",
  "A project that started as your idea usually gets your best hours, late and early.":
    "The helpful side for you shows up when a self-chosen way can fit better.",
  "A task you chose can matter more to you than the one that landed in your inbox assigned.":
    "Your answers also show a use when a self-chosen way can fit better.",
  "Once you set the goal yourself, you can work much harder than you do on a handed-down list.":
    "There is a use for you when a self-chosen way can fit better.",
  "A free evening usually goes to your own project, and you don’t need company to feel fine about it.":
    "Your answers suggest two things at once: you choose the way, and you can skip the tie.",
  "Given an open Saturday, you usually spend it on your own work rather than a group plan.":
    "Both can be true for you in the same week: you choose the way, and you can skip the tie.",
  "You can do your best work alone and feel okay without a check-in from the group chat.":
    "In the same week, you choose the way, and you can skip the tie.",
  "A new task can feel better once someone explains what “done” looks like before you start.":
    "Your answers suggest you follow a path that is already set.",
  "You usually work best when your boss gives you the steps, not only the goal in the chat.":
    "From your answers, you follow a path that is already set.",
  "A vague assignment can have you waiting for more direction before you open the file.":
    "The pattern in your answers is that you follow a path that is already set.",
  "Friends make the plan, and you usually go along happily with whatever they put in the chat.":
    "The catch in your answers is a path that was never questioned.",
  "You can like it when someone else picks the restaurant and the time.":
    "What this can cost you is a path that was never questioned.",
  "A group that needs a decision usually gets your silence while someone else leads.":
    "A cost worth naming for you is a path that was never questioned.",
  "A decision on your plate usually starts with you asking a few people what they’d do.":
    "Someone else might notice that you take the set path even when your own way is available.",
  "You can like hearing advice in the group chat before you pick.":
    "From the outside, you take the set path even when your own way is available.",
  "Unsure about a choice, you usually check with a friend or your family before you decide.":
    "Other people can see that you take the set path even when your own way is available.",
  "A job with a clear role and a steady routine can leave you settled, and the work goes well.":
    "What you might miss is a way you would have chosen.",
  "A project with a named lead usually feels better to you, because you know your part of the file.":
    "Your answers leave room to miss a way you would have chosen.",
  "A team with named roles on the doc usually feels more comfortable to you than a loose one.":
    "A thing you might skip is a way you would have chosen.",
  "Someone who knows the topic better usually gets your follow, and you let them lead the call.":
    "The helpful side for you shows up when a set path can be the right one.",
  "You can trust a more experienced coworker to decide when you’re both looking at the same problem.":
    "Your answers also show a use when a set path can be the right one.",
  "An expert in the meeting can have you keeping your own idea in the notes, unsaid.":
    "There is a use for you when a set path can be the right one.",
  "Plans and decisions usually feel best when you make them with the people close to you, not alone.":
    "Your answers suggest two things at once: you take the set path, and you need a real tie.",
  "A choice on the calendar can have you wanting your partner or friends in the text before you lock it.":
    "Both can be true for you in the same week: you take the set path, and you need a real tie.",
  "Picking a place for dinner can feel better with your partner in the text than choosing alone.":
    "In the same week, you take the set path, and you need a real tie.",
  "A hard task shows up in the work chat, and you usually volunteer before the thread moves on.":
    "Your answers suggest you trust that a hard task can be handled.",
  "A tough item on the agenda can feel doable to you, even when others in the meeting would skip it.":
    "From your answers, you trust that a hard task can be handled.",
  "Something difficult needs an owner, and you usually say you’ve got it before anyone else does.":
    "The pattern in your answers is that you trust that a hard task can be handled.",
  "Stuck on a problem, you usually keep going alone because you’re sure you’ll figure the file out.":
    "The catch in your answers is a trust that skips a needed check.",
  "A stuck line in the doc can feel solvable to you, so you stay with it instead of asking for help.":
    "What this can cost you is a trust that skips a needed check.",
  "A task gets hard, and you usually push on alone rather than ask the coworker next to you.":
    "A cost worth naming for you is a trust that skips a needed check.",
  "Someone slow on a task can have you wanting to take the keyboard and finish it yourself.":
    "Someone else might notice that you trust a hard task even when doubt is available.",
  "You usually find it faster to do the thing than to explain the steps in the chat.":
    "From the outside, you trust a hard task even when doubt is available.",
  "A teammate struggles with the file, and you can step in and finish the last part for them.":
    "Other people can see that you trust a hard task even when doubt is available.",
  "You finish a piece of work and usually feel sure it’s good, so you send it the same hour.":
    "What you might miss is a check the trust skipped.",
  "Showing your work to other people can feel comfortable, even before a second read.":
    "Your answers leave room to miss a check the trust skipped.",
  "Your boss asks for an update, and you usually feel ready to share what’s on the page.":
    "A thing you might skip is a check the trust skipped.",
  "You try something new and usually expect to pick it up before the week is out.":
    "The helpful side for you shows up when trust lets the hard task move.",
  "A new skill can feel learnable to you over a few evenings, and you start before you feel sure of it.":
    "Your answers also show a use when trust lets the hard task move.",
  "A new hobby usually gets you started fast, without much worry about looking clumsy at first.":
    "There is a use for you when trust lets the hard task move.",
  "A big goal comes up, and you usually believe you can reach it, so you start the same day.":
    "Your answers suggest two things at once: you trust the hard task, and you expect to finish.",
  "A hard goal can feel possible to you, so you write a high one on the list.":
    "Both can be true for you in the same week: you trust the hard task, and you expect to finish.",
  "Someone doubts the plan in the chat, and you can feel even more sure you’ll do it anyway.":
    "In the same week, you trust the hard task, and you expect to finish.",
  "A new task at work can have you wondering, before you open the file, if you can do it well.":
    "Your answers suggest you doubt that a hard task can be pulled off.",
  "You usually doubt yourself in the minutes before you start something you haven’t done.":
    "From your answers, you doubt that a hard task can be pulled off.",
  "Your boss gives you something important, and you can worry you’re not ready for that meeting.":
    "The pattern in your answers is that you doubt that a hard task can be pulled off.",
  "Before a presentation, you usually prepare more slides and more notes than the meeting needs.":
    "The catch in your answers is a doubt that stops the start.",
  "You can practice a lot in an empty room before you do the same thing in front of people.":
    "What this can cost you is a doubt that stops the start.",
  "Something important on the calendar can have you preparing past the point where you already know it.":
    "A cost worth naming for you is a doubt that stops the start.",
  "Someone asks for volunteers, and you usually wait for a more experienced person to take it.":
    "Someone else might notice that you doubt a hard task even when a small start is available.",
  "You can let others take the new project because you’re unsure you’d do the first version well.":
    "From the outside, you doubt a hard task even when a small start is available.",
  "An opening at work can have you thinking someone else on the team is the better fit.":
    "Other people can see that you doubt a hard task even when a small start is available.",
  "Someone praises your work, and you usually point at the part that went wrong instead.":
    "What you might miss is the small start that was available.",
  "A compliment about your skills can be hard to take, and you change the subject in the chat.":
    "Your answers leave room to miss the small start that was available.",
  "Your boss says you did well, and you can decide they’re just being nice in the meeting.":
    "A thing you might skip is the small start that was available.",
  "A coworker does well in the meeting, and you usually compare notes with yourself and feel behind.":
    "The helpful side for you shows up when an honest doubt can be useful.",
  "You can notice what other people do better than you, faster than you notice your own file.":
    "Your answers also show a use when an honest doubt can be useful.",
  "Friends’ updates can have you forgetting how far your own year has actually moved.":
    "There is a use for you when an honest doubt can be useful.",
  "Unsure of a skill, you usually keep practicing the same move until it feels ready.":
    "Your answers suggest two things at once: you doubt the hard task, and you look for the change.",
  "You can doubt yourself at the start and still stay with the work until it gets better.":
    "Both can be true for you in the same week: you doubt the hard task, and you look for the change.",
  "Something hard usually becomes a thing for you to learn, not a reason to close the laptop.":
    "In the same week, you doubt the hard task, and you look for the change.",
  "After a busy week, you usually miss a real conversation with someone close more than you miss the sleep.":
    "Your answers suggest you need a real connection for the day to feel right.",
  "A few days without a deep talk can leave you a bit off, even if the calendar was full.":
    "From your answers, you need a real connection for the day to feel right.",
  "You sometimes need a real call with a friend before the week feels okay again.":
    "The pattern in your answers is that you need a real connection for the day to feel right.",
  "At work, you usually care a lot about whether you are getting along with the people around you.":
    "The catch in your answers is a day that depends on other people too much.",
  "Your day can feel better when you like the coworkers in the room, and worse when you do not.":
    "What this can cost you is a day that depends on other people too much.",
  "Tension on the team sometimes stays with you longer than it stays with everyone else.":
    "A cost worth naming for you is a day that depends on other people too much.",
  "A few days alone can start to feel lonely to you, even if the first night was a relief.":
    "Someone else might notice that you want a real connection before the day feels right.",
  "You usually feel low if too long passes without seeing a friend.":
    "From the outside, you want a real connection before the day feels right.",
  "When a plan falls through, the empty evening sometimes hits you harder than it hits other people.":
    "Other people can see that you want a real connection before the day feels right.",
  "When a friend seems down, you usually notice in the chat and reach out the same day.":
    "What you might miss is a day that could have stood on its own.",
  "You can keep a running sense of how your close friends and family are doing.":
    "Your answers leave room to miss a day that could have stood on its own.",
  "A hard day for someone you love sometimes gets time from you before your own list does.":
    "A thing you might skip is a day that could have stood on its own.",
  "When a group of friends makes plans without you, you usually feel left out.":
    "The helpful side for you shows up when a real tie can make the day land.",
  "Photos of friends out without you can bother you for the rest of the night.":
    "Your answers also show a use when a real tie can make the day land.",
  "Being included in the group plan sometimes matters to you more than the plan itself.":
    "There is a use for you when a real tie can make the day land.",
  "You usually get close to people through jokes, a game, or a fun plan on the calendar.":
    "Your answers suggest two things at once: you need a real tie, and you turn it into play.",
  "With friends, you can want the night to be one where you laugh together.":
    "Both can be true for you in the same week: you need a real tie, and you turn it into play.",
  "You sometimes feel closest to someone after a fun night, more than after a quiet coffee.":
    "In the same week, you need a real tie, and you turn it into play.",
  "A free day usually feels good to you spent on your own, with no plan on the calendar.":
    "Your answers suggest you can let a day land without much connection.",
  "You can feel fine going a while without seeing friends.":
    "From your answers, you can let a day land without much connection.",
  "A cancelled plan sometimes brings relief, because the evening is yours again.":
    "The pattern in your answers is that you can let a day land without much connection.",
  "At work, you usually prefer your own tasks to a team lunch or a group activity.":
    "The catch in your answers is a day that gets too cut off.",
  "You can do your best work with the chat muted and nobody stopping by.":
    "What this can cost you is a day that gets too cut off.",
  "A team event sometimes gets a short visit from you, and then you head back to the work.":
    "A cost worth naming for you is a day that gets too cut off.",
  "When you think of a friend, you usually do not text them unless you have a reason.":
    "Someone else might notice that you let a day land even when a plan with people is open.",
  "A passing thought of someone can stay in your head instead of becoming a message.":
    "From the outside, you let a day land even when a plan with people is open.",
  "You sometimes keep it to yourself when you miss a person, and the chat stays quiet.":
    "Other people can see that you let a day land even when a plan with people is open.",
  "When small talk starts, you usually keep it short and get back to your day.":
    "What you might miss is a connection you would have wanted.",
  "You can feel fine about your coworkers without much chat in the kitchen.":
    "Your answers leave room to miss a connection you would have wanted.",
  "A neighbor who stops to talk sometimes gets a brief reply from you, and then you move on.":
    "A thing you might skip is a connection you would have wanted.",
  "When something hard happens, you usually work through it alone before you tell anyone.":
    "The helpful side for you shows up when a day can land on its own.",
  "A tough week can stay off the group chat until you have already handled it yourself.":
    "Your answers also show a use when a day can land on its own.",
  "You sometimes do not mention what you are going through, even to a close friend.":
    "There is a use for you when a day can land on its own.",
  "A quiet weekend at home can suit you, with no strong pull to be social.":
    "Your answers suggest two things at once: you can skip the tie, and you recharge with time to yourself.",
  "When the weekend comes, you usually want the couch and your own thing, not a group plan.":
    "Both can be true for you in the same week: you can skip the tie, and you recharge with time to yourself.",
  "You sometimes keep a small circle and see them only now and then.":
    "In the same week, you can skip the tie, and you recharge with time to yourself.",
  "After you send the wrong file, you usually open a note and write what you would do on the next one.":
    "Your answers suggest you look for what to change after a miss.",
  "A burned pan can have you reading the recipe again before it is even in the sink.":
    "From your answers, you look for what to change after a miss.",
  "The missed bus sometimes has you checking a better route before the annoyance fades.":
    "The pattern in your answers is that you look for what to change after a miss.",
  "When a project is done, you usually ask what you could have done better before you enjoy it.":
    "The catch in your answers is a change that never settles.",
  "Notes from your boss can be welcome to you, even when they are hard to read.":
    "What this can cost you is a change that never settles.",
  "A comment on your doc sometimes reads to you as useful, not as a hit on you.":
    "A cost worth naming for you is a change that never settles.",
  "A hard task can look more appealing to you than the easy one sitting next to it.":
    "Someone else might notice that you look for a change even when the miss could stay closed.",
  "You usually keep going on something new even when the steps have you frustrated.":
    "From the outside, you look for a change even when the miss could stay closed.",
  "When the choice is easy or hard, you sometimes pick the hard one because it stretches you.":
    "Other people can see that you look for a change even when the miss could stay closed.",
  "When a friend says they are bad at cooking, you usually tell them they can learn the dish.":
    "What you might miss is a rest the next try did not allow.",
  "You can be the person in the chat who tells someone to try the thing one more time.":
    "Your answers leave room to miss a rest the next try did not allow.",
  "If a friend is ready to drop a class, you sometimes nudge them toward one more week.":
    "A thing you might skip is a rest the next try did not allow.",
  "A look at your week can turn into a list of things you want to get better at.":
    "The helpful side for you shows up when a next try can be the right move.",
  "You usually have a course tab and a skill video open beside the work you already do.":
    "Your answers also show a use when a next try can be the right move.",
  "Free time on the couch sometimes goes to learning something instead of the show you meant to watch.":
    "There is a use for you when a next try can be the right move.",
  "When a plan fails, you usually look at your part and write what you would change next time.":
    "Your answers suggest two things at once: you look for the change, and you look at your part.",
  "A setback can have you making a new plan before you have sat with the fact that it failed.":
    "Both can be true for you in the same week: you look for the change, and you look at your part.",
  "You sometimes ask what you can change on the next try, and the question comes fast.":
    "In the same week, you look for the change, and you look at your part.",
  "Choosing what to do, you usually pick the task you already know you can do well.":
    "Your answers suggest you can treat a miss as the end of that path.",
  "A new skill that feels hard on the first try can get set aside by you as not for you.":
    "From your answers, you can treat a miss as the end of that path.",
  "You sometimes stay with the job you already do well and leave the unfamiliar one on the list.":
    "The pattern in your answers is that you can treat a miss as the end of that path.",
  "The recipe fails, and you order dinner instead of starting the whole thing over.":
    "The catch in your answers is an ending that closes a path too soon.",
  "A push to change your morning routine can get an easy “it is fine” from you.":
    "What this can cost you is an ending that closes a path too soon.",
  "You can feel at ease with how the week runs, even when someone else would tweak it.":
    "A cost worth naming for you is an ending that closes a path too soon.",
  "A critical note on your work can land as a judgment of you, not of the paragraph.":
    "Someone else might notice that you treat a miss as final even when another try is available.",
  "You usually hear criticism as a sign you are not good at the thing itself.":
    "From the outside, you treat a miss as final even when another try is available.",
  "After your work is critiqued, you can feel discouraged for the rest of the afternoon.":
    "Other people can see that you treat a miss as final even when another try is available.",
  "When things are going fine, you usually see no reason to change the routine that works.":
    "What you might miss is a try that was still open.",
  "You can feel happy with the skills you already have and the way your week already runs.":
    "Your answers leave room to miss a try that was still open.",
  "Talk of a new course sometimes sounds to you like something for other people.":
    "A thing you might skip is a try that was still open.",
  "When something new does not work the first time, you usually stop and move on.":
    "The helpful side for you shows up when some misses really are the end of a path.",
  "A new hobby that feels awkward can get dropped by you before the second try.":
    "Your answers also show a use when some misses really are the end of a path.",
  "You sometimes read a rough start as proof the thing is not for you.":
    "There is a use for you when some misses really are the end of a path.",
  "You usually stick with hobbies you already know: the same show, the same walk, the same kitchen.":
    "Your answers suggest two things at once: you close the path, and you keep a known favorite.",
  "When friends try a new hobby, you can prefer to stay with the one you already like.":
    "Both can be true for you in the same week: you close the path, and you keep a known favorite.",
  "Your happiest evenings sometimes look like the things you have done for years.":
    "In the same week, you close the path, and you keep a known favorite.",
  "When something goes wrong, you usually ask what you could have done differently before anything else.":
    "Your answers suggest you look at the part of a problem you could steer.",
  "A failed plan can have you looking at your own part first, even when the delay was someone else’s.":
    "From your answers, you look at the part of a problem you could steer.",
  "If a project goes badly, you sometimes take the whole thing on yourself when you talk it over.":
    "The pattern in your answers is that you look at the part of a problem you could steer.",
  "When you want something, you usually make a plan and start working it the same day.":
    "The catch in your answers is a blame that lands only on you.",
  "You can treat your own effort as the thing that decides how a project turns out.":
    "What this can cost you is a blame that lands only on you.",
  "A problem at work sometimes becomes a list of what you personally can do about it.":
    "A cost worth naming for you is a blame that lands only on you.",
  "When a team project struggles, you usually feel it is on you to fix it.":
    "Someone else might notice that you look for the part you could steer instead of blaming the day.",
  "A messy week at work can have you stepping in to save the shared doc.":
    "From the outside, you look for the part you could steer instead of blaming the day.",
  "You sometimes carry how the group turns out, even the parts that were never your task.":
    "Other people can see that you look for the part you could steer instead of blaming the day.",
  "When something goes wrong, you usually skip blame and look at your own choices.":
    "What you might miss is the part that was actually outside your hands.",
  "A bad outcome can have you asking what you can do, not whose fault the email was.":
    "Your answers leave room to miss the part that was actually outside your hands.",
  "You sometimes leave other people’s part out of the story when you look back.":
    "A thing you might skip is the part that was actually outside your hands.",
  "A goal on your list usually stays on you, and you hold yourself to it harder than you would a friend.":
    "The helpful side for you shows up when a steerable part is worth finding.",
  "When you are unhappy with something, you can try to change it yourself before you tell anyone.":
    "Your answers also show a use when a steerable part is worth finding.",
  "You sometimes talk to yourself after a miss in a way you would never text a friend.":
    "There is a use for you when a steerable part is worth finding.",
  "You write the Saturday plan down, and if it falls apart you treat that as yours to fix.":
    "Your answers suggest two things at once: you look at your part, and you finish the plan.",
  "You can write the plan, do the steps, and still feel the outcome sits on you.":
    "Both can be true for you in the same week: you look at your part, and you finish the plan.",
  "When you set out to do something, you sometimes map it and then own how it turns out.":
    "In the same week, you look at your part, and you finish the plan.",
  "When something goes wrong, you usually accept it and move on to the next thing.":
    "Your answers suggest you figure a bad outcome was bound to happen.",
  "A fallen plan can get a shrug from you, and then you adjust the rest of the day.":
    "From your answers, you figure a bad outcome was bound to happen.",
  "You sometimes feel a problem just happened, and pushing on it would not change the outcome.":
    "The pattern in your answers is that you figure a bad outcome was bound to happen.",
  "When something goes well, you usually say you got lucky.":
    "The catch in your answers is a cause that ignores a real lever.",
  "Praise for a project can get “the timing was right” from you instead of what you did.":
    "What this can cost you is a cause that ignores a real lever.",
  "A win sometimes gets credited by you to the team or the timing, and your part stays quiet.":
    "A cost worth naming for you is a cause that ignores a real lever.",
  "When you want something to change, you usually wait to see if it happens on its own.":
    "Someone else might notice that you treat the outcome as bound to happen even when a lever is visible.",
  "A problem in the work chat can get time from you before you step in.":
    "From the outside, you treat the outcome as bound to happen even when a lever is visible.",
  "You sometimes give a mess a few days to sort itself before you touch it.":
    "Other people can see that you treat the outcome as bound to happen even when a lever is visible.",
  "When a decision is out of your hands, you usually accept it without much stress.":
    "What you might miss is a lever you could have used.",
  "You can stay calm when your boss or a friend makes the big call.":
    "Your answers leave room to miss a lever you could have used.",
  "A changed plan from your boss sometimes gets a simple ok from you, with no pushback.":
    "A thing you might skip is a lever you could have used.",
  "When things go wrong, you usually do not take the miss personally.":
    "The helpful side for you shows up when some outcomes really are outside the choice.",
  "You can leave the blame off yourself when the cause sat outside your control.":
    "Your answers also show a use when some outcomes really are outside the choice.",
  "A failed plan sometimes reads to you as not all on you, and you stay steady about it.":
    "There is a use for you when some outcomes really are outside the choice.",
  "When things go wrong, you usually stay calm and accept them instead of fighting the outcome.":
    "Your answers suggest two things at once: you blame the day, and you shake a bad day off.",
  "A setback can land with you as part of the day, and you move to something else.":
    "Both can be true for you in the same week: you blame the day, and you shake a bad day off.",
  "When a plan falls through, you sometimes stay relaxed and find another thing to do.":
    "In the same week, you blame the day, and you shake a bad day off.",
  "When someone asks if you can handle a task, you usually say yes before you have heard the details.":
    "Your answers suggest you expect to finish a big task once it is started.",
  "A new problem can land and you already trust you will find a way through it.":
    "From your answers, you expect to finish a big task once it is started.",
  "You sometimes take the extra work in the chat because you believe you can figure it out.":
    "The pattern in your answers is that you expect to finish a big task once it is started.",
  "A goal you set for the year can be bigger than the one a friend would have picked for you.":
    "The catch in your answers is a start that ignores the size.",
  "You usually aim high, at a number or a title other people would call too much.":
    "What this can cost you is a start that ignores the size.",
  "Planning the year, you sometimes pick a target that stretches past what you have done before.":
    "A cost worth naming for you is a start that ignores the size.",
  "When something unexpected happens, you usually feel ready to deal with it on the spot.":
    "Someone else might notice that you start a big task and expect to finish it.",
  "A plan that changes at the last minute can leave you still confident in the work chat.":
    "From the outside, you start a big task and expect to finish it.",
  "You sometimes jump in and start solving a problem before the room has finished describing it.":
    "Other people can see that you start a big task and expect to finish it.",
  "When someone gives you advice, you usually feel you already know what to do.":
    "What you might miss is the size of the task.",
  "A tip from a coworker can lose to your own way of doing the task.":
    "Your answers leave room to miss the size of the task.",
  "Starting something new, you sometimes skip the instructions and figure the thing out yourself.":
    "A thing you might skip is the size of the task.",
  "When a friend doubts themselves, you usually tell them they can do the thing.":
    "The helpful side for you shows up when expecting to finish can get the task going.",
  "A nervous text from a friend can get encouragement from you before you offer help with the actual task.":
    "Your answers also show a use when expecting to finish can get the task going.",
  "You sometimes cheer a person on through a challenge and assume that is the support they need.":
    "There is a use for you when expecting to finish can get the task going.",
  "When something new comes up, you usually say yes and trust you will figure it out.":
    "Your answers suggest two things at once: you expect to finish, and you try new things.",
  "A chance you have never tried can get a yes from you before you have a plan.":
    "Both can be true for you in the same week: you expect to finish, and you try new things.",
  "You sometimes jump into a new thing without much worry about how it will go.":
    "In the same week, you expect to finish, and you try new things.",
  "When something big comes up, you usually wonder if you can handle it.":
    "Your answers suggest you pause before trusting a big task can be finished.",
  "A challenge on the calendar can bring doubt before you have even opened the file.":
    "From your answers, you pause before trusting a big task can be finished.",
  "If someone asks you to take on more, you sometimes feel unsure you can do it.":
    "The pattern in your answers is that you pause before trusting a big task can be finished.",
  "When you need to start something hard, you usually put it off.":
    "The catch in your answers is a pause that never becomes a start.",
  "You can wait until you feel ready, and the ready feeling can take a long time to show up.":
    "What this can cost you is a pause that never becomes a start.",
  "A big task on the list sometimes gets delayed while you wait for a better moment to begin.":
    "A cost worth naming for you is a pause that never becomes a start.",
  "When you finish something, you usually check with someone before you feel sure it is good.":
    "Someone else might notice that you pause on a big task even when a small version is available.",
  "A decision can sit until you have asked a friend if it is the right one.":
    "From the outside, you pause on a big task even when a small version is available.",
  "You sometimes want a second look at your work before you trust it enough to send.":
    "Other people can see that you pause on a big task even when a small version is available.",
  "When an opportunity looks hard, you usually let it pass.":
    "What you might miss is the small version that was available.",
  "A safer option on the list can win over the challenge, even when the challenge interests you.":
    "Your answers leave room to miss the small version that was available.",
  "A chance to try something new at work sometimes gets a no from you before you have looked closely.":
    "A thing you might skip is the small version that was available.",
  "When something goes wrong, you usually read it as proof you cannot do the thing.":
    "The helpful side for you shows up when a pause can be a careful read.",
  "Your mistakes can stay louder in your head than the wins from the same week.":
    "Your answers also show a use when a pause can be a careful read.",
  "After a struggle, you sometimes tell yourself you are not up to the task.":
    "There is a use for you when a pause can be a careful read.",
  "Facing something new, you usually doubt both your skills and your chances.":
    "Your answers suggest two things at once: you pause on the big task, and you doubt the hard task.",
  "You can feel unsure you can do a hard thing, even when you have done a similar one before.":
    "Both can be true for you in the same week: you pause on the big task, and you doubt the hard task.",
  "When the work gets challenging, you sometimes worry you are not up to it.":
    "In the same week, you pause on the big task, and you doubt the hard task.",
  "When a meeting gets tense, you usually reach for a joke before the silence has settled.":
    "Your answers suggest you turn an ordinary task into play.",
  "An awkward pause at dinner can get a light line from you before anyone names the tension.":
    "From your answers, you turn an ordinary task into play.",
  "You sometimes look for something funny to say once the work chat turns sharp.":
    "The pattern in your answers is that you turn an ordinary task into play.",
  "A boring task can sit until you turn it into a game or put music on.":
    "The catch in your answers is play that makes the task late.",
  "You usually put on a playlist or make a tiny game so the dull work is easier to start.":
    "What this can cost you is play that makes the task late.",
  "When the spreadsheet is dull, you sometimes wait until you have a fun way in.":
    "A cost worth naming for you is play that makes the task late.",
  "With your partner or a close friend, you usually tease and joke more than you say the plain thing.":
    "Someone else might notice that you make an ordinary task playful even when the straight version is faster.",
  "Affection from you can show up as a joke in the chat before it shows up as a straight compliment.":
    "From the outside, you make an ordinary task playful even when the straight version is faster.",
  "Once you are close to someone, you sometimes keep the tone light even on a heavy day.":
    "Other people can see that you make an ordinary task playful even when the straight version is faster.",
  "Free time on your calendar usually turns into a search for something fun to do.":
    "What you might miss is the straight version that would have been faster.",
  "When friends say they are bored, you can be the one who puts a plan in the chat.":
    "Your answers leave room to miss the straight version that would have been faster.",
  "A weekend sometimes looks better to you as a fun plan than as a night on the couch.":
    "A thing you might skip is the straight version that would have been faster.",
  "When you make a mistake, you usually laugh at yourself and move on to the next thing.":
    "The helpful side for you shows up when play can make the task worth doing.",
  "An embarrassing moment in the group chat can become a joke from you before it becomes a worry.":
    "Your answers also show a use when play can make the task worth doing.",
  "You sometimes do not sit with a typo you sent; the joke arrives and you move on.":
    "There is a use for you when play can make the task worth doing.",
  "When things go wrong, you usually stay calm and find something in it to laugh about.":
    "Your answers suggest two things at once: you turn it into play, and you shake a bad day off.",
  "A stressful thread in the work chat can get a steady joke from you while other people panic.":
    "Both can be true for you in the same week: you turn it into play, and you shake a bad day off.",
  "You sometimes stay relaxed and lighten the mood once the people around you speed up.":
    "In the same week, you turn it into play, and you shake a bad day off.",
  "When there is work on the list, you usually want it done before anyone starts the fun.":
    "Your answers suggest you take a situation straight instead of turning it into play.",
  "A silly stretch in a meeting can have you wanting the group back on the agenda.":
    "From your answers, you take a situation straight instead of turning it into play.",
  "You sometimes prefer to finish the task in front of you rather than join the joke in the chat.":
    "The pattern in your answers is that you take a situation straight instead of turning it into play.",
  "When friends are joking, you usually steer the talk toward something real.":
    "The catch in your answers is a straight read that misses a useful joke.",
  "A long banter thread can interest you less than one serious conversation.":
    "What this can cost you is a straight read that misses a useful joke.",
  "In a chat, you sometimes want to get to the point before the jokes have finished.":
    "A cost worth naming for you is a straight read that misses a useful joke.",
  "Free time on your calendar usually goes to something useful, not to play.":
    "Someone else might notice that you take the straight version even when a playful one is available.",
  "You can feel better crossing a task off than spending the hour on something silly.":
    "From the outside, you take the straight version even when a playful one is available.",
  "When someone suggests a silly plan, you sometimes say you have things to do.":
    "Other people can see that you take the straight version even when a playful one is available.",
  "When something goes wrong, you usually take it seriously instead of joking about it.":
    "What you might miss is a joke that would have helped.",
  "A problem in the chat can get a direct reply from you, with the jokes left out.":
    "Your answers leave room to miss a joke that would have helped.",
  "If your partner jokes about a problem, you sometimes want to talk about it properly first.":
    "A thing you might skip is a joke that would have helped.",
  "When you are focused, people can think you are upset or unfriendly.":
    "The helpful side for you shows up when a straight read can be the right one.",
  "Your face usually looks serious while you concentrate, and others might misread it.":
    "Your answers also show a use when a straight read can be the right one.",
  "When coworkers are joking, you sometimes stay quiet, and some of them read that as disapproval.":
    "There is a use for you when a straight read can be the right one.",
  "With a goal in front of you, you usually stay on it and leave the fun for later.":
    "Your answers suggest two things at once: you take it straight, and you finish the plan.",
  "You can finish the work on the list before you let yourself relax on the couch.":
    "Both can be true for you in the same week: you take it straight, and you finish the plan.",
  "Fun sometimes waits, in your week, until the work is done and the list is clear.":
    "In the same week, you take it straight, and you finish the plan.",
  "Your lock screen sometimes takes the first minute of the morning, while the kettle is still cold.":
    "Your lock screen might take the first minute of the morning.",
  "Your easy messages usually get answered first, and the harder ones can pile in the thread.":
    "Your easy messages can get answered first, and the harder ones can pile in the thread.",
  "You sometimes clear the short texts and leave the one that needs a real answer.":
    "You might clear the short texts and leave the one that needs a real answer.",
  "You sometimes look for something to put in a break, even a short one on the bus.":
    "You might look for something to put in a break, even a short one on the bus.",
  "A coworker’s ask sometimes gets a yes before you have looked at your own calendar.":
    "A coworker’s ask might get a yes before you have looked at your own calendar.",
  "A kind thing from a friend sometimes gets noticed by you and never mentioned.":
    "A kind thing from a friend might get noticed by you and never mentioned.",
  "Once the house is quiet, you sometimes want another hour, even with an early alarm set.":
    "Once the house is quiet, you might want another hour, even with an early alarm set.",
  "Friends’ photos sometimes have you thinking about what your own week is missing.":
    "Friends’ photos might have you thinking about what your own week is missing.",
  "Your long to-do list sometimes gets the easy boxes first, and the hard one waits.":
    "Your long to-do list might get the easy boxes first, and the hard one waits.",
  "When work gets intense, lunch sometimes happens at your desk, or not at all.":
    "When work gets intense, lunch might happen at your desk, or not at all.",
  "Someone else’s story sometimes pulls a similar story of yours into your head before they finish.":
    "Someone else’s story might pull a similar story of yours into your head before they finish.",
  "A free moment of yours sometimes goes to a screen inside, not to a walk outside.":
    "A free moment of yours might go to a screen inside, not to a walk outside.",
  "You sometimes keep at a problem alone, past the point where a question would be faster.":
    "You might keep at a problem alone, past the point where a question would be faster.",
  "A big task done sometimes gets followed, right away, by you opening the next one.":
    "A big task done might be followed, right away, by you opening the next one.",
  "When you think of someone you miss, you sometimes plan to reach out later and do not.":
    "When you think of someone you miss, you might plan to reach out later and do not.",
  "A notification sometimes pulls you off the task before the sentence is finished.":
    "A notification might pull you off the task before the sentence is finished.",
  "When something goes wrong, you sometimes start with what you did wrong.":
    "When something goes wrong, you might start with what you did wrong.",
  "Your answers suggest you recharge with time to yourself.":
    "You recharge with time to yourself.",
  "The catch in your answers is that a next plan that feels like too much.":
    "You recharge with time to yourself, and the next plan can feel like too much.",
  "Someone else might notice that you recharge with time to yourself after time with other people.":
    "You recharge with time to yourself after time around other people.",
  "What you might miss is a plan you would have enjoyed.":
    "You recharge with time to yourself, so a plan you like can still wait.",
  "The helpful side for you shows up when you need time to yourself before the next plan.":
    "You recharge with time to yourself before you add another plan.",
  "Your answers suggest two things at once: you recharge with time to yourself, and you need a real tie.":
    "You recharge with time to yourself, and you need a real tie.",
  "The catch in your answers is that passing on something that would have been more fun.":
    "The catch in your answers is passing on something that would have been more fun.",
  "What this can cost you is that passing on something that would have been more fun.":
    "What this can cost you is passing on something that would have been more fun.",
  "A cost worth naming for you is that passing on something that would have been more fun.":
    "A cost worth naming for you is passing on something that would have been more fun.",
  "The catch in your answers is that skipping a change that would have been better.":
    "The catch in your answers is skipping a change that would have been better.",
  "What this can cost you is that skipping a change that would have been better.":
    "What this can cost you is skipping a change that would have been better.",
  "A cost worth naming for you is that skipping a change that would have been better.":
    "A cost worth naming for you is skipping a change that would have been better.",
  "The catch in your answers is that a plan that crowds the rest of the day.":
    "The catch in your answers is a plan that crowds the rest of the day.",
  "What this can cost you is that a plan that crowds the rest of the day.":
    "What this can cost you is a plan that crowds the rest of the day.",
  "A cost worth naming for you is that a plan that crowds the rest of the day.":
    "A cost worth naming for you is a plan that crowds the rest of the day.",
  "The catch in your answers is that a loose plan that never gets finished.":
    "The catch in your answers is a loose plan that never gets finished.",
  "What this can cost you is that a loose plan that never gets finished.":
    "What this can cost you is a loose plan that never gets finished.",
  "A cost worth naming for you is that a loose plan that never gets finished.":
    "A cost worth naming for you is a loose plan that never gets finished.",
  "The catch in your answers is that a week with no time left to come back.":
    "The catch in your answers is a week with no time left to come back.",
  "What this can cost you is that a week with no time left to come back.":
    "What this can cost you is a week with no time left to come back.",
  "A cost worth naming for you is that a week with no time left to come back.":
    "A cost worth naming for you is a week with no time left to come back.",
  "What this can cost you is that a next plan that feels like too much.":
    "What this can cost you is a next plan that feels like too much.",
  "A cost worth naming for you is that a next plan that feels like too much.":
    "A cost worth naming for you is a next plan that feels like too much.",
  "The catch in your answers is that a yes that was not meant.":
    "The catch in your answers is a yes that was not meant.",
  "What this can cost you is that a yes that was not meant.":
    "What this can cost you is a yes that was not meant.",
  "A cost worth naming for you is that a yes that was not meant.":
    "A cost worth naming for you is a yes that was not meant.",
  "The catch in your answers is that a blunt point that lands harder than it needed to.":
    "The catch in your answers is a blunt point that lands harder than it needed to.",
  "What this can cost you is that a blunt point that lands harder than it needed to.":
    "What this can cost you is a blunt point that lands harder than it needed to.",
  "A cost worth naming for you is that a blunt point that lands harder than it needed to.":
    "A cost worth naming for you is a blunt point that lands harder than it needed to.",
  "The catch in your answers is that a problem that needed more time.":
    "The catch in your answers is a problem that needed more time.",
  "What this can cost you is that a problem that needed more time.":
    "What this can cost you is a problem that needed more time.",
  "A cost worth naming for you is that a problem that needed more time.":
    "A cost worth naming for you is a problem that needed more time.",
  "The catch in your answers is that a hard day that takes over the next one.":
    "The catch in your answers is a hard day that takes over the next one.",
  "What this can cost you is that a hard day that takes over the next one.":
    "What this can cost you is a hard day that takes over the next one.",
  "A cost worth naming for you is that a hard day that takes over the next one.":
    "A cost worth naming for you is a hard day that takes over the next one.",
  "The catch in your answers is that a worry that outruns what was actually said.":
    "The catch in your answers is a worry that outruns what was actually said.",
  "What this can cost you is that a worry that outruns what was actually said.":
    "What this can cost you is a worry that outruns what was actually said.",
  "A cost worth naming for you is that a worry that outruns what was actually said.":
    "A cost worth naming for you is a worry that outruns what was actually said.",
  "The catch in your answers is that a gap that actually mattered.":
    "The catch in your answers is a gap that actually mattered.",
  "What this can cost you is that a gap that actually mattered.":
    "What this can cost you is a gap that actually mattered.",
  "A cost worth naming for you is that a gap that actually mattered.":
    "A cost worth naming for you is a gap that actually mattered.",
  "The catch in your answers is that a distance that shuts a good thing out.":
    "The catch in your answers is a distance that shuts a good thing out.",
  "What this can cost you is that a distance that shuts a good thing out.":
    "What this can cost you is a distance that shuts a good thing out.",
  "A cost worth naming for you is that a distance that shuts a good thing out.":
    "A cost worth naming for you is a distance that shuts a good thing out.",
  "The catch in your answers is that closeness with no room to breathe.":
    "The catch in your answers is closeness with no room to breathe.",
  "What this can cost you is that closeness with no room to breathe.":
    "What this can cost you is closeness with no room to breathe.",
  "A cost worth naming for you is that closeness with no room to breathe.":
    "A cost worth naming for you is closeness with no room to breathe.",
  "The catch in your answers is that a point that takes over the talk.":
    "The catch in your answers is a point that takes over the talk.",
  "What this can cost you is that a point that takes over the talk.":
    "What this can cost you is a point that takes over the talk.",
  "A cost worth naming for you is that a point that takes over the talk.":
    "A cost worth naming for you is a point that takes over the talk.",
  "The catch in your answers is that a point that never gets said.":
    "The catch in your answers is a point that never gets said.",
  "What this can cost you is that a point that never gets said.":
    "What this can cost you is a point that never gets said.",
  "A cost worth naming for you is that a point that never gets said.":
    "A cost worth naming for you is a point that never gets said.",
  "The catch in your answers is that a plan that gives away too much.":
    "The catch in your answers is a plan that gives away too much.",
  "What this can cost you is that a plan that gives away too much.":
    "What this can cost you is a plan that gives away too much.",
  "A cost worth naming for you is that a plan that gives away too much.":
    "A cost worth naming for you is a plan that gives away too much.",
  "The catch in your answers is that an outcome that leaves the other person out.":
    "The catch in your answers is an outcome that leaves the other person out.",
  "What this can cost you is that an outcome that leaves the other person out.":
    "What this can cost you is an outcome that leaves the other person out.",
  "A cost worth naming for you is that an outcome that leaves the other person out.":
    "A cost worth naming for you is an outcome that leaves the other person out.",
  "The catch in your answers is that a way that ignores a good set path.":
    "The catch in your answers is a way that ignores a good set path.",
  "What this can cost you is that a way that ignores a good set path.":
    "What this can cost you is a way that ignores a good set path.",
  "A cost worth naming for you is that a way that ignores a good set path.":
    "A cost worth naming for you is a way that ignores a good set path.",
  "The catch in your answers is that a path that was never questioned.":
    "The catch in your answers is a path that was never questioned.",
  "What this can cost you is that a path that was never questioned.":
    "What this can cost you is a path that was never questioned.",
  "A cost worth naming for you is that a path that was never questioned.":
    "A cost worth naming for you is a path that was never questioned.",
  "The catch in your answers is that a trust that skips a needed check.":
    "The catch in your answers is a trust that skips a needed check.",
  "What this can cost you is that a trust that skips a needed check.":
    "What this can cost you is a trust that skips a needed check.",
  "A cost worth naming for you is that a trust that skips a needed check.":
    "A cost worth naming for you is a trust that skips a needed check.",
  "The catch in your answers is that a doubt that stops the start.":
    "The catch in your answers is a doubt that stops the start.",
  "What this can cost you is that a doubt that stops the start.":
    "What this can cost you is a doubt that stops the start.",
  "A cost worth naming for you is that a doubt that stops the start.":
    "A cost worth naming for you is a doubt that stops the start.",
  "The catch in your answers is that a day that depends on other people too much.":
    "The catch in your answers is a day that depends on other people too much.",
  "What this can cost you is that a day that depends on other people too much.":
    "What this can cost you is a day that depends on other people too much.",
  "A cost worth naming for you is that a day that depends on other people too much.":
    "A cost worth naming for you is a day that depends on other people too much.",
  "The catch in your answers is that a day that gets too cut off.":
    "The catch in your answers is a day that gets too cut off.",
  "What this can cost you is that a day that gets too cut off.":
    "What this can cost you is a day that gets too cut off.",
  "A cost worth naming for you is that a day that gets too cut off.":
    "A cost worth naming for you is a day that gets too cut off.",
  "The catch in your answers is that a change that never settles.":
    "The catch in your answers is a change that never settles.",
  "What this can cost you is that a change that never settles.":
    "What this can cost you is a change that never settles.",
  "A cost worth naming for you is that a change that never settles.":
    "A cost worth naming for you is a change that never settles.",
  "The catch in your answers is that an ending that closes a path too soon.":
    "The catch in your answers is an ending that closes a path too soon.",
  "What this can cost you is that an ending that closes a path too soon.":
    "What this can cost you is an ending that closes a path too soon.",
  "A cost worth naming for you is that an ending that closes a path too soon.":
    "A cost worth naming for you is an ending that closes a path too soon.",
  "The catch in your answers is that a blame that lands only on you.":
    "The catch in your answers is a blame that lands only on you.",
  "What this can cost you is that a blame that lands only on you.":
    "What this can cost you is a blame that lands only on you.",
  "A cost worth naming for you is that a blame that lands only on you.":
    "A cost worth naming for you is a blame that lands only on you.",
  "The catch in your answers is that a cause that ignores a real lever.":
    "The catch in your answers is a cause that ignores a real lever.",
  "What this can cost you is that a cause that ignores a real lever.":
    "What this can cost you is a cause that ignores a real lever.",
  "A cost worth naming for you is that a cause that ignores a real lever.":
    "A cost worth naming for you is a cause that ignores a real lever.",
  "The catch in your answers is that a start that ignores the size.":
    "The catch in your answers is a start that ignores the size.",
  "What this can cost you is that a start that ignores the size.":
    "What this can cost you is a start that ignores the size.",
  "A cost worth naming for you is that a start that ignores the size.":
    "A cost worth naming for you is a start that ignores the size.",
  "The catch in your answers is that a pause that never becomes a start.":
    "The catch in your answers is a pause that never becomes a start.",
  "What this can cost you is that a pause that never becomes a start.":
    "What this can cost you is a pause that never becomes a start.",
  "A cost worth naming for you is that a pause that never becomes a start.":
    "A cost worth naming for you is a pause that never becomes a start.",
  "The catch in your answers is that play that makes the task late.":
    "The catch in your answers is play that makes the task late.",
  "What this can cost you is that play that makes the task late.":
    "What this can cost you is play that makes the task late.",
  "A cost worth naming for you is that play that makes the task late.":
    "A cost worth naming for you is play that makes the task late.",
  "The catch in your answers is that a straight read that misses a useful joke.":
    "The catch in your answers is a straight read that misses a useful joke.",
  "What this can cost you is that a straight read that misses a useful joke.":
    "What this can cost you is a straight read that misses a useful joke.",
  "A cost worth naming for you is that a straight read that misses a useful joke.":
    "A cost worth naming for you is a straight read that misses a useful joke.",
  "Someone else might notice that you give the easy yes while a blunt no is available.":
    "Someone else might notice that you give the easy yes even when a blunt no is available.",
  "From the outside, you give the easy yes while a blunt no is available.":
    "From the outside, you give the easy yes even when a blunt no is available.",
  "Other people can see that you give the easy yes while a blunt no is available.":
    "Other people can see that you give the easy yes even when a blunt no is available.",
  "A week can hold both for you, so you go along, while you step back.":
    "In the same week, you go along, and you step back.",
  "A week can hold both for you, so you state the point, while you say your point.":
    "In the same week, you state a blunt point, and you say it when you disagree.",
  "A week can hold both for you, so you check they will stay, while you stay close.":
    "In the same week, you check they will stay, and you stay close.",
  "A week can hold both for you, so you let a gap pass, while you want people around.":
    "In the same week, you let a gap pass, and you want people around.",
  "A week can hold both for you, so you keep some distance, while you choose the way.":
    "In the same week, you keep some distance, and you choose the way.",
  "A week can hold both for you, so you stay close, while you need a real tie.":
    "In the same week, you stay close, and you need a real tie.",
  "Someone else might notice that you pick your own way while a set path is available.":
    "Someone else might notice that you pick your own way even when a set path is available.",
  "From the outside, you pick your own way while a set path is available.":
    "From the outside, you pick your own way even when a set path is available.",
  "Other people can see that you pick your own way while a set path is available.":
    "Other people can see that you pick your own way even when a set path is available.",
  "A week can hold both for you, so you choose the way, while you can skip the tie.":
    "In the same week, you choose the way, and you can skip the tie.",
  "Someone else might notice that you take the set path while your own way is available.":
    "Someone else might notice that you take the set path even when your own way is available.",
  "From the outside, you take the set path while your own way is available.":
    "From the outside, you take the set path even when your own way is available.",
  "Other people can see that you take the set path while your own way is available.":
    "Other people can see that you take the set path even when your own way is available.",
  "A week can hold both for you, so you take the set path, while you need a real tie.":
    "In the same week, you take the set path, and you need a real tie.",
  "Someone else might notice that you trust a hard task while doubt is available.":
    "Someone else might notice that you trust a hard task even when doubt is available.",
  "From the outside, you trust a hard task while doubt is available.":
    "From the outside, you trust a hard task even when doubt is available.",
  "Other people can see that you trust a hard task while doubt is available.":
    "Other people can see that you trust a hard task even when doubt is available.",
  "A week can hold both for you, so you trust the hard task, while you expect to finish.":
    "In the same week, you trust the hard task, and you expect to finish.",
  "A week can hold both for you, so you doubt the hard task, while you look for the change.":
    "In the same week, you doubt the hard task, and you look for the change.",
  "A week can hold both for you, so you say your point, while you widen the plan.":
    "In the same week, you say your point, and you widen the plan.",
  "Someone else might notice that you step back while the point is ready to say.":
    "Someone else might notice that you step back even when the point is ready to say.",
  "From the outside, you step back while the point is ready to say.":
    "From the outside, you step back even when the point is ready to say.",
  "Other people can see that you step back while the point is ready to say.":
    "Other people can see that you step back even when the point is ready to say.",
  "A week can hold both for you, so you step back, while you widen the plan.":
    "In the same week, you step back, and you widen the plan.",
  "A week can hold both for you, so you widen the plan, while you go along.":
    "In the same week, you widen the plan, and you go along.",
  "A week can hold both for you, so you protect the outcome, while you say your point.":
    "In the same week, you protect the outcome, and you say your point.",
  "A week can hold both for you, so you finish the plan, while you feel a bad day longer.":
    "In the same week, you finish the plan, and you feel a bad day longer.",
  "Someone else might notice that you leave the plan open while others want it locked.":
    "Someone else might notice that you leave the plan open even when others want it locked.",
  "From the outside, you leave the plan open while others want it locked.":
    "From the outside, you leave the plan open even when others want it locked.",
  "Other people can see that you leave the plan open while others want it locked.":
    "Other people can see that you leave the plan open even when others want it locked.",
  "A week can hold both for you, so you keep plans loose, while you try new things.":
    "In the same week, you keep plans loose, and you try new things.",
  "A week can hold both for you, so you want people around, while you turn it into play.":
    "In the same week, you want people around, and you turn it into play.",
  "A week can hold both for you, so you recharge with time to yourself, while you need a real tie.":
    "In the same week, you recharge with time to yourself, and you need a real tie.",
  "Someone else might notice that you look for a change while the miss could stay closed.":
    "Someone else might notice that you look for a change even when the miss could stay closed.",
  "From the outside, you look for a change while the miss could stay closed.":
    "From the outside, you look for a change even when the miss could stay closed.",
  "Other people can see that you look for a change while the miss could stay closed.":
    "Other people can see that you look for a change even when the miss could stay closed.",
  "A week can hold both for you, so you look for the change, while you look at your part.":
    "In the same week, you look for the change, and you look at your part.",
  "Someone else might notice that you treat a miss as final while another try is available.":
    "Someone else might notice that you treat a miss as final even when another try is available.",
  "From the outside, you treat a miss as final while another try is available.":
    "From the outside, you treat a miss as final even when another try is available.",
  "Other people can see that you treat a miss as final while another try is available.":
    "Other people can see that you treat a miss as final even when another try is available.",
  "A week can hold both for you, so you close the path, while you keep a known favorite.":
    "In the same week, you close the path, and you keep a known favorite.",
  "A week can hold both for you, so you look at your part, while you finish the plan.":
    "In the same week, you look at your part, and you finish the plan.",
  "Someone else might notice that you treat the outcome as bound to happen while a lever is visible.":
    "Someone else might notice that you treat the outcome as bound to happen even when a lever is visible.",
  "From the outside, you treat the outcome as bound to happen while a lever is visible.":
    "From the outside, you treat the outcome as bound to happen even when a lever is visible.",
  "Other people can see that you treat the outcome as bound to happen while a lever is visible.":
    "Other people can see that you treat the outcome as bound to happen even when a lever is visible.",
  "A week can hold both for you, so you blame the day, while you shake a bad day off.":
    "In the same week, you blame the day, and you shake a bad day off.",
  "Someone else might notice that you reach for a new option while a favorite is still there.":
    "Someone else might notice that you reach for a new option even when a favorite is still there.",
  "From the outside, you reach for a new option while a favorite is still there.":
    "From the outside, you reach for a new option even when a favorite is still there.",
  "Other people can see that you reach for a new option while a favorite is still there.":
    "Other people can see that you reach for a new option even when a favorite is still there.",
  "A week can hold both for you, so you try new things, while you want people around.":
    "In the same week, you try new things, and you want people around.",
  "Someone else might notice that you stay with a known favorite while a new option waits.":
    "Someone else might notice that you stay with a known favorite even when a new option waits.",
  "From the outside, you stay with a known favorite while a new option waits.":
    "From the outside, you stay with a known favorite even when a new option waits.",
  "Other people can see that you stay with a known favorite while a new option waits.":
    "Other people can see that you stay with a known favorite even when a new option waits.",
  "A week can hold both for you, so you keep a known favorite, while you finish the plan.":
    "In the same week, you keep a known favorite, and you finish the plan.",
  "A week can hold both for you, so you turn it into play, while you shake a bad day off.":
    "In the same week, you turn it into play, and you shake a bad day off.",
  "Someone else might notice that you take the straight version while a playful one is available.":
    "Someone else might notice that you take the straight version even when a playful one is available.",
  "From the outside, you take the straight version while a playful one is available.":
    "From the outside, you take the straight version even when a playful one is available.",
  "Other people can see that you take the straight version while a playful one is available.":
    "Other people can see that you take the straight version even when a playful one is available.",
  "A week can hold both for you, so you take it straight, while you finish the plan.":
    "In the same week, you take it straight, and you finish the plan.",
  "A week can hold both for you, so you need a real tie, while you turn it into play.":
    "In the same week, you need a real tie, and you turn it into play.",
  "A week can hold both for you, so you can skip the tie, while you recharge with time to yourself.":
    "In the same week, you can skip the tie, and you recharge with time to yourself.",
  "A week can hold both for you, so you expect to finish, while you try new things.":
    "In the same week, you expect to finish, and you try new things.",
  "A week can hold both for you, so you pause on the big task, while you doubt the hard task.":
    "In the same week, you pause on the big task, and you doubt the hard task.",
  "Your lock screen might take the first minute of the morning, while the kettle is still cold.":
    "Your lock screen might take the first minute of the morning.",
  "A friend’s text might get a fast reply from you, while another chat sits for days.":
    "Some of your chats get a fast reply, and some sit for days.",
  "While a friend is talking, you might already be lining up what you will say next.":
    "A reply can be ready before your friend has finished talking.",
  "Your reply can be forming while the other person is still in the middle of the story.":
    "Your reply can start before the other person has finished the story.",
  "While you are working, you might switch between the task and your messages every few minutes.":
    "You might switch between the task and your messages every few minutes.",
  "Several tabs and chats can stay open while you try to do one piece of work.":
    "Several tabs and chats can stay open on one piece of your work.",
  "Someone else might notice that you move on from a bad day while it is still going.":
    "Someone else might notice that you move on from a bad day even when it is still going.",
  "From the outside, you move on from a bad day while it is still going.":
    "From the outside, you move on from a bad day even when it is still going.",
  "Other people can see that you move on from a bad day while it is still going.":
    "Other people can see that you move on from a bad day even when it is still going.",
  "A week can hold both for you, so you shake a bad day off, while you let a gap pass.":
    "In the same week, you shake a bad day off, and you let a gap pass.",
  "A week can hold both for you, so you feel a bad day longer, while you check they will stay.":
    "In the same week, you feel a bad day longer, and you check they will stay.",
  "A week can hold both for you, so you go along, and you step back.":
    "In the same week, you go along, and you step back.",
  "A week can hold both for you, so you state the point, and you say your point.":
    "In the same week, you state a blunt point, and you say it when you disagree.",
  "Your answers suggest two things at once: you state the point, and you say your point.":
    "Your answers suggest two things at once: you state a blunt point, and you say it when you disagree.",
  "Both can be true for you in the same week: you state the point, and you say your point.":
    "Both can be true for you in the same week: you state a blunt point, and you say it when you disagree.",
  "A week can hold both for you, so you check they will stay, and you stay close.":
    "In the same week, you check they will stay, and you stay close.",
  "A week can hold both for you, so you let a gap pass, and you want people around.":
    "In the same week, you let a gap pass, and you want people around.",
  "A week can hold both for you, so you keep some distance, and you choose the way.":
    "In the same week, you keep some distance, and you choose the way.",
  "A week can hold both for you, so you stay close, and you need a real tie.":
    "In the same week, you stay close, and you need a real tie.",
  "A week can hold both for you, so you choose the way, and you can skip the tie.":
    "In the same week, you choose the way, and you can skip the tie.",
  "A week can hold both for you, so you take the set path, and you need a real tie.":
    "In the same week, you take the set path, and you need a real tie.",
  "A week can hold both for you, so you trust the hard task, and you expect to finish.":
    "In the same week, you trust the hard task, and you expect to finish.",
  "A week can hold both for you, so you doubt the hard task, and you look for the change.":
    "In the same week, you doubt the hard task, and you look for the change.",
  "A week can hold both for you, so you say your point, and you widen the plan.":
    "In the same week, you say your point, and you widen the plan.",
  "A week can hold both for you, so you step back, and you widen the plan.":
    "In the same week, you step back, and you widen the plan.",
  "A week can hold both for you, so you widen the plan, and you go along.":
    "In the same week, you widen the plan, and you go along.",
  "A week can hold both for you, so you protect the outcome, and you say your point.":
    "In the same week, you protect the outcome, and you say your point.",
  "A week can hold both for you, so you finish the plan, and you feel a bad day longer.":
    "In the same week, you finish the plan, and you feel a bad day longer.",
  "A week can hold both for you, so you keep plans loose, and you try new things.":
    "In the same week, you keep plans loose, and you try new things.",
  "A week can hold both for you, so you want people around, and you turn it into play.":
    "In the same week, you want people around, and you turn it into play.",
  "A week can hold both for you, so you recharge with time to yourself, and you need a real tie.":
    "In the same week, you recharge with time to yourself, and you need a real tie.",
  "A week can hold both for you, so you look for the change, and you look at your part.":
    "In the same week, you look for the change, and you look at your part.",
  "A week can hold both for you, so you close the path, and you keep a known favorite.":
    "In the same week, you close the path, and you keep a known favorite.",
  "A week can hold both for you, so you look at your part, and you finish the plan.":
    "In the same week, you look at your part, and you finish the plan.",
  "A week can hold both for you, so you blame the day, and you shake a bad day off.":
    "In the same week, you blame the day, and you shake a bad day off.",
  "A week can hold both for you, so you try new things, and you want people around.":
    "In the same week, you try new things, and you want people around.",
  "A week can hold both for you, so you keep a known favorite, and you finish the plan.":
    "In the same week, you keep a known favorite, and you finish the plan.",
  "A week can hold both for you, so you turn it into play, and you shake a bad day off.":
    "In the same week, you turn it into play, and you shake a bad day off.",
  "A week can hold both for you, so you take it straight, and you finish the plan.":
    "In the same week, you take it straight, and you finish the plan.",
  "A week can hold both for you, so you need a real tie, and you turn it into play.":
    "In the same week, you need a real tie, and you turn it into play.",
  "A week can hold both for you, so you can skip the tie, and you recharge with time to yourself.":
    "In the same week, you can skip the tie, and you recharge with time to yourself.",
  "A week can hold both for you, so you expect to finish, and you try new things.":
    "In the same week, you expect to finish, and you try new things.",
  "A week can hold both for you, so you pause on the big task, and you doubt the hard task.":
    "In the same week, you pause on the big task, and you doubt the hard task.",
  "Some of your chats get a fast reply, and some sit.":
    "Some of your chats get a fast reply, and some sit for days.",
  "A friend’s story can have your reply lined up before they finish.":
    "A reply can be ready before your friend has finished talking.",
  "A week can hold both for you, so you shake a bad day off, and you let a gap pass.":
    "In the same week, you shake a bad day off, and you let a gap pass.",
  "A week can hold both for you, so you feel a bad day longer, and you check they will stay.":
    "In the same week, you feel a bad day longer, and you check they will stay.",
};
for (const [oldText, currentText] of Object.entries(RETIRED_FOCUS_TEXT)) {
  const match = BY_TITLE.get(currentText);
  if (match) BY_TITLE.set(oldText, match);
}

/** The idea a stored title came from, or null for an old AI-written row. */
export function ideaForTitle(title: string | null | undefined): TitleMatch | null {
  if (!title) return null;
  return BY_TITLE.get(title.trim()) ?? null;
}

/** True when a stored insight came from this bank. Old AI rows are hidden everywhere. */
export function isBankInsightTitle(title: string | null | undefined): boolean {
  return ideaForTitle(title) != null;
}

/** What a starter's tag row says. */
export const STARTER_TAG_LABEL = 'General';
/** How the tags are joined in the stored `theme`, and split again on Home. */
export const TAG_SEPARATOR = ' · ';

/** One tag: "Reassurance: Watchful". Never the internal trait id. */
export function keyTag(key: LineKey): string {
  const axis = axisOfKey(key);
  const lean = key.slice(key.indexOf(':') + 1) as TraitLean;
  return `${AXIS_SHORT_NAME[axis]}: ${AXIS_POLE_NAME[axis][lean]}`;
}

export function ideaTags(entry: InsightIdea): string[] {
  return entry.keys.length === 0 ? [STARTER_TAG_LABEL] : entry.keys.map(keyTag);
}

/** The stored `theme`: the tags joined, which Home splits back into chips. */
export function ideaTheme(entry: InsightIdea): string {
  return ideaTags(entry).join(TAG_SEPARATOR);
}

/** Splits a stored theme back into chips. */
export function themeTags(theme: string | null | undefined): string[] {
  return (theme ?? '')
    .split(TAG_SEPARATOR)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Whether this idea's focus and tags may leave the app (widget, push, share).
 * Same list the share image uses: closeness-and-worry leans and the struggle
 * side of a trait stay inside the app. Starters have no key and are fine.
 */
export function ideaShareable(entry: InsightIdea): boolean {
  return entry.keys.every((key) => {
    const lean = key.slice(key.indexOf(':') + 1) as TraitLean;
    return isShareableLean(axisOfKey(key), lean);
  });
}
