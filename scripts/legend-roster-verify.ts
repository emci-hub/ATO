/**
 * Legend roster source check — run BY HAND (network), never in the gate.
 *
 *   npx tsx scripts/legend-roster-verify.ts <cache-dir>
 *
 * Downloads each Wikipedia page the roster cites (once, into <cache-dir>, one
 * request per page, via the public API with a descriptive User-Agent), then
 * checks that every `check` phrase of every source marked `verified: true` is
 * really in that page's text. Exit 1 lists every miss, so a fact can only be
 * marked verified when its source actually says it. Facts that can't be
 * confirmed are marked `unverified(...)` in the roster instead — the app never
 * shows them or sends them to AI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LEGEND_ROSTER } from '../src/lib/legend-figures/roster';
import type { LegendSource } from '../src/lib/legend-figures/types';

const cacheDir = process.argv[2];
if (!cacheDir) {
  console.error('usage: tsx scripts/legend-roster-verify.ts <cache-dir>');
  process.exit(2);
}
mkdirSync(cacheDir, { recursive: true });

function titleOf(url: string): string {
  return decodeURIComponent(url.replace('https://en.wikipedia.org/wiki/', ''));
}

function cacheFile(title: string): string {
  return join(cacheDir, `${title.replace(/[^A-Za-z0-9_-]/g, '_')}.txt`);
}

async function pageText(title: string): Promise<string> {
  const file = cacheFile(title);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    redirects: '1',
    format: 'json',
    titles: title,
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'ATO-legend-factcheck/1.0 (roster source check)' },
  });
  const json = (await res.json()) as { query: { pages: Record<string, { extract?: string }> } };
  const page = Object.values(json.query.pages)[0];
  const text = page?.extract ?? '';
  writeFileSync(file, text, 'utf8');
  return text;
}

function norm(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');
}

async function main() {
  const misses: string[] = [];
  let checked = 0;
  for (const legend of LEGEND_ROSTER) {
    const sources: { label: string; source: LegendSource }[] = [
      ...legend.facts.map((f) => ({ label: f.id, source: f.source })),
      ...legend.moments.map((m) => ({ label: m.id, source: m.source })),
      ...(legend.birthday ? [{ label: 'birthday', source: legend.birthday.source }] : []),
    ];
    for (const { label, source } of sources) {
      if (!source.verified) continue;
      const text = norm(await pageText(titleOf(source.url)));
      for (const phrase of source.check) {
        checked += 1;
        if (!text.includes(norm(phrase))) misses.push(`${legend.id} ${label}: "${phrase}" not in ${source.url}`);
      }
    }
  }
  if (misses.length > 0) {
    console.error(`${misses.length} phrase(s) not found:\n  ${misses.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`legend sources: all ${checked} phrases found in their cited pages.`);
}

void main();
