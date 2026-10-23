/**
 * Multi-room Hideout — unlocks, builds, speed-ups, migration (Phase 2).
 *
 * Pure rules. Clock is the pet clock guard (`countedGap` = `seen_at`
 * high-water, 48h cap). Builds never read the raw device clock.
 *
 * Token prices live in `data/hideout-rooms.json` (placeholders).
 * Unlocks are permanent `rooms_unlocked` flags; rebirth never clears them,
 * and a build in progress carries over.
 */
import roomsDoc from './data/hideout-rooms.json';
import { parseDecor, type DecorState } from '@/play/decor-slots';
import { parseVisitorBook, type VisitorBook } from '@/play/daily-visitors';
import { parseCircleBook, type CircleBook } from '@/play/circle-visits';
import { PET_DEEP_MIN_DEPTH, PET_MAX_GAP_MS, PET_STAGES, petDayHolds, type PetHallEntry, type PetState } from '@/play/pet';

export const HIDEOUT_ROOM_IDS = ['hideout', 'loft', 'garage', 'rooftop'] as const;
export type HideoutRoomId = (typeof HIDEOUT_ROOM_IDS)[number];

export const HIDEOUT_SAVE_VERSION = 33;

const HOUR = 60 * 60 * 1000;

type RoomGateJson = {
  everChild?: boolean;
  tendDays?: number;
  trialCleared?: boolean;
  deepSurfaces?: number;
  mainCycles?: number;
};

type RoomJson = {
  id: string;
  label: string;
  tokens: number;
  buildMs: number;
  gate?: RoomGateJson;
};

const CFG = roomsDoc as {
  rooms: RoomJson[];
  speedupMs: number;
  speedupCap: number;
  callStayMs: number;
  wakeMs: number;
  tokenBonusCap: number;
  dissolveMs: number;
  zzzFps: number;
  zzzFrames: number;
  veteranBuildMult: number;
  tokenPricesPlaceholder: boolean;
  artPlaceholder: boolean;
};

export const HIDEOUT_TOKEN_PRICES_PLACEHOLDER = CFG.tokenPricesPlaceholder === true;
export const HIDEOUT_ART_PLACEHOLDER = CFG.artPlaceholder === true;
export const HIDEOUT_SPEEDUP_MS = CFG.speedupMs;
export const HIDEOUT_SPEEDUP_CAP = CFG.speedupCap;
export const HIDEOUT_CALL_STAY_MS = CFG.callStayMs;
export const HIDEOUT_WAKE_MS = CFG.wakeMs;
export const HIDEOUT_TOKEN_BONUS_CAP = CFG.tokenBonusCap;
export const HIDEOUT_DISSOLVE_MS = CFG.dissolveMs;
export const HIDEOUT_ZZZ_FPS = CFG.zzzFps;
export const HIDEOUT_ZZZ_FRAMES = CFG.zzzFrames;
export const HIDEOUT_VETERAN_BUILD_MULT = CFG.veteranBuildMult;

export function roomDef(id: HideoutRoomId): RoomJson {
  const row = CFG.rooms.find((r) => r.id === id);
  if (!row) throw new Error(`unknown hideout room ${id}`);
  return row;
}

export function roomTokenPrice(id: HideoutRoomId): number {
  return roomDef(id).tokens;
}

export function roomBuildMs(id: HideoutRoomId, veteranHalf: boolean): number {
  const ms = roomDef(id).buildMs;
  if (ms <= 0) return 0;
  return veteranHalf ? Math.max(1, Math.round(ms * HIDEOUT_VETERAN_BUILD_MULT)) : ms;
}

export function nextRoomId(id: HideoutRoomId): HideoutRoomId | null {
  const i = HIDEOUT_ROOM_IDS.indexOf(id);
  return i >= 0 && i < HIDEOUT_ROOM_IDS.length - 1 ? HIDEOUT_ROOM_IDS[i + 1] : null;
}

export function prevRoomId(id: HideoutRoomId): HideoutRoomId | null {
  const i = HIDEOUT_ROOM_IDS.indexOf(id);
  return i > 0 ? HIDEOUT_ROOM_IDS[i - 1] : null;
}

