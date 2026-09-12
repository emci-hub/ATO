/**
 * About — Play → About (GAME_SPEC §19 credits). Lists the art packs actually
 * bundled under `assets/play/`, plus the optional-Play promise. View only.
 *
 * Chrome (Slice 3): Neon Viper — mono cyan headings/links, cyan-glow panels.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PLAY_CC0_LINE, PLAY_CREDITS, PLAY_OPTIONAL_LINE } from '@/play/credits';
import { NeonBackLink, NeonHeader, NeonLabel, NeonPanel } from '@/play/neon-ui';

async function openUrl(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

export function AboutScreen({ onBackToDivecore }: { onBackToDivecore: () => void }) {
  return (
    <View style={styles.container}>
      <NeonBackLink onPress={onBackToDivecore} />

      <NeonHeader
        title="About"
        lede="Divecore is built on a handful of pixel-art packs. Here is what is bundled and who made it."
      />

      <NeonPanel>
        <NeonLabel>Art credits</NeonLabel>
        {PLAY_CREDITS.map((credit) => (
          <View key={credit.pack} style={styles.credit}>
            <ThemedText type="smallBold">{credit.pack}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {credit.author} · {credit.license}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {credit.usedFor}
            </ThemedText>
            {credit.url ? (
              <Pressable
                onPress={() => openUrl(credit.url!)}
                accessibilityRole="link"
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText type="link" themeColor="emphasis">
                  {credit.url.replace(/^https:\/\//, '')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ))}
      </NeonPanel>

      <NeonPanel>
        <ThemedText type="small" themeColor="textSecondary">
          {PLAY_CC0_LINE}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {PLAY_OPTIONAL_LINE}
        </ThemedText>
      </NeonPanel>

      <View style={styles.footerSpace} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  credit: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.8,
  },
  footerSpace: {
    height: Spacing.five,
  },
});
