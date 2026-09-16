# Agents

Read `CLAUDE.md` first — it is the map (commands, hard invariants, where things are).

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
