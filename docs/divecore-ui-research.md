# Divecore UI research (2026-10-14)

Purpose: evidence for the minimalist Divecore layout (TopBar · NoticeLane · fixed-size Stage ·
ActionDock · bottom TabBar), the single notification system (CELEBRATE, NOTIFY, ERROR,
FEEDBACK-on-control, STATUS-in-HUD, HELP coach tips, CONFIRM modal), contextual coach tips and
strict word limits. Every source below was fetched on 2026-10-14. Takeaways are paraphrased, and
no quote runs past 15 words.

## Sources

### 1. Thumb zones and touch (Steven Hoober)

- **Hoober, "How Do Users Really Hold Mobile Devices?" (UXmatters, 2013).** 1,333 street
  observations: 49% one-handed, 36% cradled, 15% two-handed. People switch grip often. Hoober
  later said his reach drawings were too coarse and that people mostly touch the screen centre.
  https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php (verified 2026-10-14)
- **Hoober, "Design for Fingers, Touch, and People, Part 1" (UXmatters, 2017).** People prefer
  to look at and tap the centre, and accuracy drops toward the edges and corners. Targets are
  about 7 mm in the centre and 12 mm in the corners. Primary content goes in the centre,
  secondary actions on the top and bottom edges, and risky items away from other controls.
  https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php (verified 2026-10-14)
- **Hoober, "How We Hold Our Gadgets" (A List Apart).** Thumbs drive most phone use. Only about
  a third of a phone screen is easy to reach, and top vs. bottom matters more than left vs.
  right. Design for the most constrained grip, and make hard-to-reach targets larger.
  https://alistapart.com/article/how-we-hold-our-gadgets/ (verified 2026-10-14)
- **Addy Osmani, "Modern Touch-Friendly Design" (secondary summary of Hoober).** Says Hoober's
  heuristics are to centre key actions and to put secondary navigation on the top and bottom
  edges. Advises against relying on a rigid "thumb zone" map.
  https://addyosmani.com/blog/touch-friendly-design/ (verified 2026-10-14)

### 2. Apple Human Interface Guidelines

The HIG HTML pages render client-side, so a plain fetch returns only the title. The text was
read from Apple's own data endpoint for each page
(`developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`). The
links below are the canonical pages.

- **Tab bars.** Use the tab bar for navigation, not actions. Fewer tabs are easier, so avoid the
  overflow "More" tab. Give every tab a label, one word where possible. Keep the bar visible
  except under a modal. Keep tabs enabled even when a section is empty, and explain why it is
  empty. Badges (red oval, white text) are for critical information only.
  https://developer.apple.com/design/human-interface-guidelines/tab-bars (verified 2026-10-14)
- **Accessibility.** On iOS the default control size is 44x44 pt and the minimum is 28x28 pt.
  Leave about 12 pt of padding around bezeled controls and 24 pt around unbezeled ones. With
  Reduce Motion on, cut automatic or repeating motion, and replace x/y/z transitions with fades.
  https://developer.apple.com/design/human-interface-guidelines/accessibility (verified 2026-10-14)
- **Alerts.** Use alerts sparingly, never for information alone, and never at launch. Do not
  alert for common, undoable actions. Do alert for uncommon actions that cannot be undone. Use a
  specific title of two lines or fewer, one- or two-word button labels that name the result, and
  "Cancel" for cancel.
  https://developer.apple.com/design/human-interface-guidelines/alerts (verified 2026-10-14)
- **Motion.** Add motion only where it has a purpose. Never let motion be the only carrier of
  important information; pair it with haptics or audio. Keep feedback brief, and let people act
  without waiting for an animation to finish.
  https://developer.apple.com/design/human-interface-guidelines/motion (verified 2026-10-14)
- **Managing notifications.** Show urgency accurately: don't mark low-priority information as
  high urgency. Get permission before sending anything, and let people change their choices
  in-app.
  https://developer.apple.com/design/human-interface-guidelines/managing-notifications (verified 2026-10-14)

### 3. Material Design snackbars

