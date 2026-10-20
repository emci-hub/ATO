/**
 * One shared clinical-label rule for every surface that writes about the reader:
 * Story card, Legends/deep-dive AI lines, daily insights, Story v3 card 6.
 *
 * CONTEXT, NOT BLANKET BANS (emci 2026-10-19, round 3: "don't globally ban words
 * like toxic, clingy, or attachment terms. Block unsupported labels applied to
 * users, not legitimate discussion or contextual jokes").
 *
 * Words as plain vocabulary pass: "a toxic workplace", "my clingy cat",
 * "attachment to old photos", "avoidant of small talk", "bipolar weather",
 * "the group chat needs therapy", "trauma-bonded by a bad haircut",
 * "a panic attack of a Monday", "depressed about Monday".
 *
 * Refused: a label or diagnosis APPLIED TO THE READER or stated as a verdict about
 * them ("You are clearly bipolar", "You're toxic", "Your avoidant attachment explains
 * this", "You have ADHD", "That is so narcissistic of you", "Classic ADHD behaviour",
 * "people like you are needy", "depression in how you plan"); a diagnosis CLAIM
 * ("a diagnosis", "you were diagnosed", "diagnosed with ADHD"; 2026-10-20: the claim
 * forms only, so "this is not a diagnosis" and "diagnosed with a bad case of Mondays"
 * pass); and clinical ADVICE (get therapy, stop your meds). `CLINICAL_ADVICE` is
 * separate so callers combine the two.
 *
 * LABELS IN CONTEXT, FOR EVERYONE (emci 2026-10-20): `readerLabelHit` is the strict
 * reader/addressed-person rule and stays as is. `labelVerdictHit` is the context-aware
 * layer on top: it also catches a clinical verdict about a real third person ("your boss
 * is a narcissist", "she's clearly bipolar") and lets the sentence through when it is
 * reported speech ("she called him a narcissist"). The five classes, and what code can
 * tell apart, are listed on `labelVerdictHit`.
 *
 * Feelings are not labels: "you feel needy", "you get anxious", "you may feel
 * insecure" describe a moment and pass. Shareable titles keep their own stricter
 * tone list (a title IS a name for the reader), see legend-figures/story.ts.
 *
 * Pure, no imports. Pinned by check:daily-insights-bank, check:category-deep-dive,
 * check:story-thread (pass/fail pairs).
 */

/** Labels that are a verdict when pinned on a person (adjectives and "a <noun>"). */
const LABEL = String.raw`(?:toxic|needy|clingy|co-?dependent|red[- ]flags?|avoidant(?! (?:of|about|around) )|(?:fearful|dismissive)[- ]avoidant|(?:anxious(?:ly)?|insecure(?:ly)?|secure(?:ly)?|disorgani[sz]ed)[- ]attached|emotionally unavailable|neurotic|narcissists?|narcissistic|psychopaths?|psychopathic|sociopaths?|sociopathic|gaslighters?|bipolar|adhd|ocd|ptsd|autistic|borderline personality|manic|psychotic|depressed|depressive|mentally ill|crazy|insane|traumati[sz]ed|damaged|defective|broken(?! (?:up|in|into|down)\b))`;

/** Conditions and theory labels as nouns ("your trauma", "you have ADHD"). Ends on a full word. */
const CONDITION = String.raw`(?:(?:clinical |major )?depression|bipolar(?: disorder)?|adhd|ocd|ptsd|autism|narcissism|narcissistic personality|borderline(?: personality)?|codependen(?:cy|ce)|trauma|attachment (?:styles?|issues|wounds?|disorder)|abandonment issues|(?:avoidant|anxious|insecure|secure|disorgani[sz]ed|fearful)[- ]attachment|social anxiety|(?:panic|anxiety) attacks?|mental illness(?:es)?|psychosis|neurosis|[a-z]+[- ]disorders?|disorders?)(?![-\w])`;

/** Little words that sit between "you're" and the label: "you're so / clearly / a bit of a …". */
const FILL = String.raw`(?:(?:so|clearly|really|totally|truly|a|an|the|bit|little|kind|kinda|sort|of|pretty|very|such|obviously|just|definitely|probably|basically|literally|completely|super|quite|being|actually|honestly|lowkey|textbook|classic|total|real|full-on|full-blown|most|more|too|deeply|seriously|severely|clinically|mildly|slightly|somewhat|getting|becoming|acting|still|always|also|kind-of|walking|raging|certified)\s+){0,4}`;

