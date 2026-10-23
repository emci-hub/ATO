/**
 * The clear voice — the voice for STORED tips (emci, 2026-10-07): the Focus ·
 * try · watch bank (src/lib/insight-bank) and the category cards
 * (src/lib/category-bank). Not the moment voice: a tip has to make sense to a
 * stranger reading it cold, so it names who is involved, says the trait
 * plainly and says when it shows up. The daily lines keep the moment voice and
 * `lineRuleViolation`; nothing here touches them.
 *
 * `tipRuleViolation` is the mechanical half of these rules. The check scripts
 * run it over every stored string; the rest (honest and kind about both poles, no
 * metaphors, a reason on every try) is on the writer.
 */
import { readerLabelHit } from '@/lib/voice/clinical';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const CLEAR_VOICE_RULES: readonly string[] = [
  'Self-contained: a stranger reading it cold understands it. No mid-scene openings; never "they", "it" or "that" without saying who or what.',
  'Name who is involved: a friend, your partner, coworkers, your boss, family.',
  'State the trait plainly and when it shows up. Focus and summary: "When X, you tend to Y." or "You do X easily, but Y."',
  'Why: one plain sentence on why it happens or why it matters ("can", "tends to").',
  'Try: one clear action, doable today, alone, in a few minutes, with a reason or an obvious payoff ("…, so …").',
  'Watch: one plain signal to notice in yourself, starting "Notice when/if/whether…". No warnings or predictions.',
  'Strength and watch-out: plain behaviour; the watch-out is the strength\'s flip side ("Sometimes…", "Because you…").',
  'No metaphors, idioms, clever twists, punchlines, inside jokes or fragments.',
  'Hedge when the answers only suggest it: tend to, usually, sometimes, can, might (honest uncertainty is fine; state a thing flatly only when the answers show it). Avoid absolutes about the reader ("you always…"). No identity labels ("you\'re a perfectionist", "you\'re the kind of person who…"); a situational "you are on time" or "you\'re late" is fine. A diagnosis or label pinned on the reader is refused by src/lib/voice/clinical.ts.',
  'Honest about both poles (emci 2026-10-19): a real limitation is stated plainly (when it shows up, what it costs) next to what the trait gives. Respect means no shame, no label, no diagnosis; it does not mean hiding true information. Never swap a limitation for "the other end". Say a limitation only when the answers support it.',
  'Modern casual: everyday words, contractions, settings people know (texts, work, friends, partner). No slang, emoji, hashtags or "!".',
  'Not a therapist or a horoscope: plain words, not therapy-speak ("set healthy boundaries", "lean into the discomfort", "honor your feelings", "your healing journey", "hold space for"); a literal use is fine ("property boundaries", "the journey to work"). Explain a necessary technical term; no type codes presented as the reader\'s own result; no internal trait ids.',
  'Self-check every line: would someone reading this cold know who, what, and why it matters? If not, rewrite it.',
];

/** Approved examples of the register (emci 2026-10-07). Match them, never reuse them. */
export const CLEAR_VOICE_EXAMPLES: readonly string[] = [
  'Focus: When a friend takes a while to text back, you tend to wonder if you did something wrong.',
  'Try: Next time, put your phone away for 20 minutes before you check again.',
  'Watch: Notice when you start guessing what someone\'s silence means.',
  'Focus: You handle last-minute changes easily, but small tasks can pile up when nothing\'s scheduled.',
  'Try: Pick one task you\'ve been putting off and do just the first two minutes now.',
  'Strength: When you disagree with someone, you usually focus on fixing the problem instead of staying mad.',
  'Watch-out: Sometimes you jump to fixing it before the other person feels heard.',
];

/**
 * Which kind of stored string this is. The category card's parts reuse the
 * insight's shapes: summary / strength / watch-out read like a focus, and
 * try this reads like a try.
 */
export type TipField = 'focus' | 'why' | 'try' | 'watch' | 'summary' | 'strength' | 'watchOut' | 'tryThis';

export const TIP_FIELD_CAPS: Record<TipField, number> = {
  focus: 110,
  why: 160,
  try: 120,
  watch: 110,
  summary: 140,
  strength: 140,
  watchOut: 140,
  tryThis: 120,
};

