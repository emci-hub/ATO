# Divecore navigation + thumb-zone audit

Scope: `src/app/play.tsx` (one route, `PlayMode` switch) and the screens it mounts. Read-only audit, 2026-10-14.
All positions are estimates for iPhone 16 Pro Max (430x932, safe top 59 / bottom 34). Thirds: top 0-310, middle 310-621, bottom 621-932.

## 0. Shell facts that shape everything

| Fact | Evidence |
|---|---|
| Classic skin is retired; `streetUiOn()` is always `true` | `src/play/art-skin.ts:10-25`, `src/play/street-ui.tsx:3,64-66` |
| Street shell (resource bar + tab bar) is drawn only when `view != null` and mode is NOT `dive`/`sheetlab`/`swordlab` | `src/app/play.tsx:775` |
| So Dive is full-bleed: no resource bar, no tab bar, no way to jump to another tab without Back | `play.tsx:775`, `dive-screen.tsx:276` |
| Turf War run swaps the resource bar for a HUD slot and the tab bar for a dock slot (screen switch) | `play.tsx:1024-1059`, `street-shell.tsx:66-74`, `defend-screen.tsx:3958-4016` |
| Classic `CommandHub` still mounts, but only in the loading state (`view == null`) | `play.tsx:849-874` (the `street && view` ternary) |
| Native iOS swipe-back only on the hub; every other mode uses our own left-edge PanResponder (x0 <= 24) | `play.tsx:1019`, `play.tsx:273-288`, `edge-back.ts:20-57` |
| Edge swipe wraps only the non-grove screens, inside the street body (so it never covers bars) | `play.tsx:877-878` |

## 1a. Destination -> entry points

Kind key: TAB = StreetTabBar, TILE = StreetBlock tile, BTN = in-screen button, SPOT = tap spot in the Hideout room, LINK = text link, BANNER, SHEET, TUT = tutorial, BACK = back/leave mapping, DEAD = unreachable or hidden in the Street shell.

### Block (`grove`)
| Entry point | file:line | Kind |
|---|---|---|
| Tab "Block" (no-op if already there) | `street-shell.tsx:179,250`; `play.tsx:789-794` | TAB |
| Resource-bar gear forces mode to grove, then opens Settings (from ANY screen with a resource bar) | `play.tsx:1034-1037`; `street-shell.tsx:159-169` | BTN (side effect: leaves current screen) |
| Hideout, Turf War (setup), Locker/Dress, Store, About, sheetlab, swordlab back mapping | `play.tsx:241-243` (`leaveSubScreen`), `:905`, `:939`, `:976`, `:982`, `:985`, `:987`, `:1000` | BACK |
| Dress "Command Hub" back link | `dress-screen.tsx:231` | LINK |
| Store "Command Hub" back link | `shop-screen.tsx:235` | LINK |
| About back link | `about-screen.tsx:28` | LINK |
| Pet "‹ Hub" (`onBack`) | `pet-screen.tsx:816-828` | DEAD in Street (`display:none`, `:1187`) |
| Defend "‹ Divecore" (`onBackToGrove`) | `defend-screen.tsx:2655-2663` | DEAD in Street (`streetHidden`, `:5096`) |
| Exit the whole of Play: "‹ Exit Play" text in hub scroll | `play.tsx:827-836`, `closePlay :684-691` | LINK |

