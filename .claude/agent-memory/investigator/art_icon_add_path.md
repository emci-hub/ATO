---
name: art-icon-add-path
description: How flat icons enter the art library (step 4 stickers precedent): drop PNG + art:sync, no import/pack
metadata:
  type: reference
---

Step 4 (commit 18a30965) wrote PNGs straight to assets/art/icons/in-use/<set>/<variant>/<name>.png (script scripts/art-bake-visitor-stickers.ts), then `npm run art:sync`. No art:import/pack. art-registry-gen.ts guess() (line ~144) gives icons: type icon, hud, flat-ui, status resource, source pixellab. ART key = camelCase of file name (generated-art.ts, art-registry-gen.ts:305). Unused icons get moved to icons/unused/ by sync, so edit the code that names ART.icon.* BEFORE running sync. heart/bolt/dpad/upgrade used only by src/play/hideout-art.ts:171-174.
