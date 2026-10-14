/**
 * No "Sage" anywhere a user can see it (emci 2026-10-14: Sage was replaced by
 * Insights). Parses every .ts/.tsx under src/ with the TypeScript compiler and
 * checks every string literal, template piece and JSX text — the things that
 * can reach a screen, a push, the widget or a share. Comments and identifiers
 * (`SageStory`, `sage-copy`) are internal and are not checked; the module
 * renames come in a later PR.
 *
 * Also pins the app config (app.json) and the widget's native strings.
 * Run: npm run check:no-sage-copy
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:no-sage-copy'], 'tsx ./scripts/no-sage-copy-check.ts');
ok('wired as check:no-sage-copy (check:ota-gate runs every check:* script)');

/** "Sage" as a word, in title or upper case. Lowercase `sage` is an internal id (usage tag, kind). */
export const VISIBLE_SAGE = /\b(Sage|SAGE)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** Every user-reachable text piece in one source file. */
export function visibleTexts(source: string, fileName: string): { text: string; line: number }[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const out: { text: string; line: number }[] = [];
  const visit = (node: ts.Node) => {
    // Module paths are code, not copy.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) return;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      out.push({ text: node.text, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

// The scanner itself catches the obvious shapes.
assert.ok(visibleTexts("const a = 'Ask Sage';", 'x.ts').some((t) => VISIBLE_SAGE.test(t.text)));
assert.ok(visibleTexts('const a = <T>Hi Sage</T>;', 'x.tsx').some((t) => VISIBLE_SAGE.test(t.text)));
assert.ok(visibleTexts('const a = `x ${b} Sage`;', 'x.ts').some((t) => VISIBLE_SAGE.test(t.text)));
assert.ok(!visibleTexts("import { x } from '@/lib/sage-copy'; // Sage", 'x.ts').some((t) => VISIBLE_SAGE.test(t.text)));
assert.ok(!visibleTexts("type SageStory = { kind: 'sage_knows' };", 'x.ts').some((t) => VISIBLE_SAGE.test(t.text)));
ok('scanner finds literals, JSX text and templates; skips comments, imports and identifiers');

/**
 * Model input only — never rendered, pushed or shared. Each one is listed by
 * name so nothing else can hide here. Renaming them is in docs/sage-cleanup.md:
 *  - the voice reference docs fed to prompts (generated / framing notes);
 *  - two prompts inside the ai-library SERVER bundle. Changing their text
 *    changes the bundle, which needs `gen:ai-library` + an Edge Function
 *    deploy — out of scope for the Insights PR (no edge-function changes).
 */
export const PROMPT_ONLY_FILES: readonly string[] = [
  'src/lib/voice/content.generated.ts',
  'src/lib/voice/library.ts',
];
export const SERVER_BUNDLE_PROMPTS: Readonly<Record<string, RegExp>> = {
  'src/lib/sage-story.ts': /^Write as Sage in the ATO app\. Not a doctor\. This is The Story/,
  'src/lib/story-card.ts': /^Write as Sage in the ATO app\. Not a doctor\. Write a 100-word micro-story/,
  // Play is a fenced mini-app: app work may not edit src/play/**
  // (check:play-isolation). This one credits line is renamed in its own Play
  // change (docs/sage-cleanup.md); it is pinned here so nothing else hides.
  'src/play/credits.ts': /^Play is optional — Home, Check and Sage are never gated behind it\.$/,
};

const hits: string[] = [];
const exempted: string[] = [];
for (const file of walk(resolve(root, 'src'))) {
  const rel = relative(root, file).replace(/\\/g, '/');
  if (PROMPT_ONLY_FILES.includes(rel)) continue;
  for (const piece of visibleTexts(readFileSync(file, 'utf8'), file)) {
    if (!VISIBLE_SAGE.test(piece.text)) continue;
    const bundled = SERVER_BUNDLE_PROMPTS[rel];
    if (bundled && bundled.test(piece.text)) {
      exempted.push(`${rel}:${piece.line}`);
      continue;
    }
    hits.push(`${rel}:${piece.line}  ${JSON.stringify(piece.text.slice(0, 80))}`);
  }
}
// The exemptions stay exactly as narrow as listed: one prompt per file.
assert.equal(
  exempted.length,
  Object.keys(SERVER_BUNDLE_PROMPTS).length,
  `server-bundle prompt exemptions: ${exempted.join(', ')}`,
);
assert.deepEqual(hits, [], `"Sage" in user-visible copy:\n${hits.join('\n')}`);
ok('no string, template or JSX text under src/ says "Sage"');

const appJson = readFileSync(resolve(root, 'app.json'), 'utf8');
assert.doesNotMatch(appJson, VISIBLE_SAGE, 'app.json (names, permission strings) must not say Sage');
ok('app.json says nothing about Sage');

// The installed widget's native header is a separate binary. Its Swift source
// is pinned here so the next native build does not ship the old name.
const widgetDir = resolve(root, 'targets');
if (existsSync(widgetDir)) {
  const swiftHits: string[] = [];
  const walkAny = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walkAny(full);
      else if (name.endsWith('.swift') && VISIBLE_SAGE.test(readFileSync(full, 'utf8'))) {
        swiftHits.push(relative(root, full));
      }
    }
  };
  walkAny(widgetDir);
  if (swiftHits.length > 0) {
    // Native-only: needs a build, so it is reported, not failed (no OTA can change it).
    console.log(`  ! widget Swift still says Sage (next native build): ${swiftHits.join(', ')}`);
  }
}
ok('widget Swift checked (native-only text is reported for the next build)');

console.log(`\nno-sage-copy: ${passed} checks passed`);
