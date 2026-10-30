# Release notes: the ATO-BUILD release (draft, emci approves wording)

One OTA, no native change. Runtime stays 1.2.0 (no new native deps; OTA only).

## For players (App Store / what's new)

- **Quests.** Three short story games: The Drowned Lantern, The Masquerade, Last Train Home. Play as yourself or just for fun.
  If you choose, a finished story can add a small hint to your profile. You can Undo it. Not a psychological test.
- **The Almanac.** A calendar-aware daily Pick, "You're in the N%" after you answer, seasonal touches, and week, month and year recaps with badges.
- **Home, Insights and Legends feel new.** A constellation on Home, a calmer Insights with event cards, and reveal animations that respect Reduce Motion.
- **You tab.** "This is you so far" and your reveals live in one place; Explore is folded into You.
- **Settings.** Everything in one screen, including the tab layout reset.
- **Accessibility.** Clearer VoiceOver labels on headers and the More sheet, 44 pt tap targets, larger-text fixes.

## For emci (not user-facing)

- Database: waves 115 to 118 are live. Quests and Apply stay OFF until you set `quests_enabled` / `quests_apply_enabled`.
- Scenario picks no longer write the original trait columns (wave118); they still move the game track.
- Still behind a copy flag: `ALMANAC_COPY_REVIEWED = false` (your ticks in `docs/almanac-review.md` and `npm run load:almanac` are still to come), plus the older `false` flags (`CATEGORY_STATEMENTS`, `PROFILE_CARD`, `LEGEND_FIGURES`, `CIRCLE_COMPARE`).
- `ALMANAC_PICK_CUTOVER` is a placeholder (2027-02-01): confirm it is at least 14 days after the OTA date.
- No push, no OTA were done by Claude. Publish with `npm run ota:publish -- <eas args>`.
