# Rigs

One `<hero>.json` per hero: the spec the art engine (`scripts/art-engine/`) reads. A rig holds no art, only where the
feet are, where the body may bend and which pixels are a prop, cape or head. Format and rules: header of
`scripts/art-engine/rig.ts`. Build tooling only: nothing here ships in the app.

```
npm run art:engine -- --hero maldrath --debug     # build the clip, run the seven gates, render GIFs + part map
npm run check:art-engine                          # pins rigs, recipe, gates (pass/fail pairs)
```

PixelLab facts (tool names, costs, limits) are never in a rig or in engine code: `scripts/art-engine/pixellab.config.json`.
