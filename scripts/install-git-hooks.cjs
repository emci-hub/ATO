#!/usr/bin/env node
/**
 * Point this checkout at .githooks/ (core.hooksPath).
 * Safe to run from npm prepare on Windows, macOS, Linux, cloud agents, and EAS
 * (no-ops when there is no .git).
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..');
const hooks = path.join(repo, '.githooks');
if (!fs.existsSync(path.join(repo, '.git')) || !fs.existsSync(hooks)) process.exit(0);

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { cwd: repo, stdio: 'ignore' });
} catch {
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: repo });
for (const name of fs.readdirSync(hooks)) {
  const file = path.join(hooks, name);
  try {
    fs.chmodSync(file, 0o755);
  } catch {
    /* Windows without chmod is fine — Git still runs the hook */
  }
}
