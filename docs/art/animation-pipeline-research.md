# Animation pipeline research — stable, repeatable hero animation (2026-10-22)

Question (emci): is skeleton-v3 the best we can do, and how do we make animation stable and repeatable for every
future character — do we need to anchor each character's skeleton so it never drifts?

## 1. What drifts today, and why
| Run | Tool | Drift seen |
|---|---|---|
| Kael Idle | `animate_character` template | feet 3–9 px low; otherwise fine (plain silhouette) |
| Morwen Idle | template | robe slimmed, +30 px tall, staff lost on west → rejected |
| Morwen Idle | `animate_character` skeleton-v3 | small: sleeve forward, hem softer, hair flare on one frame |
| Maldrath Idle (east) | skeleton-v3 | chest rig mostly gone, sword lower, cape softer, eye glow dimmer |

Root cause: `animate_character` (template and skeleton-v3) uses a skeleton PixelLab estimates and stores for the
imported character. We **cannot read, edit, lock or reuse that skeleton** through MCP or the API (PixelLab
`search_help`, 2026-10-22), there is **no seed** on the MCP tool, and no reference/mask input. So every run re-guesses
proportions and props, and detail the model does not understand (chest rigs, glow, hem motifs) gets simplified.

## 2. What PixelLab offers that we are not using yet
From the v2 OpenAPI (`https://api.pixellab.ai/v2/openapi.json`) and the editor docs
([Animate with skeleton](https://www.pixellab.ai/docs/tools/animate-with-skeleton), [Re-pose](https://www.pixellab.ai/docs/tools/re-pose)):

| Feature | Where | Why it matters for drift |
|---|---|---|
| `POST /estimate-skeleton` | API only (not an MCP tool) | Returns our sprite's 18 keypoints → an **anchor skeleton per hero**, stored in the repo, corrected once by hand. Sizes 16/32/64/128/256 → pad our 192 sprites to 256. |
| `animate-with-skeleton-v3` | API + MCP (`animate_with_skeleton_v3`) | We send the sprite, its anchor skeleton and **our own per-frame skeletons** (3–15 frames, 3 gens for 4–14). `description` lists held items; `seed` is fixed → repeatable. Feet / prop-hand joints can be pinned exactly. |
| `animate-with-skeleton` (older, "plugin" version) | API only | 3-frame window with **`inpainting_images` + `mask_images`** (white = repaint) and `init_images`, `color_image` (forced palette), `guidance_scale`, `seed`. This is the editor's "freeze frames + inpaint only the part that moves" workflow → props and faces can be frozen. |
| "Fixed head → always" | Editor setting | Copies the reference head into every frame. Via v3 we get the same by keeping head/eye/ear joints constant. |
| Saved skeleton animations | Editor ("Pose - PixelLab" layer) | Motion is reusable across characters — the same idea as a motion library in our repo. |
| `seed`, `color_image` + `force_colors`, `target_palette` on `animate-character` | API only | Repeatable runs; colours locked to the hero's own atlas. |

Access note: the MCP connector already holds the PixelLab token, but `estimate-skeleton` and the older masked
`animate-with-skeleton` are **API-only**. Calling them from scripts needs a `PIXELLAB_API_TOKEN` environment secret
(emci's call; secrets are never printed or committed). Without it, anchor skeletons can be written by hand (18 points
per hero direction) and v3 runs through MCP.

## 3. What other pipelines do (outside PixelLab)
- **Lock the base body, layer the props.** Production pixel pipelines keep one locked base animation and draw
  weapons on their own layer, placed by an anchor/hand point and rotated by hand→elbow angle
  ([Aseprite: character weapons](https://community.aseprite.org/t/character-weapons/4186),
  [Soulbound cosmetic system](https://soulbound.game/news/how-we-built-a-pixel-art-character-and-cosmetic-system/),
  [Toon Boom: anchors](https://docs.toonboom.com/help/harmony-15/premium/gaming/create-anchor.html)).
- **Pose-conditioned generation + a consistency metric.** Research on AI sprite sheets conditions on extracted poses
  and scores subject consistency per frame ([Sprite Sheet Diffusion, arXiv 2412.03685](https://arxiv.org/html/2412.03685v2));
  practitioners use the input character as a structural anchor and **auto-flag frames whose silhouette drifts**
  ([SpriteCook: consistency tips](https://www.spritecook.ai/blog/animating-sprite-sheets-tips-for-consistency)).
- **Idle = the classic 1-pixel breathing shift.** Hand pixel artists shift the upper body 1 px (hair/cape the other
  way), keep feet planted, and play it slowly, ~400–500 ms holds, often ping-pong
  ([sprite-ai: how to animate pixel art](https://www.sprite-ai.art/guides/how-to-animate-pixel-art),
  [itch.io idle tutorial](https://itch.io/t/2489389/pixel-tutorial-hero-idle-animation)). Over-busy idles read as jitter.

## 4. Prototype (free, 0 generations): procedural breathing on Maldrath
`docs/art/animation-tests/maldrath-procedural/`: current Idle · skeleton-v3 · 1-px procedural shift (rows above the
hip line move down 0/1/2/1 px, legs and feet locked; timing 400/250/400/250 ms).
Result: **identity is exact** (crown, chest rig, sword runes, eye glow are the original pixels), feet never move, it
can be rebuilt any time. Limits: no cape sway or head motion by itself; where the cut crosses the sword hand there is
a small kink at the 2-px frame, which a per-part mask (sword moves rigidly with the hand) fixes.

## 5. Recommendation — "anchored rig" pipeline, three tiers
1. **Per hero, once: a rig file in the repo** (`art-src/rigs/<hero>.json`): foot row, hip and shoulder lines,
   anchor skeleton (from `estimate-skeleton` or hand-placed), and part masks (prop, cape, head) per played direction.
2. **Motion recipes in the repo**, character-independent: e.g. `breathing-idle` = per-frame offsets per part
   (torso −1/−2 px, head follows torso, cape lags 1 frame, feet and prop-hand pinned) plus per-frame `ms[]`.
3. **Tier A — procedural (default for Idle and other small loops):** a script applies the recipe to the rotation
   using the rig masks. 0 generations, zero drift, identical every run, works for every future hero the moment its
   rig exists.
4. **Tier B — anchored AI (when real motion is wanted: cape sway, head turn, attacks):** `animate_with_skeleton_v3`
   with the rig's anchor skeleton as `first_frame_keypoints`, recipe-generated `keypoints` (feet/prop joints pinned),
   held items named in `description`, a fixed `seed`. Then a **lock pass**: paste the reference pixels back over the
   locked masks (feet, weapon when it should not move), or repaint only the moving part with the masked
   `animate-with-skeleton`. ~3 generations per direction.
5. **Tier C — `animate_character` template / skeleton-v3:** exploration only, not for shipping.
6. **Automatic gates for every clip** (extend `scripts/animation-audit/`): foot row = rig, height in band, silhouette
   overlap vs the rotation (flag < ~0.9), palette ⊆ hero atlas, prop-mask pixel match, changed px per frame, loop
   seam (last→first). A clip ships only when all pass and emci has seen one contact sheet.
7. **Timing:** move Idle from flat 120 ms to held frames (~250–500 ms), which also clears the audit's "flat timing"
   findings for free.

## 6. Cost
| Path | Per hero Idle (E+W) | 14 heroes |
|---|---|---|
| Tier A procedural | 0 | 0 (rig setup ~minutes/hero, scripted) |
| Tier B anchored skeleton | ~6 (+0 import) | ~84 |
| Today's skeleton-v3 | 6.25 | ~88 |

## 7. Decisions for emci
1. Adopt the anchored-rig pipeline (rigs + recipes + gates) as the standard.
2. Idle via Tier A for all heroes (free) — pilot on Maldrath first, including a sword mask — with Tier B only where
   emci wants visible cape/hair motion.
3. Whether to add a `PIXELLAB_API_TOKEN` environment secret so scripts can call `estimate-skeleton` and the masked
   `animate-with-skeleton` (otherwise anchor skeletons are hand-placed and v3 runs through MCP).
4. Kael and Morwen keep their current (live) AI Idles unless the pilot looks better.
