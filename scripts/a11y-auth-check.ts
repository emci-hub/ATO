/**
 * Accessibility check for the sign-in / sign-up / onboarding screens.
 * Run: npx tsx scripts/a11y-auth-check.ts
 *
 * Every <Pressable and <TextInput JSX element in these files must carry an
 * accessibilityLabel, so a screen reader names every control. Includes a
 * pass/fail pair on synthetic snippets so the parser itself is pinned.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'src/app/auth/index.tsx',
  'src/app/auth/login.tsx',
  'src/app/onboarding.tsx',
  'src/components/auth-otp-code.tsx',
];

/** Returns the opening tags of every Pressable/TextInput that lacks accessibilityLabel. */
export function unlabelledControls(source: string): string[] {
  const bad: string[] = [];
  const re = /<(Pressable|TextInput)\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    // Walk to the end of the opening tag: the first `>` outside braces/quotes.
    let depth = 0;
    let quote: string | null = null;
    let i = match.index + match[0].length;
    for (; i < source.length; i += 1) {
      const ch = source[i]!;
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (depth === 0 && (ch === '"' || ch === "'")) quote = ch;
      else if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0 && source[i - 1] !== '=') break;
    }
    const tag = source.slice(match.index, i + 1);
    if (!/\baccessibilityLabel\s*=/.test(tag)) {
      const line = source.slice(0, match.index).split('\n').length;
      bad.push(`line ${line}: <${match[1]}> has no accessibilityLabel`);
    }
  }
  return bad;
}

// Parser pairs.
assert.equal(
  unlabelledControls('<Pressable onPress={() => go()} style={({ pressed }) => [a, pressed && b]}>x</Pressable>').length,
  1,
);
assert.equal(unlabelledControls('<TextInput value={v} placeholder="Email" />').length, 1);
assert.equal(
  unlabelledControls(
    '<Pressable onPress={() => go()} accessibilityLabel="Go" style={({ pressed }) => [a]}>x</Pressable>',
  ).length,
  0,
);
assert.equal(unlabelledControls('<TextInput value={v} accessibilityLabel="Email" />').length, 0);

let failures = 0;
for (const rel of FILES) {
  const bad = unlabelledControls(readFileSync(resolve(__dirname, '..', rel), 'utf8'));
  for (const message of bad) {
    failures += 1;
    console.error(`  ✗ ${rel} ${message}`);
  }
}
assert.equal(failures, 0, `${failures} control(s) without an accessibilityLabel`);
console.log(`a11y-auth: every Pressable and TextInput in ${FILES.length} files is labelled`);
