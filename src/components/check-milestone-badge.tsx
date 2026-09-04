import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BADGE_IDS,
  type BadgeCheck,
  type BadgeId,
  resolveBadges,
  unlockedCount,
} from '@/lib/badges';
import {
  hasSeenFullProfileUnlock,
  markFullProfileUnlockSeen,
} from '@/lib/full-profile-unlock';
import { neonGlowColors, presenceGlowLayersForTier, PRESENCE_GLOW_LAYERS } from '@/lib/growth';
import { controlBorderColor } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';
import {
  effectiveStability,
  isProfileSettled,
  trackFor,
  unfilledAxes,
  type TraitTrack,
} from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/** First unanswered axis, else the least-stable one. Tracks only — no `me` row needed here. */
function leastReadyAxis(tracks: readonly TraitTrack[]): TraitAxis | null {
  const unfilled = unfilledAxes(tracks);
  if (unfilled.length > 0) return unfilled[0];
  let best: TraitAxis | null = null;
  let bestStability = Infinity;
  for (const axis of TRAIT_AXES) {
    const stability = effectiveStability(trackFor(tracks, axis, 'report'));
    if (stability < bestStability) {
      bestStability = stability;
      best = axis;
    }
  }
  return best;
}

const UNLOCK_GLOW = 2;

function glowFor(unlocked: boolean, extra = UNLOCK_GLOW): number {
  return unlocked ? extra : 0;
}

/**
 * One chip in the Home milestone strip. Same language as the original
 * all-time Checks badge: small, in-palette, glow only once the milestone
 * is already true.
 */
