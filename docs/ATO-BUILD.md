# ATO-BUILD — the only document needed to build the ATO upgrade

## CHANGELOG
- **2026-10-26 · PHASE-00 red team** (findings in `docs/ato-build-redteam.md`): R01 wave115→**wave116** (wave115 is taken); R02–R05 phases 01, 02, 04, 05, 06, 07, 11 are mostly shipped on master, so they are **verify-only** (05: only the constellation header remains); R06 Quests ignores the `quest` appearance mode; R07–R12 and R25 PHASE-17 hardening (idempotent Apply, bounded Undo, server-enforced 7/30-day rules, `_trait_write` has no weight parameter, SECURITY DEFINER rules, delete-account wipe); R13–R15 validator and save fixes; R17–R22 animation, a11y, atlas and streak fixes; R23 ⚑ Quests art vs `CLAUDE.md` art rules; R24 no new dev dependency for the atlas builder; R26 merge master before release.
Covers IA + Settings, gamify (Home, Insights, Legends, motion), and Quests (code, content and PixelLab art). The repo copy lives at `docs/ATO-BUILD.md`. Everything is self-contained, and every decision in it is final.

## 0 RUNNER (read every session)
1. `git checkout ato-build` (create it from an up-to-date master if missing; merge master into it at the start of each phase), then `git pull`. If a listed file has moved or been renamed, adapt to the real path and note it in the plan and in the progress log.
2. Open `docs/ato-build-progress.md`. If it doesn't exist, create it with the checklist in §0.1, a `## Log` and a `Blocked on:` line.
3. Pick the **first unchecked phase whose Deps are all checked**. PHASE-00 always runs first, and every other phase implicitly depends on it. If an earlier phase is blocked (for example on an emci action), skip it and log why.
4. **Read only** (PHASE-00 is the one exception: it reads the whole file):
   - this §0 and §1, i.e. from the top of the file to the line before `## PHASE-01`;
   - the progress file;
   - your ONE phase section.
   To find the section, run `rg -n "^## (PHASE-|APPENDIX)" docs/ATO-BUILD.md`. Read from your anchor to the line before the next anchor. Never read other phase sections.
5. Repo reading: open only the files the phase lists, plus `rg` for check scripts that reference strings or paths you change.
   5a. Resolve every check named in the phase against `package.json`; log a missing name and use the nearest existing check (R05). Live checks (e.g. `delete-account`) are excluded from the gate and are run by hand.
6. **Plan mode (Opus):** give the exact edits, files, checks you'll add or repoint, and screenshots. Then STOP for emci's OK.
7. After the OK, build with the phase's model.
8. Done means:
   - tick the phase in the progress file;
   - log the files touched and lessons (10 lines or fewer);
   - open ONE draft PR titled `PHASE-NN <name>`;
   - STOP.
9. Loop guard: if the same check fails 3 times, stop, write the blocker under `Blocked on:` and in the Log, then STOP.
10. Art phases: use the PixelLab MCP tools under the §1.9 quality-first policy. There is no generation or credit limit (R23 resolved: see §1.9; the pre-flight and one-test-clip OK still apply). Save every source PNG with a `params.json` (tool, prompt, seed, strength, critique score). Log the credits used per batch in `art-src/quests/credits.md` (`get_balance` before and after). This is for visibility only and never a reason to stop. Atlas only the assets that pass critique.
11. **emci actions are marked ⚑.** When a phase needs one, finish everything you can, set `Blocked on: ⚑ …`, and STOP.
12. Art and Quests phases (PHASE-12 to -23, -25, APPENDIX-A) start with a **mini red-team**: a self-check of 5 lines or fewer against `docs/ato-build-redteam.md` (relevant findings, fixes to apply in this phase, new risks). Put it in the plan.

### 0.1 Checklist (copy it into the progress file)
```
Stage 0 Red team
- [ ] PHASE-00 Red team of this plan + repo (fixes applied to ATO-BUILD.md)  ⚑ OK
Stage A Foundations
- [ ] PHASE-01 Settings screen
- [ ] PHASE-02 "This is you so far" → You
- [ ] PHASE-03 Motion base + constellation (G1)
- [ ] PHASE-04 Tab bar + layout reset
Stage B Profile & IA
- [ ] PHASE-05 Explore → You part 1
- [ ] PHASE-06 Explore → You part 2 + redirect
- [ ] PHASE-07 Roll = "Your reveals"
Stage C Gamify screens
- [ ] PHASE-08 Home (G2)
- [ ] PHASE-09 Insights (G3)
- [ ] PHASE-10 Legends (G4)
- [ ] PHASE-11 Cleanup
Stage D Quests
- [ ] PHASE-12 Quests content model + validator
- [ ] PHASE-13 Scoring + sims
- [ ] PHASE-14 Run engine + saves
- [ ] PHASE-15 Art 1: style lock + Lantern set (PixelLab)
- [ ] PHASE-16 Quests UI v3
- [ ] PHASE-17 Server, Apply, Undo, flags  ⚑ wave116
- [ ] PHASE-18 Style guide + The Drowned Lantern  ⚑ copy OK
- [ ] PHASE-19 The Masquerade  ⚑ copy OK
- [ ] PHASE-20 Last Train Home  ⚑ copy OK
- [ ] PHASE-21 Art 2: Masquerade + City + shared VFX (PixelLab)  ⚑ art OK
- [ ] PHASE-22 Atlas build + art integration
- [ ] PHASE-23 Quests entry points + tutorial + You
Stage E Polish & release
- [ ] PHASE-24 Per-mode polish (G5)
- [ ] PHASE-25 Quests QA + playtest  ⚑ playtest
- [ ] PHASE-26 Whole-app a11y + states
- [ ] PHASE-27 Regression QA + release  ⚑ wording, flags, OTA
```
After PHASE-00, phases that can run in parallel (open them as separate sessions or branches): PHASE-03, -12, -13, -14 and -15 add new files only and can start early.

## 1 GLOBAL RULES + SHARED SPEC
### 1.1 Rules (every phase)
- One draft PR. Never merge. **No OTA / `eas update`**: emci publishes those himself.
- **ONE release, ONE OTA.** emci wants a single ATO push at the very end, not an update per phase. Every phase builds on one long-lived branch `ato-build` (each phase = commits + its PR targets `ato-build`, never master). Nothing reaches master or production until PHASE-27 passes; then emci merges `ato-build` once and publishes ONE OTA. Never suggest or prepare an interim OTA. Any hotfix need found mid-build is logged in docs/ato-build-progress.md and folded into the final release.
- **No new native deps.** Only JS or font packages are allowed, and only if the phase names them.
- **Don't touch `src/play/**`** (Divecore isolation). You may copy token *values* from it; never import from it in new Quests code.
- Never print, echo or log `EXPO_TOKEN` or any key.
- **No runtime AI** (`check:no-auto-ai` stays green) and **no free-text input**.
- Touch only the listed files, plus any check script you must repoint.
- Check scripts: repoint them, never weaken or delete an assertion. Register new checks in `package.json` as `check:<name>`.
- Must be green: `npm run typecheck`, `npm run lint`, `npm run check:ota-gate`, plus every touched or new check.
- Screenshots go in the PR: 430×932 and 375×667. Gamify screens need all 5 appearance modes. Quests needs one dark set.
- Reduce Motion is **gentle, never still** (§1.4).
- Accessibility baseline for every new control:
  - VoiceOver label, role and hint, with logical order;
  - Dynamic Type up to XXL without clipping;
  - 44pt minimum hit target;
  - meaning never carried by colour alone;
  - empty, loading and error states for any new data;
  - iPad: centred with the repo's `MaxContentWidth` (600).
- Perf:
  - at most 1 frame callback per screen;
  - at most 60 animated nodes per screen;
  - loops run on the UI thread (worklets) and pause when unfocused (`useIsFocused`) or backgrounded;
  - target 60 fps on an iPhone 11-class device.
- Analytics: no new SDK. Existing Sentry breadcrumbs only, plus the Quests `quest_runs` row.
- Build model is given per phase. Opus always plans.

### 1.2 Repo facts (baseline master @ 5b2f3d18, audited 2026-10-26; re-verify after pulling)
- **Already on master (IA pass):** `src/app/settings.tsx`, `src/app/roll.tsx` ("Your reveals"), `explore.tsx` = `<Redirect href="/you?section=categories"/>`, `NAV_LAYOUT_VERSION=3` with default `['home','insights','you','play']`, `src/content/{copy,legal,voice}`. There is no `TraitConstellation` and no `motion-tokens.ts` yet. Appearance id `quest` is an existing mode; Quests UI never branches on it (§1.8 tokens are fixed).
- `ota-gate` auto-discovers every `check:*` script in `package.json` (except its EXCLUDED set); a new check only needs its script entry. `sharp`/`pngjs` are not installed.
- Expo Router, with routes in `src/app`.
  - Tabs: index (Home), insights, intake-sweep (Questions), explore (only a redirect to `/you?section=categories`), you, legends, circle, around (parked). `roll` is a root Stack screen ("Your reveals"), not a tab.
  - Root Stack: play, chat, week, dev-lab, labs.
- Installed: reanimated 4.1, react-native-svg 15.12, gesture-handler 2.28, expo-haptics, expo-image, `@expo-google-fonts/rajdhani`, AsyncStorage.
- **Not installed:** expo-blur, expo-linear-gradient, Skia, Inter, any audio library. Consequences:
  - gradients are drawn with SVG;
  - there is no real blur;
  - body text uses the system font;
  - no sound.
- Traits:
  - 16 `TRAIT_AXES` in `src/lib/traits.ts`, with pole phrases in `src/lib/axis-poles.ts`.
  - Tracks live in `src/lib/trait-stability.ts`: EWMA_ALPHA 0.35, settles at n=3, "mixed" below raw stability 0.25, decay 60-day grace then 90-day half-life, plus `nudgedSecondaryValue(cur, signal, w)`.
  - Source `self_game` maps to the separate `game` track and is excluded from profile completion.
  - All trait writes are server-side via `_trait_write(uid, axis, source, sample, mode)` (wave79). The wave80 lock blocks client writes.
  - The latest migration is wave115 (`drop_ai_provider_layer`), so Quests uses **wave116**.
