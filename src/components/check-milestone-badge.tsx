import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  type BadgeCheck,
  type BadgeId,
  resolveBadges,
  unlockedCount,
} from '@/lib/badges';
import { neonGlowColors, presenceGlowLayersForTier, PRESENCE_GLOW_LAYERS } from '@/lib/growth';
import { controlBorderColor } from '@/lib/theme/chrome';

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
}: {
  kicker: string;
  value: string | number;
  unlocked: boolean;
  glow?: number;
  accessibilityLabel: string;
  decorative?: boolean;
}) {
  const theme = useTheme();
  const layers = presenceGlowLayersForTier(glowFor(unlocked, glow));
  const palette = neonGlowColors(theme.accent);

  return (
    <View
      style={[styles.wrap, !unlocked && styles.locked]}
      accessibilityRole={decorative ? undefined : 'text'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={decorative}>
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
          {
            backgroundColor: theme.backgroundElement,
            borderColor: controlBorderColor(theme),
          },
          chipShadow(theme.accent, glowFor(unlocked, glow)),
        ]}>
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          {kicker}
        </ThemedText>
        <ThemedText type="smallBold">{value}</ThemedText>
      </View>
    </View>
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
}: {
  checkCount: number;
  factCount: number;
  checks: BadgeCheck[];
  timeZone?: string;
  defaultOpen?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const states = resolveBadges({ checkCount, factCount, checks, timeZone });
  const earned = unlockedCount(states);
  const checksState = states.find((badge) => badge.id === 'checks-7')!;
  const checksGlow = checkCount >= 21 ? 3 : UNLOCK_GLOW;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.fold, { borderColor: controlBorderColor(theme) }]}>
      <ThemedPressable
        accessibilityRole="button"
        accessibilityLabel={`Milestones, ${earned} of 3 unlocked. ${checkCount} checks.`}
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
          {earned}/3
        </ThemedText>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </ThemedPressable>
      {open ? (
        <View style={styles.body}>
          {states.map((badge) => {
            const copy = CHIP_COPY[badge.id]({
              checkCount,
              factCount,
              unlocked: badge.unlocked,
            });
            return (
              <CheckMilestoneBadge
                key={badge.id}
                kicker={copy.kicker}
                value={copy.value}
                unlocked={badge.unlocked}
                glow={badge.id === 'checks-7' ? checksGlow : UNLOCK_GLOW}
                accessibilityLabel={copy.label}
              />
            );
          })}
        </View>
      ) : null}
    </ThemedView>
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
  kicker: {
    textTransform: 'uppercase',
    fontSize: 10,
    lineHeight: 14,
  },
});
