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
 * "people like you are needy", "depression in how you plan"); any diagnosis claim
 * ("diagnosed", "a diagnosis": the one word still refused everywhere, because ATO
 * copy never has a reason to talk about one); and clinical ADVICE (get therapy,
 * stop your meds). `CLINICAL_ADVICE` is separate so callers combine the two.
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
const YOU_ARE = String.raw`\byou(?:['’]re|['’]ve been| are| were| seem| seemed| seem to be| sound| sounded| look| looked| come across as| came across as| act| acted| behave| become| became| turn into| turned into| can be| could be| might be| may be| must be| would be| will be| get called| deserve to be called)\s+`;

/** Nouns that make "your <label> <noun>" still about the reader ("your avoidant side"). */
const YOUR_TAIL = String.raw`(?:[- ](?:attachment|attached|style|styles|side|streak|energy|habits?|behaviou?rs?|tendenc(?:y|ies)|issues?|brain|self|traits?|personality|response|wounds?|patterns?|mode|thing|disorder|episode))*`;

/** Verbs (or the end of a clause) that make "your <label>" a verdict ("is showing", "explains this"). */
const YOUR_VERB = String.raw`(?=\s+(?:is|are|was|were|isn['’]t|shows?|showing|showed|shows up|showed up|showing up|explains?|explained|means|meant|kicks? in|kicked in|comes? out|came out|again|strikes|struck|wins|won|makes?|made|took|takes?|talking|acting|flares?|at work|in action|on display|says|said|did|does|has|had|just|really|would|will|can|could|might|may|must|got|gets|getting|tells?|told|needs?|needed|keeps?|kept|wants?|wanted|loves?|hates?|ran|runs|ruins?|ruined|took over|takes over|answered|picked|chose|decided)\b|\s*[.,;:!?…—–)]|\s*$)`;

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
  // Any diagnosis claim: "diagnosed", "a diagnosis", "self-diagnose".
  { name: 'diagnosis', re: /\bdiagnos\w*/i },
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
