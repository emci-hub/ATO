# Ronin ninja mech: front-facing test (2026-10-24)

emci's brief: original dark ronin samurai mech (navy + gunmetal armor, bronze horned kabuto crest, white mane, cyan-green eye slits and
chest core, two katanas at the hip, giant cleaver across the back). The mood reference image from the brief did not reach this chat, so the
text brief alone was used. Not approved; waiting for emci's pick before any directions or animation.

## Params (all three)
Tool `create_image_pro_flash` (not Pro), 128x128, `no_background` true, one image each, 6 gens each = 18 gens
(balance 3,435.95 -> 3,417.95). `style_image` = cropped Kael south 128 (`docs/art/mecha-m1/kael128.png`), usage "copy only outline,
shading, detail and character scale", `style_options` colour_palette false, outline/detail/shading true. Description = the brief's
look text + "sprite about 104 pixels tall filling the canvas, no gradient, no blur, no text, no logo, no watermark" (the tool has no
negative-prompt field, so the negatives are in the description).

| Candidate | Seed | Palette | Box (w x h) | Colours |
|---|---|---|---|---|
| c1 | 41 | none | 103 x 126 | 39 |
| c2 | 42 | none | 99 x 123 | 58 |
| c3 | 43 | `palette` of 13 hex (below) | 98 x 122 | 13 |

Palette: #07080d #141a38 #222b57 #36427a (outline + navy) / #1c1f26 #3a404c #5b6372 (gunmetal) / #8a5a2b #c98f45 (bronze) /
#cfd6e0 #f2f5f8 (mane) / #2ef2c8 #7dffe0 (cyan-green glow).

Binary alpha on all three (0 semi-transparent pixels). Files: `ronin-c1-seed41.png`, `ronin-c2-seed42.png`, `ronin-c3-seed43-palette.png`,
`ronin-candidates-4x.png` (Kael for scale).

## Notes
- Brief says figure about 77 px; the approved ATO scale ladder says hero about 104-106 (Kael). Candidates came out 122-126 px tall, taller
  than both. A shorter regeneration is needed whichever size emci chooses (6 gens each).
- Brief says REST + token; this session used the `pixellab` MCP tools instead (same account, no token handled).
