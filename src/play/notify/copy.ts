/**
 * Divecore notice copy — Phase 5 word limits (title ≤ 3, body ≤ 10 words), pure and testable.
 *
 * Notices built from values (finds, shop names, crates) used to run to 11-20 words and the one-line
 * lane clipped them mid-word. The builders here keep the parts that matter, in priority order,
 * and `fitNotice` is the net `notify()` puts under every other call.
 */
import { NOTICE_BODY_MAX_WORDS, NOTICE_TITLE_MAX_WORDS, noticeWords, type NoticeInput } from '@/play/notify/queue';

/** The first `max` words of `text` (words as `noticeWords` counts them), nothing else changed. */
export function fitWords(text: string, max: number): string {
  const tokens = text.trim().split(/\s+/);
  let words = 0;
  const out: string[] = [];
  for (const t of tokens) {
    if (/[\p{L}\p{N}]/u.test(t)) {
      if (words === max) break;
      words += 1;
    }
    out.push(t);
  }
  return out.join(' ').replace(/[\s·—,;:-]+$/u, '');
}

/**
 * Join `parts` with " · ", most important first: a part is kept only if the whole still fits `max`
 * words; one that does not fit is skipped and a later, shorter one may still go in.
 */
export function joinParts(parts: readonly string[], max = NOTICE_BODY_MAX_WORDS): string {
  const kept: string[] = [];
  let words = 0;
  for (const p of parts) {
    const w = noticeWords(p);
    if (w === 0 || words + w > max) continue;
    kept.push(p);
    words += w;
  }
  return kept.join(' · ');
}

/** The input with its title and body cut to the limits (a no-op for copy that already fits). */
export function fitNotice<T extends Pick<NoticeInput, 'title' | 'body'>>(input: T): T {
  const title = fitWords(input.title, NOTICE_TITLE_MAX_WORDS);
  const body = input.body == null ? input.body : fitWords(input.body, NOTICE_BODY_MAX_WORDS);
  return title === input.title && body === input.body ? input : { ...input, title, body };
}

function finds(n: number): string {
  return `${n} ${n === 1 ? 'find' : 'finds'}`;
}

export type SurfaceCopyInput = {
  banked: readonly string[];
  shellsGained: number;
  free: boolean;
  /** Already shown names (street names applied). */
  swordDrop: string | null;
  netFind: string | null;
  heartyFind: string | null;
  powersToday: number;
  powersCap: number;
  powersConverted: number;
  overflowShells: number;
};

/** "Surfaced" body: finds · shells first, then a sword / net / meal, then Powers. ≤ 10 words. */
export function surfaceBody(s: SurfaceCopyInput): string {
  return joinParts([
    s.free ? 'Free dive' : s.banked.length === 0 ? 'No finds' : finds(s.banked.length),
    ...(s.shellsGained > 0 ? [`+${s.shellsGained} shells`] : []),
    ...(s.swordDrop ? [`Sword: ${s.swordDrop}`] : []),
    ...(s.netFind ? [`Net: ${s.netFind}`] : []),
    ...(s.heartyFind ? [`Meal: ${s.heartyFind}`] : []),
    ...(s.free ? [] : [`Powers ${s.powersToday}/${s.powersCap}`]),
    ...(s.powersConverted > 0 ? [`${s.powersConverted * s.overflowShells} shells extra`] : []),
  ]);
}

export type SkipCopyInput = {
  tokens: number;
  xp: number;
  waves: number;
  /** Shown item names. */
  crate: readonly string[];
  milestones: readonly { wave: number; name: string }[];
};

/** "Skipped ahead" body: pay first, then the crate, then milestones. ≤ 10 words. */
export function skipBody(s: SkipCopyInput): string {
  return joinParts([
    `+${s.tokens} tokens · +${s.xp} XP`,
    `${s.waves} ${s.waves === 1 ? 'wave' : 'waves'}`,
    ...(s.crate.length > 0 ? [`Crate: ${s.crate.join(', ')}`] : []),
    ...s.milestones.map((m) => `${m.wave}th clear: ${m.name}`),
  ]);
}

export type ShopBuyCopyInput = {
  tokensSpent: number;
  grantedName: string | null;
  diveCharges: { now: number; cap: number } | null;
  shellsInstead: number;
};

/** Shop buy body: price first, then what came with it. ≤ 10 words. */
export function shopBuyBody(s: ShopBuyCopyInput): string {
  return joinParts([
    `−${s.tokensSpent} tokens`,
    ...(s.grantedName ? [`found ${s.grantedName}`] : []),
    ...(s.diveCharges ? [`charges ${s.diveCharges.now}/${s.diveCharges.cap}`] : []),
    ...(s.shellsInstead > 0 ? [`${s.shellsInstead} shells instead`] : []),
  ]);
}
