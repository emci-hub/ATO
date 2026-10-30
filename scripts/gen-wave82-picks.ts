/**
 * Prints the SQL VALUES rows for wave82's daily_pick_pool from the app's own
 * list (src/lib/daily-pick/bank.ts), so the server checks answers against the
 * exact picks the phone shows. wave82 is applied, so it prints the pool as
 * wave82 created it (retired picks back in their old places).
 * Run: npx tsx scripts/gen-wave82-picks.ts
 *
 * --retire prints the body of the migration that parks each retired pick past
 * the rotation and inserts its replacement (wave99c_daily_pick_p65.sql).
 *
 * --wave117 prints wave117_almanac.sql's rows: the appended base picks, the
 * seasonal event Picks and their peak-day override rows (PHASE-11d).
 */
import {
  DAILY_PICKS,
  EVENT_DAILY_PICKS,
  EVENT_PICK_POSITION_BASE,
  eventPickOverrides,
  LEGACY_PICK_COUNT,
  RETIRED_DAILY_PICKS,
  RETIRED_PICK_POSITION_BASE,
  picksAtWave82,
} from '../src/lib/daily-pick/bank';

const q = (text: string) => `'${text.replace(/'/g, "''")}'`;
const optionsJson = (p: (typeof DAILY_PICKS)[number]) =>
  JSON.stringify(p.options.map((o) => ({ text: o.text, value: o.value })));

if (process.argv.includes('--wave117')) {
  // PHASE-11d: the appended base picks (positions 64…), the event Picks (parked
  // past every rotation, no axis, no values) and one override row per peak day.
  const base = DAILY_PICKS.slice(LEGACY_PICK_COUNT).map(
    (p, i) => `  (${q(p.id)}, ${LEGACY_PICK_COUNT + i}, ${q(p.axis)}, ${q(p.prompt)}, ${q(optionsJson(p))}::jsonb)`,
  );
  const events = EVENT_DAILY_PICKS.map(
    (p, i) =>
      `  (${q(p.id)}, ${EVENT_PICK_POSITION_BASE + i}, null, ${q(p.prompt)}, ${q(JSON.stringify(p.options.map((o) => (o.out ? { text: o.text, out: true } : { text: o.text }))))}::jsonb)`,
  );
  const overrides = eventPickOverrides().map((r) => `  (date '${r.ymd}', ${q(r.pickId)}, ${q(r.event)})`);
  console.log(
    [
      'insert into public.daily_pick_pool (id, position, axis, prompt, options) values',
      base.join(',\n'),
      'on conflict (id) do nothing;',
      '',
      'insert into public.daily_pick_pool (id, position, axis, prompt, options) values',
      events.join(',\n'),
      'on conflict (id) do nothing;',
      '',
      'insert into public.daily_pick_event_override (ymd, pick_id, event_id) values',
      overrides.join(',\n'),
      'on conflict (ymd) do nothing;',
    ].join('\n'),
  );
} else if (process.argv.includes('--retire')) {
  const lines: string[] = [];
  for (const r of RETIRED_DAILY_PICKS) {
    const next = DAILY_PICKS[r.position]!;
    lines.push(
      `update public.daily_pick_pool set position = ${RETIRED_PICK_POSITION_BASE + r.position} where id = ${q(r.pick.id)};`,
      `insert into public.daily_pick_pool (id, position, axis, prompt, options) values (${q(next.id)}, ${r.position}, ${q(next.axis)}, ${q(next.prompt)}, ${q(optionsJson(next))}::jsonb);`,
    );
  }
  console.log(lines.join('\n'));
} else {
  const rows = picksAtWave82().map((p, i) => `  (${q(p.id)}, ${i}, ${q(p.axis)}, ${q(p.prompt)}, ${q(optionsJson(p))}::jsonb)`);
  console.log(rows.join(',\n'));
}
