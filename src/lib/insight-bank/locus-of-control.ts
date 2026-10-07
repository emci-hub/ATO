/** Ownership (locus_of_control): Accountable (high) and Accepting (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const LOCUS_OF_CONTROL_IDEAS: readonly InsightIdea[] = [
  idea('ftw_locus_of_control_h_01', ['locus_of_control:high'], {
    focus: [
      'When something goes wrong, you tend to ask what you could have done differently.',
      'You usually look at your own part first when a plan fails.',
      'When a project goes badly, you tend to take responsibility for it.',
    ],
    why: 'Owning your part helps you improve, but you can end up blaming yourself for things you couldn’t control.',
    try: [
      'Write down what was in your control and what wasn’t, so you only carry your part.',
      'Name one thing that went wrong that wasn’t your fault, so the blame is fair.',
    ],
    watch: [
      'Notice when you take the blame for something outside your control.',
      'Notice how others share responsibility.',
    ],
  }),
  idea('ftw_locus_of_control_h_02', ['locus_of_control:high'], {
    focus: [
      'When you want something to happen, you tend to make a plan and work for it.',
      'You usually believe your effort decides how things turn out.',
      'When you face a problem, you tend to look for what you can do about it.',
    ],
    why: 'Believing your actions matter keeps you motivated, but some things depend on luck or other people.',
    try: [
      'Pick one thing you can’t control this week and let it be, so you save energy.',
      'Write down your plan and one thing that might get in the way, so you’re ready either way.',
    ],
    watch: [
      'Notice when things go wrong despite your best plan.',
      'Notice how you react to things you can’t change.',
    ],
  }),
  idea('ftw_locus_of_control_h_03', ['locus_of_control:high'], {
    focus: [
      'When a team project struggles, you tend to feel it’s up to you to fix it.',
      'You usually feel responsible for how things turn out for the group.',
      'When things fall apart at work, you tend to step in and try to save it.',
    ],
    why: 'Feeling responsible makes you dependable, but carrying the whole team can wear you out.',
    try: [
      'Ask one teammate to take a part of the fix, so it’s not all on you.',
      'Tell your boss what you need to fix it, so you get support.',
    ],
    watch: [
      'Notice when you take on more than your share.',
      'Notice how tired you feel after saving a project.',
    ],
  }),
  idea('ftw_locus_of_control_h_04', ['locus_of_control:high'], {
    focus: [
      'When something goes wrong, you tend not to blame others or bad luck.',
      'You usually focus on your own choices instead of what others did.',
      'When things go badly, you tend to ask what you can do instead of whose fault it is.',
    ],
    why: 'Focusing on what you can do keeps you moving forward, but sometimes others do share the blame.',
    try: [
      'Next time something goes wrong, name one factor outside your control, so you see the full picture.',
      'Ask the people involved what they’d do differently too, so the lesson is shared.',
    ],
    watch: [
      'Notice when someone else’s part gets left out.',
      'Notice how fair your view of blame is.',
    ],
  }),
  idea('ftw_locus_of_control_h_05', ['locus_of_control:high'], {
    focus: [
      'When you set a goal, you tend to hold yourself to it.',
      'You usually feel it’s on you to make your life better.',
      'When you’re unhappy with something, you tend to try to change it yourself.',
    ],
    why: 'Holding yourself accountable makes you reliable, but you can be harder on yourself than on anyone else.',
    try: [
      'Talk to yourself the way you would to a friend after a miss, so you stay kind.',
      'Write down one goal you met this month, so you see what your effort did.',
    ],
    watch: [
      'Notice how you talk to yourself when you miss a goal.',
      'Notice whether you’d judge a friend that harshly.',
    ],
  }),
  idea('ftw_locus_of_control_h_06', ['locus_of_control:high', 'conscientiousness:high'], {
    focus: [
      'You tend to plan carefully and take responsibility for how things turn out.',
      'When you set out to do something, you usually plan it and own the results.',
      'You tend to feel that results come from good planning and your own effort.',
    ],
    why: 'Your planning and ownership make you dependable, but surprises can feel like your fault when they aren’t.',
    try: [
      'Leave one free hour in your plan today, so a surprise doesn’t throw off the whole day.',
      'Write down one thing that went right this week because of your planning, so you see it work.',
    ],
    watch: [
      'Notice when you blame yourself for a surprise.',
      'Notice how often your plans work out.',
    ],
  }),
  idea('ftw_locus_of_control_l_01', ['locus_of_control:low'], {
    focus: [
      'When something goes wrong, you tend to accept it and move on.',
      'You usually feel that some things just happen and there’s no point fighting them.',
      'When plans fall apart, you tend to shrug and adjust.',
    ],
    why: 'Accepting things saves you a lot of stress, but some situations might be easier to change than they look.',
    try: [
      'Pick one thing you’ve accepted lately and ask if one small action would change it, so you know.',
      'Write down one thing you could control this week, so you see where you have a say.',
    ],
    watch: [
      'Notice when “that’s just how it is” really means you haven’t tried yet.',
      'Notice what changes when you take one small step.',
    ],
  }),
  idea('ftw_locus_of_control_l_02', ['locus_of_control:low'], {
    focus: [
      'When things go well, you tend to say you got lucky.',
      'You usually credit good results to timing or luck more than your effort.',
      'When you succeed, you tend to say it was the team or the timing.',
    ],
    why: 'Being modest about success is kind, but it can hide how much your effort mattered.',
    try: [
      'Write down one thing you did that helped a recent success, so you see your part.',
      'Say “thanks, I worked hard on it” the next time someone praises you, so you own it.',
    ],
    watch: [
      'Notice when you give all the credit to luck.',
      'Notice what you actually did to make things go well.',
    ],
  }),
  idea('ftw_locus_of_control_l_03', ['locus_of_control:low'], {
    focus: [
      'When you want something to change, you tend to wait and see if it happens on its own.',
      'You usually let things play out before you step in.',
      'When a problem comes up, you tend to give it time to sort itself out.',
    ],
    why: 'Patience can help, but some problems get bigger if you wait too long.',
    try: [
      'Pick one problem you’ve been waiting on and take one small step today, so it starts moving.',
      'Set a date to act if nothing changes, so waiting has an end.',
    ],
    watch: [
      'Notice which problems sorted themselves out and which didn’t.',
      'Notice when waiting turns into avoiding.',
    ],
  }),
  idea('ftw_locus_of_control_l_04', ['locus_of_control:low'], {
    focus: [
      'When a decision is out of your hands, you tend to accept it without much stress.',
      'You usually feel calm when others make the big decisions.',
      'When your boss changes plans, you tend to go along without fuss.',
    ],
    why: 'Staying calm when things are out of your hands is a strength, but your input might still change the outcome.',
    try: [
      'Share one thought on a decision this week, so your view is part of it.',
      'Ask how a decision was made, so you know where you could have a say.',
    ],
    watch: [
      'Notice when you had more say than you thought.',
      'Notice how decisions affect you later.',
    ],
  }),
  idea('ftw_locus_of_control_l_05', ['locus_of_control:low'], {
    focus: [
      'When things go wrong, you tend not to take it personally.',
      'You usually don’t blame yourself for things outside your control.',
      'When something fails, you tend to see that it wasn’t all on you.',
    ],
    why: 'Not blaming yourself keeps you calm, and it helps when you also notice the parts you could change.',
    try: [
      'Write down one thing you could do differently next time, so you learn something useful.',
      'Ask a friend what they’d change in your place, so you get a new idea.',
    ],
    watch: [
      'Notice the small parts you could control.',
      'Notice how calm you stay when things go wrong.',
    ],
  }),
  idea('ftw_locus_of_control_l_06', ['locus_of_control:low', 'steadiness:high'], {
    focus: [
      'When things go wrong, you tend to stay calm and accept it rather than fight it.',
      'You usually take setbacks calmly and see them as part of life.',
      'When plans fall through, you tend to stay relaxed and find something else to do.',
    ],
    why: 'Your calm acceptance helps you handle surprises, but sometimes a little push from you can change the outcome.',
    try: [
      'Pick one setback this week and take one step to change it, so you see what you can do.',
      'Ask yourself what one small action could help, so accepting doesn’t turn into giving up.',
    ],
    watch: [
      'Notice when accepting something means missing a chance to change it.',
      'Notice how calm you stay compared to others.',
    ],
  }),
];
