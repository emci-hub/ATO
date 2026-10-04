# Agents

Read `CLAUDE.md` first — it is the map (commands, hard invariants, where things are).

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
