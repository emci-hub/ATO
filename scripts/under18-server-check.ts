/**
 * Under-18 server gate (wave101, emci 2026-10-20). Run: npm run check:under18-server
 *
 * Offline, static. Reads every migration, works out the latest definition and the client
 * grants of every public function (same apply order as the repo history), and pins:
 *   1. every function a client role can execute is classified here: GATED (app use, refused
 *      under 18 / no birthday) or OPEN (account management, signup, safety, own reads, public);
 *   2. wave101 copies every GATED function from its latest source migration WORD FOR WORD,
 *      plus exactly one guard line as its first statement, and touches no OPEN function;
 *   3. is_adult(uuid) is internal (revoked from client roles); a missing born_on is NOT adult;
 *   4. the restrictive RLS policies and the two row guards (me, connections) are in place;
 *   5. the migration deletes, truncates and updates no row outside the copied bodies, and
 *      leaves account deletion (delete-account / count_user_rows / cascades) alone.
 * The table in docs/under18-server.md is the human view of the lists below.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const MIG_DIR = resolve(root, 'supabase/migrations');
export const MIGRATION = 'wave101_under18_server_gate.sql';
/** Prepared, never applied (CLAUDE.md): its revokes are not live, so the gate must not rely on them. */
const NOT_LIVE = new Set([
  'wave80_trait_lock.sql',
  // Applied AFTER wave101 (docs/under18-server.md): it restates set_going on top of wave101's copy,
  // so it is not part of the state wave101 is copied from. Pinned by scripts/age-check.ts.
  'wave102_nights_18_gate.sql',
  // Applied AFTER wave102 (needs emci's ok; drops crisis_flags). Restates the library functions,
  // home_bootstrap and the reset/count RPCs on top of wave101's copies, minus the crisis plumbing.
  'wave103_drop_crisis_plumbing.sql',
  // Applied AFTER wave103 (master plan Step 7, Circle safety). Its new app functions each start with
  // require_adult(); that is pinned by scripts/circle-safety-check.ts, not replayed here.
  'wave104_circle_safety.sql',
  'wave104b_circle_safety_fixes.sql',
  // Applied AFTER wave104b (master plan Step 7b, Circle compare). Additive; its app functions start with
  // require_adult(), pinned by scripts/circle-compare-check.ts.
  'wave105_circle_compare.sql',
  // Applied AFTER wave105 (master plan Step 10, deletion proof). Restates count_user_rows (service_role only)
  // and makes dev_access_grants.granted_by ON DELETE SET NULL; no app function. Pinned by check:delete-proof.
  'wave106_delete_proof.sql',
  // Applied AFTER wave107 (master plan Step 14, Circle chat). Additive; its friend-facing functions
  // (chat_set_key, chat_peer_key, chat_send, chat_thread, chat_report) start with require_adult(), pinned
  // by scripts/circle-chat-check.ts. chat_my_status / chat_ack_warning only touch the caller's own row;
  // admin_chat_restrict is root only.
  'wave108_circle_chat.sql',
]);

