/**
 * Legend figures — where the museum lives.
 *
 * Server (wave89): `legend_museum` (own rows only), written through
 * `save_legend_figure_story` (one row per legend + chapter); the daily claim
 * `claim_legend_figure_story` (cap 2/day: the day's reveal + one bonus); anonymous angle counts
 * `legend_angle_counts`; and `legend_circle_friends` (names of connected
 * friends who met the same legend — never their stories).
 *
 * Phone (`ato.legendMuseum.v1`, account-scoped: wiped on sign-out by the
 * deny-by-default keep list): today's frame order per hall, the trait
 * fingerprint for the bonus reveal, and a copy of the museum so the screen works
 * before wave89 is applied or offline. With no server claim there is NO AI
 * call — the story falls back to the hand-written version (the server decides
 * whether a paid call happens, never the phone).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

import type { AngleCounts } from './pick';
import { parseStoredLegendStory, type LegendStory } from './story';
import { LEGEND_HALLS, type LegendHall } from './types';

export const LEGEND_MUSEUM_KEY = 'ato.legendMuseum.v1';

export interface MuseumEntry {
  legendId: string;
  /** 0 = the first meeting; 1, 2, … = later chapters (a new angle, same legend). */
  chapter: number;
  story: LegendStory;
  /** Local YYYY-MM-DD the person met this legend (or heard this chapter). */
  metOn: string;
}

/** One hall's frames for the day: the order is fixed the first time the hall
 * opens that day, so the "???" frames stay put until revealed. */
export interface LegendHallDay {
  order: string[];
  /** Made once every open legend in the hall is met (chapter frame keys). */
  chapters?: string[];
}

export interface LegendDayState {
  ymd: string;
  /** Settled-lean fingerprint at the day's first reveal ('' before it). */
  fingerprint: string;
  halls: Partial<Record<LegendHall, LegendHallDay>>;
  /** Frame keys revealed today (a legend id, or `<legendId>#<angleId>` for a chapter). */
  revealed: string[];
}

export interface LegendLocalState {
  userId: string;
  museum: MuseumEntry[];
  day: LegendDayState | null;
}

const ID_RE = /^lf_[a-z0-9_]{2,40}$/;
const KEY_RE = /^lf_[a-z0-9_]{2,40}(#a\d{1,2})?$/;

function emptyState(userId: string): LegendLocalState {
  return { userId, museum: [], day: null };
}

function parseEntry(raw: unknown): MuseumEntry | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  const story = parseStoredLegendStory(obj.story);
  if (typeof obj.legendId !== 'string' || !ID_RE.test(obj.legendId) || !story) return null;
  const chapter =
    typeof obj.chapter === 'number' && Number.isInteger(obj.chapter) && obj.chapter >= 0 ? obj.chapter : 0;
  return { legendId: obj.legendId, chapter, story, metOn: typeof obj.metOn === 'string' ? obj.metOn : '' };
}

function parseKeys(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((key): key is string => typeof key === 'string' && KEY_RE.test(key));
}

function parseDay(raw: unknown): LegendDayState | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const day = raw as Record<string, unknown>;
  if (typeof day.ymd !== 'string' || typeof day.fingerprint !== 'string') return null;
  const rawHalls = typeof day.halls === 'object' && day.halls != null ? (day.halls as Record<string, unknown>) : {};
  const halls: Partial<Record<LegendHall, LegendHallDay>> = {};
  for (const hall of LEGEND_HALLS) {
    const row = rawHalls[hall] as Record<string, unknown> | undefined;
    const order = parseKeys(row?.order);
    if (!order) continue;
    const chapters = parseKeys(row?.chapters);
    halls[hall] = chapters ? { order, chapters } : { order };
  }
  // A pilot-era day (`picked`: setNo → legend id) keeps its picks as reveals.
  const legacy =
    typeof day.picked === 'object' && day.picked != null ? parseKeys(Object.values(day.picked)) ?? [] : [];
  return { ymd: day.ymd, fingerprint: day.fingerprint, halls, revealed: parseKeys(day.revealed) ?? legacy };
}

export function parseLocalState(raw: string | null, userId: string): LegendLocalState {
  if (!raw) return emptyState(userId);
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.userId !== userId) return emptyState(userId);
    const museum = Array.isArray(data.museum)
      ? data.museum.map(parseEntry).filter((row): row is MuseumEntry => row != null)
      : [];
    return { userId, museum, day: parseDay(data.day) };
  } catch {
    return emptyState(userId);
  }
}

export async function loadLocalState(userId: string): Promise<LegendLocalState> {
  try {
    return parseLocalState(await AsyncStorage.getItem(LEGEND_MUSEUM_KEY), userId);
  } catch {
    return emptyState(userId);
  }
}

export async function saveLocalState(state: LegendLocalState): Promise<void> {
  try {
    await AsyncStorage.setItem(LEGEND_MUSEUM_KEY, JSON.stringify(state));
  } catch {
    // Best effort; the server copy (when applied) is the durable one.
  }
}

export function entryKey(row: { legendId: string; chapter: number }): string {
  return `${row.legendId}#${row.chapter}`;
}

/** Merge museum rows: server wins per (legend, chapter), local fills what the
 * server lacks. Newest first. */
export function mergeMuseum(server: readonly MuseumEntry[], local: readonly MuseumEntry[]): MuseumEntry[] {
  const byKey = new Map<string, MuseumEntry>();
  for (const row of local) byKey.set(entryKey(row), row);
  for (const row of server) byKey.set(entryKey(row), row);
  return [...byKey.values()].sort((a, b) =>
    a.metOn < b.metOn ? 1 : a.metOn > b.metOn ? -1 : b.chapter - a.chapter,
  );
}

