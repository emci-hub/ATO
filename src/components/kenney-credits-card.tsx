import { Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { KENNEY_CC0_LINE, kenneyCredits } from '@/lib/kenney/credits';

async function openUrl(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

/** Collapsed-by-default Kenney attribution, same fold as Sage today. */
export function KenneyCreditsCard() {
  const packs = kenneyCredits();

  return (
    <SettingsFold title="Credits">
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
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
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
