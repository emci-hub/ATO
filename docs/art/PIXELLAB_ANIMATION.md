# PixelLab animation — what we know, and the pre-flight that keeps it current

Written 2026-10-21 from PixelLab's own help agent (`search_help` on the `pixellab` MCP server) plus the live tool
list. It is a **snapshot**: the tools move. Follow the pre-flight below before every animation job and update this
file when the answers differ. Parent guide: `docs/art/PIXELLAB_GUIDE.md`.

## 0. Pre-flight (every animation task, every new chat — do this BEFORE the first generation)
1. Read `docs/art/PIXELLAB_GUIDE.md` and this file.
2. Confirm the tools are there: the `pixellab` MCP tools must be in your tool list (`animate_character`,
   `animate_image`, …). If you see a 401 "Missing Authorization header", the connector header
   (`Authorization: Bearer <token>`, **No sign-in**) is wrong; tell emci, don't ask for the token.
3. **Learn what changed.** Ask `search_help` about every tool you are about to use (inputs, size/frame limits, cost,
   palette support). Compare with §1–§4 below. If anything differs, update this file in the same change and say so.
   **Also update the art engine's ONE config file, `scripts/art-engine/pixellab.config.json`** (tool names, costs,
   limits, `lastVerified`): engine code never hardcodes a PixelLab fact, so a PixelLab change is a one-file edit
   (`check:art-engine` fails if a tool name creeps into engine code).
   Run `npm run pixellab:watch` when the machine can reach `api.pixellab.ai` (the cloud sandbox cannot: host blocked
   and `tsx` not installed there; use `search_help` instead).
4. `get_balance` and report it. Estimate the cost of the job in generations; ask emci before a batch over ~20
   generations or any Pro call.
5. Do ONE test clip first, show it next to the current one (GIF at 1× and 3×), wait for emci's ok.
6. Log generations per asset (`gen.json`, `docs/art/animation-generation-log.md`).

## 1. Which tool for which job (search_help, 2026-10-21)
| Situation | Tool | Notes |
|---|---|---|
| Character already stored in PixelLab | `animate_character` | `template_animation_id` = 1 generation **per direction**; custom `action_description` (mode `v3`) = `ceil(w×h×frames/65536)`, min 1, 4–16 even frames, defaults to south only |
| Our existing PNG hero/pet (not in PixelLab) | **import first**, then `animate_character` | §2 |
| Loose sprite, one-off motion | `animate_image` | 4–16 **even** frames, ≤256², `last_frame_url` pins the end (use it to make a loop: end pose = start pose). 128²: 6f=2, 8f=2, 16f=3 gens |
| Loose sprite, long clip | `animate_image_pixminimax` | 4–40 frames in **multiples of 4** (no 6f), ≤256². 128²: 4–8f=1, 12–16f=2, 20–24f=3 |
| Exact poses you control | `animate_with_skeleton_v3` | needs an 18-joint skeleton per frame + `first_frame_keypoints`; 3–15 frames; 3f=2, 8f=3, 15f=4 gens; slow (3–6 min). Skeleton ≠ image pose costs transparency and colour accuracy |
| Effects (hit, aura, spark) | `vfx_workbench` (free) first | see guide §8 |
| Cleanup | `pixelart_workbench` (free): `repair`, `clean-lines`, `reoutline`, `selout`, `cluster`, split/join frames | not a timing or baseline-alignment tool |

## 2. Getting our existing sprites into PixelLab (import = 0.25 generations)
`create_character(mode="v3", reference_image_url=<south.png>, n_directions=4|8, direction_images={east, north, west, …})`
- The south image must face **straight at the camera** (a 3/4 turn offsets every direction label).
- Every `direction_images` entry must match the reference canvas size and the direction in its key. Supply all of
  them and nothing is generated: **0.25 generations**. Missing directions are generated at normal v3 cost.
- Reference ≤ 256×256 (ours are 128). Returns a `character_id`; check `get_character` for its available animations.
- Our streetwear heroes have 8 rotations (`art-src/pixellab/hero.<slug>.streetwear/`); use those raw frames, never
  the packed sheets.

