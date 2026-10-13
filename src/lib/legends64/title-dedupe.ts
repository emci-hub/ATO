import {
  CORE_ROLES,
  LEGENDARY_POLE,
  LEGENDARY_TITLES,
  LEGEND_SKINS,
  MODIFIER_DESCRIPTORS,
  THIRD_WORDS,
  type LegendSkin,
} from '@/lib/legends64/archetypes';
import { POLE_COMBOS } from '@/lib/legends64/classify';

/**
 * Strict title-bank checker, ported from the v5 reference
 * (`title-dedupe-check.py`). Same stemming, hyphen split, compound heads,
 * synonym clusters, trait-word ban, and 2–4 word / 34-char limits.
 */

const STOP = new Set(['the', 'who', 'of', 'to', 'or', 'a', 'an', 'and', 'every']);
const HEADS = [
  'master',
  'keeper',
  'maker',
  'runner',
  'crafter',
  'walker',
  'leader',
  'giver',
  'starter',
  'worm',
  'body',
] as const;

export const TITLE_TRAIT_WORDS: readonly string[] = `
curiosity follow-through sociability harmony composure reassurance space directness compromise independence confidence connection growth ownership self-belief playfulness
familiar adventurous flexible structured reserved outgoing frank easygoing sensitive steady trusting watchful close private quiet direct steadfast giving guided self-directed cautious assured self-contained connected settled learning accepting accountable hesitant bold serious playful agreeable
`.trim().split(/\s+/);

export const TITLE_SYNONYM_CLUSTERS: Readonly<Record<string, ReadonlySet<string>>> = {
  chief: new Set([
    'chief',
    'chieftain',
    'executive',
    'figurehead',
    'leader',
    'lead',
    'head',
    'boss',
    'captain',
    'director',
    'president',
    'chair',
    'officer',
    'manager',
    'guildmaster',
  ]),
  ruler: new Set(['sovereign', 'tyrant', 'overlord', 'king', 'queen', 'emperor', 'lord', 'kingpin']),
  loner: new Set([
    'hermit',
    'recluse',
    'exile',
    'ronin',
    'ranger',
    'drifter',
    'lone',
    'wolf',
    'homebody',
    'wanderer',
    'loner',
    'nomad',
  ]),
  calm: new Set([
    'stoic',
    'unfazed',
    'cool',
    'chill',
    'calm',
    'unbothered',
    'shrugs',
    'laid-back',
    'deadpan',
  ]),
  warm: new Set([
    'warm',
    'tender',
    'kind',
    'gentle',
    'soft',
    'sweet',
    'heart',
    'hearted',
    'cuddly',
    'big-hearted',
  ]),
};

