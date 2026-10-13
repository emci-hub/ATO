import type { CategoryId } from '@/lib/categories';
import type { StoryAngle } from '@/lib/ai-library/story';
import type { TraitLean } from '@/lib/traits';

import { dialogue, narrator } from './lines';
import { categoryCatalogName, leanPhraseFor } from './lean-phrases';
import type { JokePointer, StoryLine, StoryScript } from './types';

export interface TopicLeanPack {
  title: string;
  move: StoryLine[];
  punchline?: StoryLine[];
  reveal: string;
  otherWay: string;
  evidence: string;
  tip: string;
  jokeLight: JokePointer;
  jokeDark: JokePointer;
  jokeDarkSecondary?: JokePointer;
}

export interface TopicTemplate {
  id: string;
  occasion: string;
  star: true;
  setting: StoryAngle;
  categoryId: CategoryId;
  romance: boolean;
  settingTag: string;
  hook: StoryLine[];
  twist: StoryLine[];
  punchline: StoryLine[];
  next: string;
  leans: Record<TraitLean, TopicLeanPack>;
}

function pack(topic: TopicTemplate, lean: TraitLean): StoryScript {
  const side = topic.leans[lean];
  return {
    id: `topic_${topic.id}_${lean}`,
    topicId: topic.id,
    categoryId: topic.categoryId,
    setting: topic.setting,
    lean,
    title: side.title,
    settingTag: topic.settingTag,
    hook: topic.hook,
    twist: topic.twist,
    move: side.move,
    punchline: side.punchline ?? topic.punchline,
    next: topic.next,
    reveal: side.reveal,
    otherWay: side.otherWay,
    card6: {
      categoryName: categoryCatalogName(topic.categoryId),
      leanPhrase: leanPhraseFor(topic.categoryId, lean),
      evidence: side.evidence,
      tip: side.tip,
    },
    jokeLight: side.jokeLight,
    jokeDark: side.jokeDark,
    jokeDarkSecondary: side.jokeDarkSecondary,
    romance: topic.romance,
    source: 'template',
  };
}

