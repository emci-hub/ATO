/**
 * Mixed ideas (A6, 2026-10-23): for someone who has answered on a trait but sits
 * near the middle, so no lean is clear. Three per trait, `ftw_<axis>_m_<nn>`.
 * Same clear voice as the rest. They describe a "depends on the situation" pattern
 * honestly, never as an average and never as a lean. Each is tagged "<Trait>: Mixed".
 */
import { mixedIdea, type InsightIdea } from './define';

export const MIXED_IDEAS: readonly InsightIdea[] = [
  // --- Curiosity (openness)
  mixedIdea('ftw_openness_m_01', 'openness', {
    focus: [
      'Some days you want to try something new, and other days you want what you already know.',
      'When you choose where to eat or what to watch, you tend to go back and forth between new and familiar.',
      'Your pull toward new things tends to depend on your mood and how much energy you have.',
    ],
    why: 'Having both sides is useful, but you may not notice which one you’re choosing, and that can leave you with a pick you don’t enjoy.',
    try: [
      'Ask yourself “new or familiar?” before your next choice, so you pick on purpose.',
      'Plan one familiar favorite and one new thing this week, so you get both.',
    ],
    watch: [
      'Notice what kind of day makes you want something new.',
      'Notice what kind of day makes you want the usual.',
    ],
  }),
  mixedIdea('ftw_openness_m_02', 'openness', {
    focus: [
      'When a friend suggests a new plan, you tend to say yes to some and no to others.',
      'You usually need a reason to try something unfamiliar, but a small one is enough.',
      'When a new idea shows up at work, you tend to be open to it if you can see how it helps.',
    ],
    why: 'Wanting a reason keeps you from jumping at everything, but friends may not know what would get you to say yes.',
    try: [
      'Tell a friend what makes a new plan easy for you to say yes to, so they know how to ask.',
      'Say yes to one plan this week that you’d normally think about, so you test your hunch.',
    ],
    watch: [
      'Notice what makes you say yes to something new.',
      'Notice what makes you say no.',
    ],
  }),
  mixedIdea('ftw_openness_m_03', 'openness', {
    focus: [
      'When you have a routine, you tend to like it until it starts to feel flat.',
      'You usually enjoy a steady week, with the occasional break from it.',
      'Your routines tend to feel comfortable for a while and then a little dull.',
    ],
    why: 'Enjoying both steadiness and change means you can adapt, but you may wait too long to change something that’s gone stale.',
    try: [
      'Change one small thing in your week when it starts to feel flat, so it stays fresh.',
      'Keep one routine you love untouched, so you have something steady while you change others.',
    ],
    watch: [
      'Notice how long it takes before a routine starts to feel flat.',
      'Notice which routines you’d keep forever.',
    ],
  }),
  // --- Follow-through (conscientiousness)
  mixedIdea('ftw_conscientiousness_m_01', 'conscientiousness', {
    focus: [
      'You follow through well on some things and let others slide, depending on how much they matter to you.',
      'When a task matters to you, you tend to finish it, and when it doesn’t, you tend to put it off.',
      'Your follow-through tends to be strong for work you care about and weaker for chores.',
    ],
    why: 'Putting your effort where it matters is sensible, but small things you let slide can add up and nag at you.',
    try: [
      'Pick one small task you’ve skipped and do it today, so it stops nagging at you.',
      'Write down which tasks matter most to you, so you protect your energy for them.',
    ],
    watch: [
      'Notice which tasks you finish every time and which you put off.',
      'Notice what the two groups have in common.',
    ],
  }),
  mixedIdea('ftw_conscientiousness_m_02', 'conscientiousness', {
    focus: [
      'When you plan your week, you tend to plan some days closely and leave others open.',
      'You usually like some structure, with room to change it.',
      'You tend to keep a loose plan that you adjust as the week goes on.',
    ],
    why: 'A flexible plan fits your life, but without a few fixed points, important things can get squeezed out.',
    try: [
      'Pick two things that must happen this week and give them a time, so the rest can stay loose.',
      'Look at Friday’s plan on Thursday night, so there’s time to adjust it.',
    ],
    watch: [
      'Notice which things you plan and which you leave open.',
      'Notice what gets squeezed out when the week is busy.',
    ],
  }),
  mixedIdea('ftw_conscientiousness_m_03', 'conscientiousness', {
    focus: [
      'When a deadline is coming, you tend to start sooner for big things and later for small ones.',
      'You usually manage deadlines well, though you sometimes leave a few for the last moment.',
      'Your work habits tend to change with the kind of task in front of you.',
    ],
    why: 'Adapting to the task works for you, but a small task left late can still cause stress for you.',
    try: [
      'Do one small task right when you get it, so it doesn’t wait for the deadline.',
      'Put one deadline on your calendar a day early, so you have a cushion.',
    ],
    watch: [
      'Notice which tasks you start early and which you leave.',
      'Notice how you feel the day before a deadline.',
    ],
  }),
  // --- Sociability (extraversion)
  mixedIdea('ftw_extraversion_m_01', 'extraversion', {
    focus: [
      'After time with people, you tend to feel good for a while and then want some time alone.',
      'You usually enjoy social plans, and you also need quiet time to feel like yourself.',
      'Some weeks you want lots of company, and other weeks you want very little.',
    ],
    why: 'Needing both is normal, but friends and family may not know which week you’ll be in.',
    try: [
      'Tell a friend whether you’re in a social week or a quiet week, so they know what to expect.',
      'Plan one social night and one quiet night this week, so you get both.',
    ],
    watch: [
      'Notice what tells you that you’re ready for company.',
      'Notice what tells you that you’re ready for quiet.',
    ],
  }),
  mixedIdea('ftw_extraversion_m_02', 'extraversion', {
    focus: [
      'In a group, you tend to talk more when you know the people and less when you don’t.',
      'You usually warm up after the first half hour at an event.',
      'Your social energy tends to depend on who is in the room.',
    ],
    why: 'Warming up with the right people is natural, but others may only meet your quieter side if they see you in the first half hour.',
    try: [
      'Say one thing to someone new in the first ten minutes, so the warm-up starts early.',
      'Sit near the person you know best at an event at first, so you ease in.',
    ],
    watch: [
      'Notice how long it takes before you feel at ease.',
      'Notice which people help you open up.',
    ],
  }),
  mixedIdea('ftw_extraversion_m_03', 'extraversion', {
    focus: [
      'When you need to think something through, you tend to switch between talking it out and working it out alone.',
      'You usually pick the way you process based on how big the problem is.',
      'Sometimes you call a friend about a problem, and sometimes you want to think first.',
    ],
    why: 'Using both ways gives you options, but you may call a friend when quiet time would help, or the other way around.',
    try: [
      'Ask yourself “talk or think?” before you reach for the phone, so you pick on purpose.',
      'Give a problem ten quiet minutes before you talk to anyone, so you know what you want to say.',
    ],
    watch: [
      'Notice which way helps you more for different problems.',
      'Notice how you feel after each.',
    ],
  }),
  // --- Harmony (agreeableness)
  mixedIdea('ftw_agreeableness_m_01', 'agreeableness', {
    focus: [
      'You go along with others on small things and speak up on the ones that matter to you.',
      'When you disagree, you tend to pick your moments.',
      'You usually keep the peace, unless something feels really important.',
    ],
    why: 'Picking your moments keeps things smooth, but others may not know which ones matter until you say so.',
    try: [
      'Tell a friend one thing that matters to you before it comes up, so they know.',
      'Say “this one matters to me” the next time it does, so your voice stands out.',
    ],
    watch: [
      'Notice which things you go along with and which you don’t.',
      'Notice how people react when you speak up.',
    ],
  }),
  mixedIdea('ftw_agreeableness_m_02', 'agreeableness', {
    focus: [
      'When you give feedback, you tend to be honest with people you know well and softer with those you don’t.',
      'You usually adjust how direct you are depending on the person.',
      'Your honesty tends to rise with how close you are to someone.',
    ],
    why: 'Matching your tone to the person shows care, but a soft message can hide the point from someone who needs it plainly.',
    try: [
      'Write down the main point before you soften it, so it stays in your message.',
      'Ask the person “do you want it straight?” before you give feedback, so you match what they prefer.',
    ],
    watch: [
      'Notice who gets your plain version and who gets the soft one.',
      'Notice whether the soft version gets understood.',
    ],
  }),
  mixedIdea('ftw_agreeableness_m_03', 'agreeableness', {
    focus: [
      'When someone asks for a favor, you tend to say yes if you can and no if you can’t.',
      'You usually help others and also protect your own time.',
      'Your answers to requests tend to depend on how full your week is.',
    ],
    why: 'Balancing helping with your own time is healthy, but it’s easy to say yes first and check your week second.',
    try: [
      'Check your calendar before you answer the next request, so your yes fits.',
      'Say “not this week, but maybe next” once, so a no can come with a way forward.',
    ],
    watch: [
      'Notice how you feel after you say yes when you’re already busy.',
      'Notice how people take it when you say no kindly.',
    ],
  }),
  // --- Composure (steadiness)
  mixedIdea('ftw_steadiness_m_01', 'steadiness', {
    focus: [
      'Some stressful things roll off you, and others stay with you for days.',
      'You usually handle small problems calmly, but a big one can shake you.',
      'Your reaction to stress tends to depend on how much sleep and time you have.',
    ],
    why: 'Handling most things well while feeling a few deeply is common, but you may not see which ones will stick until they do.',
    try: [
      'Write down after a stressful event whether it passed or stayed, so you learn your own pattern.',
      'Plan some rest after a big event, so it has less room to stay with you.',
    ],
    watch: [
      'Notice what kinds of things stay with you.',
      'Notice what helps them pass.',
    ],
  }),
  mixedIdea('ftw_steadiness_m_02', 'steadiness', {
    focus: [
      'When someone around you is upset, you tend to stay calm sometimes and feel it too at other times.',
      'You usually pick up on other people’s moods, but not always in the same way.',
      'Your reaction to a friend’s bad mood tends to depend on your own day.',
    ],
    why: 'Being able to do both helps you support people, but on a hard day you may take on more of their mood than you mean to.',
    try: [
      'Check in with yourself before you help someone upset, so you know how much you have to give.',
      'Take a few minutes alone after a heavy talk, so you can reset.',
    ],
    watch: [
      'Notice when you take on someone else’s mood.',
      'Notice what helps you stay steady.',
    ],
  }),
  mixedIdea('ftw_steadiness_m_03', 'steadiness', {
    focus: [
      'When you get critical feedback, you tend to feel it at first and then think it over.',
      'You usually need a little time before you can hear feedback clearly.',
      'Your first reaction to criticism tends to be stronger than your second.',
    ],
    why: 'Feeling it first and thinking second is a fair order, but replying in the first moment can lead to words you’d change.',
    try: [
      'Wait an hour before you reply to critical feedback, so your second reaction answers.',
      'Write down the useful part of the feedback, so you keep it when the sting fades.',
    ],
    watch: [
      'Notice how your view of the feedback changes after an hour.',
      'Notice which feedback turns out to be useful.',
    ],
  }),
  // --- Reassurance (attachment_anxiety)
  mixedIdea('ftw_attachment_anxiety_m_01', 'attachment_anxiety', {
    focus: [
      'Sometimes a slow reply from a friend doesn’t bother you, and other times you wonder about it.',
      'When someone close is quiet, you tend to worry on some days and not on others.',
      'Your feelings about where you stand with people tend to change with how your week is going.',
    ],
    why: 'Feeling secure on some days and unsure on others is common, and for you it may follow stress more than the relationship itself.',
    try: [
      'Ask yourself “is this about them or about my day?” when you feel unsure, so you check the source.',
      'Do something absorbing while you wait for a reply, so waiting takes less of your attention.',
    ],
    watch: [
      'Notice what kind of day makes you feel less sure of people.',
      'Notice what helps you feel steady again.',
    ],
  }),
  mixedIdea('ftw_attachment_anxiety_m_02', 'attachment_anxiety', {
    focus: [
      'After an argument with someone close, you tend to feel okay with some people and worried with others.',
      'You usually trust some relationships more than others.',
      'Your sense of security tends to depend on how long you’ve known the person.',
    ],
    why: 'Feeling secure grows with time and history, so you may feel it more in older relationships than in newer ones.',
    try: [
      'Share one small thing with a newer friend this week, so trust has something to grow from.',
      'Name one good moment with someone before you worry, so you start from what’s real.',
    ],
    watch: [
      'Notice which relationships feel most secure and what they have in common.',
      'Notice how a newer friend responds when you open up.',
    ],
  }),
  mixedIdea('ftw_attachment_anxiety_m_03', 'attachment_anxiety', {
    focus: [
      'You like to hear from people you care about, and you can also go a few days without it.',
      'When a friend cancels, you tend to be fine some of the time and bothered the rest.',
      'Your need for contact tends to rise when you’re stressed and fall when you’re busy.',
    ],
    why: 'A flexible need for contact is healthy, but it can be hard for others to guess when you want more of it.',
    try: [
      'Tell a close friend “I’d love to hear from you this week,” so you ask for what you want.',
      'Plan a regular check-in with someone you care about, so contact doesn’t depend on your mood.',
    ],
    watch: [
      'Notice when you want more contact than usual.',
      'Notice when you want less.',
    ],
  }),
  // --- Personal space (attachment_avoidance)
  mixedIdea('ftw_attachment_avoidance_m_01', 'attachment_avoidance', {
    focus: [
      'You like being close to people, and you also need some time on your own.',
      'Some days you want to share everything, and other days you keep to yourself.',
      'Your need for closeness tends to shift with how much you have going on.',
    ],
    why: 'Wanting both closeness and space is common, but the people near you can’t tell which one you want unless you say.',
    try: [
      'Tell someone close what you need today, like “I’d love company” or “I need a quiet evening,” so they know.',
      'Plan one evening together and one evening alone this week, so you get both.',
    ],
    watch: [
      'Notice what tells you that you need space.',
      'Notice what tells you that you need company.',
    ],
  }),
  mixedIdea('ftw_attachment_avoidance_m_02', 'attachment_avoidance', {
    focus: [
      'When something is bothering you, you tend to tell some people and keep it from others.',
      'You usually share hard things with one or two people and not with everyone.',
      'Your willingness to open up tends to depend on who is asking and when.',
    ],
    why: 'Choosing who to open up to is wise, but a few people may feel shut out if you don’t say why.',
    try: [
      'Tell the people you trust most that they’re on your short list, so they know where they stand.',
      'Share one small worry with someone new, so you test whether they can hold it.',
    ],
    watch: [
      'Notice who you tell first.',
      'Notice who you hold things back from and why.',
    ],
  }),
  mixedIdea('ftw_attachment_avoidance_m_03', 'attachment_avoidance', {
    focus: [
      'When a relationship gets closer, you tend to enjoy it and also feel a pull to step back sometimes.',
      'You usually like affection, but not at every moment.',
      'Your comfort with closeness tends to rise and fall during the week.',
    ],
    why: 'Wanting some distance now and then is normal, but a partner or friend may wonder if your step back means something.',
    try: [
      'Say “I’m just recharging, and I’m still here,” when you need a step back, so it doesn’t sound like a pullback.',
      'Plan a warm moment together after your quiet time, so closeness comes back easily.',
    ],
    watch: [
      'Notice what brings on the urge to step back.',
      'Notice how the other person feels when you explain it.',
    ],
  }),
  // --- Directness (conflict_assertiveness)
  mixedIdea('ftw_conflict_assertiveness_m_01', 'conflict_assertiveness', {
    focus: [
      'You speak up about some things right away and let others go, depending on the person.',
      'When you disagree with someone, you tend to speak more freely with friends than with your boss.',
      'Your directness tends to depend on how much is at stake and who is there.',
    ],
    why: 'Choosing when to speak up helps you pick your battles, but you may stay quiet in places where your view would help.',
    try: [
      'Share one honest opinion this week in a place where you usually hold back, so your voice reaches more rooms.',
      'Ask yourself “will I still care about this tomorrow?” before you decide to speak up or let go.',
    ],
    watch: [
      'Notice where you speak freely and where you hold back.',
      'Notice what changes in the places you hold back.',
    ],
  }),
  mixedIdea('ftw_conflict_assertiveness_m_02', 'conflict_assertiveness', {
    focus: [
      'When someone does something that bothers you, you tend to tell them sometimes and drop it other times.',
      'You usually bring up bigger issues and let small ones slide.',
      'Your choice to raise a problem tends to depend on how often it happens.',
    ],
    why: 'Letting small things go keeps the peace, but a small thing that repeats can build up in you and come out later.',
    try: [
      'Keep a note of small things that repeat, so you can tell which ones to raise.',
      'Say one repeated small thing out loud, calmly, this week, so it doesn’t build.',
    ],
    watch: [
      'Notice which small things repeat.',
      'Notice how you feel about them after a week.',
    ],
  }),
  mixedIdea('ftw_conflict_assertiveness_m_03', 'conflict_assertiveness', {
    focus: [
      'When you want something, you tend to ask directly sometimes and hint at it other times.',
      'You usually say what you need when you feel comfortable and hold back when you don’t.',
      'Your way of asking tends to change with how safe the situation feels.',
    ],
    why: 'Adjusting how you ask is natural, but hints can be missed, and a missed hint can leave you without what you wanted.',
    try: [
      'Turn one hint into a plain request today, so you see how it lands.',
      'Say what you want in one sentence with a reason, so your request is easy to say yes to.',
    ],
    watch: [
      'Notice when you hint and when you ask.',
      'Notice how often a hint gets missed.',
    ],
  }),
  // --- Compromise (conflict_cooperativeness)
  mixedIdea('ftw_conflict_cooperativeness_m_01', 'conflict_cooperativeness', {
    focus: [
      'In a disagreement, you tend to give way on some things and hold firm on others.',
      'You usually find a middle ground, unless the point matters a lot to you.',
      'Your willingness to compromise tends to depend on what is at stake.',
    ],
    why: 'Knowing when to give and when to hold is a skill, but the people you disagree with may not see where your line is.',
    try: [
      'Tell the other person which part matters most to you, so the rest is easier to settle.',
      'Write down your must-have before a disagreement, so you know where to hold.',
    ],
    watch: [
      'Notice what you’re willing to give up easily.',
      'Notice what you won’t give up.',
    ],
  }),
  mixedIdea('ftw_conflict_cooperativeness_m_02', 'conflict_cooperativeness', {
    focus: [
      'When a group has to decide, you tend to go along with it sometimes and push your idea at other times.',
      'You usually listen first and then decide if your idea is worth sharing.',
      'Your role in group decisions tends to change from one group to the next.',
    ],
    why: 'Switching between following and leading helps groups, but you might not notice which role you’re taking at the time.',
    try: [
      'Ask yourself “am I leading or following here?” at the start of a group talk, so you choose.',
      'Share your idea in the first few minutes of one meeting this week, so you try the other role.',
    ],
    watch: [
      'Notice when you lead and when you follow.',
      'Notice what decides it.',
    ],
  }),
  mixedIdea('ftw_conflict_cooperativeness_m_03', 'conflict_cooperativeness', {
    focus: [
      'When a friend wants something different from you, you tend to look for a way to do both.',
      'You usually try to make sure each person gets something.',
      'Your approach to a disagreement tends to be to trade a little for a little.',
    ],
    why: 'Trading a little for a little keeps things fair, but it can miss a better idea that neither of you thought of.',
    try: [
      'Ask the other person what they’re really after, so you look beyond the trade.',
      'Ask for one new option together before you split the difference, so you find something better.',
    ],
    watch: [
      'Notice whether a trade left both of you happy.',
      'Notice when a new idea would have helped.',
    ],
  }),
  // --- Independence (autonomy)
  mixedIdea('ftw_autonomy_m_01', 'autonomy', {
    focus: [
      'You like making your own decisions, and you also like having someone to check with.',
      'When you face a choice, you tend to decide for yourself on small things and ask others on big ones.',
      'Your need for independence tends to depend on how important the choice is.',
    ],
    why: 'Balancing your own judgment with other views is a strength, but you may ask for input out of habit and not need.',
    try: [
      'Decide first, then ask for a view, so you hear it against your own choice.',
      'Skip checking with anyone on one small decision, so you see how it feels.',
    ],
    watch: [
      'Notice which choices you check with others.',
      'Notice whether their view changes your mind.',
    ],
  }),
  mixedIdea('ftw_autonomy_m_02', 'autonomy', {
    focus: [
      'At work, you tend to like having some direction and some freedom.',
      'You usually do well with a clear goal and room to decide how to get there.',
      'Your best work tends to come when someone sets the target and leaves the path to you.',
    ],
    why: 'Knowing what suits you helps you ask for it, but a boss or team may not know unless you tell them.',
    try: [
      'Ask your boss for a clear goal and say you’ll pick the method, so you get the mix you like.',
      'Tell a teammate what kind of direction helps you most, so they can give it.',
    ],
    watch: [
      'Notice when too much direction feels tight.',
      'Notice when too little leaves you stuck.',
    ],
  }),
  mixedIdea('ftw_autonomy_m_03', 'autonomy', {
    focus: [
      'When someone gives you advice, you tend to take some of it and leave the rest.',
      'You usually listen to others and then make up your own mind.',
      'Your reaction to advice tends to depend on who gives it and how.',
    ],
    why: 'Taking what helps and leaving the rest is a good habit, but the person may want to know what you decided.',
    try: [
      'Tell the person which part of their advice you used, so they feel heard.',
      'Say “thanks, I’m going to try part of that,” so you honor their effort without taking it all.',
    ],
    watch: [
      'Notice whose advice you tend to take.',
      'Notice what makes advice easier to hear.',
    ],
  }),
  // --- Confidence (competence)
  mixedIdea('ftw_competence_m_01', 'competence', {
    focus: [
      'You feel sure of yourself in some areas and less sure in others.',
      'When a task is in a field you know, you tend to feel capable, and when it’s new, you tend to feel unsure.',
      'Your confidence tends to follow how much experience you have with the task.',
    ],
    why: 'Confidence that follows experience is realistic, but doubt in new areas can keep you from starting them.',
    try: [
      'Look back at a time you learned something new before you start another, so you borrow that feeling.',
      'Start a new task with the part that looks like something you know, so you build from there.',
    ],
    watch: [
      'Notice which areas make you feel capable.',
      'Notice how that feeling grows with practice.',
    ],
  }),
  mixedIdea('ftw_competence_m_02', 'competence', {
    focus: [
      'When you finish a piece of work, you tend to feel good about it on some days and doubt it on others.',
      'You usually feel okay about your work until someone else looks at it.',
      'Your view of your own work tends to swing with your mood.',
    ],
    why: 'Judging your own work depends a lot on your mood, so a second look on a calmer day often gives a fairer view.',
    try: [
      'Look at your work again the next day before you judge it, so your mood doesn’t decide.',
      'Ask one person for a view, so you have more than your mood to go on.',
    ],
    watch: [
      'Notice how your opinion of the same work changes from day to day.',
      'Notice what others say about it.',
    ],
  }),
  mixedIdea('ftw_competence_m_03', 'competence', {
    focus: [
      'When someone asks for volunteers, you tend to step up for some things and wait on others.',
      'You usually volunteer when you know the task and hold back when you don’t.',
      'Your readiness to take on challenges tends to depend on how much support you’ll have.',
    ],
    why: 'Taking on what you can handle is smart, but you can miss chances to grow if you only pick what you know.',
    try: [
      'Volunteer for a small stretch task with a person you trust, so you grow with support.',
      'Ask what help is available before you decide, so you know the risk.',
    ],
    watch: [
      'Notice which tasks you pick up fast.',
      'Notice which ones you wait on and why.',
    ],
  }),
  // --- Connection (relatedness)
  mixedIdea('ftw_relatedness_m_01', 'relatedness', {
    focus: [
      'You enjoy spending time with people, and you also enjoy time on your own.',
      'Some weekends you want to be out with friends, and others you want to stay in.',
      'Your need for company tends to move with the week you’ve had.',
    ],
    why: 'Enjoying both is a good balance, but friends may not know which version of you to expect.',
    try: [
      'Tell a friend what you’re in the mood for before they invite you, so you get what fits.',
      'Plan the weekend so it has both a social part and a quiet part, so you don’t have to choose.',
    ],
    watch: [
      'Notice what makes you want company.',
      'Notice what makes you want to stay in.',
    ],
  }),
  mixedIdea('ftw_relatedness_m_02', 'relatedness', {
    focus: [
      'You care about your close friends and keep up with them, but you don’t need constant contact.',
      'When you haven’t talked in a while, you tend to miss them a little and pick up easily.',
      'Your friendships tend to run on a steady pace, with gaps now and then.',
    ],
    why: 'A steady pace suits many friendships, but a long gap can feel different to a friend than it does to you.',
    try: [
      'Send a short message to a friend you haven’t talked to in a month, so the gap doesn’t grow.',
      'Set a rough rhythm with your closest friends, like a call every few weeks, so no one drifts.',
    ],
    watch: [
      'Notice who you would like to hear from.',
      'Notice who might be waiting to hear from you.',
    ],
  }),
  mixedIdea('ftw_relatedness_m_03', 'relatedness', {
    focus: [
      'At work, you tend to enjoy team time sometimes and prefer to focus alone at others.',
      'You usually like a mix of working with people and working by yourself.',
      'Your best days at work tend to have some contact and some quiet.',
    ],
    why: 'Knowing your mix helps you plan better days, but a schedule you don’t control can tip it too far one way.',
    try: [
      'Block one stretch for solo work and one for team time in your day, so you get both.',
      'Tell your team when you’re in focus mode, so they can find you after.',
    ],
    watch: [
      'Notice which part of the day suits quiet and which suits people.',
      'Notice how you feel when the mix is off.',
    ],
  }),
  // --- Growth (growth_mindset)
  mixedIdea('ftw_growth_mindset_m_01', 'growth_mindset', {
    focus: [
      'You like learning in some areas and prefer to stay with what you know in others.',
      'When it comes to skills you care about, you tend to keep working at them.',
      'Your drive to improve tends to depend on how much the skill matters to you.',
    ],
    why: 'Putting your effort where it matters makes sense, but a skill you wrote off may have been easier to build than you thought.',
    try: [
      'Pick one skill you’ve skipped and spend an hour on it, so you test whether it’s harder than you think.',
      'Ask a friend which skill they think you’d enjoy, so you get a fresh idea.',
    ],
    watch: [
      'Notice which areas you want to improve in.',
      'Notice which ones you’ve decided are not for you.',
    ],
  }),
  mixedIdea('ftw_growth_mindset_m_02', 'growth_mindset', {
    focus: [
      'When you make a mistake, you tend to learn from it on some days and feel stuck on others.',
      'You usually take feedback well when you’re rested and harder when you’re not.',
      'Your reaction to a setback tends to depend on your energy.',
    ],
    why: 'How you handle setbacks depends on your energy, so the same mistake can feel like a lesson one day and a failure the next.',
    try: [
      'Wait for a good day to review a mistake, so you learn from it with a clear head.',
      'Take some rest before you read hard feedback, so you take in more of it.',
    ],
    watch: [
      'Notice how you react to a mistake when you’re tired.',
      'Notice how you react when you’re rested.',
    ],
  }),
  mixedIdea('ftw_growth_mindset_m_03', 'growth_mindset', {
    focus: [
      'You enjoy a new challenge when you have time for it, and you stick to what you know when you’re busy.',
      'When life is full, you tend to protect your routine.',
      'Your interest in trying new things tends to move with how much space you have.',
    ],
    why: 'Protecting your routine when you’re stretched is fair, but you may wait for a calm moment that doesn’t come.',
    try: [
      'Pick a tiny new thing that takes ten minutes, so growth fits even a full week.',
      'Put one learning slot in your calendar each month, so it doesn’t depend on a quiet week.',
    ],
    watch: [
      'Notice when you have space for something new.',
      'Notice what fills that space instead.',
    ],
  }),
  // --- Ownership (locus_of_control)
  mixedIdea('ftw_locus_of_control_m_01', 'locus_of_control', {
    focus: [
      'When something goes wrong, you tend to look at your part sometimes and at the situation other times.',
      'You usually see both your choices and your circumstances in how things turn out.',
      'Your view of what caused a problem tends to change with the problem.',
    ],
    why: 'Seeing both your part and the situation is a balanced view, but on a hard day you may lean too far toward blaming yourself or the situation.',
    try: [
      'List a problem’s parts as “mine,” “theirs” and “luck” on paper, so you see the whole picture.',
      'Ask a friend how they see it, so you hear a third view.',
    ],
    watch: [
      'Notice which way you lean when you’re tired.',
      'Notice which way you lean when you’re calm.',
    ],
  }),
  mixedIdea('ftw_locus_of_control_m_02', 'locus_of_control', {
    focus: [
      'When you set a goal, you tend to work on it and also expect that some things are out of your control.',
      'You usually put in effort and accept that results aren’t guaranteed.',
      'Your sense of control tends to be strong for your actions and loose for outcomes.',
    ],
    why: 'Focusing on effort while accepting uncertainty is a steady stance, but it can help to check your progress now and then.',
    try: [
      'Set a small check-in date for each goal, so you see how your effort is paying off.',
      'Write down what you can control about a goal, so your effort goes there.',
    ],
    watch: [
      'Notice what parts of a goal you can control.',
      'Notice how you feel about the parts you can’t.',
    ],
  }),
  mixedIdea('ftw_locus_of_control_m_03', 'locus_of_control', {
    focus: [
      'When things go well, you tend to give credit to both your effort and some luck.',
      'You usually say a win came from work and good timing.',
      'Your explanation of a success tends to include other people and circumstances.',
    ],
    why: 'Crediting both effort and luck keeps you fair, but you can undersell what you did if you lean on luck too much.',
    try: [
      'Name one thing you did that made the win happen, so your part is clear.',
      'Thank someone who helped, so their part is clear too.',
    ],
    watch: [
      'Notice how you explain your last win.',
      'Notice which part you leave out.',
    ],
  }),
  // --- Self-belief (self_efficacy)
  mixedIdea('ftw_self_efficacy_m_01', 'self_efficacy', {
    focus: [
      'When something new comes up, you tend to feel ready for some things and unsure about others.',
      'You usually say yes to challenges that fit your skills and think twice about the rest.',
      'Your belief that you can handle something tends to depend on how well you know it.',
    ],
    why: 'Knowing when to say yes keeps you safe, but thinking twice every time can slow you down on things you could do.',
    try: [
      'Say yes to one challenge that feels a little beyond your skills, so you test your limits.',
      'Ask someone who knows the task what it takes, so you judge it with facts.',
    ],
    watch: [
      'Notice which challenges you say yes to quickly.',
      'Notice which ones you think twice about.',
    ],
  }),
  mixedIdea('ftw_self_efficacy_m_02', 'self_efficacy', {
    focus: [
      'When you start a hard task, you tend to feel confident some days and doubtful on others.',
      'You usually begin well and then wonder halfway whether you can finish.',
      'Your belief in yourself tends to dip in the middle of a project.',
    ],
    why: 'A dip in the middle is common for many people, and it often passes if you keep going.',
    try: [
      'Write “this is the dip” on a note when you start, so you recognize it when it comes.',
      'Do one small step on the day you doubt, so the doubt doesn’t decide for you.',
    ],
    watch: [
      'Notice where in a project your confidence drops.',
      'Notice what helps you keep going.',
    ],
  }),
  mixedIdea('ftw_self_efficacy_m_03', 'self_efficacy', {
    focus: [
      'When you succeed, you tend to count it as a win some of the time and call it luck at other times.',
      'You usually believe in yourself more after a good week than after a bad one.',
      'Your confidence tends to follow your recent results.',
    ],
    why: 'Confidence that follows results is normal, but one rough week doesn’t change what you’re able to do.',
    try: [
      'Keep a list of things you handled well, so a bad week has a record to answer it.',
      'Look at the last three months, not the last three days, when you judge yourself.',
    ],
    watch: [
      'Notice how your confidence changes after a bad day.',
      'Notice how long it takes to come back.',
    ],
  }),
  // --- Play (playfulness)
  mixedIdea('ftw_playfulness_m_01', 'playfulness', {
    focus: [
      'You enjoy joking around with some people and keep a more serious side with others.',
      'Your sense of humor tends to come out more with friends than at work.',
      'You usually match the mood of the room, silly when it’s silly and serious when it isn’t.',
    ],
    why: 'Matching the room shows you’re paying attention, but people who only see one side may not know the other.',
    try: [
      'Share a little of your funny side with a coworker this week, so they know you.',
      'Share something serious with a friend you usually joke with, so they know that side too.',
    ],
    watch: [
      'Notice where your humor comes out most.',
      'Notice where you keep it back.',
    ],
  }),
  mixedIdea('ftw_playfulness_m_02', 'playfulness', {
    focus: [
      'When you have free time, you tend to choose fun some days and something useful on others.',
      'You usually like to get things done before you play, but not always.',
      'Your free time tends to split between rest, play and tasks.',
    ],
    why: 'A mix of play and tasks gives you balance, but on a busy week play can slip off the list first.',
    try: [
      'Put one thing that’s just for fun on your calendar this week, so it has a spot.',
      'Finish one task early so you can play without it hanging over you.',
    ],
    watch: [
      'Notice which gets dropped first when you’re busy.',
      'Notice how you feel after a week with no play.',
    ],
  }),
  mixedIdea('ftw_playfulness_m_03', 'playfulness', {
    focus: [
      'When things go wrong, you tend to joke about it sometimes and take it seriously at other times.',
      'You usually know whether a moment needs a laugh or a plain answer.',
      'Your use of humor under stress tends to depend on how big the problem is.',
    ],
    why: 'Reading the moment lets you use humor well, but you might misjudge now and then and a joke may land badly.',
    try: [
      'Ask “is this a joke moment?” before you make one in a tense talk, so you read the room.',
      'Say sorry quickly if a joke lands badly, so the moment is repaired.',
    ],
    watch: [
      'Notice how your jokes land when things are tense.',
      'Notice which moments you’d rather you had stayed serious.',
    ],
  }),
];