/** Same clock guard as `advancePet`: high-water `seen_at`, 48h gap cap. */
export function countedGap(seenAt: number, now: number): { gap: number; seenAt: number } {
  if (now < seenAt - PET_MAX_GAP_MS) return { gap: 0, seenAt: now };
  if (!(now > seenAt)) return { gap: 0, seenAt };
  return { gap: Math.min(now - seenAt, PET_MAX_GAP_MS), seenAt: now };
}

export type RoomBuild = {
  duration_ms: number;
  elapsed_ms: number;
  speedup_ms: number;
  tick_seen_at: number;
  veteran_half: boolean;
};

export type HideoutEvent = {
  t: number;
  kind: HideoutEventKind;
  room?: HideoutRoomId;
  n?: number;
  source?: string;
};

export type HideoutEventKind =
  | 'room_unlock_ready'
  | 'build_start'
  | 'speedup_applied'
  | 'build_done'
  | 'room_swipe'
  | 'call_used'
  | 'pet_asleep_tap';

export type HideoutState = {
  rooms_unlocked: Record<HideoutRoomId, boolean>;
  builds: Partial<Record<HideoutRoomId, RoomBuild>>;
  viewed_room: HideoutRoomId;
  tend_days: number;
  tend_days_ymd: string | null;
  ever_child: boolean;
  lifetime_deep_surfaces: number;
  loft_veteran_half: boolean;
  coach_swipe_seen: boolean;
  call_until_age_ms: number | null;
  wake_until_age_ms: number | null;
  /** Sleep rail action (Loft): the pet is in bed by choice until this pet age. Cleared by a wake tap / second Sleep tap. */
  sleep_until_age_ms: number | null;
  peekaboo_ymd: string | null;
  lamp_on: boolean;
  build_notif_asked: boolean;
  ready_logged: HideoutRoomId[];
  log: HideoutEvent[];
  tokens_by_source: Record<string, number>;
  tokens_ymd: string | null;
  /** Daily visitors (roadmap step 4): greetings per visitor + the day of the last one. Rides the cloud save. */
  visitors: VisitorBook;
  /** Decor slots (roadmap step 5): slot → item in the Hideout room. Rides the cloud save. */
  decor: DecorState;
  /** Circle visits (roadmap step 6): gifts opened from Circle friends (stickers per hero, stamps, recent ids). */
  circle: CircleBook;
};

export function emptyHideout(): HideoutState {
  return {
    rooms_unlocked: { hideout: true, loft: false, garage: false, rooftop: false },
    builds: {},
    viewed_room: 'hideout',
    tend_days: 0,
    tend_days_ymd: null,
    ever_child: false,
    lifetime_deep_surfaces: 0,
    loft_veteran_half: false,
    coach_swipe_seen: false,
    call_until_age_ms: null,
    wake_until_age_ms: null,
    sleep_until_age_ms: null,
    peekaboo_ymd: null,
    lamp_on: false,
    build_notif_asked: false,
    ready_logged: [],
    log: [],
    tokens_by_source: {},
    tokens_ymd: null,
    visitors: { greets: {}, greeted_ymd: null },
    decor: {},
    circle: { gifts: {}, stamps: 0, opened: [] },
  };
}

const LOG_CAP = 120;

export function pushHideoutEvent(h: HideoutState, ev: HideoutEvent): HideoutState {
  const log = [...h.log, ev];
  return { ...h, log: log.length > LOG_CAP ? log.slice(log.length - LOG_CAP) : log };
}

export type HideoutProgressInput = {
  everChild: boolean;
  tendDays: number;
  trialCleared: boolean;
  deepSurfaces: number;
  mainCycles: number;
};

export function hideoutProgressOf(doc: {
  hideout: HideoutState;
  campaign: { phase: string };
  conquered_cycles: number;
}): HideoutProgressInput {
  return {
    everChild: doc.hideout.ever_child,
    tendDays: doc.hideout.tend_days,
    trialCleared: doc.campaign.phase === 'main' || doc.conquered_cycles > 0,
    deepSurfaces: doc.hideout.lifetime_deep_surfaces,
    mainCycles: doc.conquered_cycles,
  };
}