export function stemTitleWord(word: string): string {
  const w = word.toLowerCase().replace(/'s$/, '');
  for (const suf of ['ings', 'ing', 'ers', 'er', 'ed', 'es', 's', 'ist', 'ian', 'y']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  return w;
}

export function titleTokens(phrase: string): string[] {
  const out: string[] = [];
  for (const part of phrase.toLowerCase().split(/[\s\-]+/)) {
    if (!part || STOP.has(part)) continue;
    out.push(part);
    for (const head of HEADS) {
      if (part.endsWith(head) && part !== head) {
        out.push(part.slice(0, -head.length), head);
      }
    }
  }
  return out;
}

function traitHit(phrase: string): boolean {
  const toks = titleTokens(phrase);
  if (TITLE_TRAIT_WORDS.includes(phrase.toLowerCase())) return true;
  return toks.some((tok) => TITLE_TRAIT_WORDS.some((trait) => stemTitleWord(trait) === stemTitleWord(tok)));
}

function wordCount(name: string): number {
  return name.replace(/,/g, '').split(/\s+/).filter(Boolean).length;
}

type Slot = 'desc' | 'role' | 'third';

function bankFor(skin: LegendSkin): Partial<Record<Slot, readonly string[]>> {
  const desc = POLE_COMBOS.map((code) => MODIFIER_DESCRIPTORS[skin][code]);
  const role = POLE_COMBOS.map((code) => CORE_ROLES[skin][code]);
  const thirds = THIRD_WORDS[skin];
  const third = thirds ? POLE_COMBOS.map((code) => thirds[code]) : undefined;
  return third ? { desc, role, third } : { desc, role };
}

function recordStems(occ: Map<string, string[]>, phrase: string, where: string): void {
  const stems = new Set(titleTokens(phrase).map(stemTitleWord));
  for (const stem of stems) {
    const list = occ.get(stem) ?? [];
    list.push(`${where}=${phrase}`);
    occ.set(stem, list);
  }
}

/**
 * Bank-level errors: duplicate stems, same-code synonym clusters, trait words,
 * and any combo over 34 characters or outside 2–4 words.
 */
export function collectTitleBankErrors(): string[] {
  const errs: string[] = [];
  const occ = new Map<string, string[]>();

  for (const skin of LEGEND_SKINS) {
    const slots = bankFor(skin);
    for (const [slot, words] of Object.entries(slots) as [Slot, readonly string[]][]) {
      if (words.length !== 8) errs.push(`${skin}.${slot} has ${words.length} words`);
      for (let i = 0; i < words.length; i++) {
        const code = POLE_COMBOS[i]!;
        const word = words[i]!;
        recordStems(occ, word, `${skin}.${slot}.${code}`);
        if (traitHit(word)) errs.push(`TRAIT WORD: ${skin}.${slot}.${code}=${word}`);
      }
    }
  }

  for (const skin of LEGEND_SKINS) {
    const title = LEGENDARY_TITLES[skin];
    const pole = LEGENDARY_POLE[skin];
    recordStems(occ, title, `LEGENDARY.${skin}.${pole}`);
    if (traitHit(title)) errs.push(`TRAIT WORD: legendary ${title}`);
    if (title.length > 34 || wordCount(title) < 2 || wordCount(title) > 4) {
      errs.push(`LENGTH legendary '${title}'`);
    }
  }

  for (const [stem, places] of [...occ.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (stem.length > 2 && places.length > 1) {
      errs.push(`DUP '${stem}': ${places.join(' | ')}`);
    }
  }

  for (const slot of ['desc', 'role', 'third'] as const) {
    for (let i = 0; i < POLE_COMBOS.length; i++) {
      const code = POLE_COMBOS[i]!;
      for (const [cluster, members] of Object.entries(TITLE_SYNONYM_CLUSTERS)) {
        const hits: string[] = [];
        for (const skin of LEGEND_SKINS) {
          const words = bankFor(skin)[slot];
          if (!words) continue;
          const word = words[i]!;
          const toks = [...titleTokens(word), word.toLowerCase()];
          if (toks.some((tok) => members.has(tok))) hits.push(`${skin}=${word}`);
        }
        if (hits.length > 1) errs.push(`CLUSTER ${cluster} on ${slot}.${code}: ${hits.join(', ')}`);
      }
    }
  }

  return errs;
}

function clusterHits(phrase: string): string[] {
  const toks = [...titleTokens(phrase), phrase.toLowerCase()];
  return Object.entries(TITLE_SYNONYM_CLUSTERS)
    .filter(([, members]) => toks.some((tok) => members.has(tok)))
    .map(([name]) => name);
}

export interface TitledSkin {
  skin: LegendSkin;
  title: string;
}

/**
 * Deterministic picker safety net. Walks styles in `LEGEND_SKINS` order and
 * keeps the first title that claimed a stem or synonym cluster. A later
 * collision is a no-op on v5 (the banks already have unique tokens); the
 * hook is here so a future alt-word table can swap without changing call
 * sites. Same input always yields the same list.
 */
export function dedupeTitles<T extends TitledSkin>(rows: readonly T[]): T[] {
  const seenStems = new Set<string>();
  const seenClusters = new Set<string>();
  return rows.map((row) => {
    const stems = titleTokens(row.title)
      .map(stemTitleWord)
      .filter((stem) => stem.length > 2);
    const clusters = clusterHits(row.title);
    const collides =
      stems.some((stem) => seenStems.has(stem)) || clusters.some((name) => seenClusters.has(name));
    if (!collides) {
      for (const stem of stems) seenStems.add(stem);
      for (const name of clusters) seenClusters.add(name);
    }
    return row;
  });
}