/** Apply order of the migrations that existed when wave101 was written (git history order). */
export const ORDER = [
  'stage7_chat_report.sql', 'stage8_apple_delete_account.sql', 'stage8_invite_pause_qualify_columns.sql',
  'stage8_invite_referral.sql', 'stage8_invite_refresh_token_cast.sql', 'stage8_invite_revoke_execute.sql',
  'stage8_ai_quota.sql', 'stage2_me_born_on.sql', 'wave2_around_city.sql', 'stage9_intake_core.sql',
  'wave2_going_colors.sql', 'check_window_recap.sql', 'sage_nudge.sql', 'stage11_trait_backbone.sql',
  'wave15_extra_trait_axes.sql', 'wave15_sage_knows.sql', 'peer_checks.sql', 'founder_access_requests.sql',
  'voice_preset_jargon.sql', 'explore.sql', 'dev_access.sql', 'wave16_account_pixel_recipe.sql',
  'wave17_infinite_questions.sql', 'wave18_question_skip.sql', 'dev_trace_steps.sql', 'auth_password_optional.sql',
  'record_check_no_card.sql', 'born_on_editable.sql', 'wave19_trait_history_tokens.sql',
  'wave20_trait_tracks_titles.sql', 'wave21_playfulness_categories.sql', 'wave22_levity_story.sql',
  'wave23_optional_intake.sql', 'ai_provider_layer.sql', 'wave24_recovery_style_resave_coalesce.sql',
  'wave25_legends_archetypes.sql', 'wave26_legends_archetypes_content.sql',
  'wave27_drop_stale_question_items_axis_check.sql', 'wave28_legends_approved_seed.sql',
  'wave29_legends_fact_check.sql', 'wave30_question_deferral.sql', 'wave31_dev_test_user.sql',
  'wave32_legend_variants.sql', 'wave33_legend_variant_v2.sql', 'wave34_root_is_column.sql',
  'wave35_home_bootstrap.sql', 'wave36_login_email_lockdown.sql', 'wave37_nav_layout.sql',
  'wave38_trait_history_self_scenario.sql', 'wave39_drop_recovery_style.sql',
  'wave40_structure_resilience_categories.sql', 'wave41_qa_override_invite_code.sql',
  'wave42_qa_override_invite_code_storage.sql', 'wave43_celebrated_milestone_ids.sql',
  'wave44_category_question_batches.sql', 'wave45_trait_redesign_tokens.sql', 'wave46_trait_rolls.sql',
  'wave47_reveal_requires_ready.sql', 'wave48_roll_generation_quota.sql', 'wave49_question_bank_pool.sql',
  'wave50_ongoing_round_prep.sql', 'wave51_ato_tokens.sql', 'wave52_ato_tokens_fixes.sql',
  'wave53_reroll_rpcs.sql', 'wave54_reroll_rpcs_fixes.sql', 'wave55_legend_candidates.sql',
  'wave56_legend_candidates_fixes.sql', 'wave57_drop_legend_candidates.sql', 'wave58_legend_generations.sql',
  'wave59_category_statements.sql', 'wave60_drop_category_batches.sql', 'wave61_drop_category_question_items.sql',
  'wave62_roll_legend_generation_comments.sql', 'wave63_fix_insert_bank_pool_items_ambiguous_prompt.sql',
  'wave64_handle_taken_rpc.sql', 'wave65_dev_collision_account.sql', 'wave66_dev_test_user_reset.sql',
  'wave67_count_user_rows_refresh.sql', 'wave68_bank_pool_dedup_and_depth.sql', 'wave69_daily_insights.sql',
  'wave70_bank_pool_option_value_fix.sql', 'wave71_drop_sage_messages.sql', 'wave72_count_user_rows_dev_tables.sql',
  'wave73_play_dev_logs.sql', 'wave74_bank_pool_owner_and_ai_refund.sql', 'wave75_reset_my_test_data.sql',
  'wave76_start_over_my_test_data.sql', 'wave77_daily_lines.sql', 'wave78_staged_intake.sql',
  'wave79_trait_checkpoint.sql', 'wave80_trait_lock.sql', 'wave81_round_payout_cap.sql', 'wave82_daily_pick.sql',
  'wave83_daily_pick_split_by_day.sql', 'wave84_question_voice.sql', 'wave85_fixed_question_bank.sql',
  'wave85b_question_bank_seed.sql', 'wave86_change_answers_history.sql', 'wave87_insight_title_120.sql',
  'wave88_reset_my_account.sql', 'wave89_legend_museum.sql', 'wave90_category_deep_dive.sql',
  'wave91_category_deep_dive_bundle.sql', 'wave92_ai_tokens.sql', 'wave93_ai_library.sql',
  'wave94_ai_library_fill.sql', 'wave95_ai_library_key_regex.sql', 'wave96_play_saves.sql',
  'wave97_circle_visits.sql', 'wave98_server_hardening.sql', 'wave99_question_wording.sql',
  'wave99b_min_age_18.sql', 'wave99c_daily_pick_p65.sql', 'wave99d_library_card_vocab.sql',
  'wave100_question_retire.sql', 'wave100b_question_retire_rows.sql', MIGRATION,
];

// ---------------------------------------------------------------------------------------------
// Classification. Signature = name(arg types), the form the parser below prints.
// ---------------------------------------------------------------------------------------------

