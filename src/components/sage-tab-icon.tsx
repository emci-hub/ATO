import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PixelFace } from '@/components/pixel-face';
import { useMeContext } from '@/lib/me-context';
import { normalizeRecipe } from '@/lib/kenney/registry';

/**
 * Sage tab icon: a small instance of the same pixel character used by the
 * header avatar, real color.
 *
 * Rendered STATIC on purpose: the header avatar is the app's one live /
 * gesture-registering face, and at tab-bar size a second animated instance
 * would be visual noise AND would re-register a gesture handler (competing
 * with the header). A static face keeps the character identity + the
 * aspirational marker without that.
 *
 * Aspirational marker (stubbed): a subtle warm glow ring, distinct from the
 * plain Home/header face. The full growth-tier system is scoped separately and
 * will drive this marker.
 *
 * Native tabs cannot host a React component or untinted image (the native
 * UITabBar template-tints image sources), so this component is used in the web
 * tab bar; native uses a simple face glyph.
 */
export function SageTabIcon() {
  const { me } = useMeContext();
  const recipe = useMemo(() => normalizeRecipe(me?.recipe), [me]);

  if (!me) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.glow} />
      <PixelFace recipe={recipe} size={20} showUp={me.show_up} animated={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Subtle warm "aspirational" halo, cheap and swappable.
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 214, 140, 0.35)',
    borderRadius: 12,
  },
});
