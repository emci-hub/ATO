/**
 * Dev Hub → AI → Story library (root only, inside the tools branch).
 *
 * Edit the bank and a template, preview the ending, validate on save, then
 * approve. Two taps each. Approve writes the copy the runtime reads.
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
import type { StoryLibrary, Template, Tier, WordEntry } from '@/lib/story-library/types';
import { validateLibrary } from '@/lib/story-library/validate';
import { fill, PRONOUNS } from '@/lib/story-v3/tracery';
import { TRAIT_AXES } from '@/lib/traits';

const TIERS: readonly Tier[] = ['low', 'mid', 'high'];
const PRONOUN_IDS = ['you', 'they', 'she', 'he'] as const;

function cycle<T>(list: readonly T[], current: T, step: number): T {
  const index = list.indexOf(current);
  return list[(index + step + list.length) % list.length]!;
}

function cloneLibrary(): { templates: Template[]; entries: WordEntry[] } {
  return {
    templates: STORY_LIBRARY.templates.map((row) => ({
      ...row,
      slots: row.slots.map((spec) => ({ ...spec, tones: [...spec.tones], intensities: spec.intensities ? [...spec.intensities] : undefined })),
      endings: row.endings.map((ending) => ({ ...ending, when: { ...ending.when } })),
    })),
    entries: STORY_LIBRARY.entries.map((entry) => ({ ...entry, forms: entry.forms ? { ...entry.forms } : undefined })),
  };
}

export function StoryLibraryDev() {
  const theme = useTheme();
  const { devAccess } = useMeContext();
  const seeded = useRef(cloneLibrary());
  const [templates, setTemplates] = useState(seeded.current.templates);
  const [entries, setEntries] = useState(seeded.current.entries);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 'dive-means');
  const [entryId, setEntryId] = useState(entries[0]?.id ?? '');
  const [trait, setTrait] = useState<(typeof TRAIT_AXES)[number]>('openness');
  const [tier, setTier] = useState<Tier>('mid');
  const [pronounId, setPronounId] = useState<(typeof PRONOUN_IDS)[number]>('you');
  const [note, setNote] = useState('Save checks this copy. Approve writes it into the library the next render reads.');
  const [issues, setIssues] = useState<string[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = templates.find((row) => row.id === templateId) ?? templates[0];
  const entry = entries.find((row) => row.id === entryId) ?? entries[0];

  const preview = useMemo(() => {
    if (!template) return null;
    return fill(
      template,
      {
        name: 'Alex',
        pronoun: PRONOUNS[pronounId],
        dominant: { trait, tier },
        secondary: { trait: trait === 'playfulness' ? 'openness' : 'playfulness', tier: 'high' },
      },
      entries,
      `admin|${template.id}|${trait}|${tier}|${pronounId}`,
      { tokens: template.kind === 'legend' ? { legend: 'Marie Curie' } : undefined },
    );
  }, [template, entries, trait, tier, pronounId]);

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
    const library: StoryLibrary = { version: STORY_LIBRARY.version, templates, entries };
    const report = validateLibrary(library, { requireApproved: false });
    if (report.failures.length > 0) {
      setIssues(report.failures.slice(0, 8).map((row) => `${row.templateId} ${row.trait} ${row.tier} ${row.pronoun}: ${row.detail}`));
      setNote(`Not saved. ${report.failures.length} problem${report.failures.length === 1 ? '' : 's'} in ${report.renders} renders.`);
      return;
    }
    setTemplates((rows) => rows.map((row) => (row.status === 'draft' ? { ...row, status: 'validated' } : row)));
    setEntries((rows) => rows.map((row) => (row.status === 'draft' ? { ...row, status: 'validated' } : row)));
    setIssues([]);
    setNote(`Saved. ${report.renders} renders passed. Draft rows are now validated.`);
  };

  const approve = () => {
    if (templates.some((row) => row.status === 'draft') || entries.some((row) => row.status === 'draft')) {
      setNote('Validate on save before approve. A draft is still open.');
      return;
    }
    if (!confirm('approve')) return;
    const nextTemplates = templates.map((row) => ({ ...row, status: 'approved' as const }));
    const nextEntries = entries.map((row) => ({ ...row, status: 'approved' as const }));
    void persistStoryLibraryDevice({ version: STORY_LIBRARY.version, templates: nextTemplates, entries: nextEntries }).then((result) => {
      if (!result.ok) {
        setIssues(result.failures.slice(0, 8).map((row) => `${row.templateId} ${row.trait} ${row.tier} ${row.pronoun}: ${row.detail}`));
        setNote(`Not approved. ${result.failures.length} problem${result.failures.length === 1 ? '' : 's'} in ${result.renders} renders.`);
        return;
      }
      setTemplates(nextTemplates);
      setEntries(nextEntries);
      setIssues([]);
      setNote(`Approved and saved. ${result.renders} renders passed. The next render reads this copy.`);
    });
  };

  if (!devAccess.isRoot) return null;
  if (!template || !entry || !preview) return null;

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {note}
      </ThemedText>

      <View style={styles.row}>
        <Cycle label="Template" value={`${template.id} · ${template.status}`} onPrev={() => setTemplateId(cycle(templates, template, -1).id)} onNext={() => setTemplateId(cycle(templates, template, 1).id)} />
      </View>
      <TextInput
        value={template.body}
        onChangeText={(body) => setTemplates((rows) => rows.map((row) => (row.id === template.id ? { ...row, body, status: 'draft' } : row)))}
        multiline
        style={inputStyle}
      />

      <Cycle label="Bank" value={entry.id} onPrev={() => setEntryId(cycle(entries, entry, -1).id)} onNext={() => setEntryId(cycle(entries, entry, 1).id)} />
      {entry.forms ? (
        (['base', 's', 'ed', 'ing'] as const).map((form) => (
          <TextInput
            key={form}
            value={entry.forms?.[form] ?? ''}
            onChangeText={(value) =>
              setEntries((rows) =>
                rows.map((row) =>
                  row.id === entry.id && row.forms ? { ...row, status: 'draft', forms: { ...row.forms, [form]: value } } : row,
                ),
              )
            }
            style={inputStyle}
          />
        ))
      ) : (
        <TextInput
          value={entry.text ?? ''}
          onChangeText={(text) => setEntries((rows) => rows.map((row) => (row.id === entry.id ? { ...row, text, status: 'draft' } : row)))}
          style={inputStyle}
        />
      )}

      <ThemedText type="smallBold">Ending preview</ThemedText>
      <View style={styles.row}>
        <Cycle label="Trait" value={trait} onPrev={() => setTrait(cycle(TRAIT_AXES, trait, -1))} onNext={() => setTrait(cycle(TRAIT_AXES, trait, 1))} />
        <Cycle label="Tier" value={tier} onPrev={() => setTier(cycle(TIERS, tier, -1))} onNext={() => setTier(cycle(TIERS, tier, 1))} />
        <Cycle label="Pronoun" value={pronounId} onPrev={() => setPronounId(cycle(PRONOUN_IDS, pronounId, -1))} onNext={() => setPronounId(cycle(PRONOUN_IDS, pronounId, 1))} />
      </View>
      <ThemedText>{preview.text}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Ending {preview.endingId ?? 'none'}
        {preview.issues.length > 0 ? ` · ${preview.issues.map((issue) => issue.code).join(', ')}` : ''}
      </ThemedText>

      <View style={styles.row}>
        <Pressable onPress={save} style={[styles.button, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">{armed === 'save' ? 'Tap again to save' : 'Save and validate'}</ThemedText>
        </Pressable>
        <Pressable onPress={approve} style={[styles.button, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">{armed === 'approve' ? 'Tap again to approve' : 'Approve'}</ThemedText>
        </Pressable>
      </View>
      {issues.map((line) => (
        <ThemedText key={line} type="small" themeColor="textSecondary">
          {line}
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
