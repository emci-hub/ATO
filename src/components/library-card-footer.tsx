/**
 * Under a shared library card (wave93): "You and N others got this card"
 * (only from 5 people up, never who) and "Report this card" (two taps: the
 * first arms it, the second sends). Two different people's reports take the
 * card out of the library for everyone.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  LIBRARY_REPORT_CONFIRM,
  LIBRARY_REPORT_LABEL,
  LIBRARY_REPORTED,
  reportLibraryCard,
  sharedCardLine,
} from '@/lib/ai-library/client';

export function LibraryCardFooter({ libraryId, others }: { libraryId?: string | null; others?: number | null }) {
  const [armed, setArmed] = useState(false);
  const [sent, setSent] = useState(false);
  const shared = sharedCardLine(others ?? null);

  useEffect(() => {
    setArmed(false);
    setSent(false);
  }, [libraryId]);

  // Disarm after a few seconds so a stray tap later never reports.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (!libraryId && !shared) return null;
  return (
    <View style={styles.row}>
      {shared ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {shared}
        </ThemedText>
      ) : (
        <View style={styles.flex} />
      )}
      {libraryId ? (
        sent ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {LIBRARY_REPORTED}
          </ThemedText>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={armed ? LIBRARY_REPORT_CONFIRM : LIBRARY_REPORT_LABEL}
            onPress={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              void reportLibraryCard(libraryId).then((ok) => {
                if (ok) setSent(true);
              });
            }}
            style={({ pressed }) => [styles.report, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
              {armed ? LIBRARY_REPORT_CONFIRM : LIBRARY_REPORT_LABEL}
            </ThemedText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 140 },
  report: { paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});
