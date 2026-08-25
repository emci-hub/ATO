import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PixelFace } from '@/components/pixel-face';
import { Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { normalizeRecipe } from '@/lib/kenney/registry';

/**
 * Persistent header avatar: a small (~26px) live pixel face, top-right, shown
 * on every tab screen (Home, Sage, Circle, You). It is the ONE always-mounted
 * animated face in the app — it registers as the event-gesture handler, and
 * Home's full-size face is rendered statically so there's never a second
 * gesture-registering instance competing with it.
 */
export function HeaderAvatar() {
  const insets = useSafeAreaInsets();
  const { me } = useMeContext();

  // Memoize so the recipe reference is stable — otherwise the animation
  // layer's effect deps would keep resetting the blink/gesture timers.
  const recipe = useMemo(() => normalizeRecipe(me?.recipe), [me]);

  if (!me) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + Spacing.two }]}>
      <PixelFace recipe={recipe} size={26} showUp={me.show_up} animated />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: Spacing.three,
    zIndex: 100,
  },
});
