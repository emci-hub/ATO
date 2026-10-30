# Quests launch (PHASE-27)

Status 2026-10-29: built, gate run on branch `phase-11c-almanac-content` (local, not pushed, no OTA). emci approved the wording below and the Quests copy
(Lantern, Masquerade, Last Train: read, no changes, 2026-10-30) and the 📱 rows; he flips the two switches and publishes the one OTA himself.

## Store wording (emci approves)

> A story game; your choices can add a small hint to your profile if you choose. Not a psychological test.

Where it goes: the App Store description line for Quests. Nothing in the app claims a diagnosis. Quest hints never reach shareable
titles, push lines or widget lines (`isShareableLean` rules unchanged).

## Privacy label note (labelled per the compliance rule, CLAUDE.md 2026-10-22)

Game-derived trait hints are opt-in (Apply is a tap, off by default; "Include Quests" is a device switch, off by default) and
undoable for 24 hours after saving (Undo restores the stored `pre_values`, bounded to `pre_value ± 0.08` and `[0.2, 0.8]` after a newer write).

| Change | Label | Why |
|---|---|---|
| `privacy.md`: new "Your Quests" bullet under Usage, "Quests" added to the delete-account list | **mandatory** | the policy must describe data the app really stores (`quest_runs`, wave116); a stated-vs-real mismatch is the risk |
| `app-privacy-labels.md`: `quest_runs` named in the Other User Content row | **recommended safeguard** | Apple data types are unchanged (Other User Content, already declared and Linked), so nothing changes in App Store Connect or the plist; this keeps our own table accurate |
| `app-privacy-labels.md`: `ai_provider_log` removed from Product Interaction | **mandatory** (accuracy) | wave115 dropped the table; the label row named a log that no longer exists |
| `privacy.md` "Last updated" date | **optional precaution** | set to October 30, 2026 (emci approved the wording 2026-10-30) |
| Almanac (Pick, community counter, seasonal, recaps) | none | the same Pick answers as before; the counter is an aggregate; `ato.almanac.*` is device-only and wiped by `clearLocalAccountData` |

`PrivacyInfo.xcprivacy` and `app.json` privacy manifests need no change (no new data type, no new required-reason API, no native change).

## Switches (emci, after the OTA is live)

Set in `app_config` (root only; wave116 added them, both default false):

- `quests_enabled = true` — the entry shows and `record_quest_run` accepts runs (root already passes both switches).
- `quests_apply_enabled = true` — Apply works. Turn this on later than the first if you want a play-only week.

Done 2026-10-30: OTA `9e44cd32-814a-4bf0-94e7-f92c93523add` live, then both switches set to true (emci asked for everything on at once).

## Metrics to watch

Completion rate and drop-off scene (only finished runs are stored in `quest_runs`, so these cannot be read from the server today; watch playtest feedback, or add a counter later) · for-fun ratio (`for_fun`) · apply rate (`applied_at is not null`) · undo rate (`undone_at is not null`).

## Live-ops

- Hide one campaign without an OTA: add its id to `app_config.quests_disabled_campaigns` (`lantern`, `masquerade`, `last_train`). It hides and `record_quest_run` / `apply_quest_result` refuse (root too).
- Pause all of Quests: `quests_enabled = false`.
- Kill switch is Quests only. Gamify and the IA changes roll back via OTA, not a switch.

## Server state (verified 2026-10-29, read-only)

wave115 effectively live (everything it drops is gone), wave116 applied, wave117 applied, wave118 applied. New Quest functions are not anon-executable.
