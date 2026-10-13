/**
 * Tracery-style expander (syntax from Kate Compton / Apache-2.0; see
 * docs/story/NOTICE-tracery.txt). Extensions: filter by categoryId + setting
 * + lean, compatibility tags, and `{=slot}` / `[key:value]` reuse.
 */
import { fnv1a } from '@/lib/daily-line/bank';
import type { CategoryId } from '@/lib/categories';
import type { StoryAngle } from '@/lib/ai-library/story';
import type { TraitLean } from '@/lib/traits';

import type { GrammarEntry, StoryGrammar } from './types';

export interface ExpandContext {
  categoryId: CategoryId;
  setting: StoryAngle;
  lean: TraitLean;
  seed: string;
  room?: string;
}

function asEntries(symbol: StoryGrammar[string] | undefined): GrammarEntry[] {
  if (symbol == null) return [];
  if (typeof symbol === 'string') return [{ text: symbol }];
  return [...symbol].map((row) => (typeof row === 'string' ? { text: row } : row));
}

function compatible(entry: GrammarEntry, ctx: ExpandContext, state: Record<string, string>): boolean {
  if (entry.keys?.categoryId && entry.keys.categoryId !== ctx.categoryId) return false;
  if (entry.keys?.setting && entry.keys.setting !== ctx.setting) return false;
  if (entry.keys?.lean && entry.keys.lean !== ctx.lean) return false;
  if (entry.tags?.settings && !entry.tags.settings.includes(ctx.setting)) return false;
  const room = state.room ?? ctx.room;
  if (room && entry.tags?.rooms && !entry.tags.rooms.includes(room)) return false;
  return true;
}

function applyMods(text: string, mods: string[], entry: GrammarEntry | undefined): string {
  let out = text;
  for (const mod of mods) {
    if (mod === 'cap') out = out.charAt(0).toUpperCase() + out.slice(1);
    else if (mod === 'a' || mod === 'the') {
      const article = entry?.gram?.article ?? (mod === 'the' ? 'the' : /^[aeiou]/i.test(out) ? 'an' : 'a');
      out = article === 'none' ? out : `${article} ${out}`;
    }
    else if (mod === 'it') out = entry?.gram?.pronoun ?? 'it';
    else if (mod === 's') out = entry?.gram?.plural ? out : `${out}s`;
  }
  return out;
}

function keyedName(name: string, ctx: ExpandContext): string {
  return `${name}__${ctx.categoryId}__${ctx.lean}`;
}

export function expandGrammar(grammar: StoryGrammar, start: string, ctx: ExpandContext): { text: string; state: Record<string, string> } {
  const state: Record<string, string> = ctx.room ? { room: ctx.room } : {};
  let counter = 0;

  const pick = (name: string): { text: string; entry?: GrammarEntry } => {
    const keyed = asEntries(grammar[keyedName(name, ctx)]);
    const plain = asEntries(grammar[name]);
    const pool = (keyed.length > 0 ? keyed : plain).filter((row) => compatible(row, ctx, state));
    if (pool.length === 0) return { text: '' };
    const index = fnv1a(`${ctx.seed}|${name}|${counter}`) % pool.length;
    counter += 1;
    return { text: pool[index]!.text, entry: pool[index] };
  };

  const expandOnce = (raw: string, depth: number): string => {
    if (depth > 20) return raw;
    let out = raw.replace(/\[([a-zA-Z]+):([^\]]+)\]/g, (_m, key: string, value: string) => {
      state[key] = value;
      return '';
    });
    out = out.replace(/\{lean:([^|]+)\|([^}]+)\}/g, (_m, high: string, low: string) =>
      ctx.lean === 'high' ? high : low,
    );
    out = out.replace(/\{=([a-zA-Z]+)\}/g, (_m, key: string) => state[key] ?? '');
    out = out.replace(/#([a-zA-Z]+)((?:\.[a-z]+)*)#/g, (_m, name: string, modStr: string) => {
      if (state[name]) return applyMods(state[name], modStr ? modStr.slice(1).split('.') : [], undefined);
      const picked = pick(name);
      const expanded = expandOnce(picked.text, depth + 1);
      const first = expanded.split('\n')[0] ?? expanded;
      if (!state[name] && first) state[name] = first.replace(/\.$/, '');
      return applyMods(expanded, modStr ? modStr.slice(1).split('.') : [], picked.entry);
    });
    return out;
  };

  return { text: expandOnce(start, 0).replace(/[ \t]{2,}/g, ' ').trim(), state };
}