### Hideout (`pet`)
| Entry point | file:line | Kind |
|---|---|---|
| Tab "Hideout" | `street-shell.tsx:181,250`; `play.tsx:791` | TAB |
| Block big button "Go to the Hideout" / "Feed in the Hideout" | `street-shell.tsx:367` -> `play.tsx:857` | BTN |
| Block pet card (egg/pet figure + meters) | `street-shell.tsx:349-364` | NOT tappable (no Pressable) |
| Dive Back ("< Hideout") -> `leaveSubScreen` returns to `pet` | `dive-hud.tsx:191-194`; `dive-screen.tsx:269,437-441`; `play.tsx:241-243,894` | BACK |
| Banner target `pet` (egg hatched, grade revealed, expedition back) | `play-banner-queue.ts:74,77`; `play.tsx:367-380,1073` | BANNER |
| Banner target `journal` -> Hideout + Info sheet on Journal tab | `play-banner-queue.ts:80,87`; `play.tsx:1074-1077`; `pet-screen.tsx:348-354` | BANNER |
| Settings sheet "Open the Guide" -> Hideout + Info/Guide | `divecore-settings.tsx:245-252`; `play.tsx:1089-1092`; `pet-screen.tsx:391-398` | SHEET |
| Tutorial last card "Open the Guide" | `divecore-tutorial.tsx:61-63`; `play.tsx:1101-1106` | TUT |
| Classic CommandHub tile "Pet" | `neon-viper.ts:90`; `play.tsx:868-870` | DEAD in practice (only while loading) |

### Underground (`dive`)
| Entry point | file:line | Kind |
|---|---|---|
| Block tile "Underground" -> `setMode('dive')` directly | `street-shell.tsx:385-403`; `play.tsx:859` | TILE |
| Hideout "Hatch / Underground" spot (map hotspot, `coach:'dive'`) -> manhole wipe -> `onGoDive` | `assets/art/rooms/hideout/hideout-td.map.json:456-482`; `street-room.tsx:620-655`; `pet-screen.tsx:891,593-597,1155-1167`; `play.tsx:906` | SPOT |
| Hideout dock "Dive" icon | `pet-screen.tsx:139,930` | BTN, only while still an egg (street filter keeps Feed+Info once hatched) |
| Banner target `dive` | `play.tsx:1072` | BANNER; no producer found (queue only emits `pet`/`journal`) |
| Tab bar | none (no Underground tab; Dive has no bars) | -- |
| Classic hub tile | none (`neon-viper.ts:83-87`: "Dive opens from the Pet room") | -- |

### Turf War (`defend`)
| Entry point | file:line | Kind |
|---|---|---|
| Tab "Turf War" | `street-shell.tsx:180,250`; `play.tsx:791` | TAB |
| Block tile "Turf War - Wave N next" | `street-shell.tsx:371-384`; `play.tsx:858` | TILE |
| Blades forge back link (`onBack`) | `play.tsx:996`; `sword-forge-screen.tsx:54` | LINK (label says "Command Hub") |
| Classic tile "Divecore" | `neon-viper.ts:89` | DEAD in practice |

### Locker / Fits (`dress`)
| Entry point | file:line | Kind |
|---|---|---|
| Tab "Locker" always lands on Fits | `street-shell.tsx:182`; `play.tsx:791` | TAB |
| Fits/Blades sub-tab "Fits" | `street-shell.tsx:274`; `play.tsx:923` | BTN |
| Defend hero-offer sheet -> `openDressFromSheet` | `defend-screen.tsx:2167-2171,4667`; `hero-own-sheet.tsx:145`; `play.tsx:972` | SHEET |
| Classic tile "Dress" | `neon-viper.ts:92` | DEAD in practice |

### Blades (`swords`)
| Entry point | file:line | Kind |
|---|---|---|
| Fits/Blades sub-tab "Blades" | `street-shell.tsx:277`; `play.tsx:924` | BTN |
| Defend top-row "Swords" (`onOpenSwords`) | `defend-screen.tsx:2664-2673`; `play.tsx:973` | DEAD in Street (row hidden) |

### Store (`shop`)
| Entry point | file:line | Kind |
|---|---|---|
| Tab "Store" only when `shopUnlocked(devUnlocked)` = PRE_LAUNCH_DEV && dev PIN | `street-shell.tsx:250`; `play.tsx:1054,793`; `neon-viper.ts:98-100` | TAB (hidden for normal players) |
| Classic tile "Shop" (same gate) | `neon-viper.ts:91,103` | DEAD in practice |

### About / Credits (`about`)
| Entry point | file:line | Kind |
|---|---|---|
| Classic tile "More" only | `neon-viper.ts:93` -> `play.tsx:868-870` -> `:984` | ORPHANED: no `setMode('about')` anywhere else (grep). In the Street shell nothing opens it; tab highlight is `null` for it (`play.tsx:777-788`) |

