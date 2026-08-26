import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { PixelFace } from '@/components/pixel-face';
import { QuestGrowthBars } from '@/components/quest-growth-bars';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { useGrowth } from '@/hooks/use-growth';
import { accentFromShowUp } from '@/lib/color';
import { checksToHistory, fetchChecks, recordCheck, type Check } from '@/lib/checks';
import { emitChecksChanged, onChecksChanged } from '@/lib/checks-events';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { normalizeRecipe } from '@/lib/kenney/registry';
import { aiConsentFor } from '@/lib/me';
import { HOME_SAGE_LEDE, SAGE_COACH_LABEL } from '@/lib/sage-copy';
import { persistRoutedCard } from '@/lib/today-card';
import { routeVoiceCard } from '@/lib/voice/router';
import { useSession } from '@/hooks/use-session';

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me } = useMe(userId);
  const { card, reload: reloadCard } = useTodayCard();
  const { state: growth } = useGrowth();
  const accent = accentFromShowUp(me?.show_up);
  const recipe = normalizeRecipe(me?.recipe);
  const params = useLocalSearchParams<{ focus?: string }>();
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState<'log' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadChecks = useCallback(async () => {
    if (!userId) return;
    try {
      setChecks(await fetchChecks(userId));
    } catch (err) {
      console.log('[home] fetchChecks error:', err);
    }
  }, [userId]);

  useEffect(() => {
    reloadChecks();
    return onChecksChanged(() => {
      reloadChecks();
    });
  }, [reloadChecks]);

  const alreadyLogged = card != null && checks.some((check) => check.day === card.day);

  async function log(status: 'done' | 'skipped') {
    if (!userId || !me || !card || busy || alreadyLogged) return;
    setBusy(status === 'done' ? 'log' : 'skip');
    setError(null);
    try {
      await recordCheck(userId, {
        day: card.day,
        card: { read: card.read, do: card.do },
        source: card.source,
        status,
      });
      const nextChecks = await fetchChecks(userId);
      setChecks(nextChecks);
      emitChecksChanged();
      if (status === 'done') triggerGesture('checkDone');
      const next = await routeVoiceCard({
        me: {
          name: me.name,
          show_up: me.show_up,
          talk_style: me.talk_style,
          knocks_you_off: me.knocks_you_off,
          morning_cue: me.morning_cue,
        },
        checkCount: nextChecks.length,
        history: checksToHistory(nextChecks),
        crisisToday: false,
        aiConsent: me.ai_consent,
      });
      await persistRoutedCard(next);
      await reloadCard();
    } catch (err) {
      console.log('[home] recordCheck error:', err);
      setError('Couldn\u2019t save your check. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.header}>
            <ThemedText type="subtitle">Home</ThemedText>
            <ThemedText themeColor="textSecondary">
              {params.focus === 'check' ? 'Check today.' : HOME_SAGE_LEDE}
            </ThemedText>
          </View>

          {card ? (
            <>
              <ThemedView type="backgroundElement" style={styles.todayCard}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                  {SAGE_COACH_LABEL} · read
                </ThemedText>
                <ThemedText style={styles.cardText}>{card.read}</ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={styles.todayCard}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                  do
                </ThemedText>
                <ThemedText style={styles.cardText}>{card.do}</ThemedText>
              </ThemedView>
              {error ? (
                <ThemedText themeColor="textSecondary">{error}</ThemedText>
              ) : null}
              {alreadyLogged ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Logged for day {card.day}.
                </ThemedText>
              ) : me && aiConsentFor(me) === 'pending' && checks.length >= 3 ? (
                <Pressable
                  onPress={() => router.push('/dawn')}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Open Dawn to continue.
                  </ThemedText>
                </Pressable>
              ) : (
                <View style={styles.checkRow}>
                  <ThemedPressable
                    onPress={() => log('done')}
                    disabled={busy !== null}
                    filled
                    style={[
                      styles.primaryButton,
                      busy !== null && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                      {busy === 'log' ? 'Saving\u2026' : 'Logged it'}
                    </ThemedText>
                  </ThemedPressable>
                  <ThemedPressable
                    onPress={() => log('skipped')}
                    disabled={busy !== null}
                    style={[
                      styles.secondaryButton,
                      { borderColor: theme.border === 'transparent' ? theme.backgroundSelected : theme.border },
                      busy !== null && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {busy === 'skip' ? 'Saving\u2026' : 'Skip today'}
                    </ThemedText>
                  </ThemedPressable>
                </View>
              )}
            </>
          ) : (
            <ThemedView type="backgroundElement" style={styles.todayCard}>
              <ThemedText type="smallBold">No card yet</ThemedText>
              <ThemedText themeColor="textSecondary">
                Open Dawn when you&apos;re ready. Nothing is made up in the meantime.
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.faceCard}>
            <ThemedText type="code" themeColor="textSecondary">
              face · {recipe.source} · {recipe.parts.body} · {recipe.parts.face}
            </ThemedText>
            {/* Static display face — the header avatar is the app's one
                always-mounted animated/gesture instance, so this stays still. */}
            <PixelFace recipe={recipe} size={88} showUp={me?.show_up} animated={false} />
            <QuestGrowthBars presence={growth.presence} depth={growth.depth} />
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
            <Pressable
              onPress={() => router.push('/week')}
              style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
              <View style={styles.boxRowText}>
                <ThemedText type="smallBold">This week</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Recap + you showed up
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
            <ThemedText type="code" style={[styles.posterKicker, { color: theme.onAccent }]}>
              fake poster
            </ThemedText>
            <ThemedText style={[styles.posterTitle, { color: theme.onAccent }]}>Something is coming</ThemedText>
            <ThemedText style={[styles.posterBody, { color: theme.onAccent }]}>
              This is placeholder poster art. Real artwork lands here later.
            </ThemedText>
            <ThemedText type="code" style={[styles.posterMeta, { color: theme.onAccent }]}>
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
  todayCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  cardText: {
    lineHeight: 26,
  },
  checkRow: {
    gap: Spacing.two,
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
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
