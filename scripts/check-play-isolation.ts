/**
 * Play isolation check — the Play ⇄ app fence.
 *
 * Fails when one changeset mixes Play game paths with non-Play app paths — the
 * exact "AI edited the game while fixing the app" failure this fence exists to
 * prevent. A commit is EITHER Play work OR app work, never both.
 *
 * Classification (a file matches the FIRST pattern group that accepts it):
 *   PLAY    — src/play/**, assets/play/**, games/grove/**,
 *             scripts/{check-heroes,check-creeps,check-towers,play-art-prep}.ts
 *   APP     — src/** (except src/play/** and the allowlist), assets/** (except
 *             assets/play/**), supabase/**, docs/**
 *   NEUTRAL — the allowlist (src/app/play.tsx shell, the LF-only library.md,
 *             PROJECT_CONTEXT.md / AGENTS.md / CLAUDE.md, .cursor/**,
 *             .gitattributes, package.json, scripts/ota-gate.ts, this script)
 *             and anything not otherwise classified (root config, dotfiles).
 *
 * The changeset checked, in order:
 *   1. the working changeset (staged + unstaged + untracked) via `git status
 *      --porcelain` — what a `git add -A && git commit` captures right now;
 *   2. else the unpushed commits vs origin/<branch> (three-dot);
 *   3. else the most recent commit (HEAD~1..HEAD).
 *
 * Run: npm run check:play-isolation  (wired into check:ota-gate automatically —
 * ota-gate runs every `check:*` script not in its EXCLUDED set).
 */
import { execSync } from 'node:child_process';

const PLAY: RegExp[] = [
  /^src\/play\//,
  /^assets\/play\//,
  /^games\/grove\//,
  /^scripts\/check-heroes\.ts$/,
  /^scripts\/check-creeps\.ts$/,
  /^scripts\/check-towers\.ts$/,
  /^scripts\/play-art-prep\.ts$/,
  /^scripts\/play-art-pack\.ts$/,
];

const NEUTRAL: RegExp[] = [
  /^src\/app\/play\.ts$/,           // Play shell mount (allowed in either)
  /^src\/app\/copy\/library\.md$/,  // LF-only fix (the one allowed app-copy touch)
  /^PROJECT_CONTEXT\.md$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^\.cursor\//,                    // this rule + docs-commit-push
  /^\.claude\//,
  /^\.gitattributes$/,              // LF normalization
  /^package\.json$/,                // script wiring (check:play-isolation)
  /^scripts\/ota-gate\.ts$/,
  /^scripts\/check-play-isolation\.ts$/, // itself
  /^\.gitignore$/,
  /^\.expo\//,
  /^\.vscode\//,
];

const APP: RegExp[] = [
  /^src\//,
  /^assets\//,
  /^supabase\//,
  /^docs\//,
];

function classify(file: string): 'play' | 'app' | 'neutral' {
  if (PLAY.some((re) => re.test(file))) return 'play';
  if (NEUTRAL.some((re) => re.test(file))) return 'neutral';
  if (APP.some((re) => re.test(file))) return 'app';
  return 'neutral';
}

function gitLines(command: string): string[] {
  try {
    const out = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/** Normalize a path from `git status --porcelain` ("XY path" or "XY old -> new"). */
function parsePorcelainLine(line: string): string {
  const afterStatus = line.slice(3).trim();
  const arrow = afterStatus.lastIndexOf(' -> ');
  const target = arrow >= 0 ? afterStatus.slice(arrow + 4) : afterStatus;
  return target.replace(/\\/g, '/');
}

function changedFiles(): string[] {
  // 1. The working changeset — staged + unstaged + untracked. This is what a
  //    single commit (`git add -A`) would sweep, so it is the right scope to
  //    hold to "one commit = one domain".
  const porcelain = gitLines('git status --porcelain');
  if (porcelain.length > 0) return porcelain.map(parsePorcelainLine).filter(Boolean);

  // 2. Clean tree → the unpushed commits vs origin (branch names are safe to
  //    interpolate here; a missing origin ref just errors into []).
  const branch = gitLines('git rev-parse --abbrev-ref HEAD')[0];
  if (branch && branch !== 'HEAD') {
    const vsOrigin = gitLines(`git diff --name-only origin/${branch}...HEAD`);
    if (vsOrigin.length > 0) return vsOrigin.map((p) => p.replace(/\\/g, '/'));
  }

  // 3. Fallback: the most recent commit.
  return gitLines('git diff --name-only HEAD~1 HEAD').map((p) => p.replace(/\\/g, '/'));
}

const files = changedFiles();

if (files.length === 0) {
  console.log('  ✓ play isolation: nothing to classify (clean tree, no unpushed commits)');
  process.exit(0);
}

const play = files.filter((file) => classify(file) === 'play');
const app = files.filter((file) => classify(file) === 'app');
const neutral = files.length - play.length - app.length;

if (play.length > 0 && app.length > 0) {
  console.error('play-isolation: FAIL — this changeset mixes Play and app files.');
  console.error('  A commit must be EITHER Play work OR app work, never both.');
  console.error(`  Play files (${play.length}):`);
  for (const file of play) console.error(`    ${file}`);
  console.error(`  App files (${app.length}):`);
  for (const file of app) console.error(`    ${file}`);
  console.error('  See .cursor/rules/play-isolation.mdc — split into two commits.');
  process.exit(1);
}

console.log(
  `  ✓ play isolation: ${files.length} file(s) — ${play.length} play, ${app.length} app, ` +
    `${neutral} neutral — no mixing`,
);