### Dev-only (`sheetlab`, `swordlab`)
| Entry point | file:line |
|---|---|
| `GroveDevKit` buttons via `groveDevKitPanel`: inline in hub scroll and in `PlayDevFab` | `play.tsx:761-768,841,1125` |

### Guide (not a mode; lives in Hideout -> Info -> Guide tab)
| Entry point | file:line |
|---|---|
| Info sheet tab "Guide" (Info = bottom-right dock button in Hideout) | `pet-sheets.tsx:484-494`; `pet-screen.tsx:927-942,1092-1093` |
| "?" `GuideLink` inside Feed, Play, Expedition, Eggs, Stash, Stone, Prism, Journal, Book, Hall, Status sheets | `pet-screen.tsx:951,1003,1048,1052,1056,1078,1083,1088`; `pet-sheets.tsx:394-397,466,589-590` |
| Settings sheet "Open the Guide" (Help section, third from the bottom of a long sheet) | `divecore-settings.tsx:244-253` |
| Tutorial final card | `divecore-tutorial.tsx:61-63` |
| Embedded read-only in Dive Info sheet and Store | `dive-screen.tsx:399`; `shop-screen.tsx:224-229` |

### Duplicates and oddities flagged
- Two settings sheets: Block-only instance (`play.tsx:1081-1093`, mounted only when `mode === 'grove'`) and Hideout instance (`pet-screen.tsx:1058-1066`, reached via Info -> Status -> "Settings" chip, `pet-sheets.tsx:496-505,586`). The Hideout header gear is hidden in Street (`pet-screen.tsx:859`).
- The resource-bar gear (visible on Hideout, Turf War setup, Locker, Store) does not open a sheet in place: it flips to Block first (`play.tsx:1034-1037`), losing the player's place (Turf War setup state included).
- Hideout reachable from Block 2 ways (tab, button); plus 4 indirect (Dive back, 2 banner targets, Guide links).
- Turf War reachable from Block 2 ways (tab, tile).
- Underground has exactly one Block entry (tile) and one Hideout entry (hatch spot), and zero tab-bar presence.
- The Street Hideout top bar is `display:none` (`pet-screen.tsx:816`), which also hides the "The Stash" button (`:837-844`) and the Pet menu "⋯" button (`:845-852`). `setSheet('menu')` has no other caller (grep), so the Pet menu sheet (`pet-screen.tsx:1014-1026`: view card, open Den, Shine Stone, Prism) is unreachable in Street. The Stash is still reachable through the couch spot (`street-room.tsx`, hotspot `chair`, `coach:'den'`). The pet card is reachable through the name plate badge (`pet-room.tsx:1073`).
- Hideout dock in Street keeps only Feed + Info (`pet-screen.tsx:930`), so "Play", "Expedition" and "Dive" exist only as room spots.

## 1b. Back-navigation table

