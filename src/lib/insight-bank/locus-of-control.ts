/** Ownership (locus_of_control): Accountable (high) and Accepting (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const LOCUS_OF_CONTROL_IDEAS: readonly InsightIdea[] = [
  idea('ftw_locus_of_control_h_01', ['locus_of_control:high'], {
    focus: [
      'When something goes wrong, you usually ask what you could have done differently before anything else.',
      'A failed plan can have you looking at your own part first, even when the delay was someone else’s.',
      'If a project goes badly, you sometimes take the whole thing on yourself when you talk it over.',
    ],
    why: 'Owning your part can help the next try, but you can end up blaming yourself for a delay you could not control.',
    try: [
      'Write down what was in your control and what was not, so you only carry your part.',
      'Name one thing that went wrong that was not your fault, so the blame stays fair.',
    ],
    watch: [
      'Notice when you take the blame for a delay that sat outside your calendar.',
      'Notice how other people split the responsibility when the same project is talked over.',
    ],
  }),
  idea('ftw_locus_of_control_h_02', ['locus_of_control:high'], {
    focus: [
      'When you want something, you usually make a plan and start working it the same day.',
      'You can treat your own effort as the thing that decides how a project turns out.',
      'A problem at work sometimes becomes a list of what you personally can do about it.',
    ],
    why: 'Believing your actions matter can keep you moving, but some outcomes depend on luck or on other people.',
    try: [
      'Pick one thing you cannot control this week and leave it, so you keep the hours.',
      'Write down your plan and one thing that might get in the way, so you are ready either way.',
    ],
    watch: [
      'Notice when things go wrong even after your best plan.',
      'Notice how you react to a result you cannot change.',
    ],
  }),
  idea('ftw_locus_of_control_h_03', ['locus_of_control:high'], {
    focus: [
      'When a team project struggles, you usually feel it is on you to fix it.',
      'A messy week at work can have you stepping in to save the shared doc.',
      'You sometimes carry how the group turns out, even the parts that were never your task.',
    ],
    why: 'Feeling responsible makes you the person people count on, but carrying the whole team can wear you out.',
    try: [
      'Ask one teammate to take a part of the fix, so it is not all on you.',
      'Tell your boss what you need to fix it, so you get some support.',
    ],
    watch: [
      'Notice when you take on more than your share of the project.',
      'Notice how tired you feel after saving a project that was slipping.',
    ],
  }),
  idea('ftw_locus_of_control_h_04', ['locus_of_control:high'], {
    focus: [
      'When something goes wrong, you usually skip blame and look at your own choices.',
      'A bad outcome can have you asking what you can do, not whose fault the email was.',
      'You sometimes leave other people’s part out of the story when you look back.',
    ],
    why: 'Staying on what you can do keeps you moving, but sometimes other people do share the blame.',
    try: [
      'Next time something goes wrong, name one factor outside your control, like the late train, so you see the full picture.',
      'Ask the people involved what they would do differently too, so the lesson is shared.',
    ],
    watch: [
      'Notice when someone else’s part gets left out when you talk the problem over.',
      'Notice how you split the blame when you look back at a problem.',
    ],
  }),
  idea('ftw_locus_of_control_h_05', ['locus_of_control:high'], {
    focus: [
      'A goal on your list usually stays on you, and you hold yourself to it harder than you would a friend.',
      'When you are unhappy with something, you can try to change it yourself before you tell anyone.',
      'You sometimes talk to yourself after a miss in a way you would never text a friend.',
    ],
    why: 'Holding yourself to the goal makes you reliable, but you can be harder on yourself than on anyone else.',
    try: [
      'Talk to yourself the way you would text a friend after a miss, so you stay fair.',
      'Write down one goal you met this month, so you see what the effort did.',
    ],
    watch: [
      'Notice how you talk to yourself when you miss a goal on the list.',
      'Notice whether you would judge a friend that harshly for the same miss.',
    ],
  }),
  idea('ftw_locus_of_control_h_06', ['locus_of_control:high', 'conscientiousness:high'], {
    focus: [
      'You usually plan a thing carefully and then treat the result as yours to answer for.',
      'You can write the plan, do the steps, and still feel the outcome sits on you.',
      'When you set out to do something, you sometimes map it and then own how it turns out.',
    ],
    why: 'Your planning and your ownership make you dependable, but a surprise can feel like your fault when it is not.',
    try: [
      'Leave one free hour in today’s plan, so a surprise has somewhere to sit.',
      'Write down one thing that went right this week because of your planning, so you can see it work.',
    ],
    watch: [
      'Notice when you blame yourself for a surprise that was not on the plan.',
      'Notice how often the plan actually works out.',
    ],
  }),
  idea('ftw_locus_of_control_l_01', ['locus_of_control:low'], {
    focus: [
      'When something goes wrong, you usually accept it and move on to the next thing.',
      'A fallen plan can get a shrug from you, and then you adjust the rest of the day.',
      'You sometimes feel a problem just happened, and pushing on it would not change the outcome.',
    ],
    why: 'Accepting a mess can save you a lot of stress, but some situations might be easier to change than they look.',
    try: [
      'Pick one thing you have accepted lately and ask if one small action would change it, so you know.',
      'Write down one thing on this week’s list you could control, so you see where you have a say.',
    ],
    watch: [
      'Notice when “that is just how it is” means you have not tried yet.',
      'Notice what changes once you take one small step.',
    ],
  }),
  idea('ftw_locus_of_control_l_02', ['locus_of_control:low'], {
    focus: [
      'When something goes well, you usually say you got lucky.',
      'Praise for a project can get “the timing was right” from you instead of what you did.',
      'A win sometimes gets credited by you to the team or the timing, and your part stays quiet.',
    ],
    why: 'Being modest about a win is kind, but it can hide how much your effort mattered.',
    try: [
      'Write down one thing you did that helped a recent win at work, so you see your part.',
      'Say “thanks, I worked on that” the next time someone praises you, so you own the work.',
    ],
    watch: [
      'Notice when you give the whole credit to luck or timing.',
      'Notice what you actually did to make the thing go well.',
    ],
  }),
  idea('ftw_locus_of_control_l_03', ['locus_of_control:low'], {
    focus: [
      'When you want something to change, you usually wait to see if it happens on its own.',
      'A problem in the work chat can get time from you before you step in.',
      'You sometimes give a mess a few days to sort itself before you touch it.',
    ],
    why: 'Patience can help, but some problems get bigger if you wait too long.',
    try: [
      'Pick one problem you have been waiting on and take one small step today, so it starts moving.',
      'Set a date to act if nothing changes, so the waiting has an end.',
    ],
    watch: [
      'Notice which problems sorted themselves and which did not.',
      'Notice when waiting turns into avoiding the message.',
    ],
  }),
  idea('ftw_locus_of_control_l_04', ['locus_of_control:low'], {
    focus: [
      'When a decision is out of your hands, you usually accept it without much stress.',
      'You can stay calm when your boss or a friend makes the big call.',
      'A changed plan from your boss sometimes gets a simple ok from you, with no pushback.',
    ],
    why: 'Staying calm when the call is not yours is a strength, but your input might still change the outcome.',
    try: [
      'Share one thought in the work chat on a decision this week, so your view is part of it.',
      'Ask how a decision in the meeting was made, so you know where you could have had a say.',
    ],
    watch: [
      'Notice when a decision you stayed quiet on still had room for your say.',
      'Notice how a decision you stayed quiet on affects you later.',
    ],
  }),
  idea('ftw_locus_of_control_l_05', ['locus_of_control:low'], {
    focus: [
      'When things go wrong, you usually do not take the miss personally.',
      'You can leave the blame off yourself when the cause sat outside your control.',
      'A failed plan sometimes reads to you as not all on you, and you stay steady about it.',
    ],
    why: 'Not blaming yourself keeps you calm, and it helps when you also notice the parts you could change next time.',
    try: [
      'Write down one thing you could do differently on the next try, so the miss teaches you something useful.',
      'Ask a friend what they would change in your place, so you get a new idea.',
    ],
    watch: [
      'Notice the small parts of the miss you could control.',
      'Notice how calm you stay when a plan goes wrong.',
    ],
  }),
  idea('ftw_locus_of_control_l_06', ['locus_of_control:low', 'steadiness:high'], {
    focus: [
      'When things go wrong, you usually stay calm and accept them instead of fighting the outcome.',
      'A setback can land with you as part of the day, and you move to something else.',
      'When a plan falls through, you sometimes stay relaxed and find another thing to do.',
    ],
    why: 'Your calm helps you handle a surprise, but a small push from you can sometimes change the outcome.',
    try: [
      'Pick one setback on this week’s list and take one step to change it, so you see what you can do.',
      'Ask yourself what one small action could help, so accepting does not turn into stopping.',
    ],
    watch: [
      'Notice when accepting a changed plan means missing a chance to change it.',
      'Notice how calm you stay when a plan changes on you.',
    ],
  }),
];