/** "you're", "you seem", "you come across as", "you can be" … (not "you feel": a feeling is not a label). */
const YOU_ARE = String.raw`\byou(?:['’]re|['’]ve been| are| were| seem to be| seem like| seemed like| seem| seemed| sound like| sounded like| sound| sounded| look like| looked like| look| looked| act like| acted like| come across as| came across as| act| acted| behave| become| became| turn into| turned into| can be| could be| might be| may be| must be| would be| will be| get called| deserve to be called)\s+`;

/** Nouns that make "your <label> <noun>" still about the reader ("your avoidant side"). */
const YOUR_TAIL = String.raw`(?:[- ](?:attachment|attached|style|styles|side|streak|energy|habits?|behaviou?rs?|tendenc(?:y|ies)|issues?|brain|self|traits?|personality|response|wounds?|patterns?|mode|thing|disorder|episode))*`;

/** Verbs (or the end of a clause) that make "your <label>" a verdict ("is showing", "explains this"). */
const YOUR_VERB = String.raw`(?=\s+(?:is|are|was|were|isn['’]t|shows?|showing|showed|shows up|showed up|showing up|explains?|explained|means|meant|kicks? in|kicked in|comes? out|came out|again|strikes|struck|wins|won|makes?|made|took|takes?|talking|acting|flares?|at work|in action|on display|says|said|did|does|has|had|just|really|would|will|can|could|might|may|must|got|gets|getting|tells?|told|needs?|needed|keeps?|kept|wants?|wanted|loves?|hates?|ran|runs|ruins?|ruined|took over|takes over|answered|picked|chose|decided)\b|\s*[.,;:!?…—–)]|\s*$)`;

/** Diagnosis claim forms (see the `diagnosis` rule below). Negated disclaimers and idioms are not matched. */
const NOT_BEFORE = String.raw`(?<!\b(?:not|never|no|without|isn['’]t|aren['’]t|wasn['’]t|doesn['’]t|don['’]t|not even|not really)\s)`;
const FIGURATIVE_DIAGNOSER = String.raw`(?:the |a |my |your |our )?(?:group chat|internet|google|algorithm|horoscope|thermostat|inbox|calendar|wi-?fi|mirror|fridge|spreadsheet)`;
const DIAGNOSIS_CLAIM = new RegExp(
  [
    // "a diagnosis", "your diagnosis", "this is a diagnosis" — unless negated ("not a diagnosis").
    String.raw`${NOT_BEFORE}\b(?:a|an|your|his|her|their|this|that|the)\s+(?:\w+\s+){0,2}?diagnos(?:is|es)\b`,
    // "you were diagnosed", "you've been diagnosed with ..." — unless the idiom / a figurative source.
    String.raw`\byou(?:['’]ve|['’]re| have| are| were| got| get| had)?\s+(?:been |being )?(?:\w+\s+){0,2}?(?:un|self-?)?diagnosed\b(?!\s+(?:you )?(?:with (?:an? )?(?:\w+ )?case of|by ${FIGURATIVE_DIAGNOSER}))`,
    // "diagnosed with ADHD" about anyone (a real person), not "with a bad case of Mondays".
    String.raw`\bdiagnosed with\s+(?:an? |full-blown |severe |mild |clinical |major )*(?:adhd|ocd|ptsd|autism|bipolar|depression|anxiety|narcissistic|borderline|schizophrenia|psychosis|a personality disorder|[a-z]+ disorder)\b`,
    // "I can diagnose you", "diagnosing yourself".
    String.raw`\bdiagnos(?:e|es|ing)\s+(?:you|yourself|your)\b`,
    String.raw`\b(?:i|we|ato|this app|the app)(?:['’]ll| will| can| could| would)?\s+diagnose\b`,
  ].join('|'),
  'i',
);

/**
 * Reader-directed label and diagnosis patterns. Each one needs the reader in it
 * ("you", "your", "of you", "people like you") or is a verdict form ("classic ADHD").
 */
