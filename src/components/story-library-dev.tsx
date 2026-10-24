/**
 * Dev Hub → AI → Story library (root only, inside the tools branch).
 *
 * Edit a whole line, preview the ending, validate on save, then approve.
 * Two taps each. Approve writes the copy the runtime reads.
 */
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMeContext } from '@/lib/me-context';
import { legendById } from '@/lib/legend-figures/roster';
import type { LegendPair } from '@/lib/legend-figures/story';
import { STORY_LIBRARY } from '@/lib/story-library/library';
import { persistStoryLibraryDevice } from '@/lib/story-library/device-store';
import { renderLibraryDive, renderLibraryLegend } from '@/lib/story-library/render';
import type { StoryLibrary, StoryLine, Tier } from '@/lib/story-library/types';
import { validateLibrary } from '@/lib/story-library/validate';
import { reviewLibraryVoice } from '@/lib/story-library/voice-review';
import { TRAIT_AXES } from '@/lib/traits';

const TIERS: readonly Tier[] = ['low', 'mid', 'high'];

function cycle<T>(list: readonly T[], current: T, step: number): T {
  const index = list.indexOf(current);
  return list[(index + step + list.length) % list.length]!;
}

function cloneLines(): StoryLine[] {
  return STORY_LIBRARY.lines.map((line) => ({ ...line }));
}

