import { supabase } from '@/lib/supabase';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import type { QuestionDraft, QuestionItemRow, QuestionOption, QuestionPackRow } from './types';

interface PackRow {
  id: string;
  generated_on: string;
  created_at: string;
}

interface ItemRow {
  id: string;
  pack_id: string;
  sort_index: number;
  axis: string;
  prompt: string;
  options: unknown;
  answered_option: number | null;
  skipped_at: string | null;
}

function ymd(value: string): string {
  return String(value).slice(0, 10);
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

function mapPack(pack: PackRow, items: ItemRow[]): QuestionPackRow {
  return {
    id: pack.id,
    generatedOn: ymd(pack.generated_on),
    createdAt: pack.created_at,
    items: items
      .slice()
      .sort((a, b) => a.sort_index - b.sort_index)
      .flatMap((row) => {
        if (!isAxis(row.axis)) return [];
        const options = parseOptions(row.options);
        if (options.length < 2) return [];
        const mapped: QuestionItemRow = {
          id: row.id,
          packId: row.pack_id,
          sortIndex: row.sort_index,
          axis: row.axis,
          prompt: row.prompt,
          options,
          answeredOption: row.answered_option,
          skippedAt: row.skipped_at,
        };
        return [mapped];
      }),
  };
}

async function fetchPackItems(packId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from('question_items')
    .select('id, pack_id, sort_index, axis, prompt, options, answered_option, skipped_at')
    .eq('pack_id', packId)
    .order('sort_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ItemRow[];
}

/**
 * Latest ongoing-round pack, scoped to `kind='ongoing_round'` (wave49:
 * `question_packs.kind` is NOT NULL). The scoping is kept even though the
 * Infinite Questions reader that shared this table was deleted 2026-09-16 —
 * `kind` still distinguishes the rows already written under the old value,
 * so an unscoped "latest pack" read would serve a stale 5-item daily pack as
 * if it were a 25-item round.
 */
export async function fetchLatestOngoingRoundPack(): Promise<QuestionPackRow | null> {
  const { data: pack, error } = await supabase
    .from('question_packs')
    .select('id, generated_on, created_at')
    .eq('kind', 'ongoing_round')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pack) return null;

  const items = await fetchPackItems(pack.id);
  return mapPack(pack as PackRow, items);
}

export async function saveOngoingRoundBatch(drafts: QuestionDraft[]): Promise<QuestionPackRow> {
  if (drafts.length === 0) {
    throw new Error('No questions available for a new round right now.');
  }
  const payload = drafts.map((draft) => {
    if (!draft.bankItemId) {
      throw new Error('Ongoing round draft missing bankItemId.');
    }
    return {
      axis: draft.axis,
      prompt: draft.prompt,
      options: draft.options,
      question_bank_item_id: draft.bankItemId,
    };
  });
  const { data, error } = await supabase.rpc('insert_ongoing_round_pack', {
    p_items: payload,
  });
  if (error) throw error;
  const pack = await fetchLatestOngoingRoundPack();
  if (!pack || pack.id !== data) {
    throw new Error('Ongoing round pack did not save.');
  }
  return pack;
}

export async function answerQuestionItem(itemId: string, optionIndex: number): Promise<void> {
  const { error } = await supabase.rpc('answer_question_item', {
    p_item_id: itemId,
    p_option_index: optionIndex,
  });
  if (error) throw error;
}

export async function saveQuestionDeferral(
  userId: string,
  deferred: readonly TraitAxis[],
): Promise<void> {
  const { error } = await supabase
    .from('me')
    .update({ question_deferred: deferred })
    .eq('id', userId);
  if (error) throw error;
}
