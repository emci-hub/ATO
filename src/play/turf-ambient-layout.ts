/**
 * Turf War ambient layer — pure placement math (no React Native, so check:turf-war-layout runs it in Node).
 * The painter (scripts/turf-board-art.ts) writes where each loop sits into meta.boards.ato.ambient (art px of the
 * 512 board); turf-ambient.tsx draws them on their own clock. Rules: docs/turf-war-layout.md.
 */
export const TURF_ART_PX = 512;

export type AmbientRect = { x: number; y: number; w: number; h: number };
export type AmbientPoint = { x: number; y: number };
export type AmbientClip = { frames: number; fps: number; w: number; h: number; ax: number; ay: number };
export type TurfAmbientMeta = {
  /** `smoke: false` = no wisp on this barrel (it would rise over a pad hit circle). */
  barrels: (AmbientPoint & { smoke?: boolean })[];
  cones: AmbientPoint[];
  vent: AmbientPoint | null;
  pigeons: AmbientPoint[];
  pools: AmbientRect[];
  fires: AmbientRect[];
  /** Wall neon signs, baked into the board (unlit) + the glow layer (lit): they flicker with pool `pool`. */
  signs?: (AmbientRect & { pool: number })[];
  clips: { flame: AmbientClip; smoke: AmbientClip; steam: AmbientClip; pigeon: AmbientClip };
};

/** The smoke wisp starts this far above the flame base (art px); its clip is 16 x 29 with the anchor at 7,26. */
export const SMOKE_LIFT = 6;
export const SMOKE_CLIP = { w: 16, h: 29, ax: 7, ay: 26 } as const;
/** Cone lamp: bright core and the soft halo around it (art px). */
export const LAMP_CORE = 3;
export const LAMP_HALO = 14;
/** A pigeon flaps off when a creep comes within this many board units (0–100) — about 45 pt on the 414 pt board. */
export const PIGEON_SCARE_UNITS = 11;
/** Perched again after this long (ms). */
export const PIGEON_RETURN_MS = 7000;
/** The flap-off arc + fade (ms); the wing frames loop through it. */
export const PIGEON_FLY_MS = 750;

/** Pick the ambient block out of the packed meta (undefined for boards with no ambient art). */
export function turfAmbientMeta(boards: unknown, mapId: string): TurfAmbientMeta | null {
  const entry = (boards as Record<string, { ambient?: TurfAmbientMeta }> | undefined)?.[mapId];
  const a = entry?.ambient;
  return a && a.clips?.flame && a.clips.smoke && a.clips.steam && a.clips.pigeon ? a : null;
}

export type AmbientBox = AmbientRect & { kind: 'flame' | 'smoke' | 'steam' | 'pigeon' | 'lamp' };

/** Every STATIC sprite box (art px): where each loop is drawn. Pigeons' brief flap-off is a fade, not a perch. */
export function ambientSpriteBoxes(m: TurfAmbientMeta): AmbientBox[] {
  const out: AmbientBox[] = [];
  for (const b of m.barrels) {
    out.push({ kind: 'flame', x: b.x - m.clips.flame.ax, y: b.y - m.clips.flame.ay, w: m.clips.flame.w, h: m.clips.flame.h });
    if (b.smoke !== false) out.push({ kind: 'smoke', x: b.x - m.clips.smoke.ax, y: b.y - SMOKE_LIFT - m.clips.smoke.ay, w: m.clips.smoke.w, h: m.clips.smoke.h });
  }
  if (m.vent) out.push({ kind: 'steam', x: m.vent.x - m.clips.steam.ax, y: m.vent.y - m.clips.steam.ay, w: m.clips.steam.w, h: m.clips.steam.h });
  for (const p of m.pigeons) out.push({ kind: 'pigeon', x: p.x - m.clips.pigeon.ax, y: p.y - m.clips.pigeon.ay, w: m.clips.pigeon.w, h: m.clips.pigeon.h });
  for (const c of m.cones) out.push({ kind: 'lamp', x: c.x - LAMP_HALO / 2, y: c.y - LAMP_HALO / 2, w: LAMP_HALO, h: LAMP_HALO });
  return out;
}

/** Does a pigeon at `site` (art px) see a creep at `creep` (board units 0–100)? */
export function pigeonScared(site: AmbientPoint, creeps: readonly AmbientPoint[]): boolean {
  const px = (site.x / TURF_ART_PX) * 100;
  const py = (site.y / TURF_ART_PX) * 100;
  return creeps.some((c) => Math.hypot(c.x - px, c.y - py) < PIGEON_SCARE_UNITS);
}

/** Fx-quality share of the loops that run: Full = all, Minimal = half (every other site, no smoke / steam), Off = none animate. */
export function ambientShare(quality: 'full' | 'minimal' | 'off'): { animate: boolean; everyOther: boolean; smokeSteam: boolean } {
  return { animate: quality !== 'off', everyOther: quality === 'minimal', smokeSteam: quality === 'full' };
}
