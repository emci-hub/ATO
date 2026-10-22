/**
 * Backbones for Explore deep dives and Legends. Endings use most-specific
 * match: trait+tier beats the empty fallback, and a combo beats either trait
 * alone.
 */
import { TRAIT_AXES } from '@/lib/traits';

import { ENDING_TAIL, TRAIT_COPY, endingText } from './copy';
import type { EndingSpec, Intensity, SlotSpec, Template, Tone } from './types';

const TONES: readonly Tone[] = ['calm', 'steady', 'warm', 'dry', 'bright'];
const SOFT: readonly Intensity[] = ['soft', 'plain'];

function slot(partial: SlotSpec): SlotSpec {
  return partial;
}

const verb = (id = 'verb'): SlotSpec =>
  slot({ id, pos: 'verb', form: 'agree', frame: 'react', trait: 'dominant', tones: TONES, intensities: SOFT });

const aside = (id: string, trait: SlotSpec['trait'] = 'dominant'): SlotSpec =>
  slot({ id, pos: 'phrase', form: 'clause', frame: 'aside', trait, tones: TONES, intensities: SOFT });

const ENDINGS: EndingSpec[] = [
  ...TRAIT_AXES.flatMap((trait) =>
    (['low', 'mid', 'high'] as const).map((tier) => ({
      id: `end-${trait}-${tier}`,
      when: { trait, tier },
      text: endingText(tier, TRAIT_COPY[trait][tier].aside),
    })),
  ),
  {
    id: 'end-open-play-high',
    when: { trait: 'openness', tier: 'high', alsoTrait: 'playfulness', alsoTier: 'high' },
    text: `{Subj} took the detour and stayed for the whole evening. The grin was real, and the night was worth it. ${ENDING_TAIL}`,
  },
  {
    id: 'end-fallback',
    when: {},
    text: `The moment passes, and nothing else has to follow. ${ENDING_TAIL} What happened in the chat can stay there until tomorrow.`,
  },
];

function template(partial: Template): Template {
  return partial;
}

export const STORY_TEMPLATES: readonly Template[] = [
  template({
    id: 'dive-shows',
    kind: 'explore',
    version: 1,
    status: 'approved',
    body: '{Subj} {verb} when the group chat pings. {aside}',
    slots: [verb(), aside('aside')],
    endings: [],
  }),
  template({
    id: 'dive-mix',
    kind: 'explore',
    version: 1,
    status: 'approved',
    body: 'The {mood} lean and the stronger one share the same hour. One sets the pace, and the other decides what gets a reply.',
    slots: [slot({ id: 'mood', pos: 'adj', form: 'clause', frame: 'about', trait: 'secondary', tones: TONES, intensities: SOFT })],
    endings: [],
  }),
  template({
    id: 'dive-notice',
    kind: 'explore',
    version: 1,
    status: 'approved',
    body: '{notice}',
    slots: [slot({ id: 'notice', pos: 'phrase', form: 'clause', frame: 'notice', trait: 'dominant', tones: TONES, intensities: SOFT })],
    endings: [],
  }),
  template({
    id: 'dive-title',
    kind: 'explore',
    version: 1,
    status: 'approved',
    body: '{title}',
    slots: [slot({ id: 'title', pos: 'phrase', form: 'clause', frame: 'title', trait: 'dominant', tones: TONES, intensities: SOFT })],
    endings: [],
  }),
  template({
    id: 'dive-means',
    kind: 'explore',
    version: 1,
    status: 'approved',
    body: '{ending}',
    slots: [],
    endings: ENDINGS,
  }),
  template({
    id: 'dive-lock',
    kind: 'explore',
    version: 1,
    status: 'approved',
    body: '{Subj} {verb} when the {place} pings. What {subj} {have} in hand is {find}. The same {findBare} is still there later.',
    slots: [
      verb(),
      slot({ id: 'place', pos: 'noun', form: 'singular', frame: 'ping', trait: 'generic', tones: TONES, intensities: SOFT, article: 'none' }),
      slot({
        id: 'find',
        pos: 'noun',
        form: 'singular',
        frame: 'take-away',
        trait: 'generic',
        tones: TONES,
        intensities: SOFT,
        article: 'auto',
        lock: 'find',
      }),
      slot({
        id: 'findBare',
        pos: 'noun',
        form: 'singular',
        frame: 'take-away',
        trait: 'generic',
        tones: TONES,
        intensities: SOFT,
        article: 'none',
        lock: 'find',
      }),
    ],
    endings: [],
  }),
  template({
    id: 'dive-repeat',
    kind: 'explore',
    version: 1,
    status: 'approved',
    body: '{aside} {aside2}',
    slots: [aside('aside'), aside('aside2')],
    endings: [],
  }),
  template({
    id: 'legend-won',
    kind: 'legend',
    version: 1,
    status: 'approved',
    body: '{Subj} {verb} when {legend} is the one in the story. {aside}',
    slots: [verb(), aside('aside')],
    endings: [],
  }),
  template({
    id: 'legend-scene',
    kind: 'legend',
    version: 1,
    status: 'approved',
    body: '{Subj} sat with {legend} for one ordinary hour. {Subj} {verb} before anyone else speaks. {aside}',
    slots: [verb(), aside('aside')],
    endings: [],
  }),
  template({
    id: 'legend-differ',
    kind: 'legend',
    version: 1,
    status: 'approved',
    body: '{Subj} {verb} from another side of the same story. {aside}',
    slots: [verb(), aside('aside')],
    endings: [],
  }),
  template({
    id: 'legend-means',
    kind: 'legend',
    version: 1,
    status: 'approved',
    body: '{ending}',
    slots: [],
    endings: ENDINGS,
  }),
  template({
    id: 'legend-title',
    kind: 'legend',
    version: 1,
    status: 'approved',
    body: '{title}',
    slots: [slot({ id: 'title', pos: 'phrase', form: 'clause', frame: 'title', trait: 'dominant', tones: TONES, intensities: SOFT })],
    endings: [],
  }),
];
