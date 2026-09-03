-- login_email_for_identifier (auth_password_optional.sql) was callable with
-- the anon key directly from the client, which let anyone signed out
-- enumerate handle -> email pairs merely by calling the RPC with a guessed
-- handle -- no password required, no rate limit, just the handle.
--
-- Password login now goes through the password-login Edge Function
-- (supabase/functions/password-login): it resolves the handle to an email
-- with the service-role key on the server and calls signInWithPassword
-- itself, so the email never reaches the client -- only the resulting
-- session, or a generic failure that does not distinguish "no such handle"
-- from "wrong password". This RPC's job is unchanged; only who may call it
-- changes.

revoke execute on function public.login_email_for_identifier(text) from anon, authenticated, public;

comment on function public.login_email_for_identifier(text) is
  'Maps a login identifier (email or @handle) to auth.users.email. service_role only -- called from the password-login Edge Function, never directly from a client (wave36). Returns null when no handle matches. Does not create users.';
