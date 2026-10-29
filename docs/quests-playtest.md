# Quests QA + playtest (PHASE-25)

Campaigns: **The Drowned Lantern** (L), **Masquerade** (M), **Last Train** (T). wave116 is NOT applied, so on a real
server every Quests flag is off until emci applies it; test builds use the dev flag override on the Quests list.

## 1. QA matrix (2026-10-29)

Legend: ✅ verified offline (check or code) · 📱 needs a phone/iPad look by emci · ⚠ open, needs emci's decision.

| Row | L | M | T | Evidence / what is left |
|---|---|---|---|---|
| VoiceOver: full text at once, Choose action, stat announcements | ✅ 📱 | ✅ 📱 | ✅ 📱 | `dialogue.tsx` label = full text; `choice-card.tsx` `choose` action; `announceForAccessibility`; pinned by `check:quest-ui`. Listen once per campaign. |
| Dynamic Type XXL | ✅ 📱 | ✅ 📱 | ✅ 📱 | Cards use `minHeight`, no font-scaling bypass (pinned). Look at the Said screen at XXL. |
| 375×667 (plate 220 pt, sticky Save) | ✅ 📱 | ✅ 📱 | ✅ 📱 | `plateHeight(667)=220` asserted; Save sits outside the ScrollView. |
| iPad, max width 600, plate letterboxed | ✅ 📱 | ✅ 📱 | ✅ 📱 | **Fixed this phase**: stage and top bar were full window width; now capped at 600 (`STAGE_MAX_WIDTH`), pinned. Eyeball on an iPad. |
| Perf: 1 frame callback | ✅ | ✅ | ✅ | Pinned. |
| Perf: 60 fps | 📱 | 📱 | 📱 | Profile T `night-street` + `rooftop`, L `singing-lake`. |
| Perf: ≤ 60 nodes | 📱 | 📱 | ⚠ 📱 | Not measured. Estimate for T rain scenes is ~70–80 (8 rain sprites + 20 particles + layers). Measure in React DevTools; if over, cut rain to 4 sprites and particles to 10. |
| Scoring sims on real content, < 5 % false apply (worst axis) | ⚠ 5.5 % | ✅ 3.7 % | ⚠ 10.7 % | `check:quest-score` enforces a relaxed 12 % per axis / 0.02 mean (emci 2026-10-28), so it is green. Spec says 5 %: **emci defers (12 % target) or asks for a retune of T (Opus) and a nudge of L.** |
| Save migration (old save + bumped contentVersion) | ✅ | ✅ | ✅ | `check:quest-run` fixtures (redirect, version bump, unknown id restarts chapter with a notice, endings kept). All 3 are still contentVersion 1, so no real bump has run yet. |
| Offline Apply then retry | ✅ 📱 | ✅ 📱 | ✅ 📱 | `check:quest-apply` (queue, same run id, dedupe, flush). Try airplane mode once on a phone. |
| Flags off | ✅ | ✅ | ✅ | Entry points were already gated. **Fixed this phase**: the run route `/quest/<id>` still played when `quests_enabled` was off or the campaign was in `quests_disabled_campaigns`; it now shows "This quest is resting". Pinned. |
| 30-day / 7-day rules | ✅ | ✅ | ✅ | `check:quest-score`, `quest-apply`, `quest-run`. Server side untested until wave116 is applied. |
| Endings tracker | ✅ | ✅ | ✅ | "Ending N of M" on fixtures; no per-campaign count assertion. Check it on the phone after finishing a second ending. |

## 2. Playtest script (emci runs it)

**Setup.** 5 testers, one campaign each (suggest L ×2, M ×1, T ×2). iPhone, current build, Quests flag on (dev override or
wave116 applied). Tester is 18+, signed in with their own account only if wave116 is live; otherwise use "for fun" runs.
Sit with them, do not explain the screens. Record screen + voice if they agree.

**Say this first.** "This is a story game. Say out loud what you are thinking. Nothing here is a test and there are no
wrong choices. Stop whenever you like."

**Tasks (about 15 min).**
1. Find Quests (Insights card or More). Say what you expect before you tap.
2. Pick the campaign you were given. Play to an ending. Do not coach.
3. On "What your choices said": read the cards aloud, tick what sounds like you, Save (or "I was messing around").
4. If you Saved, find Undo on You → "From your quests" and use it.
5. Replay one scene with Rewind.

**After (ask, write down verbatim).**
- Fun, 1–5: ____
- Where were you confused or stuck? (scene, screen)
- Did the choices feel like they mattered? Any choice with no good option?
- Did the "said" cards sound like you? Any that felt wrong or creepy?
- Was it clear that saving is optional and undoable?
- Anything hard to read, hear or tap (text size, VoiceOver, small buttons)?

**Log (one row per tester).**

| Tester | Campaign | Fun 1–5 | Finished? | Ending reached | Drop-off scene | Cards shown | Cards ticked | Saved? | Undo used? | Confusion points |
|---|---|---|---|---|---|---|---|---|---|---|

**Apply-rate** = testers who Saved with ≥1 card ÷ testers who reached the Said screen. **Targets to watch** (not pass/fail):
completion ≥ 4 of 5, fun ≥ 3.5 average, no scene where 2+ testers drop off, no tester who ticked a card and did not
understand it was optional.

**Fix loop.** Notes go back into this phase: re-open PHASE-25, fix the failing file only, re-run `check:quest-ui` and
`check:quest-score`.

## 3. Accept status

All rows are ✅ or 📱 (emci looks on a device) except two ⚠ that need an explicit emci decision: scoring 5 % vs 12 %,
and the T node count. Neither is silently deferred.
