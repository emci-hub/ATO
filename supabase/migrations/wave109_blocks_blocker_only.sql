-- wave109: D18 (master plan, Release C). Only the blocker can read a block row.
-- Chat and every other Circle path read blocks through SECURITY DEFINER functions
-- (_circle_blocked etc.), and the app never selects from public.blocks, so the
-- blocked person no longer needs a read; this stops them seeing that a block exists.
-- Re-runnable. Insert/delete policies are unchanged.

drop policy if exists blocks_select_parties on public.blocks;
drop policy if exists blocks_select_blocker on public.blocks;

create policy blocks_select_blocker on public.blocks
  for select using (auth.uid() = blocked_by);
