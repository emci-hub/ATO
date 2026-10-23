/**
 * Animation library manifest (library step 1, read-only; docs/ANIMATION-AUDIT-P1.md §5).
 *
 *   npm run anim:library              regenerate assets/art/animations/library.json
 *   npm run check:animation-library   offline check (in the ota-gate): the committed
 *                                     manifest is fresh and every animated clip in the
 *                                     legacy sheets is in it
 *
 * One manifest built ONLY from data that already exists:
 *   - assets/art/legacy-play-sheets.json     which clips/directions/frames exist
 *   - assets/play/sheets/streetwear/meta.json  anchors (footAt/groundAt), FX/aura/ambient fps
 *   - assets/play/skins/*\/skin.json, src/play/data/heroes.json   which clip fills which slot
 *   - CAST_ACTOR_FRAME_MS (src/play/cast-actor.ts)   Avatar / path / tower cadence
 *   - PET_FRAME_MS (src/play/pet-actor.ts)           pet cadence; pets are listed under
 *                                                    the hero/creep their line draws
 *
 * Sorted character -> category (idle / locomotion / combat / reaction) -> clip -> direction.
 * `ms[]` starts flat (one value per frame); per-frame holds are a later step.
 * Nothing in src/ reads this yet: the legacy PLAY_SHEETS stays the source.
 */
import fs from 'node:fs';
import path from 'node:path';

import { CAST_ACTOR_FRAME_MS } from '../src/play/cast-actor';
import { PET_FRAME_MS, PET_SLEEP_SLOWDOWN } from '../src/play/pet-actor';
import { petLines, type PetLook } from '../src/play/pet';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets/art/animations/library.json');
const rd = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/* ------------------------------------------------------------- types --- */

type Rect = { x: number; y: number; w: number; h: number };
type Legacy = Record<
  string,
  { sheet: string; frames: Record<string, Rect>; ms?: number; dirs?: string[]; sourceW?: number; sourceH?: number }
>;

export const CATEGORIES = ['idle', 'locomotion', 'combat', 'reaction'] as const;
type Category = (typeof CATEGORIES)[number];

/** Slot a clip fills -> category. Slots are the runtime's names (idle/walk/dash/…). */
const SLOT_CATEGORY: Record<string, Category> = {
  idle: 'idle',
  walk: 'locomotion',
  run: 'locomotion',
  dash: 'locomotion',
  attack: 'combat',
  skill: 'combat',
  hurt: 'reaction',
  faint: 'reaction',
  death: 'reaction',
};
/** Loops; everything else is a one-shot. */
const LOOP_SLOTS = new Set(['idle', 'walk', 'run']);

/**
 * Reduced-motion tag, read off src/play/play-motion.ts (cosmeticsStill = Off
 * freezes cosmetics; walk/auras/room life keep running; gameplay clips never freeze):
 *   hold-first  cosmetic loop that freezes on frame 0 when Motion is Off
 *   play        gameplay clip (walk, attacks, hurt, death…): never frozen
 *   skip        decorative one-shot (FX burst) that may be dropped
 */
type ReducedMotion = 'hold-first' | 'play' | 'skip';
const reducedFor = (slot: string): ReducedMotion => (slot === 'idle' ? 'hold-first' : 'play');

/* ------------------------------------------------------------ sources --- */

const legacy: Legacy = rd('assets/art/legacy-play-sheets.json');
const meta = rd('assets/play/sheets/streetwear/meta.json');
const heroesJson: { id: string; clips: Record<string, string> }[] = rd('src/play/data/heroes.json');
const skinRoles: Record<string, Record<string, any>> = {
  cast: rd('assets/play/skins/cast/skin.json').roles,
  streetwear: rd('assets/play/skins/streetwear/skin.json').roles,
};

/** Legacy keys that are NOT animation clips, with the reason. A legacy key that is
 * neither here nor in the manifest fails the check. */
function exclusion(key: string): string | null {
  const p = key.split('/');
  if (p[p.length - 1] === 'rotations') return 'rotations: static 8-direction poses';
  if (p[1] === 'kenney-td') return 'kenney-td: static tile atlas (off-style, needs-restyle)';
  if (p[1] === 'streetwear' && p[2] === 'swords') return 'swords: one still per element (not a clip)';
  const dirCounts = Object.values(dirsOf(legacy[key].frames)).map((d) => d.frames);
  if (Math.max(...dirCounts) <= 1) return 'still: one frame per direction (board layers, ui-kit pieces)';
  return null;
}

/* ---------------------------------------------------------- helpers --- */

type DirInfo = { frames: number; first: string };

