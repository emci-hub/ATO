/**
 * npm run art:catalog
 *   writes ART_LIBRARY.md + assets/art/_contact/library.html
 * npm run art:catalog -- --portable
 *   also writes library-portable.html — one self-contained file (previews inlined)
 *   for iPhone / Airdrop / static host. Target < 25 MB.
 *
 * Viewer: Metro-blocked. Open file:// or host the portable HTML.
 * Visual language from scripts/sprite-gallery/page.html (Streetwear Skin).
 * Grid tiles are a representative preview (animated main clip, still, or
 * individual icons) — never the raw packed sheet.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { ArtAsset, ArtRegistry } from '../src/art/registry.types';
import { ART_CATEGORIES, ART_CATEGORY_LABELS } from '../src/art/registry.types';
import {
  bakePreview,
  buildLegacyIndex,
  clearPreviewCache,
  titleClip,
  type BakeOpts,
  type ItemPreview,
} from './art-preview';

const repo = path.resolve(__dirname, '..');
const PORTABLE = process.argv.includes('--portable');
const PORTABLE_CAP_BYTES = 25 * 1048576;

function displayStatus(a: ArtAsset): string {
  if (a.status === 'archived' || a.status === 'deprecated') return 'orphan';
  if (a.status === 'needs-restyle') return 'needs-restyle';
  if (a.status === 'alt-skin') return 'alt-skin';
  if (a.inUse || (a.usedBy ?? []).length > 0) return 'in-use';
  if (a.status === 'resource') return 'resource';
  return 'resource';
}

type CatalogItem = {
  id: string;
  category: string;
  type: string;
  theme: string;
  placement: string;
  status: string;
  display: string;
  w: number;
  h: number;
  disk: number;
  decoded: number;
  score: number | null;
  usedBy: string[];
  tags: string[];
  path: string;
  rel: string;
  restyle: ArtAsset['restyle'] | null;
  md5: string;
  inUse: boolean;
  kind: ItemPreview['kind'] | 'empty';
  preview: string;
  pw: number;
  ph: number;
  pn: number;
  pms: number[];
  clips: ItemPreview['clips'];
  icons: ItemPreview['icons'];
  sheet: string;
  bg: ItemPreview['bg'] | 'checker';
  mainClip: string;
  mainDir: string;
};

function emptyPreview(): Pick<
  CatalogItem,
  'kind' | 'preview' | 'pw' | 'ph' | 'pn' | 'pms' | 'clips' | 'icons' | 'sheet' | 'bg' | 'mainClip' | 'mainDir'
> {
  return {
    kind: 'empty',
    preview: '',
    pw: 1,
    ph: 1,
    pn: 1,
    pms: [100],
    clips: [],
    icons: [],
    sheet: '',
    bg: 'checker',
    mainClip: '',
    mainDir: '',
  };
}

function buildItems(registry: ArtRegistry, opts: BakeOpts): CatalogItem[] {
  const legacy = buildLegacyIndex(repo);
  const items: CatalogItem[] = [];
  let i = 0;
  for (const a of registry.assets) {
    i += 1;
    if (i % 80 === 0) console.log(`  preview ${i}/${registry.assets.length}`);
    const notes = a.notes ?? '';
    const md5 = notes.startsWith('md5:') ? notes.slice(4) : '';
    const rel = path.posix.relative(
      '_contact',
      path.relative(path.join(repo, 'assets/art'), a.path).split(path.sep).join('/'),
    );
    const baked = bakePreview(repo, a, legacy, opts) ?? emptyPreview();
    items.push({
      id: a.id,
      category: a.category,
      type: a.type,
      theme: String(a.theme),
      placement: String(a.placement),
      status: a.status,
      display: displayStatus(a),
      w: a.size.w,
      h: a.size.h,
      disk: a.diskBytes ?? 0,
      decoded: a.decodedBytes ?? 0,
      score: a.critiqueScore ?? null,
      usedBy: a.usedBy ?? [],
      tags: a.tags ?? [],
      path: a.path,
      rel: rel.startsWith('.') ? rel : `../${rel}`,
      restyle: a.restyle ?? null,
      md5,
      inUse: a.inUse || (a.usedBy ?? []).length > 0,
      kind: baked.kind,
      preview: baked.preview,
      pw: baked.pw,
      ph: baked.ph,
      pn: baked.pn,
      pms: baked.pms,
      clips: baked.clips,
      icons: baked.icons,
      sheet: baked.sheet,
      bg: baked.bg,
      mainClip: baked.mainClip,
      mainDir: baked.mainDir,
    });
  }
  clearPreviewCache();
  return items;
}

function dupeGroups(items: CatalogItem[]) {
  const hashGroups = new Map<string, string[]>();
  for (const a of items) {
    if (!a.md5) continue;
    const g = hashGroups.get(a.md5) ?? [];
    g.push(a.id);
    hashGroups.set(a.md5, g);
  }
  return [...hashGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([hash, ids]) => ({
      hash,
      ids,
      bytes: items.filter((i) => ids.includes(i.id)).reduce((s, i) => s + i.disk, 0),
    }));
}

function safeName(id: string): string {
  return id.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
}

function writeDataPng(contactDir: string, id: string, name: string, uri: string): string {
  if (!uri.startsWith('data:image/png;base64,')) return uri;
  const rel = `preview/${safeName(id)}/${name}.png`;
  const dest = path.join(contactDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64'));
  return rel;
}

/** Local viewer loads files next to library.html — keeps the HTML light. */
function materializeLocal(items: CatalogItem[], contactDir: string) {
  const prev = path.join(contactDir, 'preview');
  fs.rmSync(prev, { recursive: true, force: true });
  fs.mkdirSync(prev, { recursive: true });
  for (const a of items) {
    a.preview = writeDataPng(contactDir, a.id, 'main', a.preview);
    a.sheet = writeDataPng(contactDir, a.id, 'sheet', a.sheet);
    a.clips = a.clips.map((c, i) => ({
      ...c,
      strip: writeDataPng(contactDir, a.id, `${i}-${safeName(c.clip)}-${safeName(c.dir)}`, c.strip),
    }));
    a.icons = a.icons.map((ic, i) => ({
      ...ic,
      src: writeDataPng(contactDir, a.id, `icon-${i}`, ic.src),
    }));
  }
}

