import { supabase } from '@/lib/supabase';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import type { CategoryId } from '@/lib/categories';

import type { CategoryBatchState } from './category-batch';
import type { QuestionDraft, QuestionOption } from './types';

interface BatchRow {
  id: string;
  category_id: string;
  finalized_at: string | null;
}

interface ItemRow {
  id: string;
  batch_id: string;
  sort_index: number;
  axis: string;
  prompt: string;
  options: unknown;
  answered_option: number | null;
}

function isAxis(value: string): value is TraitAxis {
  return (TRAIT_AXES as readonly string[]).includes(value);
}

function parseOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestionOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    const value = typeof row.value === 'number' ? row.value : Number(row.value);
    if (!text || !Number.isFinite(value)) continue;
    out.push({ text, value });
  }
  return out;
}

function mapBatch(batch: BatchRow, items: ItemRow[]): CategoryBatchState {
  return {
    id: batch.id,
    categoryId: batch.category_id,
    finalizedAt: batch.finalized_at,
    items: items
      .slice()
      .sort((a, b) => a.sort_index - b.sort_index)
      .flatMap((row) => {
        if (!isAxis(row.axis)) return [];
        const options = parseOptions(row.options);
        if (options.length < 2) return [];
        return [
          {
            id: row.id,
            axis: row.axis,
            prompt: row.prompt,
            options,
            answeredOption: row.answered_option,
          },
        ];
      }),
  };
}

/**
 * Literal question text already served to this user via Infinite Questions
 * (question_items.prompt — long-retained, never pruned). Used as the
 * repeat-prevention exclusion list for category batches; RLS already scopes
 * this to the caller's own rows.
 */
export async function fetchAskedQuestionTexts(): Promise<string[]> {
  const { data, error } = await supabase
    .from('question_items')
    .select('prompt')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as { prompt: unknown }).prompt)
    .filter((text): text is string => typeof text === 'string' && text.length > 0);
}

export async function fetchCategoryBatch(categoryId: CategoryId): Promise<CategoryBatchState | null> {
  const { data: batch, error } = await supabase
    .from('category_question_batches')
    .select('id, category_id, finalized_at')
    .eq('category_id', categoryId)
    .maybeSingle();
  if (error) throw error;
  if (!batch) return null;

  const { data: items, error: itemError } = await supabase
    .from('category_question_items')
    .select('id, batch_id, sort_index, axis, prompt, options, answered_option')
    .eq('batch_id', (batch as BatchRow).id)
    .order('sort_index', { ascending: true });
  if (itemError) throw itemError;

  return mapBatch(batch as BatchRow, (items ?? []) as ItemRow[]);
}

/** Every category batch this user has started, for the "all categories locked" hub view. */
export async function fetchAllCategoryBatches(): Promise<CategoryBatchState[]> {
  const { data: batches, error } = await supabase
    .from('category_question_batches')
    .select('id, category_id, finalized_at');
  if (error) throw error;
  const rows = (batches ?? []) as BatchRow[];
  if (rows.length === 0) return [];

  const { data: items, error: itemError } = await supabase
    .from('category_question_items')
    .select('id, batch_id, sort_index, axis, prompt, options, answered_option');
  if (itemError) throw itemError;
  const allItems = (items ?? []) as ItemRow[];

  return rows.map((batch) => mapBatch(batch, allItems.filter((item) => item.batch_id === batch.id)));
}

export async function saveCategoryBatchItems(
  categoryId: CategoryId,
  drafts: readonly QuestionDraft[],
): Promise<CategoryBatchState> {
  const payload = drafts.map((draft) => ({
    axis: draft.axis,
    prompt: draft.prompt,
    options: draft.options,
  }));
  const { error } = await supabase.rpc('insert_category_batch_items', {
    p_category_id: categoryId,
    p_items: payload,
  });
  if (error) throw error;
  const batch = await fetchCategoryBatch(categoryId);
  if (!batch) {
    throw new Error('Category batch did not save.');
  }
  return batch;
}

export async function answerCategoryQuestionItem(itemId: string, optionIndex: number): Promise<void> {
  const { error } = await supabase.rpc('answer_category_question_item', {
    p_item_id: itemId,
    p_option_index: optionIndex,
  });
  if (error) throw error;
}

/** Sets finalized_at (nothing else) on every locked-but-not-yet-finalized batch. Returns how many. */
export async function finalizeCategoryBatches(): Promise<number> {
  const { data, error } = await supabase.rpc('finalize_category_batches');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