/** legendId → the angle ids this person has been told (every chapter). */
export function toldAngles(museum: readonly MuseumEntry[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of museum) {
    const set = out.get(row.legendId) ?? new Set<string>();
    set.add(row.story.angleId);
    out.set(row.legendId, set);
  }
  return out;
}

/** Frame keys already used: met legend ids, and told `<legendId>#<angleId>`. */
export function usedFrameKeys(museum: readonly MuseumEntry[]): Set<string> {
  const out = new Set<string>();
  for (const row of museum) {
    out.add(row.legendId);
    out.add(`${row.legendId}#${row.story.angleId}`);
  }
  return out;
}

/** The server museum, or null when the table isn't there yet / offline. */
export async function fetchServerMuseum(): Promise<MuseumEntry[] | null> {
  try {
    const { data, error } = await supabase
      .from('legend_museum')
      .select('legend_id, chapter, story, met_on')
      .order('met_on', { ascending: false });
    if (error || !Array.isArray(data)) return null;
    return data
      .map((row) =>
        parseEntry({
          legendId: (row as { legend_id?: unknown }).legend_id,
          chapter: (row as { chapter?: unknown }).chapter,
          story: (row as { story?: unknown }).story,
          metOn: (row as { met_on?: unknown }).met_on,
        }),
      )
      .filter((row): row is MuseumEntry => row != null);
  } catch {
    return null;
  }
}

/** Claim one legend story (server cap). False = no AI call (fallback story). */
export async function claimLegendStory(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('claim_legend_figure_story');
    if (error || !data || typeof data !== 'object') return false;
    return (data as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}

export async function saveServerEntry(entry: MuseumEntry): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('save_legend_figure_story', {
      p_legend_id: entry.legendId,
      p_chapter: entry.chapter,
      p_angle_id: entry.story.angleId,
      p_moment_id: entry.story.momentId,
      p_story: entry.story,
      p_met_on: entry.metOn,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Phone rows the server does not have yet (offline, or met before wave89 was
 * applied), re-sent oldest chapter first. The server only takes rows dated
 * within a day of now, so older ones stay on this phone.
 */
export async function resendMissingEntries(
  server: readonly MuseumEntry[],
  local: readonly MuseumEntry[],
  today: string,
  yesterday: string,
  /** False once the account data was wiped: stop, never write it back. */
  stillValid: () => boolean,
): Promise<void> {
  const have = new Set(server.map(entryKey));
  const missing = local
    .filter((row) => !have.has(entryKey(row)) && (row.metOn === today || row.metOn === yesterday))
    .sort((a, b) => a.chapter - b.chapter);
  for (const row of missing) {
    if (!stillValid()) return;
    await saveServerEntry(row);
  }
}

/** Anonymous "how often told" counts per (angle, moment) for one legend. */
export async function fetchAngleCounts(legendId: string): Promise<AngleCounts | null> {
  try {
    const { data, error } = await supabase.rpc('legend_angle_counts', { p_legend_id: legendId });
    if (error || !Array.isArray(data)) return null;
    const out: Record<string, number> = {};
    for (const row of data as { angle_id?: unknown; moment_id?: unknown; n?: unknown }[]) {
      if (typeof row.angle_id === 'string' && typeof row.moment_id === 'string' && typeof row.n === 'number') {
        out[`${row.angle_id}|${row.moment_id}`] = row.n;
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** First names of connected Circle friends who also met this legend. */
export async function fetchCircleFriends(legendId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('legend_circle_friends', { p_legend_id: legendId });
    if (error || !Array.isArray(data)) return [];
    return (data as { name?: unknown }[])
      .map((row) => (typeof row.name === 'string' ? row.name.trim().split(/\s+/)[0] ?? '' : ''))
      .filter((name) => name.length > 0);
  } catch {
    return [];
  }
}

/* --------------------------------------------------- dev (PRE_LAUNCH_DEV) --- */
// Used only by the Dev Hub's "Legends museum" tool (dev-lab.tsx tools branch)
// and read by the Legends tab only while PRE_LAUNCH_DEV is on.

export const LEGEND_DEV_DATE_KEY = 'ato.legendMuseum.devDate';

/** A pretend "today" (YYYY-MM-DD) for testing On this day; null = real date. */
export async function loadDevLegendDate(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGEND_DEV_DATE_KEY);
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function setDevLegendDate(ymd: string | null): Promise<void> {
  try {
    if (ymd) await AsyncStorage.setItem(LEGEND_DEV_DATE_KEY, ymd);
    else await AsyncStorage.removeItem(LEGEND_DEV_DATE_KEY);
  } catch {
    // dev only
  }
}

/** Forget today's frames on this phone (the museum is kept). */
export async function devResetLegendDay(userId: string): Promise<void> {
  const state = await loadLocalState(userId);
  await saveLocalState({ ...state, day: null });
}

/** Pretend a new trait settled since today's first reveal (the bonus reveal
 * opens once today's legend is revealed). */
export async function devForceLegendBonus(userId: string): Promise<void> {
  const state = await loadLocalState(userId);
  if (state.day) await saveLocalState({ ...state, day: { ...state.day, fingerprint: 'dev:bonus' } });
}

/** Clear this phone's copy of the museum and today's frames (server rows stay). */
export async function devClearLocalMuseum(userId: string): Promise<void> {
  await saveLocalState({ userId, museum: [], day: null });
}
