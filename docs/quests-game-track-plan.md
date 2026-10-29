# Quests keep their own number (plan, 2026-10-29)

Idea (emci): the questions stay the real profile and are never touched by the game. Quests keep their own
per-trait number. A profile can optionally "include Quests" and show the combined result. Nothing is written
into the original.

## 1. What is true today (investigator map, 2026-10-29)

- Quest Apply / Undo (`apply_quest_result`, `undo_quest_result`, wave116, **not applied**) already write only a
  game-track row (`trait_tracks`, `track='game'`, stability 0, answer_count 0, history source `self_game`).
  They never touch the `me` columns or the report track. Max nudge 0.08, 7 days per axis, 30-day window, 24 h Undo.
- Nearly every reader (profile card, constellation, shape, character, insight/category banks, deep dive, Legends,
  pet, push, Circle compare, server snapshots) reads the **report** track. So a Quest result moves none of them.
- Only the Said preview and the "told vs played" note read the game track.
- **Two leaks / overlaps:**
  1. Quests and `record_game_pick` (scenario / depth-dive picks) share the same `(user, axis, 'game')` row. A
     scenario pick can seed the row Quests then nudge, and gives it stability and answer_count.
  2. `_trait_write` mode `game` (scenario picks, **not** Quests) also writes the original `me.<axis>` column on the 7
     extra axes (`0.12*s + 0.88*cur`, wave79:313). That is existing behaviour, separate from Quests.

## 2. Design

**D1. Quests get their own track.** `_quest_game_write` writes `track='quest'` instead of `'game'`.
wave116 is not applied, so this is a plain edit before apply (clean-slate policy), not a migration on live data.
Scenario picks keep `'game'`. Check the `trait_tracks.track` constraint / enum first (step S1).

**D2. The original is untouched by default and by every shared surface.** Server snapshots, `_profile_payload`,
Circle compare, AI inputs (insights, deep dive, Legends, pet), push, widgets and share cards stay questions-only.
The combined view is a **display layer on this device only**, on the profile screens.

**D3. One helper, one rule.** `effectiveValue(tracks, axis, includeQuests)` next to `trackFor`
(`trait-stability.ts`). Base = report value. With `includeQuests`: `base + clamp(quest − 0.5, −CAP, +CAP)` for the 10
Quest axes only, result clamped 0–1. Proposed `CAP = 0.15` (so even many runs cannot swing a profile far). A missing
quest row = no change. No other file computes the blend.

**D4. Toggle.** "Include Quests" on the profile, **off by default**, stored on the device (AsyncStorage, per
account id). No schema. If it is later wanted on every device, add a `me` boolean with a `set_*` RPC built like
`set_circle_compare_share` (wave105), a tested path.

**D5. Show both.** With the toggle on, the profile shows the combined value and keeps the original visible
("Questions 62 · with Quests 68"), so the person can always see what the quiz alone says. Which profile views
(card, full profile, constellation) get it is decided in step S3; Circle and share cards stay questions-only.

**D6. Optional, needs emci's ok:** stop `_trait_write` mode `game` writing `me.<axis>` (leak 2). That changes an
existing function and `check:trait-checkpoint` parity, so it is a separate decision, not part of this change.

## 3. Steps (one chat each)

- **S1. Quest track split.** Edit wave116 (`_quest_game_write`, undo path, `pre_values`) to `track='quest'`; check the
  `trait_tracks` constraint; update `quests/score.ts` / `apply.ts` / `trait-history` readers that assume `'game'`;
  update `check:quest-apply` and `check:trait-checkpoint` expectations; keep Said preview reading the quest track.
  Done when: Apply/Undo never read or write the `'game'` row, and a scenario pick and a Quest run no longer share one.
- **S2. `effectiveValue` + pure tests.** New check `check:quest-blend`: off = identical to today for every axis,
  cap holds, missing row, non-Quest axes ignored, deterministic.
- **S3. Toggle + profile display.** Local toggle, profile shows both numbers, Reduce Motion / VoiceOver labels
  ("Questions 62, with Quests 68"), empty state when there are no Quest results. Pin that only profile screens import
  the blend (`check:quest-blend` source scan: no insight/AI/Circle/push/snapshot file imports it).
- **S4. QA + red-team notes + docs.** NOW.md, PROJECT_CONTEXT.md, privacy wording (derived hint stays opt-in and undoable).

Gate each step with `check:ota-gate`. No push, no OTA until emci says.

## 4. Open decisions for emci

1. Cap on how far Quests can move the combined number (proposal ±0.15).
2. Toggle on this device only (proposal) or on every device (needs a `me` column + RPC).
3. Show both numbers when on (proposal) or only the combined one.
4. D6: also stop scenario picks writing the original `me` column? (existing behaviour, separate change).

