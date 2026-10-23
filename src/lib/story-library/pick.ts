/**
 * Salience picker. The highest-priority eligible line wins. A line already
 * shown is skipped until every eligible line (including the broad fallback)
 * has been used. On a card, a shape already used loses to another eligible
 * line so each spoken shape appears once.
 */
import type { LineSlot, PronounSet, StoryLine } from './types';
import { sentenceShape, type SentenceShape } from '@/lib/voice/player-copy';

import { unseenOrReset } from './shown';

export interface PickContext {
  slot: LineSlot;
  trait: string;
  tier: StoryLine['tier'];
  pronoun: PronounSet;
  name: string;
  seed: string;
  shown: ReadonlySet<string>;
  usedShapes: ReadonlySet<SentenceShape>;
  preferShape?: SentenceShape;
  answer?: string;
  recent?: boolean;
  legend?: string;
  legendId?: string;
  alsoTrait?: string;
  alsoTier?: StoryLine['tier'];
  requireApproved?: boolean;
}

const SHOWS_SHAPES: readonly SentenceShape[] = ['when', 'compound', 'then'];

export function preferredShape(slot: LineSlot, index: number): SentenceShape {
  if (slot === 'shows' || slot === 'legend-won') return SHOWS_SHAPES[index] ?? 'when';
  if (slot === 'mix' || slot === 'legend-differ') return 'because';
  if (slot === 'notice' || slot === 'legend-scene') return 'other';
  if (slot === 'means' || slot === 'legend-means') return 'question';
  if (slot === 'joke' || slot === 'legend-joke') return 'punch';
  return 'punch';
}

/** Names, pronouns, the legend, and the player's own answer. Nothing else. */
export function speak(
  text: string,
  pronoun: PronounSet,
  name: string,
  extras: { legend?: string; answer?: string } = {},
): string {
  const who = pronoun.id === 'you' ? pronoun.subjCap : name;
  return text
    .replaceAll('{Name}', who)
    .replaceAll('{Subj}', pronoun.subjCap)
    .replaceAll('{subj}', pronoun.subj)
    .replaceAll('{legend}', extras.legend ?? '')
    .replaceAll('{answer}', extras.answer ?? '');
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function eligible(line: StoryLine, ctx: PickContext): boolean {
  if (line.slot !== ctx.slot) return false;
  if (ctx.requireApproved !== false && line.status !== 'approved') return false;
  if (line.trait !== 'any' && line.trait !== ctx.trait) return false;
  if (line.tier !== 'any' && line.tier !== ctx.tier) return false;
  if (line.alsoTrait && line.alsoTrait !== ctx.alsoTrait) return false;
  if (line.alsoTier && line.alsoTier !== ctx.alsoTier) return false;
  if (line.legendId && line.legendId !== ctx.legendId) return false;
  if (line.recency === 'recent' && !ctx.recent) return false;
  const answer = ctx.answer?.trim() ?? '';
  if (line.answerIncludes) {
    if (!answer.toLowerCase().includes(line.answerIncludes.toLowerCase())) return false;
  } else if (line.requiresAnswer && !answer) return false;
  return true;
}

export function lineShape(line: StoryLine, ctx: PickContext): SentenceShape {
  return sentenceShape(speak(line.text, ctx.pronoun, ctx.name, { legend: ctx.legend, answer: ctx.answer }));
}

/**
 * Highest priority among eligible lines. Shown ids drop out until the pool
 * is used up. Within a priority band, the card's preferred free shape wins.
 */
export function pickLine(lines: readonly StoryLine[], ctx: PickContext): StoryLine | null {
  const pool = lines.filter((line) => eligible(line, ctx));
  if (pool.length === 0) return null;
  const fresh = unseenOrReset(pool, ctx.shown);
  const free = fresh.filter((line) => !ctx.usedShapes.has(lineShape(line, ctx)));
  const usable = free.length > 0 ? free : fresh;
  const top = Math.max(...usable.map((line) => line.priority));
  const band = usable.filter((line) => line.priority === top);
  const shaped = ctx.preferShape ? band.filter((line) => lineShape(line, ctx) === ctx.preferShape) : [];
  const choice = (shaped.length > 0 ? shaped : band).slice().sort((a, b) => {
    const delta = hash(`${ctx.seed}|${a.id}`) - hash(`${ctx.seed}|${b.id}`);
    return delta !== 0 ? delta : a.id < b.id ? -1 : 1;
  });
  return choice[0] ?? null;
}
