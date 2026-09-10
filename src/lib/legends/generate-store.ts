import { supabase } from '@/lib/supabase';

import type { LegendCandidateDraft } from './parse';
import type { LegendType } from './store';

export interface LegendGenerationClaim {
  ok: boolean;
  reason?: string;
  daily: number;
  dailyCap: number;
}

/** Claim one Legend-candidate generation (legend_generations_daily_cap/day). Call BEFORE generateLegendCandidate. */
export async function claimLegendGeneration(): Promise<LegendGenerationClaim> {
  const { data, error } = await supabase.rpc('claim_legend_generation');
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: row.ok === true,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    daily: typeof row.daily === 'number' ? row.daily : 0,
    dailyCap: typeof row.daily_cap === 'number' ? row.daily_cap : 0,
  };
}

/** Persists a generated candidate as figure+variant+archetype-link, always fact_checked=false/source='ai'. */
export async function insertLegendCandidate(
  candidate: LegendCandidateDraft,
  archetypeId: string,
): Promise<{ figureId: string; variantId: string }> {
  const { data, error } = await supabase.rpc('insert_legend_candidate', {
    p_figure: {
      canonical_slug: candidate.canonicalSlug,
      name: candidate.name,
      era_title: candidate.eraTitle,
      type: candidate.type,
    },
    p_variant: {
      variant_key: `ai-${Date.now()}`,
      teaser: candidate.teaser,
      full_story: candidate.fullStory,
    },
    p_archetype_id: archetypeId,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    figureId: String(row.figure_id ?? ''),
    variantId: String(row.variant_id ?? ''),
  };
}

export interface PendingLegendCandidate {
  variantId: string;
  figureId: string;
  name: string;
  eraTitle: string;
  type: LegendType;
  teaser: string;
  fullStory: string;
  archetypeIds: string[];
}

interface PendingRow {
  id: string;
  figure_id: string;
  teaser: string;
  full_story: string;
  legend_figures: { name: string; era_title: string; type: string } | null;
  legend_archetypes: { archetype_id: string }[] | null;
}

const LEGEND_TYPES: readonly LegendType[] = ['historical', 'modern-deceased', 'mythical'];

/**
 * Every AI-sourced candidate not yet approved — same query shape as
 * fetchLegendCatalog minus the fact_checked filter (root-only screen; the
 * underlying select policy is open to every authenticated user like every
 * other content table here, same inherited trust model as the rest of the
 * catalog — see wave55's migration comment).
 */
export async function fetchPendingLegendCandidates(): Promise<PendingLegendCandidate[]> {
  const { data, error } = await supabase
    .from('legend_variants')
    .select(
      'id, figure_id, teaser, full_story, ' +
        'legend_figures(name, era_title, type), ' +
        'legend_archetypes(archetype_id)',
    )
    .eq('source', 'ai')
    .eq('fact_checked', false);
  if (error) throw error;

  const out: PendingLegendCandidate[] = [];
  for (const row of (data ?? []) as unknown as PendingRow[]) {
    const figure = row.legend_figures;
    if (!figure) continue;
    const type = LEGEND_TYPES.includes(figure.type as LegendType) ? (figure.type as LegendType) : 'historical';
    out.push({
      variantId: row.id,
      figureId: row.figure_id,
      name: figure.name,
      eraTitle: figure.era_title,
      type,
      teaser: row.teaser,
      fullStory: row.full_story,
      archetypeIds: (row.legend_archetypes ?? [])
        .map((link) => link.archetype_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    });
  }
  return out;
}

/** Root-only (require_root() inside the RPC). */
export async function approveLegendVariant(variantId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_legend_variant', { p_variant_id: variantId });
  if (error) throw error;
}

/** Root-only (require_root() inside the RPC). Refuses to delete an already-approved row. */
export async function rejectLegendVariant(variantId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_legend_variant', { p_variant_id: variantId });
  if (error) throw error;
}