/** Direction -> frame count, from keys like `east/frame_003`; flat `frame_003` = no direction. */
function dirsOf(frames: Record<string, Rect>): Record<string, DirInfo> {
  const out: Record<string, DirInfo> = {};
  for (const k of Object.keys(frames).sort()) {
    const m = /^(.*)\/(frame_\d+)$/.exec(k);
    const dir = m ? m[1] : 'none';
    out[dir] ??= { frames: 0, first: k };
    out[dir].frames += 1;
  }
  return out;
}

const flat = (frames: number, ms: number): number[] => Array.from({ length: frames }, () => ms);
const round = (n: number): number => Math.round(n * 10000) / 10000;

/** Cadence modes a group plays, in priority order. */
const MODES: Record<string, ('avatar' | 'path' | 'tower')[]> = {
  heroes: ['avatar', 'tower'],
  creeps: ['path', 'avatar'],
  boss: ['path', 'avatar'],
  towers: ['tower'],
};

function timingFor(group: string, slot: string | null, legacyMs: number | undefined) {
  if (slot) {
    if ((slot === 'walk' || slot === 'run') && MODES[group]?.[0] === 'path') {
      return { ms: legacyMs ?? 100, source: 'ground-travel' }; // a walker's frames track distance, not time
    }
    for (const mode of MODES[group] ?? []) {
      const v = (CAST_ACTOR_FRAME_MS[mode] as Record<string, number | undefined>)[slot];
      if (v != null) return { ms: v, source: `cast-actor:${mode}` };
    }
  }
  return legacyMs != null ? { ms: legacyMs, source: 'legacy-sheet' } : { ms: 100, source: 'default' };
}

/* ------------------------------------------------- slot resolution --- */

const STREETWEAR_SLOT: Record<string, string> = {
  Idle: 'idle', Walk: 'walk', Run: 'run', Dash: 'dash', Attack: 'attack',
  Skill: 'skill', Hurt: 'hurt', Faint: 'faint', Death: 'death',
};

/** Name heuristics for Cast clips no hero/creep slot points at (extra authored clips). */
function guessSlot(name: string): string | null {
  const n = name.toLowerCase();
  if (/idle|breath/.test(n)) return 'idle';
  if (/death|die|fall/.test(n)) return 'death';
  if (/hurt|flinch|stagger/.test(n)) return 'hurt';
  if (/dash|rush|step|teleport|drift|flight/.test(n)) return 'dash';
  if (/run|rush/.test(n)) return 'run';
  if (/walk|jump/.test(n)) return 'walk';
  if (/attack|slash|strike|punch|uppercut|cleave|spear|blast|burst|nova|wave|ritual|skill|drain|bloom|iaijutsu|judgment|kingdom|pick/.test(n)) return 'attack';
  return null;
}

/** slot per Cast clip folder name, for one character. */
function castSlots(group: string, id: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (group === 'heroes') {
    const h = heroesJson.find((x) => x.id === id);
    for (const [slot, clip] of Object.entries(h?.clips ?? {})) out[clip] = slot;
  } else {
    for (const role of Object.values(skinRoles.cast)) {
      if (!role.keys?.[0]?.includes(`/${group}/${id}/`)) continue;
      if (role.walk) out[role.walk.base.split('/').pop()] = 'walk';
      for (const [slot, a] of Object.entries<any>(role.anims ?? {})) out[a.base.split('/').pop()] = slot;
    }
  }
  return out;
}

/* ------------------------------------------------------ pets (source) --- */

const PET_SLOTS = Object.keys(PET_FRAME_MS);
type PetUse = { line: string; stages: string };

function petUses(): Map<string, PetUse[]> {
  const map = new Map<string, PetUse[]>();
  const add = (look: PetLook, line: string, stages: string) => {
    let key: string | null = null;
    if (look.kind === 'hero') key = `heroes/${look.heroId}`;
    else {
      const role = skinRoles.cast[look.role];
      const m = /skins\/cast\/(creeps\/[^/]+)\//.exec(role?.keys?.[0] ?? '');
      key = m ? m[1] : null;
    }
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push({ line, stages });
    map.set(key, list);
  };
  for (const line of petLines()) {
    add(line.young, line.id, 'baby,child');
    add(line.grown, line.id, 'teen,adult,god');
  }
  return map;
}

/* ----------------------------------------------------------- build --- */

type Clip = Record<string, unknown>;
type Tree = Record<string, Record<string, Clip>>;

