/**
 * The report-digest email text (wave113). Pure, no imports: the Edge Function sends it and
 * check:circle-safety runs it on Node. Counts, ids and kind only — never a reason, message
 * text, handle or reporter. Null = nothing new, so no email.
 */
export type Digest = {
  hours: number;
  reports: { id: string; kind: 'message' | 'person' }[];
  card_reports: { card_id: string }[];
  open_total: number;
};

export const DIGEST_TO = 'support@emgens.com';

export function digestText(d: Digest): { subject: string; text: string } | null {
  const n = d.reports.length + d.card_reports.length;
  if (n === 0) return null;
  const lines = [
    `${n} new report${n === 1 ? '' : 's'} in the last ${d.hours} hours. The promise is a response within 24 hours.`,
    '',
    ...d.reports.map((r) => `- ${r.kind === 'message' ? 'chat message' : 'person'} report ${r.id}`),
    ...d.card_reports.map((c) => `- shared card report, card ${c.card_id}`),
    '',
    `Open person/chat reports in total: ${d.open_total}.`,
    'Details: run the daily report query in docs/circle-safety.md.',
  ];
  return { subject: `ATO: ${n} new report${n === 1 ? '' : 's'}`, text: lines.join('\n') };
}
