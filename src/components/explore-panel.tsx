import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  EXPLORE_EMPTY_CONSENT,
  EXPLORE_EMPTY_CRISIS,
  EXPLORE_EMPTY_DENIED,
  EXPLORE_EMPTY_QUOTA,
  EXPLORE_EMPTY_TRY,
  EXPLORE_LABEL,
  EXPLORE_LAND_NO,
  EXPLORE_LAND_Q,
  EXPLORE_LAND_YES,
  EXPLORE_NOTED,
} from '@/lib/explore/copy';
import { generateExploreBody } from '@/lib/explore/generate';
import { routeExplore } from '@/lib/explore/route';
import {
  fetchExploreMissNotes,
  fetchLatestExplorePack,
  recordExploreReaction,
  saveExplorePack,
} from '@/lib/explore/store';
import type { ExploreEntryRow, ExplorePackRow, RouteExploreResult } from '@/lib/explore/types';
import { voiceMeFrom } from '@/lib/intake';
import type { Me } from '@/lib/me';
import { useAppearance } from '@/lib/theme/context';
import { controlBorderColor } from '@/lib/theme/chrome';
import { shouldUseLocalAi } from '@/lib/ai/override';
import { claimAiCall, logJargonGuard, logPhraseGuard } from '@/lib/voice/quota-server';
import { recordOwnDevTrace } from '@/lib/dev-trace-server';
import type { CheckHistory } from '@/lib/voice/types';

function emptyCopy(kind: RouteExploreResult['kind']): string | null {
  switch (kind) {
    case 'consent-pending':
      return EXPLORE_EMPTY_CONSENT;
    case 'consent-denied':
      return EXPLORE_EMPTY_DENIED;
    case 'crisis':
      return EXPLORE_EMPTY_CRISIS;
    case 'quota':
      return EXPLORE_EMPTY_QUOTA;
    case 'empty':
      return EXPLORE_EMPTY_TRY;
    default:
      return null;
  }
}

function NotedAck({
  bump,
  reduceMotion,
  onFill,
}: {
  bump: number;
  reduceMotion: boolean;
  onFill: boolean;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    if (reduceMotion) {
      const hide = setTimeout(() => {
        opacity.value = 0;
      }, 900);
      return () => clearTimeout(hide);
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 700 }),
    );
  }, [bump, reduceMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.noted, fade]}>
      <ThemedText
        type="small"
        themeColor={onFill ? undefined : 'textSecondary'}
        style={onFill ? { color: theme.onAccent } : undefined}>
        {EXPLORE_NOTED}
      </ThemedText>
    </Animated.View>
  );
}

export function ExplorePanel({
  me,
  history,
  crisisToday,
}: {
  me: Me;
  history: CheckHistory[];
  crisisToday: boolean;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [result, setResult] = useState<RouteExploreResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noted, setNoted] = useState<{
    entryId: string;
    landed: boolean;
    bump: number;
  } | null>(null);

  const load = useCallback(async () => {
    const next = await routeExplore(
      {
        me: {
          ...voiceMeFrom(me),
          timezone: me.timezone,
          traitTouchedAt: me.trait_touched_at,
        },
        history,
        aiConsent: me.ai_consent,
        crisisToday,
      },
      {
        loadLatestPack: fetchLatestExplorePack,
        savePack: saveExplorePack,
        loadMissNotes: fetchExploreMissNotes,
        claimAiCall: () => claimAiCall('explore'),
        logJargonHit: logJargonGuard,
        logPhraseHit: logPhraseGuard,
        generateBody: generateExploreBody,
        useLocal: await shouldUseLocalAi(),
        recordTrace: recordOwnDevTrace,
      },
    );
    setResult(next);
  }, [me, history, crisisToday]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((err) => {
        console.log('[explore] route error:', err);
        if (!cancelled) setResult({ kind: 'empty', pack: null });
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function react(entry: ExploreEntryRow, landed: boolean) {
    if (busyId || entry.id.startsWith('local-')) return;
    setNoted({ entryId: entry.id, landed, bump: Date.now() });
    setBusyId(entry.id);
    try {
      await recordExploreReaction(entry.id, landed);
      setResult((current) => {
        if (!current?.pack) return current;
        return {
          ...current,
          pack: {
            ...current.pack,
            entries: current.pack.entries.map((row) =>
              row.id === entry.id ? { ...row, landed } : row,
            ),
          },
        };
      });
    } catch (err) {
      console.log('[explore] reaction error:', err);
    } finally {
      setBusyId(null);
    }
  }

  const message = result ? emptyCopy(result.kind) : null;
  const pack: ExplorePackRow | null = result?.pack ?? null;
  const entries = pack?.entries ?? [];

  return (
    <View style={styles.wrap}>
      {message ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
            {EXPLORE_LABEL}
          </ThemedText>
          <ThemedText style={styles.body}>{message}</ThemedText>
        </ThemedView>
      ) : null}
      {entries.map((entry) => (
        <ThemedView key={entry.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
            {EXPLORE_LABEL}
          </ThemedText>
          <ThemedText style={styles.body}>{entry.body}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {EXPLORE_LAND_Q}
          </ThemedText>
          <View style={styles.actions}>
            <View style={styles.actionSlot}>
              <ThemedPressable
                filled={entry.landed === true}
                onPress={() => void react(entry, true)}
                disabled={busyId !== null}
                style={[
                  styles.primary,
                  busyId !== null && styles.disabled,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={entry.landed === true ? { color: theme.onAccent } : undefined}
                  themeColor={entry.landed === true ? undefined : 'textSecondary'}>
                  {EXPLORE_LAND_YES}
                </ThemedText>
              </ThemedPressable>
              {noted?.entryId === entry.id && noted.landed === true ? (
                <NotedAck
                  bump={noted.bump}
                  reduceMotion={reduceMotion}
                  onFill={entry.landed === true}
                />
              ) : null}
            </View>
            <View style={styles.actionSlot}>
              <ThemedPressable
                onPress={() => void react(entry, false)}
                disabled={busyId !== null}
                style={[
                  styles.secondary,
                  { borderColor: controlBorderColor(theme) },
                  entry.landed === false && styles.missed,
                  busyId !== null && styles.disabled,
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {EXPLORE_LAND_NO}
                </ThemedText>
              </ThemedPressable>
              {noted?.entryId === entry.id && noted.landed === false ? (
                <NotedAck
                  bump={noted.bump}
                  reduceMotion={reduceMotion}
                  onFill={false}
                />
              ) : null}
            </View>
          </View>
        </ThemedView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'none',
  },
  body: {
    lineHeight: 26,
  },
  actions: {
    gap: Spacing.two,
  },
  actionSlot: {
    position: 'relative',
  },
  primary: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondary: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  noted: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  missed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