function buildCharacters() {
  const pets = petUses();
  const chars: Record<string, any> = {};
  const covered = new Set<string>();

  for (const key of Object.keys(legacy).sort()) {
    const p = key.split('/'); // sheets/<skin>/<group>/<id>/<clip>
    if (!['cast', 'streetwear'].includes(p[1]) || !['heroes', 'creeps', 'boss', 'towers'].includes(p[2]) || p.length !== 5) continue;
    if (exclusion(key)) continue;
    const [, skin, group, id, name] = p;
    const entry = legacy[key];
    const slot =
      skin === 'streetwear' ? STREETWEAR_SLOT[name] ?? guessSlot(name) : castSlots(group, id)[name] ?? guessSlot(name);
    const category: Category = slot ? SLOT_CATEGORY[slot] ?? 'combat' : 'combat';
    const dirs = dirsOf(entry.frames);
    const counts = new Set(Object.values(dirs).map((d) => d.frames));
    const frames = Math.max(...counts);
    const first = Object.values(entry.frames)[0];
    const t = timingFor(group, slot, entry.ms);
    const mc = meta.chars?.[`${group}/${id}`];
    const clip: Clip = {
      slot,
      frames,
      ms: flat(frames, t.ms),
      timing: t.source,
      loop: slot ? LOOP_SLOTS.has(slot) : false,
      dirs,
      anchor: skin === 'streetwear' && mc ? { footAt: mc.footAt, groundAt: mc.groundAt } : null,
      cell: entry.sourceW ? { w: entry.sourceW, h: entry.sourceH } : { w: first.w, h: first.h },
      sheet: entry.sheet,
      reducedMotion: slot ? reducedFor(slot) : 'play',
      legacyKey: key,
    };
    if (counts.size > 1) clip.framesPerDir = Object.fromEntries(Object.entries(dirs).map(([d, v]) => [d, v.frames]));
    if (!slot) clip.note = 'extra authored clip: no slot points at it';

    const c = (chars[`${group}/${id}`] ??= { kind: group, id, skins: {} });
    const tree: Tree = ((c.skins[skin] ??= Object.fromEntries(CATEGORIES.map((k) => [k, {}]))) as Tree);
    tree[category][name] = clip;
    covered.add(key);
  }

  for (const [k, c] of Object.entries(chars)) {
    const uses = pets.get(k);
    if (uses) {
      c.pets = {
        lines: uses,
        frameMs: Object.fromEntries(PET_SLOTS.map((s) => [s, (PET_FRAME_MS as Record<string, number>)[s]])),
        sleepSlowdown: PET_SLEEP_SLOWDOWN,
        source: 'pet-actor:PET_FRAME_MS',
      };
    }
    for (const skin of Object.keys(c.skins)) {
      const tree = c.skins[skin] as Tree;
      for (const cat of CATEGORIES) {
        tree[cat] = Object.fromEntries(Object.entries(tree[cat]).sort(([a], [b]) => a.localeCompare(b)));
      }
      for (const cat of CATEGORIES) if (!Object.keys(tree[cat]).length) delete tree[cat];
    }
  }
  return { chars: Object.fromEntries(Object.entries(chars).sort(([a], [b]) => a.localeCompare(b))), covered };
}

function buildFx(covered: Set<string>) {
  const fx: Record<string, Record<string, Clip>> = {};
  for (const [k, m] of Object.entries<any>(meta.fx).sort(([a], [b]) => a.localeCompare(b))) {
    const key = `sheets/streetwear/fx/${k}`;
    const e = legacy[key];
    if (!e) continue;
    const [kind, name] = k.split('/');
    (fx[kind] ??= {})[name] = {
      frames: m.frames,
      ms: flat(m.frames, Math.round(1000 / m.fps)),
      timing: 'meta:fx.fps',
      loop: !!m.loop,
      dirs: dirsOf(e.frames),
      anchor: { x: m.anchorX, y: m.anchorY },
      cell: { w: m.cell, h: m.cell },
      sheet: e.sheet,
      reducedMotion: m.loop ? 'hold-first' : 'skip',
      legacyKey: key,
    };
    covered.add(key);
  }
  return fx;
}

function buildAuras(covered: Set<string>) {
  const out: Record<string, Record<string, Clip>> = {};
  for (const [kind, m] of Object.entries<any>(meta.auras).sort(([a], [b]) => a.localeCompare(b))) {
    for (const layer of ['behind', 'front']) {
      const key = `sheets/streetwear/auras/${kind}/${layer}`;
      const e = legacy[key];
      if (!e) continue;
      (out[kind] ??= {})[layer] = {
        frames: m.frames,
        ms: flat(m.frames, Math.round(1000 / m.fps)),
        timing: 'meta:auras.fps',
        loop: !!m.loop,
        dirs: dirsOf(e.frames),
        anchor: { x: m.anchorX, y: m.anchorY },
        cell: { w: m.cell, h: m.cell },
        sheet: e.sheet,
        reducedMotion: 'hold-first',
        legacyKey: key,
      };
      covered.add(key);
    }
  }
  return out;
}

