/**
 * Prints the SQL VALUES rows for wave82's daily_pick_pool from the app's own
 * list (src/lib/daily-pick/bank.ts), so the server checks answers against the
 * exact picks the phone shows.
 * Run: npx tsx scripts/gen-wave82-picks.ts
 */
import { DAILY_PICKS } from '../src/lib/daily-pick/bank';

const q = (text: string) => `'${text.replace(/'/g, "''")}'`;

const rows = DAILY_PICKS.map((p, i) => {
  const options = JSON.stringify(p.options.map((o) => ({ text: o.text, value: o.value })));
  return `  (${q(p.id)}, ${i}, ${q(p.axis)}, ${q(p.prompt)}, ${q(options)}::jsonb)`;
});

console.log(rows.join(',\n'));
