import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { PixelFace } from '@/components/pixel-face';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { accentFromShowUp } from '@/lib/color';
import { normalizeRecipe } from '@/lib/kenney/registry';
import { useSession } from '@/hooks/use-session';

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const { me } = useMe(session?.user.id);
  const accent = accentFromShowUp(me?.show_up);
  const recipe = normalizeRecipe(me?.recipe);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.header}>
            <ThemedText type="subtitle">Home</ThemedText>
            <ThemedText themeColor="textSecondary">Fake card. Fake poster.</ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.faceCard}>
            <ThemedText type="code" themeColor="textSecondary">
              face · {recipe.source} · {recipe.parts.body} · {recipe.parts.face}
            </ThemedText>
            {/* Static display face — the header avatar is the app's one
                always-mounted animated/gesture instance, so this stays still. */}
            <PixelFace recipe={recipe} size={88} showUp={me?.show_up} animated={false} />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.boxCard}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.boxKicker}>
              open box
            </ThemedText>
            <Pressable
              onPress={() => router.push('/dawn')}
              style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
              <View style={styles.boxRowText}>
                <ThemedText type="smallBold">Dawn</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Today&apos;s read + do
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
            {__DEV__ ? (
              <Pressable
                onPress={() => router.push('/voice-lab')}
                style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Voice router</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dev: bank vs generated
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            ) : null}
            {__DEV__ ? (
              <Pressable
                onPress={() => router.push('/crisis-lab')}
                style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Crisis card</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dev: static, no model call
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            ) : null}
            {__DEV__ ? (
              <Pressable
                onPress={() => router.push('/talk-lab')}
                style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Talk router</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dev: tones + crisis gate
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            ) : null}
            {__DEV__ ? (
              <Pressable
                onPress={() => router.push('/pixel-lab')}
                style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Pixel lab</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dev: faces + growth tiers
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.poster, { backgroundColor: accent.light }]}>
            <ThemedText type="code" style={styles.posterKicker}>
              fake poster
            </ThemedText>
            <ThemedText style={styles.posterTitle}>Something is coming</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.posterBody}>
              This is placeholder poster art. Real artwork lands here later.
            </ThemedText>
            <ThemedText type="code" style={styles.posterMeta}>
              fake · aug 2026
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  FP
                </ThemedText>
              </View>
              <View>
                <ThemedText type="smallBold">Fake Person</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  @fake
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.cardBody}>
              This is a fake card with placeholder content. It has no real data behind it.
            </ThemedText>
            <View style={[styles.cardMedia, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="code" themeColor="textSecondary">
                fake card media
              </ThemedText>
            </View>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  faceCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  boxCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  boxKicker: {
    textTransform: 'uppercase',
    paddingBottom: Spacing.one,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
  },
  boxRowText: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
  poster: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  posterKicker: {
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  posterTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
    color: '#ffffff',
  },
  posterBody: {
    color: 'rgba(255,255,255,0.9)',
  },
  posterMeta: {
    marginTop: Spacing.three,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    fontWeight: 400,
  },
  cardMedia: {
    height: 120,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