/**
 * Therapy-speak and coach-speak, phrase level (core content policy, emci
 * 2026-10-20: judge meaning, not the word). The purpose is a clear plain voice
 * for stored tips, so what is refused is the stock phrase, never the bare word:
 * "property boundaries", "the journey to work", "stress can manifest as a
 * headache", "on your honor" and "consider yourself warned" all pass.
 */
const BOUNDARY_VERBS =
  'set|sets|setting|enforc\\w+|establish\\w*|hold\\w*|keep\\w*|protect\\w*|respect\\w*|honou?r\\w*|maintain\\w*|communicat\\w*';
const BANNED: readonly [RegExp, string][] = [
  [/\bhonou?r(?:ing|s)?\s+(?:your|their|his|her|my|our)\s+(?:feelings?|needs?|truth|emotions?|process|boundar\w+|journey|inner\s+\w+)\b/i, 'therapy-speak ("honor your feelings")'],
  [/\bhold(?:ing)?\s+space\s+for\b/i, 'therapy-speak ("hold space for")'],
  [new RegExp(`\\b(?:${BOUNDARY_VERBS})\\s+(?:(?:your|their|his|her|some|a few|healthy|clear|firm|better|those|these|good|strong)\\s+)*boundar(?:y|ies)\\b`, 'i'), 'therapy-speak ("set healthy boundaries")'],
  [/\bhealthy\s+boundar(?:y|ies)\b/i, 'therapy-speak ("healthy boundaries")'],
  [/\b(?:healing|growth|personal|emotional|inner|self-discovery|wellness)\s+journey\b|\bjourney\s+of\s+(?:self|growth|healing|discovery)\b|\byour\s+(?:own\s+)?journey\b(?!\s+(?:to|home|back|from|into|across|through))/i, 'therapy-speak ("your journey")'],
  [/\bself-care\b(?!\s+(?:aisle|section|products?|brand|app|kit))/i, 'therapy-speak ("self-care")'],
  [/\b(?:trust|ask|thank|listen to|believe in)\s+(?:the\s+)?universe\b|\bthe universe\s+(?:wants|sends?|knows|conspires|provides|has your back)\b/i, 'horoscope-speak ("the universe wants…")'],
  [/\bmanifest(?:ing|s)?\s+(?:your|my|our|their|good|abundance|success|love|dreams?|the life|what you|a better)\b/i, 'horoscope-speak ("manifest your…")'],
  [/\blean(?:ing|s)?\s+into\s+(?:it|that|this|your|their|the\s+(?:discomfort|feeling|fear|uncertainty|awkward\w*|moment|pain|process|change|chaos|silence)|being|what)\b/i, 'coach-speak ("lean into…")'],
  [/(?:^|[.?!]\s+)it['’]s\s+(?:totally\s+|perfectly\s+|completely\s+)?(?:okay|ok|fine)\s+to\b/i, 'opens with reassurance ("It\'s okay to…")'],
  [
    /(?:^|[.?!:]\s*)consider\s+(?:trying|asking|taking|setting|making|doing|talking|reaching|letting|whether|how|what|that)\b|\b(?:want|try|might)\s+to\s+consider\b/i,
    'advice voice ("Consider trying…")',
  ],
  [/(?:^|[.?!]\s+)remember\s+that\s+(?:you|your|it|it['’]s|this|they|everyone|not|nobody|no one|mistakes|feelings|silence|small)\b/i, 'lecture voice ("Remember that…")'],
];

/** Situational words after "you are so/too…" that describe a moment, not the reader's character. */
const SITUATIONAL_AFTER_YOU_ARE =
  'late|early|busy|tired|close|far|ready|full|soon|long|hungry|new|many|much|few|bit|little|lot|couple|next|first|last|done|here|there|on|in|at|off|out|about|not|going|trying|doing|getting|running|waiting|looking';

/**
 * A verdict on who the reader IS ("you're a perfectionist", "you're the kind of
 * person who…", "you're so organized"), not what is happening to them. "You are
 * on time" and "you're a few minutes early" pass. Diagnoses and clinical-style
 * labels are handled separately by `readerLabelHit` (src/lib/voice/clinical.ts).
 */
const YOU_ARE = "you(?:['’]re| are)";
const IDENTITY_LABEL = new RegExp(
  `\\b${YOU_ARE}\\s+(?:(?:such|really|actually)\\s+)?(?:a|an)\\s+(?!${SITUATIONAL_AFTER_YOU_ARE}\\b)\\w+` +
    `|\\b${YOU_ARE}\\s+the\\s+(?:kind|type|sort)\\s+of\\b` +
    `|\\b${YOU_ARE}\\s+the\\s+(?:one|person|friend)\\s+who\\b` +
    `|\\b${YOU_ARE}\\s+(?:so|such|too|very|really)\\s+(?!${SITUATIONAL_AFTER_YOU_ARE}\\b)\\w+`,
  'i',
);

/** A sentence that opens by telling the reader what to do. */
const ADVICE_OPENER =
  /^(Try|Ask|Check|Notice|Let|Pick|Say|Give|Take|Leave|Put|Start|Wait|Make|Keep|Tell|Share|Write|Test|Look|Show|Step|Choose|Invite|Offer|Thank|Plan|Remember|Trust|Watch|Stop|Set|Send|Text|Call|Spend|Do|Go|Be|Find|Name|List|Read|Close|Open|Turn|Skip|Add|Book|Block|Reply|Don['’]t)\b/;

/**
 * The verbs a try may open with. A closed list on purpose: "opens with a verb"
 * cannot be read off a sentence mechanically, so a try either opens with one
 * of these or with Next time / Before / When / If. Add a verb here when a new
 * tip needs one; the list is what keeps a try an action.
 */
export const TRY_VERBS: readonly string[] = [
  'Add', 'Answer', 'Ask', 'Block', 'Book', 'Break', 'Call', 'Cancel', 'Celebrate', 'Change', 'Check', 'Choose',
  'Close', 'Count', 'Cross', 'Decide', 'Delete', 'Do', 'Drop', 'Eat', 'Finish', 'Follow', 'Give', 'Go', 'Hand',
  'Introduce', 'Invite', 'Join', 'Keep', 'Laugh', 'Learn', 'Leave', 'Let', 'List', 'Look', 'Make', 'Mute',
  'Name', 'Offer', 'Open', 'Pay', 'Pick', 'Plan', 'Practice', 'Put', 'Read', 'Repeat', 'Reply', 'Say', 'Send',
  'Set', 'Share', 'Sign', 'Sit', 'Skip', 'Smile', 'Spend', 'Start', 'Suggest', 'Swap', 'Take', 'Talk', 'Tell',
  'Text', 'Thank', 'Try', 'Turn', 'Volunteer', 'Wait', 'Walk', 'Watch', 'Write',
];

const TRY_OPENER = new RegExp(`^(Next time\\b|Before\\b|When\\b|If\\b|(${TRY_VERBS.join('|')})\\b)`);

const EMOJI = /\p{Extended_Pictographic}/u;

/** Why a stored tip may not ship, or null if it may. */
export function tipRuleViolation(text: string, field: TipField): string | null {
  const line = text.trim();
  if (!line) return 'empty';
  const cap = TIP_FIELD_CAPS[field];
  if (line.length > cap) return `too long (${line.length} > ${cap})`;
  if (containsFrameworkTerm(line)) return 'framework term';
  // An absolute about the reader ("you always…", "Always…"); "the chat is always loud" is not one.
  if (/\byou(?:['’](?:re|ve|ll|d))?\s+(?:\w+\s+){0,2}?always\b|^always\b/i.test(line)) return 'absolute about the reader ("you always…")';
  const label = readerLabelHit(line);
  if (label) return `label or diagnosis on the reader (${label})`;
  if (IDENTITY_LABEL.test(line)) return 'labels the reader ("you\'re a…", "you\'re so…")';
  if (EMOJI.test(line) || /[!#]/.test(line)) return 'emoji, "!" or "#"';
  for (const [re, why] of BANNED) if (re.test(line)) return why;
  if (/^(They|He|She|It|That|This)\b/.test(line)) return 'opens with a pronoun that points at nothing';

  if (field === 'focus' || field === 'why' || field === 'summary' || field === 'strength' || field === 'watchOut') {
    if (ADVICE_OPENER.test(line)) return 'opens with advice';
    if (!/\byou(rs?|rself|rselves|['’]re|['’]ve|['’]ll|['’]d)?\b/i.test(line)) return 'never says "you" or "your"';
  }
  if ((field === 'try' || field === 'tryThis') && !TRY_OPENER.test(line)) {
    return 'a try must open with a verb, or Next time / Before / When / If';
  }
  if (field === 'watch' && !/^Notice\b/.test(line)) return 'a watch must open with "Notice"';
  return null;
}
