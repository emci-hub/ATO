/**
 * Shared style checklist + emci-approved few-shot anchors for every generation
 * surface — Dawn Read, Explore, Category summaries, Title, and The Story.
 *
 * Anchors are examples to match, never templates to paste. The checklist is
 * dropped into each prompt after the voice reference so the model never writes
 * like a system describing a person.
 */

export const STYLE_CHECKLIST_LINES: readonly string[] = [
  'Never say "you are." Say "tends to," "leans toward," "lately."',
  'Never describe itself (no "this reflects," "a gap worth," "the data shows"). Just say the thing, plainly.',
  "One idea at a time when possible. If a title or category summary needs to name more than one quality, that's fine — just follow Rule 6 when you do (connect with 'but'/'yet'/'and', never a comma list).",
  'Leave room for change. Avoid "always" — prefer "lately," "this week," "for now."',
  'Sound like a friend who noticed something, not a report describing a person.',
  'Whenever more than one quality/trait shows up in the same sentence — whether from one category\'s underlying axes or from combining multiple categories — connect them with a word like "but," "yet," or "and" that shows how they relate, never a plain comma list. Should read as one whole person, not facts stapled together. This applies even inside a single category\'s own description if it names more than one quality.',
];

export const STYLE_FEW_SHOT_ANCHORS: readonly string[] = [
  "You said one thing, but when it's not a big decision, you go a different way. Maybe you're just different depending on the moment — that's normal.",
  "You've been keeping the plan, even when you'd rather keep the room small. You'd rather pick the path yourself than take the one already sitting there.",
];

/** Before → after joins. Never a plain comma list when two qualities share a sentence. */
export const STYLE_RELATION_ANCHORS: readonly string[] = [
  '"Steady, driven, and independent" → "Grounded and self-driven, but happiest doing it alone"',
  '"Follows through on plans, goes along to keep things easy, and bounces back fast" → "Follows through on plans and bounces back fast — even when that means letting a small thing go instead of pushing back"',
];

/** One block to drop into any generation prompt, right after the voice reference. */
export const STYLE_BLOCK = `STYLE CHECKLIST — every line must satisfy all six:
${STYLE_CHECKLIST_LINES.map((line, i) => `${i + 1}. ${line}`).join('\n')}

APPROVED ANCHORS (match this register — do not reuse verbatim):
${STYLE_FEW_SHOT_ANCHORS.map((line) => `- ${line}`).join('\n')}

HOW TO JOIN TWO QUALITIES IN ONE SENTENCE (bad → good):
${STYLE_RELATION_ANCHORS.map((line) => `- ${line}`).join('\n')}`;
