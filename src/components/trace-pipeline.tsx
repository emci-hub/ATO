import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { AppearanceTokens } from '@/constants/appearance';
import { useTheme } from '@/hooks/use-theme';
import {
  TRACE_SECTIONS,
  eventsForSection,
  type DevTraceEvent,
  type DevTraceStep,
  type DevTraceStepStatus,
} from '@/lib/dev-trace';
import { controlBorderColor } from '@/lib/theme/chrome';

export type TraceSectionOption = { id: string; label: string };

/**
 * Generic pipeline viewer. Reads the ordered-step schema and the section
 * registry. A new generating surface only has to register its id + log steps —
 * this screen does not grow a custom branch per section.
 */
export function TracePipelineViewer({
  events,
  selectedId,
  onSelect,
  sections = TRACE_SECTIONS,
}: {
  events: DevTraceEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
  sections?: readonly TraceSectionOption[];
}) {
  const theme = useTheme();
  const rows = eventsForSection(events, selectedId);

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        Section — same viewer for every registered surface.
      </ThemedText>
      <View style={styles.tabs}>
        {sections.map((section) => {
          const on = section.id === selectedId;
          return (
            <Pressable
              key={section.id}
              onPress={() => onSelect(section.id)}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: controlBorderColor(theme) },
                on && { backgroundColor: theme.accentFill },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="small"
                style={on ? { color: theme.onAccent } : undefined}
                themeColor={on ? undefined : 'text'}>
                {section.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {rows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No captures for this section yet. Turn capture on, then generate here.
        </ThemedText>
      ) : (
        rows.map((event) => <GenerationCard key={event.id} event={event} theme={theme} />)
      )}
    </View>
  );
}

function GenerationCard({ event, theme }: { event: DevTraceEvent; theme: AppearanceTokens }) {
  const steps = event.steps;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary">
        {event.surface} · {event.createdAt}
      </ThemedText>
      {steps.length === 0 ? (
        <LegacyDump event={event} />
      ) : (
        steps.map((step) => <StepRow key={`${event.id}-${step.step_order}`} step={step} theme={theme} />)
      )}
    </ThemedView>
  );
}

function StepRow({ step, theme }: { step: DevTraceStep; theme: AppearanceTokens }) {
  const color = statusColor(step.status, theme);
  return (
    <View style={[styles.step, { borderLeftColor: color }]}>
      <View style={styles.stepHead}>
        <ThemedText type="smallBold">
          {step.step_order}. {step.label}
        </ThemedText>
        <View style={[styles.status, { borderColor: color }]}>
          <ThemedText type="code" style={{ color }}>
            {step.status}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="code" themeColor="textSecondary">
        {step.step_type}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        in: {step.input_summary}
      </ThemedText>
      <ThemedText type="small">out: {step.output_summary}</ThemedText>
    </View>
  );
}

function LegacyDump({ event }: { event: DevTraceEvent }) {
  return (
    <View style={styles.legacy}>
      <ThemedText type="smallBold">
        {event.guardFired ? `guard: ${event.guardFired}` : 'no steps (legacy capture)'}
      </ThemedText>
      <ThemedText type="small">before: {event.rawBefore ?? '—'}</ThemedText>
      <ThemedText type="small">after: {event.rawAfter ?? '—'}</ThemedText>
    </View>
  );
}

function statusColor(status: DevTraceStepStatus, theme: AppearanceTokens): string {
  if (status === 'failed') return theme.accent;
  if (status === 'flagged') return theme.accentSecondary;
  return theme.accentTertiary;
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  step: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
    gap: 2,
  },
  stepHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  status: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  legacy: {
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
