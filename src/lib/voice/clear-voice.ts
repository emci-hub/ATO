/**
 * The clear voice — the voice for STORED tips (emci, 2026-10-07): the Focus ·
 * try · watch bank (src/lib/insight-bank) and the category cards
 * (src/lib/category-bank). Not the moment voice: a tip has to make sense to a
 * stranger reading it cold, so it names who is involved, says the trait
 * plainly and says when it shows up. The daily lines keep the moment voice and
 * `lineRuleViolation`; nothing here touches them.
 *
 * `tipRuleViolation` is the mechanical half of these rules. The check scripts
 * run it over every stored string; the rest (kind to both poles, no
 * metaphors, a reason on every try) is on the writer.
 */
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
  'Hedge: tend to, usually, sometimes, can, might. Never "always". No labels ("you are…", "you\'re a…"); a situational "you\'re" is fine.',
  'Kind to both poles; the low side is not the bad side.',
  'Modern casual: everyday words, contractions, settings people know (texts, work, friends, partner). No slang, emoji, hashtags or "!".',
  'Not a therapist or a horoscope; no type codes, psych jargon or internal trait ids.',
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

const BANNED: readonly [RegExp, string][] = [
  [/\bhonou?r\b/i, 'says "honor"'],
  [/\bhold(ing)? space\b/i, 'says "hold space"'],
  [/\bboundar/i, 'says "boundary"'],
  [/\bjourney\b/i, 'says "journey"'],
  [/\bself-care\b/i, 'says "self-care"'],
  [/\buniverse\b/i, 'says "universe"'],
  [/\bmanifest/i, 'says "manifest"'],
  [/\blean into\b/i, 'says "lean into"'],
  [/\bit['’]s okay to\b/i, 'says "It\'s okay to"'],
  [/\bconsider\b/i, 'says "Consider"'],
  [/\bremember that\b/i, 'says "Remember that"'],
];

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
  if (/\balways\b/i.test(line)) return 'says "always"';
  if (/\byou are\b/i.test(line)) return 'says "you are"';
  if (/\byou['’]re (a|an|the|so|such|too|very|just)\b/i.test(line)) return 'labels the reader ("you\'re a…")';
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