## 3. `animate_character` humanoid template ids (current)
`breathing-idle`, `walking-4-frames`, `walking-6-frames`, `walking-8-frames`, `running-4/6/8-frames`, `slashing`,
`slashing-2`, `thrusting`, `shooting`, `casting`, `jumping`, `hurt`, `dying`, `blocking`, `dashing`, `rolling`,
`backstep-dodge`, `spinning-attack`, `charging`, `hook-and-uppercut`, `two-hand-overhead-slash`,
`staff-spin-attack`, `bow-draw-and-release`, `emote-celebrate`, `emote-thinking`, `waving`, `clapping`, `idle-long`,
`crouching-idle/walk`, `eating-drinking`, `sitting`, `pick-up`, `flying-idle/moving`, `carrying-idle/walk`, and more.
Quadrupeds use different names — read them from `get_character`.

Standard-set mapping for ATO (our brief → template): breathing idle → `breathing-idle`; fight-stance idle → custom
(`idle-long` or a custom v3 clip); walk → `walking-6-frames`; run → `running-8-frames`; attack →
`hook-and-uppercut` (cross-punch) or `slashing`; special → `casting`/`shooting`; hit → `hurt`; death → `dying`;
victory → `emote-celebrate`. Pet blink/eat/sleep/happy: `eating-drinking`, `idle-long`, `emote-celebrate`, else custom.

## 4. Limits and traps
- **No per-frame timing** parameter: timing lives in our library (`ms[]`).
- **No baseline/foot lock:** keep the canvas fixed, then check every frame's foot row (`scripts/animation-audit/`).
- **Palette — heroes (emci 2026-10-22): do NOT reduce to `palette-streetwear-night.png`.** The streetwear heroes
  were drawn outside it (Kael: 0 of his Idle pixels are in it) and reducing shifts them (charcoal → brown,
  red → orange). Keep the template output's colours; it already matches the hero. Only if a colour cap is needed
  (the hero's core atlas must stay ≤256 colours to pack as PNG-8; above that the packer writes RGBA, larger but
  lossless), snap the new frames to the hero's **own** atlas colours. Props, tiles and other new art still follow
  the guide's streetwear-night step.
- **Palette — tool params:** the help agent says animation tools take `palette` / `palette_name` / `max_colors`; the
  older guide note says `target_palette`. Untested on ATO; don't pass a palette on hero clips (see above).
- Templates move the stored character rather than redrawing it, so they keep identity but can look gentle.
- Cost reality: one template × 4 directions = 4 generations. A full 8-clip hero set ≈ 32 generations + 0.25 import.
- Source of truth for costs is `get_balance` before/after; fractions (0.05–0.25) are billed for small steps.

## 4b. Standard: replacing a streetwear hero's Idle (proven on Kael, 2026-10-22)
In play, hero Idle packs **east and west only** (`SW_DIRS` in `scripts/art-dirs.ts`), 4 frames, timing from the
library (`ms[]`, 120 ms). So a hero Idle costs ~2 generations + 0.25 import.
1. Pre-flight (§0): `search_help` on `create_character` / `animate_character`, `get_balance`.
2. Check the south rotation faces the camera (`art-src/pixellab/hero.<slug>.streetwear/migrated/raw/rotations/`;
   heroes are 192×192).
3. Upload `south` + `east`/`north`/`west` with `get_upload_url` (one curl each), then
   `create_character(mode="v3", n_directions=4, reference_image_url=<south>, direction_images={east,north,west})`
   = **0.25**.
4. `animate_character(mode="template", template_animation_id="breathing-idle", directions=["east","west"])` =
   1 generation per direction at 192². Download frames from the backblaze URLs in `get_character`.
5. **No palette reduction** (§4). Compare to the current Idle: 1×/3× GIFs, heights (101–111 px band), and
   changed-pixels per frame (more and more even = better; watch the 3× for flicker). Show emci, wait for ok.
6. On ok: `git mv` the old `migrated/raw/animations/Idle` to
   `art-src/archive/2026-10/hero.<slug>.streetwear-Idle-pre-breathing-<date>/`; write the new frames to
   `migrated/raw/animations/Idle/<dir>/frame_00N.png`, each frame shifted vertically so its **lowest pixel sits on
   the old Idle's foot row** (x unchanged). Keep the raw PixelLab output in the gen folder **outside `raw/`**
   (e.g. `<gen>/pixellab-out/`), or the packer packs it as an extra clip.
7. `cargo install oxipng --locked` if missing (else disk sizes drift), then
   `npx tsx scripts/art-pack.ts --id hero_<slug>_streetwear`, `npm run art:sync`, `npm run anim:library`.
   `check:art-registry` "hero frame gold" fails until the pack runs (atlas vs source) — expected.
8. `npm run check:ota-gate`, log in `animation-generation-log.md` and the gen folder's `gen.json`
   (`installed` block), commit, push. Never publish an OTA; emci checks on the phone.