- Theme: `src/constants/appearance.ts` has 5 modes.
  - Soft is the default: bg `#F8FAFC`, surface `#FFF`, accent `#4F46E5`, accent2 `#EC4899`, accent3 `#10B981`, radius 24, motionMs 250.
  - Per-mode flavour tokens: `glowPulse`, `hpMpBars`, `hudFrames` (used by the Quest, Neon and Anime modes).

### 1.3 Motion tokens: `src/lib/motion-tokens.ts` (created in PHASE-03; everyone else imports it)
| Token | Value |
|---|---|
| EASE_OUT | `Easing.bezier(.22,1,.36,1)` |
| EASE_IN_OUT | `Easing.bezier(.65,0,.35,1)` |
| EASE_BACK (pop) | `Easing.bezier(.34,1.56,.64,1)` |
| UI_IN / UI_OUT | `Easing.out(Easing.cubic)` / `Easing.in(Easing.quad)` |
| SPRING_POP | `{damping:12, stiffness:220}` |
| DUR | micro 80–120 · small 180–250 · beat 400–600 · scene 400. Anything that blocks input is 900 ms or less. |
| ENTER | rise 500 ms EASE_OUT, translateY 16→0, scale .98→1, opacity 0→1, stagger 80 ms |
| PRESS | scale 1→.94→1 with SPRING_POP (~350 ms), plus a Light haptic |
| PLUS_POP | "+N" floats up 34pt and fades over 1000 ms |
| SHEEN | diagonal band sweep, 2600 ms loop, opacity .35 |
| LIVING_BG | 2 soft radial-gradient SVG blobs drifting 9 s / 11 s alternate (translate 40/−30, scale 1.1) |
| BREATH | opacity .85↔1 over 8 s (the Reduce Motion "alive" fallback) |
| PIXEL_SNAP | worklet `Math.round(x/2)*2`: pixel layers move in whole art pixels (1 art px = 2pt) |

**Haptics map** (one map in motion-tokens; respect any existing haptics-off setting):
| Event | Haptic |
|---|---|
| press / select | `selectionAsync` or Light |
| commit | Light |
| success (step done, stat up once per beat, "I tried it") | `notificationAsync(Success)` |
| reveal swap / emblem | Medium |
| stamp / d20 crit | Heavy |
| d20 fail | Warning |

### 1.4 Reduce Motion rule
Use `useReducedMotion()` from Reanimated, and give every animation hook an `rm` branch. In Reduce Motion:
- no translate, scale, rotate, morph, shake, flash or typewriter;
- moves of 2pt or less are allowed;
- transitions become cross-fades of 300 ms or less;
- loops run at half amplitude and quarter speed;
- the hero element keeps BREATH, so nothing is ever fully still;
- information cues (numbers, ticks) stay, and haptics stay.

PHASE-03 fixes `components/motion.tsx`, which currently renders children static.

### 1.5 IA map (target)
- **Tab bar:** Home · Insights · You · Play · More.
  - Play pushes `/play` (a Stack screen, not a tab).
  - More holds Questions, Legends, Circle and Quests (after PHASE-23), plus "Open Divecore" when Play isn't in the bar.
- **Explore is gone.** `/explore` redirects to `/you?section=categories`.
- **You, top to bottom:**
  1. constellation header
  2. "This is you so far"
  3. IdentityCard
  4. Your shape
  5. Your traits
  6. From your quests
  7. Your categories
  8. Full profile
  9. Legends ›, Circle ›
  10. Tokens anchor
  11. Settings ›

  The `section` param accepts `shape | traits | categories | profile | tokens | quests`.
- **`/settings`** is a pushed screen holding every settings control.
- **`/roll`** is "Your reveals", a display-only screen pushed from Legends.
- **`/quest` and `/quest/[id]`** are main-app Stack routes.
- `/week` stays a placeholder with no links. Around: no change.

### 1.6 Economy rules (fixed)
- No new prices, rewards, quotas or token sources.
- Paid reveals happen **only in Legends**. Rerolls stay frozen (`REROLLS_FROZEN`).
- "Today's path" reuses only the existing check-in token award.
- Streak: forgiving "N-day glow", 1 free rest day per week, **no paid repair**, no loss-framed alerts.
- Quests give **no tokens**.
- Never use fake timers, guilt copy, or rankings of people on personality.
- If any change would touch a price, reward or quota: stop and log it.

### 1.7 Naming
- Quests code lives in `src/app/quest/*`, `src/lib/quests/*`, `src/components/quests/*` and `assets/quests/*`.
- Art sources live in `art-src/quests/*`. They are never `require`d, so they stay out of the bundle.
- AsyncStorage keys: `ato.quests.run.v1`, `ato.quests.tutorial.v1`, `ato.insights.seen.v1`. All are cleared in `clearLocalAccountData`.
- Home's daily checklist is called **"Today's path"**. Never call it "quest".
- Mockups are optional references only; the build does not need them:
  - `docs/mockups/gamify/{home,insights,legends}-v2.png`
  - `docs/mockups/quests/{1-select,2-scene,3-beat,4-ending,5-said,overview}-v3.png`

### 1.8 Quests v3 UI tokens: `src/lib/quests/theme.ts` (dark in every mode)
| Token | Value |
|---|---|
| bg | `#070B16` |
| glass | fill `rgba(16,22,40,.62)`, 1px border `rgba(255,255,255,.09)`, inner top highlight `rgba(255,255,255,.06)`. No blur library. |
| text / sub | `#F2F6FC` / `#9AA8BF` |
| accents | cyan `#22D3EE`, sky `#67E8F9`, violet `#6366F1`, amber `#F9C22B` / `#FDE68A`, rose `#FF5C7A` |
| primary gradient | 135°: `#5EEAD4` → `#22D3EE` at 45% → `#6366F1` |
| radii | card 20 · choice 18 · stat 16 · icon tile 12–16 · pill 999 |
| shadows | card `0 10 30 rgba(0,0,0,.35)` · primary glow `0 8 24 rgba(34,211,238,.28)` · commit glow `0 0 28 rgba(249,194,43,.35)` plus a 1.5px amber ring (a second absolute View) |
| spacing | page gutter 16 · card gap 12 · choice gap 10 · card padding 14–18 |
| type | Display 36–40/44 Rajdhani 700 · H1 30/34 · H2 19–21/24 (Rajdhani 700) · Body 17/26 system 400 (narration) · UI 16/20 system 600 · Small 13/18 system 500 · Label 11 system 600 uppercase +1.4 · numbers Rajdhani 700 |
| bars | 6pt tall, radius 99, track `rgba(255,255,255,.08)`. Fills: supplies amber, morale rose, renown cyan→violet |

### 1.9 Pixel art standard (art phases + PHASE-22)
> **R23, RESOLVED by emci 2026-10-26:** for Quests art only, this section wins over `CLAUDE.md` (64px stage heroes, own `assets/quests` atlas, no generation cap). Kept from `CLAUDE.md`: read `docs/art/PIXELLAB_GUIDE.md` + `PIXELLAB_ANIMATION.md` and `search_help` the tools first, `get_balance` before and after, ONE test clip for emci's OK before any batch, credits logged. Quests assets are exempt from `art:registry` only if `check:art-registry` stays green; otherwise add a `quests` category. Tool names below are indicative; use the MCP's real names (`create_image_pixflux`, `animate_character`, …).
- **Scale:** 1 art px = 2pt, nearest-neighbour, pre-scaled ×2 at atlas build.
- **Camera:** side-view stage with a ground line. Hero stage poses have a **64px figure height**. Real-world scale: door ≈1.3H, lantern 0.15H, train car ≈1.6H.
- **Palette:** Resurrect 64 plus brand `#22D3EE #0B8A8F #0B5E65 #F9C22B #F79617 #05070D`. Campaign moods stay inside that palette:
  - Lantern: deep blue with cyan glow.
  - Masquerade: wine `#7A3045`, amber, candle gold.
  - City: purple dusk, amber windows, cyan neon.
- **No "bad" pole art.** Consequence art is neutral or warm. The hero sits at least 2 value steps above the background behind it.
- **PixelLab style card** (identical on every call):
  - `outline:"single color black outline"`, `shading:"medium shading"`, `detail:"medium detail"` (`"low detail"` for 24px or smaller);
  - `text_guidance_scale:8`;
  - `negative_description:"blurry, anti-aliased, gradient, text, watermark, perspective distortion, photo"`;
  - `color_image`: a 1px swatch strip of the palette (`art-src/quests/palette.png`), with `force_colors:true` where offered.
- **Style references** (10 or fewer, native resolution, unzoomed): 2 crops from `assets/play/pixel/room-atlas.png`, 2 dive-atlas crops, 3 `assets/play/avatars/dungeon-legends/*/rotations/south.png`, plus the first 3 approved Quests plates.
- **Seeds:** Lantern 4101 · Masquerade 4201 · City 4301 · NPC 4401+n · icons 4501 · VFX 4501–4506 · emblems 4601 · hero anims 4701+ · ambient 4801+ / 4811+ / 4821+.
- **Per-asset pipeline:**
  1. greybox init;
  2. 4–8 explores at strength 300–450;
  3. pick the winner by 1x/squint test;
  4. refine at 500–700 with the winner's seed;
  5. fix by inpaint, not regenerate;
  6. reduce colours to the palette and correct pixel art;
  7. hand cleanup of 20% or less (shared clean head across frames, foot contact fixed).
- **Quality-first art policy:**
  - Generate as many PixelLab explores, refines, inpaints, variants and frames as it takes to pass critique and look great. No limits.
  - Claude Code may go beyond the asset list when it improves the result: extra animation frames (smoother cycles, anticipation and follow-through), extra variants (poses, expressions, lighting states), extra VFX and ambient loops, or polish assets (rim-light passes, occluders, ending-card details). Note each extra in `params.json` with a one-line reason.
  - Log only: the credits per batch go to `art-src/quests/credits.md`.
