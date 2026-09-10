import { ThemedText } from '@/components/themed-text';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { archetypeName, DEFAULT_LEGEND_SKIN, LEGENDS64_COPY_REVIEWED } from '@/lib/legends64/archetypes';
import { CATEGORY_READ_COPY_REVIEWED } from '@/lib/rolls/category-read';
import type { StoredRollItem } from '@/lib/rolls/store';
import { STORY_COPY_REVIEWED } from '@/lib/sage-story';

/** Unrevealed copy is unreviewed for category reads, Story, and the legend story (CLAUDE.md hard invariant) — same draft-copy badge sage-story-fold.tsx already shows. */
export const ROLL_COPY_REVIEWED = CATEGORY_READ_COPY_REVIEWED && STORY_COPY_REVIEWED && LEGENDS64_COPY_REVIEWED;

/** Matches rolls/compose.ts's legend result shape (core loop redesign §4, T-15) — archetypeCode + story, not the old figure-catalog's variant/archetype objects. */
interface LegendItemResult {
  matched: boolean;
  archetypeCode: string;
  story: string;
}

export function categoryLabel(categoryId: string | null, defs: readonly { id: string; name: string }[]): string {
  if (!categoryId) return 'Category';
  return defs.find((def) => def.id === categoryId)?.name ?? categoryId;
}

export function itemTitle(item: StoredRollItem, defs: readonly { id: string; name: string }[]): string {
  if (item.type === 'legend') return 'Legend';
  if (item.type === 'story') return 'Story';
  return categoryLabel(item.categoryId, defs);
}

/**
 * Renders a revealed roll item's body — shared between the Roll screen and
 * the history folds (Explore/Home), which display the same three item
 * shapes from `trait_rolls.result`. Caller must only render this once the
 * item is known revealed AND ready; it does not itself check either.
 */
export function RollItemBody({ item }: { item: StoredRollItem }) {
  if (item.type === 'legend') {
    // ready:true for a legend only ever means matched:true with an
    // archetypeCode and story attached (src/lib/rolls/compose.ts) — the
    // not-matched case is {ready:false}, which never reaches here. Defensive
    // typeof guard (not just a cast) because store_roll's own validation
    // (wave46) only guarantees `result` is non-null JSON under 8KB, never a
    // particular shape — a pre-rewrite revealed row (the OLD
    // {variant,archetype} shape) is old test/dev data only, never real
    // production data (T-15's rewrite predates any production traffic
    // through /roll, which is still hidden), but this stays cheap insurance
    // against a crash if one is ever encountered rather than a hard throw.
    const rawResult = item.result as unknown as Partial<LegendItemResult>;
    const archetypeCode = typeof rawResult.archetypeCode === 'string' ? rawResult.archetypeCode : null;
    const story = typeof rawResult.story === 'string' ? rawResult.story : '';
    if (!archetypeCode) return null;
    const name = archetypeName(archetypeCode, DEFAULT_LEGEND_SKIN) ?? archetypeCode;
    return (
      <>
        {!ROLL_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
          <ThemedText type="code" themeColor="textSecondary">
            Draft copy — waiting on emci review. Not shippable.
          </ThemedText>
        ) : null}
        <ThemedText type="smallBold">{name}</ThemedText>
        <ThemedText type="small">{story}</ThemedText>
      </>
    );
  }
  const rawBody = (item.result as { body?: unknown }).body;
  const body = typeof rawBody === 'string' ? rawBody : '';
  return (
    <>
      {!ROLL_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review. Not shippable.
        </ThemedText>
      ) : null}
      <ThemedText type="small">{body}</ThemedText>
    </>
  );
}