export type Group = 'ai_tokens' | 'circle_chat' | 'traits' | 'daily' | 'play' | 'dev_admin';
export const GATED: Record<string, Group> = {
  // AI library, AI claims, token earn / spend / refund
  'claim_library_write(text,text,text,text)': 'ai_tokens',
  'library_serve(text,text,text)': 'ai_tokens',
  'library_want(text,text[],text)': 'ai_tokens',
  'library_team_size(text)': 'ai_tokens',
  'claim_ai_call(text)': 'ai_tokens',
  'claim_category_deep_dive()': 'ai_tokens',
  'claim_story_generate()': 'ai_tokens',
  'claim_legend_figure_story()': 'ai_tokens',
  'claim_legend_story_generation()': 'ai_tokens',
  'claim_title_generate()': 'ai_tokens',
  'claim_questions_batch()': 'ai_tokens',
  'claim_roll_generation()': 'ai_tokens',
  'claim_roll()': 'ai_tokens',
  'refund_ai_tokens(text)': 'ai_tokens',
  'claim_daily_checkin()': 'ai_tokens',
  'claim_full_profile_complete()': 'ai_tokens',
  'claim_intake_complete()': 'ai_tokens',
  'claim_ongoing_round_complete(uuid)': 'ai_tokens',
  'earn_tokens(text)': 'ai_tokens',
  'spend_tokens(text)': 'ai_tokens',
  'spend_ato_tokens_category_reroll(text)': 'ai_tokens',
  'spend_ato_tokens_legend_reroll()': 'ai_tokens',
  'spend_ato_tokens_question_reroll(uuid)': 'ai_tokens',
  'save_category_deep_dive(text,text,jsonb,date)': 'ai_tokens',
  'save_legend_figure_story(text,integer,text,text,jsonb,date)': 'ai_tokens',
  'insert_legend_generation(text,text)': 'ai_tokens',
  'legend_angle_counts(text)': 'ai_tokens',
  // Circle, peer reads, chat, invites, Around
  'circle_visit_allowed(uuid)': 'circle_chat',
  'circle_visit_friends()': 'circle_chat',
  'circle_visit_room(uuid)': 'circle_chat',
  'circle_send_gift(uuid)': 'circle_chat',
  'circle_gift_inbox()': 'circle_chat',
  'circle_open_gift(uuid)': 'circle_chat',
  'set_circle_visit_share(uuid,boolean)': 'circle_chat',
  'peer_profile(uuid)': 'circle_chat',
  'peer_checks(uuid)': 'circle_chat',
  'peer_category_pack(uuid)': 'circle_chat',
  'categories_share_allowed(uuid)': 'circle_chat',
  'category_share_status(uuid)': 'circle_chat',
  'legend_circle_friends(text)': 'circle_chat',
  'get_or_create_thread(uuid)': 'circle_chat',
  'delete_message_for_me(uuid)': 'circle_chat',
  'my_referrals()': 'circle_chat',
  'set_going(text,boolean,text)': 'circle_chat',
  'night_snapshot(text)': 'circle_chat',
  // Traits, answers, question sets, rolls
  'answer_intake_question(text,integer)': 'traits',
  'answer_round_item(uuid,integer)': 'traits',
  'answer_bank_item(uuid,integer)': 'traits',
  'answer_question_item(uuid,integer)': 'traits',
  'set_trait_direct(text,double precision,text)': 'traits',
  'record_game_pick(text,double precision)': 'traits',
  'confirm_trait_sources(text[])': 'traits',
  'stamp_axis_depth(text)': 'traits',
  'set_trait_flag(text,boolean)': 'traits',
  'serve_bank_set()': 'traits',
  'change_bank_answer(uuid,text,integer)': 'traits',
  'undo_change_session(uuid)': 'traits',
  'start_fresh(boolean)': 'traits',
  'skip_question_item(uuid)': 'traits',
  'skip_rest_question_pack(uuid)': 'traits',
  'reroll_question_item(uuid)': 'traits',
  'fetch_bank_candidates(text,integer)': 'traits',
  'bank_pool_depth()': 'traits',
  'insert_question_pack(date,jsonb)': 'traits',
  'store_roll(uuid,jsonb,jsonb)': 'traits',
  'reveal_roll_item(uuid)': 'traits',
  // Daily surfaces
  'answer_daily_pick(date,text,integer)': 'daily',
  'daily_pick_split(text,date)': 'daily',
  'record_check(integer,date,text,text,text,text,text,boolean)': 'daily',
  'record_daily_line(date,text)': 'daily',
  'react_daily_line(date,text)': 'daily',
  'insert_daily_line_pool_items(jsonb)': 'daily',
  'clear_my_daily_lines()': 'daily',
  'insert_daily_insight(integer,date,text,text,text,text,text)': 'daily',
  'insert_explore_pack(date,text,text,jsonb)': 'daily',
  'record_explore_reaction(uuid,boolean)': 'daily',
  'insert_category_statements(jsonb)': 'daily',
  'log_jargon_guard(text)': 'daily',
  'log_phrase_guard(text)': 'daily',
  // Divecore
  'save_play_doc(jsonb,integer,timestamptz)': 'play',
  'bump_play_counter(text)': 'play',
  // Dev tools and root admin
  'apply_dev_trait_preset(jsonb,jsonb,jsonb,jsonb,jsonb)': 'dev_admin',
  'dev_fill_bank()': 'dev_admin',
  'dev_reset_ai_limits(text)': 'dev_admin',
  'reset_dev_test_user()': 'dev_admin',
  'reset_my_test_data()': 'dev_admin',
  'start_over_my_test_data()': 'dev_admin',
  'has_dev_trace_capability()': 'dev_admin',
  'my_dev_access()': 'dev_admin',
  'my_dev_trace_session()': 'dev_admin',
  'start_dev_trace()': 'dev_admin',
  'stop_dev_trace()': 'dev_admin',
  'record_dev_trace(text,jsonb,jsonb,text,text,text,jsonb)': 'dev_admin',
  'list_my_dev_trace_events()': 'dev_admin',
  'list_dev_access_grants(text)': 'dev_admin',
  'set_dev_access_grants(text,text[])': 'dev_admin',
  'root_search_me(text)': 'dev_admin',
  'root_pause_profile(text)': 'dev_admin',
  'root_unpause_profile(text)': 'dev_admin',
  'root_delete_profile(text,text)': 'dev_admin',
  'approve_access_request(uuid)': 'dev_admin',
  'deny_access_request(uuid)': 'dev_admin',
  'list_pending_access_requests()': 'dev_admin',
  'library_admin_list(text,integer,boolean)': 'dev_admin',
  'library_approve(uuid)': 'dev_admin',
  'library_retire(uuid,text)': 'dev_admin',
  'library_retire_old_versions(text,text)': 'dev_admin',
  'library_stats()': 'dev_admin',
  'library_bucket_counts(text,text)': 'dev_admin',
  'library_coverage()': 'dev_admin',
};

