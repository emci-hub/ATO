# Play art pack licenses

The PNGs under `assets/play/` are unpacked from the packs below (see
`games/grove/GAME_SPEC.md` §19). Player-facing credits live in
`src/play/credits.ts` (Play → About).

| Folder | Pack | Author | License |
|---|---|---|---|
| `tiles/scribble-dungeons/` | Scribble Dungeons | Kenney | CC0 |
| `kenney-ui/` | Fantasy UI Borders | Kenney | CC0 |
| `kenney-icons/` | Cursor Pack | Kenney | CC0 |
| (shared `assets/kenney/shape/`) | Shape Characters | Kenney | CC0 |
| `avatars/masterpiece/` | Masterpiece Fantasy Pixel Art | pack author | per pack |
| `avatars/cozy-girl/` | Cozy Village Animated Girl | pack author | per pack |
| `primal/` | Primal Dynasties — Beast Champions | pack author | per pack |

Kenney license texts are copied beside this file. The avatar/beast packs did
not include a standalone license file in the archive; check the pack page
before shipping.

## Regenerating the registry

`src/play/generated-play-assets.ts` is emitted by `scripts/play-art-prep.ts`:

```
npx tsx scripts/play-art-prep.ts
```

It also bakes the 9-slice pieces for the card frame from
`kenney-ui/border/panel-border-000.png` into `kenney-ui/border/sliced/`.
The original pack `.zip` files live in `assets/play/incoming/` locally but are
git-ignored (size); re-download them there to re-run the prep script.
