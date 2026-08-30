/**
 * One weekly Ask. Picks at most one of sage-knows / ranking / scenario.
 * Pure: no writes. The week is claimed by the existing record* paths.
 */

import { localYmd } from '@/lib/local-date';
import { resolveRanking, type RankingPrompt } from '@/lib/ranking';
import {
  resolveSageKnows,
  sageKnowsWeekKey,
  weekSlotTaken,
  type SageKnowsPrompt,
  type SageKnowsState,
} from '@/lib/sage-knows';
import { resolveScenario, type ScenarioPrompt } from '@/lib/scenario';
import type { TraitTouched, TraitValues } from '@/lib/traits';
import type { CheckHistory } from '@/lib/voice/types';

export type AskPick =
  | { kind: 'sage_knows'; prompt: SageKnowsPrompt }
  | { kind: 'ranking'; prompt: RankingPrompt }
  | { kind: 'scenario'; prompt: ScenarioPrompt };

export type ResolveAskInput = {
  values: TraitValues;
  touched: TraitTouched;
  knows: SageKnowsState;
  knocksYouOff: string;
  facts: string[];
  history: CheckHistory[];
  now: Date;
  timeZone: string;
};

export function resolveAsk(input: ResolveAskInput): AskPick | null {
  const weekKey = sageKnowsWeekKey(localYmd(input.now, input.timeZone));
  if (weekSlotTaken(input.knows, weekKey)) return null;

  const sageKnows = resolveSageKnows({
    values: input.values,
    touched: input.touched,
    knows: input.knows,
    knocksYouOff: input.knocksYouOff,
    facts: input.facts,
    history: input.history,
    now: input.now,
    timeZone: input.timeZone,
  });
  if (sageKnows) return { kind: 'sage_knows', prompt: sageKnows };

  const ranking = resolveRanking({
    values: input.values,
    knows: input.knows,
    now: input.now,
    timeZone: input.timeZone,
  });
  if (ranking) return { kind: 'ranking', prompt: ranking };

  const scenario = resolveScenario({
    values: input.values,
    knows: input.knows,
    now: input.now,
    timeZone: input.timeZone,
  });
  if (scenario) return { kind: 'scenario', prompt: scenario };

  return null;
}
