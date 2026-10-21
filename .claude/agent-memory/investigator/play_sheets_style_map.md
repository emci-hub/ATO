---
name: play-sheets-style-map
description: Play sheet/Info/Feed styling map - which kit each sheet uses, GameCard border mismatch cause, dev panel default-open, gate pins on sheet code
metadata:
  type: reference
---

- Info sheet = PlaySheet (src/play/play-sheet.tsx) + SheetTabs header (horizontal ScrollView, no scroll hint); tab bodies in pet-screen.tsx ~1503; infoTab state pet-screen.tsx:403. No accordion in Status/Journal/Book; only accordion is PetDevPanel (pet-dev-panel.tsx), default-open via startOpen prop (pet-screen.tsx:1525 passes ['pet','eggs']; floating kit src/app/play.tsx:1000 passes pet/eggs/room).
- Two kits mix: Feed/Play GameCard use PixelFrame/PixelLabel/PixelBody/PixelButton (pixel-ui.tsx, Departure Mono/Rajdhani); Info/Style/Journal/Expedition use NeonChip/NeonLabel + Fonts.mono Text styles (neon-ui.tsx, pet-sheets.tsx styles ~845). Street skin always on (streetUiOn()).
- GameCard "outside border" cause: PixelFrame streetPiece="panel" pads only 10pt (margin 2 + padded 8) but panel 9-slice corners are 28pt (meta.json inset 56 x scale 0.5). pet-room panels add extra paddingHorizontal 10-12. Fix = add padding/streetGameCard style or padded={false}+own pad.
- Gate pins on sheet code: check-pet-room.ts:341-355 (Feed slice between open={sheet === 'feed'} and 'play', GuideLink section="pet" before <GameCard g="catch" view onStart={startGame}), check-play-dev-hidden.ts:57-62 (infoTabs(dev), `) : dev ? (`, exact dev tab return line), dev-fab-check.ts:112-122 (panel titles literal, PRE_LAUNCH_DEV guard), score-burst-check.ts:98 (<ScoreBurst ... animate={!still}>), check-hideout-rails.ts:126 (no "Show labels").
- Previews: docs/divecore/tools/README.md; localStorage key ato.play.store.v1 (PLAY_STORE_KEY playStore.ts:362); seed via docs/divecore/tools/seed.ts.