export type OpenClass = 'account' | 'own_read' | 'safety' | 'helper' | 'public';
export const OPEN: Record<string, OpenClass> = {
  // Account management + sign-up (no me row yet = not adult, so these must stay open)
  'complete_signup(text,text,text,text,text,text,text,text,date,text,text,text,text)': 'account',
  'handle_taken(text)': 'account',
  'auth_has_password()': 'account',
  // Root-only on the server (require_root): no minor can call it; resets the caller's own data, keeps the account
  'reset_my_account()': 'account',
  // Reads of the caller's own rows only (same as the table SELECT policies, left open)
  'home_bootstrap()': 'own_read',
  'bank_answered()': 'own_read',
  'ai_provider_counts()': 'own_read',
  // Safety: reporting stays possible
  'library_report(uuid)': 'safety',
  'is_message_party(uuid)': 'safety',
  // Helpers about the caller only, or pure functions
  'is_root()': 'helper',
  'require_root()': 'helper',
  'age_years(date)': 'helper',
  'is_at_least_age(date,integer)': 'helper',
  'color_hue_from_show_up(text)': 'helper',
  'show_requires_18(text)': 'helper',
  // Callable by anon (pre-sign-in): gating a signed-in minor would change nothing
  'assert_invite_usable(text)': 'public',
  'public_profile(text)': 'public',
  'daily_pick_position(date)': 'public',
  'recipe_from_account_id(uuid)': 'public',
};

/** Helpers wave101 adds. is_adult(uuid) is internal; the zero-argument two are about the caller only. */
export const NEW_HELPERS = ['is_adult(uuid)', 'is_adult()', 'require_adult()', 'me_adult_guard()', 'connections_adult_guard()'];

/** Direct client write (or peer read) paths that get a RESTRICTIVE policy. */
export const RESTRICTIVE: { table: string; name: string; cmd: 'insert' | 'update' | 'select' }[] = [
  { table: 'trait_tracks', name: 'trait_tracks_adult_insert', cmd: 'insert' },
  { table: 'trait_tracks', name: 'trait_tracks_adult_update', cmd: 'update' },
  { table: 'trait_history', name: 'trait_history_adult_insert', cmd: 'insert' },
  { table: 'category_share', name: 'category_share_adult_insert', cmd: 'insert' },
  { table: 'category_share', name: 'category_share_adult_update', cmd: 'update' },
  { table: 'sage_title_flags', name: 'sage_title_flags_adult_insert', cmd: 'insert' },
  { table: 'ai_provider_log', name: 'ai_provider_log_adult_insert', cmd: 'insert' },
  { table: 'play_dev_logs', name: 'play_dev_logs_adult_insert', cmd: 'insert' },
  { table: 'threads', name: 'threads_adult_insert', cmd: 'insert' },
  { table: 'messages', name: 'messages_adult_insert', cmd: 'insert' },
  { table: 'messages', name: 'messages_adult_select', cmd: 'select' },
];

/** Columns an under-18 / no-birthday account may still change on its own me row. */
export const ME_ALLOWED_COLUMNS = ['born_on', 'timezone', 'ai_consent', 'updated_at'];

export const GUARD_PLPGSQL = '  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)';
export const GUARD_SQL = '  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)';

// ---------------------------------------------------------------------------------------------
// Parser (shared with the generator)
// ---------------------------------------------------------------------------------------------

const TYPEWORDS = new Set(['int', 'integer', 'int4', 'int8', 'bigint', 'smallint', 'text', 'uuid', 'boolean', 'bool', 'date', 'jsonb', 'json', 'numeric', 'real', 'double', 'timestamptz', 'timestamp', 'character', 'varchar', 'bytea', 'interval', 'time', 'float8', 'float4', 'record', 'anyelement', 'inet']);
const ALIAS: Record<string, string> = { int: 'integer', int4: 'integer', int8: 'bigint', bool: 'boolean', float8: 'double precision', 'character varying': 'varchar', 'timestamp with time zone': 'timestamptz' };

