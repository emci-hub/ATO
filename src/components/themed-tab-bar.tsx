import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Opaque bottom-tab chrome in the current appearance background.
 * Soft's card surface is white and Anime's is translucent — either lets
 * native/html white show through the bar, so this always uses page background.
 */
export function ThemedTabBar({ children, style, ...props }: ViewProps) {
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[styles.tabListContainer, { backgroundColor: theme.background }, style]}>
      <View
        style={[
          styles.innerContainer,
          { backgroundColor: theme.background, borderColor: controlBorderColor(theme) },
        ]}>
        <ThemedText type="smallBold" style={styles.brandText}>
          ATO
        </ThemedText>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    borderWidth: 1,
  },
  brandText: {
    marginRight: 'auto',
  },
});
