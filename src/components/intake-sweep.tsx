import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updateTraits, type Me } from '@/lib/me';
import {
  deferredUnansweredAxes,
  mergedDeferral,
} from '@/lib/questions/deferral';
import { saveQuestionDeferral } from '@/lib/questions/store';
import { INTAKE_SWEEP_COPY_REVIEWED, unansweredSweep } from '@/lib/questions/local';
import {
  QUESTIONS_EMPTY_CONSENT,
  QUESTIONS_EMPTY_CRISIS,
  QUESTIONS_EMPTY_DENIED,
} from '@/lib/questions/copy';
import { routeQuestionSweep } from '@/lib/questions/sweep';
import type { QuestionDraft } from '@/lib/questions/types';
import { TRAIT_AXES, traitStateFromRow, type TraitAxis } from '@/lib/traits';
import { earnTokensQuiet } from '@/lib/tokens-server';
import { controlBorderColor } from '@/lib/theme/chrome';
import { withTimeout } from '@/lib/timeout';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';

export const INTAKE_SWEEP_TITLE = 'A faster pass';
export const INTAKE_SWEEP_LEDE =
  'One question per category. Skip any, or skip all. Never required.';
export const INTAKE_SWEEP_SKIP_ONE = 'Skip this one';
export const INTAKE_SWEEP_SKIP_ALL = 'Skip the rest';
export const INTAKE_SWEEP_DONE = 'Done';

/**
 * Optional one-page intake. Full-sweep IQ items, each skippable.
 * Copy is drafted for emci review — INTAKE_SWEEP_COPY_REVIEWED stays false
 * until that pass lands.
 */
export function IntakeSweep({
  me,
  crisisToday,
  onUpdated,
  onDone,
}: {
  me: Me;
  crisisToday: boolean;
  onUpdated: () => void | Promise<void>;
  onDone: () => void;
}) {
  const theme = useTheme();
  const [drafts, setDrafts] = useState<QuestionDraft[] | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<TraitAxis>>(new Set());
  const [busy, setBusy] = useState(false);

  const values = traitStateFromRow(me).values;
  const answered = new Set(
    TRAIT_AXES.filter((axis) => values[axis] != null && Number.isFinite(values[axis])),
  );
  const deferred = new Set(deferredUnansweredAxes(values, me.question_deferred));

  useEffect(() => {
    let cancelled = false;
    setGate(null);
    setDrafts(null);
    void (async () => {
      try {
        const next = await withTimeout(
          routeQuestionSweep({
            me: {
              name: me.name,
              talk_style: me.talk_style ?? 'even',
              voice_preset: me.voice_preset,
            },
            aiConsent: me.ai_consent,
            crisisToday,
          }),
          25000,
          'intake-sweep',
        );
        if (cancelled) return;
        switch (next.kind) {
          case 'questions':
            setDrafts(next.drafts);
            break;
          case 'consent-pending':
            setDrafts([]);
            setGate(QUESTIONS_EMPTY_CONSENT);
            break;
          case 'consent-denied':
            setDrafts([]);
            setGate(QUESTIONS_EMPTY_DENIED);
            break;
          case 'crisis':
            setDrafts([]);
            setGate(QUESTIONS_EMPTY_CRISIS);
            break;
        }
      } catch (err) {
        console.log('[intake-sweep] route error:', err);
        if (!cancelled) setDrafts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.name, me.talk_style, me.voice_preset, me.ai_consent, crisisToday]);

  const open = unansweredSweep(drafts ?? [], answered).filter(
    (row) => !skipped.has(row.axis) && !deferred.has(row.axis),
  );

  async function persistSkip(axes: readonly TraitAxis[]) {
    const deferred = mergedDeferral(me.question_deferred, values, axes);
    await saveQuestionDeferral(me.id, deferred);
    await onUpdated();
    setSkipped((prev) => {
      const next = new Set(prev);
      for (const axis of axes) next.add(axis);
      return next;
    });
  }

  async function pick(draft: QuestionDraft, index: number) {
    const option = draft.options[index];
    if (!option || busy) return;
    setBusy(true);
    try {
      await updateTraits(me.id, { [draft.axis]: option.value }, 'self_situation', [draft.axis]);
      earnTokensQuiet('game_round');
      await onUpdated();
    } catch (err) {
      console.log('[intake-sweep] answer error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function skipOne(axis: TraitAxis) {
    if (busy) return;
    setBusy(true);
    try {
      await persistSkip([axis]);
    } catch (err) {
      console.log('[intake-sweep] skip error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function skipRest() {
    if (busy || open.length === 0) return;
    setBusy(true);
    try {
      await persistSkip(open.map((row) => row.axis));
      onDone();
    } catch (err) {
      console.log('[intake-sweep] skip-rest error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.body}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{INTAKE_SWEEP_TITLE}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {INTAKE_SWEEP_LEDE}
        </ThemedText>
        {!INTAKE_SWEEP_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
          <ThemedText type="code" themeColor="textSecondary">
            Draft copy — waiting on emci review.
          </ThemedText>
        ) : null}
      </View>
      {drafts == null ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : gate != null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {gate}
        </ThemedText>
      ) : open.length === 0 ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            That is all for this pass.
          </ThemedText>
          <ThemedPressable filled onPress={onDone} style={styles.done}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {INTAKE_SWEEP_DONE}
            </ThemedText>
          </ThemedPressable>
        </>
      ) : (
        open.map((draft) => (
          <View key={draft.axis} style={styles.item}>
            <ThemedText>{draft.prompt}</ThemedText>
            <View style={styles.options}>
              {draft.options.map((option, index) => (
                <ThemedPressable
                  key={`${draft.axis}-${index}`}
                  disabled={busy}
                  onPress={() => void pick(draft, index)}
                  style={[styles.option, { borderColor: controlBorderColor(theme) }]}>
                  <ThemedText type="smallBold">{option.text}</ThemedText>
                </ThemedPressable>
              ))}
            </View>
            <Pressable
              onPress={() => void skipOne(draft.axis)}
              disabled={busy}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
              <ThemedText type="smallBold">{INTAKE_SWEEP_SKIP_ONE}</ThemedText>
            </Pressable>
          </View>
        ))
      )}
      {open.length > 0 ? (
        <ThemedPressable onPress={() => void skipRest()} disabled={busy} style={styles.skipAll}>
          <ThemedText type="small" themeColor="textSecondary">
            {INTAKE_SWEEP_SKIP_ALL}
          </ThemedText>
        </ThemedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  item: {
    gap: Spacing.two,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  skip: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  skipAll: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
  done: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
});
