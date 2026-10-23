import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { identityView, legendHeadline, nextLockedPoles } from '@/lib/legends64/identity';
import { loadIdentityState, type IdentityState } from '@/lib/legends64/identity-store';
import { controlBorderColor } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';
import { traitSourcesFrom } from '@/lib/trait-tracks-store';
import { useTheme } from '@/hooks/use-theme';

export const IDENTITY_CHIP_KICKER = 'your ato';
/** Spoken to screen readers only; nothing about progress or advice is shown on Home. */
export const IDENTITY_CHIP_HINT = 'Opens your card on You.';

/**
 * The name you've earned, on Home (emci 2026-10-04: "I want the title to be in
 * home"). Display only: it reads the same stored letters and chosen style as the
 * identity card on You, and the locked letters are computed from the tracks Home
 * already has — nothing is written here (the You card owns locking, so the
 * mini guy's "your name locked in" note still fires once, from there). Just the
 * name: no "N of M settled" line (Home must not show settled completeness —
 * wave20-check / full-profile-check) and no advice. Nothing is shown until at
 * least one half of the name has settled. No model call.
 */
export function IdentityTitleChip({
  userId,
  tracks,
  sources,
}: {
  userId: string;
  tracks: readonly TraitTrack[];
  /** Trait source tokens from the account, so a direct edit stays a direct edit. */
  sources?: unknown;
}) {
  const theme = useTheme();
  const [stored, setStored] = useState<IdentityState | null>(null);

  // Reload on focus: the style is picked on You, and tabs stay mounted.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadIdentityState(userId)
        .then((state) => {
          if (active) setStored(state);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const parsedSources = useMemo(() => traitSourcesFrom(sources), [sources]);
  const poles = useMemo(
    () =>
      nextLockedPoles(
        tracks,
        stored?.legendHistory.migrated ? stored.poles : {},
        new Date(),
        parsedSources,
      ),
    [tracks, stored, parsedSources],
  );
  const view = useMemo(() => identityView(poles), [poles]);
  if (!stored || view.lockedCount === 0) return null;
  const title = legendHeadline(tracks, poles, stored.skin, stored.pickedCode, parsedSources).title;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${IDENTITY_CHIP_HINT}`}
      onPress={() => router.push('/you')}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: controlBorderColor(theme) }]}>
        <ThemedText type="code" themeColor="textSecondary">
          {IDENTITY_CHIP_KICKER}
        </ThemedText>
        <ThemedText type="subtitle" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
          {title}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
