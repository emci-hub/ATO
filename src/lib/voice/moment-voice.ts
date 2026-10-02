/**
 * The moment voice — ATO's voice for anything new (emci, 2026-10-02: "yes this
 * is the voice … I want this kind of voice throughout our app whenever we
 * create new things", for written copy and for what the AI generates).
 *
 * It came out of the daily-line rewrite: describe one concrete moment the
 * person recognizes from their own life, the way a friend would tease them
 * kindly, and stop. The lines emci approved are in
 * src/lib/daily-line/lines.generated.ts — read a page of them before writing
 * anything in this voice.
 *
 * WHERE IT IS USED (2026-10-02): the written daily lines, the mini guy, the
 * category fallback lines, and all four live AI prompts — the insight (its
 * personal lines in full, its five fields in spirit), category statements,
 * Story, and the AI questions (setting only; scoring is untouched).
 *
 * Two AI fields are advice BY DESIGN and each prompt exempts them from the
 * "no advice" rule: the insight's `tryToday` and the category card's
 * `try_this`. Where a moment stated as fact would clash with the older rule
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
  'One concrete, recognizable moment the person has probably lived. Past tense or plain present.',
  'Set it in how people live now: texts, group chats, read receipts, the typing bubble, voice notes, open tabs, unread counts, calendars, apps. Use the situation, never slang words, because slang dates in a year and reads as trying too hard.',
  'Describe the moment and stop. No advice, no "try", no lesson, no question to reflect on.',
  'Tease kindly. Self-aware and a little funny, never cruel, never a diagnosis, nothing that would sting if someone read it over their shoulder.',
  'Specific beats general: "They said \'k.\' You read it eleven ways." beats "you overthink messages."',
  'Short. Never "you are" or "you\'re". Never "always". No type names or psychology words.',
];

/** Approved examples of the register. For prompts: match these, never reuse them. */
export const MOMENT_VOICE_EXAMPLES: readonly string[] = [
  'They said "k." You read it eleven ways.',
  'You said "on my way" from the shower.',
  'You have 47 tabs open and every one of them is "for later."',
  'You typed the whole reply, then held backspace.',
  'The plans got cancelled and you felt it like a gift.',
  'You hearted a message you disagreed with.',
];

/** One block to drop into any generation prompt that should write in this voice. */
export const MOMENT_VOICE_BLOCK = `VOICE — every line must satisfy all of these:
${MOMENT_VOICE_RULES.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

REGISTER (match it, do not reuse these):
${MOMENT_VOICE_EXAMPLES.map((line) => `- ${line}`).join('\n')}`;
