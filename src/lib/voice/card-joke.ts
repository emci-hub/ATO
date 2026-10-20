/**
 * "The funny part" — joke lines on Legends / category deep dives, and the
 * Story punchline craft (emci, 2026-10-13: funnier jokes).
 *
 * Legends and deep dives still get ONE sentence in an app-picked style
 * (`CARD_JOKE_RULES`). The Story punchline is a constructed beat: specific
 * detail, callback, rule of three, escalation, misdirection, understatement.
 * Mechanical half for Story: `punchlineCraftViolation` + `pickBestPunchline`.
 */
import { fnv1a } from '@/lib/daily-line/bank';

import { STORY_JOKE_ALLOWED, STORY_JOKE_BANS } from './moment-voice';

export const CARD_JOKE_STYLES = [
  'dry',
  'deadpan',
  'absurd scenario (one everyday situation taken one step too far)',
  'self-aware (the reader catching themselves in the act)',
  'gallows humour about everyday absurdity (death and disaster are fair game; no real harm encouraged)',
] as const;
export type CardJokeStyle = (typeof CARD_JOKE_STYLES)[number];

export const CARD_JOKE_MAX_CHARS = 140;

/**
 * The harm filter (emci, 2026-10-19: ATO is 18+, judge the joke, not its
 * topic). A narrow keyword backstop for the prompt's contextual boundaries
 * (docs/copy-review-rules.md "Humor"). Death, dying, "this meeting is killing
 * me", drunk, hangovers, therapy, anxiety, depressed and swearing all pass —
 * mild (shit, damn, hell) and strong ("fuck" in every form: emci 2026-10-19,
 * round 3, "Allow 'fuck' in adult jokes consistently across generation,
 * reviewers, checks, and the server"). Only these are refused:
 * - phrases that ENCOURAGE harm (self-harm, suicide, telling someone to die,
 *   drunk driving) — a mention of death is not encouragement;
 * - slurs (a short explicit list, the same list as the server backstop in
 *   wave99d; "cunt", "slut" and "whore" count as slurs here, not as swearing;
 *   demeaning a group otherwise is a prompt rule);
 * - explicit sexual terms (App Store). "Fuck" as an expletive is swearing, not
 *   a sexual term; a sexually explicit line is refused by the explicit list.
 * Invented claims about real people cannot be caught by keywords: that is a
 * prompt rule here, backed by each surface's own proper-name / name-not-in-entry
 * checks. Shared with the Story (`storyHasBannedTopic`) and Story v3 templates.
 */
export const JOKE_HARM_FILTER: readonly RegExp[] = [
  // Encouraging self-harm or suicide.
  /\bkill (?:your|my|him|her|them|our)sel(?:f|ves)\b/i,
  /\bkys\b/i,
  // "Cut yourself some slack" / "try not to hurt yourself" are ordinary speech, not encouragement.
  /\b(?:cut|harm|starve|hang|off) (?:your|him|her|them)sel(?:f|ves)\b(?! (?:some slack|a break|off\b))/i,
  /(?:^|[.!?]\s*|\b(?:go|just|should|could) )hurt (?:your|him|her|them)sel(?:f|ves)\b/i,
  /\b(?:commit|try|attempt(?:ing)?) suicide\b/i,
  // Telling someone to die.
  /\b(?:you|they|he|she|people like (?:you|them)) (?:should|ought to|deserve to|need to) (?:just )?(?:die|drop dead|be dead)\b/i,
  /\bgo (?:die|drop dead)\b/i,
  // Drunk driving as an instruction (or the punchline).
  /\b(?:drink|drunk|buzzed|tipsy|wasted|hammered)(?:[- ]and)?[- ]driv/i,
  /\b(?:drinks?|drunk|buzzed|tipsy|wasted|hammered)\b[^.?!]{0,40}\b(?:then|and) (?:drive|get behind the wheel)\b/i,
  // Slurs.
  /\bn[i1]gg(?:a|er|ers|as|uh|az)\b/i,
  /\bfag(?:s|got|gots|gy)?\b/i,
  /\bretard(?:s|ed)?\b/i,
  /\btrann(?:y|ies)\b/i,
  /\b(?:kikes?|spics?|wetbacks?|gooks?|dykes?|cunts?|sluts?|slutty|whores?)\b/i,
  // Sexually explicit. "Fuck" as an expletive passes; "fuck" describing sex does not.
  /\b(?:fuck(?:ed|ing|s)?|shag(?:ged|ging|s)?) (?:each other|(?:in|on) (?:the|a) (?:car|bed|couch|sofa|shower|bathroom|back ?seat|kitchen table))\b/i,
  // "cum" only as its own word outside Latin honours ("summa / magna cum laude").
  /\b(?:porn\w*|nudes|orgasm\w*|horny|blow ?jobs?|hand ?jobs?|masturbat\w*|dildos?|boners?|erections?|cumming|cumshots?|cocks?|puss(?:y|ies)|genitals?)\b/i,
  /\bcum\b(?! laude)/i,
];

export function jokeCrossesBoundary(text: string): boolean {
  return JOKE_HARM_FILTER.some((re) => re.test(text));
}

/** Old name, kept so existing callers keep working. Same narrow harm filter. */
export const jokeHasBannedTopic = jokeCrossesBoundary;

