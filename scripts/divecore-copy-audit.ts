/**
 * Divecore copy audit — every player-facing string in src/play (+ the src/app/play.tsx
 * shell), with file, line and word count. Static: parses the TypeScript, never runs it.
 *
 * Run: npx tsx ./scripts/divecore-copy-audit.ts            → top 20 longest + totals
 *      npx tsx ./scripts/divecore-copy-audit.ts --json     → every string as JSON
 *      npx tsx ./scripts/divecore-copy-audit.ts --top 50   → top N
 *
 * `extractPlayCopy()` is shared with check:divecore-copy (word limits).
 *
 * What counts as player-facing copy:
 *  - JSX text children (`<Text>Feed me</Text>`).
 *  - String / template literals in copy attributes (label, title, body, accessibilityLabel…).
 *  - String / template literals in copy object properties (title, body, tip, why, button…),
 *    e.g. TUTORIAL_STEPS, Guide pages, coach lines, banner calls.
 *  - String / template literals returned from a JSX `{…}` child expression.
 * Template holes count as one word each (`${n} finds` = 2 words). Dev-only files
 * (dev-*, *-lab-screen, tune-panel, layout-shot) are skipped: no player sees them.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type CopyKind = 'jsx-text' | 'attr' | 'prop' | 'jsx-expr';

export type CopyString = {
  file: string;
  line: number;
  kind: CopyKind;
  /** The attribute / property name (label, title, body…), or '' for JSX text. */
  key: string;
  text: string;
  words: number;
};

const repo = path.resolve(__dirname, '..');

/** Attribute names whose string value a player reads or hears. */
export const COPY_ATTRS = new Set([
  'label',
  'title',
  'body',
  'subtitle',
  'sub',
  'hint',
  'caption',
  'message',
  'text',
  'tip',
  'placeholder',
  'emptyText',
  'accessibilityLabel',
  'accessibilityHint',
]);

/** Object-literal property names that carry copy. */
export const COPY_PROPS = new Set([
  ...COPY_ATTRS,
  'why',
  'button',
  'line',
  'lines',
  'bullet',
  'bullets',
  'says',
  'say',
  'empty',
  'heading',
  'blurb',
  'desc',
  'description',
]);

/** Dev / lab files — no player ever sees them. */
export const DEV_FILE = /(^|\/)(dev-[^/]*|[^/]*-lab-screen|tune-panel|layout-shot|pet-dev-[^/]*|dev-fx-stress)\.tsx?$/;

/** Looks like an id / key / path, not prose (no space, no capital, no punctuation a sentence has). */
function looksLikeId(text: string): boolean {
  return /^[a-z0-9_\-./:@#%]+$/.test(text) || /^[A-Z0-9_]+$/.test(text);
}

export function countWords(text: string): number {
  const t = text.replace(/\{x\}/g, ' x ').trim();
  if (!t) return 0;
  // A word is a run with at least one letter or digit; "·", "—", "›" don't count.
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function templateText(node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral): string {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  let out = node.head.text;
  for (const span of node.templateSpans) out += `{x}${span.literal.text}`;
  return out;
}

/** The literal strings an expression can evaluate to (ternaries, ||, ??, parens). */
function literalStrings(expr: ts.Expression): ts.Node[] {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr) || ts.isTemplateExpression(expr)) return [expr];
  if (ts.isParenthesizedExpression(expr)) return literalStrings(expr.expression);
  if (ts.isConditionalExpression(expr)) return [...literalStrings(expr.whenTrue), ...literalStrings(expr.whenFalse)];
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return [...literalStrings(expr.left), ...literalStrings(expr.right)];
    }
    if (op === ts.SyntaxKind.PlusToken) return [...literalStrings(expr.left), ...literalStrings(expr.right)];
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return literalStrings(expr.right);
  }
  return [];
}

function nodeText(node: ts.Node): string {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) return templateText(node);
  return '';
}

function propName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return '';
}

/** Every player-facing string in one source file. */
export function extractFromSource(rel: string, source: string): CopyString[] {
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: CopyString[] = [];
  const push = (node: ts.Node, kind: CopyKind, key: string, raw: string) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text || !/[\p{L}]/u.test(text) || looksLikeId(text)) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push({ file: rel, line, kind, key, text, words: countWords(text) });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      push(node, 'jsx-text', '', node.text);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (COPY_ATTRS.has(name)) {
        const init = node.initializer;
        if (ts.isStringLiteral(init)) push(init, 'attr', name, init.text);
        else if (ts.isJsxExpression(init) && init.expression) {
          for (const lit of literalStrings(init.expression)) push(lit, 'attr', name, nodeText(lit));
        }
      }
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const lit of literalStrings(node.expression)) push(lit, 'jsx-expr', '', nodeText(lit));
    } else if (ts.isPropertyAssignment(node)) {
      const name = propName(node.name);
      if (COPY_PROPS.has(name)) {
        const init = node.initializer;
        if (ts.isArrayLiteralExpression(init)) {
          for (const el of init.elements) for (const lit of literalStrings(el)) push(lit, 'prop', name, nodeText(lit));
        } else {
          for (const lit of literalStrings(init)) push(lit, 'prop', name, nodeText(lit));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function walk(dir: string, files: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) files.push(full);
  }
}

/** Every player-facing string in src/play/** and src/app/play.tsx (dev files skipped). */
export function extractPlayCopy(): CopyString[] {
  const files: string[] = [];
  walk(path.join(repo, 'src/play'), files);
  files.push(path.join(repo, 'src/app/play.tsx'));
  const out: CopyString[] = [];
  for (const full of files) {
    const rel = path.relative(repo, full).replace(/\\/g, '/');
    if (DEV_FILE.test(rel) || /generated/.test(rel)) continue;
    out.push(...extractFromSource(rel, fs.readFileSync(full, 'utf8')));
  }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const all = extractPlayCopy();
  if (args.includes('--json')) {
    console.log(JSON.stringify(all, null, 2));
  } else {
    const topIdx = args.indexOf('--top');
    const top = topIdx >= 0 ? Number(args[topIdx + 1]) || 20 : 20;
    const sorted = [...all].sort((a, b) => b.words - a.words);
    const total = all.reduce((n, s) => n + s.words, 0);
    console.log(`Divecore copy audit — ${all.length} strings, ${total} words, ${new Set(all.map((s) => s.file)).size} files\n`);
    console.log('| # | Words | File:line | Key | Text |');
    console.log('|---|---|---|---|---|');
    sorted.slice(0, top).forEach((s, i) => {
      const text = s.text.length > 140 ? `${s.text.slice(0, 137)}…` : s.text;
      console.log(`| ${i + 1} | ${s.words} | ${s.file}:${s.line} | ${s.key || s.kind} | ${text.replace(/\|/g, '\\|')} |`);
    });
  }
}
