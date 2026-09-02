# Legend content spec

Format for every legend served in ATO — hand-written or generated. The
future weekly-batch AI job generates to this exact format and no other.
Approved with emci 2026-09-02. Reference samples at the bottom are the four
approved legends (Da Vinci / Architect, Alexander / Front-Liner,
Confucius / Watcher, Athena / Commander).

## Table shape

Each legend row carries the content fields below plus `canonical_slug`,
`era_title`, `type` (historical | modern-deceased | mythical), and
`fact_checked` (false until a human verified the story; unchecked legends
are never presented as fact). A legend links to one or more archetypes via
`legend_archetypes`; the archetype named in the "[Name] Energy:" line is the
one that legend is being matched against.

## Teaser

- One punchy, counterintuitive hook line.
- No "This is…" framing — never open with "This is the story of…", "This is
  about…", or any announcement that the subject is a lesson.
- Ties to the archetype without naming it yet — the archetype reveal belongs
  to the Energy line inside the story.
- Hard cap ~12 words.

## Full story (exact structure)

1. **Opening line = the teaser, restated** — the same hook, phrased so it
   reads as an opener.
2. **One paragraph of biographical/mythical grounding** — 2–4 sentences.
   Factual or well-known lore only: no invented dates, quotes, or scenes.
3. **Blank line.**
4. **"[Archetype Name] Energy:" on its own line**, where Archetype Name is
   the linked archetype's `formal_name`, followed by the psychological
   parallel to the user — 2–3 sentences — ending on how that archetype
   reframes a trait the user might see as a flaw.

## Standing rules

- Teaser and story must not contradict each other; the story's opening
  restates the teaser, so the two are written as one piece.
- Same coaching register as every other generation surface: friend voice,
  never a diagnosis, nothing framed as identity or fate. The psychological
  parallel speaks to the user's own report, never labels them.
- Archetype flavor must stay honest to the archetype's `trait_axis` profile;
  the parallel draws on that profile rather than a generic pep talk.
- `fact_checked` gates presentation. Historical grounding stays in
  well-documented record or widely-known lore; mythical figures may use
  their canonical myth, marked by their `type`.

---

## Reference samples (approved 2026-09-02)

### 1. Da Vinci / The Architect

**Teaser:** "Never finished anything — because finishing wasn't the point."

**Story:** "Da Vinci kept notebooks of unfinished machines, half-solved anatomy, plans within plans. He carried the Mona Lisa for over a decade, endlessly retouching.

Architect Energy: the structure isn't a chore, it's the actual joy. The discomfort you feel with 'good enough' isn't a flaw — it's the same instinct that let him see what nobody else had drawn yet."

### 2. Alexander the Great / The Front-Liner

**Teaser:** "Ran out of world before he ran out of drive."

**Story:** "He led every major battle from the front line, not the back of the formation — first into danger, not last out of it. When there was nothing left to conquer, the story goes he wept. Not from grief, but from stillness.

Front-Liner Energy: rest doesn't feel like relief, it feels like a problem. The pull you feel toward the next thing, before this one's even settled, isn't restlessness — it's the same hunger that moved him."

### 3. Confucius / The Watcher

**Teaser:** "Said less than everyone else — and still ended up right."

**Story:** "He spent years observing before ever teaching, convinced that watching how people actually behaved mattered more than any theory about how they should. His students recorded his words specifically because he rarely wasted them.

Watcher Energy: silence isn't absence, it's data collection. The instinct to hold back until you've actually seen the pattern isn't hesitation — it's the same discipline that made people listen when he finally spoke."

### 4. Athena / The Commander

**Teaser:** "Never needed to raise her voice to win the room."

**Story:** "Where other gods won through force or spectacle, Athena won through strategy — famously outmaneuvering rather than overpowering. She was the one generals prayed to before a battle, not the one who fought loudest in it.

Commander Energy: control isn't about volume, it's about being three moves ahead. The calm you carry into chaos isn't coldness — it's the same clarity that made her the god armies actually trusted."
