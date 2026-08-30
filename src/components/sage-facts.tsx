import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FACTS_EMPTY_COPY,
  FACTS_FORGET_CONFIRM,
  FACTS_SCREEN_TITLE,
  asFactsArray,
  factsSummaryLabel,
} from '@/lib/facts';
import { removeFact, type Me } from '@/lib/me';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * You-tab facts list. Read and delete only — teaching still happens from
 * Chat's "Teach Sage this". Display is the stored string as written.
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
  const facts = asFactsArray(me.facts);
  const summary = factsSummaryLabel(facts.length);

  return (
    <>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedPressable
          accessibilityRole="button"
          accessibilityLabel={summary}
          onPress={() => setOpen(true)}
          style={styles.summary}>
          <ThemedText type="smallBold" style={styles.summaryText}>
            {summary}
          </ThemedText>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
        </ThemedPressable>
      </ThemedView>
      <SageFactsSheet
        visible={open}
        facts={facts}
        userId={me.id}
        onClose={() => setOpen(false)}
        onUpdated={onUpdated}
      />
    </>
  );
}

function SageFactsSheet({
  visible,
  facts,
  userId,
  onClose,
  onUpdated,
}: {
  visible: boolean;
  facts: string[];
  userId: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) setPending(null);
  }, [visible]);

  async function forget(index: number) {
    if (busy) return;
    setBusy(true);
    try {
      await removeFact(userId, index);
      await onUpdated();
      setPending(null);
    } catch (err) {
      console.log('[sage-facts] remove error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider style={styles.provider}>
        <ThemedView style={styles.sheet}>
          <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {FACTS_SCREEN_TITLE}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
              <MaterialCommunityIcons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.list}>
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
          </ScrollView>
          </SafeAreaView>
        </ThemedView>
      </SafeAreaProvider>
    </Modal>
  );
}

const DANGER = '#E5484D';

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.two,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  summaryText: {
    flex: 1,
  },
  provider: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  title: {
    flex: 1,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
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
