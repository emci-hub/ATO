/**
 * Line ids already shown to this player. The picker skips them until every
 * eligible line has been used, then the pool may repeat.
 *
 * Device copy: AsyncStorage `ato.story-library.shown` (see device-store.ts).
 * Server copy: the same ids ride inside the story JSON already saved on
 * `category_deep_dives.story` and `legend_museum.story` (`lineIds`). No new table.
 * The sync set below is what the offline check round-trips.
 */

let shown = new Set<string>();

export function getShownIds(): readonly string[] {
  return [...shown];
}

export function shownSet(): ReadonlySet<string> {
  return shown;
}

export function rememberShown(ids: readonly string[]): void {
  for (const id of ids) {
    if (id) shown.add(id);
  }
}

export function replaceShown(ids: readonly string[]): void {
  shown = new Set(ids.filter(Boolean));
}

export function resetShown(): void {
  shown = new Set();
}

/** Unseen eligible lines, or the whole pool once every eligible line has been shown. */
export function unseenOrReset<T extends { id: string }>(eligible: readonly T[], seen: ReadonlySet<string>): T[] {
  const unseen = eligible.filter((line) => !seen.has(line.id));
  return unseen.length > 0 ? unseen : [...eligible];
}

export function lineIdsOf(story: { lineIds?: readonly string[] } | null | undefined): string[] {
  return (story?.lineIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
}