| From mode | Visible back control | Edge swipe (x<=24) | Android hardware back | iOS native swipe |
|---|---|---|---|---|
| Block (`grove`) | "‹ Exit Play" text -> `router.back()` or `replace('/you')` (`play.tsx:684-691,827`) | not wired (`play.tsx:279`) | overlay (tutorial/settings) closes first (`:257-261`), else native pop (`edge-back.ts:54`) | enabled unless settings/tutorial open (`play.tsx:1019`) |
| Hideout (`pet`) | none in Street (top bar hidden, `pet-screen.tsx:816`); use tab bar | Settings sheet -> mini-game -> any sheet -> else Block (`pet-screen.tsx:628-647`, `edge-back.ts:78-81`) | same chain | disabled |
| Underground (`dive`) | "< Hideout" text (`dive-hud.tsx:191-194`) -> wipe -> Hideout (`dive-screen.tsx:269,437-441`) | open Info/Gear sheet closes first, else Hideout (`dive-screen.tsx:148-162`, `edge-back.ts:85-87`) | same | disabled |
| Turf War setup (`defend`) | tab bar; "‹ Divecore" is hidden (`defend-screen.tsx:2655,5096`) | Block (`registerBack` returns false, `defend-screen.tsx:1633-1645`) | Block | disabled |
| Turf War wave running | dock "Leave" -> confirm -> abandon (`defend-screen.tsx:1616-1621,4012`) | OFF (`edge-back.ts:70-73`; ignored `:55`) | opens/closes the same Leave confirm (`edge-back.ts:62-68`) | disabled |
| Turf War result | result "Leave" -> back to SETUP, not Block (`defend-screen.tsx:1652,4245,4303`) | Block | Block | disabled |
| Locker Fits (`dress`) | back link labelled "Command Hub" -> Block (`dress-screen.tsx:231`) | Block | Block | disabled |
| Locker Blades (`swords`) | back link labelled "Command Hub" -> **Turf War** (`play.tsx:996`) | **Block** (`leaveSubScreen`) | **Block** | disabled |
| Store (`shop`) | back link "Command Hub" -> Block; inner Guide view has its own back (`shop-screen.tsx:224-235`) | Block (skips the inner Guide state) | Block | disabled |
| About (`about`) | back link -> Block (`about-screen.tsx:28`) | Block | Block | disabled |
| sheetlab / swordlab (dev) | back -> Block (`play.tsx:987,1000`) | Block | Block | disabled |

Mismatches: Blades back link (Turf War) vs edge/hardware back (Block); every back link in Locker/Store/About/Blades says "Command Hub" (`neon-ui.tsx:50`) though no screen by that name exists in the Street shell; Dive back goes to Hideout even when entered from the Block tile (`play.tsx:241-243`).

## 2. Claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| a | Two shells: Classic CommandHub and Street | **Outdated / mostly refuted.** Classic was retired 2026-10-12; `streetUiOn()` is a constant `true`. CommandHub renders only as the `view == null` loading fallback. The real split is: Street shell (bars) / full-bleed Dive / Turf War run (HUD+dock swap) / dev labs. Dead `streetUiOn() ? ... : ...` branches remain in ~15 files. | `art-skin.ts:10-25`; `street-ui.tsx:3`; `play.tsx:775,849-874`; grep list of `streetUiOn(` |
| b | Block has 3 ways into Hideout (tab, button, pet card) and 2 into Turf War | **Partly refuted.** Hideout: tab + button only; the pet card is a plain `StreetFrame` with no Pressable. Turf War: tab + tile confirmed. | `street-shell.tsx:349-364` (card), `:367` (button), `:371-384` (tile) |
| c | Underground tile opens Dive but Dive's back returns to the Pet room | **Confirmed.** `onUnderground={() => setMode('dive')}`; `leaveSubScreen` maps dive -> pet; the label even reads "< Hideout" / a11y "Back to the Pet room". Stale comment says Dive only opens from the room. | `play.tsx:859,239-243`; `dive-hud.tsx:191-194` |
| d | Same thing, several names | **Confirmed**, list below | below |
| e | Guide reachable only at Pet -> Info -> Guide (+ settings/tutorial) | **Refuted in part.** It is also reachable from "?" links in ~11 Hideout sheets, embedded in Dive Info and in the Store. But the only top-level doors are Hideout Info (bottom-right), the Block-only settings sheet (deep scroll), and the tutorial. Nothing on Block, Turf War or Locker. | section 1a "Guide" |
| f | "‹ Exit Play" is small text in the middle of the hub scroll | **Confirmed.** Text-only (`type small`, `textSecondary`), centered, between the Basecore claim card and the dev kit, inside the scroll. The Pressable itself is ~48pt tall (padding 16) plus hitSlop 12, but only ~75pt wide and visually weak. Est. y 610-660. | `play.tsx:827-836,1670-1673` |
| g | Dev kit (GroveDevKit, DevUnlockRow, TunePanel) renders inline in the hub scroll | **Confirmed.** `hubExtras` is passed as `StreetBlock` children. Gated by `PRE_LAUNCH_DEV` so absent in a public build. Also duplicated in `PlayDevFab`. | `play.tsx:838-841,860,1109-1127` |
| h | tutorialSeen / play_settings migration | see below | below |