## 4c. Concept stills and rig choice (search_help, 2026-10-24)
- One 128x128 concept still: `create_image_pro_flash` = 6 gens (64x64 = 5), one `style_image` (outline/shading/detail on, `color_palette`
  off so colours come from the prompt); `create_image_pro` with `reference_images` = 10 gens (Pro). `create_image_pixflux` and
  `create_map_object` = 1 gen but take no style reference. A style image must fit the target canvas: crop the 192 hero sprite to its tight box.
- Rigs: `animate_with_skeleton_v3` is COCO-18 only (no extra bones); body templates are mannequin, bear, cat, dog, horse, lion. Use
  `mannequin` for bipedal mechs; quadruped templates only for real four-legged movement. Extra limbs (blade fans) have no rig: repair after animating.

## 5. Change log
- 2026-10-28 (Quests PHASE-15, 64 px heroes/NPCs) — `search_help` + receipts: a v3 import of a south sprite with `n_directions=4` and no `direction_images` bills **1 gen** (not 2); `breathing-idle` template at an 88 px canvas = 1 gen per direction; a custom v3 4-frame clip at 64-124 px canvas = 1 gen (frames come back with the reference as frame 0, so 5 files; the canvas grows to 84-124). `create_character` mode v3 has NO palette input (only `pro` does). Odd widths are refused (195 -> 194). `create_image_pro` 16x16 returns 64 candidates for 10 gens (`get_image` then `download?index=N`); 64x64 returns 16. `vfx_workbench` fits its own tiny canvas and gave unusable specks for a 32x32 sparkle: drew VFX procedurally. The 4-direction character `download` zip holds `Idle/animations/<name>/<dir>/frame_NNN.png`, easier than per-frame URLs. Snapping hero/NPC frames to a palette by nearest RGB colour dulls them; nearest colour in CIELAB keeps the hue and was used for Quests (art-src/quests/tools/snap-palette.py, originals kept beside the snapped copies). Streetwear heroes still skip the snap (§4).
- 2026-10-26 (M3 heroes 4-5, Hush Bot + Gearbreaker) — no PixelLab change (same 2-gen sketch import, 4 gens per 8-frame custom clip at a 160-172 px canvas, 3 per walk direction). A small hero (about 100 px) gets a 160 px canvas, a big one 172 px. Both imports ran in parallel with the other hero's clips; the job cap is 10, so the last Hurt had to wait. `animation_group_id` must be a real UUID (a placeholder is refused before billing). Heroes whose side view hides a cape/prop need `"parts": {}` in the rig; the engine accepts that.
- 2026-10-26 (M3 Kabuki Gear pre-flight) — `search_help` still quotes the sketch import at 3 gens, but the receipt charged **2** again (same as Zipline Shade); trust the receipt. Everything else unchanged. 10 jobs is the concurrency cap (the 11th submit returns "0 job slots available"); queue the last one after `wait_for_jobs`. Prompts with 'always facing left/right, strict side profile, never turns to the camera' kept all 8 east/west Attack/Dash/Hurt clips side-on; only Skill (two arms spread) opens toward the camera.
- 2026-10-25 (M3 Zipline Shade pre-flight) — `search_help`: reference import of a sketch with no `direction_images` bills **2 gens** (4 directions), not the 0.25 of a full `direction_images` import. `get_upload_url` + `curl -F file=@x.png` returns `upload:<id>` (3 days), pass it as `reference_image_url` (the old "https URL" wording is stale). Custom v3 at a 128 import = 168-172 px canvas: 8 frames = 4 gens, 6 frames = 3. Backblaze frame URLs need a User-Agent header (plain urllib gets 403). A custom clip with no "always facing / strict side profile" turns to the camera (Zipline Shade Attack/Skill/Hurt east first rolls); re-roll with that wording fixes it. Config updated: `scripts/art-engine/pixellab.config.json`.
- 2026-10-25 (M3 Kabuto pre-flight) — `search_help`: no change since 10-24. skeleton-v3 = 3 gens per direction for 4-14 frames at any canvas (receipt confirmed). Two template-id lists exist: `search_help` names (slashing, thrusting, casting, hurt, dashing...) vs the ones `get_character` lists for a skeleton-v3 character (cross-punch, lead-jab, fireball, taking-punch, running-slide, running-6-frames, hurricane-kick, throw-object...); use the `get_character` list, there is NO slashing/thrusting there. Output canvas for a 128 import is 176x176. `wait_for_jobs` takes no arguments (waits for all). Test: Kabuto Attack east with `cross-punch` lost the nodachi in 4 of 6 frames (see plan M3a).
- 2026-10-24 (M1 mecha sketches) — five south-facing 128 sketches cost 30 gens (6 each, ~5 min each when 5 run at once); see 4c.
- 2026-10-21 — first version. Balance at the time: 3,538 / 5,000 generations (Tier 2, resets 2026-11-11).
- 2026-10-21 (Task B pre-flight) — kael's stored rotations (`art-src/pixellab/hero.kael.streetwear/migrated/raw/rotations/`) are **192×192**, not 128, and south faces the camera (import-valid). At a ~180 px canvas `breathing-idle` (4 frames) bills ~2 per direction (get_character receipt gives the exact ceiling), so 4 directions ≈ 8, not 4. Cloud sandbox: `api.pixellab.ai` is denied by the network policy (curl uploads fail with 403), and the MCP result downloads need the same host. Ask emci to allow it under the environment's Network access (Allowed domains), or run Task B from a machine that reaches it.
- 2026-10-21 (Task B result) — import of 192² rotations = 0.25; `breathing-idle` template at 192² = **1 generation per direction** (the 2-batch ceiling was not reached), 4 frames. `reduce_colors` takes ≤512×512 px per call → 4 frames of 192² per call (one call per direction). Findings: (1) `palette-streetwear-night.png` is **not Kael's palette** (0 of his Idle pixels are in it); reducing to it turns the charcoal jacket brown and red blood orange. Do not reduce Kael to it without emci's decision (alternatives: skip, or `palette_image` = Kael's own Idle colours). (2) Template clips do not hold the foot line: feet land 3 (south), 9 (east/west), 6 (north) px below the current Idle (rows 149/150/147), so a per-direction anchor shift is needed. (3) Heights 97–111 px vs current 104–107 (guide band 101–111); south 97 is slightly short. Comparison GIFs: `docs/art/animation-tests/kael-breathing-idle/` (reduced) and `…/unreduced/`.
- 2026-10-22 — heroes skip the streetwear-night reduction (§4, emci); Kael's Idle swap recorded as the standard (§4b).
- 2026-10-22 (Morwen test) — the `breathing-idle` template is **not safe for every hero**. Kael (plain silhouette) kept identity; Morwen (big hat, staff, flared robe) came back without the staff, with a slim plain robe and 27–30 px taller. §4b step 5 therefore needs an **identity gate** before any swap: compare the 1×/3× against the current Idle for held props, robe/hair shape and height (101–111 px band); if identity drifts, try `mode="skeleton-v3"` (2–4 generations per direction, "moves the character instead of redrawing it") on one direction, or keep the current Idle. Cost reality for 192²: import 0.25 + 1 per direction (Morwen east+west = 2.25).
- 2026-10-22 (Morwen skeleton-v3 east) — `mode="skeleton-v3"` fixes what the plain template broke: **3 generations per direction** at 192² (not 2–4 range guess; receipt said 3), 4 frames, ~8 min in a busy queue. East came back at the current Idle's height (105 px), feet on the old foot row (150, no shift needed), identity kept (hat, hair, robe flare/trim); drift to judge: sleeve reaches forward-low, hem motifs softer. Correction to the note above: in the **east** view the staff is hidden behind her body in the current art too, so it is not a loss there; the template's east failure was the slim robe + 30 px extra height (the staff loss was the **west** clip). So for props/robes: try skeleton-v3 first (3 gen/dir), template only for plain silhouettes. Hero Idle with skeleton-v3 = 0.25 + 3 per direction, east+west ≈ 6.25.
- 2026-10-22 — Morwen's Idle swapped to skeleton-v3 breathing-idle (east+west, 6 generations + 0.25 import for the whole test incl. the rejected template run = 8.25 total spent). Install notes: skeleton-v3 clips came back with the lowest pixel already on the old foot row, so no shift was needed (still verify per frame); the old Idle folder also held north/south frames, which play never packs for Idle and now live only in the archive.
- 2026-10-22 (Maldrath) — **skeleton-v3 needs the import to be fully finished.** Submitting it while `create_character` (import) was still processing failed with "has no stored 3D skeleton" (not charged). Wait for `get_character` status `completed` (about 40 s), then submit. (§4b: add this wait between steps 3 and 4 for skeleton-v3; the plain template can be queued immediately.) Heavily equipped heroes drift more: Maldrath east lost most of the chest vest/pouch rig and the sword hangs lower, so identity must be judged at 4× per detail (props, rig, glow), not only silhouette.
