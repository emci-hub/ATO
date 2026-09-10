/**
 * Roll composition (trait-system redesign §7) — assembles one roll's exact
 * 13-item payload (1 legend + 11 categories + 1 story), matching
 * store_roll's own hard validation (wave46_trait_rolls.sql). Pure
 * orchestration: every side effect (AI generation) is dependency-injected,
 * same pattern composeCategoryBatch/fillAxisCountsChunked already use — no
 * Supabase or ai-generate import here. The legend item (core loop redesign
 * §4) computes its archetypeCode purely (classify.ts, no side effect) and
 * generates its story through the same injected `generateRollText` as every
 * other item — legends64/story-prompt.ts is imported specifically (not
 * legends64/generate-story.ts) because that file pulls in store.ts ->
 * supabase, which would break this module's no-Supabase guarantee.
 */
import { readAllCategories, type CategoryReading } from '@/lib/categories';
import { splitArchetypeCode } from '@/lib/legends64/archetypes';
import { archetypeCode, type LegendValues } from '@/lib/legends64/classify';
import { buildLegendStoryPrompt, parseLegendStoryBody } from '@/lib/legends64/story-prompt';
import { legendsUnlocked } from '@/lib/questions/progressive-unlock';
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

  // Rewired to the Legends 64-archetype system (core loop redesign §4,
  // T-15) — the old figure-catalog matcher (legends/match.ts,
  // legends/store.ts) is gone. archetypeCode() is always computable, but the
  // STORY is a real AI call, so this item is now gated on `legendsUnlocked`
  // — the SAME threshold the standalone Legends screen itself uses before
  // it will generate anything (legends.tsx's `locked`/thin-profile checks).
  // An earlier draft of this had NO gate at all, reasoning that the old
  // figure-catalog system always attempted a match regardless of profile
  // depth — caught in review as the wrong precedent to follow: that old
  // behavior was free (no AI call), so "always attempt" cost nothing; this
  // is a real generation, and Story's own gate right below exists for
  // exactly this reason ("rather than asking the model to write
  // diagnosis-adjacent prose from an empty settled-notes list") — a legend
  // read from an all-default 'LLL-LLL' code for a brand-new profile is the
  // same category of problem. Reuses the same `deps.generateRollText` DI
  // every other roll item already goes through (ROLL_META), rather than a
  // new metadata declaration, since buildLegendStoryPrompt's shape (pure
  // function of pole phrases, no name/history) matches ROLL_META's own
  // "bucket shareable" description — this is deliberately different from
  // the standalone Legends screen's LEGEND_STORY_META (personalized, NOT
  // bucket-shareable): that screen's "always fresh, never reused" is a
  // product choice about a specific user's repeated manual taps/rerolls,
  // not a claim that the underlying prompt itself carries per-user history.
  let legendResult: RollItem['result'] = { ready: false, matched: false };
  if (legendsUnlocked(tracks)) {
    const code = archetypeCode(values);
    const split = splitArchetypeCode(code);
    if (split) {
      const legendText = await deps.generateRollText(buildLegendStoryPrompt(split.core, split.modifier));
      const story = legendText ? parseLegendStoryBody(legendText) : null;
      if (story) {
        legendResult = { ready: true, matched: true, archetypeCode: code, story };
      }
    }
  }
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
