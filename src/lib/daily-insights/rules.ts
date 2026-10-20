/**
 * Copy rules for the daily-insights banks (docs/daily-insights/README.md).
 * Run by check:daily-insights-bank over every stored line, and by the picker
 * over the composed "Why you" line. Pure — no React Native, no network.
 */
import {
  STORY_CLINICAL_CARD6,
  STORY_GENDERED_PRONOUNS,
  STORY_ROMANCE_LABELS,
} from '@/lib/story-v3/banned';
import { jokeCrossesBoundary } from '@/lib/voice/card-joke';
import { CLINICAL_ADVICE, hasClinicalLabel } from '@/lib/voice/clinical';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

/** Rule 1 — "you" only. Extends the story lists with the extra words. */
const EXTRA_GENDERED = /\b(man|woman|men|women|guy|guys|girl|girls)\b/i;
/** Rule 4 — no claims of measured ability. */
const ABILITY_CLAIMS = /\b(gifted|genius|iq|talent score|you are the best)\b/i;
/**
 * Rule 5 — no clinical or medical advice, no diagnosis or label pinned on the
 * reader (emci 2026-10-19, round 3: context, not blanket bans;
 * src/lib/voice/clinical.ts). "Therapy", "toxic", "trauma" or "panic attack" as
 * words in a line or a joke are fine; telling the reader to get, book or change
 * therapy or meds is clinical advice, and "You're toxic", "Your trauma explains
 * this", "You have ADHD" or "diagnos…" are verdicts about the reader.
 */
const CLINICAL_EXTRA = {
  test: (text: string): boolean => hasClinicalLabel(text) || CLINICAL_ADVICE.test(text),
};
/**
 * Rules 6 and 10 (emci 2026-10-19: ATO is 18+, judge the line, not its topic):
 * death, drinking, money, exes, quitting and swearing (strong swearing included,
 * round 3) are fine to mention. Only the shared harm filter refuses (encouraging
 * self-harm or drunk driving, slurs, explicit sex). A 🎯 task is an instruction,
 * so it keeps its own action rules below.
 */
/**
 * Rule 10b — 🎯 tasks only (emci 2026-10-14; by action and risk 2026-10-19;
 * round 3, emci 2026-10-19: "spending money, travelling or involving another
 * person are NOT automatically unsafe; judge the specific action, cost, consent
 * and risk; keep ordinary tasks practical and optional").
 *
 * A task stays small, practical and optional: always fine to skip, and under
 * 15 minutes when a time is stated. Allowed:
 * - a small optional purchase for yourself at ordinary scale: a named small item
 *   (`SMALL_ITEM`: a coffee, a fruit, a snack, a pastry…) or an amount up to
 *   `SMALL_TREAT_MAX` (10 dollars / euros / pounds) spent on yourself
 *   ("Buy yourself a coffee and drink it slowly", "Spend 5 dollars on yourself");
 * - going somewhere ordinary ("Walk to the corner shop", "Take the stairs",
 *   "Take the bus one stop earlier");
 * - a light contact with a consenting person ("Invite a friend for a coffee this
 *   week", "Text someone you miss", "Ask a coworker how their weekend was").
 * Refused (the action, its cost, consent and risk — never a topic word):
 * - spending beyond a small treat for yourself (a hoodie, takeout for the team,
 *   the next round, a paid ride), and large or irreversible money moves (sending,
 *   lending or investing money, tips, loans, sign-ups, subscriptions, bookings);
 * - a trip rather than an errand (driving somewhere, flights, a train to a new
 *   town, a night out at a bar or club);
 * - alcohol or substances as the goal (get drunk or high, have a beer); inviting
 *   someone is fine, inviting them "for drinks" is not;
 * - gambling and betting; quitting or resigning;
 * - contacting an ex or someone who has not invited contact (ghosted you,
 *   blocked you, a stranger), meeting strangers from the internet;
 * - dangerous acts and body or safety stunts (holding your breath, ice baths,
 *   roofs, skipping meals or sleep, fasting, tattoos);
 * - anything that needs a long block of time (an hour, a film, a meal or a
 *   meet-up in person).
 *
 * Each pattern is an instruction: a verb in command position (start of a
 * sentence or clause, or after "and / then / just / go / try to …") plus the
 * object that makes it risky. A task may still MENTION food, a bar, money, a
 * job or an ex ("Write down what you spent this week"). Pure.
 */
