/**
 * Picks which category insight to push, and its already-generated text.
 * Never generates anything new — the notification can only ever say what's
 * already visible on /categories (fetchCurrentStatements). Priority:
 * 1) this week's spotlight, 2) the category with the most-stable weighted
 * axes, 3) tie-break by oldest last-touched axis (cheap variety, not a
 * random draw).
 */
import { readAllCategories, parseSpotlight, type CategoryReading } from '@/lib/categories';
import { CATEGORY_STATEMENTS_COPY_REVIEWED } from '@/lib/category-statements/generate-statements';
import { fetchCurrentStatements } from '@/lib/category-statements/store';
import type { Me } from '@/lib/me';
import { insightPush, type PushPayload } from '@/lib/push-copy';
import { effectiveStability, trackFor, type TraitTrack } from '@/lib/trait-stability';

/** Average effectiveStability across the category's own stable axes — a category with more, steadier answers ranks higher. */
function averageStability(reading: CategoryReading, tracks: readonly TraitTrack[]): number {
  if (reading.stableAxes.length === 0) return 0;
  const sum = reading.stableAxes.reduce(
    (total, axis) => total + effectiveStability(trackFor(tracks, axis, 'report')),
    0,
  );
  return sum / reading.stableAxes.length;
}

function oldestTouchedAt(reading: CategoryReading, tracks: readonly TraitTrack[]): number {
  const times = reading.stableAxes
    .map((axis) => trackFor(tracks, axis, 'report')?.lastTouched)
    .filter((iso): iso is string => !!iso)
    .map((iso) => new Date(iso).getTime())
    .filter((n) => Number.isFinite(n));
  return times.length > 0 ? Math.min(...times) : Number.POSITIVE_INFINITY;
}

/** Ready categories ranked by priority: this week's spotlight first, then most-stable, then oldest-touched. */
function rankCategories(me: Me, tracks: readonly TraitTrack[]): CategoryReading[] {
  const readings = readAllCategories(tracks);
  const ready = readings.filter((row) => row.ready);
  if (ready.length === 0) return [];

  const spotlight = parseSpotlight(me.category_spotlight);
  const spotlitId = spotlight ? ready.find((row) => row.def.id === spotlight.categoryId)?.def.id : null;

  return [...ready].sort((a, b) => {
    if (spotlitId) {
      if (a.def.id === spotlitId) return -1;
      if (b.def.id === spotlitId) return 1;
    }
    const stabilityDiff = averageStability(b, tracks) - averageStability(a, tracks);
    if (stabilityDiff !== 0) return stabilityDiff;
    return oldestTouchedAt(a, tracks) - oldestTouchedAt(b, tracks);
  });
}

/**
 * Null means: skip this push cycle rather than fire empty/fallback content.
 * Also null while `CATEGORY_STATEMENTS_COPY_REVIEWED` is false — the same
 * statement text already ships on the in-app Categories screen regardless
 * of that flag (an existing, accepted pattern per GOTCHAS.md), but a push
 * notification puts it on the lock screen, a more prominent surface. That's
 * a call for emci, not a default to ship silently — flip the flag once the
 * copy's been read to enable this push.
 */
export async function pickInsightPayload(
  me: Me,
  tracks: readonly TraitTrack[],
): Promise<PushPayload | null> {
  if (!CATEGORY_STATEMENTS_COPY_REVIEWED) return null;
  const ranked = rankCategories(me, tracks);
  if (ranked.length === 0) return null;

  const statements = await fetchCurrentStatements(me.id);
  // Ranking is deterministic — if the top category has no current statement
  // yet, fall through to the next ranked one rather than skipping the push
  // entirely (which would otherwise silently skip every cycle).
  for (const reading of ranked) {
    const statement = statements.find((row) => row.categoryId === reading.def.id);
    if (statement) return insightPush(reading.def.name, statement.statement);
  }
  return null;
}
