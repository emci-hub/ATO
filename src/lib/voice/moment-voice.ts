/**
 * Player-facing voice block for generation prompts. The export is still
 * named MOMENT_VOICE because existing prompts import it. The rules are v2,
 * meaning first (emci, 2026-10-23). They replace "describe one concrete
 * moment and stop."
 *
 * A story may still use a scene. The scene has to be established, and it is
 * fiction, not a claim that the reader did that thing. Insights, trait
 * descriptions, buttons, errors, and notifications should say the meaning.
 *
 * WHERE IT IS USED (2026-10-02): the written daily lines, the mini guy, the
 * category fallback lines, and all four live AI prompts — the insight (its
 * personal lines in full, its five fields in spirit), category statements,
 * Story, and the AI questions (setting only; scoring is untouched).
 *
 * Two AI fields are advice BY DESIGN and each prompt exempts them from the
 * "no advice" rule: the insight's `tryToday` and the category card's
 * `try_this`. The deep dive (2026-10-19, honest weaknesses) also allows ONE
 * small, doable step in its closing line, and names a real cost plainly. Where a moment stated as fact would clash with the older rule
 * "reflect as maybes", the prompts say the older rule wins: a likely moment,
 * never a claim that a specific event happened.
 *
 * None of the prompt changes could be run against the live model when they
 * were made. If output drifts, the prompt for that surface is the place to
 * look, and the older reflective rules in style-checklist.ts are still in
 * every prompt underneath this block.
 *
 * The mechanical half of these rules is enforced by `lineRuleViolation`
 * (src/lib/daily-line/bank.ts).
 */

export const MOMENT_VOICE_RULES: readonly string[] = [
  'Say what you mean in plain language. One plain idea per line. Do not join two ideas with because, and then, or while. Do not add a scene, a joke, or a metaphor until the meaning is already clear.',
  'Do not assume missing context. If the line can appear alone, it has to make sense alone. Do not mention a listing, a plan, a joke, or a question unless that thing is already visible.',
  'Do not invent the reader\'s history. Do not turn a score or an answer into a claim that a specific event happened. Keep apart what the reader said, what the answers suggest, and a hypothetical. Mark a hypothetical as hypothetical.',
  'Keep the link to the trait accurate. Do not add an unrelated habit.',
  'Priority: accuracy, then clarity, then relevance, then a natural voice, then optional humor. Cut a joke or a metaphor that weakens a higher priority.',
  'Match the purpose. A button names the action. An error says what happened and what to do. An insight says what the answers suggest and why. A comparison states the actual similarity or difference. A story may use a scene when the scene is established and is clearly fiction, not the reader\'s real week. Do not make every line sound like a story card.',
  'Never "you are" or "you\'re" as an identity label. Never "always". No personality-type code presented as the reader\'s result. Never apply a diagnosis or a label to the reader; everyday and contextual use of those words is fine.',
];

/** Examples of the register. For prompts: match the clarity, never reuse them. */
export const MOMENT_VOICE_EXAMPLES: readonly string[] = [
  'You like trying new things, even when everyone else would rather stick with what they know.',
  'You stick with what you already know you enjoy.',
  'Your answers suggest you like a new option even when a familiar one is already there.',
];

/** One block to drop into any generation prompt that should write in this voice. */
export const MOMENT_VOICE_BLOCK = `VOICE — every line must satisfy all of these:
${MOMENT_VOICE_RULES.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

REGISTER (match it, do not reuse these):
${MOMENT_VOICE_EXAMPLES.map((line) => `- ${line}`).join('\n')}`;

/**
 * Comedy craft for The Story's punchline (emci, 2026-10-13: funnier jokes).
 * The moment voice still says "tease kindly"; the punchline may be drier, as
 * long as it follows real joke construction and the contextual boundaries. Mechanical
 * half: `punchlineCraftViolation` / `pickBestPunchline` in card-joke.ts.
 */
export const STORY_JOKE_STYLES: readonly string[] = [
  'specific concrete detail the reader already saw',
  'setup early, payoff as a callback',
  'rule of three with a twist on the third',
  'escalation (each beat a little worse or stranger)',
  'misdirection then a reversal',
  'understatement (the situation is chaos; the line is calm)',
];

/**
 * Humor is 18+ (emci, 2026-10-19; docs/copy-review-rules.md "Humor"): no topic
 * is off limits by itself. These are contextual boundaries — judge the joke.
 */
export const STORY_JOKE_ALLOWED =
  'Dark, absurd and uncomfortable topics are allowed (death, drinking, hangovers, bad dates, money panic, family chaos). Adult swearing is allowed, strong swearing included ("fuck"), when it earns its place in the joke; never as filler. Judge the joke, keep its edge; never soften it into encouragement.';

export const STORY_JOKE_BANS: readonly string[] = [
  'encouraging a dangerous act: self-harm, suicide, drunk driving, real harm to someone',
  'a punchline at the expense of the person or their disclosed pain or trauma; joke about the situation, never the person',
  'invented claims about real people stated as fact',
  'slurs, or jokes that demean a group for who they are',
  'a diagnosis or label pinned on the reader ("you are so toxic"); a contextual word ("the group chat needs therapy") is fine',
  'anything sexually explicit',
  '"!", emoji, hashtags',
  'explaining the joke ("which is funny because", "the joke is", "get it")',
  'puns for their own sake, with no callback to the scene',
  'stock clichés: walk into a bar, that is what she said, plot twist, living the dream, it is what it is, say less, no cap, spoiler alert',
];

/** Approved register for the punchline. Match the energy, never reuse it. */
export const STORY_JOKE_EXAMPLES: readonly string[] = [
  'By the time the food lands, nobody wants it. They want round two of the rankings. And more bread.',
  'The client asks if printed decks are new. Your boss has never said yes faster.',
  'The shelf goes up crooked. Mom loves it. She loves the hat guy\'s drill more.',
];

export const STORY_JOKE_RULES = `PUNCHLINE CRAFT (the funny beat is a constructed joke, not an observation)
- Build it: ${STORY_JOKE_STYLES.join('; ')}.
- Land the laugh in the last 6–8 words. The reader should not need the next sentence.
- Write 2–3 candidate punchlines in "punchlines", then the JSON "punchline" is your best one.
- Joke about the situation, never the person. Sharp enough to screenshot.
- ${STORY_JOKE_ALLOWED}
- Never, whatever the style:
${STORY_JOKE_BANS.map((line) => `  - ${line}`).join('\n')}
- Register (match the energy, do not reuse): ${STORY_JOKE_EXAMPLES.map((line) => `"${line}"`).join(' ')}`;
