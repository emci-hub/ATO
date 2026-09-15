import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';

export const REBUILT_NOTICE_COPY = 'This is being rebuilt. Nothing is running behind it yet.';

export function RebuiltNotice({ title, note }: { title: string; note?: string }) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: controlBorderColor(theme) }]}>
      <ThemedText type="subtitle">{`${title} (Rebuilt)`}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.body}>
        {REBUILT_NOTICE_COPY}
      </ThemedText>
      {note ? (
        <ThemedText themeColor="textSecondary" style={styles.body}>
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  body: {
    lineHeight: 24,
  },
});
