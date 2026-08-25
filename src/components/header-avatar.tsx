import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';

import { GrowthMarkers } from '@/components/growth-markers';
import { PixelFace } from '@/components/pixel-face';
import { Spacing } from '@/constants/theme';
import { useGrowth } from '@/hooks/use-growth';
import { useMeContext } from '@/lib/me-context';
import { normalizeRecipe } from '@/lib/kenney/registry';
import { resolveFacePalette } from '@/lib/color';

/**
 * Persistent header avatar: a small (~26px) live pixel face, top-right, shown
 * on every tab screen (Home, Sage, Circle, You). It is the ONE always-mounted
 * animated face in the app — it registers as the event-gesture handler, and
 * Home's full-size face is rendered statically so there's never a second
 * gesture-registering instance competing with it.
 *
 * Renders the growth-tier markers behind it: the presence glow (tiered) and
 * the depth sparkle (distinct shape). Fires the one-time milestone celebration
 * when a presence milestone (7 / 21) first crosses.
 */
export function HeaderAvatar() {
  const insets = useSafeAreaInsets();
  const { me } = useMeContext();
  const { state, pendingMilestone, markCelebrated } = useGrowth();
  const celebrateRef = useRef<(() => void) | null>(null);

  // Memoize so the recipe reference is stable — otherwise the animation
  // layer's effect deps would keep resetting the blink/gesture timers.
  const recipe = useMemo(() => normalizeRecipe(me?.recipe), [me]);

  // Fire the one-time milestone celebration when a new milestone is pending,
  // then record it so it never fires again for that threshold.
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
      style={[styles.wrap, { top: insets.top + Spacing.two }]}>
      <View style={styles.faceSlot}>
        <GrowthMarkers
          presence={state.presence}
          depth={state.depth}
          color={resolveFacePalette(recipe.palette, me.show_up)}
        />
        <PixelFace
          recipe={recipe}
          size={26}
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
    right: Spacing.three,
    zIndex: 100,
  },
  faceSlot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
