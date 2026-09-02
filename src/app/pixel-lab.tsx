import { Redirect } from 'expo-router';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GrowthMarkers } from '@/components/growth-markers';
import { PixelFace } from '@/components/pixel-face';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { resolveFacePalette } from '@/lib/color';
import { SHAPE_MANIFEST } from '@/lib/kenney/manifests/shape';
import { DEFAULT_RECIPE } from '@/lib/kenney/registry';

/**
 * Dev harness for the Kenney pipeline + growth tiers. Not linked from the app:
 * open /pixel-lab directly (dev-only). Shows one face across every body shape,
 * every look on one body, and a growth-tier preview panel where presence and
 * depth tiers can be forced independently and the milestone celebration fired
 * on demand — all bypassing real check/facts data and the once-only gate.
 */
const SIZE = 72;
const BODY_STATES = Object.keys(SHAPE_MANIFEST.parts.find((p) => p.id === 'body')!.states);
const LOOKS = Object.keys(SHAPE_MANIFEST.parts.find((p) => p.id === 'face')!.states);

export default function PixelLabScreen() {
  if (!PRE_LAUNCH_DEV) {
    return <Redirect href="/" />;
  }

  return <PixelLab />;
}

function PixelLab() {
  const [presence, setPresence] = useState(0);
  const [depth, setDepth] = useState(0);
  const celebrateRef = useRef<(() => void) | null>(null);

  const recipe = { ...DEFAULT_RECIPE, parts: { ...DEFAULT_RECIPE.parts } };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Pixel lab</ThemedText>
            <ThemedText themeColor="textSecondary">
              Same face across every body shape, then every look on one body.
            </ThemedText>
          </View>

          <ThemedText type="code" themeColor="textSecondary">
            one face · four bodies
          </ThemedText>
          <View style={styles.row}>
            {BODY_STATES.map((body) => (
              <Cell
                key={body}
                label={body}
                recipe={{ ...DEFAULT_RECIPE, parts: { ...DEFAULT_RECIPE.parts, body } }}
              />
            ))}
          </View>

          <ThemedText type="code" themeColor="textSecondary">
            five looks · one body
          </ThemedText>
          <View style={styles.row}>
            {LOOKS.map((look) => (
              <Cell
                key={look}
                label={look}
                recipe={{ ...DEFAULT_RECIPE, parts: { ...DEFAULT_RECIPE.parts, face: look } }}
              />
            ))}
          </View>

          {/* ---- Growth-tier preview (dev-only) ---- */}
          <View style={styles.growthSection}>
            <ThemedText type="code" themeColor="textSecondary">
              growth tiers · preview
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Forces presence (glow) and depth (sparkle) independently,
              overriding real check_count / facts. Dev-only.
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.previewCard}>
              <View style={styles.previewSlot}>
                <GrowthMarkers
                  presence={presence}
                  depth={depth}
                  color={resolveFacePalette(recipe.palette, 'lab')}
                />
                <PixelFace
                  recipe={recipe}
                  size={56}
                  showUp="lab"
                  animated
                  celebrateRef={celebrateRef}
                />
              </View>

              <View style={styles.previewMeta}>
                <ThemedText type="code" themeColor="textSecondary">
                  presence {presence} · depth {depth}
                </ThemedText>
              </View>
            </ThemedView>

            <ThemedText type="smallBold" themeColor="textSecondary">
              Presence tier (glow)
            </ThemedText>
            <View style={styles.row}>
              {[0, 1, 2, 3].map((tier) => (
                <TierButton
                  key={`p${tier}`}
                  label={String(tier)}
                  active={presence === tier}
                  onPress={() => setPresence(tier)}
                />
              ))}
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary">
              Depth tier (sparkle)
            </ThemedText>
            <View style={styles.row}>
              {[0, 1, 2].map((tier) => (
                <TierButton
                  key={`d${tier}`}
                  label={String(tier)}
                  active={depth === tier}
                  onPress={() => setDepth(tier)}
                />
              ))}
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary">
              Milestone celebration (on demand)
            </ThemedText>
            <View style={styles.row}>
              <Pressable
                onPress={() => celebrateRef.current?.()}
                style={({ pressed }) => [
                  styles.celebrateButton,
                  { backgroundColor: '#3c87f7' },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.celebrateText}>
                  Preview celebration
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Fires the louder milestone burst (bypasses the once-only gate).
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function TierButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tierButton,
        active && styles.tierButtonActive,
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Cell({ label, recipe }: { label: string; recipe: typeof DEFAULT_RECIPE }) {
  return (
    <View style={styles.cell}>
      <View style={{ width: SIZE * SHAPE_MANIFEST.canvas.w, height: SIZE * SHAPE_MANIFEST.canvas.h }}>
        <PixelFace recipe={recipe} size={SIZE} animated={false} />
      </View>
      <ThemedText type="code" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  cell: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  growthSection: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  previewCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  previewSlot: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMeta: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  tierButton: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.4)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minWidth: 40,
    alignItems: 'center',
  },
  tierButtonActive: {
    backgroundColor: '#3c87f7',
    borderColor: '#3c87f7',
  },
  celebrateButton: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  celebrateText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
});