- **Material Design 1, Snackbars & toasts (archived).** Only one snackbar shows at a time. Use
  one line of text about the operation, at most one action, and that action cannot be
  Dismiss/Cancel. Use a dialog when there are two or more actions. Snackbars time out on their
  own and sit at the bottom, below dialogs and sheets.
  https://m1.material.io/components/snackbars-toasts.html (verified 2026-10-14)
- **Material Components for Android, Snackbar.md.** Only one snackbar is shown at a time, and a
  new one dismisses the old. Snackbars are brief messages. Short, Long and Indefinite are the
  duration presets.
  https://github.com/material-components/material-components-android/blob/master/docs/components/Snackbar.md (verified 2026-10-14)
- **Android Developers, Compose Snackbar.** One optional action label. Short is the default
  duration, and Indefinite is for when the user must act. The host shows one snackbar at a time
  and queues the next.
  https://developer.android.com/develop/ui/compose/components/snackbar (verified 2026-10-14)
- **Flutter SnackBar.duration.** Defaults to 4.0 s.
  https://api.flutter.dev/flutter/material/SnackBar/duration.html (verified 2026-10-14)
- **Educative, "What are snackbars in UI design?" (secondary).** Attributes Material's
  4 s minimum and 10 s maximum, one-at-a-time and single-action rules.
  https://www.educative.io/answers/what-are-snackbars-in-ui-design (verified 2026-10-14)

### 4. Nielsen Norman Group

- **Progressive disclosure.** Show the few most important options first and put specialised
  ones a step away. Showing something first tells users it matters. This improves learnability,
  efficiency and error rate.
  https://www.nngroup.com/articles/progressive-disclosure/ (verified 2026-10-14)
- **Mobile-app onboarding: components and techniques.** Avoid onboarding where possible, and
  fix the UI instead. Deck-of-cards tutorials did not improve task performance. Prefer tips in
  context. Feature highlights work best when the feature becomes usable. Errors are a teaching
  moment.
  https://www.nngroup.com/articles/mobile-app-onboarding/ (verified 2026-10-14)
- **Instructional overlays and coach marks.** Use one hint at a time, about one interaction,
  shown when the user reaches that part of the app. Chained tips overload memory and get
  dismissed faster. Use visuals and minimal text, and make the hint look different from real
  controls.
  https://www.nngroup.com/articles/mobile-instructional-overlay/ (verified 2026-10-14)
- **Indicators, validations, notifications.** Indicators are passive and attached to an
  element. Validations sit next to the input and say how to fix it. Notifications are system
  events, either action-required or passive. Don't use brief toasts for errors, because people
  miss them. Prefer passive feedback for frequent, low-stakes confirmations.
  https://www.nngroup.com/articles/indicators-validations-notifications/ (verified 2026-10-14)
- **Error-message guidelines.** Put the error near its source and use more than colour. Match
  prominence to severity. Use plain language and say the specific problem and the remedy. Keep a
  neutral tone with no blame.
  https://www.nngroup.com/articles/error-message-guidelines/ (verified 2026-10-14)
- **Help and documentation.** Prefer contextual "pull" tips, shown when the user reaches the
  relevant control, over "push" tips that interrupt. Keep tips brief and dismissible, and make
  them findable again later from one place.
  https://www.nngroup.com/articles/help-and-documentation/ (verified 2026-10-14)

### 5. Accessibility (React Native, WCAG, Apple)

- **React Native AccessibilityInfo.** `announceForAccessibility(text)` posts a screen-reader
  announcement. On iOS, `announceForAccessibilityWithOptions` takes `queue` and
  `priority` (low/default/high). `isReduceMotionEnabled()` and the `reduceMotionChanged` event
  read and track the OS setting.
  https://reactnative.dev/docs/accessibilityinfo (verified 2026-10-14)
- **React Native Accessibility.** `accessibilityLiveRegion` is Android only and takes
  none/polite/assertive. TalkBack reads changed text in that region. `accessibilityRole`
  includes `alert`, `button`, `tab`, `tablist`, `progressbar` and `timer`.
  https://reactnative.dev/docs/accessibility (verified 2026-10-14)
