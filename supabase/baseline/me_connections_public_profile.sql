-- BASELINE (reference only — NOT a migration, never run it).
--
-- The base tables public.me and public.connections, and the function public.public_profile,
-- were created in the Supabase dashboard before this repo kept migrations, so no file in
-- supabase/migrations/ defines them (red-team 2026-09-03, finding S18). This file records
-- what the LIVE database held on 2026-10-19, read through the Management API
-- (supabase db query --linked), BEFORE wave98 was applied. Later migrations alter these.
-- Refresh it by re-running the queries in supabase/baseline/README.md.
--
-- Not captured here: the grants Supabase gives anon/authenticated on every public table by
-- default (all privileges; row access is decided by RLS), and column-level grants (same).

-- ===========================================================================
-- public.me
-- ===========================================================================
create table public.me (
  id uuid not null default auth.uid(),
  name text not null,
  handle text not null,
  show_up text,
  talk_style text,
  knocks_you_off text,
  morning_cue text,
  timezone text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  recipe jsonb not null default '{"top": "even", "base": "circle", "hair": null, "source": "shape", "palette": null}'::jsonb,
  ai_consent boolean,
  facts jsonb not null default '[]'::jsonb,
  milestones_celebrated jsonb not null default '{}'::jsonb,
  referred_by uuid,
  born_on date,
  city text,
  evening_wind_down text,
  energy_pattern text,
  support_style text,
  current_focus text,
  visible boolean not null default true,
  openness numeric,
  conscientiousness numeric,
  extraversion numeric,
  agreeableness numeric,
  steadiness numeric,
  attachment_anxiety numeric,
  attachment_avoidance numeric,
  conflict_assertiveness numeric,
  conflict_cooperativeness numeric,
  trait_sources jsonb not null default '{}'::jsonb,
  autonomy numeric,
  competence numeric,
  relatedness numeric,
  growth_mindset numeric,
  locus_of_control numeric,
  self_efficacy numeric,
  trait_touched_at jsonb not null default '{}'::jsonb,
  sage_knows jsonb not null default '{}'::jsonb,
  is_founder boolean not null default false,
  voice_preset text not null default 'close_friend'::text,
  tokens integer not null default 0,
  sage_title jsonb not null default '{}'::jsonb,
  playfulness numeric,
  close_friends_share boolean not null default false,
  category_spotlight jsonb not null default '{}'::jsonb,
  sage_story jsonb not null default '{}'::jsonb,
  question_deferred jsonb not null default '[]'::jsonb,
  is_root boolean not null default false,
  nav_layout jsonb,
  celebrated_milestone_ids text[] not null default '{}'::text[],
  ato_tokens integer not null default 0
);
-- Constraints, from pg_constraint (checks, keys, foreign keys), for me and connections:
-- connections.connections_no_self: CHECK ((user_id <> peer_id))
-- connections.connections_peer_id_fkey: FOREIGN KEY (peer_id) REFERENCES auth.users(id) ON DELETE CASCADE
-- connections.connections_pkey: PRIMARY KEY (user_id, peer_id)
-- connections.connections_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
-- me.me_agreeableness_unit: CHECK (((agreeableness IS NULL) OR ((agreeableness >= (0)::numeric) AND (agreeableness <= (1)::numeric))))
-- me.me_ato_tokens_check: CHECK ((ato_tokens >= 0))
-- me.me_attachment_anxiety_unit: CHECK (((attachment_anxiety IS NULL) OR ((attachment_anxiety >= (0)::numeric) AND (attachment_anxiety <= (1)::numeric))))
-- me.me_attachment_avoidance_unit: CHECK (((attachment_avoidance IS NULL) OR ((attachment_avoidance >= (0)::numeric) AND (attachment_avoidance <= (1)::numeric))))
-- me.me_autonomy_unit: CHECK (((autonomy IS NULL) OR ((autonomy >= (0)::numeric) AND (autonomy <= (1)::numeric))))
-- me.me_born_on_plausible: CHECK (((born_on IS NULL) OR (born_on >= '1900-01-01'::date)))
-- me.me_city_slug: CHECK (((city IS NULL) OR (city ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)))
-- me.me_competence_unit: CHECK (((competence IS NULL) OR ((competence >= (0)::numeric) AND (competence <= (1)::numeric))))
-- me.me_conflict_assertiveness_unit: CHECK (((conflict_assertiveness IS NULL) OR ((conflict_assertiveness >= (0)::numeric) AND (conflict_assertiveness <= (1)::numeric))))
-- me.me_conflict_cooperativeness_unit: CHECK (((conflict_cooperativeness IS NULL) OR ((conflict_cooperativeness >= (0)::numeric) AND (conflict_cooperativeness <= (1)::numeric))))
-- me.me_conscientiousness_unit: CHECK (((conscientiousness IS NULL) OR ((conscientiousness >= (0)::numeric) AND (conscientiousness <= (1)::numeric))))
-- me.me_current_focus_known: CHECK (((current_focus IS NULL) OR (current_focus = ANY (ARRAY['habit'::text, 'through_it'::text, 'like_yourself'::text, 'show_up'::text]))))
-- me.me_energy_pattern_known: CHECK (((energy_pattern IS NULL) OR (energy_pattern = ANY (ARRAY['morning'::text, 'afternoon'::text, 'evening'::text, 'night_owl'::text]))))
-- me.me_evening_wind_down_present: CHECK (((evening_wind_down IS NULL) OR (btrim(evening_wind_down) <> ''::text)))
-- me.me_extraversion_unit: CHECK (((extraversion IS NULL) OR ((extraversion >= (0)::numeric) AND (extraversion <= (1)::numeric))))
-- me.me_growth_mindset_unit: CHECK (((growth_mindset IS NULL) OR ((growth_mindset >= (0)::numeric) AND (growth_mindset <= (1)::numeric))))
-- me.me_handle_check: CHECK (((handle = lower(handle)) AND (handle ~ '^[a-z0-9]{1,20}$'::text) AND (handle <> ALL (ARRAY['ato'::text, 'sage'::text, 'admin'::text, 'support'::text, 'you'::text, 'astrollogs'::text, 'emci'::text]))))
-- me.me_id_fkey: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
-- me.me_knocks_you_off_check: CHECK ((btrim(knocks_you_off) <> ''::text))
-- me.me_locus_of_control_unit: CHECK (((locus_of_control IS NULL) OR ((locus_of_control >= (0)::numeric) AND (locus_of_control <= (1)::numeric))))
-- me.me_morning_cue_check: CHECK ((btrim(morning_cue) <> ''::text))
-- me.me_name_check: CHECK ((btrim(name) <> ''::text))
-- me.me_openness_unit: CHECK (((openness IS NULL) OR ((openness >= (0)::numeric) AND (openness <= (1)::numeric))))
-- me.me_pkey: PRIMARY KEY (id)
-- me.me_playfulness_unit: CHECK (((playfulness IS NULL) OR ((playfulness >= (0)::numeric) AND (playfulness <= (1)::numeric))))
-- me.me_referred_by_fkey: FOREIGN KEY (referred_by) REFERENCES me(id) ON DELETE SET NULL
-- me.me_referred_by_not_self: CHECK ((referred_by IS DISTINCT FROM id))
-- me.me_relatedness_unit: CHECK (((relatedness IS NULL) OR ((relatedness >= (0)::numeric) AND (relatedness <= (1)::numeric))))
-- me.me_sage_knows_object: CHECK ((jsonb_typeof(sage_knows) = 'object'::text))
-- me.me_self_efficacy_unit: CHECK (((self_efficacy IS NULL) OR ((self_efficacy >= (0)::numeric) AND (self_efficacy <= (1)::numeric))))
-- me.me_show_up_check: CHECK ((btrim(show_up) <> ''::text))
-- me.me_steadiness_unit: CHECK (((steadiness IS NULL) OR ((steadiness >= (0)::numeric) AND (steadiness <= (1)::numeric))))
-- me.me_support_style_known: CHECK (((support_style IS NULL) OR (support_style = ANY (ARRAY['nudge'::text, 'space'::text, 'listen'::text, 'plan'::text]))))
-- me.me_talk_style_check: CHECK ((talk_style = ANY (ARRAY['quiet'::text, 'even'::text, 'loud'::text])))
-- me.me_tokens_check: CHECK ((tokens >= 0))
-- me.me_trait_sources_object: CHECK ((jsonb_typeof(trait_sources) = 'object'::text))
-- me.me_trait_touched_at_object: CHECK ((jsonb_typeof(trait_touched_at) = 'object'::text))
-- me.me_voice_preset_check: CHECK ((voice_preset = ANY (ARRAY['neutral'::text, 'close_friend'::text, 'hyperactive_friend'::text, 'parent'::text, 'motivational_coach'::text])))