export const lf = (s: string) => s.replace(/\r\n?/g, '\n');

export function normArgs(s: string): string {
  if (!s.trim()) return '';
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  const out: string[] = [];
  for (let p of parts) {
    p = p.replace(/--.*$/gm, '').trim().toLowerCase();
    p = p.replace(/\s+default\s+[\s\S]*$/, '').replace(/\s*=\s*[\s\S]*$/, '');
    let toks = p.split(/\s+/);
    if (toks[0] === 'out') continue;
    if (['in', 'inout', 'variadic'].includes(toks[0])) toks = toks.slice(1);
    if (toks.length > 1 && !TYPEWORDS.has(toks[0].replace(/\[\]$/, '').replace(/^public\./, ''))) toks = toks.slice(1);
    let t = toks.join(' ').replace(/^public\./, '').replace(/::.*$/, '');
    t = ALIAS[t] ?? t;
    out.push(t);
  }
  return out.join(',');
}

export type FnDef = { sig: string; file: string; text: string; body: string; header: string; language: string; definer: boolean; start: number; end: number };

function matchParen(s: string, i: number): number {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') d++;
    else if (s[j] === ')') { d--; if (d === 0) return j; }
  }
  return -1;
}
const blank = (s: string, re: RegExp) => s.replace(re, (m) => ' '.repeat(m.length));

/** Every function definition in a file, in order, with its exact text (LF line endings). */
export function parseFunctions(file: string, srcRaw: string): FnDef[] {
  const src = lf(srcRaw);
  const out: FnDef[] = [];
  const scan = blank(src, /--[^\n]*/g); // find statements outside comments; offsets stay the same
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:"?public"?\.)?"?([a-z_0-9]+)"?\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scan))) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    const dm = src.slice(close).match(/\$([a-z_]*)\$/i);
    if (!dm) continue;
    const tag = dm[0];
    const bStart = close + (dm.index ?? 0) + tag.length;
    const bEnd = src.indexOf(tag, bStart);
    const semi = src.indexOf(';', bEnd + tag.length);
    const header = src.slice(m.index, bStart - tag.length) + src.slice(bEnd + tag.length, semi);
    const lang = /language\s+(plpgsql|sql)/i.exec(header)?.[1].toLowerCase() ?? '?';
    out.push({
      sig: `${m[1].toLowerCase()}(${normArgs(src.slice(open + 1, close))})`,
      file,
      text: src.slice(m.index, semi + 1),
      body: src.slice(bStart, bEnd),
      header,
      language: lang,
      definer: /security\s+definer/i.test(header),
      start: m.index,
      end: semi + 1,
    });
    re.lastIndex = semi + 1;
  }
  return out;
}

/** The file text with function bodies and comments blanked: the statements around them. */
export function outsideBodies(srcRaw: string, defs: FnDef[]): string {
  let s = lf(srcRaw);
  for (const d of [...defs].reverse()) s = s.slice(0, d.start) + ' '.repeat(d.end - d.start) + s.slice(d.end);
  return blank(s, /--[^\n]*/g);
}

export function migrationFiles(): string[] {
  const all = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql'));
  const unknown = all.filter((f) => !ORDER.includes(f));
  for (const f of unknown) {
    assert.match(f, /^wave\d+[a-z]?_/, `${f}: a new migration must be named wave<N>_… so its order is known`);
  }
  const later = unknown.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return [...ORDER.filter((f) => all.includes(f)), ...later];
}

export type State = { latest: Map<string, FnDef>; callable: Map<string, { anon: boolean; auth: boolean }> };