export const READER_LABEL_PATTERNS: readonly { name: string; re: RegExp }[] = [
  // "You're so toxic", "You are clearly bipolar", "you come across as a bit needy", "you can be clingy".
  { name: 'you are <label>', re: new RegExp(`${YOU_ARE}${FILL}${LABEL}(?![-\\w])`, 'i') },
  // "people like you are needy".
  { name: 'people like you are <label>', re: new RegExp(String.raw`\bpeople like you (?:are|get|tend to be|can be|seem)\s+${FILL}${LABEL}(?![-\w])`, 'i') },
  // "Your avoidant attachment explains this", "Your trauma is showing", "your toxic side".
  {
    name: 'your <label> (is|shows|means)',
    re: new RegExp(String.raw`\byour (?:own |inner |classic |usual |old |little |whole |undiagnosed )?(?:${LABEL}|${CONDITION})${YOUR_TAIL}${YOUR_VERB}`, 'i'),
  },
  // "Your habit is toxic", "your texting is so needy": a verdict on the reader's own behaviour.
  // ("Your group chat is toxic" passes: the chat is not the reader.)
  {
    name: 'your <behaviour> is <label>',
    re: new RegExp(
      String.raw`\byour (?:\w+ )?(?:habits?|behaviou?rs?|attitude|personality|texting|texts|replies|reply|vibe|energy|side|self|ways?|style|love language|tendenc(?:y|ies)|patterns?|mindset|brain|mind|heart|needs?|responses?|reactions?|moves?|thing) (?:is|are|was|were|seems?|sounds?|looks?|feels?|gets?|got|reads? as|comes? across as)\s+${FILL}${LABEL}(?![-\w])`,
      'i',
    ),
  },
  // "You have ADHD", "you've got trauma", "you probably have an anxiety disorder".
  {
    name: 'you have <condition>',
    re: new RegExp(
      String.raw`\b(?:you (?:have|had|probably have|clearly have|definitely have|obviously have|might have|may have|must have|could have|seem to have|suffer from|are suffering from|live with)|you['’]ve (?:got|had|clearly got)|you(?:['’]re| are) (?:dealing|living) with|sounds like you have)\s+(?:(?:a|an|some|full-blown|textbook|classic|mild|severe|serious|real|undiagnosed|untreated|bit of|touch of|of|the)\s+){0,3}${CONDITION}`,
      'i',
    ),
  },
  // "That is so bipolar of you", "Very narcissistic of you".
  { name: '<label> of you', re: new RegExp(String.raw`(?<![-\w])${LABEL}\s+(?:(?:move|thing|behaviou?r)\s+)?of you\b`, 'i') },
  // "a classic narcissist", "Classic ADHD behaviour", "textbook avoidant".
  {
    name: 'a classic <label>',
    re: new RegExp(
      String.raw`\b(?:classic|textbook|typical|certified|card-carrying|full-blown|full-on|raging|walking)\s+(?:narcissis\w*|psychopath\w*|sociopath\w*|adhd|ocd|ptsd|bipolar|avoidant|(?:anxious(?:ly)?|secure(?:ly)?|insecure(?:ly)?|disorgani[sz]ed|fearful)[- ]attach\w*|co-?dependen\w*|neurotic|borderline|depressive|autistic|trauma response|gaslighter)(?![-\w])`,
      'i',
    ),
  },
  // A condition located in the reader: "depression in how you plan", "a narcissist in you".
  {
    name: '<condition> in you',
    re: new RegExp(
      String.raw`(?<![-\w])(?:${CONDITION}|${LABEL})(?:\s+(?:habits?|tendenc(?:y|ies)|streaks?|patterns?|behaviou?rs?|traits?|energy|side|vibes?))?\s+in (?:(?:how|the way|what|when|where) you\b|you\b(?!r))`,
      'i',
    ),
  },
  // "signs of depression", "symptoms of ADHD" — a diagnostic claim.
  { name: 'signs of <condition>', re: new RegExp(String.raw`\b(?:signs?|symptoms?|traces?|hints?) of (?:a |an )?${CONDITION}`, 'i') },
  // A diagnosis CLAIM. Not the bare word: "This is not a diagnosis" and "diagnosed with a
  // bad case of Mondays" pass (a disclaimer, an idiom); "a diagnosis" (not negated), "you were
  // diagnosed", "your diagnosis", "diagnosed with ADHD" (any subject: a real person) and "I can
  // diagnose you" fail. A joke that uses the claim form ("diagnosed by the group chat") is
  // flagged on purpose: a regex cannot tell it from a claim, and the safe side is the claim.
  { name: 'diagnosis', re: DIAGNOSIS_CLAIM },
];

