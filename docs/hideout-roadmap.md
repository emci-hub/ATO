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
| 0b | Polish batch (LF art pins, holo tip, archive hideout-fx, **Sleep action**) | ✔ merged, PR #44 (Sleep: Loft rail puts the pet to bed, `sleep_until_age_ms`; icon still the heart stand-in). OTA `01a1420f` |
| 0c | Dedicated rail icons (Sleep, Light, Back, Up) | ✔ merged, PR #51 (squash `cb77cc37`). OTA `01a14292` |
| 0d | Loft room art (PixelLab, same recipe as the Hideout) | ✔ merged, PR #52 (squash `30a6bbf1`). OTA `01a142bf` (production, iOS, group `96b03172`, commit `6d77ece5`, gate green 167). Not device-verified. **Next: Underground room art (0e)** |
| 0e | Underground (garage) room art (PixelLab, same recipe) | ✔ merged, PR #53 (squash `1473f8b7`). **OTA `01a14302`** (production, iOS, group `c0b4c5d3`, commit `76a195fa`, gate green 167). Not device-verified. **Next: Rooftop art, or a live Garage (see Known)** |
| 0f | Rooftop room art (PixelLab, same recipe, new map) | ✔ merged, PR #54 (squash `75c062b8`). **OTA `01a14322`** (production, iOS, group `21b75ecb`, commit `713827ba`, gate green 167). Not device-verified. **Next: a live Garage / Rooftop (or phone check of both)** |
| 0g | Live Garage + Rooftop (walking pet, Back / Up, rail bounds) | ✔ merged, PR #55 (squash `ab633ef0`). **OTA `01a1444d`** (production, iOS, group `6a7abde4`, commit `c0dd6722`, gate green 167). **Device-verified** (emci, 2026-10-16, second phone check). |
| 0h | Live-room gaps: Call dimmed in unbuilt rooms, Rooftop build reachable, pet re-clamp on room switch, dev "Build all Hideout rooms" | ✔ merged, PR #56 (squash `ae63a1e7`). **OTA `01a144fe`** (production, iOS, group `aabfd2b3`, commit `d8618055`, gate green 167). **Device-verified** (emci, 2026-10-16; dev row: Play dev kit → Tokens / Research → Build all Hideout rooms, two taps). |
| 0i | Phone-check fixes: bubble only in the pet's room, Call says why it can't come, Light / Sleep notes, clamp on every room | ✔ merged, PR #57 (squash `91bde072`). **OTA `01a14590`** (production, iOS, group `a8cc0a68`, commit `5e4b1dfb`, gate green 167). **Device-verified** (emci, 2026-10-16: "all fine"). **Open idea from that check: see "Open items" below (Feed tip / food wording)** |
| 6b | Phone check of Circle visits (two real accounts) | ✔ passed (emci, 2026-10-15) |
| 1 | Foundations: Divecore on in every build, cloud save (wave96), 6 anonymous counters | ✔ OTA `44ebd8b6` (#42, #43) |
| 2 | While you were away card | ✔ OTA `9a94d37f` (#45) |
| 3 | Pet that knows you | ✔ shipped, PR #46, OTA `01a141ef` (`PET_KNOWS_YOU_COPY_REVIEWED = true`) |
| 4 | Daily visitors | ✔ shipped, PR #47, OTA `01a141ef` (`VISITORS_COPY_REVIEWED = true`, emci's edits in) |
| 5 | Decor slots | ✔ shipped, PR #48, OTA `01a141ef` |
| 6 | Circle visits | ✔ shipped, PRs #49 + #50, **wave97 applied** 2026-10-15, OTA `01a141ef` (`CIRCLE_VISITS_COPY_REVIEWED = true`). Phone check with two real accounts still to do |

Steps 3–6 went out as ONE OTA: `production`, iOS, update `01a141ef`, group `ae95adf9`, gate green (167 checks).
wave97 was applied with `supabase db query --linked -f supabase/migrations/wave97_circle_visits.sql` (`db push` skips our
un-timestamped migration files). Reviewer fix before apply: `circle_gift_inbox` also requires a pet hero in the look.

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

## Step 4 as built (daily visitors, plan approved by emci 2026-10-15)
- Files: `src/play/daily-visitors-roster.ts` (12 rotate: kael, kitsune, corvus, neon-viper, archangel, oni, elowen,
  maldrath, cyber-shinobi, raven, frost-lich, sak; stand-ins velkhar, void-raven; tint colours), `daily-visitors.ts`
  (pure rules), `daily-visitors-bank.ts` (84 lines `dv_<hero>_0N`, forever), `daily-visitor-ui.tsx` (room actor, card,
  sticker book). Wiring: `pet-room.tsx` (visitor prop), `pet-screen.tsx` (notice + card on the float layer),
  `pet-sheets.tsx` (sticker book at the top of Info → Style; visitor tints say "From a visitor"),
  `pet-cosmetics.ts` (14 `cos_tint_visit_*`, price null, `source: 'visitor'`), `hideout-progress.ts`
  (`HideoutState.visitors`, tolerant parse, no version bump), `playStore.ts` (`greetDailyVisitor`).
  `npm run check:daily-visitors`. Previews: `docs/divecore/daily-visitors/` (430×932 + 375×667). Copy review:
  `docs/divecore/daily-visitors/review.md`.
- Room-ready = idle AND walk clips packed (14 heroes; aurex and morwen are out). The check rebuilds every kit.
- Rotation: day N = `VISITOR_ROTATION[(N − 2026-10-12) mod 12]`, local date only (offline). A visitor that is your pet's
  own hero is swapped for a stand-in. None while the pet is an egg. Hideout room only, street layout only.
- Rewards: greet 1 sticker, 2 a line, 3 the rare look (a tint you can't buy, never a Dive find), 4+ a visit. One greeting a
  day; a re-tap later shows a line and saves nothing. No tokens / shells / stones / pet tokens move (check compares each
  greeting against the same day without one).
- Stickers: 128×128 die-cut from each hero's `rotations/south` frame (`npm run art:bake-stickers`, no PixelLab credit),
  in the art library as `icon.stickers.streetwear.<hero>` (status `resource`; emci approves in the viewer).
- Save: `hideout.visitors` rides the whole Play doc → wave96 cloud save.
- Screen: visitor stands at art (236, 430), clamped clear of the rails; the pet's walk bounds stop 48 art px to its left
  while it is in (no walking through it). Notice "Visitor · <Name> dropped by." once per day per app open until greeted,
  after the away card. Card = the away card's shape, fixed boxes.
- **Lessons:** (1) the Hideout is the landing screen, so its notice fires within ~250 ms of load — preview scripts must
  poll the lane, not sleep; (2) art:sync's usage scan only sees the full `ART.icon.….x` chain — an alias
  (`const S = ART.icon…`) leaves the art "unused" and moves it to `unused/`; (3) the notice body must fit one SE line
  (≤ 26 chars with the longest name); (4) `touchPet` pays passive daily income, so an economy check has to compare
  against a same-day control, not the start of the run; (5) the pet walks through anything that is not in its walk
  bounds — narrow them for anything that stands in the room (decor in step 5 will need the same), and re-clamp when
  that starts (room switch, Motion Off); (6) `check:away-card` pins pet-screen's `busy` line literally — add new
  overlays through a separate value (`overlayBusy`), never by editing that line; (7) anything "per day" must re-read
  the local day at the tap, not trust the last render (midnight).

## Step 5 as built (decor slots, plan approved by emci 2026-10-15)
- Files: `src/play/decor-slots.ts` (pure: 3 slots, 10 props, parse/set/placement/blocked-geometry), `decor-slots-ui.tsx`
  (placed sprites, tap spots, picker sheet), wiring in `pet-room.tsx` (`decor` prop), `pet-screen.tsx` (picker state +
  float branch), `playStore.ts` (`setHideoutDecor`), `hideout-progress.ts` (`HideoutState.decor`, tolerant parse, no
  version bump). `npm run check:decor-slots`. Previews: `docs/divecore/decor-slots/` (430×932 + 375×667), scale sheet
  `extras-scale.png`.
- Room: only `hideout` has real art, so it is the one room with slots. Slots are 4×2 map cells (64×32 art px) on open
  floor: d1 `[3,25]` (left, below the plant), d2 `[3,16]` (left, under the lamp), d3 `[15,29]` (lower right, below the
  bed). Spot 2 first sat on the right by the stereo and the check proved it cut the boombox spot off for a baby pet, so
  it lives on the left. Every "+" is clear of the rail strips at 375 and 430 (`RAIL_CLEAR_PT + 8`).
- Shelf (free, ids `dc_*` forever): plant, beanbag, side table, floor lamp (the room's own per-prop sprites) + crate,
  boombox, cone, fire barrel, tire stack, trash bags (street set, 64×64 files trimmed to 30–60 px; same size band as the
  room's props, so they pass the scale check). The same prop may stand in several spots. **Nothing is bought, earned or
  priced**; `setHideoutDecor` does not even call `touchPet` (check compares the whole doc minus `hideout.decor`).
- Picker: tap a spot ("+" when empty, the prop when filled) → a card on the **float layer** (the away card's shape; fixed
  boxes; two fixed rows of 56 pt cells; Take away is disabled, not hidden, when the spot is empty; tap a prop = place +
  close; outside tap / Done / Android back close). It waits for the away card and the visitor card and hides under
  Settings; it counts as busy through `overlayBusy` (the `busy` line the away-card check pins is untouched).
- Walk: a filled slot blocks its 8 cells (`decorGeom`); the walk planner gets that geometry through a ref and the loop
  restarts when what is placed changes; a pet standing where a prop lands is moved to the nearest free floor
  (placed / room switch / Motion Off). The check walks a pet 400 steps at both widths with all 3 filled and proves it
  never steps on a slot and every target / hotspot walk-to point is exactly as reachable as before, for every stage.
- Depth: each prop stands on its footprint's bottom edge and sorts against the pet by it (feet above = pet behind),
  drawn before or after the pet like the visitor.
- Save: `hideout.decor` (slot → item) rides the whole Play doc → wave96 cloud save; unknown slots / items are dropped
  on load; works offline.
- **The split, honestly:** the Hideout's baked prop layer, the four occluder images and the neon pulses are **left as
  they are** (the room is byte-identical). The per-prop sprites already existed in the art library
  (`prop.hideout.streetwear.*`, trimmed to the map's rects); what they lack is the soft contact shadow the baked layer
  paints under each prop (rebuilding the layer from sprites alone leaves ~1,000 shadow-edge pixels off by < 25 %). The
  four room props on the shelf therefore have no shadow, and no neon pulse, when you place them. Rebuilding the room
  layers from sprites + per-prop shadow pieces (so the baked copies of plant / beanbag / table / lamp can be swapped
  out too) needs `scripts/hideout-room-art.ts` and a new import of the shadow pieces: not done, and not needed for slots.
- **Lessons:** (1) a slot on the right strip cut the boombox's walk-to point off for a baby pet — the reachability test
  per stage is what found it, keep it for any new blocker; (2) `art:sync`'s usage scan needs the full
  `ART.prop.<set>.<part>` chain (no alias) — it moved the 10 sprites to `in-use/` once the UI named them; (3) `expo
  export` wipes `<out>/play/`, so copy `play.html` to `play/index.html` after every export, not before; (4) the SE
  stage is shorter than the room, so the camera scrolls — the spot "+" lives in the room layer and follows it; (5) the
  check keeps pin regexes for the pet-room wiring (`decorWalkGeomRef`, `p.sortY <= feet.y`); an edit there needs the
  regex updated, not deleted.

## Step 6 as built (Circle visits, plan approved by emci 2026-10-15)
- Two PRs (the play-isolation fence keeps `supabase/**` and `src/play/**` apart):
  - **Server** `feature/circle-visits-server` → `supabase/migrations/wave97_circle_visits.sql` + `check:reset-account`.
    Tables `circle_visit_share` (per-friend switch, default off, written only by `set_circle_visit_share`) and
    `circle_gifts` (one row per giver → friend per giver's local day, unique index; functions only). `circle_visit_allowed`
    = Circle row + no block either way + both switches. `_circle_visit_look` (the one new pattern, emci's OK) reads a
    friend's `play_saves.doc` and returns only `pet{line, hero, stage, shiny}` + `decor{d1..d3: dc_*}`, each value
    shape-checked; no role can call it directly. RPCs: `circle_visit_friends`, `set_circle_visit_share`,
    `circle_visit_room`, `circle_send_gift`, `circle_gift_inbox` (only friends who still share both ways),
    `circle_open_gift`. `reset_my_account` restated from wave90 + both tables wiped both ways; dev reset + count too.
  - **Play** `feature/circle-visits` (stacked on #48): `src/play/circle-visits.ts` (pure: parsers that keep only the look,
    gift book, copy), `circle-visits-store.ts` (the only server file: the 6 RPCs, ids only, never throws; PGRST202 →
    "not switched on yet"), `circle-visits-ui.tsx` (list card, gift card, visiting strip). Wiring: `hideout-rails-model`
    (`kind: 'circle'`, Hideout room only, 5th = the cap), `hideout-rails` (`onCircle`, `hidden`), `hideout-art`
    (library `star` icon), `pet-room` (`circle` prop: a friend's pet at the visitor spot; with `decor` = their room,
    no tap spots), `pet-screen` (state, float branches, notice strip, dock swap, back = home, `hideoutBusy`),
    `hideout-progress` (`HideoutState.circle`, tolerant parse, no version bump), `playStore` (`openCircleGift`),
    sticker book counts Circle stickers. `npm run check:circle-visits` (its wave97 pins run once both PRs are in one tree).
- Gift: the visiting pet's hero sticker (the 14 sticker heroes) or a Circle stamp; counted once per gift id (phone keeps
  the last 60 ids; the server marks it opened). A friend's pet with a gift waits until today's daily visitor got its hello.
- Visiting: from the Hideout room's rail only; the stage shows the Hideout room with THEIR decor (your pet walks around
  it) and their pet at the visitor spot; the rails draw nothing (still mounted, so walk bounds don't jump); the notice
  lane says "@name's Hideout"; the dock's Feed + Info become Leave a gift / Back home; swipes stay put.
- Names: the list shows the @handle your Circle tab already shows (from `me.handle` through the Circle row). Nothing in
  the shared look carries a name.
- Previews: `docs/divecore/circle-visits/` (430×932 + 375×667: 1 gift pet, 2 list, 3 visiting, 4 gift left, 5 gift card),
  made from the static web export with a fake session + mocked wave97 replies in the browser (no account, no network).
- Review (one pass, PASS) fixed: a visit loading after the list closed; unfriend + scan back in now starts both switches
  off (a switch counts only if set after the current Circle row); the inbox filters before its 20 limit; tighter grants.
  Left as known: a friend's pet always draws as its grown hero (stage / shiny cross but are not drawn yet); the inbox
  refreshes on Hideout mount and after a visit, not live; the gift stickers you already got stay after Reset account
  (the Divecore save is kept, by design); `check:circle-visits`' wave97 pins only run once both PRs are in one tree.
- **Before an OTA**: apply wave97 (Supabase SQL editor or `supabase db push`). Until then the phone says "Circle visits
  aren't switched on yet" and everything else works as before.
- **Lessons:** (1) step 5's checks pin source lines literally (`overlayBusy`, `rails={ street ? (`, the
  `setHideoutDecor…resetDivecore` slice): add new values beside them (`hideoutBusy`, a `hidden` prop, a function placed
  before `setHideoutDecor`) instead of editing the pinned line; (2) a server-side pin in a Play check must skip when the
  migration lives on the other PR's branch (`existsSync`, like `check:play-cloud-save`) — test it once by copying the
  migration in temporarily; (3) the reset check takes the NEWEST `reset_my_account` by wave number, so restating it means
  carrying the previous body line for line (the check now compares it with wave90's).

## Step 0b as built (polish + Sleep, emci 2026-10-15 "finish #44")
- PR #44 merged, **OTA `01a1420f`** (production, iOS, group `41ca15b6`, gate green). Sleep: in the Loft the rail's Sleep calls `sleepHideoutPet` (`playStore.ts`) → `tapSleep` /
  `sleepChosen` / `resolvePresence` (`hideout-presence.ts`), saved as `HideoutState.sleep_until_age_ms` (null default,
  tolerant parse, rides the cloud save, cleared by rebirth). Length = `HIDEOUT_WAKE_MS`. A second Sleep tap or a tap on
  the pet wakes it; hunger still pulls the pet to the Hideout. `pet-screen` counts it as `night` for the pose
  (`sleepByChoice`). Cosmetic: no tokens, no economy. Stash still reachable from the Hideout rail and the pet menu.
  Pins: `check:hideout-rooms` (sleep group).
- Known: opening a sheet (Info, Feed) shows the pet awake for as long as it is open (presence `interaction`); the first
  Sleep tap logs no event, the wake does. Icons for Sleep / Light / Back / Up are still stand-ins (next: decor art pass).
- **Lessons:** (1) `check:play-isolation` on a clean tree judges the latest commit, and a GitHub merge commit of a mixed
  PR looks mixed: land a docs-only commit on top of master before `ota:publish`; (2) a branch holding an unpushed merge
  of master fails the check too: push it first; (3) the reviewer caught that `presence.asleep` alone only draws Zzz: the
  bed pose follows `night` in `pet-screen`.

## Step 0c as built (rail icons, emci 2026-10-15)
- PR #51, squash-merged (`cb77cc37`). **OTA `01a14292`** (production, iOS, group `89edf560`, commit `093def18`, gate
  green 167). NOT device-verified. Library check: no bed / moon / lamp / arrow icon existed. One PixelLab
  `create_1_direction_object` pack (64 candidates at 32 px, 10 generations) with 5 rail icons as style refs; emci picked
  Sleep = moon + Zz, Light = yellow table lamp, Back / Up = cyan arrows. Each got the set's 1 px warm-white sticker rim,
  then one joint `reduce_colors` (workbench score 96–100; the old `upgrade` icon scores 83.7). Files:
  `assets/art/icons/in-use/streetwear/{sleep,lamp,arrow-left,arrow-up}.png` → `ART.icon.streetwear.{sleep,lamp,arrowLeft,arrowUp}`
  in `RAIL_ICON_ART` / `ICON_BY_ACTION`; `dpad` stays as the fallback for an unmapped map action. heart / bolt / upgrade
  moved to `icons/unused/` (art:sync, nothing deleted). Raw + `gen.json`: `art-src/pixellab/icon.streetwear.rail/`.
  Sheets + previews: `docs/divecore/rail-icons/`. Gate green (167 checks), reviewer run.
- Known: the 4 registry entries are status `resource` (art:sync's default for icons, same as the rest of the set), no
  22/28 critique yet; the Loft and Underground rooms behind the rails are still greybox art.
- **Lessons:** (1) `check:play-isolation` counts every `docs/**` path as app except `docs/divecore*` and `docs/GOTCHAS.md`:
  put Play sample sheets / previews in `docs/divecore/<step>/`, never `docs/art/` (reviewer caught it); squash-merge so
  master gets one Play + neutral commit; (2) a flat icon needs no `art:import` / `art:pack`: drop the PNG in
  `assets/art/icons/in-use/<set>/`, point the code at it, then `art:sync` (step 4's tested path); (3) never hand-type
  base64 into a PixelLab call: `get_upload_url` + `curl -F` and pass `upload:<id>`; (4) `expo start --web` dies with
  EMFILE while the gate runs in the same checkout: preview after the gate; on web a mouse drag doesn't swipe rooms, so
  set `hideout.rooms_unlocked` / `viewed_room` in `localStorage['ato.play.store.v1']` and reload (put it back after).

## Step 0d as built (Loft room art, emci 2026-10-15)
- Same recipe as the Hideout. Parts in `art-src/pixellab/room.loft.streetwear/gen-20261015-pixellab-1/` (`gen.json` lists every
  tool + id; ~70 generations): `create_building_kit` (dark plum plaster + dark plank floor, same 52×111 frame so the Hideout's
  crops fit), 16 floor variants (`create_tiles_pro`, kit floor as style image), bed (6 tries, emci picked bed 1), nightstand
  (2 tries, picked stand 1), night window + `create_object_state` day window, rug (2 tries; the first was noisy speckle).
  Library check: `prop.loft.bed` / `prop.loft.lamp` are 64×28 / 18×36 iso-era `resource` leftovers (wrong camera and size) →
  **new** art; the lamp is the Hideout's approved lamp + its `lamp-off` state (**reuse**, 22×110 vs the 24×113 table row).
- Scale sheet + samples: `docs/divecore/loft-room/` (`scale-sheet.png`, `samples.png`, `room-states.png` = day / night /
  night + Light on, Kael standing in the room). Bed 50×94 (height on the table's 94, width −18 %), nightstand 28×36 (on the box).
  The map's bed footprint is 64×128 (greybox rule "64×146"), so the bed sprite is shorter than its blocked cells: the pet
  stops ~34 px above the bed top. Not changed (emci asked to keep the map's walk cells and hotspots).
- Map: `loft-td.map.json` keeps every hotspot, walk point, spawn, target, rug and walkable cell. The props'
  sprite / crop rects changed to the real sprite boxes, `placeholder` → false, **the lamp is no longer an occluder**
  (it stands on the back wall where the pet can never be behind it; its lit twin is drawn in the glow layer, above the props,
  and an occluder copy would cover it), and **the lamp moved from col 13 to col 11** (pre-widen coords; its hotspot ellipse
  and label anchor with it, walk point and Light action unchanged). At col 13 it stood under the right rail (rail starts at
  art x ≈ 297) and was invisible; at col 11 about 2 art px of the shade still touch the rail edge. The lamp walk point
  `[296,176]` now sits 8 px right of the lamp's centre (cosmetic).
- Known: at 375×667 the camera scrolls with the pet and the bed (art x 23–73) can sit under the left rail's Light / Back
  buttons; at 430×932 it is clear. The bed sprite (50×94) is shorter than its collision box (64×128), so ~34 px of floor above
  the headboard is blocked but empty. Web previews (dev export) show an unrelated "Cannot read properties of undefined (reading
  'top')" overlay after load, also on the Hideout; dismiss it.
- Light toggle is real now: the props layer holds the dim lamp, `loft-td-glow.png` = warm pool + the lit lamp sprite, drawn
  only at night with the lamp on (existing `street-room.tsx` rule, no code change). Window overlays `loft-td-window-day/night.png`
  are the PixelLab window trimmed and centred on the map's 128×72 box (never stretched).
- Painter: `scripts/hideout-room-art.ts` now takes a room name (`paintHideoutArt(input, 'loft')`, `hideoutArtAvailable('loft')`)
  and optional Loft inputs (window sprites, lit lamp, rim colours, `floorMix` = 70 % base planks, variants within 18 % of the
  base brightness); `gen-hideout-td.ts` has `LOFT_FILES` / `LOFT_FLATS`. Hideout and Underground output is byte-identical
  (`git status` after a rerun shows only `assets/art/rooms/loft/**`).
- Only `art-src/` raw + the 9 room layers + window/glow PNGs are bundled; the individual Loft prop sprites are not separate
  library entries (they are baked into the layers, like the Hideout's room props before step 5). Make them library props if a
  later step wants Loft decor slots.
- **Lessons:** (1) `create_1_direction_object` / `create_map_object` take real base64 for style images, not `upload:<id>`
  (`create_tiles_pro` and `reduce_colors` do take `upload:`), so style-matched props used `create_map_object` with the style card,
  like the Hideout; (2) `create_map_object` drew the first bed side-on: "headboard with a pillow at the top, mattress stretching
  toward the viewer" + `high top-down` fixed it; (3) a prop that must stay visible over the glow layer cannot also be an occluder.

## Step 0e as built (Underground room art, emci 2026-10-15)
- Same recipe. Parts in `art-src/pixellab/room.underground.streetwear/gen-20261015-pixellab-1/` (`gen.json`; ~85 generations):
  `create_building_kit` (dark corrugated steel walls with two cyan neon strips + poured-concrete floor, same 52×111 frame),
  16 concrete floor variants (`create_tiles_pro`, kit floor as style image; 10 dropped: yellow/red paint, white blotches,
  checker noise, flat dark squares — `UNDERGROUND_FLOOR_SKIP`), 2 speakers + 2 hatches (`create_map_object`, low top-down).
  emci picked **speaker B (25×73 vs the 18×71 target), hatch A (64×29 vs 64×32)**, one speaker sprite for both sides.
  Library check: nothing garage-specific existed; the Hideout speaker (23×74, purple) is Hideout-set art, not reused.
- Scale sheet + samples + previews: `docs/divecore/underground-room/` (`scale-sheet.png`, `samples.png`, `room-composite.png`
  with Kael and the rail lines, `max-underground.jpg`, `se-underground.jpg`).
- Map: hotspots (hatch/Back, door/Up), spawns, targets, lights and the hatch cell are unchanged. **The two speakers moved in**
  from cols 1–2 / 19–20 to cols 5–6 / 15–16 (the outer columns sit under both rails at 375 and 430), and the walk notch in rows
  15–16 moves with them because `buildWalkable` derives it from the footprints (`tweakUnderground`). Cols 1–2 / 19–20 are walkable
  again but unreachable (rail bounds). `placeholder` → false. The hatch is a flat on the floor layer; the speakers are occluders;
  a magenta spill under each speaker pulses with neon A/B (`spills` option in `hideout-room-art.ts`). No lamp, no screen glow.
- **The Garage is not a live room.** `hideout-stage.tsx` draws `liveIsHideout` / `liveIsLoft` only; any other room shows a dimmed
  (opacity 0.55) static `SnapshotRoom`. The old "greybox" was really `neighbor-boarded-td.png` (painted from the greybox back).
  So `ROOM_ART.garage` now carries the Underground map + layers and `snapshot` = `ART.room.underground.snapshot`
  (`underground-td-snapshot.png`, a flattened back + floor + neon + props + occluder written by `gen-hideout-td.ts`).
  `neighbor-boarded-td.png` stays for the Rooftop. `UNDERGROUND_ART` in `hideout-art.ts` is dead code (nothing reads it).
- Egg picker: reads on the new room at 430 and 375 (eggs sit above the speakers; the three labels touch the speaker tops, and at
  375 the labels run together / clip under the rail — that was already so on the old shell).
- **Known:** (1) a 1 px bright vertical line just inside both side walls of the snapshot (≈ x 15 and 337, side-cap crop edge),
  muted by the 0.55 dim; (2) all four occluder PNGs are the same file (the painter writes one); (3) making the Garage a live room
  (walking pet, Back / Up, hatch dive) is a separate step: needs a `LiveGarage` in `hideout-stage.tsx`, presence for `garage`,
  and `roomGeom('garage')` is already the Underground map now.
- **Lessons:** (1) check where a room is actually drawn before painting it (`hideout-stage.tsx`): the Garage was a snapshot of a
  shell, not the Underground greybox; (2) `gen-hideout-td.ts`' old `composite()` decoder only reads PNG filter 0 — flatten the
  painter's output with pngjs; (3) `art:sync`'s usage scan needs `ART.room.underground.snapshot` as a full chain, and a file that
  is not a `ROOM_SLOTS` slot is reached through `ART.room.<set>.<name>`, not `ROOM.*`; (4) re-running the generator touches
  `loft-td.map.json` line endings only (CRLF): `git checkout --` it; (5) rails cover art x < ~71 and ≥ ~281 at 375 wide (76 pt
  clear each side) — keep props between them.

## Step 0f as built (Rooftop room art, emci 2026-10-15 "merge everything and ota")
- Same recipe, parts in `art-src/pixellab/room.rooftop.streetwear/gen-20261015-pixellab-1/` (`gen.json`; ~100 generations):
  `create_building_kit` (weathered dark brick stairwell wall, pipe run, two magenta neon strips + dark tar-paper roof, same
  52×111 frame), 16 floor variants (6 kept: f0 f3 f6 f9 f10 f12, `ROOFTOP_FLOOR_SKIP`), AC unit (**D**, 47×65, used twice),
  lawn chair (**C**, 36×54), access hatch (**B**, 59×28, a flat). **Round 1 of ACs (56×57, 53×58) and chairs (28×34, 21×34) was
  12–38 % short of the scale table, so they were regenerated on bigger canvases instead of stretched** (guide §2). Library check:
  nothing rooftop-specific existed. Sheets, samples, composite with Kael + rail lines, previews: `docs/divecore/rooftop-room/`.
- **New map** `assets/art/rooms/rooftop/rooftop-td.map.json` (the Rooftop had none; it borrowed the Loft's): same 352×576 shell;
  one hotspot `hatch` (action `Hideout` = the rail's **Back**, no Up: the Rooftop is last), spawns / targets like the Underground;
  ACs at cols 5–7 and 14–16 (occluders), chair at cols 15–16 rows 25–26, hatch flat at (176, 496). All between the rails at 375
  and 430 (art x ~72–280). `tweakRooftop` sets the post-widen columns; walk cells come from the footprints.
- Wiring: `ROOM_ART.rooftop` = Rooftop map + 9 layers + `snapshot` = `ART.room.rooftop.snapshot` (flattened
  `rooftop-td-snapshot.png`); `RAIL_ROOM_GEOM.rooftop` + `ORDER.rooftop = ['Hideout']` give the Rooftop one Back button (lit even
  while locked, like every room's way out); `art-registry-gen.ts` rows for the 9 layers; `art-categories.ts` `rooftop*` rule;
  `check:hideout-rooms` now walks the Rooftop map (reachable at baby/adult/god), `check:hideout-rails` pins its rail. Hideout,
  Loft and Underground outputs byte-identical. Like the Garage, the Rooftop is still a dimmed static snapshot (not live).
- Egg picker: reads on the new room at 430 and 375 (eggs sit right above the ACs; labels overlap the AC tops; at 375 the labels run
  together and clip under the rail, as on every room).
- **Known:** (1) `check:hideout-rails`' "never walks into a rail" loop covers hideout + loft only, not Garage / Rooftop (reviewer
  checked the Rooftop by hand: sprites x 81–128 / 225–272 / 238–274, all inside 71–281); (2) `neighbor-boarded-td.png` is now only the
  `shell` fallback (still painted from the Underground greybox); (3) the floor shows the kit tile's small repeated mark; (4) a live
  Garage / Rooftop (walking pet, presence) is still a separate step.
- **Lessons:** (1) a brand-new room needs a map JSON, not just layers: the rails read `RAIL_ROOM_GEOM`, `roomGeom()` reads
  `ROOM_ART[id].map`, and `check:hideout-rooms` lists the maps it walks; (2) `writeJson` in `gen-hideout-td.ts` now creates the room
  folder; (3) every regen rewrites `underground-td.map.json` and `loft-td.map.json` with LF (CRLF noise): `git checkout --` both before
  committing; (4) a fresh port is a fresh `localStorage`, so seed the store after the first load, then put it back.

## Step 0g as built (live Garage + Rooftop, emci 2026-10-16: both rooms, pet visits only)
- `hideout-stage.tsx`: `LiveLoft` → `LiveRoom` (`room` prop); `liveRoom = viewed !== 'hideout' && rooms_unlocked[viewed]`; one
  `StreetRoomFront` for every live room. A room still being built stays the dimmed snapshot. Maps' `sleepOnBed` is only on for the Loft;
  Garage / Rooftop have no window or glow art, so `lampOn` does nothing there.
- `hideout-presence.ts`: `visitRoom` = `viewed_room` only if built (or the Hideout). Interaction, expedition and call use it, so the pet
  never stands over an unbuilt room's snapshot (this also covers an unbuilt Loft). The pet does NOT roam, live or sleep in Garage /
  Rooftop on its own (schedule, tired, Sleep stay Hideout / Loft) — decided by emci.
- Rails needed nothing: Back / Up were already wired through `viewed_room` (Garage Up → Rooftop, Rooftop Back only).
- Checks: `check:hideout-rails` walk loop now covers hideout, loft, garage, rooftop (150 steps each) + a stage pin (no `LiveLoft`,
  `rooms_unlocked[viewed]`); `check:hideout-rooms` presence asserts for built / unbuilt garage and rooftop. Gate green (167), reviewer PASS.
- Previews (430x932 and 375x667, pet clear of both rails): `docs/divecore/live-rooms/`.
- **Known:** (1) Call is not dimmed in an unbuilt room: it starts the timer and logs `call_used` but the pet stays home (UX gap);
  (2) `teaseRoom` (`pet-screen.tsx`) and `hideout-tease.tsx` go Loft → Garage only, so the Rooftop's build sheet may be unreachable
  once the Garage is built; (3) when the viewed room changes the walker keeps the previous art x/y until the first planned step
  clamps it (already true for the Loft) — check on a phone; (4) Garage at 375 and pet walking behind the speakers were not
  looked at in the preview.

## Step 0h as built (live-room gaps, emci 2026-10-16)
- **How a normal player reaches the rooms** (investigated): Loft 600 tokens / 2 h, Garage 1200 / 8 h, Rooftop 2000 / 24 h (Play tokens,
  placeholder prices, build time counts only while playing; any ONE gate unlocks). The Garage stays hidden until the Loft is built, the
  Rooftop until the Garage is built. Speed-ups are automatic (deep Dive, first Defend clear: −1 h each, cap 50 %).
- Fixes: (1) `hideout-rails.tsx` Call is dimmed when the viewed room is unbuilt and opens that room's build sheet; `callPetToRoom`
  returns null for an unbuilt room. (2) `nextBuildRoom(h)` in `hideout-progress.ts` (Loft → Garage → Rooftop) drives `HideoutTease` and
  `pet-screen` `teaseRoom`, so the Rooftop build sheet is reachable (before, no UI path could start a Rooftop build, and tapping the
  locked Rooftop opened the Garage sheet). (3) `pet-room.tsx`: an effect keyed on `presence.room` puts the pet on the new room's floor
  (Garage / Rooftop only).
- **Dev tool (emci OK'd, PRE_LAUNCH_DEV + PIN, two taps):** Play dev kit → Tokens / Research → "Build all Hideout rooms"
  (`devBuildAllRooms`): Loft, Garage and Rooftop built on the Play save only, `builds` cleared. No player path.
- Checks: `check:hideout-rooms` pins `nextBuildRoom` + Rooftop tease; `check:hideout-rails` pins Call dim / refuse and the re-clamp effect.
  Gate green (167), reviewer PASS. Previews `docs/divecore/live-rooms/` (`max-rooftop-boarded-sheet.jpg`, `se-garage-live.jpg`).
- **Known (reviewer, all minor):** (1) on a room change the walk loop plans one step from the old x/y before the new effect snaps the pet
  (one still step); (2) the re-clamp skips the Hideout and the Loft (sleepOnBed), same as before; (3) `pressReset` arms without clearing
  the other arm (dev only); (4) `devBuildAllRooms` drops `builds` but a scheduled build notice may still fire (dev only).

## Step 0i as built (first phone check, emci 2026-10-16)
- emci saw: the speech bubble shows in a room the pet is not in; no way to call the pet to a room; Light and Sleep "sometimes don't work".
  The room art itself was fine. emci also approved the three minor Known items from 0h.
- **Bubble:** `pet-room.tsx` `petShown` (the pet-sprite condition) now gates the bubble too; `pet-screen` `petHereRef` silences `say()` when
  `presence.room !== viewed`. Pinned in `check:hideout-rails`.
- **Call:** it was never broken, but it loses to the pet's needs (`resolvePresence`: needs > call > schedule, pinned by `check:hideout-rooms`):
  egg / baby (`skipSchedule`), hunger ≤ 1, tired (mood ≤ 1, Loft built, not woken) or in bed by choice. A blocked call silently did nothing
  (and logged `call_used`). New `callBlocker(pet, hideout)` + `CALL_BLOCK_NOTE` in `hideout-presence.ts` mirror those rules exactly;
  `callPetToRoom` refuses a blocked call; the rail dims Call and a tap shows the reason on the notice strip (`railNote`, 3.5 s,
  restarts on a repeat tap). A call also lasts only 10 min of the pet's counted time (`callStayMs`); after that the schedule decides —
  unchanged, and it leaves you looking at an empty room (emci: left as is).
- **Light / Sleep:** Light only draws after dark and only in the Loft (Garage / Rooftop have no Light or glow art): by day a tap still flips
  the lamp and now says "The Loft light shows after dark." Sleep in the Loft shows a note instead of committing when the pet is away, too
  young or too hungry (it did nothing visible before).
- **Minor items from 0h:** (1) the walk loop clamps the start of every planned step to the room floor (not only decor), so no still step on a
  room change; (2) the room-change effect now covers Hideout and Loft too; (3) `pressReset` clears the other dev arm.
- **Reviewer catch (critical, fixed before merge):** the room-entry clamp first gated on `presence.asleep`; a night call to the Loft has
  `presence.asleep = false` but the pet pose asleep, so the clamp would snap the pet off the bed every step. Both clamps now gate on the pose
  (`asleep` in `pet-room.tsx`) and `check:hideout-rails` pins it.
- Previews `docs/divecore/live-rooms/` (`max-call-blocked-note.jpg`, `se-call-garage.jpg`). Gate green (167), reviewer PASS on the final commit.
- **Known:** (1) a hungry or tired pet cannot be called at all (design: needs > call) — the note says so; (2) `callBlocker` in the UI reads the
  rendered pet while `callPetToRoom` re-reads after `touchPet`, so if hunger ticks to 1 between render and tap, Call looks live and does
  nothing (rare); (3) `devBuildAllRooms` drops `builds` but a scheduled build notice may still fire (dev only).
- **Lessons:** (1) in the browser pane, a `ref` click scrolls a hidden DIV sideways (looks like a half-width layout): reset `scrollLeft` before a
  screenshot; (2) screenshots right after a reload or state change can show the splash or a half-loaded frame — wait, then screenshot twice;
  (3) a clamp or planner gate must use the same signal the planner uses (`mood === 'asleep'`), not presence.

## Open items (from emci's second phone check, 2026-10-16)
- Verdict: **all fine** for steps 0g / 0h / 0i (live Garage + Rooftop, Call notes, bubble, Light / Sleep). Call rules unchanged on purpose
  (emci: keep 10 min of counted time; hungry / tired / baby pets stay home with a note).
- emci's note, verbatim (garbled in transit, **meaning not confirmed, do not guess**): "I think you should movecatch the food” to Feed or move".
  Likely about the **"Feed keeps your pet happy" tip / the food wording near the Feed button** (the tip bubble sits just above Feed at the
  bottom-left of the room, `onTipSeen` / `tipAnchorRef`; in the 430 and 375 previews it overlaps the floor of the room). **First action next
  chat: ask emci once what exactly to move (the tip? the bowl / food hotspot? a word on the Feed button?) and where to.**
- Still-minor Known from 0i: a hungry pet can't be called (design); UI reads the rendered pet vs `callPetToRoom` re-reading after `touchPet`
  (rare); dev `devBuildAllRooms` may leave a scheduled build notice.

## Facts a new chat needs
- Pet lines today: `src/play/pet-talk.ts` (`PET_TALK_LINES` per branch, 15 situations, `pickPetLine`, random, no memory);
  idle timer in `src/play/pet-screen.tsx` (`say()`, `idleTalkDelayMs`, chatter setting).
- Traits: `src/lib/traits.ts` (`TRAIT_AXES`, 0–1 values, `TRAIT_POLE_LINES`, bands low <0.35 / high ≥0.65),
  tracks via `fetchTraitTracks(userId)` in `src/lib/trait-tracks-store.ts` (report vs game track, stability, answerCount).
  Play may import app code (the isolation rule only stops one PR from editing both sides).
- Daily check-in streak: `src/lib/daily-insights/` (`currentStreak`, `isDoneToday`).
- Stored-tip pattern to copy: `src/lib/insight-bank/` (hand-written, ids forever, picked on the phone, `*_COPY_REVIEWED`).