const LEAD = String.raw`(?:^|[.!?:;,—–]\s*|\b(?:and|then|or|just|go|now|today|first|instead|maybe|try to|try and|please|finally)\s+)`;
const ALCOHOL = String.raw`(?:beers?|wines?|shots?|cocktails?|booze|alcohol|pints?|whiske?y|vodka|tequila|gin|rum|liquor|spirits|champagne|prosecco|margaritas?)`;

function instruction(body: string): RegExp {
  return new RegExp(`${LEAD}(?:go\\s+)?(?:${body})`, 'i');
}

/** The most a "small treat for yourself" may cost (round 3): about the price of a coffee. */
export const SMALL_TREAT_MAX = 10;

/** Small, ordinary things to buy for yourself (round 3). Anything else bought is "more than a small treat". */
const SMALL_ITEM = new RegExp(
  String.raw`^(?:yourself\s+)?(?:(?:a|an|one|some|your|a small|a cheap|your favourite|your favorite|a single)\s+)?(?:(?:small|cheap|nice|fresh|hot|iced|cold|good|fancy|single|little|ripe|new)\s+)?` +
    String.raw`(?:coffee|tea|latte|cappuccino|flat white|espresso|hot chocolate|snack|pastry|croissant|muffin|cookie|biscuit|doughnut|donut|bagel|fruit|piece of fruit|apple|banana|orange|pear|peach|mango|berries|ice cream|ice lolly|popsicle|chocolate(?: bar)?|candy bar|smoothie|juice|sandwich|bun|cake|slice of cake|flowers?|postcard|plant|notebook|pen|magazine|bottle of water|water)\b`,
  'i',
);
/** Buying for a crowd is more than a small treat ("for the team", "the next round"). */
const FOR_A_GROUP = /\bfor (?:the |your |all |every |a whole )?(?:team|office|everyone|everybody|table|group|whole \w+|round|crew|squad|coworkers|colleagues|friends|family|all of (?:them|you))\b/i;

const BUY = instruction(
  String.raw`(?:buy|purchase|pre-?order|splurge on|pay for|treat (?:yourself|someone|somebody|a friend|them|your \w+) to|order(?= (?:a|an|some|food|takeout|takeaway|delivery|in|online|yourself|something|dessert|coffee|drinks?|lunch|dinner|breakfast|pizza)\b))\s+([^.!?;]{1,60})`,
);
const CURRENCY = String.raw`(?:dollars?|bucks?|euros?|pounds?|quid)`;
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  'a few': 5, 'a couple of': 2, 'a couple': 2, twenty: 20, fifty: 50, 'a hundred': 100, hundred: 100,
};
const SPEND_AMOUNT = instruction(
  String.raw`spend (?:up to |about |around |under |less than |no more than |only |just )?(?:([$£€])\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?|a few|a couple(?: of)?|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|a hundred|hundred) ${CURRENCY})\b([^.!?;]{0,50})`,
);
const SPEND_UNSCALED = instruction(
  String.raw`(?:shop for|go shopping|go on a shopping|spend (?:some |a little |real |more |lots of |a lot of )?(?:money|cash)\b|splurge\b)`,
);
const ON_YOURSELF = /^\s*on (?:yourself|a (?:small )?treat|something (?:small |nice |little )?for yourself|(?:a|an|one) (?:coffee|snack|pastry|fruit|treat|tea|latte|smoothie|ice cream)\b)/i;

/** Why a purchase instruction goes past a small treat for yourself, or null. */
function spendsMoney(text: string): string | null {
  const buy = text.match(BUY);
  if (buy) {
    const object = (buy[1] ?? '').trim();
    if (!SMALL_ITEM.test(object) || FOR_A_GROUP.test(object)) return buy[0];
  }
  const amount = text.match(SPEND_AMOUNT);
  if (amount) {
    const raw = (amount[2] ?? amount[3] ?? '').toLowerCase();
    const n = /^\d/.test(raw) ? Number(raw) : (NUMBER_WORDS[raw.replace(/ of$/, '')] ?? Infinity);
    if (n > SMALL_TREAT_MAX || !ON_YOURSELF.test(amount[4] ?? '')) return amount[0];
  }
  const unscaled = text.match(SPEND_UNSCALED);
  return unscaled ? unscaled[0] : null;
}