export const STORY_STAR_TOPICS: readonly TopicTemplate[] = [
  {
    id: 'wrong-group-chat',
    occasion: 'online',
    star: true,
    setting: 'friends',
    categoryId: 'cat_communication',
    romance: false,
    settingTag: 'Couch. 9:14 PM. Wednesday.',
    hook: [
      narrator('Your friend Riley is planning an escape-room birthday.'),
      narrator('You rant about the $60 ticket price.'),
      narrator('You hit send, then see the chat name: "Riley\'s Birthday."'),
    ],
    twist: [
      narrator('Three dots appear under Riley\'s name.'),
      dialogue('Riley', '…wait, who is this about?'),
      narrator('Your friend Jordan texts you privately.'),
      dialogue('Jordan', 'Wrong chat. WRONG. CHAT.'),
      narrator('Read receipts appear one by one, like a tiny firing squad.'),
    ],
    punchline: [
      narrator('The chat fills with decoy memes, then a cake photo.'),
      narrator('Riley pins a message that just says "nice save."'),
    ],
    next: 'a voice note you didn\'t mean to send.',
    leans: {
      high: {
        title: 'The Group Chat Whisperer',
        move: [
          narrator('You don\'t delete it.'),
          narrator('You send: "That was a test of this chat\'s emergency system."'),
          narrator('Then: "Real message: I\'m in. I\'m bringing a $60-bill cake."'),
        ],
        punchline: [
          narrator('Riley drops the ticket price to $40.'),
          narrator('Then Riley renames the chat "Riley\'s Birthday (Budget Edition)."'),
        ],
        reveal: 'You can\'t unsend words. You can always send better ones.',
        otherWay: 'The other way, you\'d have deleted it and claimed your phone was stolen.',
        evidence: 'you rewrote the chat instead of deleting it',
        tip: 'Watch out: not every slip needs a speech. Sometimes "my bad" is plenty.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 4 },
      },
      low: {
        title: 'Professor Decoy Meme',
        move: [
          narrator('You flood the chat with three old memes in a row.'),
          narrator('You add a photo of a cake you have not baked.'),
          narrator('You let the rant sink under the pile.'),
        ],
        reveal: 'You\'d rather step back than push.',
        otherWay: 'The other way, you would have owned the rant with a cake.',
        evidence: 'you buried the slip under decoy memes',
        tip: 'Watch out: memes hide a slip. They do not replace "my bad."',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 4 },
      },
    },
  },
  {
    id: 'first-date-wrong-person',
    occasion: 'dating',
    star: true,
    setting: 'friends',
    categoryId: 'cat_social',
    romance: true,
    settingTag: 'Café. 7:02 PM. Friday.',
    hook: [
      narrator('You\'re meeting your date for the first time.'),
      narrator('Someone by the window looks like your date\'s photos.'),
      narrator('You wave, and they wave back.'),
    ],
    twist: [
      narrator('They sit down at your table.'),
      narrator('This is Rory, who also has a first date tonight.'),
      dialogue('Your date (standing behind you)', 'Hi… I\'m over here.'),
      dialogue('Rory', 'Oh no. I thought you were my date.'),
      narrator('Somewhere, your dignity quietly packs a small suitcase.'),
    ],
    punchline: [
      narrator('Rory\'s real date walks in at 7:10.'),
      narrator('This time, everyone waits for them to wave first.'),
    ],
    next: 'a party where you only know the host.',
    leans: {
      high: {
        title: 'Captain Table for Three',
        move: [
          narrator('You pull up a third chair.'),
          narrator('You introduce your date and Rory like you planned it.'),
          narrator('Then you launch a search party for Rory\'s date, with croissants.'),
        ],
        reveal: 'Awkward moments don\'t scare you. You give them a chair.',
        otherWay: 'The other way, you\'d have hidden behind the menu until Rory left.',
        evidence: 'you turned a wrong-table mix-up into a table for three',
        tip: 'Tip: let the quiet person at the table pick the next topic. They\'ll remember it.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 4 },
      },
      low: {
        title: 'The Menu Shield',
        move: [
          narrator('You stand, apologise, and slide the chair back.'),
          narrator('You sit with your actual date two tables over.'),
          narrator('You hide behind the menu for one quiet breath.'),
        ],
        punchline: [
          narrator('Rory\'s real date walks in at 7:10.'),
          narrator('You all wave this time, from a safe distance.'),
        ],
        reveal: 'You recharge in quieter company, then you still show up.',
        otherWay: 'The other way, you would have pulled up a third chair.',
        evidence: 'you reset the table and sat with your date',
        tip: 'Watch out: a menu is a pause, not a hiding place for the whole night.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 4 },
      },
    },
  },
  {
    id: 'muted-presenting',
    occasion: 'work',
    star: true,
    setting: 'work',
    categoryId: 'cat_resilience',
    romance: false,
    settingTag: 'Video call. 10:02 AM. Monday.',
    hook: [
      narrator('You give your best two minutes of the quarter.'),
      narrator('Nobody reacts, because you were on mute the whole time.'),
    ],
    twist: [
      narrator('Avery, your manager, waits with a polite smile.'),
      dialogue('Avery', 'Whenever you\'re ready to start.'),
      dialogue('Avery', 'The red mute is still on.'),
      narrator('Twelve faces stare, chewing the silence.'),
      narrator('The mute button sits there, very pleased with itself.'),
    ],
    punchline: [
      narrator('You start again, and this time they hear you.'),
      narrator('The mute button sulks in the corner of the screen.'),
    ],
    next: 'a slides deck that opens on the wrong file.',
    leans: {
      high: {
        title: 'Saint of Take Two',
        move: [
          narrator('You unmute, grin, and restart from the joke.'),
          narrator('You skip the throat-clear and keep the good part.'),
          narrator('You give the mute button a tiny, public nod.'),
        ],
        reveal: 'You lose a round, shrug, and go again.',
        otherWay: 'The other way, you would have switched to interpretive mime.',
        evidence: 'you unmuted and restarted from the joke',
        tip: 'Tip: check the red mic before the big sentence.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 4 },
      },
      low: {
        title: 'Professor Mime Hour',
        move: [
          narrator('You stay muted and act the update with both hands.'),
          narrator('You hold up a notebook that says the one number.'),
          narrator('Avery starts laughing, which counts as a start.'),
        ],
        reveal: 'Pressure hits hard, but you find a side door.',
        otherWay: 'The other way, you would have unmuted and restarted cleanly.',
        evidence: 'you turned the mute into a bit',
        tip: 'Watch out: mime works once. Next time, find the button.',
        jokeLight: { beat: 'move', line: 0 },
        jokeDark: { beat: 'twist', line: 4 },
      },
    },
  },
  {
    id: 'called-on',
    occasion: 'work',
    star: true,
    setting: 'work',
    categoryId: 'cat_openness',
    romance: false,
    settingTag: 'Meeting room. 2:15 PM. Thursday.',
    hook: [
      narrator('You were mentally choosing a sandwich.'),
      narrator('Your boss asks what you think, and twelve heads turn.'),
    ],
    twist: [
      narrator('Blair, a coworker, whispers without moving their lips.'),
      dialogue('Blair', 'They mean the budget.'),
      dialogue('Blair', 'Say something about the budget.'),
      narrator('The silence grows a second mouth and waits.'),
    ],
    punchline: [
      narrator('The room nods, as if you had a slide for this.'),
      narrator('Your sandwich thought files a complaint and leaves.'),
    ],
    next: 'a stand-up where someone asks you to recap.',
    leans: {
      high: {
        title: 'Captain Off The Cuff',
        move: [
          narrator('You pick one true thing about the budget.'),
          narrator('You add a small idea nobody has tried.'),
          narrator('You stop talking before the idea gets a sequel.'),
        ],
        reveal: 'You say yes to the untried path.',
        otherWay: 'The other way, you would have taken it offline and sat down.',
        evidence: 'you offered one new idea, then stopped',
        tip: 'Tip: one new idea is plenty. Write the rest after lunch.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'The Offline Closer',
        move: [
          narrator('You smile and buy one clean second.'),
          narrator('You say it is a good question.'),
          narrator('You park it for a note after the meeting.'),
        ],
        reveal: 'You like the known path, done well.',
        otherWay: 'The other way, you would have pitched a brand-new idea live.',
        evidence: 'you parked it for a note after',
        tip: 'Watch out: "offline" only works if you actually write the note.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'forgot-name',
    occasion: 'party',
    star: true,
    setting: 'friends',
    categoryId: 'cat_social',
    romance: false,
    settingTag: 'House party. 10:40 PM. Saturday.',
    hook: [
      narrator('You start introducing your old pal to your new pal.'),
      narrator('Halfway through, the old pal\'s name leaves your brain.'),
    ],
    twist: [
      narrator('Quinn, the new pal, waits with a helpful smile.'),
      dialogue('Quinn', 'And this is…?'),
      dialogue('Quinn', 'I can start, if that helps.'),
      narrator('The missing name sits in the hallway, laughing.'),
    ],
    punchline: [
      narrator('They shake hands and do the work for you.'),
      narrator('The missing name slinks back, late and useless.'),
    ],
    next: 'a group photo where you forget your own wave.',
    leans: {
      high: {
        title: 'Captain Introduce Yourselves',
        move: [
          narrator('You laugh and hand them the job.'),
          narrator('You say they should introduce themselves.'),
          narrator('You fetch two drinks so the names can land.'),
        ],
        reveal: 'Awkward moments don\'t scare you. You give them a chair.',
        otherWay: 'The other way, you would have called them "legend" all night.',
        evidence: 'you let them introduce themselves',
        tip: 'Tip: repeat the name once you hear it. Out loud helps.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Ol\' Legend',
        move: [
          narrator('You call your old friend "legend" with full confidence.'),
          narrator('You keep saying it, like it was always the nickname.'),
          narrator('Quinn starts using it too, which seals the deal.'),
        ],
        reveal: 'You recharge in quieter company, then still save the bit.',
        otherWay: 'The other way, you would have made them introduce themselves.',
        evidence: 'you turned a blank into a nickname',
        tip: 'Watch out: "legend" is funny once. Ask later, in private.',
        jokeLight: { beat: 'move', line: 0 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'surprise-party-early',
    occasion: 'party',
    star: true,
    setting: 'friends',
    categoryId: 'cat_drive',
    romance: false,
    settingTag: 'Friend\'s apartment. 6:48 PM. Friday.',
    hook: [
      narrator('The banner is half up and the cake is still in the car.'),
      narrator('The guest of honour just texted: "Parking now!"'),
    ],
    twist: [
      narrator('Hayden, the co-host, spins with a roll of tape.'),
      dialogue('Hayden', 'Who has the lighter?'),
      dialogue('Hayden', 'The cake is still in the car.'),
      narrator('The half-banner droops like it has already given up.'),
    ],
    punchline: [
      narrator('The guest of honour walks in to a finished room.'),
      narrator('The cake arrives last, looking smug about the wait.'),
    ],
    next: 'a candle that will not stay lit.',
    leans: {
      high: {
        title: 'Captain Parking Now',
        move: [
          narrator('You assign the banner, the lights, and the door.'),
          narrator('You run for the cake like it is a relay.'),
          narrator('You hide the tape roll behind a plant.'),
        ],
        reveal: 'You don\'t panic at deadlines. You hand out jobs.',
        otherWay: 'The other way, you would have stuffed the banner in a drawer.',
        evidence: 'you split the jobs and fetched the cake',
        tip: 'Tip: one person on the door. Everyone else can finish.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Professor Drawer Banner',
        move: [
          narrator('You drop the banner into a drawer in one sweep.'),
          narrator('You flip the lights and call it "mood."'),
          narrator('You meet them at the door with two cups already poured.'),
        ],
        reveal: 'Your plans are messy, yet you always beat the clock.',
        otherWay: 'The other way, you would have run a full job list.',
        evidence: 'you hid the mess and opened the door',
        tip: 'Watch out: empty the drawer before they look for coats.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'phone-died',
    occasion: 'errands',
    star: true,
    setting: 'home',
    categoryId: 'cat_steadiness',
    romance: false,
    settingTag: 'Bedroom. 8:23 AM. Tuesday.',
    hook: [
      narrator('You wake up naturally, which is the first bad sign.'),
      narrator('You have to leave in seven minutes.'),
    ],
    twist: [
      narrator('Ari, your roommate, knocks through the door.'),
      dialogue('Ari', 'Weren\'t you leaving at eight?'),
      dialogue('Ari', 'Seven minutes. I counted.'),
      narrator('The charger sits on the floor, unplugged, pretending innocence.'),
    ],
    punchline: [
      narrator('You make the door with one minute left.'),
      narrator('The charger stays on the floor, planning tomorrow.'),
    ],
    next: 'a train door that beeps as you reach the stairs.',
    leans: {
      high: {
        title: 'The Seven Minute Host',
        move: [
          narrator('You dress in the order that actually works.'),
          narrator('You skip the nice shoes and take the keys.'),
          narrator('You thank Ari with a wave and a granola bar.'),
        ],
        reveal: 'When a plan stalls, you turn the wait into motion.',
        otherWay: 'The other way, you would have rebranded as fashionably late.',
        evidence: 'you skipped the nice shoes and took the keys',
        tip: 'Tip: plug the charger into the wall, not just the phone.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Professor Fashionably Late',
        move: [
          narrator('You name the lateness and put on yesterday\'s jacket.'),
          narrator('You text one honest "running seven" and mean it.'),
          narrator('You leave with wet hair and a good story.'),
        ],
        reveal: 'You feel the wobble, then ride it.',
        otherWay: 'The other way, you would have done a seven-minute speedrun.',
        evidence: 'you sent one honest text and left anyway',
        tip: 'Watch out: "fashionably late" needs the text. Silence looks like a no-show.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'self-checkout',
    occasion: 'errands',
    star: true,
    setting: 'home',
    categoryId: 'cat_resilience',
    romance: false,
    settingTag: 'Grocery store. 6:05 PM. Wednesday.',
    hook: [
      narrator('The self-checkout says "unexpected item in bagging area."'),
      narrator('There is no unexpected item, and a line is forming behind you.'),
    ],
    twist: [
      narrator('A teen employee walks over with a scanner and a sigh.'),
      dialogue('Teen employee', 'Did you put something on the scale?'),
      dialogue('Teen employee', 'The scale thinks it is haunted.'),
      narrator('The machine beeps again, like it has caught you in a lie.'),
    ],
    punchline: [
      narrator('The bag is cleared.'),
      narrator('The line unclenches.'),
      narrator('The machine waits one beat, then beeps once more, for sport.'),
    ],
    next: 'a receipt that prints blank, then prints twice.',
    leans: {
      high: {
        title: 'Saint of the Scale',
        move: [
          narrator('You lift every bag and set them back down.'),
          narrator('You scan the last apple again, slowly.'),
          narrator('You thank the machine out loud, which startles it.'),
        ],
        reveal: 'You lose a round, shrug, and go again.',
        otherWay: 'The other way, you would have abandoned the bags and walked out.',
        evidence: 'you cleared the scale and finished the scan',
        tip: 'Tip: one bag at a time. The machine likes a simple story.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Professor Please Wait',
        move: [
          narrator('You step aside and let them take the scanner.'),
          narrator('You hold the bags like a calm coat rack.'),
          narrator('You smile at the line, which buys you ten seconds.'),
        ],
        reveal: 'Pressure hits hard, but you find a side door.',
        otherWay: 'The other way, you would have argued with the scale.',
        evidence: 'you handed the scanner over and kept the line kind',
        tip: 'Watch out: stepping aside is fine. Leaving the bags is not.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'empty-milk',
    occasion: 'home',
    star: true,
    setting: 'home',
    categoryId: 'cat_communication',
    romance: false,
    settingTag: 'Kitchen. 7:30 AM. Wednesday.',
    hook: [
      narrator('You pour your cereal, then pick up the milk.'),
      narrator('The carton is light, cold, and completely empty.'),
    ],
    twist: [
      narrator('Sam, your roommate, is already leaving with a bag.'),
      dialogue('Sam', 'Oh yeah, we\'re out of milk.'),
      dialogue('Sam', 'I meant to say. Sorry.'),
      narrator('The carton sits there, smug and weightless.'),
    ],
    punchline: [
      narrator('Sam texts a photo of a new carton from the shop.'),
      narrator('The empty one stays on the table, retired with honours.'),
    ],
    next: 'a dishwasher debate about spoons.',
    leans: {
      high: {
        title: 'The Fridge Note',
        move: [
          narrator('You write one polite note and stick it on the fridge.'),
          narrator('You add a tiny drawing of a sad bowl.'),
          narrator('You text Sam a calm "milk run?" and wait.'),
        ],
        reveal: 'You say the hard thing, and keep it kind.',
        otherWay: 'The other way, you would have built a carton shrine.',
        evidence: 'you left a kind note and a clear ask',
        tip: 'Tip: name the thing. "We\'re out" is kinder than a sigh.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Professor Empty Carton',
        move: [
          narrator('You put the carton back, facing forward, like art.'),
          narrator('You eat the cereal dry and call it a choice.'),
          narrator('You leave a sticky note that only says "wow."'),
        ],
        reveal: 'You\'d rather step back than push.',
        otherWay: 'The other way, you would have asked for a milk run out loud.',
        evidence: 'you left a sticky note that said wow',
        tip: 'Watch out: "wow" is funny. A second carton still needs a real ask.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'forgot-birthday',
    occasion: 'dating',
    star: true,
    setting: 'friends',
    categoryId: 'cat_love',
    romance: false,
    settingTag: 'Bedroom. 11:48 PM. Tuesday.',
    hook: [
      narrator('A notification says it is your best friend\'s birthday.'),
      narrator('You have twelve minutes left to fix this.'),
    ],
    twist: [
      narrator('The phone lights up again, very sure of itself.'),
      dialogue('Phone notification', 'Don\'t forget to wish Kai a happy birthday!'),
      dialogue('Phone notification', 'Kai is still waiting on a wish.'),
      narrator('The calendar knew all day and said nothing until now.'),
    ],
    punchline: [
      narrator('Kai replies at 12:01 with a photo of a muffin.'),
      narrator('The calendar app pretends this was the plan.'),
    ],
    next: 'a calendar alert for a lunch you already ate.',
    leans: {
      high: {
        title: 'Captain Gas Station Cake',
        move: [
          narrator('You grab your keys and the last good snack in the house.'),
          narrator('You go to Kai\'s door with a candle in a muffin.'),
          narrator('You sing badly, on purpose, for twelve seconds.'),
        ],
        reveal: 'You lean in close when it still counts.',
        otherWay: 'The other way, you would have sent a long 11:59 text.',
        evidence: 'you showed up with a muffin and a candle',
        tip: 'Tip: a small show-up beats a perfect message sent tomorrow.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'The 11:59 Text',
        move: [
          narrator('You write one true sentence, not a speech.'),
          narrator('You send it at 11:59, then put the phone face down.'),
          narrator('You add a photo of a candle you do not own.'),
        ],
        reveal: 'You keep a little room, and you still show up.',
        otherWay: 'The other way, you would have driven over with a muffin.',
        evidence: 'you sent one true line before midnight',
        tip: 'Watch out: a late text is fine. A paragraph at 2 AM is not.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'running-train',
    occasion: 'travel',
    star: true,
    setting: 'work',
    categoryId: 'cat_drive',
    romance: false,
    settingTag: 'Train platform. 7:58 AM. Monday.',
    hook: [
      narrator('Your train leaves at 7:59.'),
      narrator('The stairs are full of slow walkers, and the doors are beeping.'),
    ],
    twist: [
      narrator('A stranger holds the door with one heroic elbow.'),
      dialogue('Stranger', 'Come on, come on, come on!'),
      dialogue('Stranger', 'Last call. This is it.'),
      narrator('The beep sounds like a countdown with a grudge.'),
    ],
    punchline: [
      narrator('You make it through the doors.'),
      narrator('The door-holder nods like a teammate.'),
      narrator('The doors close on nobody, and look slightly disappointed.'),
    ],
    next: 'a bus that leaves while you are still tapping your pass.',
    leans: {
      high: {
        title: 'Captain Beep Beep',
        move: [
          narrator('You pick a gap and take the stairs two at a time.'),
          narrator('You thank the stranger without slowing down.'),
          narrator('You slide in as the beep hits its last note.'),
        ],
        reveal: 'You push until it\'s done.',
        otherWay: 'The other way, you would have waved and waited for the next one.',
        evidence: 'you ran the stairs and made the doors',
        tip: 'Tip: thank the door-holder. They just saved your morning.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Professor Next Train',
        move: [
          narrator('You stop on the stairs and wave a clean goodbye.'),
          narrator('You buy a better coffee for the eight-minute wait.'),
          narrator('You text work one honest "next train" and sit.'),
        ],
        reveal: 'You go at your own pace and still get there.',
        otherWay: 'The other way, you would have sprinted the last flight.',
        evidence: 'you skipped the sprint and sent one honest text',
        tip: 'Watch out: the next train is fine. Silence is what looks like a no-show.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'seat-neighbour',
    occasion: 'travel',
    star: true,
    setting: 'friends',
    categoryId: 'cat_independence',
    romance: false,
    settingTag: 'Plane, seat 23B. 6:10 AM. Saturday.',
    hook: [
      narrator('You have a five-hour flight and one goal: sleep.'),
      narrator('Your seat neighbour has started telling you their life story.'),
    ],
    twist: [
      dialogue('Seat neighbour', 'So that was my first commute. Now, my second…'),
      narrator('A flight attendant passes with a look of professional pity.'),
      dialogue('Flight attendant', 'Pillow? Or a longer story?'),
      narrator('The armrest becomes a border with no treaty.'),
    ],
    punchline: [
      narrator('The neighbour talks to the seat-back screen instead.'),
      narrator('You sleep.'),
      narrator('The story continues without you, which is the point.'),
    ],
    next: 'a hotel key card that flashes red twice.',
    leans: {
      high: {
        title: 'Captain Headphones',
        move: [
          narrator('You smile, put on headphones, and close your eyes.'),
          narrator('You say you have a deadline sleep to catch.'),
          narrator('You face the window like it is a meeting.'),
        ],
        reveal: 'You like doing things your own way.',
        otherWay: 'The other way, you would have become the second audience.',
        evidence: 'you put on headphones and kept the window',
        tip: 'Tip: a kind sentence plus headphones is a full answer.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'The Soft Landing Seat',
        move: [
          narrator('You ask one question, then share the pretzels.'),
          narrator('You let the story have five more minutes.'),
          narrator('You borrow the flight attendant\'s pillow as a flag.'),
        ],
        reveal: 'You\'re happy sharing someone else\'s path, then you sleep.',
        otherWay: 'The other way, you would have gone full headphones at once.',
        evidence: 'you gave the story five minutes, then a pillow flag',
        tip: 'Watch out: five minutes is kind. The whole flight is a sequel.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'liked-old-photo',
    occasion: 'online',
    star: true,
    setting: 'friends',
    categoryId: 'cat_levity',
    romance: true,
    settingTag: 'Couch. 12:40 AM. Sunday.',
    hook: [
      narrator('You are deep in your crush\'s photos from 2016.'),
      narrator('Your thumb slips, and the heart turns red.'),
    ],
    twist: [
      narrator('Kim, your roommate, looks over the back of the couch.'),
      dialogue('Kim', 'Unlike it! Unlike it now!'),
      dialogue('Kim', 'That like is from 2016.'),
      narrator('The heart stays red, like it has chosen a side.'),
    ],
    punchline: [
      narrator('Your crush likes a photo of your dog from last March.'),
      narrator('The 2016 heart keeps glowing, unbothered.'),
    ],
    next: 'a voice note you sent to the family chat.',
    leans: {
      high: {
        title: 'The Accidental Heart',
        move: [
          narrator('You leave the like and send a normal good-morning later.'),
          narrator('You tell Kim it is now a bit, not a crime.'),
          narrator('You close the app before the thumb can vote again.'),
        ],
        reveal: 'You reach for the lighter take.',
        otherWay: 'The other way, you would have unlike-spammed until dawn.',
        evidence: 'you left the like and moved on',
        tip: 'Tip: one like from 2016 is a shrug. A paragraph is a sequel.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Ol\' Unlike It Now',
        move: [
          narrator('You tap unlike once, then stop.'),
          narrator('You put the phone under a cushion, like evidence.'),
          narrator('You ask Kim to talk about literally anything.'),
        ],
        reveal: 'You keep a straight face and get it done.',
        otherWay: 'The other way, you would have left the like and gone to sleep.',
        evidence: 'you stopped tapping and hid the phone',
        tip: 'Watch out: the unlike dance is louder than the like.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
      },
    },
  },
  {
    id: 'surprise-guest',
    occasion: 'home',
    star: true,
    setting: 'home',
    categoryId: 'cat_drive',
    romance: false,
    settingTag: 'Apartment. 6:45 PM. Sunday.',
    hook: [
      narrator('Your aunt Rosa texts: "In the neighbourhood! There in fifteen minutes."'),
      narrator('Your apartment looks like a laundry tornado.'),
    ],
    twist: [
      narrator('Your sibling Blair stares at the chair of clothes.'),
      dialogue('Blair', 'She said fifteen minutes. That means ten.'),
      dialogue('Blair', 'And she always checks the fridge.'),
      narrator('The clothes chair has grown for weeks, and now it stares back.'),
    ],
    punchline: [
      narrator('Aunt Rosa arrives at 6:55.'),
      narrator('She opens the fridge, sees the lemon, and nods.'),
      narrator('The clothes chair sits empty, plotting its comeback.'),
    ],
    next: 'Aunt Rosa says she\'ll "pop by more often."',
    leans: {
      high: {
        title: 'Captain Fifteen Minutes',
        move: [
          narrator('You set a timer and assign jobs.'),
          narrator('Blair folds the clothes, and you speed-wash the dishes.'),
          narrator('You put one lemon in the empty fridge, for elegance.'),
        ],
        reveal: 'You don\'t panic at deadlines. You hand out jobs.',
        otherWay: 'The other way, you\'d have shoved everything into one closet and prayed.',
        evidence: 'one timer, two jobs, and a single lemon',
        tip: 'Watch out: not every visit is a race. Some mess can stay. Aunt Rosa has seen worse.',
        jokeLight: { beat: 'move', line: 2 },
        jokeDark: { beat: 'twist', line: 3 },
      },
      low: {
        title: 'Professor Closet Door',
        move: [
          narrator('You shove the clothes chair into the closet in one armful.'),
          narrator('You lean on the door until it clicks, like a villain sealing a vault.'),
        ],
        punchline: [
          narrator('Aunt Rosa arrives at 6:55.'),
          narrator('She opens the fridge, finds only ketchup, and says, "Very minimalist."'),
          narrator('She reaches for the closet to hang her coat.'),
        ],
        reveal: 'Your plans are messy, yet you always beat the clock.',
        otherWay: 'The other way, you\'d have set a timer, assigned jobs, and bought a lemon.',
        evidence: 'one armful, one closet, zero cleaning',
        tip: 'Watch out: the closet remembers. Empty it before the next surprise visit.',
        jokeLight: { beat: 'move', line: 1 },
        jokeDark: { beat: 'twist', line: 3 },
        jokeDarkSecondary: { beat: 'punchline', line: 2 },
      },
    },
  },
];

/** Topics that have a reference story for one or both leans. */
export const STORY_REFERENCE_TOPIC_IDS = [
  'wrong-group-chat',
  'first-date-wrong-person',
  'surprise-guest',
] as const;

export function renderTopic(topic: TopicTemplate, lean: TraitLean): StoryScript {
  return pack(topic, lean);
}

export function topicById(id: string): TopicTemplate | undefined {
  return STORY_STAR_TOPICS.find((row) => row.id === id);
}