function writeLibraryMd(registry: ArtRegistry) {
  const live = registry.assets.filter((a) => a.status !== 'archived');
  const groups = new Map<string, typeof live>();
  for (const a of live) {
    const key = `${a.category} · ${a.inUse ? 'in-use' : 'unused'} · ${a.theme}`;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }
  const catCounts = Object.fromEntries(
    ART_CATEGORIES.map((c) => {
      const list = live.filter((a) => a.category === c);
      const used = list.filter((a) => a.inUse).length;
      return [c, { total: list.length, used, unused: list.length - used }];
    }),
  ) as Record<string, { total: number; used: number; unused: number }>;

  const md: string[] = [
    '# ATO art library',
    '',
    `Generated. ${live.length} live entries.`,
    'Open `assets/art/_contact/library.html` (desktop / file://) or `library-portable.html` on a phone.',
    'Every tile is a preview (animated main clip, still, or individual sprites) — not the raw sheet.',
    'Reuse before create. New art goes in `assets/art/<category>/in-use|unused/…`.',
    '',
    '## Categories',
    '',
    ...ART_CATEGORIES.map((c) => {
      const n = catCounts[c] ?? { total: 0, used: 0, unused: 0 };
      return `- **${c}** (${n.total}: ${n.used} in use / ${n.unused} unused) — ${ART_CATEGORY_LABELS[c]}`;
    }),
    '',
  ];
  const catOrder = new Map(ART_CATEGORIES.map((c, i) => [c, i]));
  for (const [key, list] of [...groups.entries()].sort((a, b) => {
    const ca = a[0].split(' · ')[0];
    const cb = b[0].split(' · ')[0];
    const d = (catOrder.get(ca as (typeof ART_CATEGORIES)[number]) ?? 99) - (catOrder.get(cb as (typeof ART_CATEGORIES)[number]) ?? 99);
    return d !== 0 ? d : a[0].localeCompare(b[0]);
  })) {
    md.push(`## ${key}`, '');
    md.push('| id | size | status | score | usedBy |');
    md.push('|---|---|---|---|---|');
    for (const a of list.sort((x, y) => x.id.localeCompare(y.id))) {
      md.push(
        `| \`${a.id}\` | ${a.size.w}×${a.size.h} | ${a.status} | ${a.critiqueScore ?? '—'} | ${(a.usedBy ?? []).join(', ') || '—'} |`,
      );
    }
    md.push('');
  }
  fs.writeFileSync(path.join(repo, 'assets/art/ART_LIBRARY.md'), md.join('\n'));
}

function main() {
  const registry = JSON.parse(fs.readFileSync(path.join(repo, 'assets/art/registry.json'), 'utf8')) as ArtRegistry;
  const contactDir = path.join(repo, 'assets/art/_contact');
  fs.mkdirSync(contactDir, { recursive: true });
  writeLibraryMd(registry);

  console.log('art:catalog baking local previews…');
  const localItems = buildItems(registry, { cell: 72, still: 128, allClips: true });
  materializeLocal(localItems, contactDir);
  const localData = { generatedAt: new Date().toISOString(), portable: false, items: localItems, dupes: dupeGroups(localItems) };
  fs.writeFileSync(path.join(contactDir, 'library.html'), viewerHtml(localData, false));

  let portableBytes = 0;
  if (PORTABLE) {
    let cell = 48;
    let still = 80;
    console.log(`art:catalog baking portable previews cell=${cell} still=${still}`);
    let portableItems = buildItems(registry, { cell, still, allClips: true });
    let html = viewerHtml({ generatedAt: new Date().toISOString(), portable: true, items: portableItems, dupes: dupeGroups(portableItems) }, true);
    while (Buffer.byteLength(html) > PORTABLE_CAP_BYTES && cell > 28) {
      cell = Math.max(28, Math.floor(cell * 0.75));
      still = Math.max(48, Math.floor(still * 0.8));
      console.log(`art:catalog rebake portable cell=${cell} still=${still}`);
      portableItems = buildItems(registry, { cell, still, allClips: true });
      html = viewerHtml({ generatedAt: new Date().toISOString(), portable: true, items: portableItems, dupes: dupeGroups(portableItems) }, true);
    }
    const out = path.join(contactDir, 'library-portable.html');
    fs.writeFileSync(out, html);
    portableBytes = fs.statSync(out).size;
    console.log(`portable ${out} ${(portableBytes / 1048576).toFixed(2)} MB (cell ${cell}px)`);
    if (portableBytes > PORTABLE_CAP_BYTES) {
      console.warn(`WARN portable ${(portableBytes / 1048576).toFixed(2)} MB over the 25 MB target`);
    }
  }

  fs.writeFileSync(path.join(repo, 'tools/art-viewer/README.md'), viewerReadme());
  console.log(`art:catalog ${registry.assets.length} entries, local viewer ${localItems.length} items`);
}

function viewerReadme(): string {
  return `# Art library viewer

## Open it
- Desktop / Windows: double-click \`assets/art/_contact/library.html\` (file://, no server).
- iPhone: run \`npm run art:catalog -- --portable\`, then AirDrop / host
  \`assets/art/_contact/library-portable.html\`. One file; previews are inlined.
  Add to Home Screen from Safari for a full-screen library.

Grid tiles show a **preview**, not the packed sheet:
- Sheets / clips: the best still (Idle frame 0, or Walk S/front for heroes).
  Animation stays off until Play, hover (desktop), or press-and-hold (iPhone).
  “Autoplay previews” (default off) is saved in localStorage.
- Stills: the image, scaled to fit.
- Multi-icon atlases: the sprites individually (mosaic on the tile).

Tap a tile for clip + direction pickers, play/pause (opens paused), a frame
scrubber, swipe through frames and prev/next items, 1×/2×/4× zoom, and a
secondary “show raw sheet” toggle.

This extends the earlier Streetwear Skin artifact at \`scripts/sprite-gallery/\`
(Claude artifact https://claude.ai/artifact/9wjcLv4FQu4S8dwqT2RBho). That page
is still the live Streetwear *skin* contact sheet. This viewer is the **full**
library: every registry item, decisions, duplicates, memory.

## Decisions
Keep / use / needs-restyle / remove persist in \`localStorage\`.
Export (Share on iOS, download elsewhere) writes \`art-decisions.json\`.
Import merges a previously exported file (imported ids win).

Apply on the machine: copy the JSON to \`assets/art/art-decisions.json\`, then
\`npm run art:apply-decisions\` (dry-run) or \`npm run art:apply-decisions -- --apply\`.

Regenerate: \`npm run art:catalog\` · portable: \`npm run art:catalog -- --portable\`
`;
}

