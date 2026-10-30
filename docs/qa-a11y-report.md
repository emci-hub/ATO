# Whole-app a11y + states report (PHASE-26, offline half, 2026-10-29)

Legend: ✅ verified in code · 🔧 failed, fixed this phase · 📱 needs a phone/iPad look by emci · ⚠ open, needs emci's call.
Screens: S Settings · Y You · N tab bar/More · R Your reveals · H Home · I Insights · L Legends · Q Quests.
Method: read-only code audit by the investigator, then fixes. No script covers S, Y, N, R, H or L a11y (existing pins:
`check:motion`, `check:quest-ui`, `check:legends-g4`, `check:insights-g3`, `check:daily-insights-ui`, `check:nav`, `check:fixed-regions`).

| Check | S | Y | N | R | H | I | L | Q |
|---|---|---|---|---|---|---|---|---|
| VoiceOver roles / labels / state | 🔧 | 🔧 | 🔧 | ✅ | 🔧 | 🔧 | 🔧 | ✅ |
| VoiceOver swipe order | 📱 | 📱 | 📱 | ✅ | 📱 | 📱 (flip card: both faces mounted) | 📱 | ✅ |
| No `allowFontScaling={false}` on body text | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 44 pt targets, no fixed text heights | 🔧 | ✅ | 🔧 | ✅ | ✅ | ✅ | 🔧 | ✅ |
| Dynamic Type XXL (real layout) | 📱 | 📱 | 📱 (5 tab labels at 375 wide) | 📱 | 📱 | 📱 | 📱 | 📱 |
| 375×667 | 📱 | 📱 (constellation 220 pt) | 📱 | 📱 | 📱 (hero) | 📱 | 📱 | 📱 |
| iPad centred at `MaxContentWidth` | ✅ code, 📱 | ✅ code, 📱 | ✅ full width (emci, F5) | ✅ code, 📱 | ✅ code, 📱 | ✅ code, 📱 | ✅ code, 📱 | ✅ code (600), 📱 |
| Empty / loading / error | ✅ | ✅ | n/a | ✅ | ✅ | ✅ | 🔧 | ✅ |
| Reduce Motion handled in code | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reduce Motion recording | 📱 | 📱 | 📱 | 📱 | 📱 | 📱 | 📱 | 📱 |
| Haptics through the map (`motion-tokens.ts`) | ✅ | ✅ | ✅ | ✅ | ✅ | 🔧 | ✅ | ✅ |

## Fixed this phase

- **F1 headers.** `accessibilityRole="header"` on the screen titles and section heads: `settings.tsx` (title + 8 section heads),
  `seasonal-prefs-fold.tsx` (Hemisphere), `you.tsx`, `index.tsx`, `insights.tsx`, `legends.tsx` (title + hall name), More sheet title.
- **F2 More sheet.** "Close" is a labelled 44 pt button; the dismiss layer has a button role; each row gets an "Edit tab bar"
  accessibility action (long-press had no VoiceOver route).
- **F3 Settings rows < 44 pt.** `detailRow` (ATO's AI switch), the Seasonal fold `row` and the hemisphere `segment` now `minHeight: 44`.
- **F4 Legends.** Hall tile label no longer has a fixed `lineHeight` (clipped at XXL); met chips and the "Go to Questions" link are 44 pt.
- **F6 Legends error state.** A failed first load now shows "Couldn't load the museum." with Try again (it used to say the museum
  was locked). Shown only while nothing has loaded, so a failed refresh never hides good data.
- **F7 haptics.** `try-today-card.tsx` called expo-haptics directly; it now uses `haptic.commit()` (same feel, through the map).

## Open

- ✅ **F5 tab bar on iPad (decided 2026-10-29).** The bar (`app-tabs.tsx:286-299`) and the More sheet (`nav-more-sheet.tsx` `sheet`)
  stay full window width while content is capped at `MaxContentWidth`. emci: keep full width. No code change.
- ⚠ **Not read in detail** (trusted to their pinning scripts): AlmanacDeckCard, YearRecap pager internals, quest `stage.tsx`,
  the IdentityCard share flow.
- 📱 **emci on a device:** VoiceOver order on every screen (esp. the Insights flip card), XXL on 375 wide (tab labels, week/year
  recap cards, Home path and streak chips), 375×667 fit (Home hero, You constellation), iPad centring, the Reduce Motion
  recording, haptic feel, and whether the More sheet fade respects Reduce Motion (OS-handled).
- Not added: a check that no file outside `motion-tokens.ts` and `src/play/street-feel.ts` imports `expo-haptics`.

emci said "its good on phone" (2026-10-29) without naming which checks; recorded as a phone look OK, no 📱 row ticked from it.
Asked again at the PHASE-27 pre-flight (2026-10-29): emci named no row, so every 📱 row stays open.
