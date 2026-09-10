/**
 * Category statements storage (core loop redesign §3, wave59). Read-only
 * statements per category — a fresh generation supersedes the prior current
 * row per category_id (insert_category_statements' own logic), so history
 * is a byproduct of generation, not a separate write path.
 */
import { supabase } from '@/lib/supabase';
import type { CategoryId } from '@/lib/categories';

import type { CategoryStatementDraft } from './generate-statements';

export interface CategoryStatement {
  id: string;
  categoryId: string;
  statement: string;
  createdAt: string;
  supersededAt: string | null;
}

function parseRow(row: Record<string, unknown>): CategoryStatement | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const categoryId = typeof row.category_id === 'string' ? row.category_id : null;
  const statement = typeof row.statement === 'string' ? row.statement : null;
  const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
  if (!id || !categoryId || !statement || !createdAt) return null;
  return {
    id,
    categoryId,
    statement,
    createdAt,
    supersededAt: typeof row.superseded_at === 'string' ? row.superseded_at : null,
  };
}

/** Writes a fresh batch — each item supersedes its category's prior current row. All-or-nothing (single RPC call). */
export async function saveCategoryStatements(drafts: readonly CategoryStatementDraft[]): Promise<void> {
  const { error } = await supabase.rpc('insert_category_statements', {
    p_items: drafts.map((draft) => ({ category_id: draft.categoryId, statement: draft.statement })),
  });
  if (error) throw error;
}

/** The current (superseded_at is null) statement for every category this user has generated. */
export async function fetchCurrentStatements(userId: string): Promise<CategoryStatement[]> {
  const { data, error } = await supabase
    .from('category_statements')
    .select('id, category_id, statement, created_at, superseded_at')
    .eq('user_id', userId)
    .is('superseded_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(parseRow).filter((row): row is CategoryStatement => row != null);
}

/** Full history for one category, newest first — the per-category archive fold (§6, 11 separate folds). */
export async function fetchStatementHistory(userId: string, categoryId: CategoryId, limit = 50): Promise<CategoryStatement[]> {
  const { data, error } = await supabase
    .from('category_statements')
    .select('id, category_id, statement, created_at, superseded_at')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(parseRow).filter((row): row is CategoryStatement => row != null);
}