/** Any one listed gate is enough. Hideout has no gate. */
export function roomGateMet(id: HideoutRoomId, p: HideoutProgressInput): boolean {
  if (id === 'hideout') return true;
  const g = roomDef(id).gate;
  if (!g) return true;
  if (g.everChild && p.everChild) return true;
  if (g.tendDays != null && p.tendDays >= g.tendDays) return true;
  if (g.trialCleared && p.trialCleared) return true;
  if (g.deepSurfaces != null && p.deepSurfaces >= g.deepSurfaces) return true;
  if (g.mainCycles != null && p.mainCycles >= g.mainCycles) return true;
  return false;
}

export function roomGateParts(id: HideoutRoomId, p: HideoutProgressInput): { label: string; have: number; need: number; ok: boolean }[] {
  const g = roomDef(id).gate;
  if (!g) return [];
  const parts: { label: string; have: number; need: number; ok: boolean }[] = [];
  if (g.everChild) parts.push({ label: 'Pet reached Child', have: p.everChild ? 1 : 0, need: 1, ok: p.everChild });
  if (g.tendDays != null) parts.push({ label: 'Tend days', have: p.tendDays, need: g.tendDays, ok: p.tendDays >= g.tendDays });
  if (g.trialCleared) parts.push({ label: 'Trial cleared', have: p.trialCleared ? 1 : 0, need: 1, ok: p.trialCleared });
  if (g.deepSurfaces != null) {
    parts.push({ label: 'Deep surfaces', have: p.deepSurfaces, need: g.deepSurfaces, ok: p.deepSurfaces >= g.deepSurfaces });
  }
  if (g.mainCycles != null) {
    parts.push({ label: 'Main cycles', have: p.mainCycles, need: g.mainCycles, ok: p.mainCycles >= g.mainCycles });
  }
  return parts;
}

export type RoomStage = 'hidden' | 'tease' | 'building' | 'done';

/**
 * Stagger: a room's tease is visible only once the previous room is done.
 * Hideout is always done. Loft teases from the start (previous is Hideout).
 */
export function roomStage(id: HideoutRoomId, h: HideoutState): RoomStage {
  if (h.rooms_unlocked[id]) return 'done';
  if (h.builds[id]) return 'building';
  if (id === 'hideout') return 'done';
  const prev = prevRoomId(id);
  if (prev && !h.rooms_unlocked[prev]) return 'hidden';
  return 'tease';
}

/** The one room the boarded wall / build sheet offers: Loft, then Garage, then Rooftop (the last stays once all are built). */
export function nextBuildRoom(h: HideoutState): HideoutRoomId {
  if (roomStage('loft', h) !== 'done') return 'loft';
  if (roomStage('garage', h) !== 'done') return 'garage';
  return 'rooftop';
}

export function buildRemainingMs(b: RoomBuild): number {
  return Math.max(0, b.duration_ms - b.elapsed_ms - b.speedup_ms);
}

export function buildProgress01(b: RoomBuild): number {
  if (b.duration_ms <= 0) return 1;
  return Math.min(1, (b.elapsed_ms + b.speedup_ms) / b.duration_ms);
}

export function speedupCapMs(b: Pick<RoomBuild, 'duration_ms'>): number {
  return Math.floor(b.duration_ms * HIDEOUT_SPEEDUP_CAP);
}

export function tickBuild(b: RoomBuild, now: number): RoomBuild {
  const { gap, seenAt } = countedGap(b.tick_seen_at, now);
  if (gap <= 0 && seenAt === b.tick_seen_at) return b;
  return { ...b, elapsed_ms: b.elapsed_ms + gap, tick_seen_at: seenAt };
}