/** Replays the migrations in order: latest definition and client EXECUTE of each function. */
export function replay(files: string[]): State {
  const latest = new Map<string, FnDef>();
  const grants = new Map<string, { anon: boolean; auth: boolean; pub: boolean }>();
  for (const f of files) {
    const raw = readFileSync(resolve(MIG_DIR, f), 'utf8');
    const defs = parseFunctions(f, raw);
    const outside = outsideBodies(raw, defs);
    const ev: [number, () => void][] = [];
    for (const d of defs) ev.push([d.start, () => {
      latest.set(d.sig, d);
      if (!grants.has(d.sig)) grants.set(d.sig, { anon: true, auth: true, pub: true }); // Supabase default privileges
    }]);
    const gre = /(grant|revoke)\s+([a-z ,]+?)\s+on\s+function\s+(?:public\.)?([a-z_0-9]+)\s*\(([^)]*)\)\s+(to|from)\s+([a-z_ ,]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = gre.exec(outside))) {
      const mm = m;
      ev.push([m.index, () => {
        const sig = `${mm[3].toLowerCase()}(${normArgs(mm[4])})`;
        const g = grants.get(sig) ?? { anon: true, auth: true, pub: true };
        const on = mm[1].toLowerCase() === 'grant';
        for (const r of mm[6].toLowerCase().split(/[\s,]+/)) {
          if (r === 'anon') g.anon = on;
          if (r === 'authenticated') g.auth = on;
          if (r === 'public') g.pub = on;
        }
        grants.set(sig, g);
      }]);
    }
    const dre = /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s*(?:\(([^)]*)\))?/gi;
    while ((m = dre.exec(outside))) {
      const mm = m;
      ev.push([m.index, () => {
        const name = mm[1].toLowerCase();
        const sigs = mm[2] === undefined ? [...latest.keys()].filter((k) => k.startsWith(`${name}(`)) : [`${name}(${normArgs(mm[2])})`];
        for (const s of sigs) { latest.delete(s); grants.delete(s); }
      }]);
    }
    ev.sort((a, b) => a[0] - b[0]).forEach(([, run]) => run());
  }
  const callable = new Map<string, { anon: boolean; auth: boolean }>();
  for (const [sig, g] of grants) {
    if (!latest.has(sig)) continue;
    const anon = g.pub || g.anon;
    const auth = g.pub || g.auth;
    if (anon || auth) callable.set(sig, { anon, auth });
  }
  return { latest, callable };
}

/** Insert the guard as the first statement of a copied function. */
export function addGuard(def: FnDef): string {
  const text = def.text.replace(/^create\s+function/i, 'create or replace function');
  const bodyAt = text.indexOf(def.body);
  assert.ok(bodyAt > 0, `${def.sig}: body not found in its own text`);
  let body: string;
  if (def.language === 'plpgsql') {
    const scan = blank(def.body, /--[^\n]*/g);
    const b = /\bbegin\b/i.exec(scan);
    assert.ok(b, `${def.sig}: no begin`);
    const at = b.index + b[0].length;
    body = `${def.body.slice(0, at)}\n${GUARD_PLPGSQL}${def.body.slice(at)}`;
  } else if (def.language === 'sql') {
    body = `\n${GUARD_SQL}${def.body}`;
  } else {
    throw new Error(`${def.sig}: unknown language`);
  }
  return text.slice(0, bodyAt) + body + text.slice(bodyAt + def.body.length);
}

/** The grants every gated copy restates (unchanged: each is authenticated-only today). */
export function grantLines(sig: string): string {
  return `revoke all on function public.${sig} from public, anon;\ngrant execute on function public.${sig} to authenticated;`;
}

/** Body of a copied function with the guard line taken out again. */
export function stripGuard(text: string): string {
  return text
    .replace(`\n${GUARD_PLPGSQL}`, '')
    .replace(`\n${GUARD_SQL}`, '')
    .replace(/^create\s+or\s+replace\s+function/i, 'create function');
}

export const md5 = (s: string) => createHash('md5').update(lf(s)).digest('hex');

// ---------------------------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------------------------

