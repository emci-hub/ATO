/**
 * Live wave32 legend-variants verify. Run: npm run check:legends-live
 *
 * Proves the wave32 figure+variant model end-to-end against production:
 *   1. the catalog loads from legend_variants WITH the legend_figures embed,
 *   2. a figure never fills a batch with more than one variant (best unseen
 *      variant per figure), and
 *   3. a figure whose v1 was already shown resurfaces through its v2.
 *
 * Mirrors src/lib/legends/store.ts (query shape + mapping) and
 * src/lib/legends/match.ts (traitBand/parseAxisCombo/countPoleHits/buildLegendView)
 * exactly — same as other live checks mirror the shipped logic. Signs in as the
 * fixed dev-test user (@atodev) for the authenticated read, then drives the
 * Architect preset (which matches only Da Vinci) through the matcher.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const fileEnv = loadEnv();
const url = process.env.SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(
  url && anonKey,
  'Set EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local (or SUPABASE_URL/SUPABASE_ANON_KEY)',
);

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const TRAIT_AXES = [
  'openness', 'conscientiousness', 'extraversion', 'agreeableness',
  'steadiness', 'attachment_anxiety', 'attachment_avoidance',
  'conflict_assertiveness', 'conflict_cooperativeness', 'autonomy',
  'competence', 'relatedness', 'growth_mindset', 'locus_of_control',
  'self_efficacy', 'playfulness',
] as const;

// Architect preset from src/lib/dev-test-user.ts (matches only Da Vinci).
const ARCHITECT_VALUES: Record<string, number> = {
  openness: 0.45, conscientiousness: 0.8, extraversion: 0.35, agreeableness: 0.55,
  steadiness: 0.6, attachment_anxiety: 0.3, attachment_avoidance: 0.45,
  conflict_assertiveness: 0.35, conflict_cooperativeness: 0.55, autonomy: 0.85,
  competence: 0.5, relatedness: 0.45, growth_mindset: 0.6, locus_of_control: 0.85,
  self_efficacy: 0.55, playfulness: 0.5,
};

// --- mirror of src/lib/traits.ts traitBand -----------------------------------
function traitBand(value: number | null | undefined): 'low' | 'mid' | 'high' | null {
  if (value == null) return null;
  if (value <= 0.33) return 'low';
  if (value >= 0.67) return 'high';
  return 'mid';
}

// --- mirror of src/lib/legends/match.ts --------------------------------------
function parseAxisCombo(traitAxis: string | null | undefined) {
  if (!traitAxis) return [];
  const poles: { axis: string; band: 'high' | 'low' }[] = [];
  for (const token of traitAxis.split(',')) {
    const [rawAxis, rawPole] = token.trim().split(':');
    if (!rawAxis || !rawPole) continue;
    const axis = rawAxis.trim();
    if (!(TRAIT_AXES as readonly string[]).includes(axis)) continue;
    const band = rawPole.trim();
    if (band !== 'high' && band !== 'low') continue;
    poles.push({ axis, band });
  }
  return poles;
}

function countPoleHits(poles: { axis: string; band: 'high' | 'low' }[], values: Record<string, number>): number {
  let hits = 0;
  for (const pole of poles) {
    const band = values[pole.axis] == null ? null : traitBand(values[pole.axis]);
    if (band === pole.band) hits += 1;
  }
  return hits;
}

function isMatch(poles: unknown[], hits: number): boolean {
  return poles.length > 0 && hits >= Math.min(2, poles.length);
}

function buildLegendView(catalog: any, values: Record<string, number>, seenVariantIds: ReadonlySet<string>) {
  const bestPerFigure = new Map<string, any>();
  let anyMatchedArchetype = false;
  for (const variant of catalog.variants) {
    if (!variant.factChecked) continue;
    let best: any = null;
    for (const archetypeId of variant.archetypeIds) {
      const archetype = catalog.archetypes.get(archetypeId);
      if (!archetype) continue;
      const poles = parseAxisCombo(archetype.traitAxis);
      const hits = countPoleHits(poles, values);
      if (!isMatch(poles, hits)) continue;
      anyMatchedArchetype = true;
      if (!best || hits > best.hits) best = { variant, archetype, hits };
    }
    if (!best || seenVariantIds.has(variant.id)) continue;
    const current = bestPerFigure.get(variant.figureId);
    if (!current || best.hits > current.hits) bestPerFigure.set(variant.figureId, best);
  }
  const cards = [...bestPerFigure.values()];
  cards.sort((a: any, b: any) => b.hits - a.hits || a.variant.name.localeCompare(b.variant.name));
  return { cards, anyMatchedArchetype, hasCatalog: catalog.variants.length > 0 };
}

async function main() {
  const supabase = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Same authenticated identity the Legends dev strip uses.
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'ato-dev@example.com',
    password: 'ATO-dev-user-2026',
  });
  if (signInError) throw new Error(`dev-test sign-in failed: ${signInError.message}`);
  const authed = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signInData.session!.access_token}` } },
  });

  // Same query store.ts fetchLegendCatalog runs.
  const { data, error } = await authed
    .from('legend_variants')
    .select(
      'id, variant_key, teaser, full_story, fact_checked, figure_id, ' +
        'legend_figures(canonical_slug, name, era_title, type), ' +
        'legend_archetypes(archetype_id)',
    )
    .eq('fact_checked', true);
  if (error) throw error;

  const variants = (data ?? []).map((row: any) => ({
    id: row.id,
    figureId: row.figure_id,
    canonicalSlug: row.legend_figures?.canonical_slug,
    variantKey: row.variant_key,
    name: row.legend_figures?.name,
    eraTitle: row.legend_figures?.era_title,
    type: row.legend_figures?.type,
    teaser: row.teaser,
    fullStory: row.full_story,
    factChecked: row.fact_checked === true,
    archetypeIds: (Array.isArray(row.legend_archetypes) ? row.legend_archetypes : [])
      .map((link: any) => link.archetype_id)
      .filter((id: any) => typeof id === 'string' && id.length > 0),
  }));

  // 1. figure embed present on every variant.
  for (const v of variants) {
    assert.ok(v.name && v.canonicalSlug && v.eraTitle && v.type, `${v.variantKey} missing figure embed`);
  }
  ok(`catalog loads ${variants.length} fact-checked variants, all with legend_figures embed`);

  // Fetch archetype defs (store.ts maps by id).
  const archetypeIds = [...new Set(variants.flatMap((v: any) => v.archetypeIds))];
  const { data: arch, error: archError } = await authed
    .from('archetype_defs')
    .select('id, formal_name, slang_name, anime_flavor_tag, trait_axis, throwback_voice, party_build')
    .in('id', archetypeIds);
  if (archError) throw archError;
  const archetypes = new Map((arch ?? []).map((a: any) => [a.id, {
    id: a.id,
    formalName: a.formal_name,
    slangName: a.slang_name,
    animeFlavorTag: a.anime_flavor_tag,
    traitAxis: a.trait_axis,
    throwbackVoice: a.throwback_voice,
    partyBuild: a.party_build,
  }]));

  const catalog = { variants, archetypes };

  // Da Vinci (the Architect-linked figure) should now carry v1 AND v2.
  const davinci = variants.filter((v: any) => v.canonicalSlug === 'leonardo-da-vinci-1452');
  assert.ok(davinci.length === 2, `expected 2 Da Vinci variants, got ${davinci.length}`);
  const davinciV1 = davinci.find((v: any) => v.variantKey === 'v1')!;
  const davinciV2 = davinci.find((v: any) => v.variantKey === 'v2')!;
  assert.ok(davinciV1 && davinciV2, 'Da Vinci v1 and v2 both present');
  ok('Da Vinci has two fact-checked variants (v1 + v2) on the same figure_id');

  // 2. no variant repeats in a batch: both variants match, but only ONE card.
  const fresh = buildLegendView(catalog, ARCHITECT_VALUES, new Set());
  assert.ok(fresh.cards.length === 1, `expected 1 card in batch, got ${fresh.cards.length}`);
  assert.equal(fresh.cards[0].variant.canonicalSlug, 'leonardo-da-vinci-1452');
  ok('Architect preset yields exactly one Da Vinci card — no variant repeat in a batch');

  // 3. resurface: once v1 is seen, the same figure returns via v2 + new story.
  const afterV1Seen = buildLegendView(catalog, ARCHITECT_VALUES, new Set([davinciV1.id]));
  assert.ok(afterV1Seen.cards.length === 1, `expected 1 card after v1 seen, got ${afterV1Seen.cards.length}`);
  const resurfaced = afterV1Seen.cards[0].variant;
  assert.equal(resurfaced.canonicalSlug, 'leonardo-da-vinci-1452');
  assert.equal(resurfaced.variantKey, 'v2');
  assert.notEqual(resurfaced.fullStory, davinciV1.fullStory);
  assert.ok(resurfaced.teaser !== davinciV1.teaser);
  ok('after v1 is seen, Da Vinci resurfaces with the v2 variant (new story)');

  console.log(`\n${passed}/${passed} legends wave32 checks passed.`);
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
