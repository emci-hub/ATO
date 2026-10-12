/**
 * npm run art:catalog
 *   writes ART_LIBRARY.md + assets/art/_contact/library.html
 * npm run art:catalog -- --portable
 *   also writes library-portable.html — one self-contained file (thumbs inlined)
 *   for iPhone / Airdrop / static host. Target < 25 MB.
 *
 * Viewer: Metro-blocked. Open file:// or host the portable HTML.
 * Visual language from scripts/sprite-gallery/page.html (Streetwear Skin).
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import type { ArtAsset, ArtRegistry } from '../src/art/registry.types';
import { ART_CATEGORIES, ART_CATEGORY_LABELS } from '../src/art/registry.types';
import { readPng } from './art-png';

const repo = path.resolve(__dirname, '..');
const PORTABLE = process.argv.includes('--portable');
const THUMB_LOCAL = 48;
const THUMB_PORTABLE = 64;
const PORTABLE_CAP_BYTES = 25 * 1048576;

function nearestThumb(src: PNG, max: number): PNG {
  const w = Math.max(1, Math.min(max, src.width));
  const h = Math.max(1, Math.min(max, Math.round((src.height * w) / Math.max(src.width, 1)) || 1));
  const out = new PNG({ width: w, height: h, fill: true });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w));
      const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h));
      src.data.copy(out.data, (y * w + x) * 4, (sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4);
    }
  }
  return out;
}

function thumbDataUri(file: string, max: number): string {
  if (!fs.existsSync(file) || !file.toLowerCase().endsWith('.png')) return '';
  try {
    const buf = PNG.sync.write(nearestThumb(readPng(file), max), { deflateLevel: 9 });
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function displayStatus(a: ArtAsset): string {
  if (a.status === 'archived' || a.status === 'deprecated') return 'orphan';
  if (a.status === 'needs-restyle') return 'needs-restyle';
  if (a.status === 'alt-skin') return 'alt-skin';
  if (a.inUse || (a.usedBy ?? []).length > 0) return 'in-use';
  if (a.status === 'resource') return 'resource';
  return 'resource';
}

function clipPreview(a: ArtAsset): { image: string; frames: { x: number; y: number; w: number; h: number; ms: number; clip: string }[] } | null {
  if (!a.atlas) return null;
  const jsonPath = path.join(repo, a.atlas.json);
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration?: number; clip?: string }>;
    };
    const frames = Object.entries(j.frames)
      .slice(0, 64)
      .map(([key, f]) => ({
        x: f.frame.x,
        y: f.frame.y,
        w: f.frame.w,
        h: f.frame.h,
        ms: f.duration ?? 100,
        clip: f.clip ?? key,
      }));
    const rel = path.posix.relative(
      '_contact',
      path.relative(path.join(repo, 'assets/art'), path.join(repo, a.path)).split(path.sep).join('/'),
    );
    return { image: rel.startsWith('.') ? rel : `../${rel}`, frames };
  } catch {
    return null;
  }
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
  thumb: string;
  restyle: ArtAsset['restyle'] | null;
  anim: ReturnType<typeof clipPreview>;
  md5: string;
  inUse: boolean;
};

function buildItems(registry: ArtRegistry, thumbPx: number, includeAnim: boolean): CatalogItem[] {
  const items: CatalogItem[] = [];
  for (const a of registry.assets) {
    const notes = a.notes ?? '';
    const md5 = notes.startsWith('md5:') ? notes.slice(4) : '';
    const rel = path.posix.relative(
      '_contact',
      path.relative(path.join(repo, 'assets/art'), a.path).split(path.sep).join('/'),
    );
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
      thumb: thumbDataUri(path.join(repo, a.path), thumbPx),
      restyle: a.restyle ?? null,
      anim: includeAnim ? clipPreview(a) : null,
      md5,
      inUse: a.inUse || (a.usedBy ?? []).length > 0,
    });
  }
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

function main() {
  const registry = JSON.parse(fs.readFileSync(path.join(repo, 'assets/art/registry.json'), 'utf8')) as ArtRegistry;
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

  const contactDir = path.join(repo, 'assets/art/_contact');
  fs.mkdirSync(contactDir, { recursive: true });

  const md: string[] = [
    '# ATO art library',
    '',
    `Generated. ${live.length} live entries.`,
    'Open `assets/art/_contact/library.html` (desktop / file://) or `library-portable.html` on a phone.',
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

  const localItems = buildItems(registry, THUMB_LOCAL, true);
  const localData = { generatedAt: new Date().toISOString(), portable: false, items: localItems, dupes: dupeGroups(localItems) };
  fs.writeFileSync(path.join(contactDir, 'library.html'), viewerHtml(localData, false));

  let portableBytes = 0;
  if (PORTABLE) {
    let max = THUMB_PORTABLE;
    let portableItems = buildItems(registry, max, false);
    let html = viewerHtml({ generatedAt: new Date().toISOString(), portable: true, items: portableItems, dupes: dupeGroups(portableItems) }, true);
    while (Buffer.byteLength(html) > PORTABLE_CAP_BYTES && max > 24) {
      max = Math.max(24, Math.floor(max * 0.75));
      portableItems = buildItems(registry, max, false);
      html = viewerHtml({ generatedAt: new Date().toISOString(), portable: true, items: portableItems, dupes: dupeGroups(portableItems) }, true);
    }
    const out = path.join(contactDir, 'library-portable.html');
    fs.writeFileSync(out, html);
    portableBytes = fs.statSync(out).size;
    console.log(`portable ${out} ${(portableBytes / 1048576).toFixed(2)} MB (thumb ${max}px)`);
    if (portableBytes > PORTABLE_CAP_BYTES) {
      console.warn(`WARN portable ${(portableBytes / 1048576).toFixed(2)} MB over the 25 MB target`);
    }
  }

  fs.writeFileSync(path.join(repo, 'tools/art-viewer/README.md'), viewerReadme());
  console.log(`art:catalog ${live.length} entries, local viewer ${localItems.length} items`);
}

function viewerReadme(): string {
  return `# Art library viewer

## Open it
- Desktop / Windows: double-click \`assets/art/_contact/library.html\` (file://, no server).
- iPhone: run \`npm run art:catalog -- --portable\`, then AirDrop / host
  \`assets/art/_contact/library-portable.html\`. One file; thumbs are inlined.
  Add to Home Screen from Safari for a full-screen library.

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
:root { color-scheme: dark; --bg:#1d1d20; --panel:#26262a; --tile:#141416; --line:#3a3a3f; --fg:#f2ede4; --muted:#a9a49b; --mustard:#e0a526; --red:#c8202b; --ok:#6aa84f; --tap:48px; }
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
select { flex:1 1 140px; min-height:var(--tap); background:var(--tile); color:var(--fg); border:1px solid var(--line); padding:8px 10px; }
button { min-height:var(--tap); background:transparent; color:var(--fg); border:1px solid var(--line); padding:10px 14px; cursor:pointer; touch-action:manipulation; }
button.on, button[aria-pressed=true] { background:var(--mustard); color:#1d1d20; border-color:var(--mustard); font-weight:700; }
.actions { display:flex; flex-wrap:wrap; gap:8px; width:100%; }
.actions button { flex:1 1 140px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; padding:12px 12px 96px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:8px; display:grid; gap:6px; min-width:0; min-height:var(--tap); touch-action:manipulation; }
.card:active { border-color:var(--mustard); }
.stage { background:var(--tile); min-height:88px; display:grid; place-items:center; border-radius:4px; overflow:hidden; position:relative; }
.stamp { position:absolute; top:6px; left:6px; font:700 9px/1 ui-monospace,Consolas,monospace; letter-spacing:.04em; text-transform:uppercase; padding:4px 6px; border-radius:3px; }
.stamp.yes { background:var(--ok); color:#0e1a0c; }
.stamp.no { background:#3a3a3f; color:var(--muted); }
.stage img, .stage canvas { image-rendering:pixelated; image-rendering:crisp-edges; max-width:100%; max-height:120px; }
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
#sheet .panel { position:absolute; left:0; right:0; bottom:0; max-height:92%; overflow:auto; -webkit-overflow-scrolling:touch; background:var(--panel); border-radius:16px 16px 0 0; padding:16px 16px calc(20px + env(safe-area-inset-bottom)); display:grid; gap:10px; }
#sheet .preview { background:var(--tile); min-height:160px; display:grid; place-items:center; border-radius:8px; }
#sheet .preview img { image-rendering:pixelated; max-width:100%; max-height:50vh; }
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
  #sheet .panel { left:50%; right:auto; top:6%; bottom:6%; width:min(520px,92vw); transform:translateX(-50%); border-radius:12px; max-height:none; }
}
@media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
</style>
<header>
  <h1>ATO <span>art library</span></h1>
  <p class="lede">Tap a tile to open it. Decisions stay on this device (localStorage). Export / Share writes <code>art-decisions.json</code>; Import merges one. ${portable ? 'Portable build — thumbs are inlined, no extra files.' : 'Local build — zoom can load the full PNG next to this page.'} Visual language from the Streetwear Skin gallery.</p>
  <div class="stats" id="stats"></div>
</header>
<div class="bar">
  <div class="cats" id="cats" role="tablist" aria-label="Categories"></div>
  <div class="usage" id="usage" role="group" aria-label="In use or unused"></div>
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
const CAT_ORDER = ${JSON.stringify([...ART_CATEGORIES])};
const CAT_LABEL = ${JSON.stringify(ART_CATEGORY_LABELS)};
let cat = '';
let usage = 'all';
let decisions = {};
try { decisions = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { decisions = {}; }
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
function paintStage(stage, a, animate){
  stage.innerHTML = '';
  if (animate && !PORTABLE && a.anim && a.anim.frames && a.anim.frames.length) {
    const c = document.createElement('canvas');
    const f0 = a.anim.frames[0];
    c.width = f0.w; c.height = f0.h;
    stage.appendChild(c);
    const img = new Image();
    img.onload = () => {
      let i = 0;
      const ctx = c.getContext('2d');
      const tick = () => {
        if (!c.isConnected) return;
        const f = a.anim.frames[i % a.anim.frames.length];
        c.width = f.w; c.height = f.h;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0,0,f.w,f.h);
        ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
        i++;
        setTimeout(tick, f.ms || 100);
      };
      tick();
    };
    img.src = a.anim.image;
    return;
  }
  if (a.thumb) {
    const img = document.createElement('img');
    img.src = a.thumb; img.alt = a.id;
    stage.appendChild(img);
  }
}
function card(a){
  const d = decisions[a.id] || { action:'keep', notes:'' };
  const el = document.createElement('article');
  el.className = 'card';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.innerHTML = '<div class="stage"></div><div class="meta"><b>'+a.id+'</b></div><span class="badge '+(a.inUse?'in-use':'resource')+'">'+(a.inUse?'in use':'unused')+'</span> <span class="badge '+a.display+'">'+a.display+(d.action&&d.action!=='keep'?' · '+d.action:'')+'</span>';
  paintStage(el.querySelector('.stage'), a, false);
  const stamp = document.createElement('span');
  stamp.className = 'stamp '+(a.inUse?'yes':'no');
  stamp.textContent = a.inUse ? 'IN USE' : 'UNUSED';
  el.querySelector('.stage').appendChild(stamp);
  const open = () => openSheet(a);
  el.addEventListener('click', open);
  el.addEventListener('keydown', (ev) => { if (ev.key==='Enter' || ev.key===' ') { ev.preventDefault(); open(); } });
  return el;
}
function openSheet(a){
  const d = decisions[a.id] || { action:'keep', notes:'' };
  const panel = document.getElementById('sheetPanel');
  panel.innerHTML =
    '<button type="button" id="sheetClose">Close</button>' +
    '<div class="preview" id="sheetPrev"></div>' +
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
  paintStage(document.getElementById('sheetPrev'), a, true);
  const zoomImg = document.querySelector('#sheetPrev img');
  if (zoomImg && !PORTABLE && a.rel) {
    const full = new Image();
    full.alt = a.id;
    full.onload = () => { zoomImg.src = a.rel; };
    full.src = a.rel;
  }
  document.getElementById('sheet').classList.add('show');
  document.getElementById('sheetClose').onclick = closeSheet;
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
}
function closeSheet(){ document.getElementById('sheet').classList.remove('show'); }
document.getElementById('sheet').addEventListener('click', (ev) => { if (ev.target.id==='sheet') closeSheet(); });
function render(){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const list = filtered();
  const cap = 400;
  list.slice(0, cap).forEach(a => grid.appendChild(card(a)));
  if (list.length > cap) {
    const more = document.createElement('p');
    more.className = 'lede';
    more.style.gridColumn = '1/-1';
    more.textContent = 'Showing '+cap+' of '+list.length+' — refine search.';
    grid.appendChild(more);
  }
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
  paintCats();
  paintUsage();
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
