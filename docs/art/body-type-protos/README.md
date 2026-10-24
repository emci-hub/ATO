# Body-type prototypes (2026-10-24)

One "cyborg edgerunner" per PixelLab body template, made with `create_character` mode `standard`, size 128 (stored on a 180x180
canvas), 4 directions, `low top-down`. 1 generation each (6 total, balance 3,485.95 -> 3,479.95). They are saved permanently in
emci's PixelLab account (`list_characters`), so new characters can be made from them. These are tests of the body templates, not
approved ATO art: standard mode is not the 128-hero style (scale/style not matched to Kael); sizes below are tight boxes.

| Body | Template | PixelLab character id | Box |
|---|---|---|---|
| Humanoid | `body_type=humanoid` (mannequin) | a8ab5437-7561-4b53-b7dd-f44a004df266 | 49x139 |
| Bear | `quadruped` + `bear` | 0dfb2af9-58f4-4176-8c9c-8a7b1097c154 | 142x146 |
| Cat | `quadruped` + `cat` | 54073e59-0fdf-4923-bb72-3b19d7ac90ef | 60x116 |
| Dog | `quadruped` + `dog` | 76fcb114-8646-49b3-a28c-4c05f409f57a | 40x107 |
| Horse | `quadruped` + `horse` | e2630775-106c-4174-b24e-b8397b137a64 | 135x113 |
| Lion | `quadruped` + `lion` | 459f8408-bca8-415e-bc81-e2c54ba8b045 | 132x133 |

## Redo in our street style (same day)
emci: the standard-mode samples above do not follow our style. Redone as `create_image_pro_flash` 128x128 stills with the cropped Kael as
`style_image` (outline/shading/detail on, colours off), 6 gens each: `styled-<body>.png`, sheet `styled-protos-sheet.png`. Boxes (w x h):
humanoid 59x115, bear 71x97, cat 63x108, dog 55x105, horse 57x121, lion 92x109. These are stills only (not stored PixelLab characters yet;
import with `create_character` v3 + `reference_image_url` = 2-3 gens when one is picked).

## Standard vs ours animation test (Ironclad Kabuto, east walk, 6 frames) - `docs/art/mecha-compare/`
- A standard (text character 1 gen + `walking-6-frames` template, charged 1 per batch): generic blue robot, lost the nodachi and the big
  shoulder plates; 180 canvas, heights 127-132, foot drift 7 px.
- B ours (our Pro Flash still imported with `create_character` v3 = 2 gens, then `skeleton-v3` `walking-6-frames` = 3 gens): kept the look,
  sword and shoulders; 176 canvas, heights 119-122, foot drift 3 px.
- Total spend for the whole session step: 44 gens (balance 3,479.95 -> 3,435.95). Verdict for emci to confirm: B (our style + skeleton-v3).

Reuse: `create_character` mode `pro` with `style_character_id` = one of these (10-25 gens, reference must not be larger than the new
character); `create_character_state` for variants; `animate_character` with that body's own template ids (quadruped lists differ per animal).
The south frames and `body-type-protos-sheet.png` are in this folder.
