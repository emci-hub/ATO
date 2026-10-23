# Divecore measuring harness (web + Playwright)

Measures and screenshots the real Play screens at 430×932 (Pro Max, insets 59/34) and 375×667 (SE, 20/0).
Used for `docs/divecore-audit/measured.md` and the before/after shots. Not part of the app or the gate.

1. `npm ci` (once). Install Playwright if you don't have it: `npm i -g playwright` + `npx playwright install chromium`.
2. Web-only fix (local only, never commit): in `node_modules/react-native-safe-area-context/lib/module/SafeAreaView.web.js`,
   in `getEdgeValue`, add `case undefined:` right above `case 'off':` (on web an edge missing from `edges` adds the
   inset; on the phone it doesn't — without this the top inset doubles in shots).
3. Start web with dummy Supabase values (local process only; `/play` needs no sign-in, the Play save is local):
   - macOS/Linux: `EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=dummy npx expo start --web --port 8081 --clear`
   - Windows PowerShell: `$env:EXPO_PUBLIC_SUPABASE_URL="https://example.supabase.co"; $env:EXPO_PUBLIC_SUPABASE_ANON_KEY="dummy"; npx expo start --web --port 8081 --clear`
4. `npx tsx docs/divecore/tools/seed.ts > docs/divecore/tools/seed.json`
5. `mkdir docs/divecore/tools/out` then `NODE_PATH=$(npm root -g) node docs/divecore/tools/shots.js max` (and `se`).
   Shots land in `docs/divecore/tools/out/` (git-ignored by convention: don't commit them there; copy the ones you
   want into `docs/divecore/after/`, downscaled).

**Notice previews (Phase 2).** A dev build exposes `globalThis.__divecoreNotify` (`src/play/notify/notify.ts`), so a
shot can raise any notice: `__divecoreNotify({ kind: 'celebrate', title: 'Egg hatched', body: '…', target: 'pet' })`.
When `expo start --web` keeps dying (EMFILE / out of memory on Windows), use a static dev export instead:
`npx expo export --platform web --dev --output-dir <dir>` (same dummy env + `NODE_OPTIONS=--max-old-space-size=8192`),
copy `<dir>/play.html` to `<dir>/play/index.html`, serve `<dir>` with `python -m http.server`, open `/play/`
(seed the save first via `localStorage`). Insets: inject the stylesheet rule from `lib.js`, then change the window
size by 1 px and back (`useStageFrame` only re-reads the safe area on a size change). Capture within ~1 s of
raising a notice (3–5 s on screen); the built-in browser's full screenshot can lag during a live wave.

Notes: Dive can't be opened on web (the manhole wipe never calls `onDone`), so `shots.js` uses the layout-shot
frames `/play?shot=dive&phase=mid&inset=max|se` and `shot=catch`. The Store needs the dev PIN.
`lib.js` injects the safe area with a stylesheet rule and paints the status-bar / home-indicator zones as stripes.
