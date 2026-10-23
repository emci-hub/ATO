/** Playfulness (playfulness): Playful (high) and Serious (low). */
import { idea, type InsightIdea } from './define';

export const PLAYFULNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_playfulness_h_01', ['playfulness:high'], {
    focus: [
      'When things get tense, you tend to make a joke to lighten the mood.',
      'You usually use humor to ease awkward moments.',
      'When a meeting gets serious, you tend to look for something funny to say.',
    ],
    why: 'Humor helps people relax, but sometimes the people around you need the serious moment to stay serious.',
    try: [
      'Next time things get tense, wait a moment before joking, so people can say what they need.',
      'Ask a friend if they want to laugh or talk, so you match their mood.',
    ],
    watch: [
      'Notice when a joke changes the subject someone wanted to talk about.',
      'Notice when humor really helps.',
    ],
  }),
  idea('ftw_playfulness_h_02', ['playfulness:high'], {
    focus: [
      'When you have boring tasks, you tend to turn them into a game or add music.',
      'You usually find ways to make dull work more fun.',
      'When a task is boring, you tend to put it off until you find a way to make it fun.',
    ],
    why: 'Making things fun helps you get them done, but some tasks just need doing even when they’re dull.',
    try: [
      'Put on your favorite playlist and do one boring task now, so it gets done.',
      'Set a small reward for finishing a dull task, so you have something to look forward to.',
    ],
    watch: [
      'Notice which tasks you put off because they’re not fun.',
      'Notice how quickly boring tasks go once you start.',
    ],
  }),
  idea('ftw_playfulness_h_03', ['playfulness:high'], {
    focus: [
      'With your partner or close friends, you tend to tease and joke around a lot.',
      'You usually show affection through jokes and playful teasing.',
      'When you’re close to someone, you tend to keep things light and fun.',
    ],
    why: 'Playfulness keeps relationships fun, but your teasing can sting on a day when someone feels low.',
    try: [
      'Ask your partner or a friend how their day was before joking around, so you read their mood.',
      'Tell someone one sincere thing you like about them today, so it isn’t all jokes.',
    ],
    watch: [
      'Notice when someone doesn’t laugh at your teasing.',
      'Notice how people react to a sincere comment from you.',
    ],
  }),
  idea('ftw_playfulness_h_04', ['playfulness:high'], {
    focus: [
      'When you have free time, you tend to look for something fun to do.',
      'You usually suggest fun plans when friends are bored.',
      'When the weekend comes, you tend to want a fun plan more than rest.',
    ],
    why: 'Your sense of fun brings people together, but rest matters for you too.',
    try: [
      'Leave one evening this week for rest, so you have energy for the fun.',
      'Text a friend a fun idea for the weekend, so the plan has a start.',
    ],
    watch: [
      'Notice when you’re tired but still looking for fun.',
      'Notice which fun plans leave you happiest.',
    ],
  }),
  idea('ftw_playfulness_h_05', ['playfulness:high'], {
    focus: [
      'When you make a mistake, you tend to laugh at yourself and move on.',
      'You usually don’t take yourself too seriously.',
      'When something embarrassing happens, you tend to joke about it.',
    ],
    why: 'Laughing at yourself makes you easy to be around, but some mistakes might still need a closer look.',
    try: [
      'Laugh at your next mistake, then write down one thing to try next time, so you learn from it.',
      'Ask a friend if they ever wish you were more serious, so you know how your humor lands.',
    ],
    watch: [
      'Notice when a joke covers up something that bothered you.',
      'Notice how laughing helps you move on.',
    ],
  }),
  idea('ftw_playfulness_h_06', ['playfulness:high', 'steadiness:high'], {
    focus: [
      'When things go wrong, you tend to stay calm and find something to laugh about.',
      'You usually handle stress with humor and a steady attitude.',
      'When others panic, you tend to stay relaxed and lighten the mood.',
    ],
    why: 'Your calm and humor help people feel safe, but someone stressed might need you to take it seriously first.',
    try: [
      'Ask a stressed friend what they need before joking, so they feel heard.',
      'Share one thing that does worry you with someone close, so they know your serious side.',
    ],
    watch: [
      'Notice when your calm makes someone feel unheard.',
      'Notice when your humor helps someone relax.',
    ],
  }),
  idea('ftw_playfulness_l_01', ['playfulness:low'], {
    focus: [
      'When there’s work to do, you tend to want to get it done before having fun.',
      'You usually prefer to focus and finish rather than joke around.',
      'When a group gets silly during work, you tend to want to get back on track.',
    ],
    why: 'Your focus gets things done, but a little fun can help your team work better together.',
    try: [
      'Join in on one joke at work this week, so coworkers see your lighter side.',
      'Take a ten-minute fun break after a big task, so you recharge.',
    ],
    watch: [
      'Notice how a little fun affects your team.',
      'Notice when you feel left out of the jokes.',
    ],
  }),
  idea('ftw_playfulness_l_02', ['playfulness:low'], {
    focus: [
      'When friends joke around, you tend to prefer steering the talk to something real.',
      'You usually enjoy serious conversations more than banter.',
      'When you talk with someone, you tend to want to get to the point.',
    ],
    why: 'Real conversations matter to you, but light chat can help others feel at ease before they open up.',
    try: [
      'Ask a friend about something fun in their week, so the talk starts light.',
      'Laugh at one joke today even if it’s small, so people see you enjoy them.',
    ],
    watch: [
      'Notice when light chat helps someone open up.',
      'Notice how you feel after a silly moment.',
    ],
  }),
  idea('ftw_playfulness_l_03', ['playfulness:low'], {
    focus: [
      'When you have free time, you tend to spend it on something useful.',
      'You usually feel better doing something productive than playing.',
      'When others suggest something silly, you tend to say you have things to do.',
    ],
    why: 'Being productive feels good to you, but play is a kind of rest that can recharge you too.',
    try: [
      'Do one thing just for fun today, so you get a real break.',
      'Say yes to one silly plan this month, so you give play a chance.',
    ],
    watch: [
      'Notice how you feel after doing something just for fun.',
      'Notice when being useful turns into skipping rest.',
    ],
  }),
  idea('ftw_playfulness_l_04', ['playfulness:low'], {
    focus: [
      'When something goes wrong, you tend to take it seriously instead of joking about it.',
      'You usually deal with problems directly, without jokes.',
      'When a partner jokes about a problem, you tend to want to talk about it properly.',
    ],
    why: 'Taking things seriously shows you care, but sometimes a little humor helps you and others cope.',
    try: [
      'Look for one funny thing about a small problem today, so it feels lighter.',
      'Ask your partner why they joke about problems, so you understand their way of coping.',
    ],
    watch: [
      'Notice when humor helps someone else feel better.',
      'Notice how heavy small problems feel when you treat each one as serious.',
    ],
  }),
  idea('ftw_playfulness_l_05', ['playfulness:low'], {
    focus: [
      'When you’re focused, people sometimes think you’re upset or unfriendly.',
      'You usually look serious when you’re concentrating, and others might misread it.',
      'When coworkers are joking, you tend to stay quiet, and some read it as disapproval.',
    ],
    why: 'Your serious look can just be focus, but people who don’t know you might read it differently.',
    try: [
      'Smile or say hi to a coworker today, so they see your friendly side.',
      'Tell a teammate that quiet means you’re focused, so they don’t misread it.',
    ],
    watch: [
      'Notice when someone seems unsure how to approach you.',
      'Notice how people react when you show a lighter side.',
    ],
  }),
  idea('ftw_playfulness_l_06', ['playfulness:low', 'conscientiousness:high'], {
    focus: [
      'When you have a goal, you tend to stay focused and leave fun for later.',
      'You usually finish your work before you allow yourself to relax.',
      'You tend to treat fun as something you earn after the work is done.',
    ],
    why: 'Your focus makes you reliable, but waiting to earn fun can mean you rarely get any.',
    try: [
      'Put one fun thing on your calendar this week, so it happens no matter what.',
      'Take a short fun break in the middle of your work, so you don’t wait until the end.',
    ],
    watch: [
      'Notice how often you actually get to the fun part.',
      'Notice how you feel after a break you didn’t earn.',
    ],
  }),
  idea('ftw_playfulness_h_07', ['playfulness:high'], {
    focus: [
      'When you text your friends, you tend to send memes, voice notes and silly nicknames.',
      'You usually keep group chats lively with jokes and running gags.',
      'When you talk to people you like, you tend to add a joke or a funny voice.',
    ],
    why: 'Humor keeps your friendships light, but a friend who is going through something may need a plain answer before the jokes.',
    try: [
      'Ask a friend how they really are before you start joking, so they know you’re listening.',
      'Send one sincere message this week, so your friends see your serious side too.',
    ],
    watch: [
      'Notice how friends reply when you’re serious.',
      'Notice whether a joke covers a feeling you’d rather skip.',
    ],
  }),
  idea('ftw_playfulness_h_08', ['playfulness:high'], {
    focus: [
      'When you’re in a serious meeting, you tend to want to lighten it with a joke.',
      'You usually find long formal events hard to sit through without a laugh.',
      'When a talk gets stiff, you tend to say something funny to loosen it.',
    ],
    why: 'A joke can ease tension, but the wrong moment can make you look like you aren’t taking the topic seriously.',
    try: [
      'Wait until the mood eases before you joke in a serious meeting, so it fits.',
      'Ask a question first in the meeting, so people see you take it seriously.',
    ],
    watch: [
      'Notice how people respond to your jokes in a formal setting.',
      'Notice who laughs and who looks away.',
    ],
  }),
  idea('ftw_playfulness_h_09', ['playfulness:high'], {
    focus: [
      'When you’re around kids or pets, you tend to join in the play instead of watching.',
      'You usually get down on the floor and play with them.',
      'When there is a game going on, you tend to jump in and get really into it.',
    ],
    why: 'Joining in is a gift to the people you play with, but a game you love can run longer than others want.',
    try: [
      'Ask the others if they want one more round before you start, so everyone enjoys it.',
      'Invite a friend who rarely plays to join something easy, so they feel included.',
    ],
    watch: [
      'Notice how the others look when a game goes long.',
      'Notice who comes alive when you play.',
    ],
  }),
  idea('ftw_playfulness_h_10', ['playfulness:high'], {
    focus: [
      'When a day feels heavy, you tend to look for something that makes you laugh.',
      'You usually watch something funny or call a funny friend when you’re down.',
      'When you’re stressed, you tend to turn to humor to feel better.',
    ],
    why: 'Humor is a good way to reset, but a feeling you only joke about may still be waiting for you later.',
    try: [
      'Spend five minutes writing down what is bothering you, then watch something funny, so you do both.',
      'Tell one friend what’s really going on, so the joke isn’t the only thing you share.',
    ],
    watch: [
      'Notice what you feel right after the laughter fades.',
      'Notice which feelings you tend to joke past.',
    ],
  }),
  idea('ftw_playfulness_h_11', ['playfulness:high'], {
    focus: [
      'When you plan a gift or a surprise, you tend to make it funny or creative.',
      'You usually put effort into a fun, odd detail that makes someone smile.',
      'When it’s someone’s birthday, you tend to think of a playful idea instead of a standard one.',
    ],
    why: 'Playful gifts show you know a person well, but some people prefer something simple and practical.',
    try: [
      'Ask yourself what the person would use or enjoy before you add the joke, so the gift fits them.',
      'Add a short, sincere note to a funny gift, so the thought comes through.',
    ],
    watch: [
      'Notice how people react to a joke gift compared with a practical one.',
      'Notice who values the sincere note most.',
    ],
  }),
  idea('ftw_playfulness_h_12', ['playfulness:high'], {
    focus: [
      'When you have a task you don’t like, you tend to find a way to make it fun or take a game break.',
      'You usually need some enjoyment mixed in to keep going on dull work.',
      'When a project is dry, you tend to lose focus unless there is something interesting in it.',
    ],
    why: 'Adding fun keeps you going, but too many breaks can stretch a short task into an afternoon.',
    try: [
      'Set a timer for 25 minutes of work, then take a short fun break, so the fun comes after progress.',
      'Pick one dull task and add a small reward, like a song or a snack, so it feels lighter.',
    ],
    watch: [
      'Notice how long your fun breaks last.',
      'Notice which tasks you can finish without a break.',
    ],
  }),
  idea('ftw_playfulness_l_07', ['playfulness:low'], {
    focus: [
      'When a friend suggests a silly game or activity, you tend to feel unsure about joining.',
      'You usually prefer a clear purpose for an activity, like a talk or a task.',
      'When the group starts playing, you tend to watch before you join in.',
    ],
    why: 'Wanting a point to what you do keeps you focused, but a silly game can also be a good way to feel closer to people.',
    try: [
      'Join the next game for just ten minutes, so you see how it feels once you’re in it.',
      'Tell the group you’ll watch the first round, so you can join when you’re ready.',
    ],
    watch: [
      'Notice whether you have fun once you’re in a game.',
      'Notice what holds you back at the start.',
    ],
  }),
  idea('ftw_playfulness_l_08', ['playfulness:low'], {
    focus: [
      'When someone tells a joke at a serious moment, you tend to find it out of place.',
      'You usually prefer to deal with a problem plainly and not with humor.',
      'When people laugh while a problem is still open, you tend to want to get back to it.',
    ],
    why: 'Taking things seriously shows you care about the outcome, but others may be using a joke to cope and not to dodge.',
    try: [
      'Ask a coworker what the joke helps them with, so you understand what it’s for.',
      'Smile at one joke today even if it isn’t your style, so the person feels received.',
    ],
    watch: [
      'Notice what a joke does for the people who tell it.',
      'Notice how the mood changes when you stay serious.',
    ],
  }),
  idea('ftw_playfulness_l_09', ['playfulness:low'], {
    focus: [
      'When you give or pick a gift, you tend to choose something useful.',
      'You usually go for a practical present over a funny or silly one.',
      'When you plan a party, you tend to focus on the logistics more than on games or themes.',
    ],
    why: 'Useful gifts show you pay attention to people’s needs, but a small playful touch can make them feel known in another way.',
    try: [
      'Add one small fun item to your next gift, so it has a little surprise in it.',
      'Ask a friend what would make them laugh, so you get a sense of what playful means to them.',
    ],
    watch: [
      'Notice how a fun detail changes how a gift lands.',
      'Notice what kind of humor you do enjoy.',
    ],
  }),
  idea('ftw_playfulness_l_10', ['playfulness:low'], {
    focus: [
      'When people tease you, you tend to take it seriously for a moment before you see it as a joke.',
      'You usually need a clear signal that someone is joking.',
      'When a friend uses sarcasm, you tend to wonder what they actually mean.',
    ],
    why: 'Wanting clarity keeps communication honest, but you may miss that a friend was showing affection.',
    try: [
      'Ask “are you joking?” when it’s unclear, so you don’t guess and feel bad.',
      'Tell a friend you prefer plain language, so they know how to talk to you.',
    ],
    watch: [
      'Notice which teasing feels friendly and which feels sharp.',
      'Notice how a friend reacts when you ask what they meant.',
    ],
  }),
  idea('ftw_playfulness_l_11', ['playfulness:low'], {
    focus: [
      'When you are on a trip or day off, you tend to plan activities that have a point.',
      'You usually pick things like sightseeing or projects over plain fun.',
      'When you have free time, you tend to feel better if you got something done during it.',
    ],
    why: 'Using your time well feels good, but fun with no goal is a kind of rest that your mind may need.',
    try: [
      'Plan one hour this weekend with no goal at all, so you try aimless fun.',
      'Pick something you enjoyed as a kid and do it once, so you remember how play feels.',
    ],
    watch: [
      'Notice whether you can enjoy something without a result.',
      'Notice how you feel after an hour of doing nothing useful.',
    ],
  }),
  idea('ftw_playfulness_l_12', ['playfulness:low'], {
    focus: [
      'When you are at work or in a meeting, you tend to keep your tone steady and professional.',
      'You usually save jokes for people you know well.',
      'When you meet new people, you tend to stay formal for a while.',
    ],
    why: 'A steady tone builds trust, but a little humor can help new people see that you’re warm.',
    try: [
      'Share one light, friendly comment with a new coworker this week, so they see your warmer side.',
      'Smile and say something about your weekend, so small talk starts easily.',
    ],
    watch: [
      'Notice how people respond when you show a bit of humor.',
      'Notice how long it takes before you relax around new people.',
    ],
  }),
];
