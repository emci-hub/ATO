import { useEffect } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { registerGestureHandler } from '@/lib/kenney/gesture-actions';
import { isHiddenState, resolveCharacter } from '@/lib/kenney/registry';
import { useKenneyAnimation } from '@/lib/kenney/use-kenney-animation';
import type { TapMood } from '@/lib/kenney/tap-moods';
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
 *
 * `celebrateRef` (optional) receives the milestone `celebrate()` callback so a
 * parent (the nav companion) can fire the one-time louder animation on a
 * milestone crossing without the wrapper needing to know why.
 * `tapMoodRef` receives `playTapMood` for the nav companion's tap handler.
 */
export function AnimatedKenneyCharacter({
  recipe,
  size,
  celebrateRef,
  tapMoodRef,
  pressable = true,
}: KenneyCharacterProps & {
  celebrateRef?: React.RefObject<(() => void) | null>;
  tapMoodRef?: React.RefObject<((mood: TapMood) => void) | null>;
  /** When false, the parent owns the press target (nav companion). */
  pressable?: boolean;
}) {
  const { style, overrides, squash, gesture, celebrate, playTapMood } = useKenneyAnimation(recipe);
  const effective = overrides
    ? { ...recipe, parts: { ...recipe.parts, ...overrides } }
    : recipe;

  // Register this face as a recipient of event gestures (check/talk/circle/
  // share). Unmount unregisters.
  useEffect(() => registerGestureHandler(gesture), [gesture]);

  // Expose the celebration callback to the parent once available.
  useEffect(() => {
    if (celebrateRef) celebrateRef.current = celebrate;
  }, [celebrateRef, celebrate]);

  useEffect(() => {
    if (tapMoodRef) tapMoodRef.current = playTapMood;
  }, [tapMoodRef, playTapMood]);

  const body = (
    <Animated.View style={style}>
      <KenneyCharacter recipe={effective} size={size} />
    </Animated.View>
  );

  if (!pressable) return body;

  return (
    <Pressable onPress={squash} hitSlop={6}>
      {body}
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
