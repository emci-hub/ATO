/**
 * Runtime reject for generated Read / Do / Nudge / Talk, stored copy, and for
 * Teach-Sage facts. Separate from scripts/intake-check.ts (that one is UI copy).
 * This one runs in the router, the insight generator, every stored-copy
 * validator and sanitizeFacts, so a model echo cannot reach Circle, widget,
 * push, or later cards via a stored fact.
 *
 * THE RULE (emci 2026-10-20, decision D6 option B; docs/copy-review-rules.md):
 * psychology frameworks, theories and tests (attachment theory, the Big Five,
 * MBTI, growth mindset, locus of control...) MAY be named in generated or stored
 * text when they are relevant, accurate and explained plainly: "the Big Five is
 * a model psychologists use; ATO is not that test" passes. What fails is a
 * specific MEANING, never the word:
 *   1. a result handed to a person: "your MBTI type is INTJ", "your Big Five
 *      score", "you have a growth mindset", "you're an INFJ";
 *   2. a claim that ATO runs or measures a framework / an official, validated
 *      or clinical assessment: "ATO measures the Big Five", "clinically
 *      validated", "official test result";
 *   3. a diagnosis implied from a framework ("your attachment theory diagnosis");
 *   4. the narrow BRANDING rule: a trademarked instrument or its type code
 *      (MBTI, Myers-Briggs, 16personalities, INTJ...) presented as the user's own
 *      result or as what ATO measures, or any claimed affiliation / endorsement
 *      ("official MBTI partner"). Merely discussing them is fine.
 * A bare type code (INTJ) with no explanation around it also fails: it reads as a
 * result handed out of nowhere. With a plain explanation ("MBTI sorts people into
 * 16 types such as INTJ; ATO does not use it") it passes.
 *
 * The old blanket ban is gone: it also refused ordinary words (ocean,
 * competitive, collaborative, compromising, accommodating) and any mention of a
 * theory. "A competitive streak", "compromising photos" and "the ocean" pass.
 * Sentences that negate the claim ("ATO does not measure the Big Five", "not
 * clinically validated") pass the claim rules; the type-code rule has no negation
 * exemption ("You're not an INFJ" still hands out a type).
 *
 * LIMITS (regexes cannot judge these, so the safe side is documented):
 * - "Not forced into ordinary copy" is a writing rule: the code cannot tell
 *   whether a mention is relevant, only that it claims nothing it should not.
 * - A claim split across two sentences ("ATO uses a model. It is the Big Five.")
 *   is not seen; the stored-copy review and the prompts carry that case.
 * - A bare lowercase "ecr", "tki" or "tipi" is not treated as a framework (a tipi
 *   is a tent); they only count as an instrument next to "score / result / test".
 *
 * Do not put this list into the model prompt: listing them teaches the tokens.
 * The prompt paraphrases the behaviour; this fence is the backstop.
 */

export const FACT_FRAMEWORK_MESSAGE =
  "That line names a type or label ATO will not store. Try saying it in your own words.";

const TYPE_CODES = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

/** Trademarked instruments: the branding rule applies to these. */
const TRADEMARK_SRC = String.raw`mbti|myers[- ]briggs|16 ?personalities`;

/** Named tests and models (discussion is fine; results / ownership are not). */
const INSTRUMENT_SRC =
  TRADEMARK_SRC +
  String.raw`|big (?:five|5)|ocean (?:model|scores?|traits?|test)|ten[- ]item personality inventory|(?:tipi|ecr(?:-r)?|tki)(?= (?:scores?|results?|test|scale|questionnaire|inventory))|thomas[- ]kilmann`;

/** Theories and constructs (a person "has" one only if something measured it). */
const THEORY_SRC =
  String.raw`attachment (?:style|theory)|anxious[- ]preoccupied|growth mindset|fixed mindset|locus of control|self[- ]efficacy|self[- ]determination|neuroticism`;

/** Every named framework, for `frameworkMentions` (diagnostics, never a verdict). */
const MENTION_RE = new RegExp(`\\b(?:${INSTRUMENT_SRC}|${THEORY_SRC})\\b`, 'gi');
const CODE_ALT = TYPE_CODES.join('|');
const BARE_CODE_RE = new RegExp(`\\b(${CODE_ALT})\\b`, 'gi');

/** Words around a type code that explain it. Without one, a bare code is just a result. */
const CODE_CONTEXT_RE = new RegExp(
  String.raw`\b(?:${TRADEMARK_SRC}|personality (?:type|types|test|tests|model|framework|inventory|indicator)|(?:16|sixteen) (?:types|personalities)|four[- ]letter|type indicator|type code|type codes|psychologists?|a model|a framework|a theory)\b`,
  'i',
);

