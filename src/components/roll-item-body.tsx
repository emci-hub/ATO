import { ThemedText } from '@/components/themed-text';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { CATEGORY_READ_COPY_REVIEWED } from '@/lib/rolls/category-read';
import type { StoredRollItem } from '@/lib/rolls/store';
import { STORY_COPY_REVIEWED } from '@/lib/sage-story';

/** Unrevealed copy is unreviewed for both category reads and Story (CLAUDE.md hard invariant) — same draft-copy badge sage-story-fold.tsx already shows. */
export const ROLL_COPY_REVIEWED = CATEGORY_READ_COPY_REVIEWED && STORY_COPY_REVIEWED;

interface LegendItemResult {
  matched: boolean;
  variant: { name: string; teaser: string };
  archetype: { formalName: string };
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
    // ready:true for a legend only ever means matched:true with a variant
    // and archetype attached (src/lib/rolls/compose.ts:129-142) — the
    // not-matched case is {ready:false}, which never reaches here.
    const { variant, archetype } = item.result as unknown as LegendItemResult;
    return (
      <>
        <ThemedText type="smallBold">{variant.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {archetype.formalName} Energy
        </ThemedText>
        <ThemedText type="small">{variant.teaser}</ThemedText>
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