function rx(re: RegExp): (text: string) => string | null {
  return (text) => text.match(re)?.[0] ?? null;
}

const TASK_ACTION_RULES: readonly { reason: string; hit: (text: string) => string | null }[] = [
  { reason: 'spends money beyond a small treat for yourself', hit: spendsMoney },
  {
    reason: 'large or irreversible money move',
    hit: rx(
      instruction(
        String.raw`(?:donate|subscribe to|venmo|invest|co-?sign|max out|pay off|take out a loan|borrow money|lend\b)` +
          String.raw`|(?:buy|trade|sell) (?:some )?(?:stocks?|shares|crypto|bitcoin|an? nft|nfts)\b` +
          String.raw`|apply for (?:a |an )?(?:loan|credit card|mortgage)\b` +
          String.raw`|book (?:a|an|the|yourself|tickets?|flights?|tables?|trips?|classes?|sessions?|appointments?|massages?|hotels?|holidays?)\b` +
          String.raw`|(?:send|give|lend|loan|wire|transfer|gift|tip|pay|venmo|cash app)\b[^.!?]{0,40}?(?:[$£€]\s?\d|\b(?:\d+|a few|some|ten|five|twenty) ${CURRENCY}\b|\b(?:money|cash)\b)` +
          String.raw`|tip (?:someone|somebody|them|a (?:stranger|barista|waiter|waitress|server|driver|bartender)|the (?:driver|waiter|waitress|barista|server|bartender)|your (?:driver|waiter|waitress|barista|server|bartender))\b` +
          String.raw`|pick up the (?:tab|bill|check)\b|pay (?:someone|somebody)\b` +
          String.raw`|sign up for (?:a |an |the |your )?(?:paid|premium|course|courses|membership|gym|class|classes|subscription|trial|marathon|race)\b`,
      ),
    ),
  },
  {
    reason: 'a trip or a paid ride, not an ordinary errand',
    hit: rx(
      instruction(
        String.raw`(?:road[- ]trip|go for a drive|take a drive|travel\b|fly (?:to|somewhere|out|home|abroad)\b|catch a (?:flight|plane)\b)` +
          String.raw`|drive (?:somewhere|around|out|across|upstate|to (?:a |an |the |somewhere|another|a new)|for (?:an?|the) )` +
          String.raw`|take (?:a |an |the |your )?(?:car|flight|plane|ferry)\b` +
          String.raw`|(?:take|call|order|hail|book|get) (?:a |an |the )?(?:taxi|cab|uber|lyft)\b` +
          String.raw`|take (?:a |an |the |your )?(?:train|bus|coach|metro|subway|tram) (?:to|out to|into|across|upstate)\b(?! (?:work|school|the office|your office|home)\b)` +
          String.raw`|(?:head|go|walk) (?:out )?to (?:a|the) (?:bar|pub|club|nightclub|restaurant|mall|cinema|movies|beach|city|airport|casino|concert|festival|theme park)\b` +
          String.raw`|(?:go|head|visit) (?:to )?(?:a |an |the )?(?:new |another |different |nearby )?(?:town|city|country)\b|go abroad\b`,
      ),
    ),
  },
  {
    // Alcohol as the goal. Inviting someone is fine; "for drinks" makes the alcohol the point.
    reason: 'alcohol or substances',
    hit: rx(
      instruction(
        String.raw`(?:drink|have|grab|order|pour(?: yourself)?|crack open|crack|open|pop|sip|chug|sink|finish|enjoy|nurse|share|down|do) (?:a |an |one |some |two |a few |a couple of |your )?(?:cold |glass of |bottle of |can of )?${ALCOHOL}\b` +
          String.raw`|(?:crack|pop|open|sip|have|grab|drink|down) (?:a |an |one )?(?:cold|stiff) one\b` +
          String.raw`|(?:invite|ask|take) (?:\w+ ){0,3}(?:for|out for|to) drinks\b` +
          String.raw`|(?:get|go get) (?:drunk|high|wasted|tipsy|stoned)\b|(?:smoke|vape|take an? edible|light up)\b` +
          String.raw`|(?:grab|get|go for|have) (?:a |some )?drinks?\b(?! of water)`,
      ),
    ),
  },
  {
    reason: 'gambling',
    hit: rx(
      instruction(
        String.raw`(?:bet|gamble|wager)\b|place a bet\b|buy (?:a )?(?:lottery|scratch)|play (?:the )?(?:lottery|slots|poker|blackjack|roulette)\b`,
      ),
    ),
  },
  {
    reason: 'quits a job',
    hit: rx(
      instruction(
        String.raw`(?:resign|quit (?:your |the )?(?:job|role|position|work|team)|hand in (?:your )?notice|give (?:your )?notice|walk out on (?:your )?(?:job|boss|shift))\b` +
          String.raw`|tell (?:your )?boss (?:you(?:'|’)re|you are) (?:leaving|done|quitting)` +
          String.raw`|tell (?:your |the )?(?:boss|manager|supervisor|employer)[^.!?]{0,25}\b(?:quit|quitting|leaving|resign\w*)\b`,
      ),
    ),
  },
  {
    // No consent: an ex, someone who pulled back, or a stranger (round 3).
    reason: 'contacts an ex or someone who has not invited contact',
    hit: rx(
      instruction(
        String.raw`(?:text|call|message|dm|email|e-mail|ring|ping|contact|reach out to|write to|send|meet(?: up with)?|see|visit|unblock|follow|check on|like|reply to|answer) ` +
          String.raw`(?:your |an |the |that )?(?:ex|exes|ex-partner|ex-boyfriend|ex-girlfriend|ex-wife|ex-husband|former partner|old flame)\b(?!['’]s? (?:advice|number|photos?|stuff))` +
          String.raw`|(?:send|mail|post|write) (?:a |an |your )?(?:letter|note|message|email|text|dm|card) to (?:your |an |the |that )?(?:ex|exes|ex-partner|former partner|old flame)\b[^.!?]*\b(?:and|then) (?:send|post|mail|deliver) it\b` +
          String.raw`|(?:send|mail|post) (?:a |an |your )?(?:letter|note|message|email|text|dm|card) to (?:your |an |the |that )?(?:ex|exes|ex-partner|former partner|old flame)\b` +
          String.raw`|(?:text|call|message|dm|email|e-mail|ring|ping|contact|reach out to|write to|follow up with|show up at|turn up at|visit|check on|go see|unblock) (?:the |that |a )?(?:someone|somebody|anyone|one|person|people|friend)? ?who (?:ghosted|blocked|unfollowed|muted|cut you off|stopped (?:replying|talking to you|answering)|left you on read|dumped you|rejected you|broke up with you|asked you (?:not to|to stop)|does not want|doesn['’]t want|never (?:replied|answered|wrote back))` +
          String.raw`|(?:dm|message|text|call|email|add|follow) (?:a |some )?(?:random )?(?:strangers?|someone you (?:do not|don['’]t) know|someone you(?: have|['’]ve) never met)\b` +
          String.raw`|show up (?:unannounced|uninvited)|(?:show|turn) up at (?:someone|somebody|their)(?:['’]s)? (?:door|house|place|flat|work|office)`,
      ),
    ),
  },
  {
    reason: 'risky to body or safety',
    hit: rx(
      instruction(
        String.raw`(?:skip (?:a |your |every )?(?:meals?|breakfast|lunch|dinner|sleep|water)|fast (?:for|all|until|today|tonight|tomorrow|this \w+)|go without (?:food|sleep|water)|stay up all night)\b` +
          String.raw`|(?:hold your breath|take an? (?:ice bath|cold plunge)|jump (?:off|from)|climb (?:(?:up|onto|on|over) )?(?:a |the |your )?(?:roof|fence|cliff|wall|tower|tree|ladder|crane))\b` +
          String.raw`|(?:walk|go out|wander) alone at night\b|hitchhike\b|get (?:a |an )?(?:tattoo|piercing)\b` +
          String.raw`|meet (?:up with )?(?:a |some )?strangers?\b|meet (?:up with )?(?:someone|somebody|a person|people|a match) (?:from (?:the internet|online|an app|a dating app)|you met (?:online|on an app|on the internet))\b` +
          String.raw`|(?:run|keep going|push (?:yourself|on)|lift) (?:\w+ )?until (?:it hurts|you (?:drop|puke|pass out|collapse))\b` +
          String.raw`|(?:run a red|text (?:and|while) (?:you )?driv)`,
      ),
    ),
  },
];

