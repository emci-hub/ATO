import { Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { KENNEY_CC0_LINE, kenneyCredits } from '@/lib/kenney/credits';

async function openUrl(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

/** Static Kenney attribution for the You-tab settings area. */
export function KenneyCreditsCard() {
  const packs = kenneyCredits();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        Credits
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
        Pixel art in ATO is from Kenney asset packs actually bundled in the app.
      </ThemedText>
      {packs.map((pack) => (
        <View key={pack.family} style={styles.pack}>
          <ThemedText type="smallBold">{pack.pack}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {pack.creator}
          </ThemedText>
          <Pressable
            onPress={() => openUrl(pack.siteUrl)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="link">kenney.nl</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => openUrl(pack.packUrl)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="link">{pack.packUrl.replace(/^https:\/\//, '')}</ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            {KENNEY_CC0_LINE}
          </ThemedText>
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.two,
  },
  heading: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  lede: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  pack: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
