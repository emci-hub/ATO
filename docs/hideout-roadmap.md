# Hideout roadmap (Divecore) — the plan's state

Approved by emci 2026-10-15 ("accept all recommendation"). One fresh chat per step: each step ends with a short
assessment, the next step, and a copy-paste prompt for the next chat (global CLAUDE.md "Multi-step plans").
Every step: one draft PR, previews at 430×932 + 375×667, `npm run check:ota-gate`, one reviewer pass, then emci's
OK → merge → `npm run ota:publish`. Play-only rules: `.cursor/rules/play-isolation.mdc`, `fixed-regions.mdc`,
`stage-bounds.mdc`. No economy changes without emci.

## Status

| # | Step | State |
|---|---|---|
| 0 | Hideout rails + aura fix | ✔ OTA `2bc10c53` (#40, #41) |
| 0b | Polish batch (LF art pins, holo tip, archive hideout-fx; **Sleep pending**) | draft PR #44 |
| 1 | Foundations: Divecore on in every build, cloud save (wave96), 6 anonymous counters | ✔ OTA `44ebd8b6` (#42, #43) |
| 2 | While you were away card | ✔ OTA `9a94d37f` (#45) |
| 3 | Pet that knows you | built, draft PR #46; bank approved by emci 2026-10-15 (`PET_KNOWS_YOU_COPY_REVIEWED = true`) — awaiting merge + OTA OK |
| 4 | **Daily visitors** | **next** |
| 5 | Decor slots | — |
| 6 | Circle visits | — |

## Decisions (do not re-ask)
- Divecore stays on in every build; dev tools stay behind `PRE_LAUNCH_DEV`.
- Pet talk may reflect **all 16 traits, both ends**; its talk style may change with them. Lows are never dropped and
  never framed as flaws: **cognitive reappraisal** — describe the moment / sensation in everyday words, as a state,
  never a clinical label. Thin data → the pet hedges ("still figuring you out"), it does not go silent. No model calls
  (stored, hand-written lines). Moment voice (`src/lib/voice/moment-voice.ts`). emci reads the bank (COPY_REVIEWED flag).
- Visitors: their own reward (sticker / rare look), never hero copies; 12 rotating weekly; only heroes with room-ready clips.
- Decor: split the Hideout's baked prop art first, then 3 slots in one room.
- Circle visits last: opt-in, pet + room only (never traits), 1 gift / friend / day, deletion + reset handled.
- "Up" in the Underground room = Rooftop. The 4 rail icons (Sleep, Light, Back, Up) are made with the decor art pass.

## Step 3 input: the reframe word list (emci reviews; edits become the bank)

| Trait | High end | Low end |
|---|---|---|
| extraversion | people-charged, buzzy around others, group-chat regular | quiet-charged, recharges solo, likes a calm corner |
| openness | curious, tries the new thing, side-quest energy | knows what it likes, loyal to favorites, the usual order |
| conscientiousness | follows through, list-maker, plans stick | goes with the flow, plans in pencil, improvises |
| agreeableness | easygoing, keeps the peace, smooths things | says what it thinks, holds its ground, honest even if it rubs |
| steadiness | even-keeled, unbothered by bumps | feels things fully, big waves, busy-brain day |
| attachment_anxiety | checks in a lot, reads the read receipts, wants to know you're still here | relaxed about space, trusts the quiet |
| attachment_avoidance | needs some elbow room, slow to let people in | sticks close once it's in, all-in with its people |
| conflict_assertiveness | speaks up, puts its point on the table | picks its battles, lets small things slide |
| conflict_cooperativeness | looks for the middle, a deal both can live with | looks after its own corner first |
| autonomy | does it its own way, own route | happy to follow a good plan |
| competence | "I've got this" energy | double-checks itself, wants a warm-up first |
| relatedness | needs a real moment with someone to call it a day | fine on its own, a solo day still counts |
| growth_mindset | a miss is practice, tries again | takes a miss to heart, needs a minute before round two |
| locus_of_control | "what could I tweak?" | "some days just go sideways" |
| self_efficacy | big task? steps right up | big task? some jitters before the start |
| playfulness | finds the joke, plays first | gets it done, jokes later |

Sample lines: low steadiness → "Busy-brain day? I'll sit right here." · high attachment_anxiety → "Still here. Didn't go anywhere."

## Step 3 as built (pet that knows you)
- Files: `src/play/pet-knows-you-bank.ts` (119 hand-written lines: 16 traits × 2 ends × 3, 8 hedges, 15 streak lines;
  ids `pky_*` forever), `pet-knows-you.ts` (pure rules), `pet-knows-you-store.ts` (adapter), `use-pet-knows-you.ts`
  (hook), one call site in `pet-screen.tsx` (the idle timer). `npm run check:pet-knows-you`.
- Reads app code only (`fetchTraitTracks` report track, `daily-insights` streak). Cache = each trait's end ("high"/"low")
  only, one account, key `ato.play.petKnowsYou.v1` (wiped with the rest of `ato.*`). Preview as new user, signed out,
  offline → hedge line, never silence, never a crash. Nothing in the cloud save, away card, Circle or any share.
- Rare: one per visit, 25 min cooldown (lively ×0.7, calm ×1.3), 40% roll per idle tick (lively 50%, calm 30%), never
  the same line twice in a row, never the same trait within 2, a trait needs 3+ report answers and a clear end
  (<0.35 / ≥0.65). With a streak ≥ 1, ~30% of personal lines are streak lines; a broken streak says nothing.
- Chatter Off = no personal lines (they ride the idle timer). A tap never says one.
- **Lessons:** (1) the word "problem" and "you are" appear in everyday hedges — the check bans "you are/you're" literally,
  so "my notes on you are short" had to be reworded; (2) keep the parse/state helpers in the pure module so the check
  never imports supabase; (3) web previews: `expo start --web` still dies with EMFILE on Windows — use the static
  export in `docs/divecore/tools/README.md`; a personal line needs a signed-in profile, so previews use a local-only
  demo override that is never committed.

## Facts a new chat needs
- Pet lines today: `src/play/pet-talk.ts` (`PET_TALK_LINES` per branch, 15 situations, `pickPetLine`, random, no memory);
  idle timer in `src/play/pet-screen.tsx` (`say()`, `idleTalkDelayMs`, chatter setting).
- Traits: `src/lib/traits.ts` (`TRAIT_AXES`, 0–1 values, `TRAIT_POLE_LINES`, bands low <0.35 / high ≥0.65),
  tracks via `fetchTraitTracks(userId)` in `src/lib/trait-tracks-store.ts` (report vs game track, stability, answerCount).
  Play may import app code (the isolation rule only stops one PR from editing both sides).
- Daily check-in streak: `src/lib/daily-insights/` (`currentStreak`, `isDoneToday`).
- Stored-tip pattern to copy: `src/lib/insight-bank/` (hand-written, ids forever, picked on the phone, `*_COPY_REVIEWED`).
