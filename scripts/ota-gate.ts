/**
 * Pre-publish offline check gate for ATO.
 * Run: npm run check:ota-gate
 *
 * Runs the deterministic, offline `check:*` suite (static source assertions
 * + pure-logic tests) that must pass before any production OTA is published.
 *
 * EXCLUDED — live/env-gated checks that need real accounts, seeds, network, or
 * a live provider. They stay runnable by hand (npm run check:<name>) but must
 * never block a JS-only publish, since they fail for environmental reasons
 * (e.g. the wiped review account) unrelated to the code being shipped:
 *   around, around-going, auth-password, apple-revoke, card-live, crisis-live,
 *   delete-account, founder-access, intake-live, invite, legends-live, quota,
 *   sentry, style-live, talk-live, around-going-live
 *
 * PREFLIGHT: `typecheck` (tsc --noEmit) and `lint` (expo lint) run before the
 * check suite. They were never part of the gate before 2026-09-02, which is
 * how a guaranteed ReferenceError (checks.ts) and 16 type errors sat on
 * master through several OTAs.
 *
 * A check that fails here exits 1 (and ota-publish.ts refuses to publish).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXCLUDED = new Set([
  'ota-gate',
  'around',
  'around-going',
  'around-going-live',
  'auth-password',
  'apple-revoke',
  'card-live',
  'crisis-live',
  'delete-account',
  'founder-access',
  'intake-live',
  'invite',
  'legends-live',
  'quota',
  'sentry',
  'style-live',
  'talk-live',
]);

function gateCheckNames(): string[] {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  return Object.keys(pkg.scripts)
    .filter((name) => name.startsWith('check:'))
    .map((name) => name.slice('check:'.length))
    .filter((name) => name !== 'ota-gate') // the gate itself is not a gated check
    .filter((name) => !EXCLUDED.has(name))
    .sort();
}

function npmRun(script: string): void {
  execFileSync('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
}

const PREFLIGHT = ['typecheck', 'lint'] as const;

/** Returns true when every offline gate check passes. */
export function runOtaGate(): boolean {
  const names = gateCheckNames();
  const failed: string[] = [];
  for (const step of PREFLIGHT) {
    const start = Date.now();
    try {
      npmRun(step);
      console.log(`ota-gate: pass  ${step} (${Date.now() - start}ms)`);
    } catch {
      console.error(`ota-gate: FAIL  ${step} (${Date.now() - start}ms)`);
      failed.push(step);
    }
  }
  const totalChecks = Object.keys(
    JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    },
  ).filter((name) => name.startsWith('check:')).length;
  console.log(
    `ota-gate: running ${names.length} offline checks (${totalChecks - names.length} live/env-gated/meta checks skipped)`,
  );
  for (const name of names) {
    const start = Date.now();
    try {
      npmRun(`check:${name}`);
      console.log(`ota-gate: pass  ${name} (${Date.now() - start}ms)`);
    } catch {
      console.error(`ota-gate: FAIL  ${name} (${Date.now() - start}ms)`);
      failed.push(name);
    }
  }
  if (failed.length > 0) {
    console.error(`\nota-gate: ${failed.length} check(s) failed — do not publish until green.`);
    console.error(`  ${failed.join(', ')}`);
    return false;
  }
  console.log(`\nota-gate: typecheck + lint + all ${names.length} offline checks passed.`);
  return true;
}

if (require.main === module) {
  process.exit(runOtaGate() ? 0 : 1);
}
