import { supabase } from '@/lib/supabase';
import { localYmd } from '@/lib/local-date';

/**
 * Legends content + history data access.
 *
 * Content tables (legends, legend_archetypes, archetype_defs) are read-only
 * catalogs with `authenticated` select; user_legend_history is owner
 * select/insert via RLS. No server code needed — wave25 grants everything
 * this module uses. A legend is served at most once per user (unique
 * (user_id, legend_id)), so the history write is an idempotent upsert.
 */

export type LegendType = 'historical' | 'modern-deceased' | 'mythical';

export interface ArchetypeDef {
  id: string;
  formalName: string;
  slangName: string;
  animeFlavorTag: string;
  /** Comma-separated 16-axis combo, e.g. 'openness:high, autonomy:high'. */
  traitAxis: string;
  throwbackVoice: string | null;
  partyBuild: string | null;
}

export interface LegendDef {
  id: string;
  canonicalSlug: string;
  name: string;
  eraTitle: string;
  type: LegendType;
  teaser: string;
  fullStory: string;
  factChecked: boolean;
  /** Archetype ids this legend links to via legend_archetypes. */
  archetypeIds: string[];
}

export interface LegendCatalog {
  legends: LegendDef[];
  archetypes: Map<string, ArchetypeDef>;
}

interface LegendDbRow {
  id: string;
  canonical_slug: string;
  name: string;
  era_title: string;
  type: string;
  teaser: string;
  full_story: string;
  fact_checked: boolean;
  legend_archetypes: { archetype_id: string }[] | null;
}

interface ArchetypeDbRow {
  id: string;
  formal_name: string;
  slang_name: string;
  anime_flavor_tag: string;
  trait_axis: string;
  throwback_voice: string | null;
  party_build: string | null;
}

const LEGEND_TYPES: readonly string[] = ['historical', 'modern-deceased', 'mythical'];

/**
 * Fetches every fact-checked legend plus the archetype definitions they link
 * to. Unchecked legends must never be presented as fact (schema contract).
 */
export async function fetchLegendCatalog(): Promise<LegendCatalog> {
  const { data, error } = await supabase
    .from('legends')
    .select(
      'id, canonical_slug, name, era_title, type, teaser, full_story, fact_checked, legend_archetypes(archetype_id)',
    )
    .eq('fact_checked', true);
  if (error) throw error;

  const archetypeIds = new Set<string>();
  const legends: LegendDef[] = [];
  for (const row of (data ?? []) as LegendDbRow[]) {
    const links = Array.isArray(row.legend_archetypes) ? row.legend_archetypes : [];
    const ids = links
      .map((link) => link.archetype_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    for (const id of ids) archetypeIds.add(id);
    legends.push({
      id: row.id,
      canonicalSlug: row.canonical_slug,
      name: row.name,
      eraTitle: row.era_title,
      type: LEGEND_TYPES.includes(row.type) ? (row.type as LegendType) : 'historical',
      teaser: row.teaser,
      fullStory: row.full_story,
      factChecked: row.fact_checked === true,
      archetypeIds: ids,
    });
  }

  const archetypes = new Map<string, ArchetypeDef>();
  if (archetypeIds.size > 0) {
    const { data: arch, error: archError } = await supabase
      .from('archetype_defs')
      .select('id, formal_name, slang_name, anime_flavor_tag, trait_axis, throwback_voice, party_build')
      .in('id', [...archetypeIds]);
    if (archError) throw archError;
    for (const row of (arch ?? []) as ArchetypeDbRow[]) {
      archetypes.set(row.id, {
        id: row.id,
        formalName: row.formal_name,
        slangName: row.slang_name,
        animeFlavorTag: row.anime_flavor_tag,
        traitAxis: row.trait_axis,
        throwbackVoice: row.throwback_voice,
        partyBuild: row.party_build,
      });
    }
  }

  return { legends, archetypes };
}

/** Legend ids this user has already been shown (never repeat). */
export async function fetchSeenLegendIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_legend_history')
    .select('legend_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => String((row as { legend_id: string }).legend_id)));
}

/**
 * Records that a user was shown a legend. Idempotent on the (user_id,
 * legend_id) unique constraint — a re-render or refresh never double-logs.
 */
export async function logShownLegends(
  userId: string,
  legendIds: readonly string[],
  timezone: string,
): Promise<void> {
  if (legendIds.length === 0) return;
  const weekBatch = weekBatchId(timezone);
  const { error } = await supabase
    .from('user_legend_history')
    .upsert(
      legendIds.map((legendId) => ({
        user_id: userId,
        legend_id: legendId,
        week_batch_id: weekBatch,
      })),
      { onConflict: 'user_id,legend_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Week the legend was served, e.g. 2026-W36 (schema: "Derived client batch key"). */
export function weekBatchId(timeZone: string): string {
  return isoWeekLabel(localYmd(new Date(), timeZone || 'UTC'));
}

/** ISO-8601 week label for a YYYY-MM-DD calendar date. */
export function isoWeekLabel(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // ISO weekday: Monday = 1 … Sunday = 7.
  const dow = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  // The Thursday of the current ISO week pins which year + week this date is in.
  const thursday = new Date(Date.UTC(year, month - 1, day + (4 - dow)));
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const weekOneMonday = new Date(Date.UTC(isoYear, 0, 4 - (jan4Dow - 1)));
  const week = Math.floor((thursday.getTime() - weekOneMonday.getTime()) / (7 * 86_400_000)) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