export function tickHideoutBuilds(h: HideoutState, now: number): HideoutState {
  let next: HideoutState = h;
  for (const id of HIDEOUT_ROOM_IDS) {
    const raw = next.builds[id];
    if (!raw) continue;
    const b = tickBuild(raw, now);
    if (buildRemainingMs(b) <= 0) {
      const { [id]: _gone, ...rest } = next.builds;
      next = pushHideoutEvent(
        {
          ...next,
          builds: rest,
          rooms_unlocked: { ...next.rooms_unlocked, [id]: true },
        },
        { t: now, kind: 'build_done', room: id },
      );
    } else if (b !== raw) {
      next = { ...next, builds: { ...next.builds, [id]: b } };
    }
  }
  return next;
}

/** Speed-up: −1h, capped at 50% of that build. Play-only (caller decides). */
export function applySpeedup(h: HideoutState, now: number): { hideout: HideoutState; applied: boolean; room: HideoutRoomId | null } {
  for (const id of HIDEOUT_ROOM_IDS) {
    const raw = h.builds[id];
    if (!raw) continue;
    const b = tickBuild(raw, now);
    const cap = speedupCapMs(b);
    const room = Math.min(HIDEOUT_SPEEDUP_MS, Math.max(0, cap - b.speedup_ms));
    if (room <= 0) continue;
    const sped: RoomBuild = { ...b, speedup_ms: b.speedup_ms + room };
    let next: HideoutState = {
      ...h,
      builds: { ...h.builds, [id]: sped },
    };
    next = pushHideoutEvent(next, { t: now, kind: 'speedup_applied', room: id, n: room });
    next = tickHideoutBuilds(next, now);
    return { hideout: next, applied: true, room: id };
  }
  return { hideout: h, applied: false, room: null };
}

export function canStartBuild(
  id: HideoutRoomId,
  h: HideoutState,
  p: HideoutProgressInput,
  tokens: number,
): { ok: true } | { ok: false; reason: 'hidden' | 'done' | 'building' | 'gate' | 'tokens' } {
  if (id === 'hideout') return { ok: false, reason: 'done' };
  const stage = roomStage(id, h);
  if (stage === 'hidden') return { ok: false, reason: 'hidden' };
  if (stage === 'done') return { ok: false, reason: 'done' };
  if (stage === 'building') return { ok: false, reason: 'building' };
  if (!roomGateMet(id, p)) return { ok: false, reason: 'gate' };
  if (tokens < roomTokenPrice(id)) return { ok: false, reason: 'tokens' };
  return { ok: true };
}

export function startBuild(h: HideoutState, id: HideoutRoomId, now: number): HideoutState {
  const veteran = id === 'loft' && h.loft_veteran_half;
  const duration = roomBuildMs(id, veteran);
  const build: RoomBuild = {
    duration_ms: duration,
    elapsed_ms: 0,
    speedup_ms: 0,
    tick_seen_at: now,
    veteran_half: veteran,
  };
  return pushHideoutEvent(
    { ...h, builds: { ...h.builds, [id]: build } },
    { t: now, kind: 'build_start', room: id },
  );
}

export function markEverChild(h: HideoutState, pet: PetState, hall: readonly PetHallEntry[], rebirths: number): HideoutState {
  if (h.ever_child) return h;
  const grown = PET_STAGES.indexOf(pet.stage) >= PET_STAGES.indexOf('child') || pet.hero != null;
  if (grown || hall.length > 0 || rebirths > 0) return { ...h, ever_child: true };
  return h;
}

export function countTendDay(h: HideoutState, today: string): HideoutState {
  if (petDayHolds(today, h.tend_days_ymd)) return h;
  return { ...h, tend_days: h.tend_days + 1, tend_days_ymd: today };
}

export function countDeepSurface(h: HideoutState, deepers: number, free: boolean): HideoutState {
  if (free || deepers < PET_DEEP_MIN_DEPTH) return h;
  return { ...h, lifetime_deep_surfaces: h.lifetime_deep_surfaces + 1 };
}

/** Care-side only. Defend / Dive / cycle never pass through here. */
export const HIDEOUT_CARE_TOKEN_SOURCES = ['tend', 'tend_bonus', 'games'] as const;
export type HideoutCareTokenSource = (typeof HIDEOUT_CARE_TOKEN_SOURCES)[number];

