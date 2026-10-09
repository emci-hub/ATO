/**
 * Shared library — the ONE entry the `ai-library` Edge Function loads.
 *
 * `scripts/gen-ai-library-bundle.ts` bundles this file (and everything it
 * imports: the prompts, the checks, the stored copy and the legend entries)
 * into `supabase/functions/_shared/ai-library.bundle.js`, so the server builds
 * and checks cards with exactly the app's code. `check:ai-library` fails when
 * the committed bundle is out of date.
 */
import { DEEP_DIVE_LIBRARY } from './deep-dive';
import { LEGEND_LIBRARY } from './legend';
import { STORY_LIBRARY } from './story';
import { BUCKET_KEY_RE, LIBRARY_VERSION, isLibraryKind, type LibraryKind } from './types';

export { BUCKET_KEY_RE, LIBRARY_VERSION, isLibraryKind };
export type { LibraryKind };

const KINDS = {
  deep_dive: DEEP_DIVE_LIBRARY,
  story: STORY_LIBRARY,
  legend: LEGEND_LIBRARY,
} as const;

/** One call's plan: the prompt for the angles to write, or why the key is refused. */
export function planLibraryCall(
  kind: string,
  key: string,
  /** How many cards each angle already has in this bucket (least-written first). */
  angleCounts: Readonly<Record<string, number>>,
  /** Fewer cards than the kind's usual (the one-card retry). */
  maxCards?: number,
): { ok: true; angles: string[]; prompt: string; maxOutputTokens: number } | { ok: false; reason: string } {
  if (!isLibraryKind(kind)) return { ok: false, reason: 'kind' };
  if (!BUCKET_KEY_RE.test(key)) return { ok: false, reason: 'bucket' };
  const lib = KINDS[kind] as (typeof KINDS)[LibraryKind];
  const spec = (lib.parseBucket as (k: string) => unknown)(key);
  if (spec == null) return { ok: false, reason: 'bucket' };
  const all = (lib.angles as (s: unknown) => readonly string[])(spec);
  const angles = [...all]
    .map((angle, index) => ({ angle, index, n: angleCounts[angle] ?? 0 }))
    .sort((a, b) => a.n - b.n || a.index - b.index)
    .slice(0, Math.max(1, Math.min(lib.cardsPerCall, maxCards ?? lib.cardsPerCall)))
    .map((row) => row.angle);
  const built = (lib.buildPrompt as (s: unknown, a: readonly string[]) => { prompt: string; maxOutputTokens: number })(spec, angles);
  return { ok: true, angles, ...built };
}

/** The model's answer, checked with the app's own rules. Only passing cards come back. */
export function checkLibraryAnswer(
  kind: LibraryKind,
  key: string,
  angles: readonly string[],
  raw: string,
): { cards: { angle: string; card: unknown }[]; reason: string | null } {
  const lib = KINDS[kind];
  const spec = (lib.parseBucket as (k: string) => unknown)(key);
  if (spec == null) return { cards: [], reason: 'bucket' };
  return (lib.parse as (r: string, s: unknown, a: readonly string[]) => { cards: { angle: string; card: unknown }[]; reason: string | null })(
    raw,
    spec,
    angles,
  );
}
