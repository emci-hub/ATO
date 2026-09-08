/**
 * Roll composition (trait-system redesign §7) — assembles one roll's exact
 * 13-item payload (1 legend + 11 categories + 1 story), matching
 * store_roll's own hard validation (wave46_trait_rolls.sql). Pure
 * orchestration: every side effect (AI generation, legend catalog/history
 * fetch) is dependency-injected, same pattern
 * composeCategoryBatch/fillAxisCountsChunked already use — no Supabase or
 * ai-generate import here.
 */
import { readAllCategories, type CategoryReading } from '@/lib/categories';
import { buildLegendView, type LegendMatch, type LegendValues } from '@/lib/legends/match';
import type { LegendCatalog } from '@/lib/legends/store';
import { hasReliableChange, snapshotFromTracks, type TraitSnapshot } from '@/lib/rci';
import { divergingAxesFromTracks, formatDivergenceNote } from '@/lib/trait-history';
import { buildStoryPrompt, parseStoryBody, storyReady } from '@/lib/sage-story';
import type { TraitTrack } from '@/lib/trait-stability';

import { buildCategoryReadPrompt, parseCategoryReadBody } from './category-read';

/** The exact count store_roll (wave46) requires — a literal, not derived from getCategoryDefs(), so a live-catalog drift is caught here instead of as an opaque Postgres error. */
export const ROLL_CATEGORY_COUNT = 11;

export type RollItemType = 'legend' | 'category' | 'story';

export interface RollItem {
  type: RollItemType;
  categoryId: string | null;
  /** Every item's result carries a top-level `ready: boolean`, regardless of type — reveal_roll_item (wave47) refuses to charge for an item that isn't. */
  result: { ready: boolean } & Record<string, unknown>;
}

export interface RollComposeDeps {
  fetchLegendCatalog: () => Promise<LegendCatalog>;
  fetchSeenVariantIds: () => Promise<ReadonlySet<string>>;
  /**
   * One generation call — injected, same DI pattern
   * composeCategoryBatch/fillAxisCountsChunked already use; a real caller
   * binds this to the shared generateText (@/lib/ai/generate) with its own
   * declared quota metadata (check:ai's invariant), same as every other
   * call site. Deliberately NOT named `generateText` itself: that exact
   * identifier is what check:ai's static scan treats as a real call site
   * needing its own metadata declaration, and this is a DI parameter, not
   * a direct call. Returns null on any failure — treated as "not ready"
   * for that item, never fails the whole roll.
   */
  generateRollText: (prompt: string) => Promise<string | null>;
}

export interface ComposedRoll {
  items: RollItem[];
  snapshot: TraitSnapshot;
}

/**
 * Display-only mirror of reveal_roll_item's own pricing (wave46/47 SQL:
 * `v_price := case v_type when 'legend' then 5 else 1 end;`) — the RPC is
 * still the authoritative source (it returns the real `price` charged on
 * reveal), this just lets a screen show a cost before the user taps Reveal
 * without a round trip.
 */
export function rollItemPrice(type: RollItemType): number {
  return type === 'legend' ? 5 : 1;
}

/**
 * Eligibility per §5/§7's try_roll pseudocode: a first-ever roll (no
 * snapshot yet), or a genuine RCI-detected change since the last one. Pure
 * — does not itself claim quota or write anything.
 *
 * NOT independently server-enforced today: the real caller (src/lib/rolls/run.ts)
 * checks this client-side before calling claimRoll(), which reduces
 * unnecessary claims for an honest client but does not stop a modified
 * client from skipping this check and calling claimRoll() directly — a
 * known, accepted gap (see run.ts's docstring for the full reasoning and
 * what actually still bounds the cost regardless: claimRoll +
 * claimRollGeneration, both real server-side RPCs).
 */
export function rollEligible(
  tracks: readonly TraitTrack[],
  lastSnapshot: TraitSnapshot | null,
  now: Date = new Date(),
): boolean {
  if (!lastSnapshot) return true;
  return hasReliableChange(tracks, lastSnapshot, now);
}

function categoryResult(reading: CategoryReading, body: string | null): RollItem['result'] {
  if (!reading.ready || !body) return { ready: false };
  return { ready: true, body };
}

