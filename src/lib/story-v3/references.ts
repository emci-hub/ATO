/**
 * The four approved reference stories (docs/story/full-samples.md).
 * Exact text. CI pins these strings.
 */
import type { StoryScript } from './types';
import { dialogue, narrator } from './lines';
import { categoryCatalogName, leanPhraseFor } from './lean-phrases';

function card6(
  id: StoryScript['categoryId'],
  lean: StoryScript['lean'],
  evidence: string,
  tip: string,
  score = false,
): StoryScript['card6'] {
  return {
    categoryName: categoryCatalogName(id),
    leanPhrase: leanPhraseFor(id, lean),
    ...(score ? { scoreLine: 'How strongly you lean here: {traitScore}%.' } : {}),
    evidence,
    tip,
  };
}

export const STORY_REFERENCES: readonly StoryScript[] = [
  {
    id: 'ref_group_chat_whisperer',
    topicId: 'wrong-group-chat',
    categoryId: 'cat_communication',
    setting: 'friends',
    lean: 'high',
    title: 'The Group Chat Whisperer',
    settingTag: 'Couch. 9:14 PM. Wednesday.',
    hook: [
      narrator('Your friend Riley is planning an escape-room birthday.'),
      narrator('You rant about the $60 ticket price.'),
      narrator('You hit send, then see the chat name: "Riley\'s Birthday 🎉."'),
    ],
    twist: [
      narrator('Three dots appear under Riley\'s name.'),
      dialogue('Riley', '…wait, who is this about?'),
      narrator('Your friend Jordan texts you privately.'),
      dialogue('Jordan', 'Wrong chat. WRONG. CHAT.'),
      narrator('Read receipts appear one by one, like a tiny firing squad.'),
    ],
    move: [
      narrator('You don\'t delete it.'),
      narrator('You send: "That was a test of this chat\'s emergency system."'),
      narrator('Then: "Real message: I\'m in. I\'m bringing a $60-bill cake."'),
    ],
    punchline: [
      narrator('Riley drops the ticket price to $40.'),
      narrator('Then Riley renames the chat "Riley\'s Birthday (Budget Edition)."'),
    ],
    next: 'a voice note you didn\'t mean to send.',
    reveal: 'You can\'t unsend words. You can always send better ones.',
    otherWay: 'The other way, you\'d have deleted it and claimed your phone was stolen.',
    card6: card6(
      'cat_communication',
      'high',
      'you rewrote the chat instead of deleting it',
      'Watch out: not every slip needs a speech. Sometimes "my bad" is plenty.',
      true,
    ),
    jokeLight: { beat: 'move', line: 2 },
    jokeDark: { beat: 'twist', line: 4 },
    romance: false,
    source: 'reference',
  },
  {
    id: 'ref_captain_table_for_three',
    topicId: 'first-date-wrong-person',
    categoryId: 'cat_social',
    setting: 'friends',
    lean: 'high',
    title: 'Captain Table for Three',
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
    move: [
      narrator('You pull up a third chair.'),
      narrator('You introduce your date and Rory like you planned it.'),
      narrator('Then you launch a search party for Rory\'s date, with croissants.'),
    ],
    punchline: [
      narrator('Rory\'s real date walks in at 7:10.'),
      narrator('This time, everyone waits for them to wave first.'),
    ],
    next: 'a party where you only know the host.',
    reveal: 'Awkward moments don\'t scare you. You give them a chair.',
    otherWay: 'The other way, you\'d have hidden behind the menu until Rory left.',
    card6: card6(
      'cat_social',
      'high',
      'you turned a wrong-table mix-up into a table for three',
      'Tip: let the quiet person at the table pick the next topic. They\'ll remember it.',
    ),
    jokeLight: { beat: 'move', line: 2 },
    jokeDark: { beat: 'twist', line: 4 },
    romance: true,
    source: 'reference',
  },
  {
    id: 'ref_captain_fifteen_minutes',
    topicId: 'surprise-guest',
    categoryId: 'cat_drive',
    setting: 'home',
    lean: 'high',
    title: 'Captain Fifteen Minutes',
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
    move: [
      narrator('You set a timer and assign jobs.'),
      narrator('Blair folds the clothes, and you speed-wash the dishes.'),
      narrator('You put one lemon in the empty fridge, for elegance.'),
    ],
    punchline: [
      narrator('Aunt Rosa arrives at 6:55.'),
      narrator('She opens the fridge, sees the lemon, and nods.'),
      narrator('The clothes chair sits empty, plotting its comeback.'),
    ],
    next: 'Aunt Rosa says she\'ll "pop by more often."',
    reveal: 'You don\'t panic at deadlines. You hand out jobs.',
    otherWay: 'The other way, you\'d have shoved everything into one closet and prayed.',
    card6: card6(
      'cat_drive',
      'high',
      'one timer, two jobs, and a single lemon',
      'Watch out: not every visit is a race. Some mess can stay. Aunt Rosa has seen worse.',
    ),
    jokeLight: { beat: 'move', line: 2 },
    jokeDark: { beat: 'twist', line: 3 },
    romance: false,
    source: 'reference',
  },
  {
    id: 'ref_professor_closet_door',
    topicId: 'surprise-guest',
    categoryId: 'cat_drive',
    setting: 'home',
    lean: 'low',
    title: 'Professor Closet Door',
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
    move: [
      narrator('You shove the clothes chair into the closet in one armful.'),
      narrator('You lean on the door until it clicks, like a villain sealing a vault.'),
    ],
    punchline: [
      narrator('Aunt Rosa arrives at 6:55.'),
      narrator('She opens the fridge, finds only ketchup, and says, "Very minimalist."'),
      narrator('She reaches for the closet to hang her coat.'),
    ],
    next: 'Aunt Rosa invites herself to Sunday dinner.',
    reveal: 'Your plans are messy, yet you always beat the clock.',
    otherWay: 'The other way, you\'d have set a timer, assigned jobs, and bought a lemon.',
    card6: card6(
      'cat_drive',
      'low',
      'one armful, one closet, zero cleaning',
      'Watch out: the closet remembers. Empty it before the next surprise visit.',
    ),
    jokeLight: { beat: 'move', line: 1 },
    jokeDark: { beat: 'twist', line: 3 },
    jokeDarkSecondary: { beat: 'punchline', line: 2 },
    romance: false,
    source: 'reference',
  },
];

export function referenceById(id: string): StoryScript | undefined {
  return STORY_REFERENCES.find((row) => row.id === id);
}

export function referenceFor(opts: {
  topicId?: string;
  categoryId: string;
  setting: string;
  lean: string;
}): StoryScript | undefined {
  return STORY_REFERENCES.find(
    (row) =>
      row.categoryId === opts.categoryId &&
      row.setting === opts.setting &&
      row.lean === opts.lean &&
      (!opts.topicId || row.topicId === opts.topicId),
  );
}