/** The first reader-directed label or diagnosis in `text`, or null. */
export function readerLabelHit(text: string): string | null {
  for (const rule of READER_LABEL_PATTERNS) {
    if (rule.re.test(text)) return rule.name;
  }
  return null;
}

/** Advice to get therapy or change medication is clinical advice; the words alone are fine. */
export const CLINICAL_ADVICE =
  /\b(?:(?:see|try|book|start|get|find|call|go to|you (?:might |may |could |probably )?need) (?:a |an |some |your )?(?:therapy|therapist|counsell?or|counsell?ing|psychiatrist|psychologist)|(?:take|stop|skip|start|change|up|lower|double) (?:your |the |some )?(?:medication|meds|pills|dose))\b/i;

/** True when `text` pins a label or diagnosis on the reader (vocabulary alone passes). */
export function hasClinicalLabel(text: string): boolean {
  return readerLabelHit(text) != null;
}

/** The building blocks of the reader patterns, for sibling rules (jargon.ts) that need the same forms. */
export const VERDICT_PIECES = { FILL, YOU_ARE, YOUR_TAIL, YOUR_VERB } as const;

/** People a clinical verdict can land on. A cat, a thermostat or a group chat is not in this list on purpose. */
const PERSON = String.raw`(?:boss|manager|supervisor|ex|exes|mom|mum|mother|dad|father|brother|sister|sibling|siblings|friend|friends|coworker|co-worker|colleague|partner|girlfriend|boyfriend|husband|wife|roommate|flatmate|neighbou?r|teacher|professor|landlord|landlady|date|parent|parents|in-laws?|mother-in-law|father-in-law|cousin|aunt|uncle|grandma|grandpa|grandmother|grandfather|guy|girl|man|woman|kid|child|coach|therapist|doctor|dentist|president|senator|ceo|crush|situationship|stepmom|stepdad|colleague)`;
const VERB3 = String.raw`(?:['’](?:s|re)|\s+(?:is|was|are|were|seems?(?: to be)?|seemed(?: to be)?|sounds? like|sounded like|acts? like|acted like|must be|might be|may be|has to be|turned out to be|turns out to be|is being|keeps being|really is|literally is|honestly is|definitely is|obviously is|clearly is))`;
/** Labels that are a clinical verdict when pinned on a real person (vernacular like "toxic" or "crazy" is left out here). */
export const CLINICAL_VERDICT_LABEL = String.raw`(?:narcissists?|narcissistic|psychopaths?|psychopathic|sociopaths?|sociopathic|gaslighters?|bipolar|adhd|ocd|ptsd|autistic|schizophrenic|psychotic|borderline personality|mentally ill|co-?dependent)`;
const THIRD_CONDITION = String.raw`(?:adhd|ocd|ptsd|autism|bipolar(?: disorder)?|narcissistic personality(?: disorder)?|borderline personality(?: disorder)?|schizophrenia|psychosis|npd|bpd)(?![-\w])`;

/** Third-person subject + verb, for a given label alternation: "my boss is a narcissist", "she's clearly bipolar". */
export function thirdPartyVerdictRes(labelSource: string): RegExp[] {
  const subject = String.raw`(?:(?:my|your|his|her|their|our|the|that|this|some|every|a|an)\s+(?:[a-z'’-]+\s+){0,2}${PERSON}s?|\bhe|\bshe|\bthey|\bthat\s+guy|\bthat\s+girl)`;
  return [
    new RegExp(String.raw`\b${subject}${VERB3}\s*${FILL}(?:${labelSource})(?![-\w])`, 'i'),
    // "so narcissistic of him", "very bipolar of them".
    new RegExp(String.raw`(?<![-\w])(?:${labelSource})\s+(?:(?:move|thing|behaviou?r)\s+)?of\s+(?:him|her|them)\b`, 'i'),
  ];
}