/** Stock phrases that kill a joke. Story punchlines and the Story voice filter. */
export const STORY_BANNED_CLICHES: readonly RegExp[] = [
  /\blike nothing happened\b/i,
  /\btake a breath\b/i,
  /\bshoulders drop\b/i,
  /\bsmall hiccups\b/i,
  /\bjust another\b/i,
  /\ba ruined schedule\b/i,
  /\bsweat onto\b/i,
  /\bthe whole table\b/i,
  /\byou might have\b/i,
  /\bon a day like this\b/i,
  /\bthe real win\b/i,
  /\bin that moment\b/i,
  /\blittle did\b/i,
  /\bwalk(?:s|ed|ing)? into a bar\b/i,
  /\bthat(?:'|’)s what she said\b/i,
  /\bplot twist\b/i,
  /\bliving the dream\b/i,
  /\bit is what it is\b/i,
  /\bsay less\b/i,
  /\bno cap\b/i,
  /\bspoiler alert\b/i,
  /\beveryone else\b/i,
];

export function storyClicheViolation(text: string): string | null {
  for (const re of STORY_BANNED_CLICHES) {
    if (re.test(text)) return 'banned cliché';
  }
  return null;
}

const EXPLAINS_THE_JOKE =
  /\b(which is (?:why|funny|hilarious)|the joke is|that(?:'|’)s the (?:joke|funny part)|get it\b|as a joke|ironically|pun intended)\b/i;

/** Why a Story punchline may not be shown. Word limits are checked by the parser. */
export function punchlineCraftViolation(text: string): string | null {
  const line = text.trim();
  if (!line) return 'empty';
  if (jokeCrossesBoundary(line)) return 'crosses a boundary';
  if (/#/.test(line)) return 'hashtag';
  if (EXPLAINS_THE_JOKE.test(line)) return 'explains the joke';
  return storyClicheViolation(line);
}

function contentStems(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z]{4,}/g) ?? []).map((w) => w.slice(0, 6)));
}

/**
 * Score a candidate punchline against the beats that set it up.
 * Higher is funnier-on-paper: callback, late payoff, concrete nouns, twist-third.
 */
export function scorePunchline(
  line: string,
  setup: { hook: string; twist: string; move: string },
): number {
  if (punchlineCraftViolation(line)) return -1;
  const stems = contentStems(line);
  const hookStems = contentStems(setup.hook);
  const prior = new Set([...contentStems(setup.twist), ...contentStems(setup.move), ...hookStems]);
  let sharedHook = 0;
  for (const stem of stems) if (hookStems.has(stem)) sharedHook += 1;
  let sharedPrior = 0;
  for (const stem of stems) if (prior.has(stem)) sharedPrior += 1;
  const words = line.trim().split(/\s+/).filter(Boolean);
  const tail = words.slice(-8).join(' ').toLowerCase();
  const tailStems = contentStems(tail);
  let tailCallback = 0;
  for (const stem of tailStems) if (hookStems.has(stem)) tailCallback += 1;
  const concrete = (line.match(/\b[a-z]{5,}\b/gi) ?? []).length;
  const thirds = (line.match(/,/g) ?? []).length >= 2 || /\. .+\. .+\./.test(line) ? 1 : 0;
  const lastClause = words.slice(-6).join(' ');
  const understated = /\b(quietly|just|only|still|already|never)\b/i.test(lastClause) ? 1 : 0;
  return sharedHook * 3 + sharedPrior + tailCallback * 2 + Math.min(2, Math.floor(concrete / 4)) + thirds + understated;
}

/** Pick the best of 2–3 candidate punchlines. Null when none pass craft + the caller’s extra check. */
export function pickBestPunchline(
  candidates: readonly string[],
  setup: { hook: string; twist: string; move: string },
  extraOk: (line: string) => boolean = () => true,
): string | null {
  let best: string | null = null;
  let bestScore = -1;
  const seen = new Set<string>();
  for (const raw of candidates) {
    const line = raw.trim();
    if (!line || seen.has(line.toLowerCase())) continue;
    seen.add(line.toLowerCase());
    if (!extraOk(line)) continue;
    const score = scorePunchline(line, setup);
    if (score > bestScore) {
      best = line;
      bestScore = score;
    }
  }
  return best;
}

/** The style for one card, seeded (same card → same style; neighbours differ). */
export function cardJokeStyle(seed: string): CardJokeStyle {
  return CARD_JOKE_STYLES[fnv1a(seed) % CARD_JOKE_STYLES.length]!;
}

/** The prompt rules for the one joke line. Static (cache-friendly): the style
 * for this card is given at the very end of the prompt as "JOKE STYLE". */
export const CARD_JOKE_RULES = `"funny" — THE ONE JOKE (a named exception to "tease kindly": this single sentence may be drier or darker).
  Use the JOKE STYLE given at the end. One sentence, under ${CARD_JOKE_MAX_CHARS} characters, about a situation the reader's
  side lands them in. Joke about the situation, never the person. Specific concrete detail beats a general observation.
  Land the laugh in the last six to eight words. Never explain the joke. No puns for their own sake. No stock clichés
  (walk into a bar, plot twist, living the dream). Clearly funny on its own, not a riddle.
  ${STORY_JOKE_ALLOWED}
  Never, whatever the style:
${STORY_JOKE_BANS.map((line) => `  - ${line}`).join('\n')}`;

/** Why a joke line may not be shown (the card's own line rules still apply on top). */
export function cardJokeViolation(text: string): string | null {
  const line = text.trim();
  if (!line) return 'empty';
  if (line.length > CARD_JOKE_MAX_CHARS) return 'too long';
  if ((line.match(/[.?]\s+\S/g) ?? []).length > 0) return 'more than one sentence';
  if (jokeCrossesBoundary(line)) return 'crosses a boundary';
  if (/#/.test(line)) return 'hashtag';
  if (EXPLAINS_THE_JOKE.test(line)) return 'explains the joke';
  return null;
}
