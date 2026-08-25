import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GrowthMarkers } from '@/components/growth-markers';
import { PixelFace } from '@/components/pixel-face';
import { useGrowth } from '@/hooks/use-growth';
import { useMeContext } from '@/lib/me-context';
import { normalizeRecipe } from '@/lib/kenney/registry';
import { resolveFacePalette } from '@/lib/color';

/**
 * Sage tab icon: a small instance of the same pixel character used by the
 * header avatar, real color, with the growth-tier markers (presence glow +
 * depth sparkle) applied so it matches the header avatar's aspirational look.
 *
 * Rendered STATIC on purpose: the header avatar is the app's one live /
 * gesture-registering face, and at tab-bar size a second animated instance
 * would be visual noise AND would re-register a gesture handler (competing
 * with the header). A static face keeps the character identity + the markers
 * without that.
 *
 * Native tabs cannot host a React component or untinted image (the native
 * UITabBar template-tints image sources), so this component is used in the web
 * tab bar; native uses a simple face glyph.
 */
export function SageTabIcon() {
  const { me } = useMeContext();
  const { state } = useGrowth();
  const recipe = useMemo(() => normalizeRecipe(me?.recipe), [me]);

  if (!me) return null;

  return (
    <View style={styles.wrap}>
      <GrowthMarkers
        presence={state.presence}
        depth={state.depth}
        color={resolveFacePalette(recipe.palette, me.show_up)}
      />
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
});
