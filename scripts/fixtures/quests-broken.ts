/**
 * Deliberately broken Quests campaigns for `check:quests` (PHASE-12). Each one
 * is the sample with ONE fault; `expect` is a piece of the message the
 * validator must give. Never imported by the app.
 */
import { SAMPLE_LANTERN } from '../../src/lib/quests/content/sample-lantern';
import type { QuestCampaign, QuestScene } from '../../src/lib/quests/types';

export interface BrokenFixture {
  name: string;
  expect: string[];
  build: () => QuestCampaign;
}

export const copy = (): QuestCampaign => structuredClone(SAMPLE_LANTERN);
const scene = (c: QuestCampaign, id: string): QuestScene => {
  const s = c.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`fixture scene ${id} missing`);
  return s;
};

/**
 * The sample plus a d20 check on the dive: success goes on, `fail` goes to a new
 * shore scene that leads to `shoreNext`. A valid variant of the sample.
 */
export function withCheck(fail: string, shoreNext: string): QuestCampaign {
  const c = copy();
  const dive = scene(c, 'lantern_s4_lake').choices[0];
  dive.check = { stat: 'morale', dc: 10, success: 'lantern_s5_way', fail };
  c.scenes.push({
    id: 'lantern_s4b_shore',
    chapter: 2,
    lines: [{ kind: 'narrator', text: 'The current drags you to a cold shore of black pebbles.' }],
    choices: [
      { id: 'dry_off', label: 'Dry off and try again.', approach: 'steady', result: [{ kind: 'narrator', text: 'Slow going, but it holds.' }], tags: [] },
      { id: 'rest_here', label: 'Rest until the glow comes back.', approach: 'wait', result: [{ kind: 'narrator', text: 'The glow returns, softer.' }], tags: [] },
    ],
    next: shoreNext,
    art: { location: 'lantern.singing-lake' },
  });
  return c;
}

/** A chain of `n` scenes that all lead on: for the path-length rule. */
function longChain(n: number): QuestCampaign {
  const c = copy();
  const base = scene(c, 'lantern_s5_way');
  for (let i = 0; i < n; i += 1) {
    c.scenes.push({ ...structuredClone(base), id: `chain_${i}`, primaryAxis: undefined, next: i + 1 < n ? `chain_${i + 1}` : null });
  }
  scene(c, 'lantern_s4_lake').next = 'chain_0';
  return c;
}

export const BROKEN: BrokenFixture[] = [
  {
    name: 'content ids the server would refuse (uppercase, space, too long)',
    expect: ['The choice id "Drop Rope"', 'The flag id "Gave-Map"', `The scene id "${'x'.repeat(65)}"`],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s1_gate').choices[0].id = 'Drop Rope';
      scene(c, 'lantern_s1_gate').choices[1].setFlags = ['Gave-Map'];
      c.scenes.push({ ...structuredClone(scene(c, 'lantern_s5_way')), id: 'x'.repeat(65), next: null });
      return c;
    },
  },
  {
    name: 'fail-only dead end (R13): the fail branch loops',
    expect: ['loops back'],
    build: () => withCheck('lantern_s4b_shore', 'lantern_s4_lake'),
  },
  {
    name: 'check target is not a scene',
    expect: ['"nope"', 'which is not a scene'],
    build: () => withCheck('nope', 'lantern_s5_way'),
  },
  {
    name: 'unknown axis id',
    expect: ['"derring_do"', 'not a trait axis'],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s1_gate').choices[0].tags[0].axis = 'derring_do' as never;
      return c;
    },
  },
  {
    name: 'excluded axis',
    expect: ['"steadiness"', 'may not tag'],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s1_gate').choices[0].tags[0].axis = 'steadiness';
      return c;
    },
  },
  {
    name: 'beat over 45 words',
    expect: ['words; the limit is 45'],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s2_fork').lines[0].text = Array.from({ length: 50 }, () => 'water').join(' ');
      delete scene(c, 'lantern_s2_fork').lines[0].keywords;
      return c;
    },
  },
  {
    name: 'label over 60 characters',
    expect: ['characters; the limit is 60'],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s2_fork').choices[0].label = 'x'.repeat(61);
      return c;
    },
  },
  {
    name: 'jargon and banned words in copy',
    expect: ['"personality"', '"test"', '"scoring"', '"introverts"'],
    build: () => {
      const c = copy();
      const s = scene(c, 'lantern_s2_fork');
      s.lines[1].text = 'Your personality is a test for introverts.';
      s.choices[1].label = 'Take the road and keep scoring.';
      return c;
    },
  },
  {
    name: 'primary scene offers one pole only',
    expect: ['must offer both poles'],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s2_fork').choices[1].tags = [{ axis: 'openness', pole: 1, w: 1 }];
      return c;
    },
  },
  {
    name: 'frozen id missing',
    expect: ['Frozen scene id "lantern_gone"'],
    build: () => {
      const c = copy();
      c.sceneIdsFrozen.push('lantern_gone');
      return c;
    },
  },
  {
    name: 'retired scene without a redirect',
    expect: ['needs a redirect'],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s3_toll').retired = true;
      return c;
    },
  },
  {
    name: 'unknown art location',
    expect: ['not in art-keys.ts'],
    build: () => {
      const c = copy();
      scene(c, 'lantern_s3_toll').art.location = 'lantern.nowhere';
      return c;
    },
  },
  {
    name: 'a real (non-sample) campaign needs 3 primary scenes per axis',
    expect: ['primary scene(s) on the path'],
    build: () => {
      const c = copy();
      delete c.isSample;
      return c;
    },
  },
  {
    name: 'three primary scenes but all in one chapter',
    expect: ['spans 1 chapter(s)'],
    build: () => {
      const c = copy();
      delete c.isSample;
      c.targetAxes = ['openness', 'autonomy', 'conflict_assertiveness'];
      scene(c, 'lantern_s4_lake').chapter = 1;
      scene(c, 'lantern_s5_way').chapter = 1;
      return c;
    },
  },
  {
    name: 'path longer than 12 scenes',
    expect: ['limit 12'],
    build: () => longChain(10),
  },
  {
    name: 'fallback ending has a condition',
    expect: ['must have no conditions'],
    build: () => {
      const c = copy();
      c.endings[c.endings.length - 1].when = { flags: ['saw_glow'] };
      return c;
    },
  },
  {
    name: 'a flag that no choice sets (typo)',
    expect: ['"trusted_rok"', 'no choice ever sets'],
    build: () => {
      const c = copy();
      c.endings[0].when = { flags: ['trusted_rok'] };
      return c;
    },
  },
  {
    name: 'two gated scenes skip into each other',
    expect: ['loops back'],
    build: () => {
      const c = copy();
      const a = scene(c, 'lantern_s3_toll');
      const b = scene(c, 'lantern_s4_lake');
      a.requires = { flags: ['gave_map'] };
      a.next = 'lantern_s4_lake';
      b.requires = { flags: ['gave_map'] };
      b.next = 'lantern_s3_toll';
      return c;
    },
  },
];
