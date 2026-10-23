# Agents

Read `CLAUDE.md` first — it is the map (commands, hard invariants, where things are).

**Before any PixelLab animation or art generation:** run the pre-flight in `docs/art/PIXELLAB_ANIMATION.md` §0 (relearn the tools with `search_help`, update the doc, `get_balance`, one test clip, log generations).

**Active approved plan:** `docs/PLAN_PART_D.md` (Divecore Den, egg pacing, Legendary pity,
Shine Stones — approved, not built). If you were asked to build it, follow that file.
**Part E:** `docs/PLAN_PART_E.md` (Tide Pass, Tide shelf, Prism Stones you pick, login
streak, reminders — approved; no real money in this build, T-E8 payments stays gated).
Built on this branch (save v28), not shipped, no OTA. It sits on Part D.

**Element swords (save v29):** mix, merge, undo, drops, hero attack, tower aura.
Config is `src/play/data/swords.json`. Logic is `src/play/swords.ts`. Combat is
`src/play/sword-combat.ts`. The Supabase table is not applied — Play progress
is still the local save. `src/play/data/sword-ledger.sql` is the RLS + claim/merge
RPC to copy into `supabase/migrations` when that bag moves server-side. Not shipped, no OTA.

**Pet finishes (save v30):** holo and reverse holo, picked per pet, never rolled.
Config is `src/play/data/finishes.json`. Logic is `src/play/finishes.ts`. Paint is
`src/play/finish-foil.tsx`. Classic stays the only earnable shiny. The sprite is
never tinted. Not shipped, no OTA.

**Pet auras (save v32):** Blaze, Spiky, Rune, Bubbles. Bought per style. A pet
wears any combination. Each worn aura matches the sword or a picked element
colour (free). Config is `src/play/data/auras.json`. Frames are generated from
the pet alpha in `src/play/auras.ts` and drawn by `src/play/aura-view.tsx`.
Not shipped, no OTA.

This repo is on **Expo SDK 54** (`package.json`). Read the versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing Expo code; do not assume a newer
SDK's API.

## Play is a fenced mini-app

Play / Divecore is isolated from the app. A task is **EITHER Play work OR app
work** — never both in one commit.

- **Play paths:** `src/play/**`, `assets/play/**`, `games/grove/**`,
  `scripts/play-art-prep.ts`, `scripts/check-{heroes,creeps,towers}.ts`.
- **App/Soft/Zen must NOT touch** any Play path; **Play must NOT touch** the app
  (only exception: `src/app/play.tsx` shell + the LF-only `library.md` fix).
- `npm run check:play-isolation` (wired into `check:ota-gate`) fails any
  changeset that mixes the two. Full rule: `.cursor/rules/play-isolation.mdc`.

**Airport (2026-09-16, commit `8fa16a3`):** 16 heroes — Batch 1 (Corvus,
Archangel, Oni, Aurex, Kitsune) + Batch 2/3 ingested — all owned as Dress Avatar
and Bound Boss via `PLAY_EVERYTHING_FREE`; path cast unchanged (Girl/Wizard/Knight
+ Oni/Archangel enemies); `INFERNA` + `masterpiece_premium_*` skipped. Premium is
parked — everything free until the owner returns. CastActor slot masks: avatar =
idle/walk/dash/attack/skill/hurt, path = idle/walk/death, tower = idle/attack/skill.

## Art library (mandatory for any art work)
1. Library first. Before creating, generating or placing ANY image/animation, search
   assets/art/registry.json (and ART_LIBRARY.md / _contact sheets) by type, theme, placement, tags.
2. Reuse before create. If an approved or candidate asset fits (same camera, theme, placement, scale), use it.
   Variants (colour/state) are new entries with `replaces`/`tags`, not copies.
3. Create in PixelLab first. Follow the pixellab-workflow skill: grey blockout at our camera
   (3/4 low top-down, td-3q-low), locked streetwear palette, reference images from the registry.
   Hand work only for cleanup or after 3 failed PixelLab tries. Log every generation.
4. Import, never drop files. Bring raw output in with `npm run art:import -- --from … --id …`
   (saves prompt/seed/params to art-src/pixellab/<id>/<gen>/gen.json), then `npm run art:pack -- --id …`.
   Never commit raw frames or PixelLab exports under assets/; raw lives only in art-src/.
   New art goes in `assets/art/<category>/in-use/<set>/<variant>/` or
   `…/unused/<set>/<variant>/` (art:registry recomputes `inUse` + `usedBy` +
   `set`/`variant` and moves the file). Viewer is one card per set. Categories:
   `heroes/<slug>/<skin-set>/` (pets + characters), `enemies-bosses/<slug>/<skin-set>/`,
   `ui/` (buttons, frames, bars, panels, kit), `icons/` (items, currency, stats, tabs),
   `rooms/<room>/` (live Hideout packs stay here — equivalent in-use), `rooms/unused/`,
   `props/` (furniture/decor by room or theme), `tiles/`, `fx/`, `backgrounds/`, `branding/`.
   `misc/` is last resort (aim ~0). Classify by what the file is, not the old folder.
5. Register. Every bundled file has a registry entry: id, category, inUse, type, theme (streetwear default), placement,
   camera, heroRelativeHeight (vs final hero, 53 art px), footprintTiles (12px), sortY/occluder,
   clips (dirs/frames/ms), palette, status, critiqueScore, source, genCount, tags.
6. Style rules. One camera for everything (perspective guide): tops + fronts, no side faces, light from
   top-left, shadow down-right, footprint = collision, tall props get occluders. Props are sized to the
   FINAL hero and never scale with evolution stage. Streetwear palette only; ≤256 colours per sheet.
7. Critique gate. Score with pixel-art-critique; ≥22/28 with no zero before status can leave `candidate`.
   Only emci sets `approved`.
8. Code names art through the skeletons (src/art/skeletons.ts), never a typed-out id or sheet path: ROOM.<room>.<slot>, SHEET.<hero|enemy|tower|fx|aura|hideoutFx>.<item>.<slot>, SHEET.ui['<piece>'] / SHEET.sword.<tier> / SHEET.board, HERO.<hero>.<slot>, or ART.<kind>.<set>... for anything else; findArt({...}) from src/art. Art that fits no skeleton slot stops art:sync. Ids are clean (<kind>.<set>[.<variant>][.<part>]); old ids still resolve via ART_ALIASES. check:art-registry fails on id strings. No direct require() of image paths.
9. Off-style art (kenney, craftpix, scribble, primal, dungeon-legends, classic) is `needs-restyle`:
   don't place it in new streetwear screens; regenerate in PixelLab with `replaces`. Never auto-filter/restyle.
10. After any art add/remove/usage change: `npm run art:sync` and commit the
    result. Never hand-edit generated files (`registry.json`, `generated-art.ts`,
    `ART_LIBRARY.md`, `_contact/`, `tools/art-viewer/README.md`). The viewer is
    the source of truth for what's implemented. `check:art-registry --fresh`
    (in `check:ota-gate`) fails if they are stale. A pre-commit hook runs
    `art:sync` when staged files touch art. Never delete art; archive it
    (status archived, files to art-src/archive/).