export function StoryLibraryDev() {
  const theme = useTheme();
  const { devAccess } = useMeContext();
  const seeded = useRef(cloneLines());
  const [lines, setLines] = useState(seeded.current);
  const [lineId, setLineId] = useState(lines[0]?.id ?? '');
  const [trait, setTrait] = useState<(typeof TRAIT_AXES)[number]>('openness');
  const [tier, setTier] = useState<Tier>('high');
  const [note, setNote] = useState('Save checks this copy. Approve writes it into the library the next render reads.');
  const [issues, setIssues] = useState<string[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const line = lines.find((row) => row.id === lineId) ?? lines[0];

  const preview = useMemo(() => {
    const library: StoryLibrary = { version: STORY_LIBRARY.version, templates: [], entries: [], lines };
    return renderLibraryDive(
      {
        categoryId: 'cat_openness',
        leans: [
          { axis: trait, lean: tier === 'low' ? 'low' : 'high', pct: tier === 'mid' ? 52 : 82, middle: tier === 'mid' },
          { axis: trait === 'playfulness' ? 'openness' : 'playfulness', lean: 'high', pct: 78 },
        ],
        seed: `admin|${trait}|${tier}`,
      },
      library,
    );
  }, [lines, trait, tier]);

  const confirm = (id: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (armed === id) {
      setArmed(null);
      return true;
    }
    setArmed(id);
    timer.current = setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), 5000);
    return false;
  };

  const save = () => {
    if (!confirm('save')) return;
    const library: StoryLibrary = { version: STORY_LIBRARY.version, templates: [], entries: [], lines };
    const voice = reviewLibraryVoice(library);
    const report = validateLibrary(library, { requireApproved: false });
    const failures = [...voice, ...report.failures];
    if (failures.length > 0) {
      setIssues(failures.slice(0, 8).map((row) => `${row.templateId} ${row.trait} ${row.tier} ${row.pronoun}: ${row.detail}`));
      setNote(`Not saved. ${failures.length} problem${failures.length === 1 ? '' : 's'} before a draft can be validated.`);
      return;
    }
    setLines((rows) => rows.map((row) => (row.status === 'draft' ? { ...row, status: 'validated' } : row)));
    setIssues([]);
    setNote(`Saved. ${report.renders} checks passed. Draft rows are now validated.`);
  };

  const approve = () => {
    if (lines.some((row) => row.status === 'draft')) {
      setNote('Validate on save before approve. A draft is still open.');
      return;
    }
    if (!confirm('approve')) return;
    const nextLines = lines.map((row) => ({ ...row, status: 'approved' as const }));
    const voice = reviewLibraryVoice({ version: STORY_LIBRARY.version, templates: [], entries: [], lines: nextLines });
    if (voice.length > 0) {
      setIssues(voice.slice(0, 8).map((row) => `${row.templateId} ${row.trait} ${row.tier} ${row.pronoun}: ${row.detail}`));
      setNote(`Not approved. ${voice.length} voice problem${voice.length === 1 ? '' : 's'} before the queue.`);
      return;
    }
    void persistStoryLibraryDevice({ version: STORY_LIBRARY.version, templates: [], entries: [], lines: nextLines }).then((result) => {
      if (!result.ok) {
        setIssues(result.failures.slice(0, 8).map((row) => `${row.templateId} ${row.trait} ${row.tier} ${row.pronoun}: ${row.detail}`));
        setNote(`Not approved. ${result.failures.length} problem${result.failures.length === 1 ? '' : 's'} in ${result.renders} checks.`);
        return;
      }
      setLines(nextLines);
      setIssues([]);
      setNote(`Approved and saved. ${result.renders} checks passed. The next render reads this copy.`);
    });
  };

  if (!devAccess.isRoot) return null;
  if (!line) return null;

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {note}
      </ThemedText>

      <Cycle label="Line" value={`${line.id} · ${line.status}`} onPrev={() => setLineId(cycle(lines, line, -1).id)} onNext={() => setLineId(cycle(lines, line, 1).id)} />
      <TextInput
        value={line.text}
        onChangeText={(text) => setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, text, status: 'draft' } : row)))}
        multiline
        style={inputStyle}
      />
      <TextInput
        value={line.flip}
        onChangeText={(flip) => setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, flip, status: 'draft' } : row)))}
        multiline
        style={inputStyle}
      />

      <ThemedText type="smallBold">Ending preview</ThemedText>
      <View style={styles.row}>
        <Cycle label="Trait" value={trait} onPrev={() => setTrait(cycle(TRAIT_AXES, trait, -1))} onNext={() => setTrait(cycle(TRAIT_AXES, trait, 1))} />
        <Cycle label="Tier" value={tier} onPrev={() => setTier(cycle(TIERS, tier, -1))} onNext={() => setTier(cycle(TIERS, tier, 1))} />
      </View>
      <ThemedText>{preview.title}</ThemedText>
      <ThemedText>{preview.showsUp.map((row) => row.line).join(' ')}</ThemedText>
      <ThemedText>{preview.whatItMeansForYou}</ThemedText>

      <View style={styles.row}>
        <Pressable onPress={save} style={[styles.button, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">{armed === 'save' ? 'Tap again to save' : 'Save and validate'}</ThemedText>
        </Pressable>
        <Pressable onPress={approve} style={[styles.button, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">{armed === 'approve' ? 'Tap again to approve' : 'Approve'}</ThemedText>
        </Pressable>
      </View>
      {issues.map((issue) => (
        <ThemedText key={issue} type="small" themeColor="textSecondary">
          {issue}
        </ThemedText>
      ))}
      <ShippedSample />
    </View>
  );
}

function Cycle({ label, value, onPrev, onNext }: { label: string; value: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={styles.cycle}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.row}>
        <Pressable onPress={onPrev} style={styles.step}>
          <ThemedText type="smallBold">Prev</ThemedText>
        </Pressable>
        <ThemedText type="small">{value}</ThemedText>
        <Pressable onPress={onNext} style={styles.step}>
          <ThemedText type="smallBold">Next</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function ShippedSample() {
  const dive = renderLibraryDive({
    categoryId: 'cat_openness',
    leans: [
      { axis: 'openness', lean: 'high', pct: 80 },
      { axis: 'playfulness', lean: 'high', pct: 78 },
    ],
    seed: 'admin-sample',
  });
  const legend = legendById('lf_marie_curie');
  const pair = (axis: 'openness' | 'playfulness', strength: number): LegendPair => ({
    axis,
    lean: 'high',
    strength,
    contrast: false,
    tag: { axis, lean: 'high', them: 'their curious side', why: 'the work kept going' },
  });
  const story = legend
    ? renderLibraryLegend({
        legend,
        angle: legend.angles[0]!,
        momentId: legend.moments[0]!.id,
        pairs: [pair('openness', 0.3), pair('playfulness', 0.28)],
        differ: null,
        seed: 'admin-sample',
      })
    : null;
  return (
    <View style={styles.sample}>
      <ThemedText type="smallBold">Shipped sample</ThemedText>
      <ThemedText type="small">{dive.title}</ThemedText>
      <ThemedText type="small">{dive.whatItMeansForYou}</ThemedText>
      {dive.joke ? <ThemedText type="small">{dive.joke}</ThemedText> : null}
      {story ? <ThemedText type="small">{story.metScene}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, paddingTop: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  cycle: { gap: Spacing.one },
  step: { minHeight: 44, justifyContent: 'center' },
  button: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.two },
  input: { borderWidth: 1, borderRadius: 8, padding: Spacing.two, minHeight: 44 },
  sample: { gap: Spacing.one, paddingTop: Spacing.two },
});
