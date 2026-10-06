/**
 * The trait checkpoint (wave79 step 1, wave80 step 2 — emci 2026-10-03).
 * Run: npm run check:trait-checkpoint
 *
 * Proves:
 *   1. No app code writes trait scores itself: no client write to
 *      trait_tracks / trait_history, no me update carrying trait columns, no
 *      call to the unscored answer_question_item. Every write goes through
 *      lib/trait-checkpoint.ts.
 *   2. The server maths is the app's maths: golden vectors produced by the
 *      live trait_ewma_step on 2026-10-03 (98 vectors, max difference 0) are
 *      reproduced here by applyEwmaAnswer / applyDirectAnswer, and the SQL
 *      text keeps the same constants.
 *   3. The server's list of the 48 intake questions matches bank.ts exactly.
 *   4. The checkpoints check what they must (question exists, option exists,
 *      next-in-order, game 0.2/0.8, taps never count).
 *   5. Step 2 (wave80) is prepared and still marked NOT APPLIED.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { applyDirectAnswer, applyEwmaAnswer, type TraitTrack } from '../src/lib/trait-stability';
import { mergeTraitWrite, emptyTraitState } from '../src/lib/traits';
import { SCENARIO_DECK } from '../src/lib/scenario';
import { wave79IntakeRows } from './gen-wave79-intake';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
}
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

// --- 1. no client writes ---------------------------------------------------------
{
  const files = walk(resolve(root, 'src'));
  const traitCols =
    /(openness|conscientiousness|extraversion|agreeableness|steadiness|attachment_anxiety|attachment_avoidance|conflict_assertiveness|conflict_cooperativeness|autonomy|competence|relatedness|growth_mindset|locus_of_control|self_efficacy|playfulness|trait_sources|trait_touched_at)\s*:/;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const rel = file.slice(root.length + 1);
    assert.doesNotMatch(src, /from\(['"]trait_tracks['"]\)\s*\.\s*(upsert|insert|update|delete)\(/, `${rel} writes trait_tracks`);
    assert.doesNotMatch(src, /from\(['"]trait_history['"]\)\s*\.\s*(upsert|insert|update|delete)\(/, `${rel} writes trait_history`);
    assert.doesNotMatch(src, /rpc\(['"]answer_question_item['"]/, `${rel} calls the unscored answer_question_item`);
    // A me update whose literal payload names a trait column.
    for (const m of src.matchAll(/from\(['"]me['"]\)\s*\.\s*update\(\s*\{([^}]*)\}/g)) {
      assert.doesNotMatch(m[1]!, traitCols, `${rel} updates a me trait column directly`);
    }
  }
  const me = read('src/lib/me.ts');
  assert.doesNotMatch(me, /traitPatch\(/, 'me.ts no longer builds trait patches');
  assert.doesNotMatch(me, /persistMergedTraits|upsertTraitTracks|insertTraitHistory/, 'the client write path is gone');
  for (const fn of ['setTraitDirect', 'recordGamePick', 'confirmTraitSources']) {
    assert.match(me, new RegExp(`${fn}\\(`), `me.ts writes through ${fn}`);
  }
  assert.match(me, /updateTraits takes direct sources only/, 'question answers cannot sneak through updateTraits');
  // Bank sets and retests answer through the checkpoint (wave85 answer_bank_item).
  assert.match(read('src/components/questions-fold.tsx'), /await answerBankItem\(key, optIndex\);/);
  assert.match(read('src/components/bank-finish-fold.tsx'), /await answerBankItem\(key, optIndex\);/);
  assert.match(read('src/lib/trait-checkpoint.ts'), /call\('answer_bank_item', \{ p_item_id: itemId, p_option_index: optionIndex \}\)/);
  assert.match(read('src/lib/dev-test-user.ts'), /await applyDevTraitPreset\(\{ values, sources, touched, tracks, history \}\);/);
  assert.match(read('src/components/depth-dive.tsx'), /from '@\/lib\/trait-checkpoint'/);
  ok('no app code writes trait scores itself — everything goes through lib/trait-checkpoint.ts');
}

// --- 2. the server maths is the app's maths -----------------------------------------
{
  // [value, stability, count, sample, mode] -> [value, stability, count], from the
  // live trait_ewma_step (2026-10-03 parity run, 98/98 identical).
  const golden: [number, number, number, number, 'answer' | 'direct', number, number, number][] = [
    [0, 0, 0, 0.2, 'answer', 0.2, 0, 1],
    [0, 0, 0, 0.2, 'direct', 0.2, 0, 0],
    [0.8, 0, 1, 0.2, 'answer', 0.5900000000000001, 0, 2],
    [0.8, 0, 1, 0.5, 'answer', 0.6950000000000001, 0.13999999999999996, 2],
    [0.8, 0, 1, 0.5, 'direct', 0.6950000000000001, 0, 1],
    [0.8, 0.14, 2, 0.2, 'answer', 0.6100946372239748, 0.09100000000000001, 3],
    [0.8, 0.14, 2, 0.75, 'direct', 0.7841745531019979, 0.14, 2],
    [0.65, 0.3, 3, 0.1, 'answer', 0.499441340782123, 0.195, 4],
    [0.2, 0.577, 5, 0.8, 'answer', 0.31130881523714055, 0.37505, 6],
    [0.5, 0.05, 9, 1, 'answer', 0.6692111959287532, 0.0325, 10],
    [0.33, 0.9, 12, 0, 'direct', 0.3131386861313869, 0.9, 12],
  ];
  for (const [v, s, n, sample, mode, ev, es, ec] of golden) {
    const cur: TraitTrack | null =
      n > 0 ? { axis: 'openness', track: 'report', value: v, stability: s, answerCount: n, lastTouched: 'x', lastDepthAt: null } : null;
    const next = mode === 'answer' ? applyEwmaAnswer(cur, 'openness', 'report', sample, 'x') : applyDirectAnswer(cur, 'openness', sample, 'x');
    assert.equal(next.value, ev, `value ${JSON.stringify([v, s, n, sample, mode])}`);
    assert.equal(next.stability, es, `stability ${JSON.stringify([v, s, n, sample, mode])}`);
    assert.equal(next.answerCount, ec, `count ${JSON.stringify([v, s, n, sample, mode])}`);
  }
  const sql = read('supabase/migrations/wave79_trait_checkpoint.sql');
  assert.match(sql, /v_alpha double precision := 0\.35::float8;/);
  assert.match(sql, /v_gain := v_prior \/ \(v_prior \+ \(1::float8 - v_alpha\) \/ v_alpha\);/);
  assert.match(sql, /v_prior := greatest\(0\.05::float8, 1::float8 - p_stability\);/);
  assert.match(sql, /abs\(v_signal - p_value\) \/ 0\.5::float8/);
  assert.match(sql, /0\.12::float8 \* p_sample \+ 0\.88::float8 \* coalesce\(v_cur, 0\.5::float8\)/);
  assert.match(sql, /if p_mode = 'direct' then\s+stability := p_stability;\s+answer_count := p_count;/);
  // The merge rule both sides share, including the empty-label fix.
  assert.match(sql, /v_rejected := v_cur is not null and public\.trait_is_direct_source\(v_cur_src\) and not public\.trait_is_direct_source\(p_source\);/);
  const emptyWithLabel = { ...emptyTraitState(), sources: { openness: 'self_settings' as const } };
  assert.notEqual(mergeTraitWrite(emptyWithLabel, { openness: 0.8 }, 'self_situation', ['openness']).values.openness, null,
    'a leftover direct label on an empty trait does not block it (TS side)');
  ok('golden vectors from the live server reproduce exactly in TypeScript; the SQL keeps the same constants and merge rule');
}

// --- 3. the 48 intake questions --------------------------------------------------------
{
  const sql = read('supabase/migrations/wave79_trait_checkpoint.sql');
  const block = sql.slice(sql.indexOf('insert into public.intake_questions'), sql.indexOf('on conflict (prompt) do nothing;'));
  const pattern = /\(\s*'((?:[^']|'')*)',\s*'([a-z_]+)',\s*(\d),\s*'((?:[^']|'')*)'::jsonb\)/g;
  const unescape = (s: string) => s.replace(/''/g, "'");
  const rows = [...block.matchAll(pattern)].map((m) => ({
    prompt: unescape(m[1]!),
    axis: m[2]!,
    setNo: Number(m[3]),
    options: JSON.parse(unescape(m[4]!)),
  }));
  const expected = wave79IntakeRows();
  assert.equal(rows.length, 48);
  expected.forEach((row, i) => {
    assert.equal(rows[i]!.prompt, row.draft.prompt, `intake row ${i} prompt`);
    assert.equal(rows[i]!.axis, row.draft.axis, `intake row ${i} axis`);
    assert.equal(rows[i]!.setNo, row.setNo, `intake row ${i} set`);
    assert.deepEqual(rows[i]!.options, row.draft.options.map((o) => ({ text: o.text, value: o.value })), `intake row ${i} options`);
  });
  ok('the server holds exactly the 48 intake questions of bank.ts, with their set numbers and options');
}

// --- 4. what each checkpoint refuses ---------------------------------------------------
{
  const sql = read('supabase/migrations/wave79_trait_checkpoint.sql');
  const body = (name: string) => {
    const at = sql.indexOf(`create or replace function public.${name}(`);
    assert.ok(at >= 0, name);
    return sql.slice(at, sql.indexOf('$$;', sql.indexOf('as $$', at)));
  };
  const intake = body('answer_intake_question');
  assert.match(intake, /raise exception 'unknown question'/);
  assert.match(intake, /raise exception 'invalid option'/);
  assert.match(intake, /if v_count <> q\.set_no - 1 then\s+raise exception 'question not open'/);
  // A re-sent answer (pager Retry, re-pick after Back) is a no-op, never an
  // error that would block the rest of the page, and never a second count.
  assert.match(intake, /if v_count >= q\.set_no then\s+return \(select to_jsonb\(m\) from public\.me m where m\.id = uid\);\s+end if;\s+if v_count <> q\.set_no - 1 then/);
  assert.match(intake, /perform 1 from public\.me where id = uid for update;/);
  const round = body('answer_round_item');
  assert.match(round, /where id = p_item_id and user_id = uid\s+for update;/);
  assert.match(round, /if it\.answered_at is not null then\s+return \(select to_jsonb\(m\)/, 'a re-sent round answer is a no-op');
  assert.match(round, /if it\.skipped_at is not null then\s+raise exception 'already answered'/);
  assert.match(round, /v_value := \(v_opt ->> 'value'\)::double precision;/, 'the score comes from the stored item, not the phone');
  const direct = body('set_trait_direct');
  assert.match(direct, /p_source is null or p_source not in \('self_tap', 'self_settings', 'self_scenario'\)/);
  assert.match(direct, /'direct'\);/, 'taps use the direct mode: never counted');
  assert.match(body('record_game_pick'), /p_value not in \(0\.2::float8, 0\.8::float8\)/);
  for (const axis of Object.keys(SCENARIO_DECK) as (keyof typeof SCENARIO_DECK)[]) {
    assert.ok([0.2, 0.8].includes(SCENARIO_DECK[axis].high.value) && [0.2, 0.8].includes(SCENARIO_DECK[axis].low.value),
      `${axis}: game picks are 0.2/0.8, so the server accepts them`);
  }
  const dev = body('apply_dev_trait_preset');
  assert.match(dev, /if v_mode is distinct from 'invite_only' then/);
  assert.match(dev, /if public\.is_root\(\) then/, 'history rows only for root');
  for (const name of ['_trait_write', 'trait_ewma_step', 'trait_is_direct_source']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`), `${name} is server-only`);
  }
  ok('checkpoints refuse unknown questions/options, out-of-order or repeat answers, other sources, bad game values; taps never count');
}

// --- 5. step 2 is ready, not applied ------------------------------------------------------
{
  const lock = read('supabase/migrations/wave80_trait_lock.sql');
  assert.match(lock, /^-- NOT APPLIED\./m, 'wave80 stays unapplied until emci says "lock"');
  assert.match(lock, /revoke insert, update, delete on table public\.trait_tracks from anon, authenticated;/);
  assert.match(lock, /revoke insert, update, delete on table public\.trait_history from anon, authenticated;/);
  assert.match(lock, /if current_user not in \('authenticated', 'anon'\) then\s+return new;/);
  assert.match(lock, /before insert or update on public\.me/);
  assert.match(lock, /revoke execute on function public\.answer_question_item\(uuid, int\) from authenticated;/);
  ok('step 2 (wave80 lock) is prepared and marked NOT APPLIED');
}

console.log(`\n${passed} trait-checkpoint checks passed`);