export function CheckMilestoneBadge({
  kicker,
  value,
  unlocked,
  glow = UNLOCK_GLOW,
  accessibilityLabel,
  decorative = false,
  capstone = false,
  onPress,
}: {
  kicker: string;
  value: string | number;
  unlocked: boolean;
  glow?: number;
  accessibilityLabel: string;
  decorative?: boolean;
  capstone?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const layers = presenceGlowLayersForTier(glowFor(unlocked, glow));
  const palette = neonGlowColors(theme.accent);
  const Wrap = onPress ? Pressable : View;

  return (
    <Wrap
      style={[styles.wrap, !unlocked && styles.locked]}
      accessibilityRole={onPress ? 'button' : decorative ? undefined : 'text'}
      accessibilityLabel={decorative && !onPress ? undefined : accessibilityLabel}
      importantForAccessibility={decorative && !onPress ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={decorative && !onPress}
      onPress={onPress}>
      {layers > 0
        ? PRESENCE_GLOW_LAYERS.slice(0, layers).map((layer, i) => (
            <View
              key={layer.key}
              pointerEvents="none"
              style={[
                styles.glow,
                {
                  backgroundColor: palette[layer.key],
                  transform: [{ scale: 1 + (layer.scale - 1) * 0.35 }],
                  zIndex: PRESENCE_GLOW_LAYERS.length - i,
                },
              ]}
            />
          ))
        : null}
      <View
        style={[
          styles.chip,
          capstone && styles.capstone,
          {
            backgroundColor: capstone && unlocked ? theme.accent : theme.backgroundElement,
            borderColor: capstone ? theme.accent : controlBorderColor(theme),
            borderWidth: capstone ? 2 : 1,
          },
          chipShadow(theme.accent, glowFor(unlocked, glow)),
        ]}>
        <ThemedText
          type="code"
          themeColor={capstone && unlocked ? undefined : 'textSecondary'}
          style={[styles.kicker, capstone && unlocked ? { color: theme.onAccent } : null]}>
          {kicker}
        </ThemedText>
        <ThemedText type="smallBold" style={capstone && unlocked ? { color: theme.onAccent } : undefined}>
          {value}
        </ThemedText>
      </View>
    </Wrap>
  );
}

const CHIP_COPY: Record<
  BadgeId,
  (input: { checkCount: number; factCount: number; unlocked: boolean }) => {
    kicker: string;
    value: string | number;
    label: string;
  }
> = {
  'checks-7': ({ checkCount, unlocked }) => ({
    kicker: '7 checks',
    value: checkCount,
    label: unlocked
      ? `7 checks, unlocked. ${checkCount} logged.`
      : `7 checks, locked. ${checkCount} of 7.`,
  }),
  'first-fact': ({ factCount, unlocked }) => ({
    kicker: 'fact',
    value: unlocked ? factCount : '—',
    label: unlocked
      ? 'First fact taught to Sage, unlocked.'
      : 'First fact taught to Sage, locked.',
  }),
  'week-no-cut': ({ unlocked }) => ({
    kicker: 'week',
    value: unlocked ? 7 : '—',
    label: unlocked
      ? 'A full week without a cut, unlocked.'
      : 'A full week without a cut, locked.',
  }),
  'full-picture': ({ unlocked }) => ({
    kicker: 'full picture',
    value: unlocked ? TRAIT_AXES.length : '—',
    label: unlocked
      ? `Full picture, unlocked. All ${TRAIT_AXES.length} axes have settled.`
      : 'Full picture, locked. Not every axis has settled yet.',
  }),
};

/**
 * Collapsible Home milestone strip. Contained in its own surface so the
 * five appearance modes stay in charge of the page. Not a popup.
 */
export function MilestoneBadges({
  checkCount,
  factCount,
  checks,
  timeZone = 'UTC',
  defaultOpen = false,
  userId,
}: {
  checkCount: number;
  factCount: number;
  checks: BadgeCheck[];
  timeZone?: string;
  defaultOpen?: boolean;
  userId?: string;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [open, setOpen] = useState(defaultOpen);
  const [fullPicture, setFullPicture] = useState(false);
  const [nextAxis, setNextAxis] = useState<TraitAxis | null>(null);
  /** Celebrate once, ever. Null until the persisted flag has been read. */
  const [celebrate, setCelebrate] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTraitTracks(userId)
      .then(async (tracks) => {
        const settled = isProfileSettled(tracks);
        if (cancelled) return;
        setFullPicture(settled);
        setNextAxis(leastReadyAxis(tracks));
        if (!settled) {
          setCelebrate(false);
          return;
        }
        // First time this device has seen a settled profile: fire the
        // celebration and burn the flag immediately, so a re-render or a
        // second mount in the same session cannot replay it.
        const seen = await hasSeenFullProfileUnlock();
        if (cancelled) return;
        if (seen) {
          setCelebrate(false);
          return;
        }
        await markFullProfileUnlockSeen();
        if (!cancelled) {
          setCelebrate(true);
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFullPicture(false);
          setCelebrate(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const states = resolveBadges({ checkCount, factCount, checks, timeZone, fullPicture });
  const earned = unlockedCount(states);
  const total = BADGE_IDS.length;
  const checksState = states.find((badge) => badge.id === 'checks-7')!;
  const checksGlow = checkCount >= 21 ? 3 : UNLOCK_GLOW;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.fold, { borderColor: controlBorderColor(theme) }]}>
      <ThemedPressable
        accessibilityRole="button"
        accessibilityLabel={`Milestones, ${earned} of ${total} unlocked. ${checkCount} checks.`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.header}>
        <CheckMilestoneBadge
          kicker="checks"
          value={checkCount}
          unlocked={checksState.unlocked}
          glow={checksGlow}
          decorative
          accessibilityLabel={CHIP_COPY['checks-7']({
            checkCount,
            factCount,
            unlocked: checksState.unlocked,
          }).label}
        />
        <ThemedText type="code" themeColor="textSecondary" style={styles.count}>
          {earned}/{total}
        </ThemedText>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </ThemedPressable>
      {open ? (
        <View style={styles.body}>
          {celebrate ? (
            <FullProfileUnlockAck reduceMotion={reduceMotion} />
          ) : null}
          {states.map((badge) => {
            const copy = CHIP_COPY[badge.id]({
              checkCount,
              factCount,
              unlocked: badge.unlocked,
            });
            const jumpToNextAxis =
              badge.id === 'full-picture' && !badge.unlocked && nextAxis
                ? () =>
                    router.push({ pathname: '/intake-sweep', params: { axis: nextAxis } })
                : undefined;
            return (
              <CheckMilestoneBadge
                key={badge.id}
                kicker={copy.kicker}
                value={copy.value}
                unlocked={badge.unlocked}
                glow={badge.id === 'checks-7' ? checksGlow : UNLOCK_GLOW}
                capstone={badge.id === 'full-picture'}
                accessibilityLabel={
                  jumpToNextAxis ? `${copy.label} Tap to answer more.` : copy.label
                }
                onPress={jumpToNextAxis}
              />
            );
          })}
        </View>
      ) : null}
    </ThemedView>
  );
}

export const FULL_PROFILE_UNLOCK_COPY = 'Full profile unlocked.';

/**
 * One-time celebration for the full-picture capstone. Same fade shape as
 * Explore's NotedAck — a held beat, then out, with a reduceMotion branch that
 * skips the animation and just times the dismissal. Purely visual: the badge
 * underneath is already unlocked whether or not this ever renders.
 */
function FullProfileUnlockAck({ reduceMotion }: { reduceMotion: boolean }) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    if (reduceMotion) {
      const hide = setTimeout(() => {
        opacity.value = 0;
      }, 2400);
      return () => clearTimeout(hide);
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 1200 }),
    );
  }, [reduceMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.unlockAck, { backgroundColor: theme.accent }, fade]}>
      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
        {FULL_PROFILE_UNLOCK_COPY}
      </ThemedText>
    </Animated.View>
  );
}

function chipShadow(accent: string, presence: number) {
  if (presence <= 0) return null;
  const glow = neonGlowColors(accent);
  const radius = 4 + presence * 3;
  return Platform.select({
    ios: {
      shadowColor: accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18 + presence * 0.1,
      shadowRadius: radius,
    },
    android: { elevation: presence },
    default: {
      boxShadow: `0 0 ${radius}px ${glow.halo}`,
    },
  });
}

const styles = StyleSheet.create({
  unlockAck: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  fold: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingRight: Spacing.two,
    paddingVertical: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  count: {
    textTransform: 'uppercase',
    fontSize: 10,
    lineHeight: 14,
  },
  body: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingBottom: Spacing.one,
    paddingLeft: Spacing.one,
    gap: 2,
  },
  wrap: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  locked: {
    opacity: 0.55,
  },
  glow: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    borderRadius: 999,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: Spacing.two,
    zIndex: 4,
  },
  capstone: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
  },
  kicker: {
    textTransform: 'uppercase',
    fontSize: 10,
    lineHeight: 14,
  },
});
