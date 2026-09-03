import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';
import {
  categoryDefFromRow,
  getCategoryDefs,
  setCategoryDefs,
  sortCategoryDefs,
  type CategoryDef,
  type CategoryDefRow,
} from '@/lib/categories';

/**
 * Live category catalog from the `category_defs` table (wave21/22). The
 * hardcoded `CATEGORY_DEFS` in `lib/categories.ts` is the fallback: it stays
 * active until a successful fetch replaces it, and stays active forever if the
 * fetch fails or the table is empty. Cached in-memory with a TTL so we do not
 * re-query on every screen visit.
 *
 * Cache is TTL, not keyed on `me.updated_at`: editing `category_defs` does not
 * touch any user's `me` row, so the TTL is the only signal that tracks edits
 * here. 5 minutes keeps a table-editor tweak visible within one app session
 * without hammering the DB.
 */
export const CATEGORY_CATALOG_TTL_MS = 5 * 60 * 1000;

let fetchedAt = 0;
let inflight: Promise<readonly CategoryDef[]> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** Fetches the live catalog from `category_defs`. Throws on a network/RPC error. */
export async function fetchCategoryDefs(): Promise<readonly CategoryDef[]> {
  const { data, error } = await supabase
    .from('category_defs')
    .select('id, name, shape, axis_weights, min_axes_required_stable, texture_axes');
  if (error) throw error;
  const rows = (data ?? []) as unknown as CategoryDefRow[];
  const defs = rows
    .map((row) => categoryDefFromRow(row))
    .filter((def): def is CategoryDef => def !== null);
  return sortCategoryDefs(defs);
}

/**
 * Returns the active catalog, re-fetching from `category_defs` only when the
 * cache is past its TTL (or `force` is set). A failed fetch or an empty table
 * leaves the fallback `CATEGORY_DEFS` in place — this never rejects.
 */
export async function refreshCategoryCatalog(
  options: { force?: boolean } = {},
): Promise<readonly CategoryDef[]> {
  if (!options.force && fetchedAt > 0 && Date.now() - fetchedAt < CATEGORY_CATALOG_TTL_MS) {
    return getCategoryDefs();
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const defs = await fetchCategoryDefs();
      if (defs.length > 0) {
        setCategoryDefs(defs);
        notify();
      }
      fetchedAt = Date.now();
      return getCategoryDefs();
    } catch (err) {
      console.log('[categories] catalog fetch failed, keeping fallback:', err);
      return getCategoryDefs();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Live catalog plus a re-render whenever a fetch replaces it, and a TTL-gated
 * refresh on mount so revisiting a screen after a table edit picks it up.
 */
export function useCategoryDefs(): readonly CategoryDef[] {
  useSyncExternalStore(subscribe, () => version, () => version);
  useEffect(() => {
    void refreshCategoryCatalog();
  }, []);
  return getCategoryDefs();
}
