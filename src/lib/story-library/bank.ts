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
import {
  GENERIC_ADJ_ALT,
  GENERIC_ASIDE_ALT,
  GENERIC_CLOSER,
  GENERIC_CLOSER_ALT,
  GENERIC_JOKE,
  GENERIC_JOKE_ALT,
  GENERIC_NOTICE_ALT,
  GENERIC_TITLE_ALT,
  TIER_VARIANTS,
} from './variants';

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
    const alt = TIER_VARIANTS[trait][tier];
    const stem = `${trait}-${tier}`;
    return [
      verbEntry(`${stem}-verb`, trait, tier, copy.verb),
      verbEntry(`${stem}-verb-b`, trait, tier, alt.verb),
      phrase(`${stem}-aside`, trait, tier, 'aside', copy.aside),
      phrase(`${stem}-aside-b`, trait, tier, 'aside', alt.aside),
      phrase(`${stem}-notice`, trait, tier, 'notice', noticeText(copy.noticeBit)),
      phrase(`${stem}-notice-b`, trait, tier, 'notice', noticeText(alt.noticeBit)),
      phrase(`${stem}-title`, trait, tier, 'title', copy.title),
      phrase(`${stem}-title-b`, trait, tier, 'title', alt.title),
      adjective(`${stem}-adj`, trait, tier, copy.adj),
      adjective(`${stem}-adj-b`, trait, tier, alt.adj),
      phrase(`${stem}-closer`, trait, tier, 'closer', alt.closer),
      phrase(`${stem}-closer-b`, trait, tier, 'closer', alt.closerAlt),
      phrase(`${stem}-joke`, trait, tier, 'joke', alt.joke),
      phrase(`${stem}-joke-b`, trait, tier, 'joke', alt.jokeAlt),
    ];
  });
}

export const STORY_BANK: readonly WordEntry[] = [
  ...TRAIT_AXES.flatMap(traitEntries),
  verbEntry('openness-any-glance', 'openness', 'any', ['glance', 'glances', 'glanced', 'glancing']),
  verbEntry('generic-stop', 'generic', 'any', ['stop', 'stops', 'stopped', 'stopping']),
  phrase('generic-aside', 'generic', 'any', 'aside', GENERIC_ASIDE),
  phrase('generic-aside-b', 'generic', 'any', 'aside', GENERIC_ASIDE_ALT),
  phrase('generic-notice', 'generic', 'any', 'notice', GENERIC_NOTICE),
  phrase('generic-notice-b', 'generic', 'any', 'notice', GENERIC_NOTICE_ALT),
  phrase('generic-title', 'generic', 'any', 'title', GENERIC_TITLE),
  phrase('generic-title-b', 'generic', 'any', 'title', GENERIC_TITLE_ALT),
  adjective('generic-adj', 'generic', 'any', GENERIC_ADJ),
  adjective('generic-adj-b', 'generic', 'any', GENERIC_ADJ_ALT),
  phrase('generic-closer', 'generic', 'any', 'closer', GENERIC_CLOSER),
  phrase('generic-closer-b', 'generic', 'any', 'closer', GENERIC_CLOSER_ALT),
  phrase('generic-joke', 'generic', 'any', 'joke', GENERIC_JOKE),
  phrase('generic-joke-b', 'generic', 'any', 'joke', GENERIC_JOKE_ALT),
  noun('place-chat', 'ping', 'group chat', 'none'),
  noun('place-thread', 'ping', 'unread thread', 'none'),
  noun('place-calendar', 'ping', 'shared calendar', 'none'),
  noun('find-tab', 'take-away', 'open tab', 'an'),
  // Intensity sharp: the react slot refuses this, so it is never the pick.
  verbEntry('openness-high-screech', 'openness', 'high', ['screech', 'screeches', 'screeched', 'screeching'], 'sharp'),
];