- **Critique rubric (each criterion 0–4, total 28; pass is ≥22 with no criterion below 2).** Write the score in `params.json`.
  1. Silhouette reads at 1x and in thumbnail.
  2. Value contrast: focal point clear, hero ≥2 steps above the background.
  3. Palette lock: only swatch colours, no near-duplicates.
  4. Clean pixels: no jaggies, orphans, banding or AA blur.
  5. Light and shading consistent (key light from top-left, unless the scene's own light source says otherwise).
  6. Scale and camera: side view, ground line, 64px hero scale.
  7. Style match to the references. For animations: no boiling, stable volume, foot contact.

  A fail gets up to 2 fix rounds. If it still fails, log it, keep a placeholder, and move on.
- **Atlas size budget (engineering constraint, `check:quest-atlas`).** If quality needs more, first split into more atlases or compress (pngquant-style palette PNG, trimming, sharing frames). If it still doesn't fit, raise the limit in the check with a `// raised: <reason>` note and log it in the progress file. Defaults:
  - 1 atlas per campaign plus 1 shared, each 2048² or smaller;
  - 12 or fewer new files in total under `assets/quests/` (PNG + JSON);
  - 4 MB or less in total;
  - no loose PNGs.

## PHASE-00 RED TEAM
Deps: — · Model: Opus plans + Opus runs · No app code changes. The only output is docs plus edits to this file. A docs-only draft PR is opened only if emci asks.
**Exception:** this phase reads the WHOLE of `docs/ATO-BUILD.md` plus the current repo (pull master first): routes, nav, trait-stability, wave79/80 SQL, ato-tokens/rerolls, appearance, motion.tsx, the check scripts and package.json.
Red-team every phase for:
- **Animation:**
  - Reduce Motion gaps (anything still or anything over 2pt);
  - jank and frame pacing; Reanimated worklet pitfalls (runOnJS spam, closures over JS state, shared values read on JS, useAnimatedProps on many SVG nodes);
  - layering and z-order; gesture conflicts (hold vs double-tap vs scroll vs VoiceOver);
  - low-end device performance; the typewriter at 30 Hz;
  - sprite atlas bleeding (padding/extrude), sub-pixel offsets, filtering blur.
- **Graphics:**
  - contrast in all 5 modes, dark and light;
  - Dynamic Type overflow; small screens; notch and safe areas, home indicator;
  - pixel scaling (integer ×2, expo-image filtering); SVG perf and gradient banding; glass legibility over bright plates.
- **Functions:**
  - navigation and deep links (/explore redirect, /you sections, push payloads); back stack from /settings, /roll and /quest;
  - state and persistence; account switch; offline; migrations; flags and old app versions;
  - economy exploits: token double-spend via a double-tap or a retry, reveal races, streak timezone and DST bugs, the rest-day rule.
- **Quests game:**
  - branch dead ends, unreachable endings, ending `when` overlap, trait coverage on every path;
  - Rewind and d20 exploits (kill-restart, clock change, rewinding a check);
  - save corruption across content versions; the 30-day rule across reinstalls;
  - scoring edge cases (W=0, n ties, all neutral, C exactly .67, contradiction at the edge); misclick and chaotic play;
  - Apply/Undo races (double Apply, Undo during the offline queue, Undo after a newer write); RLS and security definer (search_path, auth.uid() checks, input validation, idempotency keys).
- **Plan:**
  - phase ordering and dependency mistakes; files missing from "Files" lists;
  - missing or untestable acceptance checks; checks that can't run in CI.
Output `docs/ato-build-redteam.md`:
- a findings table: ID · severity High/Med/Low · area · affected PHASE · evidence (file:line or spec line) · concrete fix;
- then "Applied to ATO-BUILD.md" with the list of edits.
**Apply the fixes in place** in `docs/ATO-BUILD.md`:
- add acceptance checks and steps;
- add new phases if needed (anchors `## PHASE-NNa` must stay unique; update the §0.1 checklist and Deps);
- never weaken a rule in §1;
- add a `## CHANGELOG` block right under the title (date, finding IDs, what changed).
Verify that every anchor is unique (`rg -n "^## (PHASE-|APPENDIX)"`).
Accept: the redteam doc exists, the High findings are all fixed or marked ⚑ for an emci decision, the changelog is present and the anchors are unique.
⚑ STOP for emci's OK on the findings and edits before PHASE-01.

## PHASE-01 Settings screen
**STATUS (R02, audit 2026-10-26): VERIFY-ONLY.** `settings.tsx` already has every section, and You and Home are already decluttered. Do: confirm each step below against the code, run the named checks (resolve names against `package.json` first, R05), confirm the 5-tap shortcut in RunningUpdateLine (it opens `/dev-lab`, hub-gated; there is no `/ai-lab` route), fix gaps only. Don't rebuild.
Deps: 00 · Model: Sonnet
Goal: a new pushed `/settings` screen holding every settings control, so You and Home are decluttered.
Files:
- `src/app/settings.tsx` (new)
- `src/app/(tabs)/you.tsx`
- `src/app/(tabs)/index.tsx`
- `src/app/_layout.tsx` (`<Stack.Screen name="settings"/>`)
- `src/components/settings-fold.tsx` (read only)
- `src/lib/polish-copy.ts` (`SETTINGS_TITLE`)
Steps:
1. Build settings.tsx from SettingsFold rows. The ScrollView keeps `automaticallyAdjustKeyboardInsets` and `keyboardShouldPersistTaps="handled"`. Sections:
   - **Appearance:** AppearancePicker.
   - **Profile details:** CityPicker + saveCity, BirthdayRow.
   - **Notifications:** NotificationPrefsFold.
   - **Privacy & AI:** AI_USE_DISCLOSURE (always shown) + AiConsentCard / On-Off, moved verbatim from You.
   - **Help & Legal:** HelplineRow, Send feedback (mailto including updateId), LegalLinks.
   - **Account:** Sign out (with clearLocalAccountData), Delete account + DeleteAccountSheet (hasAppleIdentity).
   - **About:** RunningUpdateLine (keep the 5-tap shortcut to /dev-lab).
   - **Developer:** DevUnlockRow under DEV_PIN_AVAILABLE, plus Home's Dev Tools Hub / Pixel lab rows under the same hubAccess/__DEV__ gates.
2. you.tsx: remove those controls and the SETTINGS heading, and add a "Settings ›" row.
3. index.tsx: remove devBox and add a header gear Pressable (44pt, label "Settings") clear of NavPixel (NAV_PIXEL_HEADER_INSET). Keep the AI disclosure and the first-time consent ask on Home.
Accept:
- Every moved control works.
- Delete account and AI off are each 2 taps or fewer from Home or You.
- Rows are Dynamic-Type safe.
- These checks are green: you-restored, prod-you, helpline-row, appearance, delete-account, dev-unlock, running-update, local-account-data, auth-password, polish.

## PHASE-02 "This is you so far" → You
**STATUS (R02): VERIFY-ONLY.** Already on You (`you.tsx:154`) and removed from questions-fold. Confirm empty/failure render nothing and run the named checks. **DONE 2026-10-27: audited, no gaps, no code change.**
Deps: 01 · Model: Sonnet
Files: `src/app/(tabs)/you.tsx`, `src/components/questions-fold.tsx`, `src/app/(tabs)/index.tsx` (read the fetch and its guards). Don't edit `profile-character.tsx`.
Steps:
1. you.tsx:
   - call `fetchHomeBootstrap(me.timezone||'UTC')` in useFocusEffect, with Home's guards (requestIdRef, loadedOnceRef, tracksUserId===userId);
   - render `<ProfileCharacter tracks={tracks}/>` under the title, above IdentityCard, when `tracks.length>0`;
   - render nothing on empty or failure.
2. questions-fold.tsx: remove the ProfileCharacter render (~L259) and its import.
Accept: the card shows on You both before and after the profile is done, and is gone from Questions. Checks green: questions, paged-questions, full-profile-signal, no-auto-ai.

## PHASE-03 Motion base + constellation (G1)
Deps: — · Model: Sonnet
Files:
- New:
  - `src/lib/motion-tokens.ts` (§1.3, including the haptics map)
  - `src/components/{press-pop,plus-pop,sheen,living-bg,trait-constellation,gradient-fill}.tsx`
  - `scripts/motion-check.ts`
- Edit:
  - `src/components/motion.tsx`
  - `src/components/trait-shape.tsx` (read only)
  - `src/lib/trait-shape.ts` (read only: shapeGeometry)
  - the theme-lab preview screen (find it with `rg "theme-lab"`)
  - `package.json`
Steps:
1. **motion.tsx:** in Reduce Motion, apply a BREATH opacity loop instead of rendering static.
2. **press-pop:** PRESS + haptic, wrapping a Pressable, with an a11y passthrough.
3. **plus-pop:** PLUS_POP. In Reduce Motion it fades in and out in place.
4. **sheen:** an SVG LinearGradient band sweep. In Reduce Motion it is off and the host breathes.
5. **living-bg:** LIVING_BG. In Reduce Motion the blobs are static and breathe.
6. **gradient-fill:** an absolutely filled `<Svg>` with a Linear/Radial gradient prop, for buttons, bars and tiles.
7. **trait-constellation** (`tracks`, `size`, `variant: 'hero'|'header'|'mini'|'badge'`):
   - one star per axis that has a track, placed by shapeGeometry;
   - star size/brightness = lean clarity (stability); stability > 0.8 turns gold `#F9C22B`;
   - lines join the shape;
   - motion:
     - line draw: strokeDashoffset 900→0, 1400 ms EASE_IN_OUT, delay 300;
     - twinkle: opacity .7↔1, 4 s loop, random phase;
     - halos: scale 1↔1.35, opacity .2↔.05, 4 s, 500 ms offset per star;
     - "brightened": scale 1→1.8→1.25 plus gold fill, 900 ms SPRING_POP, delay 1600, Light haptic. Triggered by `changedAxes`;
     - weekly morph: ghost points → current points, 1200 ms;
   - Reduce Motion: fade in 300 ms, then the whole thing breathes over 8 s. No twinkle or morph; gold changes as a 300 ms colour fade;
   - a11y label: "Your constellation: N traits, strongest X";
   - empty state: a "Answer a few questions to light your first stars" card linking to /intake-sweep;
   - perf: 60 or fewer animated nodes; pause when unfocused or backgrounded.
8. Add a theme-lab preview of every primitive, normal and Reduce Motion.
9. `check:motion`: motion-tokens exports exist, and every new component references `useReducedMotion`. **(R18)** It also fails any file under `src/components` or `src/app` that uses `withRepeat`/`withSequence` without `useReducedMotion`.
Accept: all primitives work in Reduce Motion with visible breathing. Typecheck, lint, ota-gate and motion checks are green.

## PHASE-04 Tab bar + one-time layout reset
**STATUS (R02, R04): VERIFY-ONLY.** Pool `play`, version 3 and the default slots exist. Do: read the More sheet's actual item list against step 5, remove stale Explore comments in `nav-order.ts` (:9, :172, :176, :240), run nav-check and tab-rename-check (both exist).
Deps: 02 · Model: Sonnet
Files: `src/lib/nav/nav-order.ts`, `src/lib/nav/nav-context.tsx` (only if it reads or writes the version), `src/components/app-tabs.tsx`, `src/components/nav-more-sheet.tsx`.
Steps:
1. Pool id `play` (label Play, href /play, icon play-circle).
2. DEFAULT slots: `['home','insights','you','play']`.
3. `NAV_LAYOUT_VERSION=3` is stored inside the layout JSON. A missing or older version resets to the default once; later edits are kept. No DB schema change.
4. The Play slot calls `router.push('/play')`.
5. More shows Questions, Legends and Circle, plus "Open Divecore" only when Play isn't in the bar. (Explore was removed from the pool in the IA pass; `/explore` redirects. Verified in PHASE-04.)
Accept:
- A fresh account gets the new bar.
- An old custom layout resets once, and a re-edited layout persists.
- nav-check and tab-rename-check are green.

## PHASE-05 Explore → You part 1
**STATUS (R02, R03): DONE 2026-10-27.** Shape, traits and the `section` param were already on You; the constellation header (with its empty state, `Appear breathe`, a skeleton while loading) was added to `you.tsx` and pinned in `check:motion`. ShapeCard taps to /intake-sweep (verified). There is no `check:you` script; `you-restored`, `prod-you` and `profile-history` cover You.
Deps: 03, 04 · Model: Sonnet
Files: `src/app/(tabs)/you.tsx`, `src/app/(tabs)/explore.tsx`.
Steps:
1. Top of You: `<TraitConstellation variant="header">`, reusing PHASE-02's tracks, with its empty state.
2. After IdentityCard:
   - "Your shape": ShapeCard, tap → /intake-sweep;
   - "Your traits": TraitBandsFold, ProfileFillFold, ChangeCard, with the same props as in Explore.
3. Add the `section` param (useLocalSearchParams), scrolling to `shape | traits`.
4. explore.tsx: remove only those components.
Accept: the content shows on You. Checks green: explore, explore-refetch, trait-bands, trait-shape, you. VoiceOver labels are on the constellation.

## PHASE-06 Explore → You part 2 + redirect
**STATUS (R02, R22): DONE 2026-10-27 (verify-only).** Gaps fixed: pure `parseSection` in `src/lib/you-sections.ts` plus a deep-link fixture in `check:explore` (there is no `check:you`); stale "Explore" copy in `category-teaser.tsx` and `push.ts`. PHASE-23 adds `quests` to `SECTION_KEYS`. Original note: Categories, Full profile, Legends/Circle rows, Tokens anchor and the redirect exist. The one allowed `/explore'` hit is the hidden-route entry at `app-tabs.tsx:53`. Do: check empty states per section, add a deep-link fixture (unknown or flagged-off `section` is ignored, no error), run the named checks.
Deps: 05 · Model: Sonnet
Files:
- `you.tsx`, `explore.tsx`, `nav-order.ts`, `app-tabs.tsx`, `nav-more-sheet.tsx`
- `src/lib/push-copy.ts`, `src/components/category-teaser.tsx`, `src/lib/dev-fab-model.ts`
- `src/lib/explore/route.ts`, `src/lib/home-teaser.ts`, `src/lib/preview-mode.ts` (only if they build /explore links)
Steps:
1. you.tsx:
   - "Your categories": CategoriesFold + CategoryDeepDiveCard, with the same gates. Category reroll stays frozen.
   - "Full profile": FullProfileFold.
   - Rows "Legends ›" and "Circle ›" (Circle only when `isTabUnlocked('circle')`).
   - A Tokens anchor.
   - `section` also accepts `categories | profile | tokens`.
2. explore.tsx becomes `<Redirect href="/you?section=categories"/>`. Keep the file.
3. Remove `explore` from NAV_TABS, the pool, More and Edit nav. The normaliser drops a saved `explore` and fills from the default.
4. Repoint every `/explore` link. Afterwards, `rg "/explore'"` should only find the redirect.
Accept: a push deep link lands on You › categories. Checks green: explore, nav, push, tab-rename, category-*. Empty states are in place for each new section.

## PHASE-07 Roll = "Your reveals"
**STATUS (R02): VERIFY-ONLY (Sonnet is enough). DONE 2026-10-27:** screen, Stack.Screen, Legends row and the 'roll' removal from HIDDEN_TAB_ROUTES were already on master; PHASE-07 fixed 44pt targets, hall-row wrap, header roles, loading skeleton and a load-error + retry state (a failed load no longer reads as "No legends met yet"). Do: confirm there is no spend call and no RebuiltNotice, test 0 legends and several, run the named checks.
Deps: 04 · Model: Opus
Files:
- `src/app/(tabs)/roll.tsx` → move to `src/app/roll.tsx`
- `src/app/_layout.tsx`
- `src/components/app-tabs.tsx` (drop 'roll' from HIDDEN_TAB_ROUTES)
- `src/app/(tabs)/legends.tsx`
- `src/lib/ato-tokens.ts` and `src/lib/rerolls.ts` (read only)
- optional `src/components/reveals-list.tsx`
Steps:
1. In plan mode, read Legends' reveal logic (free daily reveal, bonus on a settled trait side, `claim_legend_figure_story`) and list the data to reuse.
2. Build `/roll`, titled "Your reveals":
   - every legend met (opened free, from saved stories);
   - today's state: free used? bonus available? next paid price (display only, from the same source Legends uses);
   - a "Reveal in Legends ›" link per hall;
   - **no spend call**.
3. Add `<Stack.Screen name="roll"/>` and a Legends row "Your reveals ›" → `router.push('/roll')`.
4. If anything would change a price, reward or quota: stop and log it (§1.6).
Accept:
- Works with 0 legends met (empty state) and with several.
- No RebuiltNotice.
- Checks green: legends, rebuilt, nav, ato-tokens, reroll.

## PHASE-08 Home (G2)
Deps: 03, 04 · Model: Sonnet (Opus if rest-day needs streak storage changes)
**Status (2026-10-27): built.** No streak storage change was needed (rest day is derived on the phone). `check:home` / `check:check-in` do not exist; the gate is `check:home-path` (new) plus home-hydrate, polish, ai-tokens. Step 2's "+10 ✦" is the server-paid check-in amount (`+N ✦`; +10 only on the 7th day).
Files:
- `src/app/(tabs)/index.tsx`, `src/components/week-strip.tsx`, `src/components/daily-checkin-card.tsx`
- new `src/components/{todays-path,streak-chip}.tsx`
- read only: `src/lib/check-window*`, today-insight, identity-title-chip
Steps:
1. **Hero:** `TraitConstellation variant="hero"` with the identity title. One key word gets a gold shimmer (SHEEN 3 s loop). Show "★ X brightened" when an axis moved since the last visit; store the last-seen values locally.
2. **"Today's path":** 3 steps (check in · read today's insight · answer N questions), using the existing token award only.
   - checkbox pop 0→1, 350 ms SPRING_POP;
   - bar fill 1000 ms EASE_OUT;
   - "+10 ✦" PLUS_POP;
   - Light haptic per step, Success on the last;
   - Reduce Motion: the bar fades and +N fades in place.
3. **Week strip:** cells rise with a 60 ms stagger (500 ms). Today, before check-in, gets a soft pink glow ring 0→4px over a 2400 ms loop. One free rest day per week is shown as a moon icon and doesn't break the glow.
4. **Streak chip:** "N-day glow". No paid repair, no loss copy.
5. Reduce Motion: the hero BREATH only. **(R19)** The week-strip glow ring becomes a fixed ring with an opacity breathe (no 0→4px growth).
6. Empty state: no tracks → the constellation's empty card.
7. **(R21)** Streak and rest-day logic uses the same local-date key as `check-window*` (`me.timezone`). Fixtures: a DST day, a timezone change, the week boundary, the free rest day.
Accept: matches home-v2 if the mockup is available. Screenshots in 5 modes. A Reduce Motion recording. home and check-in checks green.

## PHASE-09 Insights (G3)
Deps: 03, 04 · Model: Sonnet
**Status (2026-10-27): built.** Card files live in `components/insights/` and `components/daily-insights/`; the token chip already existed; the collection uses `ato.insights.collection.v1` (Home owns `ato.insights.seen.v1`); `check:insights` and `check:local-account-data` exist, plus the new `check:insights-g3`.
Files:
- `src/app/(tabs)/insights.tsx`
- `src/components/{today-focus-card,superpower-card,conflict-style-card}.tsx`
- new `src/components/{flip-card,spectrum-slider,insight-collection,token-chip}.tsx`
- read only: daily-insights, use-try-today, trait-tracks-store, axis-poles, `ato-tokens` (`atoTokenBalanceOf`)
Steps:
1. **Header token chip** (read only) → `/you?section=tokens`.
2. **Today card:**
   - typewriter on the first line (28 steps over 1400 ms, delay 400), with a 3 s glow loop on key words;
   - SHEEN 2600 ms;
   - flip: rotateY 0→90, swap faces, →0, perspective 900, 700 ms EASE_IN_OUT, Light haptic at the swap. The back is "Try this today";
   - "I tried it": PRESS + check pop + Success;
   - Reduce Motion: full text fade, faces cross-fade 250 ms, card breathes.
3. **Spectrum sliders** for the top 3 axes:
   - pole labels on both ends (neither end is "good" or "bad") and a confidence band;
   - fill 0→value with a SPRING knob overshoot, 1000 ms, stagger 150.
4. **Superpower / Conflict tiles:** gradient tiles (gradient-fill) that rise in, with an icon pop at 350 ms, stagger 120.
5. **Insight collection %:** seen/total, using a local seen-set `ato.insights.seen.v1` (add it to clearLocalAccountData). Bar 1000 ms, Light haptic on +1.
6. Leave a marked slot `{/* QUESTS_CARD_SLOT */}` for PHASE-23.
7. States: offline or empty data shows a calm empty card.
Accept: screenshots in 5 modes, a Reduce Motion recording, VoiceOver labels (slider value spoken as words). insights and local-account-data checks green.

## PHASE-10 Legends (G4)
Deps: 03, 07 · Model: Sonnet
Files: `src/app/(tabs)/legends.tsx`, `src/components/{legend-figure-card,reveal-card,progress-ring}.tsx`, the token-chip from PHASE-09, and new `src/components/{holo-card,hall-rings}.tsx`.
Steps:
1. Header token chip. Keep the "Your reveals ›" row.
2. **Hall rings:** met/total per hall plus overall %. strokeDasharray over 1200 ms, stagger 120.
3. **Binder grid:** cards rise with an 80 ms stagger. Locked cards show "?" with a grey shimmer (2200 ms linear); in Reduce Motion, BREATH instead.
4. **Holo reveal** (the free daily reveal):
   - rotateY 0→90, swap to the art, →0, scale →1.04, 1000 ms, Medium haptic;
   - auto-sheen only (no gesture tilt);
   - "MET ✦" stamp: scale 2.2→1, rotate −14°→−8°, 450 ms SPRING_POP, delay 1000, Heavy haptic;
   - Reduce Motion: 300 ms cross-fade, stamp fades in over 200 ms.
5. **Match %:** a mini constellation overlay ("why this legend fits") using the legend axis leans in `lib/ai-library`.
6. Token and reveal logic untouched (§1.6). **(R07)** A second tap while a reveal is in flight or animating is ignored (disabled control + in-flight ref); add a check or fixture for it.
Accept: works with 0 met and with all met. 5 modes. Checks green: legends, ato-tokens, reroll.

## PHASE-11 Cleanup
**STATUS (R02): step 2 DONE** (files are in `src/content/{copy,legal,voice}`, no importer points to the old paths). Step 1: no `/week` links in `src`; the only hit is the assertion at `scripts/push-check.ts:146`, which stays. Re-verify after the Stage C phases and tick.
Deps: 06, 09, 10 · Model: Sonnet
Files: any file linking `/week`, plus `src/app/copy/library.md`, `src/app/legal/*.md`, `src/app/voice/voice-reference.txt` and their importers or scripts (find them with `rg`).
Steps:
1. Remove links to `/week` (the route stays).
2. Move the md/txt files to `src/content/` and update every importer and script path.
Accept: `rg "'/week'"` is clean, and all touched checks are green.

## PHASE-12 Quests content model + validator
Deps: — · Model: Sonnet
Files: `src/lib/quests/{types,validate,strings}.ts`, `src/lib/quests/content/{index,sample-lantern}.ts`, `scripts/quests-check.ts`, `package.json` (`check:quests`).
Schema (types.ts; StoryLine is `{kind:'narrator'|'dialogue'|'inner', speaker?, text, keywords?}`, reusing story-v3's StoryLine if it fits):
```ts
type AxisTag = { axis: TraitAxis; pole: 1|-1; w: 1|0.4 };
type Stat = 'supplies'|'morale'|'renown'; type StatDelta = Partial<Record<Stat,-2|-1|1|2>>;
type Approach = 'explore'|'steady'|'talk'|'act'|'wait';           // UI icon, never the trait
interface QuestChoice { id; label /*≤60 chars*/; approach: Approach; hint?: string /*"costs supplies"*/;
  result: StoryLine[]; tags: AxisTag[] /*0–2*/; stats?: StatDelta; setFlags?: string[]; next?: string;
  check?: { stat: Stat; dc: number /*d20+stat ≥ dc*/; success: string /*scene id*/; fail: string } }
interface QuestScene { id; chapter: 1|2|3|4; primaryAxis?: TraitAxis; requires?: {flags?:string[]; notFlags?:string[]};
  variants?: {requires; lines}[]; lines: StoryLine[]; choices: QuestChoice[] /*2–4*/; next: string|null;
  art: { location: string; props?: {id:string;x:number}[]; tint?: string; cast?: string[] };
  retired?: true; redirect?: string }
interface QuestEnding { id; title; when: { flags?: string[]; notFlags?: string[]; minStat?: Partial<Record<Stat,number>> }; lines: StoryLine[]; art: string }
interface QuestCampaign { id; title; setting:'fantasy'|'city'; minutes; contentVersion: number; sceneIdsFrozen: string[];
  targetAxes: TraitAxis[] /*3–4*/; startStats: Record<Stat,number> /*0–6*/; firstScene: string;
  scenes: QuestScene[]; endings: QuestEnding[] /*3–4; first matching wins; last = fallback*/; isSample?: true }
```
- `QuestState`: `{stats, flags, sceneId, chapter}`.
- Allowed axes: openness, conscientiousness, extraversion, agreeableness, conflict_assertiveness, conflict_cooperativeness, autonomy, playfulness, self_efficacy, locus_of_control.
- **Excluded:** attachment_*, steadiness, competence, relatedness, growth_mindset.

Validator (`check:quests`), with clear error messages:
- every reference resolves, including `check` targets;
- path enumeration: every path reaches an ending, and each path has 12 scenes or fewer;
- every target axis has 3 or more primary scenes on **every** path, across at least 2 chapters (waived when `isSample`);
- every primary scene offers both poles of its axis;
- no excluded axes;
- a beat is 45 words or fewer; a label is 60 chars or fewer;
- copy passes `banned.ts` and the framework fence (no Big Five or psych jargon, no "test", "diagnosis" or "score");
- frozen ids exist; retired scenes have a valid redirect;
- an art location key exists in `src/lib/quests/art-keys.ts` (stub file now; PHASE-22 fills it);
- **(R13)** path enumeration walks both the `success` and `fail` targets of every `check`; every axis id exists in `TRAIT_AXES`; fixture: a fail-only dead end;
- **(R14)** locate `banned.ts` and the framework fence first; if missing, create `src/lib/quests/banned.ts`. It fences only psych jargon and "test / diagnosis / score" words in Quests copy; the core content policy (`docs/copy-review-rules.md`) is unchanged.

Rules: all copy lives in content/strings files, and sentences are never concatenated.

Sample: encode the 5 Lantern scenes from PHASE-18's sample (`isSample:true`).

Accept: the sample is green, and a broken fixture under `scripts/fixtures/` fails with clear messages.

## PHASE-13 Scoring + sims
Deps: 12 · Model: Opus
Files: `src/lib/quests/score.ts`, `scripts/quest-score-check.ts`, `package.json`. Read `supabase/migrations/wave79_trait_checkpoint.sql` (`_trait_write`) and `src/lib/trait-stability.ts`.
Formulas (pure functions, no I/O). Skip undone picks and for-fun runs. For each axis a:
- `P=Σw·pole`, `W=Σw`, and `n` = the number of distinct **primary** scenes for a.
- **Lean** `L=P/W` (−1…1).
- **Consistency** `C` = the share of primary picks that agree with sign(L).
- **Eligible** only if n≥3, C≥0.67 and |L|≥0.33. Otherwise it is "not enough to say".
- **Sample** `s=0.5+0.3L` (range 0.2…0.8).
- **Weight** `g=0.25·C·min(1,n/4)·(1−0.6·stab_report)`.
- **Preview** `new = nudgedSecondaryValue(game_value, s, g)` on the game track. It never touches report stability or answerCount.
- **Limits:**
  - 3 axes or fewer per run, chosen by the highest C·|L|;
  - one write per axis per run;
  - an axis can be applied at most once per 7 days;
  - |Δ| ≤ 0.08 per write;
  - only the first completed "as me" run per campaign per 30 days counts as evidence.
- **Contradiction guard:** if report stability ≥0.4 and the game lean is opposite by more than 0.3, that axis gets nothing. Message: "Your story self went the other way. Fun, but we'll trust your answers."
- **Decay:** the existing rule.
- **Worked example** (use it as a fixture):
  - primaries +1, +1, −1, +1 plus a secondary +1 at w0.4;
  - P=2.4, W=4.4 → L=.545, C=.75, n=4, so eligible;
  - s=.664, g=.131 (with stab .5);
  - game .60 → .609.
Steps:
1. Fixtures: misclick, flip-flop, chaotic, for-fun, undone, contradiction, the limits (3 axes / 0.08 / 7 days / 30 days), decay, the worked example.
2. Sim harness: 1,000 random runs per registered campaign. The apply-rate must be under 5%, and a consistent run must apply at least 1 axis. It is skipped for `isSample`.
3. Write notes on how `_trait_write` merges the game track into the progress Log. **(R10)** `_trait_write(uuid,text,text,double precision,text)` takes no weight, so read its `p_mode='game'` branch (wave79 ~L202–L330) and record exactly where `g` and the |Δ|≤0.08 cap can be applied. If the server can't honour `g`, STOP and ask emci.
Accept: `check:quest-score` is green.

## PHASE-14 Run engine + saves
Deps: 12 · Model: Opus
Files: `src/lib/quests/{run,run-store,d20,migrate-save}.ts`, `src/lib/local-account-data.ts`, `scripts/quest-run-check.ts`, `package.json`.
Steps:
1. **Reducer** states: select → scene → commit → beat → … → ending → said.
   - Picks are logged locally as `{sceneId, choiceId, undone}`.
   - Party stats are clamped to 0–6.
   - Flags drive variants and next scenes.
   - At the end, the endings tracker records the ending id per campaign ("N of M endings found").
2. **Rewind:** 1 per chapter. It restores stats, flags and the d20 result, and marks the original pick `undone`.
3. **Modes:**
   - "Play as me" or "Play for fun" (fun records no evidence).
   - "I was messing around" at the end discards the run.
   - The 30-day evidence rule per campaign; later runs are labelled "for fun".
4. **d20:** seeded PRNG (mulberry32 of a hash of runId+sceneId+choiceId).
   - Success when roll + stat ≥ dc.
   - Odds are shown before commit: `p = clamp((21 − (dc − stat))/20, 0.05, 0.95)`.
   - Rewind and a restart never re-roll.
   - It uses party stats only.
5. **Saves:** AsyncStorage `ato.quests.run.v1` = `{campaignId, contentVersion, runId, sceneId, history, stats, flags, rewinds, mode, typedDone}`.
   - Write after every commit.
   - Resume after a kill skips straight to the full text.
6. **migrateSave** follows redirects. An unknown id restarts the chapter, keeps the endings tracker and sets a kind-notice flag.
7. Add the keys to clearLocalAccountData and repoint any check that lists the keys (R25).
8. **(R15)** `migrateSave` parses inside try/catch, validates shape and size, and falls back to a chapter restart. **(R09)** The 30-day and 7-day rules here are only a mirror for UX; the server enforces them (PHASE-17), so a clock change or reinstall can't create evidence.
Accept: tests cover kill/resume, Rewind restore, no d20 re-roll on restart, migration, account-switch clear, the 30-day rule, and a corrupt-save fixture.

## PHASE-15 Art 1: style lock + Lantern set (PixelLab)
Deps: 12 · Model: Sonnet + PixelLab MCP · Art policy: §1.9 quality-first (no limits; log credits).
Files: `art-src/quests/**` only (sources, `params.json`, `critique.md`, `palette.png`, `refs/`). No app code.
Steps:
1. **Style lock:**
   - build `palette.png` (§1.9 swatch) and the refs/ crops;
   - write `art-src/quests/STYLE.md` with the style card, the seeds and this rubric;
   - generate 1 test plate, critique it, and freeze the style card.
2. **Hero stage poses (64px figure):** for the 3 most common ProfileCharacter heroes (find them in `HERO_ART` mapping, default `dungeon-druid`, `dragonblood-champion`, `dungeon-witch`):
   - downscale with `edit-image` from the repo south rotation;
   - create an east view with `generate-8-rotations-v3`, first_frame = the cleaned south (west is mirrored);
   - animations (64×64 canvas, keep_first_frame):
     - H1 idle: `animate-character` template "idle", 4f at 300/300/400/300 ms, seed 4701+i;
     - H2 talk: `animate-with-text-v3`, 4f at 150 ms, "side view hero gesturing while speaking, mouth open and closed, hand lifts slightly", seed 4711;
     - H3 react: 4f at 60/60/120/250 ms, "side view hero small surprised hop, both feet leave ground 2 pixels, lands", seed 4721.
   - The other 7 heroes get H1, and more animations where they add value.
3. **Lantern locations ×5** (flooded gate, tunnel fork, toll bridge, singing lake, ceiling crack/daylight). Each has 3 layers, seed 4101:
   - far, 195×100: `generate-with-style-v2`, view side, greybox 350 → refine 600. Example prompt: "side-view cave interior, flooded mine tunnel, dark blue stone, distant cyan glow, flat stage ground line at bottom, pixel art";
   - mid, 195×100: `no_background:true`, init = far crop, strength 450. Prompt: "foreground rock arches and old mine beams framing the stage, side view, transparent background";
   - ground strip, 195×24, horizontally tileable: "wet stone floor strip, side view".
4. **Props:** lantern 12×16, rope bridge, raft, mine cart 48×40, glow crystal, ration crate.
   - Tool: `create-1-direction-object`, view side, style_images = the approved props + hero.
5. **NPCs Rook and Vey:**
   - `create-character-with-4-directions` (mode pro, east used), 64 tall. Prompts:
     - "Rook, wiry young mine guide, rolled sleeves, rope over shoulder, determined grin";
     - "Vey, sly bridge smuggler, patched long coat, coil of rope, half smile";
   - N1 idle (template, 4f, 300–400 ms, seed 4401+n);
   - N2 talk (4f at 150 ms, seed 4411+n);
   - portrait 64×64 via `generate-with-style-v2` with the sprite as ref: "bust portrait of Rook facing viewer, same outfit".
6. **Icons:**
   - stats 16×16, low detail: "bundle of supplies icon; heart with small flame; laurel star";
   - U3 approach 16×16 ×5: "explore diamond, ledger, speech quote, crossed swords, hourglass", seed 4506;
   - Rewind 12×12.
7. **VFX:**
   - V1 sparkle burst: 32×32, 6f at 83 ms, "small cyan and white sparkle burst, star points, fades", seed 4501;
   - V2 dust puff: 32×16, 5f at 60/60/80/100/120 ms, seed 4502;
   - V3 stat up/down: 16×16, 4f at 80 ms, seeds 4503/4504.
8. **Ambient:** A-L3 drip, 16×32, 6f at 100 ms plus a 1.2 s hold, seed 4803. The glow pulse and water shimmer are drawn in code.
9. Critique every asset (§1.9), with scores in `params.json`. Make a contact sheet `art-src/quests/lantern-sheet.png` at 2x.
Accept: every asset scores ≥22/28 (keep iterating until it does), and the credits are logged per batch.
⚑ emci approves the contact sheet. Until then, log `Blocked on: ⚑ art OK lantern`. Later phases that don't depend on the art can continue.

## PHASE-16 Quests UI v3
Deps: 03, 14 · Model: Sonnet
Files:
- `src/app/quest/index.tsx`, `src/app/quest/[id].tsx`, `src/app/_layout.tsx` (Stack.Screen only)
- `src/components/quests/{stage,dialogue,choice-card,stat-bar,d20-tile,ending-card,said-card,glass,top-bar,chapter-card}.tsx`
- `src/lib/quests/theme.ts` (§1.8)
- G1 primitives (import only)
Layout:
- Full-bleed pixel stage (placeholder plates via `stage` with a dev-only "PLACEHOLDER" label).
- Floating top pills: close, chapter progress, Rewind count.
- A glass dialogue card at the bottom with a speaker nameplate pill and cyan keyword tint.
- Choice cards: an approach icon tile on the left (gradient), the label, an optional hint, an inline d20 badge "CHECK: SUPPLIES ≥ 11 · 55%", and a hold ring on the right.
- 3 stat bars ("n/6" each).
- Select screen: campaign cards plus an "As me / For fun" segmented toggle ("not saved" note on For fun).
Stage layers, back to front: far, light/glow, mid, ambient particles (20 or fewer), NPC, hero, front occluder, vignette + tint.
- Parallax: far 1 art px per 500 ms, mid 1 px per 250 ms, wrapping over 4 px.
- All pixel motion goes through PIXEL_SNAP.
Motion (Reduce Motion in brackets):
- **Select:** cards rise 16pt + fade (300 ms out-cubic, 70 ms stagger); the toggle thumb springs. [fade]
- **Chapter card:** the title types at 40 ms/char; a cyan rule draws in; 1.2 s total, tap to skip. [600 ms fades]
- **Scene:**
  - plate fades in over 500 ms; the dialogue card rises 14pt in 350 ms;
  - typewriter at 70 chars/s with +120 ms after `.,—`, a blinking caret, and tap to finish;
  - speaker pill cross-fades;
  - choices rise 16pt with an 80 ms stagger once the text is complete;
  - hero idle (H1) and NPC talk while typing.
  [no rise; text appears at once]
- **Commit:** hold 250 ms (`Gesture.LongPress().minDuration(250)`) or double-tap.
  - The ring fills via SVG dashoffset.
  - Commit glow + amber ring; the other choices fade to 35%; Light haptic; the hero react hop.
  - VoiceOver: a "Choose" accessibility action, with hint "double-tap and hold to choose". **(R17)** With VoiceOver or Switch Control on, a single activation runs Choose (no hold needed). The hold gesture uses `failOffsetY` so a vertical drag scrolls instead. [ring fills; no hop; react frame for 400 ms]
- **Beat:** a "You chose" card slides up with an amber ring.
  - Stat bars tween over 350 ms with a floating ±1 (left→right, 120 ms apart).
  - Success haptic once per beat if anything went up.
  - A Continue pulse. [bars jump with a 300 ms colour glow]
- **d20:** the tile flips (rotateY 2×180°, 700 ms), then a 120 ms hit-stop and a glow.
  - Success: V1 sparkle + Success haptic.
  - Fail: a 2px shake ×3 + Warning haptic. A fail is just another branch, never a game over.
  [the number fades in]
- **Rewind:** a cyan scanline sweep, 300 ms; stats reverse-tick. [150 ms cross-fade]
- **Ending:** the plate assembles in layers, a diagonal light sweep (900 ms), the title fades up, and the "Ending 2 of 4" bar fills. [brightness fade]
- **Said** ("What your choices said"):
  - up to 3 cards that rise + scale .97→1 (450 ms, 400 ms stagger);
  - emblem EASE_BACK pop with an amber glow, plus a Medium haptic;
  - a consistency bar fills over 600 ms;
  - the evidence line reads "4 scenes · 3 the same way" and quotes the pole phrase from axis-poles ("You kept picking 'What's that? I'll try it.'");
  - each card has a ☐ Apply tick (**the player ticks each card; none are pre-ticked**) and Not me (desaturate + collapse over 200 ms);
  - the Save button stays disabled ("Tick what sounds like you") until a card is ticked;
  - "Not enough to say" lists the other axes;
  - "I was messing around" opens a confirm sheet;
  - the ethics line is always shown: "This is a story, not a test. There are no wrong choices.";
  - in this phase, Save is wired to a stub; PHASE-17 connects it.
  [cards fade; emblem appears]
Accessibility and layout:
- VoiceOver reads full text at once and announces stat changes.
- Dynamic Type up to XXL: choice cards grow.
- At 375×667: the plate is 220pt, the choices scroll and the Save button is sticky.
- States: loading, empty (no campaigns), and error (content invalid, dev only).
Accept: the sample campaign plays end to end, every animation has a Reduce Motion variant, and 1 frame callback per screen.

## PHASE-17 Server, Apply, Undo, flags
Deps: 13, 14 · Model: Opus
Files: `supabase/migrations/wave116_quest_runs.sql` (new, **NOT applied**), `src/lib/quests/{apply,flags}.ts`, `src/components/quests/said-card.tsx`, `src/app/quest/[id].tsx` (said wiring only), `scripts/quest-apply-check.ts`, `package.json`.
SQL:
- `quest_runs` table: `id uuid pk, user_id uuid, campaign_id text, content_version int, ending_id text, for_fun bool, applied jsonb, pre_values jsonb, stats jsonb, events jsonb, created_at, applied_at, undone_at`.
- RLS: select own rows only; no direct insert or update.
- `record_quest_run(...)`: security definer; stores the summary and analytics events (quest_start, scene_view, commit, rewind, d20, quit+scene, ending, said_view, apply n, undo, for_fun).
- `apply_quest_result(p_run_id uuid, p_axes jsonb)`. It checks:
  - `quests_apply_enabled`;
  - the axis allow-list (§PHASE-12);
  - s ∈ [0.2, 0.8];
  - 3 axes or fewer;
  - 7 days per axis;
  - the run id is used once.

  It stores pre_values and calls `_trait_write(uid, axis, 'self_game', s, 'game')`.
- `undo_quest_result(p_run_id)`: within 24 h. It restores pre_values if the game track hasn't been written since; otherwise it applies the inverse nudge.
- `app_config` columns: `quests_enabled bool default false`, `quests_apply_enabled bool default false`, `quests_disabled_campaigns text[] default '{}'`.
Client:
- an idempotent apply with an offline queue and retry (AsyncStorage);
- flag off hides the entry, or disables Apply with a kind note;
- error messages for each RPC error;
- after Save: "Saved. Your answers still count most.";
- a dev override for the flags.
Hardening (red team):
- **(R11)** every RPC is `security definer` with `set search_path = public, pg_temp`, rejects a null `auth.uid()`, validates every jsonb field, does `revoke ... from public, anon` and grants only to `authenticated`. No direct DML on `quest_runs`.
- **(R10)** `p_axes` carries `{axis, s, g}`. The server validates `s∈[0.2,0.8]` and `g≤0.25`, applies the |Δ|≤0.08 cap itself, and uses PHASE-13's notes on `_trait_write`.
- **(R09)** the server enforces the 30-day evidence rule (per campaign, from `quest_runs`) and the 7-day axis rule; client state is only a mirror.
- **(R08)** Undo after a newer game-track write is bounded: the value never leaves `pre_value ± 0.08` or `[0.2, 0.8]`.
- **(R07)** the client takes an in-flight lock per run id; the queue retries with the same run id, so two concurrent Applies make one write.
- **(R12)** `user_id` references the user with `on delete cascade`; `delete-account` and `reset_my_account` wipe `quest_runs`, and their checks are extended.
Accept: the SQL is reviewed in the plan, and `check:quest-apply` (queue, idempotency, concurrent double Apply = one write, Undo after a newer write, error mapping) is green.
⚑ emci applies wave116 in Supabase. Log `Blocked on: ⚑ apply wave116` until he confirms. The PR can open before that.

## PHASE-18 Style guide + The Drowned Lantern
Deps: 12, 13 · Model: Sonnet
Files: `docs/quests-style-guide.md`, `src/lib/quests/content/{lantern,index}.ts`.
**Style guide** (write it into the doc):
- second person, present tense, warm and wry;
- a beat is 45 words or fewer, at grade 6–8 reading level;
- choice labels are first person, 60 chars or fewer;
- **every option is heroic in its own way**: no moral framing, no "right" pole, no rewards tied to a pole;
- no psych jargon and no trait words on screen;
- inclusive names, no gendered defaults for the player;
- fantasy register is plain-spoken (no thee/thou); city register is contemporary and specific;
- 1–2 keywords per beat get tinted;
- a fail on a check makes a different story, never a punishment;
- endings are all good, just different flavours.

**Lantern spec:**
- setting fantasy, minutes 7;
- startStats supplies 3, morale 2, renown 0;
- targetAxes: openness, autonomy, conflict_assertiveness, self_efficacy;
- cast: Rook (guide), Vey (smuggler), the Elder;
- 14–18 scenes in a diamond structure (branches rejoin at chapter ends), 9–12 on any path;
- 3 chapters plus a finale;
- 3–4 d20 checks; flag-gated variants (`trusted_rook`, `saw_glow`, `gave_map`), including 1 secret scene;
- 3–4 endings: The Singing Deep, The Long Way Home, Rook's Lantern (trusted_rook), The Toll Paid Forward (gave_map);
- every target axis has 3 or more primary scenes on every path;
- locations: flooded gate, tunnel fork, toll bridge, singing lake, ceiling crack.

**Sample scenes** (the canon opening; expand around them). Tag format is `axis ±1 (w)`.
- **S1 Flooded Gate** (ch1, primary autonomy). Hollowmere's mine is half underwater. The Elder: "Stick to the marked route. Every crew that didn't came back with less." Rook is already wading in.
  - "We follow the elder's map, step by step." → Morale +1 · autonomy −1 (1)
  - "Thanks. We'll find our own way down." → Renown +1 · autonomy +1 (1)
  - "Rook, you've been down there. You lead." → Morale +1, flag trusted_rook · autonomy −1 (.4)
- **S2 The Fork** (ch1, primary openness). The left is the dry miners' road; the right glows a blue no map mentions. Rook: "Your call, captain."
  - "Follow the blue glow." → Supplies −1, Renown +1, flag saw_glow · openness +1
  - "Take the miners' road." → Supplies +1 · openness −1
  - "Ask Rook what she thinks." → Morale +1, flag saw_glow · autonomy −1 (.4)
- **S3 Toll Keeper** (ch2, primary conflict_assertiveness). Vey has strung a rope across the only bridge: "Toll's two rations each. Or swim."
  - "No. That's a robbery. Drop the rope." → Renown +1 · c_assert +1
  - "Pay it. Not worth the fight." → Supplies −2, Morale +1 · c_assert −1
  - "Offer the map for passage." → flag gave_map · c_coop +1 (.4), openness +1 (.4)
- **S4 / S4b Singing Lake** (ch2, primary openness; the variant depends on saw_glow). Something glints on the glowing lake bed.
  - "Dive in and look." → Renown +1, Morale −1 · openness +1
  - "Rig a hook and pull it up safely." → Supplies −1 · openness −1
  - "Make camp; decide in the morning." → Morale +2 · neutral
- **S5 Way Back** (finale, primary openness). Two ways out: the long known road, or a ceiling crack with daylight.
  - "Climb toward the daylight." → The Singing Deep · openness +1, autonomy +1 (.4)
  - "Take the long road." → The Long Way Home · openness −1
  - "Let the crew vote." → The Singing Deep variant ("The crew chose, and the crew was right.") · autonomy −1

Ending lines:
- The Singing Deep: "You found the lantern under the singing lake, where no map said to look. The village will tell this one for years."
- The Long Way Home: "You brought it back the way it left. Steady hands. The lantern is lit in the square tonight."

self_efficacy scenes: "I can fix this rope bridge myself" (+) vs "Let's wait for someone who's done this" (−). Both are framed as smart.

Each scene's art: location key + props + tint + cast.

Accept: `check:quests` and `check:quest-score` are green, it's playable in the UI, and copy rules pass. Keep the sample as a fixture.
⚑ emci signs off the copy in the PR.

## PHASE-19 The Masquerade
Deps: 18 · Model: Sonnet
Files: `src/lib/quests/content/{masquerade,index}.ts`. Follow `docs/quests-style-guide.md`.
Spec:
- fantasy court intrigue: a stolen heirloom mask at Lady Ines's midnight ball;
- startStats supplies 2, morale 3, renown 1;
- targetAxes: extraversion, agreeableness, conflict_cooperativeness, playfulness;
- cast: Lady Ines (host), Corvin (masked stranger), Pell (servant);
- locations: ballroom, balcony, servants' stair, library, garden maze;
- props: masks, candelabra, letter, wine table, clock;
- structure is the same as PHASE-18: 14–18 scenes, 9–12 per path, 3–4 checks, 3–4 good endings (e.g. The Last Waltz, Quiet Exit, Unmasked Together, The Clock Strikes Twice).
- Example primaries:
  - extraversion: "Join the dance floor and ask around" (+) vs "Watch from the balcony and listen" (−);
  - playfulness: "Swap masks with a stranger for fun" (+) vs "Keep your mask on and stay focused" (−).
Accept: the same as PHASE-18. ⚑ copy sign-off.

## PHASE-20 Last Train Home
Deps: 18 · Model: Sonnet
Files: `src/lib/quests/content/{last-train,index}.ts`.
Spec:
- modern city: the last train is cancelled at 00:40 and you need to get across town;
- city register;
- startStats supplies 2 (phone battery/cash), morale 2, renown 0;
- targetAxes: conscientiousness, locus_of_control, extraversion;
- cast: Mara (night-shift nurse), Theo (busker), Dee (cab driver);
- locations: cancelled platform, night street, rooftop, 24h diner, last bus stop;
- props: departure board, vending machine, bike, phone, umbrella, food cart;
- 14–18 scenes, 3–4 checks, 3–4 good endings (e.g. Sunrise Walk, The Night Bus Crew, Diner Till Dawn).
- Example primaries:
  - locus_of_control: "Plan a route yourself" (+) vs "It's late; luck will sort it" (−), with both framed kindly;
  - conscientiousness: "Map every stop and charge the phone" (+) vs "Wing it and see the city" (−).
Accept: the same as PHASE-18. ⚑ copy sign-off.

## PHASE-21 Art 2: Masquerade + City + shared VFX (PixelLab)
Deps: 15 · Model: Sonnet + PixelLab MCP · Art policy: §1.9 quality-first (no limits; log credits).
Files: `art-src/quests/**` only. Reuse the STYLE.md, refs and approved PHASE-15 assets as style references.
Steps:
1. **Masquerade** (seed 4201): 5 locations × 3 layers, plus props (masks ×4, candelabra, letter, wine table, clock).
   - NPCs Ines, Corvin and Pell: sprite, N1, N2, portrait.
   - Ambient:
     - A-M1 candle flame: 16×24, 6f, uneven 80–120 ms, "small candle flame flicker, white core yellow orange tips, no outline", seed 4811;
     - A-M2 curtain sway: 48×96, 6f at 160 ms, seed 4812;
     - A-M3 dancer silhouettes: 96×48, 8f at 120 ms, seed 4813.
2. **City** (seed 4301): 5 locations × 3 layers, plus props. Ground examples: "train platform tiles with yellow safety line".
   - NPCs Mara, Theo and Dee.
   - Ambient:
     - A-C2 rain tile: 64×64, 4f at 80 ms, seed 4821;
     - A-C3 train lights: 195×24, 8f at 70 ms, seed 4822.
   - The neon buzz is drawn in code.
3. **Heroes:**
   - H4 walk: template walk east, 8f at 110 ms, seed 4731;
   - H5 triumph: 6f at 90 ms, hold the last frame 400 ms, seed 4741.
   - Both for the 3 main heroes.
4. **Shared:**
   - V5 d20: a 32×32 static d20 ("pixel d20 die, cyan faces, ink outline"), then an 8f tumble, seed 4505. Numbers are drawn in code.
   - 10 lean emblems at 24×24 in one batch, seed 4601: openness = open door, conscientiousness = ledger, extraversion = raised hand, agreeableness = clasped hands, c_assert = banner, c_coop = bridge, autonomy = compass, playfulness = kite, self_efficacy = hammer, locus_of_control = helm wheel.
   - 3 campaign badges at 32×32.
   - 12 ending cards at 195×118: bitforge, init = composed layers + hero, strength 650.
5. Critique everything and make contact sheets.
Accept: all assets score ≥22 (iterate until they do), any extras are noted, and credits are logged.
⚑ emci approves the contact sheets.

## PHASE-22 Atlas build + art integration
Deps: 15, 16, 21 · Model: Sonnet
Files: `scripts/build-quest-atlas.ts`, `scripts/quest-atlas-check.ts`, `assets/quests/*`, `src/lib/quests/art-keys.ts`, `src/components/quests/{atlas-sprite,stage}.tsx`, `package.json`.
Steps:
1. **Builder** (node; use sharp or pngjs only if already in devDeps, otherwise pure JS):
   - pack the approved PNGs from `art-src/quests` into `lantern`, `masquerade`, `city` and `shared` atlases (PNG + JSON frame rects);
   - pre-scale ×2 with nearest-neighbour; **(R20)** give every frame 2px transparent padding with edge extrude so neighbours can't bleed, and have `check:quest-atlas` assert the padding; **(R24)** the builder is pure JS (no `sharp`/`pngjs`) unless emci approves a dev dependency;
   - bake a pre-blurred, darkened copy of each plate into the same campaign atlas for the glass dialogue backdrop;
   - generate `art-keys.ts`.
2. **atlas-sprite:** expo-image inside an `overflow:hidden` View, offset by −frame.x/−frame.y.
   - The frame index comes from the stage's single `useFrameCallback`: `floor(elapsed/frameMs)%n`, with per-frame durations supported.
3. Replace the placeholders.
4. Code-drawn FX: the Lantern glow pulse (4 levels at 250 ms), water shimmer, dust motes, neon buzz (A/B 1600 ms with an 80 ms off-frame every 6–14 s), chapter wipe, scanline rewind, light sweep. No SVG `<Pattern>`.
5. Ambient Reduce Motion: half count, quarter speed, never off.
6. `check:quest-atlas` checks:
   - each atlas is 2048² or smaller;
   - 12 or fewer files under `assets/quests`;
   - 4 MB or less;
   - every content `art` key and NPC/emblem frame exists;
   - no unused loose PNGs.
Accept: the atlas check and ota-gate are green, and all 3 campaigns render with real art at 1x scale integrity.

## PHASE-23 Quests entry points + tutorial + You
Deps: 04, 06, 09, 16, 17 · Model: Sonnet
Files: `src/app/(tabs)/insights.tsx` (QUESTS_CARD_SLOT only), `src/components/nav-more-sheet.tsx`, `src/app/(tabs)/you.tsx` (new section only), `src/components/quests/first-run.tsx`.
Steps:
1. Insights card: "Quests: short story adventures", showing endings found.
2. A More row.
3. You → "From your quests" (`section=quests`), placed below Your traits:
   - lists applied axes with the date;
   - Undo within 24 h;
   - empty state: "Play a quest; nothing is saved unless you tick it."
4. Everything is hidden when `quests_enabled=false`. Disabled campaigns are hidden. **(R22)** `/you?section=quests` with the flag off is ignored silently (no error, no scroll).
5. Tutorial: 3 cards, shown once (`ato.quests.tutorial.v1`, cleared on sign-out):
   - "Choices shape the story";
   - "Hold to choose · Rewind once per chapter";
   - "Nothing is saved unless you tick it".
Accept: entry works from Insights and More, Undo works, and the flag hides everything. insights, you and nav checks green.

## PHASE-24 Per-mode polish (G5)
Deps: 08, 09, 10, 11 · Model: Sonnet
Files: the Home, Insights and Legends components from PHASE-08 to -10, `src/constants/appearance.ts` (read only), `src/components/share-poster.tsx`.
Steps:
1. Quest, Neon and Anime flavours via the existing `hudFrames`, `glowPulse` and `hpMpBars` tokens: frames, glow loops and bar styles.
2. A share poster with the constellation.
3. Check contrast in all 5 modes.
Accept: screenshots in 5 modes, a Reduce Motion recording, and share-poster checks green.

## PHASE-25 Quests QA + playtest
Deps: 17, 18, 19, 20, 22, 23 · Model: Sonnet (Opus if scoring needs a retune)
Files: only the files that fail checks, plus `docs/quests-playtest.md`.
Steps:
1. Run every check below on all 3 campaigns:
   - VoiceOver: full text at once, the Choose action, stat announcements;
   - Dynamic Type XXL;
   - 375×667 (plate 220pt, sticky Save);
   - iPad at max width 600 with the plate letterboxed;
   - perf: 60 fps, 60 or fewer nodes, 1 frame callback;
   - scoring sims on the real content (under 5% false apply);
   - save migration (old save + bumped contentVersion);
   - offline Apply then retry;
   - flags off;
   - 30-day and 7-day rules;
   - endings tracker.
2. Playtest script for emci: 5 testers × 1 campaign, think-aloud, fun rated 1–5, confusion points, apply-rate.
Accept: every row is ✅ or explicitly deferred by emci.
⚑ emci runs the playtest. Fix the notes in this same phase (re-open it if needed).

## PHASE-26 Whole-app a11y + states
Deps: 11, 24, 25 · Model: Sonnet
Files: only failing files, plus `docs/qa-a11y-report.md`.
Steps: for every new or changed screen (Settings, You, tab bar/More, Your reveals, Home, Insights, Legends, Quests):
- VoiceOver labels and order;
- Dynamic Type XXL;
- 375×667;
- iPad centred at MaxContentWidth;
- empty, loading and error states (Your reveals with 0, constellation without tracks, Insights offline);
- a Reduce Motion recording;
- the haptics map is consistent.
Fix only what fails, and write the report.
Accept: the report shows every row ✅ or deferred by emci.

## PHASE-27 Regression QA + release
Deps: 26 · Model: Opus plans, Sonnet builds
Files: failing files only, plus `docs/{release-notes,quests-launch}.md` and `src/content/legal/privacy.md` (diff only).
Steps:
0. **(R26)** Merge the latest master into `ato-build` first, then run the final gate. **(R12)** Also diff `src/content/legal/app-privacy-labels.md`, labelling each change mandatory / recommended / optional per the compliance rule.
1. Run every `npm run check:*`.
2. Measure perf per screen.
3. Compare the OTA file count and bundle size against the last release, and confirm the Quests assets are within §1.9.
4. Regression checklist:
   - auth, onboarding, age gate, delete account, sign out, AI consent;
   - Settings;
   - tab layout reset;
   - the `/explore` redirect and notification deep links → /you sections;
   - Divecore via Play;
   - Legends reveals and Your reveals;
   - Insights;
   - Quests end to end, including Apply, Undo, offline and the kill switch.
5. Docs:
   - `quests-launch.md`:
     - Store wording: "A story game; your choices can add a small hint to your profile if you choose. Not a psychological test.";
     - the privacy label note (game-derived trait hints are opt-in and undoable);
     - metrics to watch: completion, drop-off scene, for-fun ratio, apply rate, undo rate;
     - live-ops: hide a campaign via `quests_disabled_campaigns`.
   - Release notes.
   - privacy.md: mention game-derived hints and Undo.
6. Kill switch: Quests only. Gamify and IA roll back via OTA.
Accept: every check is green and the regression list is ✅.
⚑ This is the single OTA for the whole build. emci approves the Store, privacy and legal wording, sets `quests_enabled` and `quests_apply_enabled` to true, and publishes the OTA himself.

## APPENDIX-A New quest campaign (phase template; add `- [ ] PHASE-NC-<id>` to the progress file)
Deps: 27 · Model: Sonnet + PixelLab MCP (2 sessions: art, then content)
0. Mini red-team (§0 step 12): check branch dead ends, trait coverage per path, save migration and atlas size.
1. Premise, setting and 3–4 target axes from the allowed 10.
2. **Art session:** reuse locations first. Make only the new locations, props, NPCs and ending cards with the §1.9 style card, the next free seed family (44xx/48xx+), the quality-first policy and the critique gate. Then rebuild the atlases with `scripts/build-quest-atlas.ts`. Keep within the atlas size budget, or raise it with a note per §1.9.
3. **Content session:** write `src/lib/quests/content/<id>.ts` per `docs/quests-style-guide.md` and the PHASE-18 structure, with `contentVersion:1` and `sceneIdsFrozen`. Never rename or delete a frozen id later; use `retired` + `redirect`. Register it in index.ts.
4. Green: `check:quests`, `check:quest-score`, `check:quest-atlas`, `check:ota-gate`.
5. Play it on device three ways: as me, for fun, and chaotic. The said screen should offer 0–3 cards sensibly.
6. ⚑ emci does the copy review, merges, and publishes the OTA. A campaign can be hidden without an OTA via `quests_disabled_campaigns`.
