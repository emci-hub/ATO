# Quests style guide

How every Quests campaign is written (ATO-BUILD PHASE-18). The rules a machine can check live in
`src/lib/quests/validate.ts`, `banned.ts` and `strings.ts` (`LIMITS`); the rest is craft. Player-facing copy
also follows `docs/voice-guide.md` and the core content policy in `docs/copy-review-rules.md`
(meaning over keywords; honest, not sanitised).

## Voice

- **Second person, present tense.** "You wade past the marked posts." Never "the player".
- **Warm and wry.** One small joke per scene at most, aimed at the situation, never at the reader.
- **A beat is 45 words or fewer**, at grade 6 to 8 reading level: short sentences, common words, one idea per line.
- **Choice labels are first person, 60 characters or fewer.** "We follow the elder's map." / "I can fix this ladder myself."
- **Fantasy register is plain-spoken.** No thee/thou, no "mayhap". **City register is contemporary and specific**
  (a platform, a lanyard, a group chat), not generic "the city".
- **Names are inclusive and the player is never gendered.** Address them as "captain" or "you". Cast pronouns are
  picked once per character and kept (Rook: she; Vey: they; the Elder: no pronoun needed).
- **1 or 2 keywords per beat get tinted** (`keywords`). They must appear in the text, and a third is an error.
- **Whole sentences only.** Copy lives in the content file; no interpolation, no joining strings.

## Choices

- **Every option is heroic in its own way.** No moral framing, no "right" pole, no reward tied to a pole.
  The cautious pick and the bold pick both get a real result and a small, honest cost or gain.
- **Self-efficacy pairs are both framed as smart:** "I can fix this rope bridge myself" vs "Let's wait for someone
  who's done this."
- **Never show a trait.** The player sees the `approach` icon (explore, hold steady, talk it out, act, wait), not the
  axis. No psychology words on screen (`banned.ts` fences them, and "test", "diagnosis", "score").
- **Hints** (30 characters or fewer) name a cost only: "costs supplies".
- **A fail on a check makes a different story, never a punishment.** The fail scene sits at the same position as the
  success scene, on the same axis, and is just as good to read. No dead ends, no "you lose".
- **Endings are all good, just different flavours.** Three or four endings, the last one is the fallback with no conditions.

## Structure (what the validator enforces on the real campaign)

- 14 to 18 scenes, 3 chapters plus a finale, a diamond shape: branches rejoin at the end of a chapter.
- **Every path is exactly 12 scenes**, and every scene on a path is a primary scene: 3 target axes need
  3 primaries each, 4 target axes need 12. (Path cap 12; coverage floor 3 per axis; at least 2 chapters per axis.)
- A primary scene offers **both poles** of its axis. For the sim target, it also offers **one or two neutral
  choices** (no tag on that axis), so a random player lands on a pole 25% of the time, not 50%.
  Two-choice primaries fail the sim target; see `check:quest-score`.
- **Checks:** 3 or 4 d20 checks. The `success` and `fail` scenes are two scenes at the same position (same axis,
  same next scene), so both branches stay 12 long. Other choices in the scene go to the success scene.
- **Secret scene:** a scene with `requires` is skipped when its gate is closed. To keep every path 12 long, give it
  an ordinary twin: the secret scene's `next` is the twin, and the secret scene's own choices jump past the twin.
- **Flag-gated variants** change a scene's lines only (`variants`). Every flag that is read must be set by some choice.
- 3 to 4 endings, first match wins; the last one has an empty `when`.

## Ids (forever)

- Content ids match `^[a-z0-9][a-z0-9_-]{0,63}$`: campaign, scene, choice, ending and flag ids. The server refuses a run
  that carries any other id. (The validator does not check this yet; see the progress log.)
- Scene ids are `<campaign>_s<position>[b]_<name>`, frozen in `sceneIdsFrozen`. Never rename or delete a frozen id:
  mark it `retired` and give it a `redirect`.
- Bump `contentVersion` when a scene's meaning changes.

## Art fields

Each scene names a location key from `art-keys.ts`, optional props (`{id, x}`, x across the 195 px stage), a `tint`
(hex) and the cast ids on stage. Art files live in `art-src/quests` and are never `require()`d; the atlas is PHASE-22.

## Checklist before a campaign goes to emci

1. `npm run check:quests` and `npm run check:quest-score` are green on the real campaign.
2. Read every beat aloud: grade 6 to 8, one idea a line, no jargon, no moral pole.
3. Each target axis: 3 primaries on every path, a neutral beside the two poles.
4. Every fail scene is a story, not a penalty.
5. All endings are reachable, and all of them feel like a good ending.
6. Copy flag: campaign copy is unreviewed until emci signs it off.
