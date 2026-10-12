/**
 * Shared PLAY_SHEETS loader for check scripts. After art:pack, rects live in
 * assets/art/legacy-play-sheets.json; this pretty-prints them so existing
 * `"sheets/…": {` substring scans keep working.
 */
import fs from 'node:fs';
import path from 'node:path';

export type LegacySheet = {
  sheet: string;
  sheetW: number;
  sheetH: number;
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  sourceW?: number;
  sourceH?: number;
  offsetX?: number;
  offsetY?: number;
  ms?: number;
  dirs?: string[];
  tier?: string;
};

export function loadPlaySheets(repo: string): Record<string, LegacySheet> {
  const legacy = path.join(repo, 'assets/art/legacy-play-sheets.json');
  if (fs.existsSync(legacy)) {
    return JSON.parse(fs.readFileSync(legacy, 'utf8')) as Record<string, LegacySheet>;
  }
  const sheetsSrc = fs.readFileSync(path.join(repo, 'src/play/generated-play-sheets.ts'), 'utf8');
  const start = sheetsSrc.indexOf('{', sheetsSrc.indexOf('PLAY_SHEETS:'));
  const end = sheetsSrc.indexOf(' as const;');
  if (start === -1 || end === -1) return {};
  return JSON.parse(sheetsSrc.slice(start, end)) as Record<string, LegacySheet>;
}

/** Pretty JSON so checks can still slice on newline + 2-space `"sheets/`. */
export function playSheetsSearchText(repo: string): string {
  return JSON.stringify(loadPlaySheets(repo), null, 2);
}

export function resolvePlaySource(
  repo: string,
  kind: 'hero' | 'creep' | 'boss' | 'tower',
  slug: string,
  theme: 'cast' | 'streetwear',
): string {
  for (const gen of ['picked', 'migrated']) {
    const d = path.join(repo, 'art-src/pixellab', `${kind}.${slug}.${theme}`, gen, 'raw');
    if (fs.existsSync(d)) return d;
  }
  const group = kind === 'hero' ? 'heroes' : kind === 'creep' ? 'creeps' : kind === 'boss' ? 'boss' : 'towers';
  return path.join(repo, 'assets/play/skins', theme, group, slug);
}