-- Indexes (me, connections):
CREATE UNIQUE INDEX connections_pkey ON public.connections USING btree (user_id, peer_id);
CREATE UNIQUE INDEX me_pkey ON public.me USING btree (id);
CREATE UNIQUE INDEX me_handle_unique_lower ON public.me USING btree (lower(handle));
CREATE INDEX me_referred_by_idx ON public.me USING btree (referred_by) WHERE (referred_by IS NOT NULL);

alter table public.me enable row level security;
alter table public.connections enable row level security;

-- ===========================================================================
-- public.connections
-- ===========================================================================
create table public.connections (
  user_id uuid not null,
  peer_id uuid not null,
  created_at timestamp with time zone not null default now()
);

-- ===========================================================================
-- Policies (me, connections). Note: me_update_own has NO with check clause.
-- ===========================================================================
create policy connections_delete_own on public.connections as PERMISSIVE for DELETE to public
  using ((auth.uid() = user_id));
create policy connections_insert_own on public.connections as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));
create policy connections_select_own on public.connections as PERMISSIVE for SELECT to public
  using ((auth.uid() = user_id));
create policy me_insert_own on public.me as PERMISSIVE for INSERT to public
  with check ((auth.uid() = id));
create policy me_select_own on public.me as PERMISSIVE for SELECT to public
  using ((auth.uid() = id));