/** Number words a task might use for a duration. */
const DURATION_WORDS: Record<string, number> = {
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, 'twenty-five': 25,
  thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90,
};
/** Minutes named in a task must stay under 15 ("20-minute walk", "twenty minutes"). */
const TASK_MINUTES = /\b(\d+|[a-z]+(?:-[a-z]+)?)[- ]min(?:ute)?s?\b/i;
/** Any duration in hours, or a whole part of the day, is 15 minutes or more. */
const TASK_LONG = /\b(?:an?|one|two|three|a few|a couple of|half an|\d+(?:\.\d+)?)[- ]hours?\b|\bhalf an hour\b|\ball (?:day|morning|afternoon|evening|night|weekend)\b|\bthe whole (?:day|morning|afternoon|evening|weekend)\b/i;

/**
 * Activities that take 15 minutes or more by nature. Refused unless the task
 * itself states a duration under 15 minutes ("Watch a 5-minute clip" is a
 * different phrase and does not match; "Watch an episode in 10 minutes" would).
 * Round 3: meeting someone in person (a meet-up, a meal, a visit, a night out)
 * is a long block of time, not a safety problem; inviting them is a quick task.
 */
const TASK_LONG_ACTIVITY = instruction(
  String.raw`(?:watch|stream|finish) (?:a |an |the |one |another |your )?(?:whole |full |entire |new )?(?:movie|film|episode|show|series|season|documentary)\b` +
    String.raw`|binge\b` +
    String.raw`|(?:take|go (?:on|for)|do) (?:a |an )?(?:long|big|slow) (?:walk|run|hike|jog|bike ride|ride|swim|drive|bath|nap|stroll)\b` +
    String.raw`|(?:clean|tidy|organi[sz]e|declutter|sort|reorgani[sz]e|scrub|deep[- ]clean) (?:out |up )?(?:the |your |all |every |each )?(?:whole|entire|all|every|each)\b` +
    String.raw`|(?:clean|tidy|organi[sz]e|declutter) (?:out )?(?:the |your )?(?:whole|entire) \w+\b` +
    String.raw`|(?:meet up with|hang out with|go out with|go out for|get together with|spend (?:the |an? )?(?:afternoon|evening|day|night|weekend) with)\b` +
    String.raw`|meet (?:up |with )?(?:a |an |your |the |some )?(?:friends?|colleagues?|coworkers?|people|family|parents?)\b` +
    String.raw`|visit (?:a |an |your |the )?(?:friend|colleague|coworker|neighbou?r|family|mom|mum|dad|parents?|grandma|grandpa|grandparents|sibling|sister|brother)\b` +
    String.raw`|(?:have|grab|get|go for) (?:a |an )?(?:lunch|dinner|brunch|breakfast|meal|bite) (?:with|together)\b`,
);

