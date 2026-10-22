# Prototype

A small TypeScript filler. It does not import the app.

| File | What it is |
|---|---|
| `types.ts` | Slot, entry, ending, and template shapes |
| `fill.ts` | Fill, agreement, a/an, locks, no-repeat, most-specific ending |
| `library.ts` | 2 insights, 2 legends (one with branching endings), 3 traits × 3 tiers |
| `validate.ts` | The full matrix plus the lock, combo, fallback, and decoy checks |
| `render-matrix.ts` | Writes `sample-output.md` and exits 1 on any failure |
| `sample-output.md` | Generated. Do not hand-edit |

```bash
npx tsx docs/story-library/prototype/render-matrix.ts
```

Trait ids match `TRAIT_AXES`. Tiers match `traitBand`: low under 0.35, high at or above 0.65, otherwise mid.
