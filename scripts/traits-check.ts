/**
 * Stage 11 optional fast-entry — unit checks for the five done-bar items.
 * Run: npm run check:traits
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { writeForOptionalScreen } from '../src/lib/traits';
import { voiceMeFrom } from '../src/lib/intake';
import {
  EXTRA_AXES,
  GRID_AXES,
  SLIDER_AXES,
  TRAIT_AXES,
  emptyTraitState,
  isDirectTraitSource,
  mergeTraitWrite,
  optionalProgressLabel,
  traitPatch,
  traitPromptLines,
  traitsFromClosePattern,
  traitsFromDisagree,
  traitsFromTypeCode,
} from '../src/lib/traits';
import { filterCard } from '../src/lib/voice/filters';
import {
  containsFrameworkTerm,
  FACT_FRAMEWORK_MESSAGE,
  matchingFrameworkTerms,
  sanitizeFacts,
} from '../src/lib/voice/framework-fence';
import { resolveNudge } from '../src/lib/voice/nudge';
import { buildPrompt } from '../src/lib/voice/providers/prompt';
import { routeVoiceCard } from '../src/lib/voice/router';
import { buildVoiceConfig } from '../src/lib/voice/config';
import type { VoiceProvider } from '../src/lib/voice/providers/types';
import type { VoiceMe } from '../src/lib/voice/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const BANNED = [
  'MBTI',
  'Myers-Briggs',
  '16Personalities',
  'Big Five',
  'OCEAN',
  'neuroticism',
  'INFJ',
  'attachment style',
  'TKI',
  'Thomas-Kilmann',
  'growth mindset',
  'fixed mindset',
  'locus of control',
  'self-efficacy',
  'self-determination',
];

function meBase(over: Partial<VoiceMe> = {}): VoiceMe {
  return {
    name: 'Trait Check',
    show_up: 'building something',
    talk_style: 'even',
    knocks_you_off: 'sleep',
    morning_cue: 'make coffee',
    ...over,
  };
}

async function main() {
  const inferred = traitsFromTypeCode('ENFP');
  assert.ok(inferred.extraversion != null && inferred.extraversion > 0.5);
  assert.ok(inferred.openness != null && inferred.openness > 0.5);
  assert.equal(inferred.steadiness, undefined);
  ok('16-grid writes O/C/E/A only, never steadiness');

  const close = traitsFromClosePattern('worry_pull_away');
  assert.equal(close.openness, undefined);
  assert.equal(close.extraversion, undefined);
  assert.equal(close.steadiness, undefined);
  assert.ok((close.attachment_anxiety ?? 0) > 0.5);
  ok('close-pattern tap writes anxiety/avoidance only, never Big Five');

  const disagree = traitsFromDisagree('step_back');
  assert.equal(disagree.attachment_anxiety, undefined);
  assert.equal(disagree.attachment_avoidance, undefined);
  assert.ok((disagree.conflict_assertiveness ?? 1) < 0.5);
  ok('disagreement tap writes its own two axes only');

  const sliderFirst = mergeTraitWrite(
    emptyTraitState(),
    { extraversion: 0.25 },
    'self_slider',
    SLIDER_AXES,
  );
  assert.equal(sliderFirst.values.extraversion, 0.25);
  assert.equal(sliderFirst.values.openness, null);
  assert.equal(sliderFirst.values.steadiness, null);
  ok('untouched slider axes stay null, not 0.5');

  const afterGrid = mergeTraitWrite(sliderFirst, inferred, 'self_grid', GRID_AXES);
  assert.equal(afterGrid.values.extraversion, 0.25);
  assert.equal(afterGrid.sources.extraversion, 'self_slider');
  assert.ok(afterGrid.values.openness != null);
  assert.equal(afterGrid.sources.openness, 'self_grid');
  ok('slider extraversion is not overwritten by a later type tap that infers extraversion');

  assert.equal(TRAIT_AXES.length, 15);
  assert.deepEqual([...EXTRA_AXES], [
    'autonomy',
    'competence',
    'relatedness',
    'growth_mindset',
    'locus_of_control',
    'self_efficacy',
  ]);
  assert.equal(isDirectTraitSource('self_tap'), true);
  assert.equal(isDirectTraitSource('self_confirm'), true);
  assert.equal(isDirectTraitSource('self_settings'), true);
  assert.equal(isDirectTraitSource('self_game'), false);
  ok('six extra axes exist; confirm/tap/settings are direct; game is inferred');

  const t1 = '2026-01-15T12:00:00.000Z';
  const t2 = '2026-06-01T12:00:00.000Z';
  const tapped = mergeTraitWrite(emptyTraitState(), { autonomy: 0.8 }, 'self_tap', TRAIT_AXES, t1);
  assert.equal(tapped.values.autonomy, 0.8);
  assert.equal(tapped.sources.autonomy, 'self_tap');
  assert.equal(tapped.touched.autonomy, t1);
  assert.equal(tapped.values.growth_mindset, null);
  assert.equal(tapped.sources.growth_mindset, undefined);
  assert.equal(tapped.touched.growth_mindset, undefined);
  const gamed = mergeTraitWrite(tapped, { autonomy: 0.2 }, 'self_game', TRAIT_AXES, t2);
  assert.equal(gamed.values.autonomy, 0.8);
  assert.equal(gamed.sources.autonomy, 'self_tap');
  assert.equal(gamed.touched.autonomy, t1);
  ok('self_tap write is sticky; later self_game on the same axis is ignored and last_touched does not move');

  const inferredFill = mergeTraitWrite(
    emptyTraitState(),
    { growth_mindset: 0.7 },
    'self_game',
    TRAIT_AXES,
    t1,
  );
  assert.equal(inferredFill.values.growth_mindset, 0.7);
  assert.equal(inferredFill.sources.growth_mindset, 'self_game');
  assert.equal(inferredFill.touched.growth_mindset, t1);
  const patched = traitPatch(inferredFill);
  assert.equal(patched.trait_sources.autonomy, undefined);
  assert.equal(patched.trait_touched_at.autonomy, undefined);
  assert.equal(patched.autonomy, null);
  ok('inferred can fill a null axis; null axes have no source or last_touched row');

  const extra = read('supabase/migrations/wave15_extra_trait_axes.sql');
  for (const axis of EXTRA_AXES) {
    assert.match(extra, new RegExp(`add column if not exists ${axis} numeric`));
    assert.match(extra, new RegExp(`me_${axis}_unit`));
    assert.match(extra, new RegExp(`${axis} is null or \\(${axis} >= 0 and ${axis} <= 1\\)`));
  }
  assert.match(extra, /trait_touched_at jsonb not null default '\{\}'::jsonb/);
  assert.doesNotMatch(extra, /create function public.complete_signup|alter function public.complete_signup/);
  ok('six new columns exist with 0–1 CHECK constraints; complete_signup is untouched');

  const blankSliders = writeForOptionalScreen({
    screen: 1,
    typeCode: null,
    sliderValues: {},
    closeId: null,
    disagreeId: null,
  });
  assert.equal(blankSliders, null);
  ok('slider screen with no taps produces no write');

  assert.equal(optionalProgressLabel(1), 'extra 1 of 4');
  assert.notEqual(optionalProgressLabel(1), '10 of 13');
  ok('optional progress is its own counter');

  const onboarding = read('src/app/onboarding.tsx');
  const optionalUi = read('src/components/optional-intake.tsx');
  const submitFn = onboarding.slice(
    onboarding.indexOf('async function submit()'),
    onboarding.indexOf('async function goHome()'),
  );
  assert.match(submitFn, /createMe\(/);
  assert.match(submitFn, /setPhase\('optional-gate'\)/);
  assert.doesNotMatch(submitFn, /refresh\(/);
  assert.match(onboarding, /phase === 'optional-gate'/);
  assert.match(optionalUi, /Skip the rest/);
  assert.match(optionalUi, /Skip this one/);
  assert.doesNotMatch(optionalUi, /Pick one to keep going/);
  assert.doesNotMatch(optionalUi, /of 9/);
  assert.match(onboarding, /'Pick one to keep going\.'/);
  ok('core 9 still requires a pick; optional never does; signup finishes before the extra phase');

  const signup = read('supabase/migrations/stage9_intake_core.sql');
  assert.doesNotMatch(signup, /openness|trait_sources|attachment_anxiety/);
  const stage11 = read('supabase/migrations/stage11_trait_backbone.sql');
  assert.match(stage11, /add column if not exists openness numeric/);
  assert.doesNotMatch(stage11, /create function public.complete_signup|alter function public.complete_signup/);
  ok('complete_signup is unchanged and does not require trait columns');

  const copyBlob = [
    onboarding,
    optionalUi,
    read('src/components/axis-taps.tsx'),
    read('src/components/intake-chips.tsx'),
    read('src/components/intake-settings.tsx'),
    read('src/app/(tabs)/you.tsx'),
    read('src/components/share-poster.tsx'),
  ].join('\n');
  for (const banned of ['MBTI', 'Myers-Briggs', 'Big Five', 'OCEAN', 'attachment style', 'neuroticism', 'TIPI', 'ECR']) {
    assert.equal(copyBlob.toLowerCase().includes(banned.toLowerCase()), false, `UI leaked "${banned}"`);
  }
  assert.doesNotMatch(read('src/app/(tabs)/you.tsx'), /openness|INFJ|attachment_anxiety|steadiness|autonomy|growth_mindset|self_efficacy/);
  ok('no framework labels in intake UI, poster, or You-tab identity');

  const peer = read('supabase/migrations/stage7_chat_report.sql');
  const night = read('supabase/migrations/wave2_going_colors.sql');
  const poster = read('src/components/share-poster.tsx');
  const handlePage = read('src/app/[handle].tsx');
  const circle = read('src/lib/circle.ts');
  for (const source of [peer, night, poster, handlePage, circle]) {
    assert.doesNotMatch(
      source,
      /openness|conscientiousness|attachment_anxiety|conflict_assertiveness|trait_sources|autonomy|growth_mindset|self_efficacy|trait_touched_at/,
    );
  }
  assert.match(peer, /returns table \(id uuid, name text, handle text, show_up text, talk_style text, recipe jsonb\)/);
  assert.match(night, /'id', m.id/);
  assert.match(night, /'recipe', m.recipe/);
  ok('peer_profile / poster / night_snapshot / public handle stay closed');

  const withTraits = voiceMeFrom({
    ...meBase(),
    extraversion: 0.25,
    openness: 0.86,
    attachment_anxiety: null,
    facts: ['I am an INFJ', 'I finish work at four'],
  });
  assert.equal(withTraits.extraversion, 0.25);
  assert.equal(withTraits.attachment_anxiety, null);
  assert.deepEqual(withTraits.facts, ['I finish work at four']);
  ok('null axes stay null at read; banned facts are stripped before Sage sees them');

  const prompt = buildPrompt({
    me: withTraits,
    day: 4,
    tone: 'even',
    history: [],
    crisisToday: false,
    previousHadCut: false,
  });
  assert.match(prompt, /quieter time/);
  assert.doesNotMatch(prompt, /0\.25/);
  for (const banned of BANNED) {
    assert.equal(containsFrameworkTerm(banned), true, `${banned} should be a banned term`);
    assert.equal(prompt.toLowerCase().includes(banned.toLowerCase()), false, `prompt leaked ${banned}`);
  }
  const omitted = traitPromptLines({ extraversion: null, openness: null, autonomy: null, growth_mindset: null });
  assert.equal(omitted, '');
  const extraLines = traitPromptLines({ autonomy: 0.9, growth_mindset: null, locus_of_control: null, self_efficacy: null });
  assert.match(extraLines, /their own way/);
  assert.doesNotMatch(extraLines, /growth mindset|locus of control|self-efficacy|self-determination/i);
  assert.doesNotMatch(extraLines, /0\.9/);
  ok('Sage prompt omits null axes, paraphrases behavior, and names no framework');

  assert.equal(
    filterCard(
      { read: 'Your INFJ side is showing.', do: 'After you make coffee, write one line.' },
      { shownCards: [], crisisToday: false, previousHadCut: false },
    ),
    'framework-echo',
  );
  assert.equal(
    filterCard(
      { read: 'Day four is even.', do: 'After you make coffee, write one line about the week.' },
      { shownCards: [], crisisToday: false, previousHadCut: false },
    ),
    null,
  );
  assert.deepEqual(matchingFrameworkTerms('Your INFJ side is showing.'), ['INFJ']);
  assert.equal(matchingFrameworkTerms('Day four is even.').length, 0);
  assert.equal(containsFrameworkTerm('growth mindset'), true);
  assert.equal(containsFrameworkTerm('locus of control'), true);
  assert.equal(containsFrameworkTerm('self-efficacy'), true);
  assert.equal(containsFrameworkTerm('They picked their own way through it.'), false);
  ok('runtime fence drops generated Read/Do that names a type');

  const echoProvider: VoiceProvider = {
    id: 'local',
    label: 'echo-test',
    async generate() {
      return {
        read: 'Lean on your INFJ extraversion today.',
        do: 'After you make coffee, stand up and drink a glass of water.',
      };
    },
    async generateTalk() {
      return { reply: 'ok' };
    },
  };
  const localConfig = buildVoiceConfig({ MODEL_PROVIDER: 'local' });
  const echoed = await routeVoiceCard(
    {
      me: withTraits,
      checkCount: 3,
      history: [
        { day: 1, status: 'done', read: 'One.', do: 'After you make coffee, sit one minute.' },
        { day: 2, status: 'done', read: 'Two.', do: 'After you make coffee, write one line.' },
        { day: 3, status: 'done', read: 'Three.', do: 'After you make coffee, pick one task.' },
      ],
      aiConsent: true,
    },
    { config: localConfig, providers: { local: echoProvider, gemini: echoProvider }, isDev: true },
  );
  assert.equal(echoed.card, null);
  assert.deepEqual(echoed.dropped, ['framework-echo']);
  ok('dev provider that names a type is rejected at runtime (Gemini and local share this fence)');

  assert.equal(
    resolveNudge({
      knocksYouOff: '',
      facts: ['I am an INFJ who is anxious'],
      history: [{ day: 1, status: 'done', read: 'One day.', do: 'After coffee, sit one minute.' }],
      hasDo: true,
    }),
    null,
  );
  assert.ok(FACT_FRAMEWORK_MESSAGE.includes('will not store'));
  assert.deepEqual(sanitizeFacts(['I am an INFJ', 'I finish work at four']), ['I finish work at four']);
  ok('Teach Sage facts that name a type never become Nudge copy');

  const addFact = read('src/lib/me.ts');
  assert.match(addFact, /containsFrameworkTerm/);
  assert.match(addFact, /FACT_FRAMEWORK_MESSAGE/);
  ok('addFact rejects a leaked phrase before it is persisted');

  const talkSrc = read('src/lib/voice/talk.ts');
  assert.match(talkSrc, /containsFrameworkTerm/);
  assert.match(talkSrc, /TALK_FENCE_ATTEMPTS = 2/);
  assert.match(talkSrc, /kind: 'empty'/);
  ok('Talk replies run the same framework fence; retry is one extra generate, then honest empty');

  console.log(`\nAll ${passed} trait checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