export const INSIGHT_LINE_MAX_WORDS = 20;
export const INSIGHT_SUB_MAX_WORDS = 16;
export const INSIGHT_TITLE_MAX_WORDS = 4;
export const WHY_LINE_MAX_WORDS = 22;

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[A-Za-z0-9]/.test(token)).length;
}

/**
 * Every violation in one user-facing string (empty = clean). `maxWords: null`
 * skips the length rule.
 */
export function validateInsightLine(text: string, opts: { maxWords: number | null }): string[] {
  const out: string[] = [];
  if (!text.trim()) out.push('empty');
  if (opts.maxWords != null && wordCount(text) > opts.maxWords) {
    out.push(`over ${opts.maxWords} words (${wordCount(text)})`);
  }
  if (STORY_GENDERED_PRONOUNS.test(text) || STORY_ROMANCE_LABELS.test(text) || EXTRA_GENDERED.test(text)) {
    out.push('gendered word');
  }
  if (containsFrameworkTerm(text)) out.push('framework term');
  if (ABILITY_CLAIMS.test(text)) out.push('ability claim');
  if (STORY_CLINICAL_CARD6.test(text) || CLINICAL_EXTRA.test(text)) out.push('clinical word');
  if (jokeCrossesBoundary(text)) out.push('crosses a boundary');
  if ((text.match(/!/g) ?? []).length > 1) out.push('more than one exclamation mark');
  return out;
}

