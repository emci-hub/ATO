import { StyleSheet, View } from 'react-native';

import {
  DEPTH_SPARKLE_ALPHA,
  neonGlowColors,
  presenceGlowLayersForTier,
  PRESENCE_GLOW_LAYERS,
} from '@/lib/growth';

/**
 * The two growth-tier visual markers, rendered behind/around a pixel face:
 *
 * 1. Presence glow — a layered neon treatment in the character's OWN color:
 *    a bright near-white core at the edge, then the accent color as softer
 *    halos further out (2-3 concentric layers, decreasing opacity, increasing
 *    scale). Tiers add more layers (1 → core, 2 → +halo, 3 → +outer), not just
 *    a higher opacity on one flat blur. Uses solid tinted ellipses instead of
 *    real blur — cheap and smooth to animate (opacity/scale, not blur radius).
 *    Tier 0 renders NOTHING (matches Home's plain look exactly).
 * 2. Depth sparkle — a sharp small 4-point white star (no blur), deliberately a
 *    different mechanism from the soft glow so the two signals stay separate.
 */
export function GrowthMarkers({
  presence,
  depth,
  color,
}: {
  presence: number;
  depth: number;
  /** The character's resolved palette color (hex or hsl). Drives the glow hue. */
  color?: string | null;
}) {
  const sparkleAlpha = DEPTH_SPARKLE_ALPHA[depth] ?? 0;
  const glowLayerCount = presenceGlowLayersForTier(presence);
  const colors = neonGlowColors(color ?? 'hsla(45, 90%, 60%, 1)');

  return (
    <View style={styles.wrap} pointerEvents="none">
      {glowLayerCount > 0
        ? PRESENCE_GLOW_LAYERS.slice(0, glowLayerCount).map((layer, i) => (
            <View
              key={layer.key}
              style={[
                styles.glowLayer,
                {
                  backgroundColor: colors[layer.key],
                  transform: [{ scale: layer.scale }],
                  // Inner layers sit on top of outer ones for a natural falloff.
                  zIndex: PRESENCE_GLOW_LAYERS.length - i,
                },
              ]}
            />
          ))
        : null}
      {sparkleAlpha > 0 ? (
        <View style={[styles.sparkle, { opacity: sparkleAlpha }]}>
          <View style={[styles.spark, styles.sparkVertical]} />
          <View style={[styles.spark, styles.sparkHorizontal]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Each layer is a solid tinted ellipse; layering at increasing scale mimics
  // a soft gradient falloff without real blur (cheap + animatable).
  glowLayer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  // Depth sparkle: a small 4-point star, sharp edges (no blur), distinct shape.
  sparkle: {
    position: 'absolute',
    width: 10,
    height: 10,
    top: 1,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  sparkVertical: {
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  sparkHorizontal: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
});
