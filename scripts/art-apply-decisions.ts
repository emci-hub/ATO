/**
 * npm run art:apply-decisions [-- --apply]
 *
 * Reads assets/art/art-decisions.json (exported from the library viewer).
 * Default is a dry-run. `--apply` moves `remove` items to art-src/art-trash/
 * and updates the registry. Never a hard delete.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { ArtRegistry, ArtStatus } from '../src/art/registry.types';

type Action = 'keep' | 'use' | 'needs-restyle' | 'remove';
type Decisions = {
  version: number;
  decidedAt?: string;
  decisions: Record<string, { action: Action; notes?: string }>;
};

const repo = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

function main() {
  const file = path.join(repo, 'assets/art/art-decisions.json');
  if (!fs.existsSync(file)) {
    console.log('no assets/art/art-decisions.json — export one from the library viewer');
    return;
  }
  const decisions = JSON.parse(fs.readFileSync(file, 'utf8')) as Decisions;
  const registryPath = path.join(repo, 'assets/art/registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as ArtRegistry;
  const byId = new Map(registry.assets.map((a) => [a.id, a]));

  const stamp = new Date().toISOString().slice(0, 7);
  const trash = path.join(repo, 'art-src/art-trash', stamp);
  let removeN = 0;
  let removeBytes = 0;
  let useN = 0;
  let restyleN = 0;
  const missing: string[] = [];

  for (const [id, d] of Object.entries(decisions.decisions ?? {})) {
    const asset = byId.get(id);
    if (!asset) {
      missing.push(id);
      continue;
    }
    if (d.action === 'keep') continue;
    if (d.action === 'use') {
      useN += 1;
      if (APPLY && asset.status === 'resource') asset.status = 'candidate';
      if (APPLY && d.notes) asset.notes = d.notes;
    } else if (d.action === 'needs-restyle') {
      restyleN += 1;
      if (APPLY) {
        asset.status = 'needs-restyle' as ArtStatus;
        asset.restyle = asset.restyle ?? {
          priority: 2,
          reason: d.notes || 'marked in library viewer',
          pixellabPreset: 'prop',
          refIds: [],
        };
      }
    } else if (d.action === 'remove') {
      removeN += 1;
      removeBytes += asset.diskBytes ?? 0;
      if (APPLY) {
        const from = path.join(repo, asset.path);
        if (fs.existsSync(from)) {
          const dest = path.join(trash, path.basename(asset.path));
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.renameSync(from, dest);
          asset.sourceRef = path.relative(repo, dest);
        }
        asset.status = 'archived';
        if (d.notes) asset.notes = d.notes;
      }
    }
  }

  console.log(`decisions: ${Object.keys(decisions.decisions ?? {}).length}`);
  console.log(`  use ${useN}  needs-restyle ${restyleN}  remove ${removeN} (${(removeBytes / 1048576).toFixed(2)} MB)`);
  if (missing.length) console.log(`  unknown ids: ${missing.slice(0, 8).join(', ')}`);
  if (!APPLY) {
    console.log('dry-run. Re-run with --apply to move removals to art-src/art-trash and update the registry.');
    return;
  }
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`applied. trash=${path.relative(repo, trash)}`);
}

main();