### (d) Name variants, player-facing strings

| Concept | Variants and exact strings |
|---|---|
| Hideout | `Hideout` tab `street-shell.tsx:181`; `Go to the Hideout` / `Feed in the Hideout` `:367`; `< Hideout` `dive-hud.tsx:193`; Classic `< Pet` `dive-hud.tsx:193`, `pet-games.tsx:434`; tile `Pet` / `Raise your buddy` `neon-viper.ts:90`; `‹ Hub` `pet-screen.tsx:826`; `Back to the Pet room` `dive-hud.tsx:191`; `Open Pet and choose...` `divecore-tutorial.tsx:17`; `The pet room` `:26`; `Your pet` `street-shell.tsx:355`, `divecore-settings.tsx:191`; `Pet menu` `pet-screen.tsx:849`; `Hideout room finished` `play-settings.ts:34` |
| Stash | `The Stash` / `The Den` `pet-screen.tsx:841,1029`; spot label `Stash` (thing "Couch") map JSON `:425-427`; tab icon is `nav-tab-locker` `pet-screen.tsx:843` |
| Turf War | `Turf War` tab `street-shell.tsx:180`, tile `:381`, title `defend-screen.tsx:2677`; Classic `Defend` `:2677`; `‹ Divecore` `:2661`; tile `Divecore` / `Enter the map` `neon-viper.ts:89`; eyebrow `DIVECORE` `street-shell.tsx:345`; `Divecore settings` `divecore-settings.tsx:157`; `Reset Divecore` `:263`; tutorial title `Divecore` `divecore-tutorial.tsx:36`; `Leave to Defend setup` a11y `defend-screen.tsx:4245`; `Protect the Basecore Path` `:2681`; `Basecore` card `play.tsx:802`; `Win a Defend wave` `sword-forge-screen.tsx:102`; `Claim and Defend` `shop-screen.tsx:355` |
| Underground | `Underground` tile `street-shell.tsx:399`; spot `Underground` (thing "Hatch") map JSON `:479-480`; `Underground · info` / `Dive · info` `dive-screen.tsx:368`; `Dive` dock `pet-screen.tsx:139`; `Dive gear` / `Gear` `dive-screen.tsx:402`, `dive-hud.tsx:213`; `Dive in progress` `street-shell.tsx:400`; `Dive together` `divecore-tutorial.tsx:31`; `Dive charges full` `play-settings.ts:31`; `Charges full` `shop-screen.tsx:166`; `full-pay free dives` `divecore-settings.tsx:240` |
| Locker | `Locker` tab `street-shell.tsx:182`; `Locker · Fits` `dress-screen.tsx:234`; `Locker · Blades` `sword-forge-screen.tsx:56`; Classic `Dress` / `Customize` `neon-viper.ts:92`; `Swords` (Defend row `defend-screen.tsx:2671`); `Wardrobe` `pet-sheets.tsx:703`; `Style` tab `pet-sheets.tsx:490`; back links `Command Hub` `neon-ui.tsx:50` |
| Store | `Store` tab `street-shell.tsx:183`; `Corner Store` title `shop-screen.tsx:238` and comment `street-shell.tsx:9`; Classic `Shop` / `Spend scrap` `neon-viper.ts:91`; sub-tabs `Token shop`, `Tide shelf`, `Paid shop` `shop-screen.tsx:256-258` |
| Currencies | **Caps** (account currency): resource bar `street-shell.tsx:150`, Store `shop-screen.tsx:170,171,244`; the same number is called **tokens** in `pet-screen.tsx:974` (`Build for N tokens`), `hideout-tease.tsx:83,148`, `pet-sheets.tsx:162,330,690,703,846`, `defend-screen.tsx:4120,4185` (`+N tokens`), `divecore-settings.tsx:89`; **scrap**: `hud.tsx:33`, `neon-viper.ts:91`, `coach.ts:61-85` (Classic wording) vs in-run `N caps` `defend-screen.tsx:3969`; **Subway Tokens** (dive charges): `street-shell.tsx:155,391`, `dive-hud.tsx:225`; Underground tile sub `N/10 tokens` `street-shell.tsx:400`; `dive-hud.tsx:226`; `dive-screen.tsx:376`; plus **Mini-game tokens** `divecore-settings.tsx:240`, **Avatar star token** `defend-screen.tsx:3597`, and **shells**, **Shine/Prism Stones** |

