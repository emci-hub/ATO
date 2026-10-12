/**
 * pixellab-watch: has PixelLab changed its docs since our guide was written?
 *
 * Downloads PixelLab's public docs (no key), reduces them to a comparable shape
 * (API endpoints + their parameters, and doc sections), and compares that with
 * docs/art/pixellab-snapshot.json. Prints what was added, removed or changed.
 * Never edits docs/art/PIXELLAB_GUIDE.md.
 *
 *   npm run pixellab:watch              report only
 *   npm run pixellab:watch -- --update  save the current docs as the new snapshot
 *
 * Needs network, so it is NOT part of check:ota-gate.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SNAPSHOT = join(__dirname, '..', 'docs', 'art', 'pixellab-snapshot.json');
const SOURCES = {
  openapi: 'https://api.pixellab.ai/v2/openapi.json',
  llms: 'https://api.pixellab.ai/v2/llms.txt',
  llmsFull: 'https://www.pixellab.ai/llms-full.txt',
} as const;

type Snapshot = {
  savedAt: string;
  endpoints: Record<string, string[]>; // "POST /create-image-pixflux" -> sorted param names
  sections: Record<string, string>; // "llms > ## Heading" -> hash of the section text
};

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'ato-pixellab-watch' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

function schemaProps(spec: any, schema: any, depth = 0): string[] {
  if (!schema || depth > 3) return [];
  if (schema.$ref) {
    const name = String(schema.$ref).split('/').pop() as string;
    return schemaProps(spec, spec.components?.schemas?.[name], depth + 1);
  }
  const out: string[] = Object.keys(schema.properties ?? {});
  for (const k of ['allOf', 'anyOf', 'oneOf'] as const) {
    for (const sub of schema[k] ?? []) out.push(...schemaProps(spec, sub, depth + 1));
  }
  return out;
}

function endpointsOf(spec: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [path, item] of Object.entries<any>(spec.paths ?? {})) {
    for (const [method, op] of Object.entries<any>(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const params = (op.parameters ?? []).map((p: any) => `${p.in}:${p.name}`);
      const body = op.requestBody?.content?.['application/json']?.schema;
      const props = schemaProps(spec, body).map((p) => `body:${p}`);
      out[`${method.toUpperCase()} ${path}`] = [...new Set([...params, ...props])].sort();
    }
  }
  return out;
}

function sectionsOf(label: string, text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const seen: Record<string, number> = {};
  let head = `${label} > (top)`;
  let buf: string[] = [];
  const flush = () => {
    if (buf.join('').trim()) out[head] = hash(buf.join('\n'));
  };
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,3}\s/.test(line)) {
      flush();
      // A heading can repeat ("### Usage"); number repeats so no section hides another.
      const base = `${label} > ${line.trim()}`;
      seen[base] = (seen[base] ?? 0) + 1;
      head = seen[base] > 1 ? `${base} #${seen[base]}` : base;
      buf = [];
    } else buf.push(line);
  }
  flush();
  return out;
}

function diffKeys(label: string, before: Record<string, unknown>, after: Record<string, unknown>, show: (k: string) => string) {
  const added = Object.keys(after).filter((k) => !(k in before));
  const removed = Object.keys(before).filter((k) => !(k in after));
  const changed = Object.keys(after).filter((k) => k in before && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const lines: string[] = [];
  for (const k of added) lines.push(`  + NEW      ${label}: ${k}`);
  for (const k of removed) lines.push(`  - REMOVED  ${label}: ${k}`);
  for (const k of changed) lines.push(`  ~ CHANGED  ${label}: ${k}${show(k)}`);
  return lines;
}

async function main() {
  const update = process.argv.includes('--update');
  const [openapi, llms, llmsFull] = await Promise.all([get(SOURCES.openapi), get(SOURCES.llms), get(SOURCES.llmsFull)]);
  const now: Snapshot = {
    savedAt: new Date().toISOString().slice(0, 10),
    endpoints: endpointsOf(JSON.parse(openapi)),
    sections: { ...sectionsOf('llms', llms), ...sectionsOf('llms-full', llmsFull) },
  };

  if (update || !existsSync(SNAPSHOT)) {
    writeFileSync(SNAPSHOT, JSON.stringify(now, null, 1) + '\n');
    console.log(`pixellab-watch: snapshot saved (${Object.keys(now.endpoints).length} endpoints, ${Object.keys(now.sections).length} doc sections).`);
    return;
  }

  const before: Snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  const lines = [
    ...diffKeys('endpoint', before.endpoints, now.endpoints, (k) => {
      const a = new Set(before.endpoints[k]);
      const b = new Set(now.endpoints[k]);
      const plus = [...b].filter((p) => !a.has(p));
      const minus = [...a].filter((p) => !b.has(p));
      return `  (${[...plus.map((p) => `+${p}`), ...minus.map((p) => `-${p}`)].join(', ')})`;
    }),
    ...diffKeys('doc section', before.sections, now.sections, () => ''),
  ];
  if (lines.length === 0) {
    console.log(`pixellab-watch: no changes since ${before.savedAt}. PIXELLAB_GUIDE.md is current.`);
    return;
  }
  console.log(`pixellab-watch: ${lines.length} change(s) since ${before.savedAt}:`);
  console.log(lines.join('\n'));
  console.log('\nNext: read the changed parts upstream, draft an update to docs/art/PIXELLAB_GUIDE.md for emci,');
  console.log('then run `npm run pixellab:watch -- --update` once the guide update is accepted.');
}

main().catch((e) => {
  console.error(`pixellab-watch: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
