/**
 * Sample library: 2 insight backbones, 2 legend backbones (one with
 * trait-branching endings), and 3 traits × 3 tiers.
 *
 * Traits are real ATO axes. Tiers match `traitBand` (low / mid / high).
 * Every content word carries the same frame tag as the slot it is allowed to
 * fill. Generic entries exist so a missing trait still renders, and they are
 * written for the same frame so the sentence still works.
 */
import type { StoryLibrary, Template, Tier, Tone, VerbForms, WordEntry } from './types';

const TONES: Tone[] = ['calm', 'steady', 'warm', 'dry', 'bright'];
const SOFT: WordEntry['intensity'][] = ['soft', 'plain'];

function verb(
  id: string,
  trait: string,
  tier: Tier | 'any',
  forms: VerbForms,
  tone: Tone,
  intensity: WordEntry['intensity'] = 'plain',
): WordEntry {
  return {
    id,
    pos: 'verb',
    forms,
    trait,
    tier,
    frame: 'react',
    tone,
    intensity,
    status: 'approved',
  };
}

function noun(id: string, trait: string, tier: Tier | 'any', text: string, article: WordEntry['article'], frame: string): WordEntry {
  return {
    id,
    pos: 'noun',
    text,
    article,
    number: 'singular',
    trait,
    tier,
    frame,
    tone: 'calm',
    intensity: 'plain',
    status: 'approved',
  };
}

function phrase(id: string, trait: string, tier: Tier | 'any', text: string, tone: Tone): WordEntry {
  return {
    id,
    pos: 'phrase',
    text,
    trait,
    tier,
    frame: 'aside',
    tone,
    intensity: 'plain',
    status: 'approved',
  };
}

function adj(id: string, trait: string, tier: Tier | 'any', text: string, tone: Tone): WordEntry {
  return {
    id,
    pos: 'adj',
    text,
    trait,
    tier,
    frame: 'about',
    tone,
    intensity: 'plain',
    status: 'approved',
  };
}

const VERBS: WordEntry[] = [
  verb('openness-low-pause', 'openness', 'low', { base: 'pause', s: 'pauses', ed: 'paused', ing: 'pausing' }, 'calm', 'soft'),
  verb('openness-mid-check', 'openness', 'mid', { base: 'check', s: 'checks', ed: 'checked', ing: 'checking' }, 'steady'),
  verb('openness-high-dive', 'openness', 'high', { base: 'dive', s: 'dives', ed: 'dived', ing: 'diving' }, 'bright'),
  verb('steadiness-low-flinch', 'steadiness', 'low', { base: 'flinch', s: 'flinches', ed: 'flinched', ing: 'flinching' }, 'warm', 'soft'),
  verb('steadiness-mid-wait', 'steadiness', 'mid', { base: 'wait', s: 'waits', ed: 'waited', ing: 'waiting' }, 'steady'),
  verb('steadiness-high-nod', 'steadiness', 'high', { base: 'nod', s: 'nods', ed: 'nodded', ing: 'nodding' }, 'calm', 'soft'),
  verb('playfulness-low-read', 'playfulness', 'low', { base: 'read', s: 'reads', ed: 'read', ing: 'reading' }, 'dry'),
  verb('playfulness-mid-grin', 'playfulness', 'mid', { base: 'grin', s: 'grins', ed: 'grinned', ing: 'grinning' }, 'warm'),
  verb('playfulness-high-laugh', 'playfulness', 'high', { base: 'laugh', s: 'laughs', ed: 'laughed', ing: 'laughing' }, 'bright'),
  verb('generic-stop', 'generic', 'any', { base: 'stop', s: 'stops', ed: 'stopped', ing: 'stopping' }, 'calm'),
  // Compatible on frame and trait, rejected by intensity. Must never be picked.
  verb('openness-high-screech', 'openness', 'high', { base: 'screech', s: 'screeches', ed: 'screeched', ing: 'screeching' }, 'bright', 'sharp'),
];

