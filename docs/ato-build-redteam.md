# ATO-BUILD red team (PHASE-00)

Date: 2026-10-26 · Scope: whole of `docs/ATO-BUILD.md` vs. master (pulled, up to date) · Method: read the plan end to end, two read-only repo audits (routes/nav/traits/motion/checks, then phases 01–11). **No checks were run**; "not verified" is stated where it applies.

## Findings

| ID | Sev | Area | PHASE | Evidence | Fix |
|---|---|---|---|---|---|
| R01 | High | Functions | 17 | `supabase/migrations/wave115_drop_ai_provider_layer.sql` exists; latest is wave115, not wave114 | Quests SQL is **wave116** everywhere |
| R02 | High | Plan | 01,02,04,06,07,11 | Audit: settings.tsx (sections, gear on Home), ProfileCharacter on You, nav v3 + `play` slot, `explore.tsx` = Redirect, `src/app/roll.tsx` + Legends row, `src/content/{copy,legal,voice}` all already on master | Those phases become **verify-only**: confirm acceptance checks, fix gaps, no rebuild. PHASE-05: only the constellation header remains |
| R03 | Med | Plan | 05 | `rg -i constellation src` = 0 hits; PHASE-03 not built | PHASE-05 header step stays gated on PHASE-03 (Deps already 03). Do the rest of 05 as verify-only |
| R04 | Low | Plan | 04 | `nav-order.ts` comments mention Explore at :9,:172,:176,:240 | Fix the stale comments in PHASE-04 verify pass |
| R05 | Low | Plan | 01–07 | Reviewer confirmed `trait-bands`, `trait-shape`, `tab-rename`, `prod-you` exist. There is no `check:settings`, `check:roll` or `check:reveals` (closest: `check:reveal`, `check:you-restored`, `check:play-settings`) | Each verify-only phase starts with `rg` of `package.json` for the named checks; a missing name is logged and the closest existing check is used, never skipped silently |
| R06 | Low | Naming | 16,23 | Appearance id `quest` exists (`appearance.ts:17,155`; chrome.ts:45, themed-text.tsx:48) | Quests UI tokens (§1.8) are independent of the `quest` appearance mode; never branch Quests visuals on it. Noted in §1.2 |
| R07 | High | Economy | 10,17 | Apply double-tap / offline retry can double-write | Client in-flight lock + idempotency key = run id; acceptance: two concurrent Applies → one write; reveal tap during animation is ignored (PHASE-10) |
| R08 | High | Functions | 17 | Spec says Undo "applies the inverse nudge" if the game track changed since; EWMA is not invertible | Undo after a newer write: restore only if unchanged, else bounded inverse that never leaves `pre_value ± 0.08` or `[0.2,0.8]`; acceptance test with a newer write in between |
| R09 | High | Quests game | 14,17 | 7-day/30-day rules are described client-side; clock change or reinstall bypasses them | **Server is the source of truth**: `record_quest_run`/`apply_quest_result` enforce 30-day evidence and 7-day axis rules from `quest_runs`; client only mirrors for UX |
| R10 | High | Functions | 17 | `_trait_write(uuid,text,text,double,text)` has **no weight parameter** (wave79:204); plan's weight `g` and "\|Δ\|≤0.08" can't be passed in | PHASE-13 must read the game branch of `_trait_write` and record how it merges; PHASE-17's `apply_quest_result` takes `{axis,s,g}`, validates `g≤0.25`, `s∈[0.2,0.8]`, and clamps Δ server-side before calling. If `_trait_write` can't honour g, stop and ask emci |
| R11 | High | Security | 17 | New SECURITY DEFINER RPCs | `set search_path = public, pg_temp`; reject null `auth.uid()`; `revoke ... from public, anon`; grant to `authenticated`; validate every jsonb field; no direct DML grants |
| R12 | High | Privacy | 17,27 | `quest_runs` holds per-user choices/events | `on delete cascade` to the user; `delete-account` and `reset_my_account` wipe it; extend `check:delete-account` (a live check excluded from the gate, so PHASE-17 and 27 run it by hand); PHASE-27 updates `app-privacy-labels.md` as well as `privacy.md`, labelled mandatory/recommended per the compliance rule |
| R13 | Med | Quests game | 12 | Validator "every path" must include d20 fail branches | Path enumeration explicitly walks both `success` and `fail` targets; axis ids must exist in `TRAIT_AXES`; fixture for a fail-only dead end |
| R14 | Med | Quests game | 12 | Plan cites `banned.ts` and a "framework fence"; not verified to exist | PHASE-12 first locates it; if absent, create `src/lib/quests/banned.ts`. The fence covers only psych jargon/"test"/"diagnosis"/"score" in Quests copy; the core content policy (meaning over keywords) is untouched |
| R15 | Med | Quests game | 14 | Saves in AsyncStorage can be corrupt or hand-edited | `migrateSave` wraps parse in try/catch, validates shape/size, falls back to chapter restart; corrupt-save fixture |
| R16 | Low | Quests game | 14 | d20 seeded by runId+sceneId+choiceId; a new run re-rolls | Accepted: d20 changes story branch, not evidence weight (validator guarantees coverage on fail branches). Logged, no change |
| R17 | Med | Animation | 16 | Hold-to-commit vs ScrollView scroll, double-tap vs VoiceOver activate | With VoiceOver/Switch Control on, expose a single `accessibilityActions` "Choose" and skip the hold; hold gesture uses `activateAfterLongPress`/`failOffsetY` so scrolling wins on vertical drag |
| R18 | Med | Animation | 03 | Reduce Motion rule must cover every `withRepeat` | `check:motion` also fails any new file that uses `withRepeat`/`withSequence` without `useReducedMotion` |
| R19 | Med | Animation | 08 | Week-strip pink glow ring grows 0→4px (>2pt) | In Reduce Motion: fixed ring, opacity breathe only |
| R20 | Med | Graphics | 22 | Atlas frames pre-scaled ×2 and offset by expo-image can bleed neighbours | 2px transparent padding + edge extrude per frame in the builder; `check:quest-atlas` asserts padding; all pixel offsets via PIXEL_SNAP |
| R21 | Med | Economy | 08 | Streak/rest-day week boundary, DST, timezone change | Use the same local-date key as `check-window*` (`me.timezone`); fixtures for DST day, timezone change, week boundary, rest day |
| R22 | Med | Functions | 06,23 | Deep links (`/you?section=quests`) when flag is off or section unknown | Unknown or flagged-off section scrolls nowhere and shows no error; deep-link fixture in `check:you` |
| R23 | High | Plan | 15,21 | **Conflict with `CLAUDE.md`**: art rules require library-first, `art:import`/registry/`art:sync`, the 32px size ladder (heroes native 128) and PixelLab pre-flight (read both guides, `search_help`, `get_balance`, ONE test clip for emci's ok, ask before ~20+ generations or any Pro call). The plan says 64px heroes, own `art-src/quests` + `assets/quests` atlas, "no limits". Plan tool names (`generate-with-style-v2`, …) also differ from the MCP's real tools (`create_image_pixflux`, `animate_character`, …) | **⚑ emci decision** (see below). Until answered, PHASE-15/21 stay blocked. Plan tool names are indicative; the real names are used |
| R24 | Med | Plan | 22 | `sharp`/`pngjs` not in `package.json` | Builder must be pure JS or ask emci before adding a dev dependency (CLAUDE.md: no dependency change without ok) |
| R25 | Med | Plan | 12,13,14,17,23 | `clearLocalAccountData` exists (`local-account-data.ts:173`); a check likely lists keys | Add the three new keys and repoint that check (never weaken it) |
| R26 | Med | Plan | 27 | Cursor and other sessions push to master; memory rule "pull before publish" | PHASE-27 merges latest master into `ato-build` before the final gate; mecha-heroes work (local commits) stays independent |
| R27 | Low | Plan | 08–10 | Phase files list `check:` names loosely | Covered by the R05 rule; every phase's "must be green" list is resolved against `package.json` at plan time (also stated in §0 item 5a) |

## R23 decision (RESOLVED by emci 2026-10-26: "Yessir", accepting the recommendation below)
Quests art vs `CLAUDE.md`. Recommendation: **follow ATO-BUILD for Quests art only** (64px stage heroes, own atlas, no generation cap — you wrote it later and called it final), but keep these CLAUDE.md safeguards: PixelLab pre-flight docs read, `get_balance`, ONE test clip for your ok before any batch, credits logged, and Quests assets exempt from `art:registry` only if `check:art-registry` stays green (otherwise add a registry category `quests`). Say "yes" or tell me which rule wins.

## Applied to ATO-BUILD.md
- `## CHANGELOG` block added under the title.
- wave115 → wave116 (R01); §1.2 baseline and facts refreshed (R01, R02, R06, R24).
- Status lines on PHASE-01, 02, 04, 05, 06, 07, 11 (verify-only) (R02–R05).
- Added acceptance checks: PHASE-03 (R18), 08 (R19, R21), 10 (R07), 12 (R13, R14), 13 (R10), 14 (R09, R15, R25), 16 (R17), 17 (R07–R12), 22 (R20, R24), 23 (R22), 27 (R12, R26).
- §1.9 ⚑ note for R23.
- No rule in §1 weakened. No phases added; anchors unchanged.
