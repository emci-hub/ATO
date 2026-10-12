/**
 * npm run art:report — needs-restyle by usage, heaviest decoded atlases, OTA hint.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { ArtRegistry } from '../src/art/registry.types';

const repo = path.resolve(__dirname, '..');
const BUDGET = 48 * 1048576;

function main() {
  const registry = JSON.parse(fs.readFileSync(path.join(repo, 'assets/art/registry.json'), 'utf8')) as ArtRegistry;
  const restyle = registry.assets
    .filter((a) => a.status === 'needs-restyle' || !!a.restyle)
    .sort((a, b) => (a.restyle?.priority ?? 9) - (b.restyle?.priority ?? 9) || (b.usedBy?.length ?? 0) - (a.usedBy?.length ?? 0));
  console.log(`needs-restyle / restyle-tagged (${restyle.length}):`);
  for (const a of restyle.slice(0, 40)) {
    console.log(
      `  p${a.restyle?.priority ?? '?'}  ${a.id}  usedBy=${a.usedBy?.length ?? 0}  ${a.restyle?.pixellabPreset ?? ''}  ${a.restyle?.reason ?? ''}`,
    );
  }

  const heavy = [...registry.assets]
    .filter((a) => a.status !== 'archived')
    .sort((a, b) => (b.decodedBytes ?? 0) - (a.decodedBytes ?? 0));
  console.log('\ntop decoded atlases:');
  let sum = 0;
  for (const a of heavy.slice(0, 20)) {
    const mb = ((a.decodedBytes ?? 0) / 1048576).toFixed(2);
    sum += a.decodedBytes ?? 0;
    console.log(`  ${mb} MB  ${a.id}  ${a.size.w}×${a.size.h}  ${a.format ?? ''}`);
  }
  console.log(`\nbudget 48 MB/screen: heaviest 20 sum ${(sum / 1048576).toFixed(1)} MB (not all resident at once)`);
  if (heavy[0] && (heavy[0].decodedBytes ?? 0) > BUDGET) {
    console.log(`WARN ${heavy[0].id} alone exceeds the 48 MB budget`);
  }

  const disk = heavy.reduce((s, a) => s + (a.diskBytes ?? 0), 0);
  console.log(`live art disk ${(disk / 1048576).toFixed(2)} MB (${heavy.length} files)`);
}

main();
