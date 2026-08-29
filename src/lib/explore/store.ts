import { supabase } from '@/lib/supabase';

import type {
  ExploreDraft,
  ExplorePackRow,
  ExploreSignalKind,
  ExploreTrigger,
} from './types';

interface PackRow {
  id: string;
  generated_on: string;
  trigger: ExploreTrigger;
  fingerprint: string;
  created_at: string;
}

interface EntryRow {
  id: string;
  pack_id: string;
  sort_index: number;
  body: string;
  traits: string[] | null;
  chips: string[] | null;
  signal_kind: ExploreSignalKind | null;
}

interface ReactionRow {
  entry_id: string;
  landed: boolean;
}

function ymd(value: string): string {
  return String(value).slice(0, 10);
}

function mapPack(
  pack: PackRow,
  entries: EntryRow[],
  reactions: ReactionRow[],
): ExplorePackRow {
  const landed = new Map(reactions.map((row) => [row.entry_id, row.landed]));
  return {
    id: pack.id,
    generatedOn: ymd(pack.generated_on),
    trigger: pack.trigger,
    fingerprint: pack.fingerprint,
    createdAt: pack.created_at,
    entries: entries
      .slice()
      .sort((a, b) => a.sort_index - b.sort_index)
      .map((entry) => ({
        id: entry.id,
        packId: entry.pack_id,
        sortIndex: entry.sort_index,
        body: entry.body,
        traits: entry.traits ?? [],
        chips: entry.chips ?? [],
        signalKind: entry.signal_kind,
        landed: landed.get(entry.id) ?? null,
      })),
  };
}

export async function fetchLatestExplorePack(): Promise<ExplorePackRow | null> {
  const { data: pack, error } = await supabase
    .from('explore_packs')
    .select('id, generated_on, trigger, fingerprint, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pack) return null;

  const { data: entries, error: entryError } = await supabase
    .from('explore_entries')
    .select('id, pack_id, sort_index, body, traits, chips, signal_kind')
    .eq('pack_id', pack.id)
    .order('sort_index', { ascending: true });
  if (entryError) throw entryError;

  const ids = (entries ?? []).map((row) => row.id);
  let reactions: ReactionRow[] = [];
  if (ids.length > 0) {
    const { data: reactionRows, error: reactionError } = await supabase
      .from('explore_reactions')
      .select('entry_id, landed')
      .in('entry_id', ids);
    if (reactionError) throw reactionError;
    reactions = reactionRows ?? [];
  }

  return mapPack(pack as PackRow, (entries ?? []) as EntryRow[], reactions);
}

export async function saveExplorePack(input: {
  generatedOn: string;
  trigger: ExploreTrigger;
  fingerprint: string;
  drafts: ExploreDraft[];
}): Promise<ExplorePackRow> {
  const payload = input.drafts.map((draft) => ({
    body: draft.body,
    traits: draft.traits,
    chips: draft.chips,
    signal_kind: draft.signalKind,
  }));
  const { data, error } = await supabase.rpc('insert_explore_pack', {
    p_generated_on: input.generatedOn,
    p_trigger: input.trigger,
    p_fingerprint: input.fingerprint,
    p_entries: payload,
  });
  if (error) throw error;
  const pack = await fetchLatestExplorePack();
  if (!pack || pack.id !== data) {
    throw new Error('Explore pack did not save.');
  }
  return pack;
}

export async function recordExploreReaction(entryId: string, landed: boolean): Promise<void> {
  const { error } = await supabase.rpc('record_explore_reaction', {
    p_entry_id: entryId,
    p_landed: landed,
  });
  if (error) throw error;
}

/** Bodies that did not land — phrasing/angle only. Never a trait write. */
export async function fetchExploreMissNotes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('explore_reactions')
    .select('entry_id, landed')
    .eq('landed', false)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.entry_id as string);
  if (ids.length === 0) return [];
  const { data: entries, error: entryError } = await supabase
    .from('explore_entries')
    .select('id, body')
    .in('id', ids);
  if (entryError) throw entryError;
  const byId = new Map((entries ?? []).map((row) => [row.id as string, String(row.body)]));
  return ids
    .map((id) => byId.get(id))
    .filter((body): body is string => !!body)
    .map((body) => body.slice(0, 180));
}
