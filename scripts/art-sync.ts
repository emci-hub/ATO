/**
 * npm run art:sync
 *
 * Recompute inUse/usedBy (and move in-use/unused) then rebuild ART_LIBRARY.md,
 * library.html, and library-portable.html. Deterministic — no timestamps.
 *
 * After any art add/remove/usage change: run this and commit the result.
 * Never hand-edit the generated files.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const ART_GENERATED_PATHS = [
  'assets/art/registry.json',
  'src/art/generated-art.ts',
  'assets/art/ART_LIBRARY.md',
  'assets/art/_contact',
  'tools/art-viewer/README.md',
  'assets/art/legacy-play-sheets.json',
  'src/play/generated-play-sheets.ts',
] as const;

const repo = path.resolve(__dirname, '..');
const npm = process.platform === 'win32';

export function runArtSync(): void {
  execFileSync('npm', ['run', 'art:registry'], { cwd: repo, stdio: 'inherit', shell: npm });
  execFileSync('npm', ['run', 'art:catalog', '--', '--portable'], { cwd: repo, stdio: 'inherit', shell: npm });
}

if (require.main === module) {
  runArtSync();
}
