/** Personal space (attachment_avoidance): Private (high) and Close (low). Private on every share surface. */
import { idea, type InsightIdea } from './define';

export const ATTACHMENT_AVOIDANCE_IDEAS: readonly InsightIdea[] = [
  idea('ftw_attachment_avoidance_h_01', ['attachment_avoidance:high'], {
    focus: [
      'After a very close weekend, you usually want a night at home with the door shut.',
      'You can love someone and still need the couch to yourself before the week starts again.',
      'A plan to spend every evening together can leave you feeling crowded in your own kitchen.',
    ],
    why: 'A night alone is something you need, but a partner might read the closed door as distance unless you say what it is.',
    try: [
      'Tell your partner when you need the evening alone, so they don’t take the closed door personally.',
      'Plan that alone time on the calendar, so the people close to you know when you’ll be back.',
    ],
    watch: [
      'Notice when you pull back right after a very close day.',
      'Notice how people respond once you say you need the evening.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_02', ['attachment_avoidance:high'], {
    focus: [
      'A friend asks how you’re really doing, and you usually say you’re fine and switch the topic.',
      'Even with people you trust, a hard feeling can stay in your notes app instead of the chat.',
      'When something is hard, you usually deal with it on your own before you tell anyone at all.',
    ],
    why: 'Handling it yourself can feel safer, but people who care might want a chance to help before you’ve already finished it.',
    try: [
      'Tell one person one small thing that’s been on your mind, so sharing starts with a single sentence.',
      'Answer the next “how are you” with one honest detail, so the conversation can go past fine.',
    ],
    watch: [
      'Notice when “fine” comes out before you’ve decided to say it.',
      'Notice how you feel once you do share one real detail.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_03', ['attachment_avoidance:high'], {
    focus: [
      'A hard week at work usually has you figuring it out alone, even when a friend offered to help.',
      'You can have a problem sitting in your inbox and still not ask, because you’d rather solve it yourself.',
      'When the task list gets too long, you usually push through alone instead of saying it’s too much.',
    ],
    why: 'Getting through a hard week alone is a real skill, but a bit of help can make the same list lighter for you.',
    try: [
      'Ask one person for help with something small this week, so asking starts with one easy task.',
      'Text a friend about one hard thing you’re handling, so they know what’s on your list.',
    ],
    watch: [
      'Notice when you turn down help you could actually use on the list.',
      'Notice how people react the next time you do ask.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_04', ['attachment_avoidance:high'], {
    focus: [
      'A partner brings up next year, and you can feel uneasy enough to change the subject at the table.',
      'Future talk over dinner usually has you steering back to this weekend instead.',
      'Someone asks where the relationship is going, and you usually want more time before you answer.',
    ],
    why: 'Taking your time on big steps protects your space, but a partner may need to hear that you’re still thinking about it.',
    try: [
      'Tell your partner one outing you look forward to doing together, so they know you’re in it.',
      'Write down what feels uneasy about the future talk, so you can explain it when you’re ready.',
    ],
    watch: [
      'Notice when you change the subject during a serious dinner talk.',
      'Notice which future plans actually feel good once you picture them.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_05', ['attachment_avoidance:high'], {
    focus: [
      'A long hug or a very sweet text can leave you a bit uncomfortable, even from someone you care about.',
      'You usually show care by doing the thing, the ride, the errand, more than by saying it.',
      'A friend says something very emotional, and you can sit there unsure what to text back.',
    ],
    why: 'Doing the errand is real care, but the people close to you might also need to hear it in words.',
    try: [
      'Say one kind thing out loud to someone close today, so they hear what you usually only show.',
      'Send a short message telling a friend you appreciate them, so the words stay in the chat.',
    ],
    watch: [
      'Notice how you show love with a ride or an errand and not a sentence.',
      'Notice what you feel when someone says something kind straight to you.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_06', ['attachment_avoidance:high', 'autonomy:high'], {
    focus: [
      'Even in a relationship, you usually keep your own Saturday plan and your own way of doing the errand.',
      'Sharing a kitchen or a calendar, you usually still want to decide the small stuff yourself.',
      'You can be close with someone and still keep the routines that were yours before they moved in.',
    ],
    why: 'Keeping your own plans lets you keep your routines, but a partner might feel left out of a decision that affects them too.',
    try: [
      'Ask your partner or roommate for a view on one small decision, so they feel included.',
      'Tell someone close about a plan you made on your own, so they don’t find it on the calendar later.',
    ],
    watch: [
      'Notice when you book something that affects someone else without asking them.',
      'Notice whether people close to you hear about your plans before they happen.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_01', ['attachment_avoidance:low'], {
    focus: [
      'When you’re close to someone, you usually want to share the day and spend a lot of the evening together.',
      'A regular text from the people you love can be the part of the day you feel happiest about.',
      'Something happens on the bus, and you usually want to tell your partner or best friend right away.',
    ],
    why: 'Sharing your day makes people feel wanted, but someone who needs more space might feel crowded by the constant update.',
    try: [
      'Ask your partner or a close friend how much time together feels good, so you can match their week.',
      'Plan one thing you enjoy doing alone this week, so time apart has a shape you chose.',
    ],
    watch: [
      'Notice when someone close needs the evening to themselves.',
      'Notice how you feel during an evening apart.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_02', ['attachment_avoidance:low'], {
    focus: [
      'Something bothering you usually goes straight into a text to someone close, the same hour.',
      'With people you trust, you usually say the feeling out loud instead of sitting on it.',
      'A feeling shows up, and you can say it in the kitchen before you’ve had time to edit it.',
    ],
    why: 'Saying what you feel out loud builds closeness, but some friends might need a minute before they’re ready to share back.',
    try: [
      'Ask a friend how their day went before you share your news, so the talk goes both ways.',
      'Write the feeling in a note first, so you can choose which part to send.',
    ],
    watch: [
      'Notice whether the people you text share something back.',
      'Notice when someone seems unsure how to answer what you just said.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_03', ['attachment_avoidance:low'], {
    focus: [
      'A problem at home usually has you asking a friend or your family early, before you’ve tried it alone.',
      'On a packed week, you can feel fine texting a trusted friend to take one task.',
      'Stuck on a task, you usually reach out instead of sitting with it by yourself all evening.',
    ],
    why: 'Asking early can make a hard task lighter, and it lets a friend feel trusted when you help them back too.',
    try: [
      'Offer to help a friend with one thing this week, so the support goes both ways.',
      'Try one small problem on your own first, so you can see what you can finish alone.',
    ],
    watch: [
      'Notice how often you help the friends who helped you with a task.',
      'Notice which problems you could have solved from the couch without a text.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_04', ['attachment_avoidance:low'], {
    focus: [
      'When you care about someone, you usually show it with a hug, a kind text, and a lot of contact.',
      'You can say how you feel about people out loud, at the table, not only in your head.',
      'A friend does something kind, and you usually tell them the same day how much it meant.',
    ],
    why: 'Warmth out loud makes people feel loved, but some people you care about might be less comfortable with that much of it.',
    try: [
      'Ask a friend how they like care to show up, so your warmth reaches them the way they like.',
      'Send one friend a thank-you message today, so they know the help mattered.',
    ],
    watch: [
      'Notice who leans in when you show warmth and who steps back a little.',
      'Notice how each friend shows care back, in a text, a favor, or time.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_05', ['attachment_avoidance:low'], {
    focus: [
      'In a relationship, you usually enjoy talking about next month’s plans together over dinner.',
      'You can like putting long-term dates on a shared calendar with the people you’re close to.',
      'When things are going well, you usually want to talk about what’s next, not only tonight.',
    ],
    why: 'Planning the next month shows you’re in it, but a partner who moves slower might need more time to get there with you.',
    try: [
      'Ask your partner what they’re excited about right now, so the plan fits both of you.',
      'Pick one near-term plan to enjoy together, so the future talk doesn’t take the whole dinner.',
    ],
    watch: [
      'Notice when a partner goes quiet during a talk about next year.',
      'Notice how it feels to enjoy tonight without booking the next month.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_06', ['attachment_avoidance:low', 'relatedness:high'], {
    focus: [
      'Your best days usually have people close by and a real conversation, not only a busy calendar.',
      'With your friends or your partner in the room, you can feel more like yourself than you do alone.',
      'A week without a real talk can leave you flat, even if the work chat was full.',
    ],
    why: 'Closeness keeps your relationships strong, but a packed week with no real talk can leave you lonely anyway.',
    try: [
      'Text two friends to plan something this week, so you have a real conversation to look forward to.',
      'Call someone you love on a quiet evening, so the day ends with an actual voice.',
    ],
    watch: [
      'Notice how your mood shifts after a week with little real contact.',
      'Notice which people make you feel most like yourself in the room.',
    ],
  }),
];