- **WCAG 2.1 Understanding SC 2.3.3, Animation from Interactions (AAA).** Let users turn off
  non-essential motion triggered by interaction. Essential motion may stay. Colour or opacity
  changes that don't move or resize an element are not "motion animation".
  https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html (verified 2026-10-14)
- **WWDC19 session 244, "Visual Design and Accessibility".** Apple says one in three people has
  some motion sensitivity, so apps should adapt their animations when Reduce Motion is on. The
  "Prefer Cross-Fade Transitions" setting turns lateral slides into dissolves.
  https://developer.apple.com/videos/play/wwdc2019/244 (verified 2026-10-14)
- **Smashing Magazine, "Designing With Reduced Motion For Motion Sensitivities" (2020).**
  Replace large transitions with a crossfade or opacity fade at the same timing. Keep
  affordances and hover states. Reduce triggering motion rather than removing everything.
  https://www.smashingmagazine.com/2020/09/design-reduced-motion-sensitivities/ (verified 2026-10-14)

### 6. Game references

- **The Rookies, "Game design UX best practices: detailed breakdown of Clash Royale".** A
  bottom menu bar with five shortcuts (Social, Battle, Shop, Cards, Events), plus swiping
  between views. Key elements sit in the lower half for one-thumb play. Key actions are gold or
  yellow, and less needed information sits in separate flows. Notifications use a red bubble
  instead of startup popups. The tutorial drops the player into a guided battle without
  locking movement.
  https://www.therookies.co/blog/game-design-ux-best-practices-detailed-breakdown-of-clash-royale/ (verified 2026-10-14)
- **Samurai Gamers, "Brawl Stars - Main Menu Screen".** Currency counts (tickets, coins, gems)
  sit in the top-right with chat and settings. Trophy progress is top-left. A large Play button
  sits at the bottom next to Events.
  https://samurai-gamers.com/brawl-stars/main-menu-guide/ (verified 2026-10-14)
- **Pratt IXD, "Design critique: Brawl Stars" (2025).** The Play button is big and bright
  yellow, so the core action is easy to find. Busy home screen buttons make some features hard
  to find. Controls are mapped to the natural thumb positions.
  https://ixd.prattsi.org/2025/02/design-critique-brawl-stars/ (verified 2026-10-14)
- **GDC Vault, Ken Wong, "Designing Monument Valley: Less Game, More Experience" (GDC Europe 2014).**
  Abstract: treating the game as a user experience led ustwo to swap hard puzzles for a short
  aesthetic journey. Only the abstract was readable; the video sits behind a login.
  https://www.gdcvault.com/play/1021380/Designing-Monument-Valley-Less (verified 2026-10-14)
- **Game Developer, "Designing the surprise mobile game hit Monument Valley".** Wong kept
  asking how the game would read to non-gamers, and designed it to show its hand from the start.
  https://www.gamedeveloper.com/design/designing-the-surprise-mobile-game-hit-i-monument-valley-i- (verified 2026-10-14)
- **Mechanics of Magic, "Monument Valley | Critical Play: Puzzles" (2024).** No text tutorial.
  Each level teaches one new skill. Visual cues such as dots on movable pieces signal what can
  be moved. New mechanics arrive gradually and difficulty rises with skill.
  https://mechanicsofmagic.com/2024/05/14/monument-valley-critical-play-puzzles-2/ (verified 2026-10-14)
- **Game Developer, Max Pears, "Teaching the player: don't use words".** Players skip long text,
  and tutorials that take control frustrate them. Teach through visual tells, sounds and safe
  areas to experiment. Text is a last resort.
  https://www.gamedeveloper.com/design/teaching-the-player-don-t-use-words (verified 2026-10-14)
- **The Pokémon Company, "Why We Created Pokémon Sleep".** The design is sleep-first, with
  "Sleep Tips" delivered while the app is used instead of as separate study.
  https://corporate.pokemon.co.jp/en/topics/detail/110.html (verified 2026-10-14)
