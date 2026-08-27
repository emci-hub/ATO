import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrowthMarkers } from '@/components/growth-markers';
import { PixelFace } from '@/components/pixel-face';
import { Spacing } from '@/constants/theme';
import { useGrowth } from '@/hooks/use-growth';
import { resolveFacePalette } from '@/lib/color';
import { normalizeRecipe } from '@/lib/kenney/registry';
import { useMeContext } from '@/lib/me-context';

/** Face size of the nav companion (pt). Small on purpose — not a hero. */
export const NAV_PIXEL_FACE = 28;
/** Slot around the face so glow layers (scale 1.55) and the sparkle aren't clipped. */
export const NAV_PIXEL_SLOT = 48;
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
 * scroll. Idle / gesture / milestone animation all run here.
 *
 * Current-you (Home, Around, You, Circle): recipe + idle, no growth glow.
 * Aspirational-you (Sage): same instance, presence glow + depth sparkle.
 * The You-tab poster keeps its own larger still pixel — not this component.
 */
export function NavPixel() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { me } = useMeContext();
  const { state, pendingMilestone, markCelebrated } = useGrowth();
  const celebrateRef = useRef<(() => void) | null>(null);
  const recipe = useMemo(() => normalizeRecipe(me?.recipe), [me]);
  const onSage = pathname === '/sage' || pathname.endsWith('/sage');

  useEffect(() => {
    if (pendingMilestone != null && celebrateRef.current) {
      celebrateRef.current();
      markCelebrated().catch(() => {});
    }
  }, [pendingMilestone, markCelebrated]);

  if (!me) return null;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.wrap,
        {
          top: insets.top + Spacing.two,
          right: Math.max(insets.right, NAV_PIXEL_RIGHT),
        },
      ]}>
      <View style={styles.slot}>
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
        />
      </View>
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
