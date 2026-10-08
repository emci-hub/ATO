/**
 * Dev Hub → Content → Legends museum (PRE_LAUNCH_DEV only: mounted inside the
 * `tools` branch of dev-lab.tsx). Previews any legend's card with the
 * hand-written (no-AI) story, pretends today is a legend's birthday, and
 * resets this phone's Legends state. Nothing here calls a model, and every
 * write takes two taps.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LegendStoryCard } from '@/components/legend-figure-card';
import { ThemedText } from '@/components/themed-text';
import { bumpAccountDataEpoch } from '@/lib/account-data-epoch';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  devClearLocalMuseum,
  devForceLegendBonus,
  devResetLegendDay,
  loadDevLegendDate,
  setDevLegendDate,
} from '@/lib/legend-figures/museum-store';
import { chooseAngle } from '@/lib/legend-figures/pick';
import { LEGEND_ROSTER } from '@/lib/legend-figures/roster';
import { fallbackLegendStory, legendPairs } from '@/lib/legend-figures/story';

export function LegendFiguresDev({ userId }: { userId: string }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [devDate, setDevDate] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadDevLegendDate().then(setDevDate);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const twoTap = useCallback(
    (id: string, run: () => Promise<void>, done: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (armed !== id) {
        setArmed(id);
        timer.current = setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), 5000);
        return;
      }
      setArmed(null);
      // Bump the account-data epoch so an already-open Legends tab drops what
      // it holds in memory instead of writing it back.
      void run().then(() => {
        bumpAccountDataEpoch();
        setNote(`${done} Reopen the Legends tab.`);
      });
    },
    [armed],
  );

  const legend = LEGEND_ROSTER[index % LEGEND_ROSTER.length]!;
  const chosen = chooseAngle(legend, userId, null);
  const angle = legend.angles.find((a) => a.id === chosen.angleId) ?? legend.angles[0]!;
  // Pretend the person matches this legend's first two tags.
  const pairs = legendPairs(
    legend,
    legend.tags.slice(0, 2).map((tag, i) => ({ axis: tag.axis, lean: tag.lean, strength: 0.3 - i * 0.05 })),
  );
  const story = fallbackLegendStory({ legend, angle, momentId: chosen.momentId, pairs });
  const birthdays = LEGEND_ROSTER.filter((l) => l.birthday);
  const year = new Date().getFullYear();

  const Btn = ({ id, label, onPress }: { id: string; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, { borderColor: theme.border }, pressed && styles.pressed]}>
      <ThemedText type="small">{armed === id ? `Tap again · ${label}` : label}</ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        Preview ({index % LEGEND_ROSTER.length + 1}/{LEGEND_ROSTER.length}) — hand-written story, no AI.
      </ThemedText>
      <View style={styles.row}>
        <Btn id="prev" label="‹ Previous" onPress={() => setIndex((i) => (i + LEGEND_ROSTER.length - 1) % LEGEND_ROSTER.length)} />
        <Btn id="next" label="Next ›" onPress={() => setIndex((i) => i + 1)} />
      </View>
      <LegendStoryCard legend={legend} story={story} friends={[]} aiOff={false} onShare={() => setNote('Share works from the Legends tab.')} />

      <ThemedText type="small" themeColor="textSecondary">
        Pretend today is: {devDate ?? 'the real date'}
      </ThemedText>
      <View style={styles.row}>
        {birthdays.map((l) => (
          <Btn
            key={l.id}
            id={`date-${l.id}`}
            label={`${l.name.split(' ').slice(-1)[0]} ${l.birthday!.md}`}
            onPress={() => {
              const ymd = `${year}-${l.birthday!.md}`;
              twoTap(
                `date-${l.id}`,
                () => setDevLegendDate(ymd).then(() => setDevDate(ymd)),
                'Date set. Reset today’s three to see On this day. While a fake date is set, the server refuses to save picks.',
              );
            }}
          />
        ))}
        <Btn
          id="date-clear"
          label="Real date"
          onPress={() => twoTap('date-clear', () => setDevLegendDate(null).then(() => setDevDate(null)), 'Back to the real date.')}
        />
      </View>

      <View style={styles.row}>
        <Btn id="reset-day" label="Reset today’s three" onPress={() => twoTap('reset-day', () => devResetLegendDay(userId), 'Today’s three cleared.')} />
        <Btn id="bonus" label="Pretend a trait settled" onPress={() => twoTap('bonus', () => devForceLegendBonus(userId), 'Bonus set armed.')} />
        <Btn id="clear" label="Clear this phone’s museum" onPress={() => twoTap('clear', () => devClearLocalMuseum(userId), 'Phone museum cleared (server rows stay).')} />
      </View>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  pressed: { opacity: 0.7 },
});
