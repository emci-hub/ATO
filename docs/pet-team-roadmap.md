# Pet team roadmap (one hero, everywhere)

Status: **APPROVED by emci 2026-10-18** ("approve the pet team roadmap as written: rules 1-7, save v34 rewrite,
PixelLab spend for P3, one OTA per step"). Don't re-ask. One chat per step; this doc holds the state.

## Progress

- **P1 built 2026-10-18** (commit `03412ad9`): `src/play/pet-merge.ts`, `foldDuplicatePets` + reveal-ack hook +
  parse fold in `playStore.ts`, "joined up" line in `pet-screen.tsx`, `check:pet-merge`. Deviation from the plan
  text: the save version stays **33** (no v34). The fold reads and writes v33 fields only, so a phone on an older
  bundle can still open the save. **OTA published 2026-10-18**: iOS `01a14e59-30dc-7103-b021-1f2b22114068`,
  Android `01a14e59-30dc-7cf2-81eb-2ca4b2fb2b8b`, group `5ce4fbf7-6c69-43b0-8522-f6cc5ce7d21f` (message
  `pet-team-p1-merge`, commit `16080d2a`). Gate green, reviewer pass (shiny double count fixed). Phone check:
  `docs/ATO_DEVICE_TESTS.md` Box 43 (not done yet).
- **P2 built 2026-10-18** (commit `988966b9`): one badge, `src/play/pet-status-badge.tsx` (data from
  `src/play/pet-status-view.ts`; `pet-status.ts` is the care status, a different thing). Five star slots (filled =
  hero copies) + grade-colour frame + grade word + ✨. Used on the Den tile (stars only), the Den card (full) and the
  Hideout name tag (`StreetStatusStrip`, full). 3★ dye rule untouched. Fixed regions unchanged (strip stays one
  36 px row; the grade word is what shrinks on a narrow phone). Not touched: the legacy non-street nameplate in
  `pet-room.tsx`; the Turf picker (P5 will use `PetStatusBadge` there). `check:pet-status-badge`. Gate green,
  reviewer pass. **OTA published 2026-10-18**: iOS `01a14e69-01ce-729d-b914-e014f7e437f8`, Android
  `01a14e69-01ce-702f-89c2-8af3aab11326`, group `f5093f5e-f020-4825-8e28-e88a41e6d0cd` (message
  `pet-team-p2-status-badge`). Phone check: Box 44 (not done; watch the Hideout strip width on a Legendary shiny).
- **P3 built 2026-10-18** (art commit `231b80c2`). The "7 holes" were **Cast-skin only**: Streetwear (the one
  live skin) already had idle/walk/dash/attack/skill/hurt for all 16 heroes, so they were reuse (0 gens). New: a
  7-frame **Faint** (east/west) for all 16 Streetwear heroes, PixelLab skeleton-v3 `falling-back-death`, padded to
  the 192 cell (head on the idle head, lowest pixel on the idle feet line), colours snapped to each combat atlas.
  emci approved the Kael sample + scale sheet first (`docs/art/faint-sample-kael.png`,
  `docs/art/scale-sheet-faint-kael.png`). Raw + gen.json: `art-src/pixellab/hero.<slug>.streetwear/faint-20261018/`.
  Critique 23/28 (Velkhar, Archangel 22; no zero). Workbench score 75.7, the same as the approved hurt clips (75.6),
  so the guide's 90 is not met by any hero clip. Velkhar + Oni were re-rolled once; Archangel's last east frame
  holds frame 5 (hand fix). 108 gens used (16 × 6 + 2 re-rolls), 3,668 left. Code: `HERO.<slug>.faint` slot
  (`skeletons.ts`, art only, played from P5); `art-pack` packs a clip from a later generation folder. Faint lives in
  each combat atlas (+~25% on disk with oxipng, which emci okayed installing). Victory clip **skipped** (3 of 16
  needed a fix; not "smooth"). Gate green, reviewer pass. **OTA published 2026-10-18**: iOS
  `01a14ea9-1dbe-74fc-921d-6319dcbe447f`, Android `01a14ea9-1dbe-78cf-9325-b5c082056a01`, group
  `0259d81a-13df-443a-b4f1-58ac328c70f9` (message `pet-team-p3-faint`, commit `9260912c`; 16 new assets). Phone
  check: Box 45 (art regression only; faint is not played yet).
- **P4 built 2026-10-18** (commit `f420f208`). Leader = the active pet. `normalizedAvatarHeroId` now returns the
  revealed active pet's hero (egg/baby: the stored Avatar, corvus by default; a hero bound as a tower never
  leads), so Turf (`defend-screen.tsx`) and the view pick it up with no screen change. **Save stays v33.** One
  additive field `leader_folded` (a save without it = not folded yet). `foldAvatarIntoPets` runs once in
  `parsePlayStore` after the P1 fold: a chosen Avatar (not corvus, one of the 16 egg heroes) is found in the Den,
  taken from a Collection copy, or hatched at Child (grade = its best, takes over one copy so stars don't double),
  then made active via the same `activateDenPet` swap; the old active pet rests (Den slots grow). With an egg or
  baby on the stage the hero is added to the Den but the stage is left alone; waits (retries next load) mid-dive,
  away or while a reveal is to play. Afterwards the stored Avatar goes back to corvus, so an older bundle that
  drops the flag cannot swap again. Campaign band clears (Oni w5, Archangel w10) now also add an egg copy (a star)
  via `addToBook`. `heroOwned` / `ownedHeroIdsOf` count pet-book heroes, `setAvatarHero` / `ownHero` list the hero
  in `owned_hero_ids` (older bundles keep working). Dress and the hero sheet drop the manual Avatar pick while a
  pet leads (`view.leaderFromPet`). `check:pet-leader` (10 groups); `check:pet-merge` parse pin updated to the new
  line. Gate green, reviewer pass (one persistence bug fixed). **OTA published 2026-10-18**: iOS
  `01a14ff4-ec73-78f3-9afd-e6f87c881b0a`, Android `01a14ff4-ec73-7399-a5e7-cc83def6bce5`, group
  `a7b286d0-6b98-4a7a-bbe9-c0fc4fe5a462` (message `pet-team-p4-leader`). Phone check: Box 46 (not done).
  **Open for emci's call:** (1) every campaign band clear adds a copy, including later cycles, so Oni / Archangel
  can reach 5★ by clearing (rule 5 says "instead of" the Avatar grant; this is the plain reading); (2) heroes you
  hold only as pets can now be bound as Bound Boss towers (they count as owned); (3) a player who had Oni as
  Avatar and never owned an Oni pet now has Oni as a 1★ Child pet.
  **Next: P5 (Turf team of 3).**
- **P5 built 2026-10-18** (commit `47c6ccdb`). emci approved the plan + balance numbers first. Team = leader + 2
  helpers. Picker: a **Team** card inside the Turf War Setup sheet body (`src/play/turf-team-card.tsx`,
  `PetStatusBadge` 'strip'); slots fill in order; no bar or the board changes size (new pin in `check:fixed-regions`).
  Eligible: Child+ revealed pets, not the leader's hero, not a hero bound as a tower (`turfCandidates`). Lanes:
  helpers stand still off the road (≥ 7.5 from its centre line) and off pads (≥ 6); a drop snaps (`snapHelperSpot`);
  a new pick stands 10.5 off the road beside the leader (in reach, outside a boss's 8). Tap a helper on the board,
  then tap where it goes (or "Move" in the card). Sim (`defend.ts`): `DefendLive.helpers`, `placeTurfTeam` at Call
  wave, helper loop inside `stepDefendLive` (hero kit via `fireKit`, base 13, range 15, kit cooldown; ultimate
  every 16 s, first at 16 s, only for skill-clip heroes). Stars +6% per star above 1 (leader too, `leaderStars`
  bucket); rare = +1 pounce per fight (`petPounceSpare`, any rare on the team, back on Retry); epic +10% range
  (leader too); legendary helper hits splash 30% within 4. A boss within 8 knocks a helper out for the wave
  (`HERO.<slug>.faint` plays and holds, dimmed, "… is down · Back next wave" notice); Retry / next wave stand it up.
  **Save stays v33**: one additive field `turf_helpers` ({uid,x,y}[], `parseTurfHelpers`). 60 fps: no new interval;
  helpers ride the one sim step + the existing clip tick (headless step avg ~0.02 ms). `check:turf-team` (11 groups).
  Gate green (172), reviewer PASS (3 small fixes applied: setup draw snapped per board, slots fill in order, ultimate
  timing pinned). Web preview stops at sign-in, so the screen is not seen yet. **OTA published 2026-10-18**: iOS
  `01a15019-56c6-7495-9a1a-d51c15ebc067`, Android `01a15019-56c6-79c5-98fc-44b8059560ca`, group
  `701796e5-5697-4e79-b2e0-76649bca88f2` (message `pet-team-p5-turf-team`). Phone check: Box 47 (incl. 60 fps and
  Larger Text, not done). **Notes for emci (tune in P6 if wanted):** a helper dropped right beside the road
  (7.5–8) is always knocked out by a passing boss — that is the risk/reward; the default spot (10.5) is safe.
  Legendary splash is the normal hit only (not the ultimate) and shows no extra numbers. Pet pounce is still the
  pet's button (rule 6 "becomes the leader's skill" is unchanged in play: the leader IS the active pet now).
  **Next: P5b (one AI helper), then P6.**
- **P5b agreed 2026-10-18** (emci: "I agree with all", plus "I don't want the helper to die"). Replaces the P5 helper
  rules; build in its own chat, show the plan + numbers before building. **One helper** (not 2). It **follows the
  leader** (stays within a short leash, ~15 units) and inside that leash **steps toward its own target, boss first**
  (only onto the road while chasing a boss). It **casts its own hero skill** on a cooldown (`heroCastSkill`, the same
  skill that hero has as leader). Attack ≈ 20 (was 13 for two helpers). Stars + grade perks unchanged. **It never
  dies — dazed instead**: a boss swings about every 5 s at units within 8; a dazed helper plays the faint clip, stays
  down 4 s, gets up (faint played in reverse, no new art), runs back to the leader, then 6 s where it can't be dazed
  again. Normal creeps never daze it. (Softer fallback if emci prefers: a boss hit only pushes it back, attack ≈ 17.)
  Removed from P5: the 2nd slot and the tap-to-place helper spots. Save stays v33 (`turf_helpers` keeps 1 pick).
  60 fps: the helper's movement must ride an existing ticker (no new setState interval).
- **P5b built 2026-10-18** (commit `bb21c3c7`). emci approved the plan + numbers first. **One helper**
  (`TURF_HELPER_SLOTS = 1`); the 2nd slot, tap-to-place spots and Move are gone. Numbers (`turf-team.ts`): leash 15,
  follow spot 6 beside the leader (off road and pads; `helperFollowSpot`), walk 40 u/s, run back 50; chase
  `pickHelperChase` = foes within leash + range of the leader, boss first, then nearest; `helperGoal` closes to 6 on
  a boss (the only time it may use the road), to 80% of range on anything else, never past the leash. Attack 20,
  range 15. Its own hero skill (`heroCastSkill`, via a shared `veilPuffs` with the leader's `castSlowPulse`) first at
  6 s, then every 14 s, only with a foe in the veil, star power scales its damage; this replaced P5's 16 s fireKit
  ultimate. **Never dies:** a boss within 8 swings every 5 s (`swingMs`, counts only while a boss is near); a hit
  dazes it (`dazedMs` 4 s, faint clip), then `getUpMs` 0.6 s (faint reversed, `castActorGetUpFrame`, no new art),
  then it runs back to the leader and is daze-proof 6 s. Creeps never daze it. Stars / grade perks unchanged.
  **60 fps:** still 8 intervals in the screen (pinned). Setup: the existing 33 ms move loop walks it after the
  leader. Wave: the sim owns its position and every sim tick glides shared values linearly over 100 ms on the UI
  thread. Walk / faint / get-up frames ride the existing 50 ms clip tick (frame-key only). The helper is now an
  Animated overlay like the leader (no longer in the board SVG); `resolveTurfHelperKit` keeps the hero walk clip.
  **Save stays v33** (`turf_helpers` 1 pick; an old 2-pick save reads as its first; the stored x/y are unused).
  Lanes note: on Neon Maze a few leader spots sit in a "road knot" with no off-road point within 15; there the
  follow spot is the nearest legal spot, up to 25 away (lanes win over the leash; 24 of 3042 grid spots, none on ato).
  `check:turf-team` rewritten (14 groups). Gate green (172), reviewer PASS (fixed after review: follow spot was on
  the road in rare spots, get-up timing at 2×, restored dropped asserts). Web preview stops at sign-in, so the screen
  is not seen yet. **OTA published 2026-10-18**: iOS `01a150b9-e81c-74e0-96f4-f8f6799321ea`, Android
  `01a150b9-e81c-70bd-9ba6-337d87e1b3c6`, group `7362dc82-7b50-43c0-a1b4-93978603bd94` (message
  `pet-team-p5b-one-ai-helper`). Phone check: **Box 48** (replaces Box 47's helper lines; incl. 60 fps and Larger
  Text, not done). **Notes for emci (tune in P6 if wanted):** with a boss parked beside it, the next daze comes
  ~10 s after it stands (6 s proof + the 5 s swing timer restarting); the boss chase closing to 6 is what makes
  dazes happen at all (8 is the swing reach).
  **Next: P6.**
- **P6 built 2026-10-18** (commit `1c02adb1`). emci approved the plan ("go and accept all recommendations") and
  asked that the helper can wear gear too. **Gear is per hero:** the scout found gear sat on the 5 elemental Legend
  records (`AvatarRecord.equipped`), not on heroes or pets, so "the matching hero" had to be defined. New additive v33
  fields `hero_gear` (4 slots per hero), `gear_moved`, `locker_hero_id` (no version bump). One-time move on load
  (`foldGearIntoHeroes`, waits for P4's leader fold): the active Legend's worn gear → the Turf leader's hero; every
  other Legend's gear → the bag (a Legend has no hero, no guessed mapping); a taken slot keeps the hero's item and
  bags the older one; Legend records end empty; total owned unchanged. Equip / unequip / merge / dev overgear act on
  the **dressed hero** (`lockerHeroIdOf`: saved pick if owned or still wearing gear, else the leader); all four
  owned/worn counters include `hero_gear`. View: `statSums` = dressed hero, `leaderStatSums` feeds the Turf board
  buckets (the leader's gear boosts the whole board as before), `helperStatSums` → `gearPower` scales only the
  helper's hits and skill (×1 floor, on top of the board multiplier and stars; no nerf for an ungeared helper);
  Gear Score and dive luck read the leader's gear. Locker: a **Dress which hero?** chip row (leader and helper first,
  `worn/4` each). Hideout: a **GEAR n/4** chip in the name-tag row (fixed 18 px inside the one 36 px row, shrinks
  before the star badge). Balance table: `docs/locker-per-hero-balance.md`. P5b notes looked at and left as is
  (Neon Maze road-knot follow spots, boss re-daze ~10 s). `check:locker-per-hero` (6 groups). Gate green (173),
  reviewer PASS (fixed after review: the move now waits for the leader fold, gear on a no-longer-owned hero can be
  taken off, chip yields width to the badge, two missing tests added). Web preview stops at sign-in, so the screen is
  not seen yet. **OTA published 2026-10-18**: iOS `01a150e7-cd04-779d-9a0c-4e5f87da71c5`, Android
  `01a150e7-cd04-7368-953b-c5c12c57fe26`, group `8e7b7015-1e84-4d52-8985-c3bf7638000e` (message
  `pet-team-p6-per-hero-locker`). Phone check: **Box 49** (not done). **Known risk (accepted):** a phone still on an
  older bundle that re-saves a migrated save drops `hero_gear` and those worn items would vanish; every phone gets the
  update on reopen. **Plan complete after P6** (P1-P6 + P5b built).
- **Phone checks 2026-10-18:** emci reported "all passed" for Boxes 44-49 (status badge, faint art, leader = pet,
  Turf team, one AI helper incl. 60 fps + Larger Text, per-hero Locker). Nothing failed; no fixes needed. The pet
  team plan is **done**. Box 43 (P1, egg duplicates) was not part of that report.

## The idea in one line

A pet *is* a hero (it already is in code: the 16 egg heroes are the hero roster). Make that one record the
only truth: you hatch it, it lives in the Hideout, duplicates power it up instead of making a second copy,
its stars and grade show everywhere, and it fights in Turf War next to you, wearing the gear you give it
in the Locker.

## What is true today (scouted 2026-10-18)

- **Pets = heroes.** 16 hero ids sit in the egg pools (`src/play/pet-eggs.ts:46-50`). But the game also keeps
  a separate hero list for the Avatar (`owned_hero_ids`, default corvus, `playStore.ts:1383`).
- **Duplicates already stack, but only as a number.** Each duplicate is a full new pet in the Den; the hero
  book counts `copies` → `heroStars` (max 5, `pet-eggs.ts:446`). Stars only unlock a dye at 3.
- **Grade (common → legendary) and shiny are looks only** (`pet-eggs.ts:14`). Stage and branch already change
  play (pounce damage, dive perks, trip length).
- **Turf War** uses the pet only as a once-a-wave "Pet pounce" button (`defend.ts:1306`). The Avatar is a real
  fighter on the board (`defend-screen.tsx:2874`); heroes can also be bound as towers (2 per board).
- **Locker gear** (weapon / armor / cloak / trinket, `items.ts:20`) is saved on the Avatar, not the pet. Swords
  are stat + colour items; no weapon is drawn in a hand anywhere.
- **Animations:** heroes have idle, walk, dash, attack, skill, hurt (east/west). Missing: **no faint/KO and no
  victory clip on any hero**, plus 7 holes (aurex idle + walk, morwen walk, oni / sak / elowen hurt,
  elowen + frost-lich dash). Towers (ghost, lux, viper) have idle / attack / skill: enough, nothing needed.
  The 9 `pet.*` animal sprites are off-style (primal) with no clips: not used.

## What good games do (why this shape)

- **Duplicates → stars** (AFK Arena ascension, Genshin constellations, Clash Royale card levels): a repeat is
  never "wasted", it is progress on the one you love. Players keep one of each and chase stars.
- **Gear on the character, not the account** (most hero collectors): the Locker becomes "dress this hero",
  and what you see in the Hideout is what fights.
- **Small team, big choice** (Clash Royale deck, Kingdom Rush heroes): leader + 2 helpers is enough to make
  choosing matter without crowding a phone board.

## Recommended rules

1. **One of each hero.** An egg that rolls a hero you own merges into it: +1 copy, grade becomes the better
   of the two, shiny is kept if either was shiny. Reveal: "Kael ★★ → ★★★". A new hero still hatches as a new pet.
2. **Existing duplicates fold in** on first load of the new save (v34): one pet per hero kept (the active one,
   else the highest stage), the rest become copies. Their care stage is not lost: the kept one takes the best stage.
3. **Stars and grade now matter, gently.** Stars (1–5) add power to that hero in Turf War
   (proposal: +6% per star above 1, so 5★ = +24%). Grade gives one small perk (rare: +1 pounce charge per run,
   epic: +10% range, legendary: helper shot splashes). Shiny stays looks only. Exact numbers in a balance table,
   tuned in step 6.
4. **Status is shown in one place style, everywhere:** a star row + grade colour frame on the Den card, the
   Hideout name tag, the Turf team picker and the board unit.
5. **Your active pet is your leader.** The Turf Avatar becomes the active pet (no separate Avatar hero list);
   hero clears that used to grant an Avatar hero grant an egg copy of that hero instead.
6. **Turf team = leader + 2 helpers** chosen from your pets at setup. Any pet from Child stage up can help
   (egg/baby stay home). Helpers stand where you drop them, auto-attack with their hero kit, and can be
   knocked out for the wave by bosses (faint clip), back next wave. Pet pounce becomes the leader's skill.
7. **Locker = per-hero loadout.** Gear moves from the Avatar to each hero (4 slots, same items); gear stats apply
   to that hero in Turf; the Hideout shows a small gear badge. Swords keep tinting the aura. **Drawn weapons in
   hands are NOT in this plan** (16 heroes × every clip × every weapon is a huge art job); badge + aura colour
   instead. Can be a later plan once the team plays well.

## Steps (one chat each, one OTA each, phone check after each)

| # | Step | Done when |
|---|---|---|
| P1 | **Merge duplicates.** Hero book is the one record; egg dupes merge (+copy, best grade, shiny kept); save v34 folds existing Den duplicates; star-up reveal. | New dupe never adds a Den pet; an old save with 2 Kaels loads as 1 Kael with +1 copy and best stage/grade; nothing lost (copies, shards, finishes, auras kept on the kept pet); `check:pet-merge` green; gate green. |
| P2 | **Show status everywhere.** Star row + grade frame on Den card, Hideout name tag, (later) Turf picker; dye at 3★ kept. | Same badge component in all spots; fixed-regions unchanged; `check:pet-status-badge`. |
| P3 | **Animation fill (PixelLab).** Fill the 7 holes, then one faint clip per hero (16, east/west, skeleton-v3, 192 canvas). Victory clip optional, only if faint goes well. Samples + scale sheet to emci before any batch. | All 16 heroes have idle/walk/attack/hurt/faint; registry + `art:sync` committed; critique ≥22/28; emci approved the samples. |
| P4 | **Leader = active pet.** Avatar list folds into the pet book; hero clears grant a copy; Turf leader drawn from the active pet. | Old saves keep their chosen Avatar as a pet (hatched if missing); `check:play-cloud-save` + new pins green. |
| P5 | **Turf team of 3.** Setup picker (2 helper slots inside the setup body, no bar resized, new fixed-regions pin); helpers on board with kits, stars/grade bonuses, faint on boss hit. | A wave with 3 heroes plays at 60 fps on the board; helpers respect lanes; `check:fixed-regions` + `check:turf-team` green; Larger Text pass. |
| P5b | **One AI helper.** 1 helper follows the leader, chases its target (boss first) inside a leash, casts its own hero skill; never dies (4 s daze from a boss swing, 6 s daze-proof after). | Helper follows + chases + casts on the board at 60 fps; never lost for a wave; `check:turf-team` updated; fixed-regions + Larger Text pass. |
| P6 | **Per-hero Locker.** Gear moves from Avatar records to each hero; Locker opens on a hero; gear stats apply in Turf; gear badge in Hideout. Balance table tuned. | Old equipped gear lands on the matching hero (none lost); `check:locker-per-hero`; balance doc written. |

## Needs emci's yes (the one approval)

- Rules 1–7 above (especially: **auto-merge with no "keep as new" choice**, and Den slots freeing up).
- **Save change**: Play save v34 rewrites existing saves on load (merges duplicate pets, moves gear). This
  alters existing save data, so it needs your ok. It's all in the one Divecore save doc (`play_saves`, no SQL, no new table).
- **PixelLab spend** for P3 (≈ 7 hole clips + 16 faint clips; samples first).
- **6 OTAs**, one per step, via `npm run ota:publish`, each followed by your phone check box.

## Open / later

- Drawn weapons in hands (separate plan).
- Victory clip (only if P3 goes smoothly).
- 4-role compact chip (from Turf War) only if a 4-role wave is planned.
