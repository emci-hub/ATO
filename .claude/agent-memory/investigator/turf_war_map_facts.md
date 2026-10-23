---
name: turf-war-map-facts
description: Turf War (defend) file map, renderer, layout numbers, checks, screenshot recipe that works on this Windows box
metadata:
  type: project
---

- Everything is `src/play/defend-screen.tsx` (5.6k lines; route src/app/play.tsx:836) + engine `src/play/defend.ts`; board data `board-data.ts`; baked street board = SHEET.board.ato (512x512 sprite in ONE react-native-svg viewBox 0 0 100 100). Sim = setInterval 100ms -> setSim (whole SVG re-render).
- No base HP: one leak = lose. No hit flash, no combat FX art in registry; registry usedBy never names defend (art goes via assets/play/sheets + skin.json, cast atlases are alt-skin).
- Turf setup->wave is one stage (stage-frame.ts REGIONS turf-wave dock = 64+tabBar); the `fixed-regions: screen switch` marker exists in no src file.
- sheet-kit.tsx is NOT used by Turf War.
- Board ambient art (T4/T8): painter scripts/turf-board-art.ts (TURF_THEMES pools/pigeons) -> art-pack.ts packSwBoards ~1055-1119 (writeFrameStrip, meta.boards.<id>.ambient) -> runtime src/play/turf-ambient.tsx + turf-ambient-layout.ts (ambientSpriteBoxes = what check-turf-war-layout.ts:232-304 tests: in-board, clear of pad circles, off road cells unless 'lamp'). SHEET.board is open (skeletons.ts:106 null): any assets/play/sheets/streetwear/board/<name> auto-registers via art-registry-gen.ts:394. ATO road grid: col 15 free top-right, cols 0-2 rows 14-15 road bottom-left. Raw ambient: art-src/pixellab/board.streetwear/gen-20261017-pixellab-1/raw/ambient. Peek card: turf-ui.tsx:227-289 + defend-screen.tsx:3283; check pins 660-699 (no swatch-shape pins).
- Screenshot recipe: `expo export --platform web --dev --output-dir <scratch>` (env dummy supabase, NODE_OPTIONS 8192) ~ few min; copy play.html -> play/index.html; python http.server fresh port; Playwright global at %APPDATA%/npm/node_modules needs chromium 1248 but 1148 installed -> monkeypatch chromium.launch executablePath to ms-playwright/chromium_headless_shell-1148/chrome-win/headless_shell.exe. Click Turf War tab `[role=tablist] [aria-label="Turf War"]`, board svg[viewBox="0 0 100 100"], pad click then "Archer" text, `[aria-label="Call wave"]`. Only 2 towers affordable (80 scrap). Tool blocks writing findings .md files: return text instead.
