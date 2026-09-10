/**
 * Legend candidate generation prompt (wave55) — targets one archetype and
 * proposes a new figure + its first story variant, in the exact format
 * `docs/legends-content-spec.md` approved with emci 2026-09-02. The four
 * reference samples in that doc are reused here verbatim as few-shot —
 * do not reword them without updating the doc first (the doc says as much
 * for the bank; same rule applies here since this prompt quotes it).
 */

export interface LegendPromptArchetype {
  formalName: string;
  /** Comma-separated 16-axis combo, e.g. 'openness:high, autonomy:high'. */
  traitAxis: string;
}

/**
 * archetype_defs.formal_name always carries a leading "The" (e.g. "The
 * Architect", wave26) but every approved reference sample and every shipped
 * legend drops it in the "[Name] Energy:" line ("Architect Energy:", not
 * "The Architect Energy:" — see the FEW_SHOT block below and
 * wave28_legends_approved_seed.sql). Shared by the prompt instruction and
 * parse.ts's archetype-match guard so the two can never drift apart again
 * (found in review: they did, once — the guard required the untrimmed form
 * while every example taught the trimmed one, so a genuinely correct
 * response was rejected and burned a day's quota for nothing).
 */
export function energyLineName(formalName: string): string {
  return formalName.replace(/^The\s+/i, '').trim();
}

const FEW_SHOT = `1. Da Vinci / The Architect
Teaser: "Never finished anything — because finishing wasn't the point."
Story: "Da Vinci kept notebooks of unfinished machines, half-solved anatomy, plans within plans. He carried the Mona Lisa for over a decade, endlessly retouching.

Architect Energy: the structure isn't a chore, it's the actual joy. The discomfort you feel with 'good enough' isn't a flaw — it's the same instinct that let him see what nobody else had drawn yet."

2. Alexander the Great / The Front-Liner
Teaser: "Ran out of world before he ran out of drive."
Story: "He led every major battle from the front line, not the back of the formation — first into danger, not last out of it. When there was nothing left to conquer, the story goes he wept. Not from grief, but from stillness.

Front-Liner Energy: rest doesn't feel like relief, it feels like a problem. The pull you feel toward the next thing, before this one's even settled, isn't restlessness — it's the same hunger that moved him."

3. Confucius / The Watcher
Teaser: "Said less than everyone else — and still ended up right."
Story: "He spent years observing before ever teaching, convinced that watching how people actually behaved mattered more than any theory about how they should. His students recorded his words specifically because he rarely wasted them.

Watcher Energy: silence isn't absence, it's data collection. The instinct to hold back until you've actually seen the pattern isn't hesitation — it's the same discipline that made people listen when he finally spoke."

4. Athena / The Commander
Teaser: "Never needed to raise her voice to win the room."
Story: "Where other gods won through force or spectacle, Athena won through strategy — famously outmaneuvering rather than overpowering. She was the one generals prayed to before a battle, not the one who fought loudest in it.

Commander Energy: control isn't about volume, it's about being three moves ahead. The calm you carry into chaos isn't coldness — it's the same clarity that made her the god armies actually trusted."`;

export function buildLegendCandidatePrompt(archetype: LegendPromptArchetype): string {
  return `You write short legend cards for a self-understanding app. A "legend" is a real historical figure, a recently-deceased notable figure, or a mythical figure whose story mirrors one personality archetype.

Propose ONE figure who genuinely embodies this archetype:
Archetype: ${archetype.formalName}
Trait profile this archetype indexes on: ${archetype.traitAxis}

FORMAT (exact structure, do not deviate):
- teaser: one punchy, counterintuitive hook line, hard cap ~12 words. Never open with "This is..." or any announcement that the subject is a lesson. Ties to the archetype without naming it.
- full_story:
  1. Opening line = the teaser, restated so it reads as an opener.
  2. One paragraph of biographical/mythical grounding, 2-4 sentences. Factual or well-known lore only — no invented dates, quotes, or scenes.
  3. A blank line.
  4. "${energyLineName(archetype.formalName)} Energy:" on its own line (drop a leading "The" from the archetype name — see the reference examples below), followed by the psychological parallel to the reader — 2-3 sentences — ending on how this archetype reframes a trait the reader might see as a flaw.

STANDING RULES:
- Teaser and story must not contradict each other — the story's opening restates the teaser.
- Friend voice, never a diagnosis, nothing framed as identity or fate. The parallel speaks to the reader's own report, never labels them.
- Archetype flavor must stay honest to the trait profile above, not a generic pep talk.
- Historical grounding stays in well-documented record or widely-known lore; mythical figures may use their canonical myth.
- Pick a figure not already used for a DIFFERENT archetype in common lists of this kind (avoid the most obvious pick if it clearly better fits a different profile).

FOUR APPROVED REFERENCE EXAMPLES (same format, different archetypes — match this exactly, do not reuse these four figures):
${FEW_SHOT}

Respond with ONLY this JSON object, no markdown fence, no commentary:
{
  "canonical_slug": "lowercase-hyphenated-name-and-year-or-era",
  "name": "Display name",
  "era_title": "Human label for their era or setting, e.g. Victorian England",
  "type": "historical" | "modern-deceased" | "mythical",
  "teaser": "...",
  "full_story": "..."
}`;
}