const clip = (hit: string) => hit.replace(/^[\s.!?:;,—–]+/, '').trim();

/** Rule 10b for one 🎯 task line. Empty = clean. Pure. */
export function taskSafetyViolations(text: string): string[] {
  const out: string[] = [];
  for (const rule of TASK_ACTION_RULES) {
    const hit = rule.hit(text);
    if (hit) out.push(`task action: ${rule.reason} ("${clip(hit)}")`);
  }
  const minutes = text.match(TASK_MINUTES);
  if (minutes) {
    const raw = minutes[1]!.toLowerCase();
    const n = /^\d+$/.test(raw) ? Number(raw) : DURATION_WORDS[raw];
    if (n != null && n >= 15) out.push(`task over 15 minutes (${minutes[1]})`);
  }
  const longActivity = text.match(TASK_LONG_ACTIVITY);
  if (longActivity) {
    const raw = minutes?.[1]?.toLowerCase();
    const n = raw == null ? null : /^\d+$/.test(raw) ? Number(raw) : (DURATION_WORDS[raw] ?? null);
    const shortStated = raw != null && (n == null ? /^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)$/.test(raw) : n < 15);
    if (!shortStated) {
      out.push(`task over 15 minutes (long activity, no short time stated: "${clip(longActivity[0])}")`);
    }
  }
  const long = text.match(TASK_LONG);
  if (long) out.push(`task over 15 minutes ("${long[0]}")`);
  return out;
}

/** Sentence-case title: first letter capital, later words lower (bar "I"). */
export function titleViolation(title: string): string | null {
  if (wordCount(title) > INSIGHT_TITLE_MAX_WORDS) return `title over ${INSIGHT_TITLE_MAX_WORDS} words`;
  const words = title.trim().split(/\s+/);
  if (!/^[A-Z]/.test(words[0] ?? '')) return 'title must start with a capital';
  for (const word of words.slice(1)) {
    if (/^[A-Z]/.test(word) && word !== 'I') return `title not sentence case ("${word}")`;
  }
  return null;
}

/** Split into sentences and normalize, for the duplicate tag-phrase rule. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?:])\s+/)
    .map((s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9' ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/** Sentences of 2+ words that appear in more than one string of a bank. */
export function duplicateSentences(texts: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const sentence of new Set(sentencesOf(text))) {
      if (sentence.split(' ').length < 2) continue;
      counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
}

/** Words too common to make a phrase "repeated" on their own. */
const PHRASE_STOP = new Set([
  'a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'it', 'is', 'you', 'your', 'one', 'that', 'for', 'with',
  'be', 'or', 'at', 'as', 'its', "it's", 'this', 'than', 'then', 'what', 'when', 'out', 'up', 'can', 'do',
]);

/**
 * Three-word phrases that appear in more than one string of a bank (emci
 * 2026-10-14: no repeated phrases in a bank). A phrase made only of common
 * words ("one of the") does not count.
 */
export function repeatedPhrases(texts: readonly string[], size = 3): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/[^a-z0-9' ]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const seen = new Set<string>();
    for (let i = 0; i + size <= words.length; i += 1) {
      const gram = words.slice(i, i + size);
      if (gram.every((word) => PHRASE_STOP.has(word))) continue;
      seen.add(gram.join(' '));
    }
    for (const gram of seen) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([gram]) => gram);
}

/** Rule 11 — one apostrophe style across a bank. */
export function mixedApostrophes(texts: readonly string[]): boolean {
  const joined = texts.join(' ');
  return joined.includes("'") && joined.includes('’');
}