create policy me_update_own on public.me as PERMISSIVE for UPDATE to public
  using ((auth.uid() = id));

-- ===========================================================================
-- Triggers (me, connections) — the function bodies live in later migrations except
-- mirror_connection / unmirror_connection, reproduced below.
-- ===========================================================================
CREATE TRIGGER connections_mirror_reverse AFTER INSERT ON public.connections FOR EACH ROW EXECUTE FUNCTION mirror_connection();
CREATE TRIGGER connections_unmirror_reverse AFTER DELETE ON public.connections FOR EACH ROW EXECUTE FUNCTION unmirror_connection();
CREATE TRIGGER me_after_insert_issue_codes AFTER INSERT ON public.me FOR EACH ROW EXECUTE FUNCTION me_after_insert_issue_codes();
CREATE TRIGGER me_ato_tokens_guard BEFORE UPDATE OF ato_tokens ON public.me FOR EACH ROW EXECUTE FUNCTION me_ato_tokens_guard();
CREATE TRIGGER me_born_on_guard BEFORE INSERT OR UPDATE ON public.me FOR EACH ROW EXECUTE FUNCTION me_born_on_guard();
CREATE TRIGGER me_guard_is_root BEFORE INSERT OR UPDATE OF is_root ON public.me FOR EACH ROW EXECUTE FUNCTION me_guard_is_root();
CREATE TRIGGER me_invite_guard BEFORE INSERT OR UPDATE ON public.me FOR EACH ROW EXECUTE FUNCTION me_invite_guard();
CREATE TRIGGER me_issue_founder_code AFTER INSERT OR UPDATE OF is_founder ON public.me FOR EACH ROW EXECUTE FUNCTION me_issue_founder_code();
CREATE TRIGGER me_tokens_guard BEFORE UPDATE ON public.me FOR EACH ROW EXECUTE FUNCTION me_tokens_guard();

-- ===========================================================================
-- Functions that were not in any migration
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.public_profile(p_handle text)
 RETURNS TABLE(id uuid, name text, handle text, show_up text, talk_style text, recipe jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, m.name, m.handle, m.show_up, m.talk_style, m.recipe
  from public.me m
  where m.handle = lower(btrim(p_handle, ' @'))
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.peer_profile(p_user_id uuid)
 RETURNS TABLE(id uuid, name text, handle text, show_up text, talk_style text, recipe jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, m.name, m.handle, m.show_up, m.talk_style, m.recipe
  from public.me m
  where m.id = p_user_id
    and exists (
      select 1 from public.connections c
      where (c.user_id = auth.uid() and c.peer_id = m.id)
         or (c.user_id = m.id and c.peer_id = auth.uid())
    )
$function$;

CREATE OR REPLACE FUNCTION public.mirror_connection()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.connections (user_id, peer_id)
  values (new.peer_id, new.user_id)
  on conflict do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.unmirror_connection()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.connections
  where user_id = old.peer_id and peer_id = old.user_id;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_taken(p_handle text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.me
    where lower(me.handle) = lower(btrim(coalesce(p_handle, '')))
  );
$function$;