const NOUNS: WordEntry[] = [
  noun('ping-chat', 'generic', 'any', 'group chat', 'none', 'ping'),
  noun('ping-thread', 'generic', 'any', 'unread thread', 'none', 'ping'),
  noun('ping-calendar', 'generic', 'any', 'calendar', 'none', 'ping'),
  noun('where-shop', 'generic', 'any', 'corner shop', 'none', 'where'),
  noun('where-bus', 'generic', 'any', 'waiting room', 'none', 'where'),
  noun('where-kitchen', 'generic', 'any', 'kitchen', 'none', 'where'),
  noun('where-street', 'generic', 'any', 'back room', 'none', 'where'),
  noun('openness-low-list', 'openness', 'low', 'short list', 'a', 'take-away'),
  noun('openness-mid-question', 'openness', 'mid', 'fresh question', 'a', 'take-away'),
  noun('openness-high-tab', 'openness', 'high', 'open tab', 'an', 'take-away'),
  noun('steadiness-low-plan', 'steadiness', 'low', 'loose plan', 'a', 'take-away'),
  noun('steadiness-mid-step', 'steadiness', 'mid', 'ticked step', 'a', 'take-away'),
  noun('steadiness-high-route', 'steadiness', 'high', 'saved route', 'a', 'take-away'),
  noun('playfulness-low-answer', 'playfulness', 'low', 'straight answer', 'a', 'take-away'),
  noun('playfulness-mid-joke', 'playfulness', 'mid', 'small joke', 'a', 'take-away'),
  noun('playfulness-high-plan', 'playfulness', 'high', 'wild plan', 'a', 'take-away'),
  noun('generic-thing', 'generic', 'any', 'small thing', 'a', 'take-away'),
];

const ASIDES: WordEntry[] = [
  phrase('openness-low-aside', 'openness', 'low', 'One look is enough, and the rest can wait.', 'calm'),
  phrase('openness-mid-aside', 'openness', 'mid', 'A second look decides it.', 'steady'),
  phrase('openness-high-aside', 'openness', 'high', 'The untried option gets the first look.', 'bright'),
  phrase('steadiness-low-aside', 'steadiness', 'low', 'The wobble shows, and it is allowed to.', 'warm'),
  phrase('steadiness-mid-aside', 'steadiness', 'mid', 'The pace does not change for this.', 'steady'),
  phrase('steadiness-high-aside', 'steadiness', 'high', 'It passes, and the next step is the same one.', 'calm'),
  phrase('playfulness-low-aside', 'playfulness', 'low', 'The point lands before any joke does.', 'dry'),
  phrase('playfulness-mid-aside', 'playfulness', 'mid', 'There is a smile in it, and the point still lands.', 'warm'),
  phrase('playfulness-high-aside', 'playfulness', 'high', 'A joke comes with it, and the point still lands.', 'bright'),
  phrase('generic-aside', 'generic', 'any', 'Nothing else needs a decision tonight.', 'calm'),
];

const ADJECTIVES: WordEntry[] = [
  adj('openness-low-careful', 'openness', 'low', 'careful', 'calm'),
  adj('openness-mid-curious', 'openness', 'mid', 'curious', 'steady'),
  adj('openness-high-restless', 'openness', 'high', 'restless', 'bright'),
  adj('steadiness-low-uneasy', 'steadiness', 'low', 'uneasy', 'warm'),
  adj('steadiness-mid-settled', 'steadiness', 'mid', 'settled', 'steady'),
  adj('steadiness-high-steady', 'steadiness', 'high', 'steady', 'calm'),
  adj('playfulness-low-serious', 'playfulness', 'low', 'serious', 'dry'),
  adj('playfulness-mid-amused', 'playfulness', 'mid', 'amused', 'warm'),
  adj('playfulness-high-delighted', 'playfulness', 'high', 'delighted', 'bright'),
  adj('generic-quiet', 'generic', 'any', 'quiet', 'calm'),
];

const reactSlot = {
  id: 'verb',
  pos: 'verb' as const,
  form: 'agree' as const,
  frame: 'react',
  trait: 'dominant' as const,
  tones: TONES,
  intensities: SOFT,
};

const asideSlot = {
  id: 'aside',
  pos: 'phrase' as const,
  form: 'clause' as const,
  frame: 'aside',
  trait: 'dominant' as const,
  tones: TONES,
  intensities: SOFT,
};