## 5. Red-team result (one pass, 2026-10-29) and the revised plan

The red team found 2 blockers and 4 high issues. **This section replaces §2–§3 wherever they differ.**

### Fixes folded into the design

| # | Finding | Fix |
|---|---|---|
| 1 BLOCKER | `trait_tracks_kind` CHECK only allows `report`,`game` (wave20:31); Apply would fail with 23514 | In wave116, drop/re-add the constraint with `'quest'` (wave21:33-35 pattern). Leave wave20 alone (pinned by `wave20-check`). |
| 2 BLOCKER | wave116 restates `reset_dev_test_user` and `count_user_rows` using `ai_provider_log`, which wave115 drops | Remove the `ai_provider_log` lines from wave116; check that restated bodies only name existing tables. |
| 3 HIGH | Phone parser (`trait-tracks-store.ts:15`) and type `TraitTrackKind` drop `quest` rows | Add `quest` to both; Said preview (`score.ts:211`) reads `trackFor(..., 'quest')`. |
| 4 HIGH | History source `self_game` is shared: Undo stops being exact on 4 axes; Quest values show in "How this has shifted", Almanac "What shifted", told-vs-played | New history source `self_quest` (swap `trait_history_source_known` like wave38). Undo looks for it. Keep it out of the client `TraitSource` list so `fetchTraitHistory` drops it. Filter `self_game` out of `almanac/shift.ts` too. |
| 5 HIGH | Blend could reach share cards through the shared `tracks` prop | `effectiveValue` returns its own display type (number + label), never a `TraitTrack`. `check:quest-blend` scans share-card, share-poster, identity-card, home-hero, holo-card, almanac/* and asserts `content.tracks` is the raw array. |
| 6 HIGH | Additive blend overshoots on settled axes (0.90 + 0.12 → 1.0) | Scale the offset by the room left toward the pole it pushes; a game signal never takes the result past 0.8 / below 0.2 unless the report is already there. |
| 7 MED | Axis with no report row: no base value | No report row → no blend and no "Questions" label. Compare against the value actually shown (`report?.value ?? me`). Decide whether `start_fresh` also clears quest rows (default: yes, with the report). |
| 8 MED | Full profile shows a stale combined number after Apply/Undo | Bump the account-data epoch on Apply and Undo; full profile refetches on it. |
| 9 MED | Wrong checks named | Update `quest-apply-check.ts` (:528, :530, :552, fake `server.game` :177/:436) and `quest-score-check.ts` (:74, :105, :238); add pins for the new constraint and the `self_quest` Undo. `check:trait-checkpoint` is not involved. |
| 10 MED | Toggle "per account" is wiped at sign-out | Key `ato.quests.include.v1:<uid>`; it resets to off at sign-out and in Preview, said plainly. |
| 11–15 LOW | D6 scope; told-vs-played note; D5 numbers; privacy; cooldowns | D6 = any of the 16 axes. S4 notes the told-vs-played change. **D5: show two dots on the band (questions / with Quests), no numbers** (standing positions-not-numbers rule). Privacy label unchanged, wording mentions the opt-in view. Decide `start_fresh` vs cooldowns. |

### Revised steps (one chat each; S1 must finish before S2)

- **S1. Quest track + history split (server + phone plumbing).** Fixes 1, 2, 3, 4, 9. Edit wave116 only (still NOT applied):
  `track='quest'`, constraint, `self_quest`, drop `ai_provider_log` lines; parser/type; Said preview; almanac filter;
  update the two check files. Done: Apply/Undo never touch `game` or `self_game`; Undo exact; all checks + gate green.
- **S2. `effectiveValue` + `check:quest-blend`.** Fixes 5 (type barrier), 6, 7. Pure tests: off = identical to what
  is displayed today for all 16 axes, cap/room rule, no report row, non-Quest axes, share-card raw tracks, scan list.
- **S3. Toggle + profile display.** Fixes 8, 10, D5. Two-dot band, local toggle, VoiceOver labels, empty state.
- **S4. QA + docs.** Told-vs-played note, privacy wording, NOW.md, PROJECT_CONTEXT.md, `start_fresh` decision.

### Decisions needed from emci before S1
1. Cap / room rule as above (proposal: ±0.15 and never past 0.8/0.2 unless the report is there).
2. Toggle on this device only, resets at sign-out (proposal) or every device (needs a `me` column + RPC).
3. Two dots, no numbers (proposal).
4. `start_fresh` also clears the Quest numbers (proposal: yes).
5. D6 (scenario picks stop writing the original `me` column, any of 16 axes): separate change, ask later.

### Decisions (emci, 2026-10-29): all five proposals accepted
1. Cap ±0.15; a game signal never takes the combined value past 0.8 / below 0.2 unless the report is already there.
2. Toggle on this device only (`ato.quests.include.v1:<uid>`), resets to off at sign-out and in Preview.
3. Band shows two dots (questions / with Quests), no numbers.
4. `start_fresh` also clears the Quest numbers (and decide `quest_runs` cooldowns in S4).
5. D6 (scenario picks writing the original `me` column, any of 16 axes) is a separate later change; ask then.

State: S1 DONE locally (2026-10-29, not pushed, wave116 still NOT applied): wave116 now writes `track='quest'` / history `self_quest`
(constraints re-added, `ai_provider_log` lines removed); phone parser/type/Said preview/almanac filter updated; `check:quest-apply` pins the
constraint, the exact `self_quest` Undo and "restated bodies name no dropped table". Not done in S1: `start_fresh` is not restated in wave116
(wave101's version clears only the report track and all history), so clearing Quest numbers on start_fresh moves to S4 with the `quest_runs`
cooldown decision.
S2 DONE locally (2026-10-29, not pushed): `effectiveValue(tracks, axis, includeQuests, fallback)` in `trait-stability.ts` returns its own
`{value, label, blended}` type (never a `TraitTrack`); cap ±0.15, offset scaled by `min(1, 2·room)`, held in 0.2–0.8 unless the report is
already outside it; no report row = no blend and no label; 10 Quest axes only. `check:quest-blend` pins it (and is in the gate). Its source
scan keeps the blend out of share-card/poster, identity-card, home-hero, holo-card and almanac/*, and `you.tsx` share `content.tracks` raw.
S3 DONE locally (2026-10-29, not pushed, not verified on device): "Include Quests" switch (`quests/include-store.ts`, key
`ato.quests.include.v1:<uid>`, off by default, device only, wiped at sign-out, off in Preview, row on the You tab under the bands with the
reset said in its copy). `TraitBandsFold` and `FullProfileFold` show a second open dot via `withQuestDot` only when the switch is on and
`effectiveValue(...).blended`; no numbers; VoiceOver says positions; empty state "No Quest results yet". Quest Apply/Undo fire a
separate signal (`quests/quest-change.ts`, via `createQuestApplier` `onChange`) and Full Profile refetches on it (fix 8). Deliberately NOT the
account-data epoch: reviewer found that bump resets Questions, Legends and the buddy. The row also stays visible while the switch is on
even if Quests is turned off remotely. `check:quest-blend` now scans all of `src/`:
only those two folds may use the blend, only they, the switch row, its store and the sign-out reset may touch the switch.
S4 DONE locally (2026-10-29, not pushed, wave116 still NOT applied): wave116 §8 restates `start_fresh` = wave101 body + two changes (`trait_tracks`
`track in ('report','quest')`; `quest_runs` rows with `applied_at` and no `undone_at` get `undone_at = now()`). Cooldown decision: Start Fresh frees the
7-day-per-axis Apply cooldown (so re-answering and re-Applying works) but keeps the runs (history, analytics) and leaves the 30-day-per-campaign rule alone
(it decides which runs count, not a trait number). Scenario picks (`game` track) are untouched. `check:quest-apply` pins this, and that Start Fresh calls
`questApplier.clearStamps()` (drops the phone's 7-day stamps and "From your quests" list, then signals `quest-change.ts`; reviewer-found). Told-vs-played reads scenario picks only (comment on `trackFor`). Privacy draft + store pack mention the opt-in, undoable hint and
the device-only "Include Quests" view. Phone check still owed for S3's two dots and the switch row (see PROJECT_CONTEXT).
D6 DONE locally (2026-10-29, emci ok, not pushed, `wave118_game_pick_no_me.sql` written and NOT applied; independent of wave115/116): `_trait_write` mode 'game' no longer writes
`me.<axis>`, `trait_sources` or `trait_touched_at` (any of the 16 axes); it still moves the `game` track and writes one `self_game` history row (now holding the game-track value). Existing `me` values are not touched. Client: `pickScenarioAxis` /
`resolveScenario` take an optional `played` list (no live caller yet: the weekly scenario card is not mounted), `DepthDive` takes `hasGameTrack`. Pinned by `check:trait-checkpoint` section 6 and `check:scenario`.
Known effect: an extra axis filled only by a scenario pick leaves `me` empty, so Full Profile shows it as unanswered and profile snapshots / `_profile_changed` no longer move on picks. Phone check owed after wave118 is applied.
PLAN COMPLETE except the phone checks and applying wave115, wave116, wave118.
