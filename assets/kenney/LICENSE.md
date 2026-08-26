# Kenney Assets

The pixel sprites in this folder come from free asset packs by Kenney
(https://kenney.nl), licensed under **Creative Commons Zero (CC0 1.0)**.

This means they are free to use in personal, educational, and commercial
projects — no permission or attribution is required (attribution is
appreciated but not mandatory).

## Packs used

- Shape Characters — https://kenney.nl/assets/shape-characters
  - `shape/body/` — character body shapes (circle, rhombus, square, squircle)
  - `shape/face/` — complete faces
  - `shape/hand/` — gesture hands
  - `shape/tab/` — Sage tab mask derived from the same pack

Only packs whose sprites are exported under `assets/kenney/<family>/` and
registered in `KENNEY_REGISTRY` are in use. Other Kenney families mentioned in
the plan (Modular, Toon, 1-Bit, Animal Remastered, Fantasy UI Borders, Monster
Builder) are not bundled yet and must not appear in in-app credits.

Each family folder under `assets/kenney/` is one source. A recipe in the
app composes its layers from exactly one source and never mixes sources within
a single composite.

Full license text: https://creativecommons.org/publicdomain/zero/1.0/