const NEGATION_RE = /\b(?:not|never|no longer|without)\b|n['’]t\b|\bno\b/i;

/** A type code handed to a person: "you're an INFJ", "your INFJ side", "type is INTJ". No negation exemption. */
const CODE_CLAIM_RES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:you(?:['’]re| are| seem| sound| look| must be| might be| may be| come across as| came across as| scored| tested as)|your|i(?:['’]m| am)|we(?:['’]re| are)|he(?:['’]s| is)|she(?:['’]s| is)|they(?:['’]re| are)|as an?|being an?|such an?|typical|classic|textbook)\s+(?:(?:an?|the|clearly|probably|definitely|totally|obviously|very|so|kind of|sort of|pretty|rather|mostly|just|still|really|true|total|real|full|whole|own|old|usual|inner|classic|typical)\s+){0,3}(${CODE_ALT})\b`,
    'gi',
  ),
  new RegExp(String.raw`\b(?:type|result|results|code|score|profile)\s*(?:is|are|was|:|=|-|says|shows|came back as|comes back as)\s*(?:an?\s+)?(${CODE_ALT})\b`, 'gi'),
  new RegExp(String.raw`\b(?:got|get|gets|tested as|test as|turned out to be|turns out to be|identify as|identifies as|are|is)\s+(?:an?\s+)?(${CODE_ALT})\b`, 'gi'),
];

/** Up to 50 characters inside one clause that contain no negator. */
const NO_NEG_GAP = String.raw`(?:(?!\bnot\b|\bnever\b|n['’]t\b|\bno longer\b|\bno\b)[^.!?;]){0,50}`;

interface ClaimRule {
  label: string;
  re: RegExp;
  /** A negated sentence ("ATO does not measure...") passes this rule. */
  negatable: boolean;
}

const READER = String.raw`\byou(?:['’]re|['’]ve| are| have| had| scored| score| got| show| showed| rate| rank| ranked| tested| test| seem to have| tend to have| appear to have| must have| clearly have| probably have)\b`;

const CLAIM_RULES: readonly ClaimRule[] = [
  // Ownership of an instrument: "your Big Five score", "your MBTI type", "your INFJ" handled above.
  { label: 'your instrument result', re: new RegExp(String.raw`\byour\s+(?:\w+\s+){0,2}(?:${INSTRUMENT_SRC})\b`, 'i'), negatable: false },
  // The theory result stated as theirs: "Your attachment style shows", "your locus of control is external".
  {
    label: 'your framework result',
    re: new RegExp(
      String.raw`\byour\s+(?:\w+\s+){0,2}(?:${THEORY_SRC})\s+(?:is|are|was|shows?|showed|means|meant|explains?|says|said|suggests?|reveals?|tells|came|comes|got|gets|keeps|kicks|made|makes|has|had|did|does|will|would|can|could|might|may|must|looks?|seems?|sounds?)\b`,
      'i',
    ),
    negatable: true,
  },
  // A result said to the reader: "you scored high in neuroticism", "you have a growth mindset", "you're high in the Big Five".
  {
    label: 'a result given to you',
    re: new RegExp(`${READER}[^.!?;]{0,45}\\b(?:${INSTRUMENT_SRC}|${THEORY_SRC})\\b`, 'i'),
    negatable: true,
  },
  // ATO is said to run, measure or be built on a framework.
  {
    label: 'ATO measures a framework',
    re: new RegExp(
      String.raw`\b(?:ato|we|this app|the app|our (?:quiz|questions?|test|tests|profile|model|scores?|questionnaire)|these questions|the questions)\b${NO_NEG_GAP}\b(?:measure[sd]?|scores?|scored|tests? (?:for|your)|assess(?:es|ed)?|(?:is|are) (?:based|built|modell?ed|derived) (?:on|from|after)|based on|built on|uses?|using|runs?|follows?|reports?|calculates?|gives you|shows you|found|says)\b${NO_NEG_GAP}\b(?:${INSTRUMENT_SRC}|${THEORY_SRC})\b`,
      'i',
    ),
    // Not negatable by a negation ELSEWHERE in the sentence ("ATO scores neuroticism, not a diagnosis" still
    // claims it). A negator between the subject and the framework ("ATO does not measure the Big Five")
    // is excluded inside the pattern itself (NO_NEG_GAP).
    negatable: false,
  },
  // A framework result handed over as a label: "Here is your attachment style: anxious." / "Attachment style: anxious."
  {
    label: 'a framework result handed over',
    re: new RegExp(
      String.raw`\b(?:here(?:['’]s| is)|this is|that(?:['’]s| is)|meet)\s+your\s+(?:\w+\s+){0,2}(?:${INSTRUMENT_SRC}|${THEORY_SRC})\s*[:=—–-]|(?:^|[.!?]\s+|\n)\s*(?:${INSTRUMENT_SRC}|${THEORY_SRC})\s*[:=]\s*(?!an?\b|the\b|how\b|what\b|when\b|why\b|one\b|not\b|no\b)\w+`,
      'i',
    ),
    negatable: false,
  },
  // Validity / authority the app does not have.
  {
    label: 'validity claim',
    re: /\b(?:(?:clinically|scientifically|psychometrically|medically)[- ](?:validated|proven|tested|verified|reliable|accurate|backed)|(?:validated|certified|accredited|licen[cs]ed|standardi[sz]ed|diagnostic|clinical|psychometric)\s+(?:\w+\s+)?(?:assessments?|tests?|instruments?|questionnaires?|inventor(?:y|ies)|scales?|screening|evaluations?|tools?)\b(?!\s+(?:cent(?:er|re)|site|prep|drive|kitchen|track))|official\s+(?:\w+\s+){0,2}(?:test|assessment|result|results|score|scores|type|profile|report)\b)/i,
    negatable: true,
  },
  // Affiliation / endorsement of a trademark.
  {
    label: 'trademark affiliation',
    re: new RegExp(
      String.raw`\b(?:officially|official|endorsed by|approved by|licen[cs]ed (?:by|from)|affiliated with|partnered with|in partnership with|certified by|sponsored by|powered by|authori[sz]ed by)\b[^.!?;]{0,30}\b(?:${TRADEMARK_SRC})\b|\b(?:${TRADEMARK_SRC})\b[^.!?;]{0,30}\b(?:official partner|officially|endorsed|approved|licen[cs]ed|affiliated|certified)\b`,
      'i',
    ),
    negatable: true,
  },
];

/** A diagnosis implied from a framework: reader in the sentence + a framework + "diagnosis / disorder". */
const DIAGNOSIS_WORD_RE = /\b(?:diagnos(?:is|es|ed|e|ing|tic)|disorder|clinical condition)\b/i;
const READER_REF_RE = /\byou(?:r|['’]re|['’]ve)?\b/i;

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((part) => part.trim().length > 0);
}

/**
 * The framework claims in `text`: a type code or instrument name handed over as a
 * result, an unearned validity / measurement claim, an implied diagnosis or a
 * trademark affiliation. Order is rule order; duplicates removed. Type-code
 * labels are the code in capitals ("INFJ"); the others are rule labels.
 */
export function matchingFrameworkTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  const hits: string[] = [];
  const push = (label: string) => {
    if (!hits.includes(label)) hits.push(label);
  };

  // 1. Type codes handed out as a result (no negation exemption).
  const claimedCodes = new Set<string>();
  for (const re of CODE_CLAIM_RES) {
    for (const m of text.matchAll(re)) {
      const code = (m[1] ?? '').toUpperCase();
      if (code) claimedCodes.add(code);
    }
  }
  for (const code of TYPE_CODES) if (claimedCodes.has(code)) push(code);

  // 2. A bare code with nothing around it that explains what it is.
  if (!CODE_CONTEXT_RE.test(text)) {
    for (const m of text.matchAll(BARE_CODE_RE)) push((m[1] ?? '').toUpperCase());
  }

  // 3. Sentence-level claims.
  for (const sentence of sentencesOf(text)) {
    const negated = NEGATION_RE.test(sentence);
    for (const rule of CLAIM_RULES) {
      if (rule.negatable && negated) continue;
      if (rule.re.test(sentence)) push(rule.label);
    }
    if (!negated && READER_REF_RE.test(sentence) && DIAGNOSIS_WORD_RE.test(sentence) && new RegExp(`\\b(?:${INSTRUMENT_SRC}|${THEORY_SRC})\\b`, 'i').test(sentence)) {
      push('diagnosis from a framework');
    }
  }
  return hits;
}

/** True when `text` hands a person a framework result, claims a validated / official assessment, implies a diagnosis, or claims a trademark. Naming or explaining a framework alone passes. */
export function containsFrameworkTerm(text: string | null | undefined): boolean {
  return matchingFrameworkTerms(text).length > 0;
}

/** Frameworks and tests NAMED in `text`, claims or not (diagnostics and review lists; never a reason to reject). */
export function frameworkMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    const name = m[0].toLowerCase();
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export function sanitizeFacts(facts: unknown): string[] {
  if (!Array.isArray(facts)) return [];
  return facts.filter(
    (fact): fact is string => typeof fact === 'string' && fact.trim().length > 0 && !containsFrameworkTerm(fact),
  );
}