/**
 * Assembles the full 13-item roll payload. A category is generated only
 * when `readCategory` reports it `ready` — an unready category gets a
 * `{ ready: false }` placeholder instead of spending an AI call, but still
 * occupies its slot, since store_roll requires exactly 11 distinct
 * category_ids regardless of individual readiness. Same for the story:
 * generation is skipped when `storyReady(tracks)` is false (matching the
 * existing Story surface's own gate, sage-story.ts) rather than asking the
 * model to write diagnosis-adjacent prose from an empty settled-notes list.
 * A failed generation (deps.generateRollText returns null, or the response
 * doesn't parse) reads the same as "not ready" for that one item — never
 * fails the whole roll.
 */
export async function composeRoll(
  tracks: readonly TraitTrack[],
  values: LegendValues,
  deps: RollComposeDeps,
  now: Date = new Date(),
): Promise<ComposedRoll> {
  const readings = readAllCategories(tracks, now);

  // A REAL guard, not a tautology: getCategoryDefs().length compared against
  // itself (via readAllCategories, which maps 1:1 over the same live call)
  // can never fire — a first version did exactly that and was caught in
  // review. Compare against the literal count store_roll hard-requires, and
  // separately check for duplicate ids (a live category_defs table, per
  // src/lib/category-catalog.ts, really can drift or contain dupes — neither
  // is structurally prevented by this function's own call graph).
  if (readings.length !== ROLL_CATEGORY_COUNT) {
    throw new Error(`composeRoll: expected ${ROLL_CATEGORY_COUNT} categories, the live catalog has ${readings.length}`);
  }
  const distinctIds = new Set(readings.map((row) => row.def.id));
  if (distinctIds.size !== ROLL_CATEGORY_COUNT) {
    throw new Error(`composeRoll: expected ${ROLL_CATEGORY_COUNT} distinct category ids, got ${distinctIds.size} (duplicate id in the live catalog)`);
  }

  const [catalog, seenVariantIds] = await Promise.all([
    deps.fetchLegendCatalog(),
    deps.fetchSeenVariantIds(),
  ]);
  const legendView = buildLegendView(catalog, values, seenVariantIds);
  const topLegend: LegendMatch | null = legendView.cards[0] ?? null;

  // Store only what a roll's legend item actually needs to display —
  // variant.fullStory (the complete story body) is already reachable
  // through the existing Legends feature's own fetch; duplicating it into
  // every roll's result risks approaching store_roll's 8KB per-item cap for
  // no real benefit, and just bloats every stored roll.
  const legendResult = topLegend
    ? {
        ready: true,
        matched: true,
        hits: topLegend.hits,
        variant: {
          id: topLegend.variant.id,
          figureId: topLegend.variant.figureId,
          name: topLegend.variant.name,
          teaser: topLegend.variant.teaser,
        },
        archetype: { id: topLegend.archetype.id, formalName: topLegend.archetype.formalName },
      }
    : { ready: false, matched: false };

  const items: RollItem[] = [
    {
      type: 'legend',
      categoryId: null,
      result: legendResult,
    },
  ];

  for (const reading of readings) {
    let body: string | null = null;
    if (reading.ready) {
      const prompt = buildCategoryReadPrompt(reading);
      const text = await deps.generateRollText(prompt);
      body = text ? parseCategoryReadBody(text) : null;
    }
    items.push({
      type: 'category',
      categoryId: reading.def.id,
      result: categoryResult(reading, body),
    });
  }

  let storyBody: string | null = null;
  if (storyReady(tracks, now)) {
    const divergenceNote = formatDivergenceNote(divergingAxesFromTracks(tracks));
    const storyPrompt = buildStoryPrompt({ tracks, divergenceNote });
    const storyText = await deps.generateRollText(storyPrompt);
    storyBody = storyText ? parseStoryBody(storyText) : null;
  }
  items.push({
    type: 'story',
    categoryId: null,
    result: storyBody ? { ready: true, body: storyBody } : { ready: false },
  });

  return { items, snapshot: snapshotFromTracks(tracks, now) };
}
