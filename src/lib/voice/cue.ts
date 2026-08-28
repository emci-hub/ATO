/**
 * Morning-cue grammar for "After you {cue}".
 * Stored chips are infinitive ("make coffee"). Older/dev strings sometimes
 * used a gerund ("making coffee") which produced "After you making coffee".
 */
const GERUND_HEAD: Record<string, string> = {
  making: 'make',
  brushing: 'brush',
  checking: 'check',
  getting: 'get',
  putting: 'put',
  pouring: 'pour',
  taking: 'take',
};

export function cueAfterYou(cue: string): string {
  const trimmed = cue.trim();
  const match = trimmed.match(/^(\S+)(\s[\s\S]*)?$/);
  if (!match) return trimmed;
  const mapped = GERUND_HEAD[match[1].toLowerCase()];
  if (!mapped) return trimmed;
  return `${mapped}${match[2] ?? ''}`;
}