Net effect: "tokens" is used for three different things (account Caps, dive Subway Tokens, star tokens) and the Hideout build button says "tokens" where the resource bar shows "Caps".

### (h) tutorialSeen and play_settings

| Item | Where |
|---|---|
| Field `tutorialSeen: boolean` (default `false`), `artSkin: 'streetwear'`, `haptics: true` | `play-settings.ts:49-61,66-77` |
| Stored inside the Play save doc as `play_settings` (default `defaultSettings()`) | `playStore.ts:975,1392` |
| Load/migrate: `parseSettings(data.play_settings, v24 ? null : { remind: data.pet_remind === true, hasProgress: hall.length > 0 \|\| pet.hero != null \|\| lifetimeWaves > 0 })`. Pre-v24 saves ignore stored settings, take hunger reminder from `pet_remind`, and get `tutorialSeen = hasProgress`. v24+ saves read each flag with a default (`tutorialSeen` -> false if missing; unknown `artSkin` (old `cast`) -> `streetwear`; `haptics` -> true). No version bump was needed for `artSkin`/`haptics`. | `playStore.ts:5658-5669`; `play-settings.ts:95-122` |
| Mirrors into module state on every load/commit | `use-play-store.ts:115-116,135-136,198` |
| Reset keeps settings (so tutorial does not replay) | `playStore.ts:2850` |
| Shown when `view != null && (tutorialReplay \|\| !tutorialSeen)` on ANY mode (no mode check), as an overlay that also swallows back (`overlayRef`) | `play.tsx:730-739,1095-1108` |
| Set to true by Skip/Let's go/Back-press and "Open the Guide" | `play.tsx:735,1099,1103`; writer `setPlaySettings` `playStore.ts:2781-2785` |
| `src/play/play-save.ts` has no settings code; migration lives in `playStore.ts` | grep |
| Tutorial copy is stale for the Street shell: says "Open Pet", "Feed, Play, Dive, Expedition and Info are along the bottom" (only Feed + Info remain) | `divecore-tutorial.tsx:17,27` vs `pet-screen.tsx:930` |

Deep links: the only route query is the dev layout frame `?shot=pet|dive|catch|train|play` (+`inset`, `phase`), rendered by `LayoutShot` and not a navigation path (`play.tsx:697-717`). Entry into `/play` otherwise: `nav-more-sheet.tsx:108` (`router.push('/play')`) and the dev hub (`dev-hub-panels.tsx:685`). The whole route redirects when `PRE_LAUNCH_DEV` is false (`play.tsx:693-695`).

## 3. Thumb zones (iPhone 16 Pro Max, estimates)

Layout math used: street column starts after safe top 59. Resource bar = `marginTop 4` + `minHeight 44` -> y 63-107 (`street-shell.tsx:415-424`, `street-feel.ts:55`). Tab bar = `paddingTop 10` + tab (min 48) + `paddingBottom 34` ~ 92 -> y ~840-932 (`street-shell.tsx:429-436`). Street body therefore ~ y 107-840.

### Shell (all Street screens except Dive and Turf War run)
| Control | y (approx) | Zone | Size / note |
|---|---|---|---|
| Resource bar gear | 65-105, x ~364-404 | top | 40x40 + hitSlop 8 = 56 OK (`:428`, `:164`). Far from thumb, right corner. Currency chips non-interactive |
| Tab bar (4 tabs, 102pt wide each; 5 with Store, 82pt) | 850-898 | bottom | >= 48 tall OK; icon-only below width 380 (`STREET_SIZE.compactWidth`) |

