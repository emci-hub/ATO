/**
 * Meaning-first review prompt for changed player-facing lines.
 *
 * The future approval queue (see `draft-prompt.ts`) calls `reviewBeforeQueue`
 * before a suggestion is queued. This file does not call a model and does not
 * read a key. `npm run copy:review` is the caller that has the server key.
 * `reviewLibraryVoice` still runs after any rewrite.
 */
export interface CopyLine {
  id: string;
  file: string;
  text: string;
}

export interface CopyFix {
  id: string;
  newText: string;
  reason: string;
}

const KNOWN_SLOTS = ['Subj', 'subj', 'Name', 'legend', 'deed', 'answer'] as const;

/** Slot names in source order, including repeats. */
export function slotList(text: string): string[] {
  return [...text.matchAll(/\{([A-Za-z]+)\}/g)].map((match) => match[1] ?? '');
}

export function sameSlots(before: string, after: string): boolean {
  const left = slotList(before);
  const right = slotList(after);
  return left.length === right.length && left.every((slot, index) => slot === right[index]);
}

export function unknownSlot(text: string): string | null {
  for (const slot of slotList(text)) {
    if (!KNOWN_SLOTS.includes(slot as (typeof KNOWN_SLOTS)[number])) return slot;
  }
  return null;
}

/**
 * Voice guide plus the lines to judge. The model returns JSON only, and only
 * for lines that fail. A passing line is omitted.
 */
export function buildCopyReviewPrompt(voiceGuide: string, lines: readonly CopyLine[]): string {
  const guide = voiceGuide.trim();
  if (!guide.includes('Player-facing voice') || !guide.includes('Meaning first')) {
    throw new Error('copy review requires the voice guide');
  }
  const payload = JSON.stringify(lines.map((line) => ({ id: line.id, file: line.file, text: line.text })));
  return `${guide}

You review player-facing lines for ATO. The voice guide above is the rubric.

Fail a line when it is inaccurate, unclear, or more than one idea, when it does not say who or what, when a friend would not say it out loud, when it talks about the quiz ("the answers", "that side", "one clear line", "picked last"), or when it invents history the player did not report. "Your answers suggest" may stay on an insight, because the guide allows that hedge there. A story scene may stay when it is clearly imagined ("Picture an hour with").

Do not invent a legend fact, a trait, or an event. Keep every {Subj} {subj} {Name} {legend} {deed} {answer} token, in the same order. Do not add a token. Leave a passing line out of the reply.

Return JSON only:
{"fixes":[{"id":"<id>","new":"<replacement>","reason":"<one sentence>"}]}
If every line passes, return {"fixes":[]}.

Lines:
${payload}`;
}

/** The approval-queue entry. Same prompt the script sends. */
export function reviewBeforeQueue(voiceGuide: string, lines: readonly CopyLine[]): string {
  return buildCopyReviewPrompt(voiceGuide, lines);
}

export function parseCopyReviewResponse(raw: string): CopyFix[] {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('copy review reply was not JSON');
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as { fixes?: unknown };
  if (!Array.isArray(parsed.fixes)) throw new Error('copy review reply has no fixes array');
  const fixes: CopyFix[] = [];
  for (const row of parsed.fixes) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { id?: unknown; new?: unknown; newText?: unknown; reason?: unknown };
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const newer = typeof record.new === 'string' ? record.new : typeof record.newText === 'string' ? record.newText : '';
    const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
    if (!id || !newer.trim() || !reason) continue;
    fixes.push({ id, newText: newer.trim(), reason });
  }
  return fixes;
}
