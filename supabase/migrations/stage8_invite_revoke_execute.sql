-- Tighten EXECUTE grants. Default privileges give anon EXECUTE on new functions.
-- Applied as stage8_invite_revoke_execute.

revoke execute on function public.complete_signup(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.complete_signup(text, text, text, text, text, text, text, text) to authenticated;

revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

revoke execute on function public.issue_invite_codes(uuid, int) from public, anon, authenticated;
grant execute on function public.issue_invite_codes(uuid, int) to service_role;

revoke execute on function public.me_after_insert_issue_codes() from public, anon, authenticated;
revoke execute on function public.me_invite_guard() from public, anon, authenticated;
revoke execute on function public.invite_codes_normalize() from public, anon, authenticated;

revoke execute on function public.referral_branch(uuid) from public, anon, authenticated;
grant execute on function public.referral_branch(uuid) to service_role;

revoke execute on function public.pause_branch(uuid) from public, anon, authenticated;
grant execute on function public.pause_branch(uuid) to service_role;

revoke execute on function public.unpause_branch(uuid) from public, anon, authenticated;
grant execute on function public.unpause_branch(uuid) to service_role;

revoke execute on function public.delete_branch(uuid) from public, anon, authenticated;
grant execute on function public.delete_branch(uuid) to service_role;

revoke execute on function public.assert_invite_usable(text) from public;
grant execute on function public.assert_invite_usable(text) to anon, authenticated;
