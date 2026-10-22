/**
 * Starter wording for the Story Library. One row per trait per tier, including
 * mid. Verbs are stored in all four forms (never auto-suffixed). Asides are
 * full sentences with no pronoun, so they agree for you / they / she / he.
 */
import type { TraitAxis } from '@/lib/traits';

import type { Tier } from './types';

export interface TraitTierCopy {
  /** base, -s, -ed, -ing. Written out. "You {base} when the group chat pings." */
  verb: readonly [string, string, string, string];
  aside: string;
  /** One word after "The {adj} lean". */
  adj: string;
  /** Lowercase, starts with "the", two to four words. */
  title: string;
  /** Two to four words starting with "the", inside the notice sentence. */
  noticeBit: string;
}

const row = (
  verb: readonly [string, string, string, string],
  aside: string,
  adj: string,
  title: string,
  noticeBit: string,
): TraitTierCopy => ({ verb, aside, adj, title, noticeBit });

export const TRAIT_COPY: Record<TraitAxis, Record<Tier, TraitTierCopy>> = {
  openness: {
    low: row(
      ['pause', 'pauses', 'paused', 'pausing'],
      'One look is enough, and the rest can wait.',
      'cautious',
      'the careful reader',
      'the usual reply',
    ),
    mid: row(
      ['check', 'checks', 'checked', 'checking'],
      'The thread gets a fair look, then the phone goes down.',
      'curious',
      'the fair looker',
      'the fair look',
    ),
    high: row(
      ['dive', 'dives', 'dived', 'diving'],
      'The untried option gets the first look.',
      'eager',
      'the first diver',
      'the new reply',
    ),
  },
  conscientiousness: {
    low: row(
      ['skim', 'skims', 'skimmed', 'skimming'],
      'The list can wait until the chat is quiet.',
      'loose',
      'the loose planner',
      'the loose skim',
    ),
    mid: row(
      ['list', 'lists', 'listed', 'listing'],
      'The thread is noted, then set aside for later.',
      'orderly',
      'the steady finisher',
      'the short list',
    ),
    high: row(
      ['finish', 'finishes', 'finished', 'finishing'],
      'The last item gets ticked before the phone goes down.',
      'exact',
      'the exact closer',
      'the ticked list',
    ),
  },
  extraversion: {
    low: row(
      ['wave', 'waves', 'waved', 'waving'],
      'A small wave is plenty, and the room can stay quiet.',
      'quiet',
      'the quiet waver',
      'the small wave',
    ),
    mid: row(
      ['reply', 'replies', 'replied', 'replying'],
      'The reply goes out, then the chat can carry on.',
      'sociable',
      'the fair replier',
      'the sent reply',
    ),
    high: row(
      ['call', 'calls', 'called', 'calling'],
      'The voice note goes first, before the thread cools.',
      'outgoing',
      'the first caller',
      'the voice note',
    ),
  },
  agreeableness: {
    low: row(
      ['hedge', 'hedges', 'hedged', 'hedging'],
      'The frank line stays, and the chat can handle it.',
      'frank',
      'the frank friend',
      'the frank line',
    ),
    mid: row(
      ['nod', 'nods', 'nodded', 'nodding'],
      'A nod is enough, and the plan can stand.',
      'warm',
      'the warm nodder',
      'the small nod',
    ),
    high: row(
      ['yield', 'yields', 'yielded', 'yielding'],
      'The other plan gets the yes, and the hour stays easy.',
      'easy',
      'the easy friend',
      'the easy yes',
    ),
  },
  steadiness: {
    low: row(
      ['flinch', 'flinches', 'flinched', 'flinching'],
      'The wobble shows, and it is allowed to.',
      'shaky',
      'the soft reader',
      'the small wobble',
    ),
    mid: row(
      ['wait', 'waits', 'waited', 'waiting'],
      'The night stays small, and that is enough.',
      'settled',
      'the calm waiter',
      'the quiet wait',
    ),
    high: row(
      ['nod', 'nods', 'nodded', 'nodding'],
      'The moment lands, and the rest of the hour holds.',
      'calm',
      'the steady friend',
      'the steady nod',
    ),
  },
  attachment_anxiety: {
    low: row(
      ['reread', 'rereads', 'reread', 'rereading'],
      'The old message can stay unread a little longer.',
      'loose',
      'the loose reader',
      'the unread ping',
    ),
    mid: row(
      ['watch', 'watches', 'watched', 'watching'],
      'The thread is watched once, then the phone goes down.',
      'watchful',
      'the fair watcher',
      'the single check',
    ),
    high: row(
      ['hover', 'hovers', 'hovered', 'hovering'],
      'The chat stays open until someone answers.',
      'close',
      'the close reader',
      'the open chat',
    ),
  },
  attachment_avoidance: {
    low: row(
      ['skim', 'skims', 'skimmed', 'skimming'],
      'The thread is skimmed, and the reply can come later.',
      'near',
      'the near friend',
      'the light skim',
    ),
    mid: row(
      ['leave', 'leaves', 'left', 'leaving'],
      'The chat is left open, with no rush to answer.',
      'distant',
      'the fair leaver',
      'the open door',
    ),
    high: row(
      ['close', 'closes', 'closed', 'closing'],
      'The thread is closed, and the hour stays private.',
      'private',
      'the private reader',
      'the closed thread',
    ),
  },
  conflict_assertiveness: {
    low: row(
      ['hedge', 'hedges', 'hedged', 'hedging'],
      'The soft line goes first, and the point still lands.',
      'soft',
      'the soft speaker',
      'the soft line',
    ),
    mid: row(
      ['name', 'names', 'named', 'naming'],
      'The point gets named once, then the chat moves on.',
      'plain',
      'the plain speaker',
      'the named point',
    ),
    high: row(
      ['push', 'pushes', 'pushed', 'pushing'],
      'The point stays on the table until it is heard.',
      'direct',
      'the direct friend',
      'the direct point',
    ),
  },
  conflict_cooperativeness: {
    low: row(
      ['ease', 'eases', 'eased', 'easing'],
      'The rough edge is eased, and the plan can wait.',
      'firm',
      'the firm friend',
      'the eased edge',
    ),
    mid: row(
      ['offer', 'offers', 'offered', 'offering'],
      'A middle option is offered, and either yes can stand.',
      'fair',
      'the fair helper',
      'the middle offer',
    ),
    high: row(
      ['bend', 'bends', 'bent', 'bending'],
      'The plan bends so both people can stay in it.',
      'flexible',
      'the flexible friend',
      'the bent plan',
    ),
  },
  autonomy: {
    low: row(
      ['follow', 'follows', 'followed', 'following'],
      'The group plan is followed, and that is the hour.',
      'guided',
      'the guided friend',
      'the group plan',
    ),
    mid: row(
      ['choose', 'chooses', 'chose', 'choosing'],
      'One option is chosen, and the rest can wait.',
      'choosing',
      'the fair chooser',
      'the chosen option',
    ),
    high: row(
      ['decide', 'decides', 'decided', 'deciding'],
      'The call is made here, before the thread votes.',
      'independent',
      'the self chooser',
      'the local call',
    ),
  },
  competence: {
    low: row(
      ['doubt', 'doubts', 'doubted', 'doubting'],
      'The first try is small, and that still counts.',
      'unsure',
      'the soft starter',
      'the small try',
    ),
    mid: row(
      ['try', 'tries', 'tried', 'trying'],
      'The try happens once, then the result can sit.',
      'trying',
      'the fair trier',
      'the single try',
    ),
    high: row(
      ['trust', 'trusts', 'trusted', 'trusting'],
      'The work is trusted, and the chat does not have to grade it.',
      'sure',
      'the sure closer',
      'the trusted bit',
    ),
  },
  relatedness: {
    low: row(
      ['miss', 'misses', 'missed', 'missing'],
      'The quiet is noticed, and the reply can come later.',
      'apart',
      'the apart friend',
      'the quiet gap',
    ),
    mid: row(
      ['text', 'texts', 'texted', 'texting'],
      'A short text goes out, and the thread can rest.',
      'warm',
      'the warm texter',
      'the short text',
    ),
    high: row(
      ['stay', 'stays', 'stayed', 'staying'],
      'The chat stays open, and nobody has to perform.',
      'close',
      'the close friend',
      'the staying chat',
    ),
  },
  growth_mindset: {
    low: row(
      ['stall', 'stalls', 'stalled', 'stalling'],
      'The stuck spot is named, and the hour can stay there.',
      'stuck',
      'the still starter',
      'the stuck spot',
    ),
    mid: row(
      ['practice', 'practices', 'practiced', 'practicing'],
      'One pass is enough practice for this hour.',
      'practicing',
      'the fair student',
      'the single pass',
    ),
    high: row(
      ['retry', 'retries', 'retried', 'retrying'],
      'The next try starts before the thread goes cold.',
      'learning',
      'the next learner',
      'the next try',
    ),
  },
  locus_of_control: {
    low: row(
      ['wait', 'waits', 'waited', 'waiting'],
      'The hour is waited out, and the chat can move first.',
      'waiting',
      'the still waiter',
      'the waited hour',
    ),
    mid: row(
      ['steer', 'steers', 'steered', 'steering'],
      'The thread is steered a little, then left alone.',
      'steering',
      'the fair steerer',
      'the small steer',
    ),
    high: row(
      ['claim', 'claims', 'claimed', 'claiming'],
      'The outcome is claimed, including the messy part.',
      'accountable',
      'the clear owner',
      'the claimed bit',
    ),
  },
  self_efficacy: {
    low: row(
      ['hesitate', 'hesitates', 'hesitated', 'hesitating'],
      'The pause is real, and the start can still be small.',
      'hesitant',
      'the quiet starter',
      'the real pause',
    ),
    mid: row(
      ['start', 'starts', 'started', 'starting'],
      'The start is small, and that is the whole move.',
      'starting',
      'the fair beginner',
      'the small start',
    ),
    high: row(
      ['handle', 'handles', 'handled', 'handling'],
      'The hard bit is handled, then the phone goes down.',
      'bold',
      'the bold handler',
      'the handled bit',
    ),
  },
  playfulness: {
    low: row(
      ['read', 'reads', 'read', 'reading'],
      'The joke is read, and the reply can stay plain.',
      'serious',
      'the serious reader',
      'the plain reply',
    ),
    mid: row(
      ['grin', 'grins', 'grinned', 'grinning'],
      'The grin shows, and the chat can stay light.',
      'amused',
      'the amused friend',
      'the small grin',
    ),
    high: row(
      ['laugh', 'laughs', 'laughed', 'laughing'],
      'The laugh goes first, and the night can take the detour.',
      'playful',
      'the playful friend',
      'the first laugh',
    ),
  },
};

export const GENERIC_ASIDE = 'The moment passes, and nothing else has to follow.';
export const GENERIC_NOTICE = 'A friend sees the moment pass, and the chat keeps moving anyway.';
export const GENERIC_TITLE = 'the quiet reader';
export const GENERIC_ADJ = 'steady';

export const TIER_LEAD: Record<Tier, string> = {
  low: '{Subj} kept to the familiar choice.',
  mid: '{Subj} left it after one fair look.',
  high: '{Subj} stayed with the new option.',
};

export const ENDING_TAIL = 'The day does not need a speech about it.';

export function noticeText(bit: string): string {
  return `A friend sees ${bit}, and the chat keeps moving anyway.`;
}

export function endingText(tier: Tier, aside: string): string {
  return `${TIER_LEAD[tier]} ${aside} ${ENDING_TAIL}`;
}
