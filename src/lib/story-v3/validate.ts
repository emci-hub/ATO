import { CATEGORY_DEFS } from '@/lib/categories';

import { STORY_BANNED_CLICHES, STORY_BANNED_TOPICS, STORY_CLINICAL_CARD6, STORY_GENDERED_PRONOUNS, STORY_HOROSCOPE_CARD6, STORY_ROMANCE_LABELS } from './banned';
import { isApprovedStoryName, isFamilyRoleLabel } from './names';
import { lineText, lineWords } from './lines';
import type { StoryLine, StoryScript } from './types';

export interface StoryFlag {
  code: string;
  message: string;
  /** clarity flags are review, not auto-fail */
  review?: boolean;
}

const CALLBACK_NOUNS = new Set([
  'toaster',
  'kettle',
  'washing',
  'machine',
  'router',
  'fridge',
  'chair',
  'clothes',
  'chat',
  'date',
  'rory',
  'riley',
  'jordan',
  'blair',
  'kai',
  'sam',
  'rowan',
  'ari',
  'avery',
  'quinn',
  'hayden',
  'kim',
  'mute',
  'train',
  'heart',
  'carton',
  'milk',
  'phone',
  'banner',
  'cake',
  'friend',
  'stranger',
  'flight',
  'unlike',
  'minutes',
  'landlord',
  'neighbour',
  'ticker',
  'employee',
]);

function allLines(script: StoryScript): StoryLine[] {
  return [...script.hook, ...script.twist, ...script.move, ...script.punchline];
}

function beatLines(script: StoryScript, beat: StoryScript['jokeLight']['beat']): StoryLine[] {
  return script[beat];
}

export function storyTotalWords(script: StoryScript): number {
  const body = allLines(script).reduce((sum, line) => sum + lineWords(lineText(line)), 0);
  return body + lineWords(script.next) + lineWords(script.reveal);
}

export function titleWords(title: string): number {
  return lineWords(title);
}

