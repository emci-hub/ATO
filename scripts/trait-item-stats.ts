/**
 * Per-trait item agreement and retest stability.
 *
 * Run (once about 300 people have answered):
 *   npm run trait:item-stats
 *
 * The server key stays out of the app. Set both before the live read:
 *   SUPABASE_URL                  (or EXPO_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * With no key, or with fewer than about 300 people, this prints the count
 * and exits 0. It never writes, and it never retires a question.
 *
 * For each trait it prints:
 *   people with answers, Cronbach's alpha, each item's correlation with the
 *   rest of that trait, and retest stability (each person's mean in the first
 *   14 days of their answers, against their mean in the next 14 days).
 */
import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

import { TRAIT_AXES } from '../src/lib/traits';
import {
  TRAIT_ITEM_STATS_MIN_PEOPLE,
  cronbachAlpha,
  itemTotalCorrelations,
  pearson,
  retestStability,
} from '../src/lib/trait-item-stats';

const DAY_MS = 86_400_000;
const WINDOW_MS = 14 * DAY_MS;
const PAGE = 1000;

function selfCheck(): void {
  const matrix = [
    [1, 1, 1],
    [2, 2, 2],
    [3, 3, 3],
    [4, 4, 4],
  ];
  assert.ok(Math.abs((cronbachAlpha(matrix) ?? 0) - 1) < 1e-9);
  const totals = itemTotalCorrelations(matrix);
  assert.ok(totals.every((value) => value != null && Math.abs(value - 1) < 1e-9));
  assert.ok(Math.abs((retestStability([1, 2, 3, 4], [1, 2, 3, 4]) ?? 0) - 1) < 1e-9);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
  assert.equal(TRAIT_ITEM_STATS_MIN_PEOPLE, 300);
}

interface AnswerRow {
  user_id: string;
  axis: string;
  question_key: string;
  value: number;
  created_at: string;
  kind: string;
}

async function loadAnswers(url: string, key: string): Promise<AnswerRow[]> {
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const out: AnswerRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('trait_answers')
      .select('user_id, axis, question_key, value, created_at, kind')
      .in('kind', ['intake', 'round', 'bank'])
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as AnswerRow[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

function latestByQuestion(rows: readonly AnswerRow[]): Map<string, Map<string, { value: number; at: number }>> {
  const byUser = new Map<string, Map<string, { value: number; at: number }>>();
  for (const row of rows) {
    const at = Date.parse(row.created_at);
    if (!Number.isFinite(at) || !Number.isFinite(Number(row.value))) continue;
    const questions = byUser.get(row.user_id) ?? new Map();
    const prev = questions.get(row.question_key);
    if (!prev || at >= prev.at) questions.set(row.question_key, { value: Number(row.value), at });
    byUser.set(row.user_id, questions);
  }
  return byUser;
}

function reportTrait(axis: string, rows: readonly AnswerRow[]): void {
  const byUser = latestByQuestion(rows);
  const counts = new Map<string, number>();
  for (const questions of byUser.values()) {
    for (const key of questions.keys()) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const items = [...counts.entries()]
    .filter(([, n]) => n >= 20)
    .map(([key]) => key)
    .sort();
  const complete: number[][] = [];
  for (const questions of byUser.values()) {
    if (!items.every((key) => questions.has(key))) continue;
    complete.push(items.map((key) => questions.get(key)!.value));
  }
  const alpha = complete.length >= 30 ? cronbachAlpha(complete) : null;
  const totals = complete.length >= 30 ? itemTotalCorrelations(complete) : [];
  console.log(`\n${axis}`);
  console.log(`  people ${byUser.size} · items used ${items.length} · complete rows ${complete.length}`);
  console.log(`  Cronbach alpha ${alpha == null ? 'not enough complete rows yet' : alpha.toFixed(3)}`);
  items.forEach((key, index) => {
    const correlation = totals[index];
    console.log(`  ${key} item-total ${correlation == null ? '—' : correlation.toFixed(3)}`);
  });

  const earlier: number[] = [];
  const later: number[] = [];
  const byUserTime = new Map<string, { at: number; value: number }[]>();
  for (const row of rows) {
    const at = Date.parse(row.created_at);
    if (!Number.isFinite(at)) continue;
    const list = byUserTime.get(row.user_id) ?? [];
    list.push({ at, value: Number(row.value) });
    byUserTime.set(row.user_id, list);
  }
  for (const list of byUserTime.values()) {
    const first = Math.min(...list.map((row) => row.at));
    const early = list.filter((row) => row.at < first + WINDOW_MS);
    const next = list.filter((row) => row.at >= first + WINDOW_MS && row.at < first + 2 * WINDOW_MS);
    if (early.length < 2 || next.length < 2) continue;
    earlier.push(early.reduce((sum, row) => sum + row.value, 0) / early.length);
    later.push(next.reduce((sum, row) => sum + row.value, 0) / next.length);
  }
  const stability = earlier.length >= 30 ? retestStability(earlier, later) : null;
  console.log(
    `  retest (${earlier.length} people, first 14 days vs the next 14) ${
      stability == null ? 'not enough pairs yet' : stability.toFixed(3)
    }`,
  );
}

async function main(): Promise<void> {
  selfCheck();
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('trait-item-stats: math self-check passed.');
    console.log('Live read needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (a server key, not an app key).');
    console.log(`Wait for about ${TRAIT_ITEM_STATS_MIN_PEOPLE} people. With fewer, the report prints the count and changes nothing.`);
    return;
  }
  const rows = await loadAnswers(url, key);
  const people = new Set(rows.map((row) => row.user_id));
  if (people.size < TRAIT_ITEM_STATS_MIN_PEOPLE) {
    console.log(`Not enough people yet: ${people.size}. Wait for about ${TRAIT_ITEM_STATS_MIN_PEOPLE}. Nothing was changed.`);
    return;
  }
  console.log(`${people.size} people, ${rows.length} answers. Corrections are not included.`);
  for (const axis of TRAIT_AXES) {
    reportTrait(axis, rows.filter((row) => row.axis === axis));
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
