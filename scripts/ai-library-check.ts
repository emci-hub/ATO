/**
 * Shared AI library (wave93, emci 2026-10-09) — offline rules.
 * Run: npm run check:ai-library
 *
 * Pins:
 * - the server bundle is exactly today's app code (prompts + checks), so the
 *   server writes and checks cards with the same rules as the app;
 * - the buckets: 207 deep-dive buckets, every key parses back, tampered or
 *   unknown keys are refused, nothing personal (no user id, no told-vs-played
 *   line, no per-person joke seed) reaches a shared prompt;
 * - one call writes two deep-dive angles; good answers pass, bad ones don't;
 * - the safety rules in wave93: no direct table access, only the Edge
 *   Function (service role) adds cards, cooling period, reports retire, root
 *   tools are root only, crisis blocks serving and writing, the claim comes
 *   first and the shared AI cap rolls a charge back, "N others" only from 5 up;
 * - the Edge Function never takes card text or a prompt from the phone;
 * - the phone sends only { kind, bucket, mode };
 * - the three surfaces are library first, show the footer (shared line +
 *   Report), and the consent copy says cards are shared.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { allDiveBuckets, diveBucketKey, parseDiveBucket, DEEP_DIVE_LIBRARY } from '../src/lib/ai-library/deep-dive';
import { LEGEND_LIBRARY, legendBucketKey, parseLegendBucket } from '../src/lib/ai-library/legend';
import { checkLibraryAnswer, planLibraryCall } from '../src/lib/ai-library/server';
import { STORY_LIBRARY, parseStoryBucket } from '../src/lib/ai-library/story';
import { TEAM_COPY_REVIEWED, TEAM_SIDES, teamForBucket } from '../src/lib/ai-library/teams';
import { AXIS_POLE_NAME } from '../src/lib/axis-poles';
import { BUCKET_KEY_RE, LIBRARY_VERSION, sharedCardLine } from '../src/lib/ai-library/types';
import { CATEGORY_DEFS } from '../src/lib/categories';
import { legendPairs, legendDiffer } from '../src/lib/legend-figures/story';
import { LEGEND_ROSTER } from '../src/lib/legend-figures/roster';
import { TRAIT_AXES } from '../src/lib/traits';
import { buildAiLibraryBundle, BUNDLE_PATH } from './gen-ai-library-bundle';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
}

async function main() {
  // --- the server runs the app's code ----------------------------------------------
  const built = await buildAiLibraryBundle();
  const committed = readFileSync(BUNDLE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, built, 'supabase/functions/_shared/ai-library.bundle.js is out of date: run npm run gen:ai-library and redeploy ai-library');
  assert.doesNotMatch(built, /^import /m, 'the bundle imports nothing (no phone-only code)');
  assert.doesNotMatch(built, /react-native|AsyncStorage|supabase-js|EXPO_PUBLIC/, 'no app runtime or keys in the server bundle');
  ok('the server bundle is today’s app code, self-contained, no keys');

  // --- deep-dive buckets ----------------------------------------------------------------
  const all = CATEGORY_DEFS.flatMap((def) => allDiveBuckets(def.id));
  assert.equal(all.length, 207, '207 deep-dive buckets (3 states per trait)');
  assert.equal(new Set(all).size, all.length);
  for (const key of all) {
    assert.ok(BUCKET_KEY_RE.test(key), key);
    assert.ok(parseDiveBucket(key), `parses: ${key}`);
  }
  const social = CATEGORY_DEFS.find((d) => d.id === 'cat_social')!;
  const leans = [
    { axis: 'extraversion' as const, lean: 'high' as const, pct: 81 },
    { axis: 'agreeableness' as const, lean: 'low' as const, pct: 57 },
    { axis: 'playfulness' as const, lean: 'low' as const, pct: 64 },
  ];
  const key = diveBucketKey(social.id, leans);
  assert.equal(key, 'dd|cat_social|extraversion:h,agreeableness:m,playfulness:l', 'side, or middle under 60%');
  assert.equal(diveBucketKey(social.id, [...leans].reverse()), key, 'order never changes the bucket');
  for (const bad of [
    'dd|cat_social|extraversion:h,agreeableness:m',
    'dd|cat_social|agreeableness:m,extraversion:h,playfulness:l',
    'dd|cat_nope|extraversion:h',
    'dd|cat_social|extraversion:h,agreeableness:m,playfulness:l,openness:h',
    'DD|cat_social|x',
  ]) {
    assert.equal(parseDiveBucket(bad), null, `refused: ${bad}`);
    assert.equal(planLibraryCall('deep_dive', bad, {}).ok, false);
  }
  assert.equal(planLibraryCall('nope', key, {}).ok, false, 'unknown kind refused');
  ok('207 deep-dive buckets; keys round-trip; tampered keys are refused before anything is charged');

  const plan = planLibraryCall('deep_dive', key, {});
  assert.ok(plan.ok);
  if (!plan.ok) return;
  assert.deepEqual(plan.angles, ['people', 'work'], 'two angles per call, the thinnest first');
  assert.deepEqual((planLibraryCall('deep_dive', key, { people: 2, work: 1 }) as { angles: string[] }).angles, ['solo', 'work']);
  assert.deepEqual((planLibraryCall('deep_dive', key, {}, 1) as { angles: string[] }).angles, ['people'], 'the retry asks for one card');
  assert.match(plan.prompt, /ANGLE: with other people/);
  assert.match(plan.prompt, /ANGLE: at work/);
  assert.match(plan.prompt, /"agreeableness": in the middle, between/);
  assert.match(plan.prompt, /never say which side\s+the reader is on/);
  assert.doesNotMatch(plan.prompt, /\d{2}%/, 'no percentage in a shared prompt');
  ok('one deep-dive call = two angles of one bucket; middle traits are a balance; no percentages');

  const line = (axis: string) =>
    `You tend to bring a steady kind of energy to this, like when you settle into the plan with the people around you for ${axis === 'extraversion' ? 'the evening' : 'a while'}.`;
  const good = {
    title: 'the warm planner',
    showsUp: ['extraversion', 'playfulness', 'agreeableness'].map((axis) => ({ axis, line: line(axis) })),
    mix: 'These sides work together in a quiet way, so you can be the one who gets things moving and still keeps it calm.',
    othersNotice: 'People around you probably notice how easy it is to follow your lead when a plan needs a push.',
    whatItMeansForYou:
      'You pull people in and keep things on track at the same time. You see it when the group plan finally happens because you sent the first message. It says you care about the people as much as the plan.',
  };
  const twoCards = JSON.stringify({ cards: [good, { ...good, title: 'the easy organiser' }] });
  const checked = checkLibraryAnswer('deep_dive', key, plan.angles, twoCards);
  assert.equal(checked.cards.length, 2, `both cards pass (${checked.reason})`);
  assert.equal((checked.cards[0]!.card as { leansKey: string }).leansKey, `${LIBRARY_VERSION.deep_dive}|${key}`);
  const withDigit = JSON.stringify({ cards: [{ ...good, whatItMeansForYou: good.whatItMeansForYou.replace('the first', 'the 1st') }] });
  assert.equal(checkLibraryAnswer('deep_dive', key, ['people'], withDigit).cards.length, 0, 'a digit is rejected');
  const clinical = JSON.stringify({ cards: [{ ...good, title: 'the anxious planner' }] });
  assert.equal(checkLibraryAnswer('deep_dive', key, ['people'], clinical).cards.length, 0, 'a clinical word is rejected');
  ok('the server keeps only answers that pass the app’s own deep-dive checks');

  // --- Story buckets --------------------------------------------------------------------
  const storyKey = 'st|cat_social:high:extraversion.h|cat_structure:hl:-|j:extraversion.h';
  const sb = parseStoryBucket(storyKey);
  assert.ok(sb, 'a two-side story bucket parses');
  for (const bad of [
    'st|cat_social:high:openness.h|j:-',
    'st|cat_social:zz:-|j:-',
    'st|cat_social:high:-|cat_social:low:-|j:-',
    'st|cat_social:high:-|j:openness.h',
    'st|j:-',
  ]) {
    assert.equal(parseStoryBucket(bad), null, `refused: ${bad}`);
  }
  const sp = planLibraryCall('story', storyKey, {});
  assert.ok(sp.ok);
  if (!sp.ok) return;
  assert.match(sp.prompt, /TOLD-VS-PLAYED: none\. Do not invent a split\./, 'the personal told-vs-played line never reaches a shared story');
  assert.match(sp.prompt, /SETTING FOR THIS STORY: a plan with friends/);
  const sp2 = planLibraryCall('story', storyKey, { friends: 1 });
  assert.ok(sp2.ok && sp2.prompt !== sp.prompt && /SETTING FOR THIS STORY: a task at work/.test(sp2.prompt), 'another angle reads another setting and wording');
  ok('Story buckets parse and refuse bad keys; no told-vs-played line, a setting per angle');

  // --- Legends buckets ------------------------------------------------------------------
  let legendKeys = 0;
  for (const legend of LEGEND_ROSTER) {
    const angle = legend.angles[0];
    const moment = legend.moments.find((m) => m.source.verified);
    const tag = legend.tags[0];
    if (!angle || !moment || !tag) continue;
    const reader = TRAIT_AXES.map((axis, i) => ({ axis, lean: (i % 2 ? 'low' : 'high') as 'low' | 'high', strength: 0.4 - i / 100 }));
    const pairs = legendPairs(legend, reader);
    if (pairs.length === 0) continue;
    const differ = legendDiffer(legend, reader, new Set(pairs.map((p) => p.axis)));
    const lk = legendBucketKey({ legend, angle, momentId: moment.id, pairs, differ });
    assert.ok(BUCKET_KEY_RE.test(lk), lk);
    const parsed = parseLegendBucket(lk);
    assert.ok(parsed, `parses: ${lk}`);
    assert.deepEqual(parsed!.pairs.map((p) => [p.axis, p.lean, p.contrast, p.tag.them]), pairs.map((p) => [p.axis, p.lean, p.contrast, p.tag.them]));
    assert.equal(parsed!.differ?.axis ?? null, differ?.axis ?? null);
    legendKeys += 1;
  }
  assert.ok(legendKeys >= 100, `every legend has a bucket (${legendKeys})`);
  const shared = LEGEND_ROSTER.find((l) => l.tags.length >= 2)!;
  const t0 = shared.tags[0]!;
  const sharedSide = `${t0.axis}.${t0.lean === 'high' ? 'h' : 'l'}`;
  const t1 = shared.tags.find((t) => t.axis !== t0.axis)!;
  const differSame = `lg|${shared.id}|a1|m1|p:${t1.axis}.${t1.lean === 'high' ? 'h' : 'l'}|d:${sharedSide}`;
  assert.equal(parseLegendBucket(differSame), null, 'a "where you differ" side the legend shares is refused');
  assert.equal(parseLegendBucket('lg|lf_nobody|a1|m1|p:openness.h|d:-'), null, 'unknown legend refused');
  ok(`Legends: ${legendKeys} legends round-trip their bucket; impossible buckets are refused`);

  // --- nothing personal in a shared prompt -----------------------------------------------
  for (const file of ['deep-dive', 'story', 'legend', 'server', 'types']) {
    const src = read(`src/lib/ai-library/${file}.ts`);
    assert.doesNotMatch(src, /userId|user_id|\bme\./, `${file}.ts never reads who the reader is`);
  }
  for (const lib of [DEEP_DIVE_LIBRARY, STORY_LIBRARY, LEGEND_LIBRARY]) assert.equal(lib.readCard(null), null);
  ok('the shared prompts are built from the bucket only (no user id, no per-person seed)');

  // --- wave93 SQL ------------------------------------------------------------------------
  const sql = read('supabase/migrations/wave93_ai_library.sql').replace(/--[^\n]*/g, '');
  for (const t of ['ai_library_cards', 'ai_library_seen', 'ai_library_reports']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`));
    assert.match(sql, new RegExp(`revoke all on public\\.${t} from public, anon, authenticated;`));
  }
  assert.doesNotMatch(sql, /create policy/i, 'no policies: nobody reads the library directly');
  const fn = (name: string) => {
    const start = sql.indexOf(`create or replace function public.${name}(`);
    assert.ok(start >= 0, `${name} exists`);
    return sql.slice(start, sql.indexOf('$$;', start));
  };
  assert.match(sql, /grant execute on function public\.library_add_cards\(uuid, text, text, text, jsonb, text\) to service_role;/);
  assert.match(sql, /revoke all on function public\.library_add_cards\(uuid, text, text, text, jsonb, text\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /library_add_cards\([^)]*\) to authenticated/, 'no phone can add a card');
  assert.match(fn('library_serve'), /p_kind not in \('deep_dive', 'story'\)/, 'Legends cards are never free through library_serve');
  assert.match(fn('library_add_cards'), /bad := public\._library_card_ok\(p_kind, item->'card'\);\s*if bad is not null then\s*continue;/, 'every card passes the backstop guard');
  const guard = fn('_library_card_ok');
  for (const re of [/https\?:\/\//, /fuck/, /'\[0-9\]'/, /anxious/]) assert.match(guard, re);
  assert.ok(guard.includes('\\.com\\M'), 'the .com rule ends on a Postgres word boundary');
  assert.ok(!guard.includes('\\b'), 'Postgres regex: \\b is a backspace, use \\m / \\M');
  assert.match(guard, /'\^a\[1-6\]\$'/, 'Legends ids (a1, m1) are checked by pattern, not the 3-character text minimum');
  assert.doesNotMatch(guard, /'legendId', 'angleId', 'momentId'\]/);
  const pick = fn('_library_pick');
  assert.match(pick, /c\.approved_at is not null or c\.created_by = p_uid or c\.created_at < now\(\) - interval '24 hours'/, 'cooling period');
  assert.match(pick, /c\.retired_at is null/);
  assert.match(pick, /not exists \(select 1 from public\.ai_library_seen s where s\.user_id = p_uid/, 'unseen only');
  assert.match(pick, /public\.connections k/, 'Circle friends get different cards first');
  assert.match(pick, /random\(\)/);
  assert.match(fn('_library_give'), /when seen >= 5 then seen - 1 else null/, '"N others" only from 5 people up');
  const serve = fn('library_serve');
  assert.ok(serve.indexOf('_library_crisis(uid)') < serve.indexOf('_library_pick'), 'crisis checked before serving');
  assert.match(serve, /library_free_daily_cap/);
  const claim = fn('claim_library_write');
  assert.match(claim, /perform public\.require_root\(\);/, 'seed is root only');
  assert.match(claim, /_library_crisis\(uid\)/);
  assert.match(claim, /public\.claim_category_deep_dive\(\)/);
  assert.match(claim, /public\.claim_story_generate\(\)/);
  assert.match(claim, /public\.claim_legend_figure_story\(\)/);
  assert.match(claim, /ai := public\.claim_ai_call\('explore'\);\s*if \(ai->>'ok'\)::boolean is distinct from true then\s*raise exception 'ai quota' using errcode = 'P0043';/, 'a full AI cap rolls the charge back');
  assert.match(claim, /legend_free_daily_cap/, 'the free Legends reveal has its own cap, never charged');
  const legendServe = claim.indexOf("pick := public._library_pick(uid, p_kind, p_bucket, p_version);");
  assert.ok(legendServe > claim.indexOf('claim_legend_figure_story()') && legendServe > claim.indexOf("usage_key := 'legend_free'"), 'a Legends reveal is claimed first, then served from the library');
  assert.ok(legendServe < claim.indexOf("ai := public.claim_ai_call('explore');"), 'a library hit uses no AI cap unit');
  const report = fn('library_report');
  assert.match(report, /not exists \(select 1 from public\.ai_library_seen where user_id = uid and card_id = p_card_id\)/, 'only someone shown the card can report it');
  assert.match(report, /report_count \+ 1 >= limit_n/);
  for (const name of ['library_retire', 'library_approve', 'library_retire_old_versions', 'library_admin_list', 'library_stats', 'library_bucket_counts']) {
    assert.match(fn(name), /perform public\.require_root\(\);/, `${name} is root only`);
  }
  ok('wave93: no direct access, only the server adds cards, guard + cooling + reports + Circle + crisis + root tools');

  // --- the Edge Function -------------------------------------------------------------------
  const edge = read('supabase/functions/ai-library/index.ts');
  assert.match(edge, /from '\.\.\/_shared\/ai-library\.bundle\.js'/);
  assert.doesNotMatch(edge, /payload\.(prompt|card|text|cards)/, 'never takes a prompt or card text from the phone');
  assert.ok(edge.indexOf("rpc('claim_library_write'") < edge.indexOf('await complete('), 'claim first, then the model');
  assert.ok(edge.indexOf("planLibraryCall(kind, bucket, angleCounts)") < edge.indexOf("rpc('claim_library_write'"), 'the key is checked before anything is charged');
  assert.match(edge, /ai_consent !== true/, 'consent enforced on the server');
  assert.match(edge, /admin\.rpc\('library_add_cards'/, 'cards are stored with the service role');
  assert.match(edge, /checkLibraryAnswer\(kind, bucket, angles, raw\)/);
  assert.match(edge, /refund_ai_tokens/);
  assert.match(edge, /admin\.rpc\('refund_ai_call'/, 'a failed call gives back the shared AI cap unit');
  assert.match(edge, /if \(claimRow\.served\?\.ok\) return json/, 'a Legends library hit returns without a model call');
  assert.doesNotMatch(edge, /console\.log\([^)]*raw/, 'never logs the text');
  ok('ai-library: consent, key check, claim, then the model; app checks; service-role store; refund on failure');

  // --- the phone -------------------------------------------------------------------------
  const client = read('src/lib/ai-library/client.ts');
  assert.match(client, /functions\.invoke\('ai-library', \{ body: \{ kind, bucket, mode \} \}\)/, 'the phone sends only kind, bucket, mode');
  const card = read('src/components/category-deep-dive-card.tsx');
  assert.match(card, /DEEP_DIVE_OPEN_LABEL = 'Open my deep dive · free'/);
  assert.match(card, /\{DEEP_DIVE_NEW_LABEL\} · \{AI_PRICE_LABEL\}/, 'a brand-new one shows its price');
  assert.match(card, /<LibraryCardFooter libraryId=\{entry\.libraryId\} others=\{entry\.others\} \/>/);
  const fold = read('src/components/sage-story-fold.tsx');
  assert.match(fold, /serveLibraryCard\('story', bucket/);
  assert.match(fold, /tensionLine \?/, 'the told-vs-played line shows on this phone only');
  assert.match(fold, /<LibraryCardFooter/);
  const gen = read('src/lib/legend-figures/generate.ts');
  assert.match(gen, /input\.free \? 'free_legend' : 'paid'/, 'the free Legends reveal is never charged');
  assert.doesNotMatch(gen, /serveLibraryCard\('legend'/, 'Legends never use the free library serve');
  assert.match(fold, /if \(mode === 'library'\) \{\s*emptyReasonRef\.current = 'empty';/, 'a free Story tap with no bucket never charges');
  assert.match(card, /leansKey: key \}, madeOn: today \}/, 'the old deep-dive path saves under the library key (no repeat charge)');
  assert.match(read('src/app/(tabs)/legends.tsx'), /revealLegendStory\(\{ \.\.\.input, consentGranted, free \}\)/);
  assert.match(read('src/components/legend-figure-card.tsx'), /<LibraryCardFooter/);
  assert.equal(sharedCardLine(3), null);
  assert.equal(sharedCardLine(11), 'You and 11 others got this card.');
  const consent = read('src/components/ai-consent-card.tsx');
  assert.match(consent, /shared between people with similar leanings and never include your name or your answers/);
  ok('phone: kind + bucket only; free first, brand-new priced; footer on all three; consent says cards are shared');

  // --- wave94: the library fills itself ------------------------------------------------
  const sql94 = read('supabase/migrations/wave94_ai_library_fill.sql').replace(/--[^\n]*/g, '');
  const fn94 = (name: string) => {
    const start = sql94.indexOf(`create or replace function public.${name}(`);
    assert.ok(start >= 0, `${name} exists`);
    return sql94.slice(start, sql94.indexOf('$$;', start));
  };
  for (const t of ['ai_library_wanted', 'ai_library_fill_fails', 'ai_library_fill_days']) {
    assert.ok(sql94.includes(`alter table public.${t} enable row level security;`), `${t}: RLS on`);
    assert.ok(sql94.includes(`revoke all on public.${t} from public, anon, authenticated;`), `${t}: no direct access`);
  }
  assert.doesNotMatch(sql94, /create policy/i);
  assert.match(sql94, /user_id uuid not null references auth\.users\(id\) on delete cascade/, 'wanted keys go with the account');
  const want = fn94('library_want');
  assert.ok(want.includes("cap := case p_kind when 'deep_dive' then 11 when 'story' then 3 else 6 end;"), 'capped per account');
  assert.ok(want.includes('_library_crisis(uid)'));
  assert.ok(want.includes('array_length(p_buckets, 1), 0) not between 1 and 11'));
  for (const name of ['library_fill_token_ok', 'library_fill_queue', 'library_fill_state', 'library_fill_begin', 'library_fill_done']) {
    assert.match(sql94, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`), `${name}: no phone`);
    assert.match(sql94, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`), `${name}: service role only`);
  }
  assert.ok(fn94('library_fill_token_ok').includes('vault.decrypted_secrets'), 'the token lives in Vault');
  assert.ok(fn94('library_fill_token_ok').includes('length(p_token) >= 32'));
  assert.match(fn94('library_fill_begin'), /if used >= cap then\s*return false;/, 'a hard daily cap');
  assert.ok(sql94.includes('library_fill_daily_cap int not null default 400'));
  assert.ok(fn94('library_fill_queue').includes('f.fails >= 3'), 'a group that keeps failing is skipped for the day');
  assert.ok(fn94('library_fill_queue').includes("interval '7 days'"), 'only people active this week');
  assert.ok(fn94('library_coverage').includes('perform public.require_root();'));
  const teamSize = fn94('library_team_size');
  assert.ok(teamSize.includes('when n >= 5 then (n / 5) * 5 else null end'), 'team size only from 5 up, in steps of 5');
  assert.ok(teamSize.includes("p_bucket not like 'dd|cat_love|%'"), 'never for How You Love');
  assert.ok(teamSize.includes('mine.user_id = auth.uid()'), 'only for a group the caller is in');
  assert.ok(sql94.includes('check (library_fill_per_run between 0 and 5)'), 'a run fits the function time limit');
  assert.ok(want.includes('now() - make_interval(secs => i / 1000.0)'), 'the trim keeps the phone’s best groups');
  assert.match(sql94, /cron\.schedule\(\s*'ai-library-fill',\s*'\*\/10 \* \* \* \*'/);
  assert.doesNotMatch(sql94, /from public\.trait_tracks|from public\.me\b/, 'no cross-account trait read');
  const fill = read('supabase/functions/ai-library-fill/index.ts');
  assert.ok(fill.indexOf("rpc('library_fill_token_ok'") < fill.indexOf("rpc('library_fill_queue'"), 'the token is checked first');
  assert.ok(fill.indexOf("rpc('library_fill_begin')") < fill.indexOf('await complete('), 'the cap is claimed before every model call');
  assert.ok(fill.includes("p_source: 'seed'"));
  assert.ok(fill.includes('checkLibraryAnswer(item.kind, item.bucket, plan.angles, raw)'), 'the app’s own checks');
  assert.doesNotMatch(fill, /console\.log\([^)]*raw/, 'never logs the text');
  ok('wave94: look-ahead keys capped per account, token in Vault, service-role fill, daily cap, fail skip, no trait read');

  // --- phone look-ahead ---------------------------------------------------------------
  const legendsScreen = read('src/app/(tabs)/legends.tsx');
  assert.ok(fold.includes("wantLibraryCards('story', buckets)"), 'Story tells the server its next groups');
  assert.ok(legendsScreen.includes("wantLibraryCards('legend', buckets)"), 'Legends tells the server today’s frames');
  assert.ok(legendsScreen.includes('planLegendReveal({ legend, frameAngleId: angleId, userId: start.userId, counts, told, tracks })'), 'one planner for reveal and look-ahead');
  assert.ok(card.includes("wantLibraryCards('deep_dive', [diveBucketKey(def.id, leans)])"), 'a used-up deep-dive group is queued, free');
  ok('the phone sends group keys ahead of time: Story, today’s Legends frames, a used-up deep dive');

  // --- teams -------------------------------------------------------------------------------
  const glyphs = JSON.parse(
    readFileSync(resolve(root, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'), 'utf8'),
  ) as Record<string, number>;
  const names = new Map<string, string>();
  let teams = 0;
  for (const def of CATEGORY_DEFS) {
    for (const bucket of allDiveBuckets(def.id)) {
      const team = teamForBucket(bucket);
      if (def.id === 'cat_love') {
        assert.equal(team, null, 'no team for How You Love');
        continue;
      }
      assert.ok(team, `a team for ${bucket}`);
      assert.ok(!names.has(team!.name), `unique: ${team!.name}`);
      names.set(team!.name, bucket);
      for (const icon of team!.icons) assert.ok(icon in glyphs, `icon exists: ${icon}`);
      assert.equal(team!.icons.length, def.axes.length);
      teams += 1;
    }
  }
  assert.equal(teams, 198, '207 groups minus the 9 of How You Love');
  assert.equal(teamForBucket('dd|cat_social|extraversion:l,agreeableness:l,playfulness:h')!.name, 'Night-In Hot-Take Chaos Club', 'names are stable');
  const poleWords = new Set(TRAIT_AXES.flatMap((a) => [AXIS_POLE_NAME[a].high, AXIS_POLE_NAME[a].low].map((w) => w.toLowerCase())));
  for (const sides of Object.values(TEAM_SIDES)) {
    for (const side of Object.values(sides!)) {
      for (const word of side.phrase.toLowerCase().split('-')) assert.ok(!poleWords.has(word), `no test word in a team phrase: ${side.phrase}`);
      assert.doesNotMatch(side.phrase, /anxi|insecur|needy|clingy|toxic|lazy|weird|rizz|slay|no-cap|bestie/i);
    }
  }
  assert.equal(TEAM_COPY_REVIEWED, false, 'team names ship unreviewed');
  assert.ok(existsSync(resolve(root, 'docs/team-names-review.md')), 'review doc exists');
  const badge = read('src/components/team-badge.tsx');
  assert.ok(badge.includes('setShown(map[categoryId] === true)'), 'hidden by default, shown only by choice');
  assert.ok(badge.includes('TEAM_HIDDEN_ICON'));
  assert.ok(card.includes('<TeamBadge'));
  ok(`teams: ${teams} unique names from the reader’s sides, real icons, none for How You Love, hidden by default`);

  console.log(`\n${passed} ai-library checks passed`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