export function checkClarity(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  const speakers = new Set<string>();
  for (const line of allLines(script)) {
    const text = lineText(line);
    if (line.kind === 'narrator') {
      const intro =
        /(?:your (?:friend|roommate|sibling|coworker|manager|date|pal)|this is|aunt|uncle)\s+([A-Z][a-z]+)/i.exec(text)
        ?? /^([A-Z][a-z]+),\s+(?:your|the|a)\s+/.exec(text);
      if (intro) speakers.add(intro[1]!);
      const aunt = /\bAunt\s+[A-Z][a-z]+/.exec(text);
      if (aunt) speakers.add(aunt[0]!);
    }
    if (line.kind === 'dialogue') {
      const base = line.speaker.replace(/\s*\(.*\)$/, '');
      if (
        !speakers.has(base) &&
        !speakers.has(line.speaker) &&
        !/^(Your date|Your partner|Your crush|An ex|Rory's date|Phone notification|Teen employee|Stranger|Seat neighbour|Flight attendant|Guest of honour)/i.test(
          line.speaker,
        ) &&
        !isFamilyRoleLabel(base)
      ) {
        const first = base.split(/\s+/)[0] ?? base;
        if (![...speakers].some((name) => name.includes(first))) {
          flags.push({ code: 'speaker', message: `speaker not introduced: ${line.speaker}`, review: true });
        }
      }
      continue;
    }
    if (lineWords(text) > 14) {
      flags.push({ code: 'line-length', message: `over 14 words: ${text}`, review: true });
    }
    if ((text.match(/[.?!]["']?\s+\S/g) ?? []).length > 0) {
      flags.push({ code: 'two-sentences', message: `two sentences: ${text}`, review: true });
    }
    const beforeVerb = text.split(/\b(?:is|are|was|were|has|have|had|does|do|did|says|said|sits|sit|looks|look|walks|walk|opens|open|texts|text)\b/i)[0] ?? '';
    if ((beforeVerb.match(/,/g) ?? []).length >= 2) {
      flags.push({ code: 'comma-chain', message: `comma chain before verb: ${text}`, review: true });
    }
  }
  return flags;
}

export function checkGender(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  const joined = [flatten(script), script.next, script.reveal, script.otherWay ?? '', script.card6.evidence, script.card6.tip].join('\n');
  if (script.romance) {
    if (STORY_GENDERED_PRONOUNS.test(joined) || STORY_ROMANCE_LABELS.test(joined)) {
      flags.push({ code: 'romance-gender', message: 'romantic story has a gendered pronoun or label' });
    }
    for (const line of allLines(script)) {
      if (line.kind === 'dialogue' && /date|partner|crush|\bex\b/i.test(line.speaker)) {
        if (/\b[A-Z][a-z]+\b/.test(line.speaker) && !/Your |Rory's /.test(line.speaker)) {
          flags.push({ code: 'romance-name', message: `romantic role named: ${line.speaker}` });
        }
      }
    }
  }
  const names = collectNames(script);
  const letters = new Map<string, string>();
  for (const name of names) {
    if (!isApprovedStoryName(name) && !isFamilyRoleLabel(name) && name !== 'Rosa') {
      // Aunt Rosa = family role + given name; Rosa is allowed with Aunt.
      if (!/^Aunt |^Uncle |^Mom |^Dad |^Grandma |^Grandpa /.test(name) && name !== 'Rosa') {
        flags.push({ code: 'name-list', message: `name not on the approved list: ${name}` });
      }
    }
    const letter = name[0]!.toLowerCase();
    const prev = letters.get(letter);
    if (prev && prev !== name) flags.push({ code: 'same-letter', message: `two names share ${letter}: ${prev} + ${name}` });
    letters.set(letter, name);
  }
  if (!script.romance) {
    const familyOk = /\b(aunt|uncle|mom|dad|grandma|grandpa|rosa|blair)\b/i;
    for (const line of allLines(script)) {
      if (line.kind !== 'narrator') continue;
      if (STORY_GENDERED_PRONOUNS.test(line.text) && !familyOk.test(line.text) && !familyOk.test(flatten(script))) {
        flags.push({ code: 'pronoun-review', message: `gendered pronoun: ${line.text}`, review: true });
      }
    }
  }
  return flags;
}

function flatten(script: StoryScript): string {
  return allLines(script)
    .map((line) => (line.kind === 'dialogue' ? `${line.speaker} ${line.text}` : line.text))
    .join('\n');
}

function collectNames(script: StoryScript): string[] {
  const found = new Set<string>();
  const skip = new Set([
    'You',
    'Your',
    'The',
    'This',
    'Then',
    'Next',
    'Phone',
    'Teen',
    'Stranger',
    'Seat',
    'Flight',
    'Guest',
    'Office',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'January',
    'Kitchen',
    'Café',
    'Couch',
    'Apartment',
    'Bedroom',
    'Grocery',
    'House',
    'Friend',
    'Video',
    'Meeting',
    'Train',
    'Plane',
    'Captain',
    'Professor',
    'Saint',
    'Chief',
    'Ol',
  ]);
  const blob = `${flatten(script)}\n${script.settingTag}\n${script.title}`;
  for (const match of blob.matchAll(/\b([A-Z][a-z]+)\b/g)) {
    const name = match[1]!;
    if (skip.has(name)) continue;
    if (['Rosa'].includes(name)) continue;
    if (isFamilyRoleLabel(name)) continue;
    if (isApprovedStoryName(name)) found.add(name);
    else if (/^[A-Z][a-z]+$/.test(name) && name.length > 2 && isApprovedStoryName(name)) found.add(name);
  }
  // Only count approved names + family given names that appear as people.
  for (const match of blob.matchAll(/\bAunt\s+(Rosa)\b/g)) found.add(`Aunt ${match[1]}`);
  return [...found];
}

export function checkCard6(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  const c = script.card6;
  const catalog = CATEGORY_DEFS.find((row) => row.id === script.categoryId)?.name;
  if (c.categoryName !== catalog) flags.push({ code: 'card6-name', message: `categoryName ${c.categoryName} != ${catalog}` });
  const lines = [c.categoryName && `This is your ${c.categoryName}: ${c.leanPhrase}.`, c.scoreLine, `Proof: ${c.evidence}.`, c.tip].filter(Boolean) as string[];
  const words = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (words > 45) flags.push({ code: 'card6-words', message: `card6 is ${words} words` });
  if (STORY_CLINICAL_CARD6.test(lines.join(' '))) flags.push({ code: 'card6-clinical', message: 'clinical word on card 6' });
  if (STORY_HOROSCOPE_CARD6.test(lines.join(' '))) flags.push({ code: 'card6-horoscope', message: 'horoscope vagueness on card 6' });
  const sceneText = [...script.move, ...script.hook, ...script.twist, ...script.punchline]
    .map(lineText)
    .join(' ')
    .toLowerCase();
  const evidenceWords = c.evidence.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  if (!evidenceWords.some((word) => sceneText.includes(word))) {
    flags.push({ code: 'card6-proof', message: `evidence does not echo the move: ${c.evidence}` });
  }
  if (!/^(Tip:|Watch out:)/.test(c.tip)) flags.push({ code: 'card6-tip', message: 'tip must start with Tip: or Watch out:' });
  if (lineWords(c.tip) > 20) flags.push({ code: 'card6-tip-words', message: `tip is ${lineWords(c.tip)} words` });
  if (lineWords(c.evidence) > 12) flags.push({ code: 'card6-evidence', message: `evidence is ${lineWords(c.evidence)} words` });
  return flags;
}

export function checkJokes(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  const light = beatLines(script, script.jokeLight.beat)[script.jokeLight.line];
  const dark = beatLines(script, script.jokeDark.beat)[script.jokeDark.line];
  if (!light) flags.push({ code: 'joke-light', message: 'jokeLight points at a missing line' });
  if (!dark) flags.push({ code: 'joke-dark', message: 'jokeDark points at a missing line' });
  if (
    script.jokeLight.beat === script.jokeDark.beat &&
    script.jokeLight.line === script.jokeDark.line
  ) {
    flags.push({ code: 'joke-same', message: 'jokeLight and jokeDark are the same line' });
  }
  if (dark && STORY_BANNED_TOPICS.some((re) => re.test(lineText(dark)))) {
    flags.push({ code: 'joke-dark-banned', message: `dark joke hits a banned topic: ${lineText(dark)}` });
  }
  return flags;
}

export function checkBanned(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  const joined = `${flatten(script)}\n${script.next}\n${script.reveal}\n${script.otherWay ?? ''}`;
  for (const re of STORY_BANNED_TOPICS) {
    if (re.test(joined) && !/respect for the dead|files for early retirement|open grave|funeral for it|warning shot/i.test(joined)) {
      // Metaphorical object-doom is allowed; real death language is not.
      if (/\b(die|dies|died|dying|dead|death)\b/i.test(joined) && !/mute button|calendar|machine|heart|banner|carton|dignity/.test(joined)) {
        flags.push({ code: 'banned-topic', message: `banned topic matched ${re}` });
      } else if (!/\b(die|dies|died|dying|dead|death)\b/i.test(joined)) {
        flags.push({ code: 'banned-topic', message: `banned topic matched ${re}` });
      }
    }
  }
  for (const re of STORY_BANNED_CLICHES) {
    if (re.test(joined)) flags.push({ code: 'cliche', message: `cliché: ${re}` });
  }
  return flags;
}

export function checkLength(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  if (storyTotalWords(script) > 120) flags.push({ code: 'story-words', message: `story is ${storyTotalWords(script)} words` });
  if (lineWords(script.reveal) > 15) flags.push({ code: 'reveal', message: `reveal is ${lineWords(script.reveal)} words` });
  if (titleWords(script.title) > 4) flags.push({ code: 'title', message: `title is ${titleWords(script.title)} words` });
  let dialogues = 0;
  for (const line of allLines(script)) {
    if (line.kind === 'dialogue') {
      dialogues += 1;
      if (lineWords(line.text) > 12) flags.push({ code: 'dialogue', message: `dialogue over 12: ${line.text}` });
    }
  }
  if (dialogues < 2 || dialogues > 3) flags.push({ code: 'dialogue-count', message: `${dialogues} dialogue lines` });
  return flags;
}

export function checkUnpaid(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  const hook = script.hook.map(lineText).join(' ');
  const punch = script.punchline.map(lineText).join(' ');
  if (/aunt|landlord|neighbour|guest of honour|Riley|date/i.test(hook) && !/arrives|walks in|drops|renames|wave|texts a photo|replies|sips|ticks|takes|lived-in/i.test(punch + script.next)) {
    // Guest-like setup should be paid in punch or next.
    if (!/Riley|Aunt|date|guest|neighbour|landlord|Kai/i.test(punch)) {
      flags.push({ code: 'unpaid-guest', message: 'guest setup may be unpaid' });
    }
  }
  return flags;
}

export function checkRepeats(script: StoryScript): StoryFlag[] {
  const flags: StoryFlag[] = [];
  const nouns = (flatten(script).toLowerCase().match(/\b[a-z]{6,}\b/g) ?? []).filter((word) => !CALLBACK_NOUNS.has(word));
  const seen = new Map<string, number>();
  for (const word of nouns) seen.set(word, (seen.get(word) ?? 0) + 1);
  for (const [word, count] of seen) {
    if (count > 3) flags.push({ code: 'repeat-noun', message: `noun ${word} appears ${count} times` });
  }
  return flags;
}

export function checkScript(script: StoryScript, opts: { failReviews?: boolean } = {}): StoryFlag[] {
  const flags = [
    ...checkLength(script),
    ...checkJokes(script),
    ...checkBanned(script),
    ...checkGender(script),
    ...checkCard6(script),
    ...checkUnpaid(script),
    ...checkRepeats(script),
    ...checkClarity(script),
  ];
  return opts.failReviews ? flags : flags.filter((row) => !row.review);
}