function buildWorld(covered: Set<string>) {
  const clips: Record<string, any> = {};
  for (const b of Object.values<any>(meta.boards)) {
    for (const [n, c] of Object.entries<any>(b.ambient?.clips ?? {})) clips[n] = c;
  }
  const out: Record<string, Clip> = {};
  for (const [n, c] of Object.entries(clips).sort(([a], [b]) => a.localeCompare(b))) {
    const key = `sheets/streetwear/board/ato-${n}`;
    const e = legacy[key];
    if (!e) continue;
    out[n] = {
      frames: c.frames,
      ms: flat(c.frames, Math.round(1000 / c.fps)),
      timing: 'meta:boards.ambient.clips.fps',
      loop: true,
      dirs: dirsOf(e.frames),
      anchor: { x: c.ax, y: c.ay, unit: 'px' },
      cell: { w: c.w, h: c.h },
      sheet: e.sheet,
      reducedMotion: 'hold-first',
      legacyKey: key,
    };
    covered.add(key);
  }
  return out;
}

export function buildLibrary() {
  const { chars, covered } = buildCharacters();
  const fx = buildFx(covered);
  const auras = buildAuras(covered);
  const world = buildWorld(covered);
  return {
    manifest: {
      $comment:
        'GENERATED by scripts/animation-library.ts (npm run anim:library) — never hand-edit. Read-only view of the legacy PLAY_SHEETS; nothing in src/ reads it yet. ms[] is flat per frame (holds come later).',
      version: 1,
      order: { characterCategories: CATEGORIES, reducedMotion: { 'hold-first': 'freezes on frame 0 when Motion is Off', play: 'gameplay clip, never frozen', skip: 'decorative one-shot, may be dropped' } },
      characters: chars,
      fx,
      auras,
      world,
    },
    covered,
  };
}

/* ------------------------------------------------------------- main --- */

function render(): string {
  return JSON.stringify(buildLibrary().manifest, null, 1) + '\n';
}

function check(): string[] {
  const problems: string[] = [];
  // 1. every animated legacy clip is in the COMMITTED manifest (or an explicit non-clip).
  const committed = new Set<string>();
  if (fs.existsSync(OUT)) {
    const grab = (o: any) => {
      if (o && typeof o === 'object') {
        if (typeof o.legacyKey === 'string') committed.add(o.legacyKey);
        else for (const v of Object.values(o)) grab(v);
      }
    };
    grab(JSON.parse(fs.readFileSync(OUT, 'utf8')));
  }
  for (const key of Object.keys(legacy)) {
    if (committed.has(key) || exclusion(key)) continue;
    const n = Math.max(...Object.values(dirsOf(legacy[key].frames)).map((d) => d.frames));
    problems.push(`clip outside the library: ${key} (${n} frames) — not in library.json and not an excluded non-clip`);
  }
  // 2. the committed manifest is fresh.
  if (!fs.existsSync(OUT)) problems.push('assets/art/animations/library.json is missing — run npm run anim:library');
  else if (fs.readFileSync(OUT, 'utf8') !== render()) problems.push('assets/art/animations/library.json is stale — run npm run anim:library and commit it');
  // 3. manifest sanity.
  const m = buildLibrary().manifest;
  const walk = (o: any, where: string) => {
    if (o && typeof o === 'object' && Array.isArray(o.ms)) {
      if (o.ms.length !== o.frames) problems.push(`${where}: ms[] has ${o.ms.length} entries for ${o.frames} frames`);
      if (o.ms.some((v: number) => !(v > 0))) problems.push(`${where}: non-positive ms`);
      return;
    }
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (k !== 'pets') walk(v, `${where}/${k}`);
  };
  walk(m.characters, 'characters');
  walk(m.fx, 'fx');
  walk(m.auras, 'auras');
  walk(m.world, 'world');
  return problems;
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const problems = check();
    if (problems.length) {
      console.error(problems.map((p) => `✗ ${p}`).join('\n'));
      process.exit(1);
    }
    console.log('animation-library: manifest fresh, every legacy clip is in the library');
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, render());
    const m = buildLibrary().manifest;
    let clips = 0;
    const count = (o: any) => {
      if (o && typeof o === 'object' && Array.isArray(o.ms)) clips += 1;
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (k !== 'pets') count(v);
    };
    count(m);
    console.log(`wrote ${path.relative(ROOT, OUT)}: ${Object.keys(m.characters).length} characters, ${clips} clips`);
  }
}
