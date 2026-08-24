import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PixelFace } from '@/components/pixel-face';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { SHAPE_MANIFEST } from '@/lib/kenney/manifests/shape';
import { DEFAULT_RECIPE } from '@/lib/kenney/registry';

/**
 * Dev harness for the Kenney pipeline. Not linked from the app: open
 * /pixel-lab directly. Shows one face across every body shape, then every look
 * on one body — driven entirely by the Shape Characters manifest.
 */
const SIZE = 72;
const BODY_STATES = Object.keys(SHAPE_MANIFEST.parts.find((p) => p.id === 'body')!.states);
const LOOKS = Object.keys(SHAPE_MANIFEST.parts.find((p) => p.id === 'face')!.states);

export default function PixelLabScreen() {
  if (!__DEV__) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Dev only.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
});
