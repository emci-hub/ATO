#!/usr/bin/env node
/**
 * Pre-commit: if staged files touch the art library or code that references
 * art, run `npm run art:sync` and stage the generated result.
 *
 * Git for Windows runs hooks through bash; this file is plain Node so the
 * skip path works on PowerShell/cmd/cloud agents without tsx.
 * Set ART_SYNC_SKIP=1 to bypass.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.env.ART_SYNC_SKIP === '1') process.exit(0);

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(repo);

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { encoding: 'utf8' })
  .split('\0')
  .map((p) => p.replace(/\\/g, '/'))
  .filter(Boolean);

if (staged.length === 0) process.exit(0);

const PATH_HIT = /^(assets\/art\/|art-src\/|src\/art\/|scripts\/art-|scripts\/check-art-|tools\/art-viewer\/)/;
const CODE_HIT = /getArt\s*\(|getArtSource\s*\(|findArt\s*\(|@\/assets\/art\/|ART_SOURCES/;

function stagedText(rel) {
  try {
    return execFileSync('git', ['show', `:${rel}`], { encoding: 'utf8', maxBuffer: 8 * 1048576 });
  } catch {
    const abs = path.join(repo, rel);
    return fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : '';
  }
}

const needed = staged.some((rel) => {
  if (PATH_HIT.test(rel)) return true;
  if (!/\.(ts|tsx|js|jsx|json)$/.test(rel)) return false;
  return CODE_HIT.test(stagedText(rel));
});

if (!needed) process.exit(0);

console.log('art:sync — staged files touch the art library; regenerating…');
execFileSync('npm', ['run', 'art:sync'], {
  cwd: repo,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const add = [
  'assets/art/registry.json',
  'src/art/generated-art.ts',
  'assets/art/ART_LIBRARY.md',
  'assets/art/_contact',
  'tools/art-viewer/README.md',
  'assets/art/legacy-play-sheets.json',
  'src/play/generated-play-sheets.ts',
  'assets/play/sheets',
];
execFileSync('git', ['add', '--', ...add.filter((p) => fs.existsSync(path.join(repo, p)))], { cwd: repo });
console.log('art:sync — generated files staged.');
