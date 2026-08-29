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

export async function fetchLatestQuestionPack(): Promise<QuestionPackRow | null> {
  const { data: pack, error } = await supabase
    .from('question_packs')
    .select('id, generated_on, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pack) return null;

  const { data: items, error: itemError } = await supabase
    .from('question_items')
    .select('id, pack_id, sort_index, axis, prompt, options, answered_option, skipped_at')
    .eq('pack_id', pack.id)
    .order('sort_index', { ascending: true });
  if (itemError) throw itemError;

  return mapPack(pack as PackRow, (items ?? []) as ItemRow[]);
}

export async function saveQuestionPack(input: {
  generatedOn: string;
  drafts: QuestionDraft[];
}): Promise<QuestionPackRow> {
  const payload = input.drafts.map((draft) => ({
    axis: draft.axis,
    prompt: draft.prompt,
    options: draft.options,
  }));
  const { data, error } = await supabase.rpc('insert_question_pack', {
    p_generated_on: input.generatedOn,
    p_items: payload,
  });
  if (error) throw error;
  const pack = await fetchLatestQuestionPack();
  if (!pack || pack.id !== data) {
    throw new Error('Question pack did not save.');
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

export async function skipQuestionItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('skip_question_item', {
    p_item_id: itemId,
  });
  if (error) throw error;
}

export async function skipRestOfQuestionPack(packId: string): Promise<void> {
  const { error } = await supabase.rpc('skip_rest_question_pack', {
    p_pack_id: packId,
  });
  if (error) throw error;
}
