import { parseSageKnowsState } from '@/lib/sage-knows';
import type { SageKnowsState } from '@/lib/sage-knows';
import type { CheckHistory } from '@/lib/voice/types';

import type { QuestionGrounding } from './types';

export function pickQuestionGrounding(
  me: { sage_knows: SageKnowsState | unknown; facts?: string[] | null },
  history: CheckHistory[],
): QuestionGrounding {
  const done = [...history].reverse().filter((row) => row.status === 'done');
  const withDo = done.find((row) => typeof row.do === 'string' && row.do.trim());
  if (withDo?.do) return { kind: 'do', detail: withDo.do.trim() };

  const withRead = done.find((row) => typeof row.read === 'string' && row.read.trim());
  if (withRead?.read) return { kind: 'read', detail: withRead.read.trim() };

  const knows = parseSageKnowsState(me.sage_knows);
  if (knows.scenario_last_axis) {
    return { kind: 'pattern', detail: 'a recent gut-call pick' };
  }

  const fact = (me.facts ?? []).map((row) => row.trim()).find((row) => row.length > 0);
  if (fact) return { kind: 'fact', detail: fact };

  return { kind: 'none', detail: null };
}