const pingSlot = {
  id: 'place',
  pos: 'noun' as const,
  form: 'singular' as const,
  frame: 'ping',
  trait: 'generic' as const,
  tones: TONES,
  intensities: SOFT,
  article: 'none' as const,
};

const whereSlot = {
  id: 'where',
  pos: 'noun' as const,
  form: 'singular' as const,
  frame: 'where',
  trait: 'generic' as const,
  tones: TONES,
  intensities: SOFT,
  article: 'none' as const,
};

const findSlot = {
  id: 'find',
  pos: 'noun' as const,
  form: 'singular' as const,
  frame: 'take-away',
  trait: 'dominant' as const,
  tones: TONES,
  intensities: SOFT,
  article: 'auto' as const,
  lock: 'find',
};

const findBareSlot = {
  ...findSlot,
  id: 'findBare',
  article: 'none' as const,
};

const adjSlot = {
  id: 'mood',
  pos: 'adj' as const,
  form: 'clause' as const,
  frame: 'about',
  trait: 'secondary' as const,
  tones: TONES,
  intensities: SOFT,
};

const branchEndings: Template['endings'] = [
  { id: 'enough', when: {}, text: 'The night stays small, and that is enough.' },
  { id: 'open-high', when: { trait: 'openness', tier: 'high' }, text: 'The next street is already on {poss} mind.' },
  { id: 'open-low', when: { trait: 'openness', tier: 'low' }, text: 'The known street is enough for tonight.' },
  { id: 'steady-high', when: { trait: 'steadiness', tier: 'high' }, text: 'The same step is still the plan.' },
  { id: 'steady-low', when: { trait: 'steadiness', tier: 'low' }, text: 'The day can wobble. {Subj} {be} still here after it.' },
  { id: 'play-high', when: { trait: 'playfulness', tier: 'high' }, text: 'The joke gets there before the explanation does.' },
  { id: 'play-low', when: { trait: 'playfulness', tier: 'low' }, text: 'The job is finished, then one small smile.' },
  {
    id: 'open-play-high',
    when: { trait: 'openness', tier: 'high', alsoTrait: 'playfulness', alsoTier: 'high' },
    text: 'The detour takes the whole evening, and {poss} grin says the night was worth it.',
  },
];

export const TEMPLATES: Template[] = [
  {
    id: 'insight-ping',
    kind: 'insight',
    version: 1,
    status: 'approved',
    body: '{Subj} {verb} when the {place} pings. {aside}',
    slots: [reactSlot, pingSlot, asideSlot],
    endings: [],
  },
  {
    id: 'insight-keep',
    kind: 'insight',
    version: 1,
    status: 'approved',
    body: '{Subj} {verb} when the {place} pings. {aside} What {subj} {have} in hand is {find}. The same {findBare} is still there later.',
    slots: [reactSlot, pingSlot, asideSlot, findSlot, findBareSlot],
    endings: [],
  },
  {
    id: 'legend-room',
    kind: 'legend',
    version: 1,
    status: 'approved',
    body: '{Name} {beName} in the {where}. {Subj} {verb} before anyone else speaks. {aside}',
    slots: [whereSlot, reactSlot, asideSlot],
    endings: [],
  },
  {
    id: 'legend-detour',
    kind: 'legend',
    version: 1,
    status: 'approved',
    body: '{Name} {beName} in the {where}. {Subj} {verb} before anyone else speaks. {aside} {Subj} {be} {mood} about {find}.\n{ending}',
    slots: [whereSlot, reactSlot, asideSlot, adjSlot, findSlot],
    endings: branchEndings,
  },
];

export const ENTRIES: WordEntry[] = [...VERBS, ...NOUNS, ...ASIDES, ...ADJECTIVES];

export const LIBRARY: StoryLibrary = {
  version: 'storylib-0',
  templates: TEMPLATES,
  entries: ENTRIES,
};

export const SAMPLE_TRAITS = ['openness', 'steadiness', 'playfulness'] as const;
export const SAMPLE_TIERS: readonly Tier[] = ['low', 'mid', 'high'];
