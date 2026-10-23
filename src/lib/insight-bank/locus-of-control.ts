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
      'Notice how you split up blame when you look back on a problem.',
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
    why: 'Patience can help, but some problems can get bigger if you wait too long.',
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
      'Notice how calm you stay when plans change.',
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
      'Plan for the top three risks only, so you save energy for the rest.',
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
      'When you start a new project, you tend to take it as it comes.',
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
      'When a result is far away, you tend to put your energy into the present instead.',
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
    why: 'Letting go protects your energy, but some parts you wrote off as out of your hands might have had a simple fix.',
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
