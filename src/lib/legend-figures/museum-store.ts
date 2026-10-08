/**
 * Legend figures — where the museum lives.
 *
 * Server (wave89): `legend_museum` (own rows only), written through
 * `save_legend_figure_story`; the daily claim `claim_legend_figure_story`
 * (cap 2/day: the day's pick + one bonus); anonymous angle counts
 * `legend_angle_counts`; and `legend_circle_friends` (names of connected
 * friends who met the same legend — never their stories).
 *
 * Phone (`ato.legendMuseum.v1`, account-scoped: wiped on sign-out by the
 * deny-by-default keep list): today's sets, which one was picked, the trait
 * fingerprint for the bonus set, and a copy of the museum so the screen works
 * before wave89 is applied or offline. With no server claim there is NO AI
 * call — the story falls back to the hand-written version (the server decides
 * whether a paid call happens, never the phone).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

import type { AngleCounts, LegendSet } from './pick';
import { parseStoredLegendStory, type LegendStory } from './story';

export const LEGEND_MUSEUM_KEY = 'ato.legendMuseum.v1';

export interface MuseumEntry {
  legendId: string;
  story: LegendStory;
  /** Local YYYY-MM-DD the person met this legend. */
  metOn: string;
}

export interface LegendDayState {
  ymd: string;
  /** Settled-lean fingerprint when the day's first set was made. */
  fingerprint: string;
  sets: LegendSet[];
  /** setNo → the legend picked from that set. */
  picked: Record<number, string>;
  /** legendId → the angle + moment chosen when its label was shown (the
   * teaser promises that angle, so the story keeps it). */
  angles: Record<string, { angleId: string; momentId: string }>;
}

export interface LegendLocalState {
  userId: string;
  museum: MuseumEntry[];
  day: LegendDayState | null;
}

const ID_RE = /^lf_[a-z0-9_]{2,40}$/;

function emptyState(userId: string): LegendLocalState {
  return { userId, museum: [], day: null };
}

function parseEntry(raw: unknown): MuseumEntry | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  const story = parseStoredLegendStory(obj.story);
  if (typeof obj.legendId !== 'string' || !ID_RE.test(obj.legendId) || !story) return null;
  return { legendId: obj.legendId, story, metOn: typeof obj.metOn === 'string' ? obj.metOn : '' };
}

export function parseLocalState(raw: string | null, userId: string): LegendLocalState {
  if (!raw) return emptyState(userId);
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.userId !== userId) return emptyState(userId);
    const museum = Array.isArray(data.museum)
      ? data.museum.map(parseEntry).filter((row): row is MuseumEntry => row != null)
      : [];
    const day = data.day as LegendDayState | null;
    const dayOk =
      day != null &&
      typeof day.ymd === 'string' &&
      typeof day.fingerprint === 'string' &&
      Array.isArray(day.sets) &&
      typeof day.picked === 'object' &&
      day.picked != null;
    return { userId, museum, day: dayOk ? { ...day, angles: typeof day.angles === 'object' && day.angles ? day.angles : {} } : null };
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

/** Merge museum rows: server wins per legend, local fills what the server lacks. */
export function mergeMuseum(server: readonly MuseumEntry[], local: readonly MuseumEntry[]): MuseumEntry[] {
  const byId = new Map<string, MuseumEntry>();
  for (const row of local) byId.set(row.legendId, row);
  for (const row of server) byId.set(row.legendId, row);
  return [...byId.values()].sort((a, b) => (a.metOn < b.metOn ? 1 : a.metOn > b.metOn ? -1 : 0));
}

/** The server museum, or null when the table isn't there yet / offline. */
export async function fetchServerMuseum(): Promise<MuseumEntry[] | null> {
  try {
    const { data, error } = await supabase
      .from('legend_museum')
      .select('legend_id, story, met_on')
      .order('met_on', { ascending: false });
    if (error || !Array.isArray(data)) return null;
    return data
      .map((row) =>
        parseEntry({
          legendId: (row as { legend_id?: unknown }).legend_id,
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

/** Forget today's sets on this phone (the museum is kept). */
export async function devResetLegendDay(userId: string): Promise<void> {
  const state = await loadLocalState(userId);
  await saveLocalState({ ...state, day: null });
}

/** Pretend a new trait settled since today's first set (the bonus set shows
 * once today's legend is picked). */
export async function devForceLegendBonus(userId: string): Promise<void> {
  const state = await loadLocalState(userId);
  if (state.day) await saveLocalState({ ...state, day: { ...state.day, fingerprint: '' } });
}

/** Clear this phone's copy of the museum and today's sets (server rows stay). */
export async function devClearLocalMuseum(userId: string): Promise<void> {
  await saveLocalState({ userId, museum: [], day: null });
}
