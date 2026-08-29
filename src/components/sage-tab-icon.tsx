import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GrowthMarkers } from '@/components/growth-markers';
import { PixelFace } from '@/components/pixel-face';
import { useGrowth } from '@/hooks/use-growth';
import { useMeContext } from '@/lib/me-context';
import { recipeForAccount } from '@/lib/kenney/registry';
import { resolveFacePalette } from '@/lib/color';

/**
 * Sage tab icon: a small instance of the same pixel character, real color,
 * with growth-tier markers (presence glow + depth sparkle).
 *
 * Rendered STATIC on purpose: the nav companion is the app's live /
 * gesture-registering instance. At tab-bar size a second animated face would
 * be visual noise and would re-register a competing gesture handler.
 *
 * Native tabs cannot host a React component or untinted image (the native
 * UITabBar template-tints image sources), so this component is used in the web
 * tab bar; native uses a simple face glyph.
 */
export function SageTabIcon() {
  const { me } = useMeContext();
  const { state } = useGrowth();
  const recipe = useMemo(() => recipeForAccount(me?.id, me?.recipe), [me]);

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
