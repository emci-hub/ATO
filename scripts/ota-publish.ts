/**
 * The ONLY sanctioned way to publish a production OTA for ATO.
 * Run: npm run ota:publish -- [eas update args...]
 *
 * Hard gate: runs the full offline `check:*` suite first (scripts/ota-gate.ts).
 * If any check fails it exits 1 and does NOT touch EAS. Only when every check
 * is green does it hand off to `eas update` with the remaining CLI args.
 *
 * Examples:
 *   npm run ota:publish -- --branch production --message "My change"
 *   npm run ota:publish -- --branch production --platform ios --message "..."
 *
 * Live/env-gated checks (accounts, seeds, network, providers) are deliberately
 * excluded from the gate — see the EXCLUDED list in ota-gate.ts. They are run
 * by hand when their environment exists.
 */
import { spawnSync } from 'node:child_process';

import { runOtaGate } from './ota-gate';

function shellQuote(value: string): string {
  // cmd.exe quoting: wrap in double quotes, escaping embedded quotes.
  return `"${value.replace(/"/g, '""')}"`;
}

if (require.main === module) {
  const ok = runOtaGate();
  if (!ok) {
    console.error('\nota:publish aborted — the offline check gate failed. No OTA was published.');
    process.exit(1);
  }

  // npx is a .cmd shim on Windows, so it needs a shell there; args must be
  // quoted so multi-word values (e.g. --message "a b c") reach EAS verbatim.
  const args = process.argv.slice(2);
  const childArgs = ['eas-cli', 'update', ...args];
  const eas =
    process.platform === 'win32'
      ? spawnSync('npx', childArgs.map(shellQuote), {
          stdio: 'inherit',
          shell: true,
        })
      : spawnSync('npx', childArgs, { stdio: 'inherit', shell: false });
  process.exit(eas.status ?? 1);
}