- **Nintendo Life, Pokémon Sleep open-beta hands-on.** The reviewer found early play piled on
  tutorial and menu screens one after another. This is a counter-example to avoid.
  https://www.nintendolife.com/features/hands-on-pokemon-sleep-open-beta-an-absolute-snoozefest (verified 2026-10-14)
- **Wikipedia, Neko Atsume.** The loop is: place food and toys, cats visit, they leave fish,
  you buy more. There is no end state. The developer aimed for a game children could enjoy
  without skill or time investment.
  https://en.wikipedia.org/wiki/Neko_Atsume (verified 2026-10-14)
- **Nippon.com, "Fill Your Phone with Cats: Nekoatsume".** The play is slow and simple, and
  mostly visual. That simplicity let non-Japanese players enjoy a Japanese-only interface.
  http://www.nippon.com/en/nipponblog/m00083/ (verified 2026-10-14)
- **Key Lime Interactive, "Tamagotchi gestures and UX design".** The original toy ran a whole
  life-sim through about three buttons. Care tasks and personality build attachment more than
  polish does.
  https://info.keylimeinteractive.com/tamagotchi-gestures-and-ux-design (verified 2026-10-14)

## Rules we use

- **R1. One primary CTA per screen, low and central.** The one primary action (Dive / Play /
  Place) sits in the ActionDock: bottom half, horizontally centred, larger than the other
  controls, in the single accent colour. Everything else is secondary or one tap away
  (progressive disclosure). Nothing risky sits next to it. *(Hoober UXmatters 2013 + 2017, A
  List Apart; NN/g Progressive disclosure; Clash Royale breakdown: lower-half layout, gold action
  items; Brawl Stars main menu; Pratt Brawl Stars critique: big yellow Play)*
- **R2. Every tappable thing is ≥ 44x44 pt.** Never go below 28 pt. Leave about 12 pt of
  padding between bezeled controls. Corner and edge targets get extra size (Hoober: about 12 mm
  in corners vs. 7 mm in the centre). *(Apple HIG Accessibility; Hoober UXmatters 2017; A List
  Apart)*
- **R3. Bottom TabBar: ≤ 5 tabs, one-word label plus icon, always visible.** It is for
  navigation only, never actions. There is no "More" tab. A tab stays enabled when empty and
  shows why. A red badge is reserved for something that needs the player. *(Apple HIG Tab bars;
  Clash Royale breakdown: five bottom shortcuts, red notification bubble)*
- **R4. Currencies sit in the TopBar as icon + number, no words.** We put them at the left.
  Supercell's games keep currency at the top edge (Brawl Stars puts it top-right); the edge is
  supported by the sources, and left is our choice. *(Brawl Stars main menu; Hoober UXmatters
  2017: secondary information on the top edge)*
- **R5. One notice at a time, by priority.** The order is ERROR > CONFIRM > CELEBRATE > NOTIFY
  > HELP. A new notice replaces or queues behind the current one and never stacks. A notice has
  at most one action, and that action is never "Dismiss". *(Material 1 Snackbars; Android
  Snackbar.md; Compose Snackbar host queue)*
- **R6. Short notices.** NOTIFY/CELEBRATE are ≤ 8 words on one line and auto-dismiss in 4 s
  (Material range 4–10 s, Flutter default 4 s). STATUS lives in the HUD as an indicator, not a
  notice. FEEDBACK appears on the control itself and is passive. *(Material 1 Snackbars;
  Flutter SnackBar.duration; Educative; NN/g Indicators/validations/notifications)*