### Block hub
| Control | y | Zone | Note |
|---|---|---|---|
| (title plate, pet card) | 107-317 | top | non-interactive |
| "Go to the Hideout" button | ~329-377 | middle | 48 tall OK |
| Turf War tile / Underground tile | ~389-521 | middle | 132 tall each, half-width OK |
| Basecore Claim button | ~550-600, right | middle | ~34 tall -> **<44** (`play.tsx:1689-1695`) |
| "‹ Exit Play" | ~610-660, center | middle/bottom edge | 48 tall x ~75 wide + hitSlop; low emphasis text |
| Dev kit rows / DevUnlockRow / TunePanel | 660+ and scroll | bottom/below fold | PRE_LAUNCH_DEV only |
| Anything interactive in top 120 besides top bar | none | | |

### Hideout (pet room) - tab bar remains; header bar hidden
PetRoom stage ~ y 153-776 (strip 36 high at top is non-interactive). With pt ~ 0.96: room origin top ~153; spot label y = 153 + anchorY * 0.96.
| Control | y | Zone | Note |
|---|---|---|---|
| "Play" spot (Stereo) anchor (288,100) | ~249, x ~330 | top (near border) | hit 48x48 chip, visible face 30 tall OK (`street-room.tsx:849-858`) |
| "Stash" spot (Couch) anchor (160,150) | ~297, x ~185 | top/middle border | 48x48 |
| "Underground" spot (Hatch) anchor (176,476) | ~610, x ~200 | middle/bottom border | 48x48, min width 132 |
| "Explore" spot (Door) anchor (176,546) | ~677, x ~200 | bottom | 48x48 |
| Pet itself, name-plate badge (opens card) | floor ~ y 370-560 | middle | pet tap area `box*0.4` sized; badge small (not measured) |
| Room bar (room switcher + Call), "row" mode | ~712-776 | bottom | 52 tall. Mode is "row" because the side gutter < 64 and ceiling band 38*pt < 44 (`hideout-bar.tsx:25-34`, `pet-room.tsx:490-497`) |
| Dock: Feed, Info | ~776-840 (64 tall, buttons 48) | bottom | `pet-screen.tsx:1212-1226`; sits directly above the tab bar: two button rows stacked |
| Info sheet (bottom sheet <= 85% = 792pt): close X 48x48 at sheet top (y ~140+), tabs row Status / Journal / Book / Hall / Style / Guide (6 + Dev) horizontal scroll; Guide is the 6th | sheet top ~140-190 | top/middle | X is far from the thumb; backdrop tap and drag-down also close (`play-sheet.tsx:60,80,98,177`) |
| Settings sheet from Hideout (via Info -> Status -> Settings) | as above | | |
| Anything interactive in top 120 | none (header hidden) | | |

### Settings sheet (Block)
Bottom sheet up to 85% height; X at its top (y ~140-190, top third, 48x48); chips min 44 high (`neon-ui.tsx:498-505`). Order: Notifications (7 chips), Quiet hours, Your pet, Look and feel, Daily limits, **Help (Open the Guide, Replay the tutorial)**, Reset Divecore. Help is below the fold on a 792pt sheet. Close paths: X, backdrop, drag down, hardware/edge back (`play.tsx:737-738`).

### Underground (Dive)
SafeAreaView with all edges (street shell not drawn): top inset 59.
| Control | y | Zone | Note |
|---|---|---|---|
| "< Hideout" text link | ~71-95, left | top | text ~20 tall + hitSlop 10 = ~40, **<44**, small width (`dive-hud.tsx:191`) |
| "Gear" and "info ›" text links | ~135-155, left | top (just below 120) | PixelBody sm, hitSlop 8 -> ~30-34 tall, **<44** (`:213-218`); street adds a line-map row between rows |
| Shell/charges readouts | | | non-interactive |
| Pre-run: DIVE button (row 1; row 2 is an invisible spacer, `DIVE_DOCK_ROWS`) | ~782-832 | bottom | 50 tall (`dive-screen.tsx:502-503`) |
| Mid-run: Local / Express (row 1) + Head up (row 2) | ~782-832 / ~840-890 | bottom | 50 tall, widths measured; while busy a splash replaces them (`:297-301`) |
| Info / Gear sheets | bottom sheets as above | | |