export function careTokenBonus(base: number, source: string, h: HideoutState): number {
  if (base <= 0) return 0;
  if (!(HIDEOUT_CARE_TOKEN_SOURCES as readonly string[]).includes(source)) return 0;
  if (!h.rooms_unlocked.loft) return 0;
  return Math.floor(base * HIDEOUT_TOKEN_BONUS_CAP);
}

export function noteTokens(h: HideoutState, today: string, source: string, amount: number): HideoutState {
  if (amount <= 0) return h;
  const fresh = h.tokens_ymd !== today;
  const bag = fresh ? {} : { ...h.tokens_by_source };
  bag[source] = (bag[source] ?? 0) + amount;
  return { ...h, tokens_by_source: bag, tokens_ymd: today };
}

export function logReadyRooms(h: HideoutState, p: HideoutProgressInput, now: number): HideoutState {
  let next = h;
  for (const id of HIDEOUT_ROOM_IDS) {
    if (id === 'hideout') continue;
    if (next.ready_logged.includes(id)) continue;
    if (roomStage(id, next) !== 'tease') continue;
    if (!roomGateMet(id, p)) continue;
    next = pushHideoutEvent({ ...next, ready_logged: [...next.ready_logged, id] }, { t: now, kind: 'room_unlock_ready', room: id });
  }
  return next;
}

export function petReachedChild(pet: PetState): boolean {
  return PET_STAGES.indexOf(pet.stage) >= PET_STAGES.indexOf('child') || pet.hero != null;
}

/**
 * v32 → v33. Veterans get Loft *eligibility* (not the room), timer halved,
 * Garage hidden until Loft is done. Cannot reconstruct historic tend days or
 * deep surfaces — seed what the save actually has.
 */
export function migrateHideout(input: {
  version: number;
  raw: unknown;
  pet: PetState;
  hall: readonly PetHallEntry[];
  rebirths: number;
  lastTendYmd: string | null;
  daysPlayed: number;
  lifetimeWaves: number;
  campaignPhase: string;
  conqueredCycles: number;
  now: number;
}): HideoutState {
  if (input.version >= HIDEOUT_SAVE_VERSION && input.raw && typeof input.raw === 'object') {
    return parseHideout(input.raw, input.now);
  }
  const h = emptyHideout();
  const ever = petReachedChild(input.pet) || input.hall.length > 0 || input.rebirths > 0;
  const tendSeed = input.lastTendYmd ? 1 : 0;
  const veteran =
    input.daysPlayed > 0 || input.hall.length > 0 || input.lifetimeWaves > 0 || input.rebirths > 0;
  const next: HideoutState = {
    ...h,
    ever_child: ever,
    tend_days: tendSeed,
    tend_days_ymd: input.lastTendYmd,
    lifetime_deep_surfaces: Math.max(0, input.pet.deep_surfaces),
    loft_veteran_half: veteran && (ever || tendSeed >= 3),
  };
  const p = hideoutProgressOf({
    hideout: next,
    campaign: { phase: input.campaignPhase },
    conquered_cycles: input.conqueredCycles,
  });
  return logReadyRooms(next, p, input.now);
}