- **R7. Errors persist and state the fix; CONFIRM is rare.** An ERROR stays until the player
  acts or taps. It is ≤ 10 words, names the problem and the remedy ("Need 20 coins. Dive to earn
  more."), uses neutral words, and pairs an icon with colour. It never uses a timed toast. The
  CONFIRM modal is only for rare, irreversible actions, never for information alone or at
  launch. Its buttons use 1–2 words that name the result, plus "Cancel". *(NN/g
  Indicators/validations/notifications; NN/g Error-message guidelines; Apple HIG Alerts)*
- **R8. Coach tips in context, never an up-front tutorial.** Show one HELP tip at the moment a
  feature first becomes usable. A tip covers one interaction, is ≤ 8 words, is dismissible,
  never chains, and looks distinct from real controls. *(NN/g Mobile-app onboarding; NN/g
  Instructional overlays; NN/g Help and documentation; Clash Royale guided first battle;
  Nintendo Life Pokémon Sleep as the counter-example)*
- **R9. One help entry.** A single "?" in a fixed spot replays every tip the player has already
  seen. There are no help links scattered through screens. *(NN/g Help and documentation:
  proactive help must also be findable later)*
- **R10. Show, don't tell.** Teach through the world: a glow or tell before an enemy acts, a
  sound when a task completes, a pet reaction to every care action, and a safe first room to
  experiment in. Add one new mechanic per stage. Text is a last resort. *(Game Developer
  "Teaching the player: don't use words"; Mechanics of Magic on Monument Valley; GDC Vault /
  Game Developer on Monument Valley; Neko Atsume via Nippon.com and Wikipedia; Key Lime
  Tamagotchi)*
- **R11. Reduced motion means a gentle fade, not removal.** When `isReduceMotionEnabled()`
  returns true, swap slides, zooms, bounces and shakes for a 150–250 ms opacity fade, and keep
  every state change visible. Pair important motion with haptics or sound. Listen for
  `reduceMotionChanged`. *(Apple HIG Accessibility; Apple HIG Motion; WWDC19 244; WCAG 2.3.3;
  Smashing 2020; RN AccessibilityInfo)*
- **R12. Every notice is announced.** ERROR and CONFIRM use
  `announceForAccessibilityWithOptions(text, {priority:'high'})` on iOS and an `assertive`
  live region on Android. NOTIFY, CELEBRATE and HELP use default or low priority (iOS) and a
  `polite` live region (Android). The NoticeLane uses `accessibilityRole="alert"` for errors.
  *(RN AccessibilityInfo; RN Accessibility)*

## Notes

- **Count.** 37 sources fetched and verified on 2026-10-14. 8 URLs were unreachable or empty
  and are not cited as evidence:
  - m3.material.io/components/snackbar/guidelines (client-rendered, title only)
  - m2.material.io/components/snackbars (client-rendered, title only)
  - developer.apple.com/design/human-interface-guidelines/* HTML (client-rendered; content
    verified through Apple's JSON data endpoint instead, as noted in Sources §2)
  - github.com/material-components/material-web/.../snackbar.md (404)
  - blogs.lwhs.org Neko Atsume review (TLS certificate error)
  - uxdesign.cc Monument Valley 2 usability article (403)
  - sap.com Fiori Android snackbar usage (403)
  - gameuidatabase.com: no Clash Royale or Brawl Stars entry was found or fetched, so no
    Game UI Database claim is made
- **The 4–10 s snackbar range** comes from secondary sources (Educative; search-result
  summaries of material.io). The official M2/M3 pages could not be rendered. The 4 s default is
  verified only via Flutter.
- **Currencies top-left (R4)** is a Divecore choice. The verified Brawl Stars source puts
  currency top-right, and the Clash Royale breakdown does not say where currency sits. What the
  sources support is "top edge".
- **Alto's Adventure.** No verified source on its wordless teaching was found; searches turned
  up interviews whose text did not cover onboarding. It is not cited.
- **Pokémon Sleep "one help entry".** Unverified. The only verified sources show in-context
  "Sleep Tips" (Pokémon Company) and a front-loaded tutorial (Nintendo Life review).
- **Monument Valley "no text".** One search summary claimed a single instruction screen at the
  start. The fetched Mechanics of Magic page describes no text tutorial. Treat it as
  "near-wordless".
- **WWDC session "Design with motion".** Not found. WWDC19 session 244 was used instead.
- **Thumb-zone heat maps.** Hoober himself retracted his early reach drawings in favour of
  "people touch the centre". R1 follows the later finding (low and central), not a strict
  bottom-right zone.
- **Supercell, Brawl Stars and Clash Royale descriptions** come from third-party breakdowns,
  not Supercell posts or GDC talks; none of those were found in readable form.
