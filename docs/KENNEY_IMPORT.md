# KENNEY_IMPORT.md — onboarding a new Kenney pack

Repeatable checklist for adding a Kenney pack to the generic pipeline. A new
pack = extract native parts → measure anchors → run prep → write manifest.
No renderer code changes.

Current state: **Shape Characters** is migrated and is the live Pixel family.
**Monster Builder** is not yet migrated (its old ad-hoc rendering was removed
in the swap; existing monster recipes fall back to the default shape look).

---

## 0. Prep work (once, per pack)

1. Download the pack's zip and extract it somewhere outside the repo (the app
   never reads the raw folder — only `scripts/kenney-prep.ts` does).
2. In `src/lib/kenney/manifests/<family>.ts`, declare the family manifest
   (see the schema in `src/lib/kenney/types.ts`). Everything below feeds it.

## 1. Extract native parts (into the manifest)

- Look in the pack's `PNG/` (and/or `Spritesheet/` + atlas XML) for the part
  sprites. The manifest's `parts[].states` must list **only states the pack
  actually ships** — never invent states that don't exist in the assets.
- Record each sprite's **size in body-box units** (fraction of the body box
  side). The body sprite is `1.0 × 1.0`. Source sizes: atlas XML for
  spritesheets, or read the PNG dimensions.
- If the pack ships multiple **color variants** (Shape Characters has
  blue/green/pink/purple/red/yellow), record each one's representative RGB in
  `colorVariants`. Measure it from the pack's own PNG (dominant opaque color),
  don't guess.
- If a part has a non-standard raw filename (e.g. Shape Characters' yellow
  hands are `hand_yellow_*` while all others are `<color>_hand_*`), set the
  state's `raw` override.

## 2. Measure anchors (into the manifest)

The skeleton is measured the same way the original Stage-3 anchors were:

- **Sizes** come from the pack's atlas XML / PNGs (above).
- **Part placement** is expressed as the part's centre in body-box fractions
  (`x`, `y`) plus a `scale` multiplier, relative to the body box.
- **Body-dependent placement**: if a part's placement depends on which body
  shape is active (hands sit outside the silhouette edge, which differs per
  shape), declare it on the body state's `places` map instead of the part's own
  `instances`. That is how the renderer stays family-agnostic.
- Compute the composite **`canvas`** in body-box units from the outermost
  placements (hands reach outside the body box), like `SHAPE_CANVAS` did.

## 3. Run the prep script

```bash
npm run prep:kenney -- --family <family> --source <path-to-raw-pack>
```

- Re-exports every declared part × state × variant into
  `assets/kenney/<family>/<part>/`, nearest-neighbor scaled to the fixed
  target resolution.
- Target: `TARGET_BODY_PX = 675` in `scripts/kenney-prep.ts`. Derived from the
  app's largest render context — the Share poster renders the face at 200pt,
  × 3 (max pixel density) = 600, × 1.125 (the 1080-wide poster capture
  upscale) = 675. **Verify this number against the app's actual largest
  context before assuming it's still right.**
- Regenerates `src/lib/kenney/generated-assets.ts` (the Metro asset registry).
  It must be re-run whenever the manifest or target changes.

## 4. Register the family

- Add the manifest to `KENNEY_REGISTRY` in `src/lib/kenney/registry.ts`.
- Add the pack page URL to `PACK_PAGES` in `src/lib/kenney/credits.ts`. You-tab Credits is generated from the registry; a registered family with no URL throws.
- Add `check:kenney` verification coverage if the pack adds new behavior.

## 5. Done

```bash
npm run check:kenney   # manifest ↔ assets, variants, migration, resolution
npx tsc --noEmit
npx eslint src
npx expo export --platform web
```

Then confirm on the three real render contexts (all three, not one):
nav companion (`PixelFace` in `nav-pixel.tsx`), Circle card (`size=72`), Around
faces (`size=36`, `animated={false}`) — crisp, correct color, no tint-flattening.
The You-tab poster is identity + QR only (no pixel).
