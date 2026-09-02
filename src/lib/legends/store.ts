import { supabase } from '@/lib/supabase';
import { localYmd } from '@/lib/local-date';

/**
 * Legends content + history data access.
 *
 * Content model (wave32): a FIGURE (legend_figures — the person/myth, e.g.
 * Da Vinci) owns one or more story VARIANTS (legend_variants — one angle on
 * an archetype or a different archetype the figure fits). A variant links to
 * its archetype(s) through legend_archetypes; archetype_defs is the shared
 * catalog. All content tables are read-only catalogs with `authenticated`
 * select; user_legend_history is owner select/insert/delete via RLS.
 *
 * A VARIANT is served at most once per user (unique (user_id, legend_id) with
 * legend_id = variant id), so a figure can resurface later through a different
 * variant. The history write is an idempotent upsert on that constraint.
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

/**
 * One servable story: a figure's display metadata flattened onto a variant.
 * `id` is the VARIANT id — history, logging, and never-repeat all key on it.
 */
export interface LegendVariant {
  id: string;
  /** Owning figure (legend_figures) — dedup key so one figure appears once per batch. */
  figureId: string;
  /** Figure identity slug, shared by all variants of that figure. */
  canonicalSlug: string;
  /** Authoring key within the figure, e.g. 'v1' / 'v2'. */
  variantKey: string;
  /** Figure display name (shared by all variants). */
  name: string;
  /** Figure era/setting (shared by all variants). */
  eraTitle: string;
  type: LegendType;
  /** Variant-specific hook shown on cards. */
  teaser: string;
  /** Variant-specific full story body. */
  fullStory: string;
  factChecked: boolean;
  /** Archetype ids THIS variant links to via legend_archetypes. */
  archetypeIds: string[];
}

export interface LegendCatalog {
  /** Every fact-checked variant, figure fields flattened. */
  variants: LegendVariant[];
  archetypes: Map<string, ArchetypeDef>;
}

interface VariantDbRow {
  id: string;
  variant_key: string;
  teaser: string;
  full_story: string;
  fact_checked: boolean;
  figure_id: string;
  legend_figures: {
    canonical_slug: string;
    name: string;
    era_title: string;
    type: string;
  } | null;
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
 * Fetches every fact-checked variant with its figure + linked archetype defs.
 * Unchecked variants must never be presented as fact (schema contract).
 */
export async function fetchLegendCatalog(): Promise<LegendCatalog> {
  const { data, error } = await supabase
    .from('legend_variants')
    .select(
      'id, variant_key, teaser, full_story, fact_checked, figure_id, ' +
        'legend_figures(canonical_slug, name, era_title, type), ' +
        'legend_archetypes(archetype_id)',
    )
    .eq('fact_checked', true);
  if (error) throw error;

  const archetypeIds = new Set<string>();
  const variants: LegendVariant[] = [];
  for (const row of (data ?? []) as unknown as VariantDbRow[]) {
    const figure = row.legend_figures;
    if (!figure) continue;
    const links = Array.isArray(row.legend_archetypes) ? row.legend_archetypes : [];
    const ids = links
      .map((link) => link.archetype_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    for (const id of ids) archetypeIds.add(id);
    variants.push({
      id: row.id,
      figureId: row.figure_id,
      canonicalSlug: figure.canonical_slug,
      variantKey: row.variant_key,
      name: figure.name,
      eraTitle: figure.era_title,
      type: LEGEND_TYPES.includes(figure.type) ? (figure.type as LegendType) : 'historical',
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

  return { variants, archetypes };
}

/** Variant ids this user has already been shown (never repeat per variant). */
export async function fetchSeenVariantIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_legend_history')
    .select('legend_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => String((row as { legend_id: string }).legend_id)));
}

/**
 * Records that a user was shown a variant. Idempotent on the (user_id,
 * legend_id) unique constraint — a re-render or refresh never double-logs.
 */
export async function logShownVariants(
  userId: string,
  variantIds: readonly string[],
  timezone: string,
): Promise<void> {
  if (variantIds.length === 0) return;
  const weekBatch = weekBatchId(timezone);
  const { error } = await supabase
    .from('user_legend_history')
    .upsert(
      variantIds.map((variantId) => ({
        user_id: userId,
        legend_id: variantId,
        week_batch_id: weekBatch,
      })),
      { onConflict: 'user_id,legend_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Week the variant was served, e.g. 2026-W36 (schema: "Derived client batch key"). */
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
