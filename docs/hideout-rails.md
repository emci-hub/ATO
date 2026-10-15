# Hideout rails (feature/hideout-rails, 2026-10-14)

Two floating rails over the Hideout room's edges replace every in-room tap spot, its label, its tap rect and
the old Hideout / Loft / Call row above Feed / Info. Play-only. Pure rules: `src/play/hideout-rails-model.ts`.
Drawn by `src/play/hideout-rails.tsx`. Gate: `npm run check:hideout-rails`.

## What is on a rail

| Room | LEFT rail (actions, from the room's map.json hotspots) | Notes |
|---|---|---|
| Hideout | Play · Stash · Underground · Explore | Explore used to sit under the room switcher row. |
| Loft | Sleep · Light · Back | Light toggles the lamp (the lamp has no tap area any more). Sleep = the bed's map action (coach `den`, opens the Stash sheet). |
| Underground room (the "garage") | Back · Up | Back = the hatch (to the Hideout); Up = the next room in the build order (Rooftop), dimmed while it is locked. |

- RIGHT rail: the rooms (Hideout, Loft, Garage, Rooftop as they appear) + Call / Away. The selected room is yellow, the
  room the pet is in carries its marker, locked rooms are dimmed with a lock. Scrolls when there are more than 5 items;
  it is absolutely placed and capped to the stage height, so it never changes a layout.
- Buttons: 60 pt wide and tall, 8 pt gaps, 8 pt from the edge, one-word labels (long ones step down a size).
- **Locked = dimmed, never hidden, and inert.** A locked room (right rail) or a locked way out (Up) opens that room's
  build sheet (the Loft tease sign on the right wall now sits under the rail, so the rail is how you reach it). In a room
  that is not built, everything except Back is dimmed.
- Press effect = the button's own pressed piece + a small squash. The coach pulse (dashed ring) is on the rail button
  (Play / Underground / Explore); under Reduce Motion it is a slower, shallower breathe; only in-game Motion = Off holds it still.
- VoiceOver: every button has a role + label; room buttons are tabs inside a tablist ("Rooms. Pet is in …"), the selected
  one is `selected`; dimmed actions are `disabled`; Underground reads its charges, Explore reads "Away".

## Layout

- The dock is now one row (Feed · Info, 64 pt). `REGIONS.hideout.dock` 120 → 64, so the Hideout stage grows by 56 pt:
  430×932: 563 → 619, 375×667: 365 → 421. The room still covers the stage (cover scale from the width, same pt as the
  hero), so it is taller than the stage on every phone and nothing is stretched or tiled: **no new art needed**.
- The pet's feet stay between `railWalkBounds` (rail width + 8 pt + half its body, in art px) — the walkable grid is
  cut to those columns (`withWalkBounds`), so every planned path, target and the Hideout cushion stay clear. A pet that
  starts under a rail is moved out. The speech bubble is clamped to `[RAIL_CLEAR_PT, stageW − RAIL_CLEAR_PT]`. The egg
  picker is inset the same way. The sleeping Zzz follows the clamped cushion.

## Removed

`StreetRoomSpots`, spot labels + "seen" fade, `chipPressed` (teal `PIXEL.glow` press fill), the cyan ellipses under
objects, the Info "Show labels" switch, `hideout-bar.tsx`, `HideoutStageControls`, the dock's `roomRow`.

## Art list (stand-ins used; nothing invented)

Dedicated 32 px icons for **Sleep** (bed / moon), **Light** (lamp), **Back** (left arrow) and **Up** (up arrow) do not
exist. The rails use library stand-ins: `icon.streetwear.heart` (Sleep), `bolt` (Light), `dpad` (Back), `upgrade` (Up);
Play / Stash / Underground / Explore keep their old icons (headphones, backpack, subway-train, sneaker). Order the four
dedicated icons in PixelLab (guide §2: 32 px ladder) and swap them in `RAIL_ICON_ART` / `ICON_BY_ACTION`.

## Open / decide

- **Sleep opens the Stash** (the map gives the bed `coach: 'den'`). A real "put the pet to bed" action would be new
  behaviour; not built.
- "Up" = Rooftop is my reading of the map's `Up` on the Underground room's door; change `upRoom` if it means something else.
- The Loft tease sign is still painted on the right wall under the rail (art unchanged).

## Polish handoff (fix/hideout-polish, 2026-10-15)

- **LF pins:** every `art:sync` output (`registry.json`, `ART_LIBRARY.md`, `_contact/library*.html`, `generated-art.ts`,
  `tools/art-viewer/README.md`, `legacy-play-sheets.json`, `generated-play-sheets.ts`) is `text eol=lf` in `.gitattributes`.
  A fresh `core.autocrlf=true` clone passes `check:art-registry` on the first run.
- **Holo tip:** a fifth coach tip, `holo` ("Try a holo finish in Info", anchored on the Info dock button), shown once after
  the pet is out of the egg. It defaults to unseen even on saves that finished the old tutorial, so existing players see it once.
- **Retired aura sheets:** `hideout-fx` (blaze-84 / bubbles-outlined) moved to `art-src/archive/2026-10/hideout-fx-retired/`
  (raw + packed). They were packed sheets, not registry entries, so there is no registry status to flip. The pack step,
  the `hideoutFx` skeleton family and the meta key are gone.
- **Sleep: NOT built.** It still opens the Stash. A daytime "put the pet to bed" needs a new saved field (nothing in
  `HideoutState` says "asleep by choice": `asleep` is only derived from low mood or the bedtime window, and
  `wake_until_age_ms` only suppresses it). Proposed: `sleep_until_age_ms` on `HideoutState`, set by Sleep, cleared by a
  second tap / `tapWake` / morning, read by `resolvePresence`. Waiting on emci's ok.
