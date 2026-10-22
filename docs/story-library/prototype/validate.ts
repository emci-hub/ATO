/**
 * Shipping gate. Renders every approved template against every trait, tier,
 * and pronoun, plus a secondary-trait pass on the branching legend.
 * Fails on leftover slots, type holes, agreement, articles, and banned words.
 */
import { fill, PRONOUNS, compatible } from './fill';
import { ENTRIES, LIBRARY, SAMPLE_TIERS, SAMPLE_TRAITS, TEMPLATES } from './library';
import type { FillResult, PronounSet, Reader, Template, Tier } from './types';

export interface RenderCase {
  template: Template;
  reader: Reader;
  seed: string;
  result: FillResult;
}

export interface ValidationReport {
  cases: RenderCase[];
  failures: RenderCase[];
  notes: string[];
}

function reader(trait: string, tier: Tier, pronoun: PronounSet, secondary?: Reader['secondary']): Reader {
  return { name: 'Alex', pronoun, dominant: { trait, tier }, secondary };
}

function seedFor(templateId: string, who: Reader): string {
  const second = who.secondary ? `${who.secondary.trait}:${who.secondary.tier}` : '-';
  return `${templateId}|${who.dominant.trait}|${who.dominant.tier}|${who.pronoun.id}|${second}`;
}

export function matrixCases(): { template: Template; reader: Reader; seed: string }[] {
  const out: { template: Template; reader: Reader; seed: string }[] = [];
  const pronouns = Object.values(PRONOUNS);
  for (const template of TEMPLATES) {
    for (const trait of SAMPLE_TRAITS) {
      for (const tier of SAMPLE_TIERS) {
        for (const pronoun of pronouns) {
          const who = reader(trait, tier, pronoun);
          out.push({ template, reader: who, seed: seedFor(template.id, who) });
        }
      }
    }
  }
  const branching = TEMPLATES.find((template) => template.id === 'legend-detour')!;
  for (const trait of SAMPLE_TRAITS) {
    for (const tier of SAMPLE_TIERS) {
      for (const other of SAMPLE_TRAITS) {
        if (other === trait) continue;
        for (const otherTier of SAMPLE_TIERS) {
          for (const pronoun of pronouns) {
            const who = reader(trait, tier, pronoun, { trait: other, tier: otherTier });
            out.push({ template: branching, reader: who, seed: seedFor(branching.id, who) });
          }
        }
      }
    }
  }
  return out;
}

export function validateLibrary(): ValidationReport {
  const notes: string[] = [];
  const cases: RenderCase[] = [];
  for (const row of matrixCases()) {
    const result = fill(row.template, row.reader, ENTRIES, row.seed, { requireApproved: true });
    cases.push({ ...row, result });
  }

  const screech = cases.filter((row) => Object.values(row.result.picks).includes('openness-high-screech'));
  if (screech.length > 0) notes.push('sharp decoy was picked');

  const verbSlot = TEMPLATES[0]!.slots[0]!;
  const noun = ENTRIES.find((entry) => entry.id === 'openness-high-tab')!;
  const sampleReader = reader('openness', 'high', PRONOUNS.she);
  if (compatible(noun, verbSlot, sampleReader)) notes.push('noun was compatible with a verb slot');

  for (const entry of ENTRIES) {
    if (entry.pos !== 'verb') continue;
    for (const form of ['base', 's', 'ed', 'ing'] as const) {
      if (!entry.forms?.[form]?.trim()) notes.push(`${entry.id} missing ${form}`);
    }
  }

  const draft = fill(
    { ...TEMPLATES[0]!, status: 'draft' },
    sampleReader,
    ENTRIES,
    'draft-check',
    { requireApproved: true },
  );
  if (!draft.issues.some((issue) => issue.code === 'unapproved')) notes.push('draft template was allowed to ship');

  const avoided = fill(TEMPLATES[0]!, reader('openness', 'low', PRONOUNS.they), ENTRIES, 'avoid-check', {
    avoid: ['openness-low-pause'],
    requireApproved: true,
  });
  if (avoided.picks.verb !== 'generic-stop') notes.push(`no-repeat did not fall back to generic (got ${avoided.picks.verb})`);
  if (avoided.issues.length > 0) notes.push('generic fallback rendered with issues');

  const combo = fill(
    TEMPLATES.find((template) => template.id === 'legend-detour')!,
    reader('openness', 'high', PRONOUNS.they, { trait: 'playfulness', tier: 'high' }),
    ENTRIES,
    'combo-check',
    { requireApproved: true },
  );
  if (combo.endingId !== 'open-play-high') notes.push(`combo ending lost (got ${combo.endingId})`);

  const mid = fill(
    TEMPLATES.find((template) => template.id === 'legend-detour')!,
    reader('steadiness', 'mid', PRONOUNS.she),
    ENTRIES,
    'mid-check',
    { requireApproved: true },
  );
  if (mid.endingId !== 'enough') notes.push(`mid tier did not use the fallback ending (got ${mid.endingId})`);

  const locked = fill(TEMPLATES.find((template) => template.id === 'insight-keep')!, sampleReader, ENTRIES, 'lock-check', {
    requireApproved: true,
  });
  if (locked.picks.find !== locked.picks.findBare) notes.push('locked noun changed mid-story');
  if (!/an open tab/.test(locked.text) || !/same open tab/.test(locked.text)) notes.push('article or bare noun lock failed');
  if (!/She dives when/.test(locked.text) || !/she has in hand/.test(locked.text)) notes.push('she agreement failed on the lock story');

  const failures = cases.filter((row) => row.result.issues.length > 0);
  if (LIBRARY.version !== 'storylib-0') notes.push('unexpected library version');

  return { cases, failures, notes };
}
