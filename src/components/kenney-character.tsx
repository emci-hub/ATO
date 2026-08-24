import { useEffect } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { registerGestureHandler } from '@/lib/kenney/gesture-actions';
import { isHiddenState, resolveCharacter } from '@/lib/kenney/registry';
import { useKenneyAnimation } from '@/lib/kenney/use-kenney-animation';
import type { KenneyRecipe } from '@/lib/kenney/types';
import { KENNEY_ASSETS } from '@/lib/kenney/generated-assets';

interface KenneyCharacterProps {
  recipe: KenneyRecipe;
  /** Side of the body box in points; parts scale off it. */
  size: number;
}

/**
 * The generic Kenney renderer. Takes a recipe + manifest (resolved via the
 * registry) and composes the layered image. There is deliberately ZERO
 * family-specific logic here — a new pack is "write a manifest + run prep",
 * never a branch in this component.
 */
export function KenneyCharacter({ recipe, size }: KenneyCharacterProps) {
  const { manifest, layers } = resolveCharacter(recipe);
  const originX = ((manifest.canvas.w - 1) * size) / 2;

  return (
    <View
      style={{
        width: size * manifest.canvas.w,
        height: size * manifest.canvas.h,
      }}>
      {layers.map((layer) => {
        // Double guard: `hidden` states never render (hands at rest / crisis).
        if (isHiddenState(layer.sprite)) return null;
        const asset = KENNEY_ASSETS[layer.key];
        if (!asset) return null;
        return layer.instances.map((instance, index) => {
          const width = layer.sprite.size.w * size * instance.anchor.scale;
          const height = layer.sprite.size.h * size * instance.anchor.scale;
          const left = originX + instance.anchor.x * size - width / 2;
          const top = instance.anchor.y * size - height / 2;
          return (
            <Image
              key={`${layer.partId}:${index}`}
              source={asset}
              contentFit="contain"
              style={[
                styles.layer,
                instance.flip && styles.flip,
                { width, height, left, top },
              ]}
            />
          );
        });
      })}
    </View>
  );
}

/**
 * The animated wrapper: applies the manifest-driven discrete state swaps and
 * the procedural idle transforms (breathe/bob/tilt) to the composed group, and
 * a squash on tap. It only sees the assembled result — it never knows which
 * family is active.
 */
export function AnimatedKenneyCharacter({ recipe, size }: KenneyCharacterProps) {
  const { style, overrides, squash, gesture } = useKenneyAnimation(recipe);
  const effective = overrides
    ? { ...recipe, parts: { ...recipe.parts, ...overrides } }
    : recipe;

  // Register this face as a recipient of event gestures (check/talk/circle/
  // share). Unmount unregisters.
  useEffect(() => registerGestureHandler(gesture), [gesture]);

  return (
    <Pressable onPress={squash} hitSlop={6}>
      <Animated.View style={style}>
        <KenneyCharacter recipe={effective} size={size} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
  flip: {
    transform: [{ scaleX: -1 }],
  },
});
