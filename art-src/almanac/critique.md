# Almanac art critique (PHASE-11g) — status: NOT FINISHED, waiting for emci

Honest state of the gates (emci OKs the sheets before import, so nothing is registered yet):

| Gate | Result |
|---|---|
| Workbench score >= 90 | Measured on the 12 edge sprigs (after retries: 85.5 -> replaced by a new gen at 98.8; the other 11 are 91.2 to 100) and the test pumpkin (98.3). NOT yet measured on the 66 stickers, badges, emblems, decor (visual check only). |
| Pixel-art rubric >= 22/28, no zero | NOT scored in writing yet. I judged by eye from the sheets; scoring is the first job after emci's OK on the look. |
| Size ladder | 32 for decor/stickers/badges/emblems, 64 for sprigs and loops, 192x256 frames (UI). |
| Palette | Forced per-asset palette (4 confirmed neutrals + season/event accent, all colours from palette-streetwear-night.png). All 78 PNGs: <= 16 colours, no semi-transparent pixels (checked by script). |
| No text in the art | Checked by eye on the sheets; none seen. |
| Scale sheet vs hero | Not needed yet: nothing here is a world object (all flat/camera-neutral). 11h decides placement. |

Weakest, in my view (say if you want a redo): sprig.summer (busy), sticker.month04 umbrella (noisy), sticker.full_moon / half_year (fine but plain), the new egg decor (bright stripes, simple).
Deviations: lantern "sway" is a lantern glow pulse (the workbench has no sway part); loops are 64x64 with some particles crossing the edge on purpose (ambient layer); the fireworks loop is a one-shot (plays once, 16 frames); month glyphs are hemisphere-neutral objects (no snow/leaf-fall by month).