function main() {
  let passed = 0;
  const ok = (label: string) => {
    passed += 1;
    console.log(`  ✓ ${label}`);
  };

  const files = migrationFiles();
  assert.ok(files.includes(MIGRATION), `${MIGRATION} is missing`);
  const before = files.filter((f) => f !== MIGRATION && !NOT_LIVE.has(f));
  const live = replay(before);

  // 1. Every client-callable function is classified, once.
  for (const sig of Object.keys(GATED)) assert.ok(!(sig in OPEN), `${sig} is both GATED and OPEN`);
  const unclassified = [...live.callable.keys()].filter((s) => !(s in GATED) && !(s in OPEN));
  assert.deepEqual(unclassified, [], `client-callable functions with no under-18 decision: ${unclassified.join(', ')}`);
  for (const sig of [...Object.keys(GATED), ...Object.keys(OPEN)]) {
    assert.ok(live.callable.has(sig), `${sig} is listed but is not client-callable (dropped or revoked?): update the lists`);
  }
  for (const [sig, g] of live.callable) {
    if (sig in GATED) assert.ok(!g.anon, `${sig} is GATED but anon can call it: gating a signed-in minor would not help`);
  }
  ok(`all ${live.callable.size} client-callable functions are classified (${Object.keys(GATED).length} gated, ${Object.keys(OPEN).length} open)`);

  // 2. The migration copies every GATED function verbatim + one guard line, and nothing else.
  const raw = readFileSync(resolve(MIG_DIR, MIGRATION), 'utf8');
  const sql = lf(raw);
  const defs = parseFunctions(MIGRATION, raw);
  const bySig = new Map<string, FnDef>();
  for (const d of defs) {
    assert.ok(!bySig.has(d.sig), `${d.sig} is defined twice in ${MIGRATION}`);
    bySig.set(d.sig, d);
  }
  for (const sig of bySig.keys()) {
    assert.ok(sig in GATED || NEW_HELPERS.includes(sig), `${MIGRATION} defines ${sig}, which is neither GATED nor a wave101 helper`);
    assert.ok(!(sig in OPEN), `${sig} is OPEN (account management / public) and must not be touched`);
  }
  for (const sig of Object.keys(GATED)) {
    const copy = bySig.get(sig);
    assert.ok(copy, `${sig} has no guarded copy in ${MIGRATION}`);
    const src = live.latest.get(sig)!;
    const cite = new RegExp(`-- ${sig.replace(/[()[\].*+?^$|\\]/g, '\\$&')} · source: ([a-z0-9_]+\\.sql)`);
    const cited = cite.exec(sql)?.[1];
    assert.equal(cited, src.file, `${sig}: copy must cite its latest source ${src.file} (cited ${cited ?? 'nothing'})`);
    const guard = copy.language === 'sql' ? GUARD_SQL : GUARD_PLPGSQL;
    assert.equal(copy.language, src.language, `${sig}: language changed`);
    assert.equal(copy.definer, src.definer, `${sig}: security mode changed`);
    assert.equal(copy.text.split(guard).length - 1, 1, `${sig}: exactly one guard line`);
    if (copy.language === 'sql') {
      assert.ok(copy.body.startsWith(`\n${GUARD_SQL}`), `${sig}: guard must be the first statement`);
    } else {
      const head = blank(copy.body, /--[^\n]*/g);
      const b = /\bbegin\b/i.exec(head)!;
      assert.ok(copy.body.slice(b.index + b[0].length).startsWith(`\n${GUARD_PLPGSQL}`), `${sig}: guard must follow the first begin`);
    }
    assert.ok(sql.slice(copy.end).startsWith(`\n${grantLines(sig)}\n`), `${sig}: restates its grants (authenticated only) right after the copy`);
    const g = live.callable.get(sig)!;
    assert.ok(g.auth && !g.anon, `${sig}: today authenticated-only, so the restated grants change nothing`);
    assert.equal(stripGuard(copy.text), src.text.replace(/^create\s+or\s+replace\s+function/i, 'create function'), `${sig}: copy differs from ${src.file} beyond the guard line`);
  }
  ok(`${Object.keys(GATED).length} gated functions are word-for-word copies of their latest source + one guard line`);

  // 3. Helpers: is_adult(uuid) internal; null born_on is not adult; the caller-only pair.
  const isAdultUid = bySig.get('is_adult(uuid)');
  assert.ok(isAdultUid, 'is_adult(uuid) defined');
  assert.match(isAdultUid.body, /m\.born_on is not null\s+and public\.is_at_least_age\(m\.born_on, 18\)/);
  assert.match(isAdultUid.body, /coalesce\(\(/, 'no me row = not adult');
  assert.doesNotMatch(isAdultUid.body, /born_on is null\s+or/i, 'a missing birthday must never count as adult');
  assert.ok(isAdultUid.definer && /\bstable\b/i.test(isAdultUid.header) && /set search_path = public/.test(isAdultUid.header));
  assert.match(sql, /revoke all on function public\.is_adult\(uuid\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /grant [a-z ,]+ on function public\.is_adult\(uuid\)/i, 'nobody can probe another account');
  const isAdult = bySig.get('is_adult()');
  assert.ok(isAdult && isAdult.definer, 'is_adult() defined, definer');
  assert.match(isAdult.body, /public\.is_adult\(auth\.uid\(\)\)/, 'is_adult() is about the caller only');
  const req = bySig.get('require_adult()');
  assert.ok(req && req.definer);
  assert.match(req.body, /if not public\.is_adult\(auth\.uid\(\)\) then\s+raise exception 'age_under_18' using errcode = 'P0005';/);
  for (const f of ['is_adult()', 'require_adult()']) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon;`), `${f} not anon`);
    assert.ok(sql.includes(`grant execute on function public.${f} to authenticated;`), `${f} granted to authenticated (RLS needs it)`);
  }
  ok('is_adult(uuid) is internal; null born_on / no me row = not adult; require_adult raises P0005 age_under_18');

  // 4. Restrictive policies + the two row guards.
  for (const p of RESTRICTIVE) {
    const re = new RegExp(`create policy ${p.name} on public\\.${p.table}\\s+as restrictive for ${p.cmd} to authenticated\\s+${p.cmd === 'insert' ? 'with check' : 'using'} \\(\\(select public\\.is_adult\\(\\)\\)\\)`);
    assert.match(sql, re, `restrictive ${p.cmd} policy on ${p.table}`);
  }
  assert.equal((sql.match(/as restrictive/g) ?? []).length, RESTRICTIVE.length, 'no unlisted restrictive policy');
  assert.doesNotMatch(sql, /as permissive|create policy [a-z_]+ on [a-z_.]+\s+for /i, 'no permissive policy added');
  const meGuard = bySig.get('me_adult_guard()')!;
  assert.ok(meGuard, 'me_adult_guard defined');
  assert.match(meGuard.body, /coalesce\(auth\.jwt\(\) ->> 'role', ''\) <> 'authenticated'/, 'service role / SQL editor untouched');
  assert.match(meGuard.body, /new\.id is distinct from auth\.uid\(\)/, 'only a person editing their own row');
  assert.match(meGuard.body, /old\.born_on is not null and public\.is_at_least_age\(old\.born_on, 18\)/);
  const allowed = /array\[([^\]]+)\]/.exec(meGuard.body)?.[1].replace(/['\s]/g, '').split(',').sort();
  assert.deepEqual(allowed, [...ME_ALLOWED_COLUMNS].sort(), 'me columns an under-18 account may change');
  assert.match(sql, /create trigger me_adult_guard\s+before update on public\.me\s+for each row execute function public\.me_adult_guard\(\);/);
  const cGuard = bySig.get('connections_adult_guard()')!;
  assert.match(cGuard.body, /not public\.is_adult\(new\.user_id\) or not public\.is_adult\(new\.peer_id\)/);
  assert.match(sql, /create trigger connections_adult_guard\s+before insert on public\.connections/);
  for (const f of ['me_adult_guard()', 'connections_adult_guard()']) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon, authenticated;`), `${f} is trigger-only`);
  }
  ok(`${RESTRICTIVE.length} restrictive policies; me row frozen except ${ME_ALLOWED_COLUMNS.join('/')}; new Circle links need two adults`);

  // 5. Non-destructive: no row change outside copied bodies; deletion untouched.
  const outside = outsideBodies(raw, defs);
  assert.doesNotMatch(outside, /\b(delete\s+from|truncate|update\s+public\.|update\s+[a-z_]+\s+set|insert\s+into|drop\s+table|alter\s+table|drop\s+function)\b/i, 'no row or schema change outside function bodies');
  for (const sig of NEW_HELPERS) {
    assert.doesNotMatch(bySig.get(sig)!.body, /\b(delete|update|insert|truncate)\b/i, `${sig} writes nothing`);
  }
  // (Copied bodies may mention them, e.g. reset_dev_test_user; the new code and statements may not.)
  const newCode = outside + NEW_HELPERS.map((s) => bySig.get(s)!.body).join('\n');
  assert.ok(!/count_user_rows|delete_branch|account_deletions|apple_credentials/.test(newCode), 'account deletion path untouched');
  assert.ok(!/\bbefore\s+delete\b|\bfor\s+delete\b/i.test(outside), 'no trigger or policy on deletes');
  assert.ok(!/db_pre_request|alter\s+role/i.test(outside), 'Option B (pre-request hook) is not built');
  assert.match(sql, /^begin;/m);
  assert.match(sql, /^commit;/m);
  ok('no row deleted, updated or inserted; no delete trigger/policy; account deletion untouched; one transaction');

  // 6. Edge Functions: the paid path still claims (gated) before any model call.
  const lib = lf(readFileSync(resolve(root, 'supabase/functions/ai-library/index.ts'), 'utf8'));
  const claimAt = lib.indexOf("caller.rpc('claim_library_write'");
  assert.ok(claimAt > 0 && claimAt < lib.indexOf('await complete('), 'ai-library claims (as the caller) before the model call');
  assert.ok(existsSync(resolve(root, 'docs/under18-server.md')), 'docs/under18-server.md');
  ok('ai-library reaches the model only after claim_library_write, which is gated');

  console.log(`\n${passed} under18-server checks passed`);
}

/**
 * `npx tsx scripts/under18-server-check.ts --copy '<sig>'` prints a fresh guarded copy of one
 * function from its latest source (to rebase wave101 after a newer migration restates it).
 * Prints only; writes nothing.
 */
function printCopy(sig: string) {
  const files = migrationFiles().filter((f) => f !== MIGRATION && !NOT_LIVE.has(f));
  const def = replay(files).latest.get(sig);
  assert.ok(def, `no definition of ${sig}`);
  assert.ok(sig in GATED, `${sig} is not GATED`);
  console.log(`-- ${sig} · source: ${def.file}\n${addGuard(def)}\n${grantLines(sig)}`);
}

if (/under18-server-check\.ts$/.test(process.argv[1] ?? '')) {
  const at = process.argv.indexOf('--copy');
  if (at > 0) printCopy(process.argv[at + 1] ?? '');
  else main();
}
