-- wave99d_library_card_vocab.sql (emci 2026-10-19, round 3). NOT APPLIED yet: apply only with emci's ok.
--
-- The library backstop guard (wave93 _library_card_ok) refused everyday words by keyword:
-- feeling words ("anxious", "insecure", "anxiety", "therapy"), any swearing ("fuck", "shit",
-- "bitch", "asshole") and labels as plain vocabulary ("a toxic workplace", "trauma-bonded by a
-- bad haircut"). So a good deep-dive or Story card using them was silently dropped on the
-- server. emci: "CONTEXT, NOT BLANKET BANS"; "Allow 'fuck' in adult jokes consistently across
-- generation, reviewers, checks, and the server"; "Block unsupported labels applied to users,
-- not legitimate discussion or contextual jokes."
--
-- Same function, same signature, same grants: a verbatim copy of wave93 with only the word
-- patterns changed.
-- * Swearing is allowed, strong swearing included. Refused instead: slurs (the same list as
--   the app's JOKE_HARM_FILTER in src/lib/voice/card-joke.ts; "cunt", "slut" and "whore" are
--   slurs there too) and sexually explicit terms (the same list).
-- * Labels: refused only in their clear verdict forms about the reader ("you're toxic",
--   "your avoidant attachment explains", "you have ADHD", "so bipolar of you", "a classic
--   narcissist", "people like you are needy") and any "diagnos..." word. Everyday and contextual
--   use passes.
-- Residual risk (by design): this is a backstop. The Edge Function runs the app's full checks
-- (src/lib/voice/clinical.ts: more verbs, fillers and forms) BEFORE a card reaches this
-- function, so a looser verdict form that slips past these regexes was already judged there.

create or replace function public._library_card_ok(p_kind text, p_card jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  body text := public._library_card_text(p_kind, p_card);
  core text[] := case p_kind
    when 'deep_dive' then array['title', 'whatItMeansForYou']
    when 'story' then array['scene', 'moment', 'means']
    else array['title', 'whatItMeansForYou']
  end;
  k text;
begin
  if p_card is null or jsonb_typeof(p_card) <> 'object' or octet_length(p_card::text) > 6000 then
    return 'shape';
  end if;
  foreach k in array core loop
    if jsonb_typeof(p_card -> k) is distinct from 'string' or char_length(p_card ->> k) not between 3 and 600 then
      return 'missing ' || k;
    end if;
  end loop;
  -- Legends ids are short (a1-a6, m1-m3): checked by their own pattern.
  if p_kind = 'legend' and (
       coalesce(p_card ->> 'legendId', '') !~ '^lf_[a-z0-9_]{2,40}$'
       or coalesce(p_card ->> 'angleId', '') !~ '^a[1-6]$'
       or coalesce(p_card ->> 'momentId', '') !~ '^m[1-3]$') then
    return 'legend ids';
  end if;
  if char_length(body) < 40 then return 'too short'; end if;
  if body ~* '(https?://|www\.|\.com\M|@|<|>|\[|\]|#)' then return 'link or markup'; end if;
  if body ~* '\m(n[i1]gg(a|er|ers|as|uh|az)|fag(s|got|gots|gy)?|retard(s|ed)?|trann(y|ies)|kikes?|spics?|wetbacks?|gooks?|dykes?|cunts?|sluts?|slutty|whores?)\M' then return 'slur'; end if;
  if body ~* '\m(porn[a-z]*|nudes|orgasm[a-z]*|horny|blow ?jobs?|hand ?jobs?|masturbat[a-z]*|dildos?|boners?|erections?|cumming|cumshots?|cocks?|puss(y|ies)|genitals?)\M' then return 'explicit'; end if;
  if p_kind <> 'legend' and body ~ '[0-9]' then return 'digit'; end if;
  if p_kind <> 'legend'
     and (body ~* '\myou(''re|’re| are| seem| sound| come across as| can be)\s+((so|clearly|really|totally|a|an|the|bit|little|kind|of|pretty|very|such|just|obviously|definitely|probably|basically|literally|textbook|classic)\s+){0,4}(toxic|needy|clingy|co-?dependent|avoidant(?! (of|about|around)\M)|narcissists?|narcissistic|psychopaths?|psychopathic|sociopaths?|sociopathic|bipolar|adhd|ocd|ptsd|neurotic|mentally ill|emotionally unavailable|red flags?|(anxiously|securely|insecurely)[- ]attached)\M'
       or body ~* '\myour\s+(avoidant attachment|anxious attachment|attachment style|anxiety disorder|[a-z]+ disorder|trauma|depression|adhd|ocd|ptsd|narcissism|codependency|toxic side|needy side|clingy side|avoidant side)\s+(is|are|was|shows|showing|explains|means|kicks in)\M'
       or body ~* '\m(you have|you''ve got|you’ve got|you might have|you probably have|you clearly have)\s+((a|an|some|full-blown|textbook|classic|clinical)\s+){0,2}(depression|bipolar|adhd|ocd|ptsd|autism|[a-z]+ disorder|trauma|attachment issues|narcissistic personality|borderline personality|mental illness)\M'
       or body ~* '\m(narcissistic|bipolar|toxic|co-?dependent|psychopathic|sociopathic|clingy|needy|neurotic|crazy)\s+of you\M'
       or body ~* '\m(classic|textbook|typical|certified)\s+(narcissist|narcissistic|psychopath|sociopath|adhd|ocd|bipolar|avoidant|codependent|neurotic)\M'
       or body ~* '\mpeople like you (are|get|can be)\s+([a-z]+\s+){0,2}(toxic|needy|clingy|codependent|avoidant|narcissistic|neurotic|crazy)\M'
       or body ~* '\mdiagnos') then
    return 'clinical word';
  end if;
  return null;
end;
$$;
revoke all on function public._library_card_ok(text, jsonb) from public, anon, authenticated;