### Turf War
| Control | y | Zone | Note |
|---|---|---|---|
| Setup: title, lede, board (tap = move Avatar, tap pad = tower UI) | ~120-600 | top/middle | board near full width |
| Setup: "Swords", "‹ Divecore" | hidden | | `streetHidden` |
| Setup: CALL WAVE + speed control | ~650-720 (below board and coach) | bottom, near fold | `defend-screen.tsx:3731-3752`; scroll may be needed |
| Setup: Drops, Maps list, Skip ahead, band replay | scroll below | below fold | |
| Wave: Pause (in HUD slot, replaces resource bar) | ~63-111, right | top | 40x40 + hitSlop 8 = 56 (`defend-screen.tsx:5114`) -> only interactive thing in top 120 |
| Wave: Skill button | ~782-834 | bottom | 52 tall |
| Wave: Pounce / 1x 2x 3x / Leave | ~842-890 | bottom | 48 tall, min width 52, 6pt gap: **Leave sits right next to the speed buttons** (mis-tap risk), but behind a confirm (`:1616-1621`) |
| Leave confirm: "Keep fighting" / "Leave run" | centered | middle | `defend-screen.tsx:4595-4640` |

### Locker Fits / Blades, Store, About
| Control | y | Zone | Note |
|---|---|---|---|
| Fits / Blades sub-tabs (NeonButton 48) | ~123-171 | top (just below the 120 mark) | `street-shell.tsx:270-281`; Locker only |
| Back link ("Command Hub", back art 0.6x + hitSlop 12) | ~180-215 (Fits/Blades), ~123-160 (Store/About) | top | small target, borderline 44 (`neon-ui.tsx:57-70`) |
| Heading, finish picker, hero grid, avatar picker, rows | scroll below | middle/bottom as scrolled | |
| Store filter chips (Token shop / Tide shelf / Paid shop) | ~280-330 | top/middle | 44 high chips |
| Blades is a ScrollView nested in the outer ScrollView | whole screen | | `sword-forge-screen.tsx:53` inside `play.tsx:919`: nested vertical scrollers |

### Tap targets under 44pt (summary)
Dive "< Hideout", "Gear", "info ›"; Basecore Claim button (~34); Classic-only `Command Hub` gear is 36 (`command-hub.tsx:219-227`, dead in Street); back links in Locker/Store/About (borderline); Hideout spot visible face is 30 but hit area is 48 (fine).

## 4. Icons available for tabs

| Piece | Where | Usable for Underground tab? |
|---|---|---|
| `nav-tab-block`, `nav-tab-turf`, `nav-tab-hideout`, `nav-tab-locker`, `nav-tab-store`, `nav-settings` | `src/art/skeletons.ts:62`; `generated-art.ts:2190-2195` | existing 5 tabs only |
| `nav-cur-caps`, `nav-cur-token`, `nav-cur-shine`, `nav-cur-prism` | `skeletons.ts:63` | currency chips |
| `room-underground` (portrait room card, used by the Block tile) | `skeletons.ts:89`; `generated-art.ts:2207`; used `street-shell.tsx:396` | too big/detailed for a 30pt tab icon; fine as a tile |
| `stop-train`, `stop-core`, `stop-ghost`, `stop-platform`, `stop-sewers`, `stop-tunnels` | `skeletons.ts:79` | `stop-train` is a Dive line-map stop piece; check size before using |
| `icon.streetwear.subway-train` (the Hatch spot icon) | `generated-art.ts:94`; `hideout-art.ts:162` | **best existing candidate**: already means "go Underground" in the Hideout; not a `UiPiece`, so it needs `findArt`/`ART.icon.streetwear.subwayTrain` or a new `nav-tab-underground` kit piece (skeleton + `npm run art:sync`, per art rules) |
| `icon.shop.streetwear.dive-charge` | `generated-art.ts:71` | currency/charge icon, not a destination |

No `nav-tab-underground` exists. `nav-tab-locker` is already reused as the Stash icon in the Hideout (`pet-screen.tsx:843`), a second meaning for the Locker glyph.
