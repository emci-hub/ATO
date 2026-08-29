import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrowthMarkers } from '@/components/growth-markers';
import { PixelFace } from '@/components/pixel-face';
import { Spacing } from '@/constants/theme';
import { useGrowth } from '@/hooks/use-growth';
import { resolveFacePalette } from '@/lib/color';
import { isCrisisActive } from '@/lib/kenney/gesture-actions';
import { recipeForAccount } from '@/lib/kenney/registry';
import { pickTapMood, type TapMood, type TapMoodId } from '@/lib/kenney/tap-moods';
import { useMeContext } from '@/lib/me-context';

/** Face size of the nav companion (pt). Small on purpose — not a hero. */
export const NAV_PIXEL_FACE = 28;
/** Slot around the face so glow (scale 1.55), sparkle, and tap-mood hands aren't clipped. */
export const NAV_PIXEL_SLOT = 56;
/** Trailing inset from the screen edge. */
export const NAV_PIXEL_RIGHT = Spacing.three;
/**
 * Extra trailing space screens should leave in a top-right header control
 * so it doesn't sit under the companion (Sage's support button).
 */
export const NAV_PIXEL_HEADER_INSET = NAV_PIXEL_SLOT;

/**
 * Persistent nav companion: one small live pixel, fixed top-right over every
 * tab. Mounted at the tab shell so it does not remount on tab switches or
 * scroll. Idle / event-gesture / milestone / tap-mood animation all run here.
 *
 * Current-you (Home, Around, You, Circle): recipe + idle, no growth glow.
 * Aspirational-you (Sage): same instance, presence glow + depth sparkle.
 * Tap: a short coherent mood (wave / thumbs-up / happy bounce / hug). Rapid
 * re-taps interrupt-and-restart so nothing queues.
 */
export function NavPixel() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { me } = useMeContext();
  const { state, pendingMilestone, markCelebrated } = useGrowth();
  const celebrateRef = useRef<(() => void) | null>(null);
  const tapMoodRef = useRef<((mood: TapMood) => void) | null>(null);
  const lastMoodRef = useRef<TapMoodId | null>(null);
  const recipe = useMemo(() => recipeForAccount(me?.id, me?.recipe), [me]);
  const onSage = pathname === '/sage' || pathname.endsWith('/sage');

  useEffect(() => {
    if (pendingMilestone != null && celebrateRef.current) {
      celebrateRef.current();
      markCelebrated().catch(() => {});
    }
  }, [pendingMilestone, markCelebrated]);

  if (!me) return null;

  function onTap() {
    // Same crisis hard rule as event gestures: no hands while the card is up.
    if (isCrisisActive()) return;
    const mood = pickTapMood(onSage, lastMoodRef.current);
    lastMoodRef.current = mood.id;
    tapMoodRef.current?.(mood);
  }

  return (
    <View
      collapsable={false}
      style={[
        styles.wrap,
        {
          top: insets.top + Spacing.two,
          right: Math.max(insets.right, NAV_PIXEL_RIGHT),
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your pixel"
        onPress={onTap}
        hitSlop={8}
        style={styles.slot}>
        <GrowthMarkers
          presence={onSage ? state.presence : 0}
          depth={onSage ? state.depth : 0}
          color={resolveFacePalette(recipe.palette, me.show_up)}
        />
        <PixelFace
          recipe={recipe}
          size={NAV_PIXEL_FACE}
          showUp={me.show_up}
          animated
          celebrateRef={celebrateRef}
          tapMoodRef={tapMoodRef}
          pressable={false}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 100,
    overflow: 'visible',
  },
  slot: {
    width: NAV_PIXEL_SLOT,
    height: NAV_PIXEL_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