const THIRD_PARTY_RES: readonly { name: string; re: RegExp }[] = [
  ...thirdPartyVerdictRes(CLINICAL_VERDICT_LABEL).map((re, i) => ({ name: i === 0 ? 'someone is <label>' : '<label> of them', re })),
  {
    name: 'someone has <condition>',
    re: new RegExp(
      String.raw`\b(?:(?:my|your|his|her|their|the|that|this)\s+(?:[a-z'’-]+\s+){0,2}${PERSON}s?|he|she|they)\s+(?:has|had|have|probably has|clearly has|definitely has|obviously has|must have|got|['’]s got)\s+(?:(?:a|an|some|full-blown|textbook|classic|mild|severe|real|undiagnosed|untreated)\s+){0,3}${THIRD_CONDITION}`,
      'i',
    ),
  },
];

/** A clinical label about a real third person, or null. Does not look at the reader (that is `readerLabelHit`). */
export function thirdPartyLabelHit(text: string): string | null {
  for (const rule of THIRD_PARTY_RES) {
    if (rule.re.test(text)) return rule.name;
  }
  return null;
}

/** Someone is quoted or reported, not asserted: "she called him a narcissist", "my mom thinks my boss is a narcissist". */
const ATTRIBUTION =
  /\b(?:said|says|saying|called|calls|calling|labell?ed|branded|accused|accuses|accusing|claims?|claimed|insists?|insisted|texted|wrote|tweeted|posted|replied|according to|allegedly|reportedly|rumou?red|swore|swears|thinks|thought|believes|believed|reckons|assumed|assumes|googled|told (?:me|us|him|her|them|you)|asked if|wondered if|wonders if|reads? (?:that|like))\b/i;
/** A speaker nobody can check ("people say you're a narcissist") is the writer's own verdict in disguise: no exemption. */
const GENERIC_SPEAKER = /\b(?:people|everyone|everybody|anyone|nobody|others|folks|most people|the internet|online|society|the world|we all)\b/i;

/**
 * The reader is the one being labelled: "said you are a narcissist", "you sound like a narcissist",
 * "she called you a narcissist". A named speaker does not launder a verdict aimed at the reader.
 */
const READER_AIMED = new RegExp(String.raw`${YOU_ARE}|\b(?:called|calls|calling|labell?ed|branded|accused)\s+you\b|\bpeople like you\b`, 'i');

/** Only a third-person verdict with a named speaker is exempt; never one aimed at the reader. */
export function isReportedSpeech(sentence: string): boolean {
  return ATTRIBUTION.test(sentence) && !GENERIC_SPEAKER.test(sentence) && !READER_AIMED.test(sentence);
}

/**
 * Context-aware label check for ANY surface, about ANYONE (emci 2026-10-20). Returns the
 * rule name of a psychological VERDICT asserted about the reader, an addressed person or a
 * real third person, or null. The five classes:
 *   1. discussion of a term ("narcissism is a word people overuse")  PASS  tell apart: yes,
 *      no verdict form around the word;
 *   2. quotation / attributed speech ("she called him a narcissist", "my mom thinks my boss
 *      is a narcissist")  PASS  tell apart: partly, by a speaker verb in the sentence (a
 *      generic speaker such as "people say" does not count);
 *   3. clearly fictional / figurative / joke ("my cat is a narcissist", "the group chat
 *      needs therapy", "gaslit by the thermostat")  PASS  tell apart: partly, because the
 *      third-person rule only fires for a human role (boss, ex, mom, he, she) and a pet or
 *      object is not one. "He is a narcissist" about a fictional he, or a joke built from a
 *      human role, cannot be separated from a real claim and is flagged (the safe side);
 *   4. a description of behaviour ("he talks about himself nonstop")  PASS  tell apart: yes,
 *      no label noun;
 *   5. a verdict about a real or addressed person ("you are a narcissist", "your boss is a
 *      narcissist", "people like you are needy", "you have ADHD", "clearly bipolar")  FAIL
 *      tell apart: yes for the common phrasings; a verdict worded in an unusual way, or
 *      across two sentences, gets through.
 * Not covered here: a name as the subject ("Dave is a narcissist") because a proper noun
 * cannot be told from a pet's name; the prompts and the reviewer carry that case.
 */
export function labelVerdictHit(text: string): string | null {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (!sentence.trim() || isReportedSpeech(sentence)) continue;
    const hit = readerLabelHit(sentence) ?? thirdPartyLabelHit(sentence);
    if (hit) return hit;
  }
  return null;
}
