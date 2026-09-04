import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FACTS_EMPTY_COPY,
  FACTS_FORGET_CONFIRM,
  FACTS_SCREEN_TITLE,
  asFactsArray,
  factsSummaryLabel,
} from '@/lib/facts';
import { removeFact, type Me } from '@/lib/me';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Collapsible Sage-tab facts list. Read and delete only — teaching still
 * happens from Chat's "Teach Sage this". Display is the stored string as
 * written. Lives below the 8-ball on Sage, not on Explore.
 */
export function SageFactsCard({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const facts = asFactsArray(me.facts);
  const summary = factsSummaryLabel(facts.length);

  async function forget(index: number) {
    if (busy) return;
    setBusy(true);
    try {
      await removeFact(me.id, index);
      await onUpdated();
      setPending(null);
    } catch (err) {
      console.log('[sage-facts] remove error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedPressable
        accessibilityRole="button"
        accessibilityLabel={`${FACTS_SCREEN_TITLE}. ${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setPending(null);
          setOpen((value) => !value);
        }}
        style={styles.header}>
        <View style={styles.headerLabel}>
          <ThemedText type="smallBold">{FACTS_SCREEN_TITLE}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {summary}
          </ThemedText>
        </View>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textSecondary}
        />
      </ThemedPressable>
      {open ? (
        <View style={styles.body}>
          {facts.length === 0 ? (
            <ThemedText themeColor="textSecondary">{FACTS_EMPTY_COPY}</ThemedText>
          ) : (
            facts.map((fact, index) => {
              const confirming = pending === index;
              return (
                <ThemedView key={`${index}:${fact}`} type="backgroundElement" style={styles.factCard}>
                  {confirming ? (
                    <View style={styles.confirmBlock}>
                      <ThemedText type="smallBold">{FACTS_FORGET_CONFIRM}</ThemedText>
                      <View style={styles.confirmRow}>
                        <Pressable
                          disabled={busy}
                          onPress={() => setPending(null)}
                          style={({ pressed }) => [
                            styles.keepButton,
                            { borderColor: controlBorderColor(theme) },
                            pressed && styles.pressed,
                            busy && styles.disabled,
                          ]}>
                          <ThemedText type="smallBold">Keep</ThemedText>
                        </Pressable>
                        <Pressable
                          disabled={busy}
                          onPress={() => {
                            void forget(index);
                          }}
                          style={({ pressed }) => [
                            styles.forgetButton,
                            pressed && styles.pressed,
                            busy && styles.disabled,
                          ]}>
                          <ThemedText type="smallBold" style={styles.forgetLabel}>
                            Forget
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.factRow}>
                      <ThemedText style={styles.factText}>{fact}</ThemedText>
                      <ThemedPressable
                        accessibilityRole="button"
                        accessibilityLabel={FACTS_FORGET_CONFIRM}
                        disabled={busy}
                        onPress={() => setPending(index)}
                        hitSlop={8}
                        style={styles.deleteHit}>
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={20}
                          color={theme.textSecondary}
                        />
                      </ThemedPressable>
                    </View>
                  )}
                </ThemedView>
              );
            })
          )}
        </View>
      ) : null}
    </ThemedView>
  );
}

const DANGER = '#E5484D';

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  headerLabel: {
    flex: 1,
    gap: Spacing.half,
  },
  body: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  factCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  factText: {
    flex: 1,
  },
  deleteHit: {
    padding: Spacing.half,
  },
  confirmBlock: {
    gap: Spacing.two,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  keepButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
  },
  forgetButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Spacing.three,
    backgroundColor: DANGER,
    paddingVertical: Spacing.two,
  },
  forgetLabel: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
