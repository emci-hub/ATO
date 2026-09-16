-- wave68: per-user bank dedup at draw time + per-axis pool depth.
--
-- Two problems this closes, both in the ongoing-round bank-first path
-- (core loop redesign §2):
--
-- 1. DEDUP. `fetchBankCandidates` (src/lib/questions/bank-pool.ts) drew
--    least-served question_bank_pool rows filtered ONLY by this user's
--    permanent question_bank_reroll_exclusions, plus a bounded ~25-30
--    question recent-TEXT window applied client-side by ongoing-round.ts.
--    Nothing joined against the user's own answer history, so a bank
--    question this user already answered in an earlier round could be served
--    to them again as soon as it aged out of the recent-text window. The
--    shared pool is small by design (~100 target), so this got worse the
--    more rounds a person played. `fetch_bank_candidates` below anti-joins
--    question_items on question_bank_item_id and fixes that.
--
-- 2. DEPTH. Nothing could answer "how many questions does this user have
--    left, per axis" — so there was no way to notice the pool running thin
--    for someone before their round composition was already falling through
--    to (slow, paid) AI generation. `bank_pool_depth` below makes that
--    measurable, which is what the prewarm path in
--    src/lib/questions/prewarm.ts triggers on.
--
-- Both are read-only security-definer functions. No new tables, no new
-- columns, no change to any write path, no change to RLS. The one schema
-- change is a supporting index.

-- 1. Supporting index ---------------------------------------------------------
-- Both functions anti-join question_items by (user_id, question_bank_item_id).
-- question_items_user_idx (wave17) is user_id only, so without this the
-- anti-join re-reads every row this user has ever answered — 25 per round,
-- unbounded over time. Partial: Infinite Questions rows are always null here
-- (wave49) and are never candidates, so they don't belong in the index.
create index if not exists question_items_user_bank_item_idx
  on public.question_items (user_id, question_bank_item_id)
  where question_bank_item_id is not null;

-- 2. fetch_bank_candidates ----------------------------------------------------

create or replace function public.fetch_bank_candidates(p_axis text, p_limit int)
returns table(id uuid, category text, prompt text, options jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Same 25-item ceiling the sibling bank RPCs use (wave50). The caller
  -- over-fetches a small multiple of what it needs so it can still drop
  -- near-duplicates client-side and land close to its target.
  lim := least(greatest(coalesce(p_limit, 0), 0), 100);
  if lim = 0 then
    return;
  end if;

  return query
    select b.id, b.category, b.prompt, b.options
    from public.question_bank_pool b
    where b.axis = p_axis
      -- Permanent per-user reroll exclusions (wave49): never again, ever.
      and not exists (
        select 1 from public.question_bank_reroll_exclusions x
        where x.user_id = uid and x.question_bank_item_id = b.id
      )
      -- Already served to this user in any earlier pack. Deliberately keyed
      -- on the item EXISTING, not on it being answered: a question sitting
      -- unanswered in an abandoned round was still shown to them, and
      -- re-serving it in a fresh round is the same repeat from their side.
      and not exists (
        select 1 from public.question_items qi
        where qi.user_id = uid and qi.question_bank_item_id = b.id
      )
    -- Least-served first (unchanged), then oldest — a deterministic
    -- tie-break, since times_served is 0 for every row in a freshly
    -- topped-up axis and an unordered tie would make the draw arbitrary.
    order by b.times_served asc, b.created_at asc
    limit lim;
end;
$$;

revoke all on function public.fetch_bank_candidates(text, int) from public, anon;
grant execute on function public.fetch_bank_candidates(text, int) to authenticated;

comment on function public.fetch_bank_candidates(text, int) is
  'Bank-first draw for one axis (core loop redesign §2), filtered to what this user has genuinely never seen: excludes their question_bank_reroll_exclusions AND any question_bank_pool row already referenced by one of their question_items. Replaces the client-side filtering in bank-pool.ts fetchBankCandidates, which only knew about the reroll list. Read-only; security definer so the anti-join sees the caller''s own rows without depending on RLS select policy shape.';

-- 3. bank_pool_depth ----------------------------------------------------------

create or replace function public.bank_pool_depth()
returns table(axis text, available int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- One row per axis PRESENT IN THE POOL. An axis with zero rows is absent
  -- from this result rather than reported as 0 — the caller treats a missing
  -- axis as 0 (see src/lib/questions/prewarm.ts), so a genuinely empty axis
  -- still registers as short and gets topped up.
  return query
    select b.axis, count(*)::int as available
    from public.question_bank_pool b
    where not exists (
        select 1 from public.question_bank_reroll_exclusions x
        where x.user_id = uid and x.question_bank_item_id = b.id
      )
      and not exists (
        select 1 from public.question_items qi
        where qi.user_id = uid and qi.question_bank_item_id = b.id
      )
    group by b.axis;
end;
$$;

revoke all on function public.bank_pool_depth() from public, anon;
grant execute on function public.bank_pool_depth() to authenticated;

comment on function public.bank_pool_depth() is
  'Per-axis count of question_bank_pool rows this user has never been served and has not permanently rerolled — i.e. how many more rounds the shared bank can cover for them before composition has to fall through to AI generation. Same filter as fetch_bank_candidates, so depth and the actual draw can never disagree. Read by src/lib/questions/prewarm.ts to decide whether to top the pool up ahead of demand.';
