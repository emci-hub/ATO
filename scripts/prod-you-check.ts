/**
 * Production bundle must not contain You-tab crash/push probes.
 * Run: npm run check:prod-you
 *
 * Exports an iOS production bundle and asserts the crash-test copy is gone.
 * `__DEV__` is compiled false here; Metro also stubs the probe modules.
 * This is not a runtime hide flag.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const you = readFileSync(join(root, 'src/app/(tabs)/you.tsx'), 'utf8');
assert.doesNotMatch(you, /from '@\/components\/sentry-test-card'/);
assert.doesNotMatch(you, /from '@\/components\/push-test-card'/);
assert.match(you, /if \(__DEV__\) \{/);
assert.match(readFileSync(join(root, 'metro.config.js'), 'utf8'), /PROBE_STUB/);
ok('You tab has no static import of crash/push probes; Metro stubs them in production');

const outDir = mkdtempSync(join(tmpdir(), 'ato-prod-you-'));
try {
  execSync(`npx expo export --platform ios --output-dir "${outDir}"`, {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'pipe',
    encoding: 'utf8',
  });

  const files: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const next = join(dir, name);
      if (statSync(next).isDirectory()) walk(next);
      else files.push(next);
    }
  }
  walk(outDir);

  const haystack = files
    .filter((file) => /\.js$/.test(file) && !file.endsWith('.map'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  assert.doesNotMatch(haystack, /Test crash reporting/);
  assert.doesNotMatch(haystack, /Native crash/);
  assert.doesNotMatch(haystack, /Test notifications/);
  ok('production iOS export contains no crash-test or push-test controls');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(`\nprod-you-check: ${passed}/${passed} passed`);