function viewerHtml(data: unknown, portable: boolean): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1d1d20">
<meta name="mobile-web-app-capable" content="yes">
<title>ATO art library${portable ? ' (portable)' : ''}</title>
<style>
:root { color-scheme: dark; --bg:#1d1d20; --panel:#26262a; --tile:#141416; --line:#3a3a3f; --fg:#f2ede4; --muted:#a9a49b; --mustard:#e0a526; --red:#c8202b; --ok:#6aa84f; --tap:48px; --room:#1a1612; }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
html { -webkit-text-size-adjust: 100%; }
body { padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
header { padding: 16px 16px 8px; }
h1 { font:700 28px/1.05 Impact,"Arial Black",sans-serif; margin:0; }
h1 span { color:var(--mustard); }
.lede { color:var(--muted); max-width:72ch; font-size:14px; }
.stats { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 0; }
.stat { font:12px ui-monospace,Consolas,monospace; border:1px solid var(--line); padding:6px 10px; border-radius:3px; }
.stat b { color:var(--mustard); }
.bar { position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line); padding:10px 12px; display:flex; flex-wrap:wrap; gap:8px; align-items:stretch; }
.cats { display:flex; flex-wrap:wrap; gap:6px; width:100%; }
.chip { min-height:var(--tap); padding:8px 12px; border:1px solid var(--line); border-radius:999px; background:var(--tile); color:var(--fg); font:13px/1.2 ui-monospace,Consolas,monospace; cursor:pointer; touch-action:manipulation; }
.chip b { color:var(--mustard); }
.chip.on { background:var(--mustard); color:#1d1d20; border-color:var(--mustard); font-weight:700; }
.chip.on b { color:#1d1d20; }
.chip .use { color:var(--ok); }
.chip .off { color:var(--muted); }
.chip.on .use, .chip.on .off { color:#1d1d20; }
.usage { display:flex; flex-wrap:wrap; gap:6px; width:100%; }
.sub { display:flex; flex-wrap:wrap; gap:8px; width:100%; align-items:stretch; }
input, select, textarea, button { font:inherit; font-size:16px; border-radius:6px; }
input[type=search] { flex:1 1 100%; min-height:var(--tap); background:var(--tile); color:var(--fg); border:1px solid var(--line); padding:10px 12px; }
input[type=range] { width:100%; accent-color:var(--mustard); }
select { flex:1 1 140px; min-height:var(--tap); background:var(--tile); color:var(--fg); border:1px solid var(--line); padding:8px 10px; }
button { min-height:var(--tap); background:transparent; color:var(--fg); border:1px solid var(--line); padding:10px 14px; cursor:pointer; touch-action:manipulation; }
button.on, button[aria-pressed=true] { background:var(--mustard); color:#1d1d20; border-color:var(--mustard); font-weight:700; }
.actions { display:flex; flex-wrap:wrap; gap:8px; width:100%; }
.actions button { flex:1 1 140px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; padding:12px 12px 96px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:8px; display:grid; gap:6px; min-width:0; min-height:var(--tap); touch-action:manipulation; content-visibility:auto; contain-intrinsic-size: 220px; }
.card:active { border-color:var(--mustard); }
.stage { min-height:108px; display:grid; place-items:center; border-radius:4px; overflow:hidden; position:relative; }
.stage.checker { background-color:var(--tile); background-image:linear-gradient(45deg,#1a1a1e 25%,transparent 25%),linear-gradient(-45deg,#1a1a1e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1a1e 75%),linear-gradient(-45deg,transparent 75%,#1a1a1e 75%); background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; }
.stage.room { background:#1a1612; }
.stamp { position:absolute; top:6px; left:6px; z-index:2; font:700 9px/1 ui-monospace,Consolas,monospace; letter-spacing:.04em; text-transform:uppercase; padding:4px 6px; border-radius:3px; }
.stamp.yes { background:var(--ok); color:#0e1a0c; }
.stamp.no { background:#3a3a3f; color:var(--muted); }
.tile-play { position:absolute; right:6px; bottom:6px; z-index:2; min-height:36px; min-width:44px; padding:6px 10px; font:700 11px/1 ui-monospace,Consolas,monospace; background:#000a; }
.sprite { image-rendering:pixelated; image-rendering:crisp-edges; background-repeat:no-repeat; flex:0 0 auto; }
.stage img { image-rendering:pixelated; image-rendering:crisp-edges; max-width:100%; max-height:120px; object-fit:contain; }
.icons { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; align-items:center; padding:6px; max-height:120px; overflow:hidden; }
.icons img { image-rendering:pixelated; width:28px; height:28px; object-fit:contain; }
.meta { font:12px/1.35 ui-monospace,Consolas,monospace; color:var(--muted); overflow-wrap:anywhere; }
.meta b { color:var(--fg); }
.badge { display:inline-block; font:10px ui-monospace,Consolas,monospace; text-transform:uppercase; padding:3px 7px; border-radius:3px; border:1px solid var(--line); }
.badge.in-use { border-color:var(--ok); color:var(--ok); }
.badge.resource { color:var(--muted); }
.badge.needs-restyle { border-color:var(--mustard); color:var(--mustard); }
.badge.alt-skin { color:#8ab4f8; border-color:#8ab4f8; }
.badge.orphan { border-color:var(--red); color:var(--red); }
#sheet { display:none; position:fixed; inset:0; z-index:10; background:#000c; }
#sheet.show { display:block; }
#sheet .panel { position:absolute; left:0; right:0; bottom:0; max-height:96%; overflow:auto; -webkit-overflow-scrolling:touch; background:var(--panel); border-radius:16px 16px 0 0; padding:12px 16px calc(20px + env(safe-area-inset-bottom)); display:grid; gap:10px; }
#sheet .nav { display:flex; gap:8px; }
#sheet .nav button { flex:1; }
#sheet .preview { min-height:220px; max-height:46vh; display:grid; place-items:center; border-radius:8px; overflow:hidden; touch-action:pan-y; }
#sheet .preview.checker { background-color:var(--tile); background-image:linear-gradient(45deg,#1a1a1e 25%,transparent 25%),linear-gradient(-45deg,#1a1a1e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1a1e 75%),linear-gradient(-45deg,transparent 75%,#1a1a1e 75%); background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; }
#sheet .preview.room { background:#1a1612; }
#sheet .preview img, #sheet .preview .sprite { image-rendering:pixelated; image-rendering:crisp-edges; }
#sheet .preview img { max-width:100%; max-height:46vh; object-fit:contain; }
#sheet .pick { display:flex; flex-wrap:wrap; gap:6px; }
#sheet .pick button { min-height:40px; padding:8px 10px; font:13px ui-monospace,Consolas,monospace; }
#sheet .tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
#sheet .tools button { flex:0 0 auto; }
#sheet .film { display:flex; gap:6px; overflow:auto; -webkit-overflow-scrolling:touch; padding-bottom:4px; }
#sheet .film button { min-width:44px; padding:0; overflow:hidden; }
#sheet .film .cell { width:44px; height:44px; image-rendering:pixelated; background-repeat:no-repeat; }
#sheet .icon-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(56px,1fr)); gap:8px; }
#sheet .icon-grid button { min-height:56px; padding:6px; }
#sheet .icon-grid img { image-rendering:pixelated; width:40px; height:40px; object-fit:contain; }
.dec { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.dec button { min-height:52px; }
textarea { width:100%; min-height:72px; background:var(--tile); color:var(--fg); border:1px solid var(--line); padding:10px; }
.dupes { padding:0 12px 40px; overflow:auto; }
.dupes table { width:100%; border-collapse:collapse; font:12px ui-monospace,Consolas,monospace; }
.dupes td, .dupes th { border:1px solid var(--line); padding:8px; text-align:left; }
.toast { position:fixed; left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom)); background:var(--mustard); color:#1d1d20; padding:12px 14px; border-radius:8px; z-index:20; display:none; font-weight:600; }
.toast.show { display:block; }
@media (min-width:720px) {
  .grid { grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); padding:16px 20px 80px; }
  input[type=search] { flex:1 1 220px; }
  .chip { min-height:40px; }
  #sheet .panel { left:50%; right:auto; top:4%; bottom:4%; width:min(640px,94vw); transform:translateX(-50%); border-radius:12px; max-height:none; }
}
@media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
</style>
<header>
  <h1>ATO <span>art library</span></h1>
  <p class="lede">Every tile is a preview — a still of the main clip (Idle, or Walk S/front for heroes), the image for stills, individual sprites for icon atlases. Animation stays off until you tap Play, hover (desktop), or press-and-hold (iPhone). Tap a tile for clip, facing, frames, zoom. Decisions stay on this device. Export / Share writes <code>art-decisions.json</code>. ${portable ? 'Portable build — previews are inlined.' : 'Local build — raw sheets can load from the folder next to this page.'}</p>
  <div class="stats" id="stats"></div>
</header>
<div class="bar">
  <div class="cats" id="cats" role="tablist" aria-label="Categories"></div>
  <div class="usage" id="usage" role="group" aria-label="In use or unused"></div>
  <div class="usage" id="autoplayRow" role="group" aria-label="Preview playback"></div>
  <input type="search" id="q" placeholder="Search id, category, theme, path…" enterkeyhint="search" autocapitalize="off" autocomplete="off" spellcheck="false">
  <div class="sub">
  <select id="status" aria-label="Status"><option value="">all statuses</option>
    <option>in-use</option><option>resource</option><option>needs-restyle</option><option>alt-skin</option><option>orphan</option></select>
  <select id="theme" aria-label="Theme"><option value="">all themes</option></select>
  <select id="sort" aria-label="Sort">
    <option value="id">sort: id</option>
    <option value="decoded">sort: decoded</option>
    <option value="disk">sort: disk</option>
    <option value="status">sort: status</option>
    <option value="category">sort: category</option>
  </select>
  </div>
  <div class="actions">
    <button type="button" id="dupBtn">Duplicates</button>
    <button type="button" id="exportBtn">Share / export</button>
    <button type="button" id="importBtn">Import</button>
    <input id="importFile" type="file" accept="application/json,.json" hidden>
  </div>
</div>
<div class="grid" id="grid"></div>
<section class="dupes" id="dupes" hidden>
  <h2>Duplicates (identical md5)</h2>
  <table><thead><tr><th>hash</th><th>ids</th><th>bytes</th></tr></thead><tbody id="dupBody"></tbody></table>
</section>
<div id="sheet" role="dialog" aria-modal="true"><div class="panel" id="sheetPanel"></div></div>
<div class="toast" id="toast"></div>
<script>
const DATA = ${json};
const PORTABLE = ${portable ? 'true' : 'false'};
const KEY = 'ato-art-decisions-v1';
const PLAY_KEY = 'ato-art-autoplay-v1';
const CAT_ORDER = ${JSON.stringify([...ART_CATEGORIES])};
const CAT_LABEL = ${JSON.stringify(ART_CATEGORY_LABELS)};
const CLIP_TITLE = ${JSON.stringify(Object.fromEntries([...new Set((data as { items: CatalogItem[] }).items.flatMap((a) => a.clips.map((c) => c.clip)))].map((c) => [c, titleClip(c)])))};
const DIR_SHORT = ${JSON.stringify({
    north: 'N',
    'north-east': 'NE',
    east: 'E',
    'south-east': 'SE',
    south: 'S',
    'south-west': 'SW',
    west: 'W',
    'north-west': 'NW',
    front: 'S',
    none: '',
  })};
let cat = '';
let usage = 'all';
let decisions = {};
let autoplay = false;
let reduceMotion = false;
try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
try { decisions = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { decisions = {}; }
try { autoplay = localStorage.getItem(PLAY_KEY) === '1'; } catch (e) { autoplay = false; }
if (reduceMotion) autoplay = false;
function saveAutoplay(){
  try { localStorage.setItem(PLAY_KEY, autoplay ? '1' : '0'); } catch (e) {}
}
function canAutoplay(){ return autoplay && !reduceMotion; }
function setGridPlaying(on){
  document.querySelectorAll('.stage').forEach((stage) => {
    const p = stage._player;
    if (!p) return;
    p.playing = !!(on && p.n>1 && !reduceMotion);
    if (!p.playing) p.setFrame(0);
    const btn = stage.querySelector('.tile-play');
    if (btn) {
      btn.textContent = p.playing ? 'Pause' : 'Play';
      btn.classList.toggle('on', p.playing);
      btn.setAttribute('aria-pressed', p.playing ? 'true' : 'false');
    }
  });
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(decisions)); } catch (e) { toast('Could not save decisions on this device'); }
  renderStats();
}
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}
function mb(n){ return (n/1048576).toFixed(2); }
function payload(){ return { version:1, decidedAt: new Date().toISOString(), decisions }; }
function clipLabel(name){ return CLIP_TITLE[name] || name; }
function dirLabel(dir){ return DIR_SHORT[dir] || (dir && dir !== 'none' ? dir : ''); }
function renderStats(){
  const items = DATA.items;
  const counts = { 'in-use':0, resource:0, 'needs-restyle':0, 'alt-skin':0, orphan:0 };
  let disk=0, decoded=0, removeB=0, removeN=0, needN=0;
  for (const a of items) {
    counts[a.display] = (counts[a.display]||0)+1;
    disk += a.disk; decoded += a.decoded;
    const d = decisions[a.id];
    if (d && d.action==='remove') { removeN++; removeB += a.disk; }
    if (a.display==='in-use' || (d && d.action==='use')) needN++;
  }
  let usedN=0, unusedN=0;
  for (const a of items) { if (a.inUse) usedN++; else unusedN++; }
  document.getElementById('stats').innerHTML =
    '<span class="stat"><b>'+usedN+'</b> in use</span>' +
    '<span class="stat"><b>'+unusedN+'</b> unused</span>' +
    Object.entries(counts).map(([k,v]) => '<span class="stat"><b>'+v+'</b> '+k+'</span>').join('') +
    '<span class="stat">disk <b>'+mb(disk)+'</b> MB</span>' +
    '<span class="stat">decoded <b>'+mb(decoded)+'</b> MB</span>' +
    '<span class="stat">needed <b>'+needN+'</b></span>' +
    '<span class="stat">removable <b>'+removeN+'</b> ('+mb(removeB)+' MB)</span>';
}
function filtered(){
  const q = document.getElementById('q').value.toLowerCase();
  const st = document.getElementById('status').value;
  const th = document.getElementById('theme').value;
  const sort = document.getElementById('sort').value;
  let list = DATA.items.filter(a => {
    if (cat && a.category !== cat) return false;
    if (usage==='in-use' && !a.inUse) return false;
    if (usage==='unused' && a.inUse) return false;
    if (st && a.display !== st) return false;
    if (th && a.theme !== th) return false;
    if (!q) return true;
    return (a.id+' '+a.category+' '+a.type+' '+a.theme+' '+a.path+' '+(a.usedBy||[]).join(' ')+' '+(a.tags||[]).join(' ')).toLowerCase().includes(q);
  });
  list.sort((a,b) => {
    if (sort==='decoded') return b.decoded-a.decoded;
    if (sort==='disk') return b.disk-a.disk;
    if (sort==='status') return String(a.display).localeCompare(b.display);
    if (sort==='category') return String(a.category).localeCompare(b.category) || a.id.localeCompare(b.id);
    return a.id.localeCompare(b.id);
  });
  return list;
}
const players = new Set();
let raf = 0;
function tickPlayers(now){
  for (const p of players) p.tick(now);
  raf = players.size ? requestAnimationFrame(tickPlayers) : 0;
}
function addPlayer(p){
  players.add(p);
  if (!raf) raf = requestAnimationFrame(tickPlayers);
}
function fitZoom(fw, fh, boxW, boxH, want){
  const maxS = Math.max(1, Math.floor(Math.min(boxW / Math.max(fw,1), boxH / Math.max(fh,1))));
  return Math.max(1, Math.min(want, maxS));
}
function applySprite(el, strip, fw, fh, n, i, zoom){
  const z = Math.max(1, zoom|0);
  el.style.width = (fw*z)+'px';
  el.style.height = (fh*z)+'px';
  el.style.backgroundImage = strip ? 'url("'+strip+'")' : 'none';
  el.style.backgroundSize = (fw*n*z)+'px '+(fh*z)+'px';
  el.style.backgroundPosition = (-i*fw*z)+'px 0';
}
function makeAnim(host, strip, fw, fh, n, ms, zoom, playing){
  const sprite = document.createElement('div');
  sprite.className = 'sprite';
  host.appendChild(sprite);
  const p = {
    i: 0,
    acc: 0,
    last: 0,
    playing: playing && n>1 && !reduceMotion,
    zoom: zoom,
    strip: strip,
    fw: fw, fh: fh, n: n, ms: ms,
    el: sprite,
    host: host,
    tick(now){
      if (!this.el.isConnected) { players.delete(this); return; }
      if (!this.playing || this.n<2) { this.last = now; return; }
      if (!this.last) this.last = now;
      this.acc += now - this.last;
      this.last = now;
      const wait = (this.ms[this.i] || 100);
      if (this.acc >= wait) {
        this.acc = 0;
        this.i = (this.i+1) % this.n;
        applySprite(this.el, this.strip, this.fw, this.fh, this.n, this.i, this.zoom);
      }
    },
    draw(){ applySprite(this.el, this.strip, this.fw, this.fh, this.n, this.i, this.zoom); },
    setFrame(i){ this.i = ((i%this.n)+this.n)%this.n; this.draw(); },
    setZoom(z){ this.zoom = z; this.draw(); },
    setStrip(s, fw, fh, n, ms){
      this.strip=s; this.fw=fw; this.fh=fh; this.n=n; this.ms=ms; this.i=0; this.acc=0; this.draw();
    }
  };
  p.draw();
  addPlayer(p);
  return p;
}
function lazyStage(stage, a){
  stage.classList.add(a.bg==='room' ? 'room' : 'checker');
  stage.dataset.ready = '0';
  const io = lazyStage.io || (lazyStage.io = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (e.isIntersecting) bindStage(e.target);
      else unbindStage(e.target);
    }
  }, { rootMargin: '160px' }));
  io.observe(stage);
}
function bindStage(stage){
  if (stage.dataset.ready === '1') return;
  const a = stage._item;
  if (!a) return;
  stage.dataset.ready = '1';
  if (a.kind==='clip' && a.preview && a.pn>1) {
    const box = stage.getBoundingClientRect();
    const z = fitZoom(a.pw, a.ph, Math.max(80, box.width-8), 112, 2);
    stage._player = makeAnim(stage, a.preview, a.pw, a.ph, a.pn, a.pms, z, canAutoplay());
    return;
  }
  if (a.kind==='icons' && a.icons && a.icons.length) {
    const wrap = document.createElement('div');
    wrap.className = 'icons';
    a.icons.slice(0, 16).forEach(ic => {
      const img = document.createElement('img');
      img.src = ic.src; img.alt = '';
      img.width = 28; img.height = 28;
      wrap.appendChild(img);
    });
    stage.appendChild(wrap);
    return;
  }
  if (a.preview) {
    const img = document.createElement('img');
    img.src = a.preview; img.alt = a.id;
    stage.appendChild(img);
    return;
  }
  const miss = document.createElement('div');
  miss.className = 'meta';
  miss.textContent = a.w && a.h ? a.w+'×'+a.h : 'no pixels';
  stage.appendChild(miss);
}
function unbindStage(stage){
  if (stage.dataset.ready !== '1') return;
  if (stage._player) { players.delete(stage._player); stage._player = null; }
  [...stage.querySelectorAll('img,.sprite,.icons')].forEach(n => n.remove());
  stage.dataset.ready = '0';
}
function card(a){
  const d = decisions[a.id] || { action:'keep', notes:'' };
  const el = document.createElement('article');
  el.className = 'card';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.innerHTML = '<div class="stage"></div><div class="meta"><b>'+a.id+'</b></div><span class="badge '+(a.inUse?'in-use':'resource')+'">'+(a.inUse?'in use':'unused')+'</span> <span class="badge '+a.display+'">'+a.display+(d.action&&d.action!=='keep'?' · '+d.action:'')+'</span>';
  const stage = el.querySelector('.stage');
  stage._item = a;
  lazyStage(stage, a);
  const stamp = document.createElement('span');
  stamp.className = 'stamp '+(a.inUse?'yes':'no');
  stamp.textContent = a.inUse ? 'IN USE' : 'UNUSED';
  stage.appendChild(stamp);
  if (a.kind==='clip' && a.pn>1) {
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'tile-play';
    play.textContent = 'Play';
    play.setAttribute('aria-pressed', 'false');
    play.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const p = stage._player;
      if (!p) bindStage(stage);
      const player = stage._player;
      if (!player) return;
      player.playing = !player.playing;
      if (!player.playing) player.setFrame(0);
      play.textContent = player.playing ? 'Pause' : 'Play';
      play.classList.toggle('on', player.playing);
      play.setAttribute('aria-pressed', player.playing ? 'true' : 'false');
    });
    stage.appendChild(play);
    bindPreviewGestures(el, stage);
  }
  const open = () => { if (el._skipOpen) { el._skipOpen = false; return; } openSheet(a); };
  el.addEventListener('click', open);
  el.addEventListener('keydown', (ev) => { if (ev.key==='Enter' || ev.key===' ') { ev.preventDefault(); open(); } });
  return el;
}
function bindPreviewGestures(card, stage){
  let holdT = 0;
  let held = false;
  const start = () => {
    if (!stage._player) bindStage(stage);
    const p = stage._player;
    if (!p || p.n<2 || reduceMotion) return;
    p.playing = true;
    p.last = 0;
    const btn = stage.querySelector('.tile-play');
    if (btn) { btn.textContent = 'Pause'; btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); }
  };
  const stop = () => {
    if (canAutoplay()) return;
    const p = stage._player;
    if (!p) return;
    p.playing = false;
    p.setFrame(0);
    const btn = stage.querySelector('.tile-play');
    if (btn) { btn.textContent = 'Play'; btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); }
  };
  card.addEventListener('mouseenter', () => {
    let hover = false;
    try { hover = window.matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
    if (hover) start();
  });
  card.addEventListener('mouseleave', stop);
  card.addEventListener('touchstart', () => {
    held = false;
    clearTimeout(holdT);
    holdT = setTimeout(() => { held = true; start(); }, 180);
  }, {passive:true});
  const endHold = () => {
    clearTimeout(holdT);
    if (held) {
      stop();
      card._skipOpen = true;
    }
  };
  card.addEventListener('touchend', endHold);
  card.addEventListener('touchcancel', endHold);
}
let detail = null;
function uniqueClips(a){
  const names = [];
  (a.clips||[]).forEach(c => { if (names.indexOf(c.clip)<0) names.push(c.clip); });
  return names;
}
function dirsFor(a, clip){
  return (a.clips||[]).filter(c => c.clip===clip).map(c => c.dir);
}
function findClip(a, clip, dir){
  return (a.clips||[]).find(c => c.clip===clip && c.dir===dir)
    || (a.clips||[]).find(c => c.clip===clip)
    || null;
}
function openSheet(a){
  const list = filtered();
  const idx = Math.max(0, list.findIndex(x => x.id===a.id));
  const d = decisions[a.id] || { action:'keep', notes:'' };
  const clips = uniqueClips(a);
  const start = findClip(a, a.mainClip || clips[0], a.mainDir) || a.clips[0];
  const panel = document.getElementById('sheetPanel');
  panel.innerHTML =
    '<div class="nav">' +
      '<button type="button" id="sheetPrevItem">Prev</button>' +
      '<button type="button" id="sheetClose">Close</button>' +
      '<button type="button" id="sheetNextItem">Next</button>' +
    '</div>' +
    '<div class="preview '+(a.bg==='room'?'room':'checker')+'" id="sheetPrev"></div>' +
    '<div class="pick" id="clipPick"></div>' +
    '<div class="pick" id="dirPick"></div>' +
    '<div class="tools">' +
      '<button type="button" id="playBtn" aria-pressed="false">Play</button>' +
      '<button type="button" data-zoom="1">1×</button>' +
      '<button type="button" data-zoom="2" class="on">2×</button>' +
      '<button type="button" data-zoom="4">4×</button>' +
      '<button type="button" id="rawBtn" aria-pressed="false">Show raw sheet</button>' +
    '</div>' +
    '<input type="range" id="scrub" min="0" max="0" value="0" aria-label="Frame">' +
    '<div class="film" id="film"></div>' +
    '<div class="icon-grid" id="iconGrid"></div>' +
    '<div class="meta"><b>'+a.id+'</b><br>'+
    (a.inUse?'IN USE':'UNUSED')+' · '+a.category+' · '+a.type+' · '+a.theme+' · '+a.placement+'<br>'+
    a.w+'×'+a.h+' · disk '+mb(a.disk)+' MB · decoded '+mb(a.decoded)+' MB<br>'+
    'score '+(a.score==null?'—':a.score+'/28')+' · usedBy '+(a.usedBy[0]||'—')+
    (a.usedBy.length>1?' +'+(a.usedBy.length-1):'')+'<br>'+a.path+'</div>' +
    '<span class="badge '+a.display+'">'+a.display+'</span>' +
    '<div class="dec">' +
      ['keep','use','needs-restyle','remove'].map(x =>
        '<button type="button" data-act="'+x+'"'+(d.action===x?' class="on"':'')+'>'+x+'</button>').join('') +
    '</div>' +
    '<textarea id="sheetNotes" placeholder="notes">'+((d.notes||'').replace(/</g,'&lt;'))+'</textarea>';
  document.getElementById('sheet').classList.add('show');
  const host = document.getElementById('sheetPrev');
  detail = {
    a, list, idx,
    clip: start ? start.clip : '',
    dir: start ? start.dir : '',
    zoom: 2,
    raw: false,
    playing: false,
    player: null,
    iconI: 0
  };
  paintDetail();
  document.getElementById('sheetClose').onclick = closeSheet;
  document.getElementById('sheetPrevItem').onclick = () => stepItem(-1);
  document.getElementById('sheetNextItem').onclick = () => stepItem(1);
  panel.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      decisions[a.id] = { action: btn.getAttribute('data-act'), notes: document.getElementById('sheetNotes').value };
      save();
      panel.querySelectorAll('[data-act]').forEach(b => b.classList.toggle('on', b===btn));
      render();
    });
  });
  document.getElementById('sheetNotes').addEventListener('change', (ev) => {
    decisions[a.id] = { action: (decisions[a.id]&&decisions[a.id].action)||'keep', notes: ev.target.value };
    save();
  });
  document.getElementById('playBtn').onclick = () => {
    if (!detail || !detail.player) return;
    detail.playing = !detail.playing;
    detail.player.playing = detail.playing;
    document.getElementById('playBtn').textContent = detail.playing ? 'Pause' : 'Play';
    document.getElementById('playBtn').setAttribute('aria-pressed', detail.playing ? 'true' : 'false');
  };
  document.getElementById('rawBtn').onclick = () => {
    if (!detail) return;
    detail.raw = !detail.raw;
    document.getElementById('rawBtn').setAttribute('aria-pressed', detail.raw ? 'true' : 'false');
    document.getElementById('rawBtn').classList.toggle('on', detail.raw);
    paintDetail();
  };
  panel.querySelectorAll('[data-zoom]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!detail) return;
      detail.zoom = Number(btn.getAttribute('data-zoom'))||1;
      panel.querySelectorAll('[data-zoom]').forEach(b => b.classList.toggle('on', b===btn));
      paintDetail();
    });
  });
  document.getElementById('scrub').addEventListener('input', (ev) => {
    if (!detail || !detail.player) return;
    detail.playing = false;
    detail.player.playing = false;
    document.getElementById('playBtn').textContent = 'Play';
    detail.player.setFrame(Number(ev.target.value)||0);
    paintFilm(detail.player.i);
  });
  bindSwipe(host);
}
function stepItem(delta){
  if (!detail) return;
  const next = detail.list[detail.idx + delta];
  if (!next) return;
  openSheet(next);
}
function paintChips(box, values, current, labelFn, onPick){
  box.innerHTML = '';
  values.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = labelFn(v);
    if (v===current) b.className = 'on';
    b.addEventListener('click', () => onPick(v));
    box.appendChild(b);
  });
}
function paintFilm(i){
  const film = document.getElementById('film');
  if (!film || !detail) return;
  const c = findClip(detail.a, detail.clip, detail.dir);
  if (!c) { film.innerHTML=''; return; }
  film.innerHTML = '';
  for (let f=0; f<c.n; f++){
    const b = document.createElement('button');
    b.type = 'button';
    if (f===i) b.className = 'on';
    const cell = document.createElement('div');
    cell.className = 'cell';
    applySprite(cell, c.strip, c.w, c.h, c.n, f, 1);
    cell.style.width = '44px';
    cell.style.height = '44px';
    const s = Math.max(0.2, Math.min(44/c.w, 44/c.h));
    cell.style.backgroundSize = (c.w*c.n*s)+'px '+(c.h*s)+'px';
    cell.style.backgroundPosition = (-f*c.w*s)+'px '+((44-c.h*s)/2)+'px';
    b.appendChild(cell);
    b.addEventListener('click', () => {
      if (!detail.player) return;
      detail.playing = false;
      detail.player.playing = false;
      document.getElementById('playBtn').textContent = 'Play';
      detail.player.setFrame(f);
      document.getElementById('scrub').value = String(f);
      paintFilm(f);
    });
    film.appendChild(b);
  }
}
function paintDetail(){
  if (!detail) return;
  const a = detail.a;
  const host = document.getElementById('sheetPrev');
  if (detail.player) { players.delete(detail.player); detail.player = null; }
  host.innerHTML = '';
  const clipPick = document.getElementById('clipPick');
  const dirPick = document.getElementById('dirPick');
  const iconGrid = document.getElementById('iconGrid');
  const film = document.getElementById('film');
  const scrub = document.getElementById('scrub');
  const playBtn = document.getElementById('playBtn');
  if (detail.raw) {
    const img = document.createElement('img');
    img.alt = a.id+' raw sheet';
    img.src = (!PORTABLE && a.rel) ? a.rel : (a.sheet || a.preview);
    img.onerror = () => { img.onerror = null; img.src = a.sheet || a.preview; };
    host.appendChild(img);
    clipPick.innerHTML = '';
    dirPick.innerHTML = '';
    film.innerHTML = '';
    iconGrid.innerHTML = '';
    return;
  }
  if (a.kind==='icons' && a.icons && a.icons.length) {
    const ic = a.icons[detail.iconI] || a.icons[0];
    const img = document.createElement('img');
    img.src = ic.src; img.alt = a.id;
    img.style.width = (ic.w*detail.zoom)+'px';
    img.style.height = (ic.h*detail.zoom)+'px';
    host.appendChild(img);
    iconGrid.innerHTML = '';
    a.icons.forEach((x, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (i===detail.iconI) b.className = 'on';
      const im = document.createElement('img');
      im.src = x.src; im.alt = '';
      b.appendChild(im);
      b.addEventListener('click', () => { detail.iconI = i; paintDetail(); });
      iconGrid.appendChild(b);
    });
    clipPick.innerHTML = '';
    dirPick.innerHTML = '';
    film.innerHTML = '';
    return;
  }
  const c = findClip(a, detail.clip, detail.dir);
  if (c && c.n) {
    const box = host.getBoundingClientRect();
    const z = fitZoom(c.w, c.h, Math.max(120, box.width-16), Math.max(160, box.height-16), detail.zoom);
    detail.player = makeAnim(host, c.strip, c.w, c.h, c.n, c.ms, z, detail.playing);
    scrub.max = String(Math.max(0, c.n-1));
    scrub.value = '0';
    playBtn.style.display = c.n>1 ? '' : 'none';
    playBtn.textContent = detail.playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', detail.playing ? 'true' : 'false');
    paintChips(clipPick, uniqueClips(a), detail.clip, clipLabel, (name) => {
      detail.clip = name;
      const dirs = dirsFor(a, name);
      detail.dir = dirs.indexOf(detail.dir)>=0 ? detail.dir : (dirs.find(d=>d==='south')||dirs.find(d=>d==='east')||dirs[0]);
      paintDetail();
    });
    paintChips(dirPick, dirsFor(a, detail.clip), detail.dir, (d)=> dirLabel(d)||d, (dir) => {
      detail.dir = dir;
      paintDetail();
    });
    paintFilm(0);
    iconGrid.innerHTML = '';
    return;
  }
  if (a.preview) {
    const img = document.createElement('img');
    img.src = a.preview; img.alt = a.id;
    img.style.width = (a.pw*detail.zoom)+'px';
    img.style.height = (a.ph*detail.zoom)+'px';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '46vh';
    host.appendChild(img);
  }
  clipPick.innerHTML = '';
  dirPick.innerHTML = '';
  film.innerHTML = '';
  iconGrid.innerHTML = '';
}
function bindSwipe(host){
  let x0=0, y0=0, t0=0, armed=false;
  host.addEventListener('touchstart', (ev) => {
    const t = ev.changedTouches[0];
    x0=t.clientX; y0=t.clientY; t0=Date.now(); armed=true;
  }, {passive:true});
  host.addEventListener('touchend', (ev) => {
    if (!armed || !detail) return;
    armed=false;
    const t = ev.changedTouches[0];
    const dx=t.clientX-x0, dy=t.clientY-y0;
    if (Math.abs(dx)<36 || Math.abs(dx)<Math.abs(dy)) return;
    if (detail.player && detail.a.kind==='clip' && !detail.raw) {
      detail.playing=false; detail.player.playing=false;
      document.getElementById('playBtn').textContent='Play';
      detail.player.setFrame(detail.player.i + (dx<0?1:-1));
      document.getElementById('scrub').value=String(detail.player.i);
      paintFilm(detail.player.i);
    } else if (detail.a.kind==='icons') {
      const n=detail.a.icons.length;
      detail.iconI = (detail.iconI + (dx<0?1:-1) + n) % n;
      paintDetail();
    }
  }, {passive:true});
  let sx=0, sy=0, sArmed=false;
  const panel = document.getElementById('sheetPanel');
  panel.addEventListener('touchstart', (ev) => {
    if (ev.target.closest('#sheetPrev,.film,input,textarea')) { sArmed=false; return; }
    const t=ev.changedTouches[0]; sx=t.clientX; sy=t.clientY; sArmed=true;
  }, {passive:true});
  panel.addEventListener('touchend', (ev) => {
    if (!sArmed) return;
    sArmed=false;
    const t=ev.changedTouches[0];
    const dx=t.clientX-sx, dy=t.clientY-sy;
    if (Math.abs(dx)<56 || Math.abs(dx)<Math.abs(dy)*1.2) return;
    stepItem(dx<0?1:-1);
  }, {passive:true});
}
function closeSheet(){
  if (detail && detail.player) players.delete(detail.player);
  detail = null;
  document.getElementById('sheet').classList.remove('show');
}
document.getElementById('sheet').addEventListener('click', (ev) => { if (ev.target.id==='sheet') closeSheet(); });
document.addEventListener('keydown', (ev) => {
  if (!document.getElementById('sheet').classList.contains('show') || !detail) return;
  if (ev.key==='Escape') { closeSheet(); return; }
  if (ev.key==='ArrowLeft' && ev.shiftKey) { stepItem(-1); ev.preventDefault(); return; }
  if (ev.key==='ArrowRight' && ev.shiftKey) { stepItem(1); ev.preventDefault(); return; }
  if (ev.key==='ArrowLeft' && detail.player) { detail.player.setFrame(detail.player.i-1); document.getElementById('scrub').value=String(detail.player.i); paintFilm(detail.player.i); ev.preventDefault(); }
  if (ev.key==='ArrowRight' && detail.player) { detail.player.setFrame(detail.player.i+1); document.getElementById('scrub').value=String(detail.player.i); paintFilm(detail.player.i); ev.preventDefault(); }
  if (ev.key===' ') { document.getElementById('playBtn').click(); ev.preventDefault(); }
});
function render(){
  const grid = document.getElementById('grid');
  if (lazyStage.io) lazyStage.io.disconnect();
  players.clear();
  grid.innerHTML = '';
  const list = filtered();
  list.forEach(a => grid.appendChild(card(a)));
}
(function fillFilters(){
  const themes = [...new Set(DATA.items.map(a => a.theme))].sort();
  for (const t of themes) document.getElementById('theme').append(new Option(t,t));
  const counts = {};
  const used = {};
  for (const a of DATA.items) {
    counts[a.category] = (counts[a.category]||0)+1;
    if (a.inUse) used[a.category] = (used[a.category]||0)+1;
  }
  const cats = document.getElementById('cats');
  const usageBox = document.getElementById('usage');
  const allN = DATA.items.length;
  const allUsed = DATA.items.filter(a => a.inUse).length;
  const mk = (id, label, nUse, nOff) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip'+(cat===id?' on':'');
    b.setAttribute('role','tab');
    b.setAttribute('aria-selected', cat===id ? 'true' : 'false');
    b.innerHTML = label+' <b class="use">'+nUse+'</b>/<span class="off">'+nOff+'</span>';
    b.addEventListener('click', () => { cat = id; paintCats(); paintUsage(); render(); });
    return b;
  };
  function paintCats(){
    cats.innerHTML = '';
    cats.appendChild(mk('', 'All', allUsed, allN-allUsed));
    for (const c of CAT_ORDER) {
      const n = counts[c]||0;
      if (!n && c==='misc') continue;
      cats.appendChild(mk(c, CAT_LABEL[c]||c, used[c]||0, n-(used[c]||0)));
    }
  }
  function paintUsage(){
    usageBox.innerHTML = '';
    const pool = cat ? DATA.items.filter(a => a.category===cat) : DATA.items;
    const u = pool.filter(a => a.inUse).length;
    const n = pool.length - u;
    const mkU = (id, label, count) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip'+(usage===id?' on':'');
      b.setAttribute('aria-pressed', usage===id ? 'true' : 'false');
      b.innerHTML = label+' <b>'+count+'</b>';
      b.addEventListener('click', () => { usage = id; paintUsage(); render(); });
      return b;
    };
    usageBox.appendChild(mkU('all', 'All in category', pool.length));
    usageBox.appendChild(mkU('in-use', 'In use', u));
    usageBox.appendChild(mkU('unused', 'Unused', n));
  }
  function paintAutoplay(){
    const box = document.getElementById('autoplayRow');
    box.innerHTML = '';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip'+(canAutoplay()?' on':'');
    b.setAttribute('aria-pressed', canAutoplay() ? 'true' : 'false');
    b.textContent = 'Autoplay previews';
    b.addEventListener('click', () => {
      autoplay = !autoplay;
      if (reduceMotion) autoplay = false;
      saveAutoplay();
      paintAutoplay();
      setGridPlaying(canAutoplay());
    });
    box.appendChild(b);
  }
  paintCats();
  paintUsage();
  paintAutoplay();
})();
['q','status','theme','sort'].forEach(id => document.getElementById(id).addEventListener('input', render));
document.getElementById('dupBtn').addEventListener('click', () => {
  const box = document.getElementById('dupes');
  box.hidden = !box.hidden;
  const body = document.getElementById('dupBody');
  body.innerHTML = DATA.dupes.map(d => '<tr><td>'+d.hash.slice(0,8)+'</td><td>'+d.ids.join(', ')+'</td><td>'+mb(d.bytes)+' MB</td></tr>').join('') || '<tr><td colspan=3>none</td></tr>';
});
async function exportDecisions(){
  const text = JSON.stringify(payload(), null, 2);
  const file = new File([text], 'art-decisions.json', { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'ATO art decisions' });
      toast('Shared art-decisions.json');
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    if (navigator.share) {
      await navigator.share({ title: 'ATO art decisions', text: text });
      toast('Shared decisions');
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = 'art-decisions.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Downloaded art-decisions.json');
}
function mergeDecisions(incoming){
  const src = incoming && incoming.decisions ? incoming.decisions : incoming;
  if (!src || typeof src !== 'object') throw new Error('not a decisions file');
  let n = 0;
  for (const [id, d] of Object.entries(src)) {
    if (!d || typeof d !== 'object') continue;
    decisions[id] = { action: d.action || 'keep', notes: d.notes || '' };
    n++;
  }
  save();
  render();
  toast('Imported '+n+' decision'+(n===1?'':'s'));
}
document.getElementById('exportBtn').addEventListener('click', () => { exportDecisions().catch(() => toast('Export failed')); });
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (ev) => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { mergeDecisions(JSON.parse(String(reader.result))); }
    catch (e) { toast('Import failed: not valid JSON'); }
  };
  reader.readAsText(file);
});
renderStats();
render();
</script>
</html>
`;
}

main();
