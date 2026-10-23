/**
 * Trait word bank. Lookup is trait+tier, then trait+any, then generic.
 * A sharp-intensity decoy sits on the openness-high verb frame and must
 * never be picked: slots ask for soft or plain.
 */
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import {
  GENERIC_ADJ,
  GENERIC_ASIDE,
  GENERIC_NOTICE,
  GENERIC_TITLE,
  TRAIT_COPY,
  noticeText,
} from './copy';
import type { Tier, WordEntry } from './types';

const TIERS: readonly Tier[] = ['low', 'mid', 'high'];

function verbEntry(id: string, trait: string, tier: Tier | 'any', forms: readonly [string, string, string, string], intensity: WordEntry['intensity'] = 'plain'): WordEntry {
  return {
    id,
    pos: 'verb',
    forms: { base: forms[0], s: forms[1], ed: forms[2], ing: forms[3] },
    trait,
    tier,
    frame: 'react',
    tone: 'calm',
    intensity,
    status: 'approved',
  };
}

function phrase(id: string, trait: string, tier: Tier | 'any', frame: string, text: string): WordEntry {
  return {
    id,
    pos: 'phrase',
    text,
    trait,
    tier,
    frame,
    tone: 'calm',
    intensity: 'plain',
    status: 'approved',
  };
}

function adjective(id: string, trait: string, tier: Tier | 'any', text: string): WordEntry {
  return {
    id,
    pos: 'adj',
    text,
    trait,
    tier,
    frame: 'about',
    tone: 'warm',
    intensity: 'soft',
    status: 'approved',
  };
}

function noun(id: string, frame: string, text: string, article: WordEntry['article']): WordEntry {
  return {
    id,
    pos: 'noun',
    text,
    trait: 'generic',
    tier: 'any',
    frame,
    tone: 'calm',
    intensity: 'plain',
    article,
    number: 'singular',
    status: 'approved',
  };
}

function traitEntries(trait: TraitAxis): WordEntry[] {
  return TIERS.flatMap((tier) => {
    const copy = TRAIT_COPY[trait][tier];
    const stem = `${trait}-${tier}`;
    return [
      verbEntry(`${stem}-verb`, trait, tier, copy.verb),
      phrase(`${stem}-aside`, trait, tier, 'aside', copy.aside),
      phrase(`${stem}-notice`, trait, tier, 'notice', noticeText(copy.noticeBit)),
      phrase(`${stem}-title`, trait, tier, 'title', copy.title),
      adjective(`${stem}-adj`, trait, tier, copy.adj),
    ];
  });
}

export const STORY_BANK: readonly WordEntry[] = [
  ...TRAIT_AXES.flatMap(traitEntries),
  verbEntry('openness-any-glance', 'openness', 'any', ['glance', 'glances', 'glanced', 'glancing']),
  verbEntry('generic-stop', 'generic', 'any', ['stop', 'stops', 'stopped', 'stopping']),
  phrase('generic-aside', 'generic', 'any', 'aside', GENERIC_ASIDE),
  phrase('generic-notice', 'generic', 'any', 'notice', GENERIC_NOTICE),
  phrase('generic-title', 'generic', 'any', 'title', GENERIC_TITLE),
  adjective('generic-adj', 'generic', 'any', GENERIC_ADJ),
  noun('place-chat', 'ping', 'group chat', 'none'),
  noun('place-thread', 'ping', 'unread thread', 'none'),
  noun('place-calendar', 'ping', 'shared calendar', 'none'),
  noun('find-tab', 'take-away', 'open tab', 'an'),
  // Intensity sharp: the react slot refuses this, so it is never the pick.
  verbEntry('openness-high-screech', 'openness', 'high', ['screech', 'screeches', 'screeched', 'screeching'], 'sharp'),
];
