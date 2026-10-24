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

Reuse: `create_character` mode `pro` with `style_character_id` = one of these (10-25 gens, reference must not be larger than the new
character); `create_character_state` for variants; `animate_character` with that body's own template ids (quadruped lists differ per animal).
The south frames and `body-type-protos-sheet.png` are in this folder.