export function parseHideout(raw: unknown, now: number): HideoutState {
  const base = emptyHideout();
  if (typeof raw !== 'object' || raw == null) return base;
  const r = raw as Record<string, unknown>;
  const flag = (v: unknown) => v === true;
  const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : d);
  const unlockedIn = typeof r.rooms_unlocked === 'object' && r.rooms_unlocked != null ? (r.rooms_unlocked as Record<string, unknown>) : {};
  const buildsIn = typeof r.builds === 'object' && r.builds != null ? (r.builds as Record<string, unknown>) : {};
  const builds: Partial<Record<HideoutRoomId, RoomBuild>> = {};
  for (const id of HIDEOUT_ROOM_IDS) {
    const b = buildsIn[id];
    if (typeof b !== 'object' || b == null) continue;
    const row = b as Record<string, unknown>;
    builds[id] = {
      duration_ms: Math.max(1, num(row.duration_ms, 1)),
      elapsed_ms: num(row.elapsed_ms),
      speedup_ms: num(row.speedup_ms),
      tick_seen_at: num(row.tick_seen_at, now),
      veteran_half: row.veteran_half === true,
    };
  }
  const viewed = HIDEOUT_ROOM_IDS.includes(r.viewed_room as HideoutRoomId) ? (r.viewed_room as HideoutRoomId) : 'hideout';
  const ready = Array.isArray(r.ready_logged)
    ? r.ready_logged.filter((id): id is HideoutRoomId => HIDEOUT_ROOM_IDS.includes(id as HideoutRoomId))
    : [];
  const log = Array.isArray(r.log)
    ? r.log
        .filter((e): e is HideoutEvent => typeof e === 'object' && e != null && typeof (e as HideoutEvent).kind === 'string')
        .slice(-LOG_CAP)
    : [];
  const bag = typeof r.tokens_by_source === 'object' && r.tokens_by_source != null ? (r.tokens_by_source as Record<string, unknown>) : {};
  const tokens_by_source: Record<string, number> = {};
  for (const [k, v] of Object.entries(bag)) {
    if (typeof v === 'number' && Number.isFinite(v)) tokens_by_source[k] = Math.max(0, Math.floor(v));
  }
  return {
    rooms_unlocked: {
      hideout: true,
      loft: flag(unlockedIn.loft),
      garage: flag(unlockedIn.garage),
      rooftop: flag(unlockedIn.rooftop),
    },
    builds,
    viewed_room: viewed,
    tend_days: num(r.tend_days),
    tend_days_ymd: typeof r.tend_days_ymd === 'string' ? r.tend_days_ymd : null,
    ever_child: flag(r.ever_child),
    lifetime_deep_surfaces: num(r.lifetime_deep_surfaces),
    loft_veteran_half: flag(r.loft_veteran_half),
    coach_swipe_seen: flag(r.coach_swipe_seen),
    call_until_age_ms: typeof r.call_until_age_ms === 'number' && Number.isFinite(r.call_until_age_ms) ? r.call_until_age_ms : null,
    wake_until_age_ms: typeof r.wake_until_age_ms === 'number' && Number.isFinite(r.wake_until_age_ms) ? r.wake_until_age_ms : null,
    sleep_until_age_ms: typeof r.sleep_until_age_ms === 'number' && Number.isFinite(r.sleep_until_age_ms) ? r.sleep_until_age_ms : null,
    peekaboo_ymd: typeof r.peekaboo_ymd === 'string' ? r.peekaboo_ymd : null,
    lamp_on: flag(r.lamp_on),
    build_notif_asked: flag(r.build_notif_asked),
    ready_logged: ready,
    log,
    tokens_by_source,
    tokens_ymd: typeof r.tokens_ymd === 'string' ? r.tokens_ymd : null,
    visitors: parseVisitorBook(r.visitors),
    decor: parseDecor(r.decor),
    circle: parseCircleBook(r.circle),
  };
}

export function inProgressBuild(h: HideoutState, now: number): { room: HideoutRoomId; remainingMs: number } | null {
  for (const id of HIDEOUT_ROOM_IDS) {
    const raw = h.builds[id];
    if (!raw) continue;
    const left = buildRemainingMs(tickBuild(raw, now));
    if (left > 0) return { room: id, remainingMs: left };
  }
  return null;
}

export function enterableRooms(h: HideoutState): HideoutRoomId[] {
  return HIDEOUT_ROOM_IDS.filter((id) => h.rooms_unlocked[id]);
}

/** Neighbor for snapshots: previous / next enterable or tease (not hidden). */
export function neighborRooms(viewed: HideoutRoomId, h: HideoutState): { left: HideoutRoomId | null; right: HideoutRoomId | null } {
  const vis = HIDEOUT_ROOM_IDS.filter((id) => roomStage(id, h) !== 'hidden');
  const i = vis.indexOf(viewed);
  return {
    left: i > 0 ? vis[i - 1] : null,
    right: i >= 0 && i < vis.length - 1 ? vis[i + 1] : null,
  };
}

void HOUR;
