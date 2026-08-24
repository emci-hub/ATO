import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PixelFace } from '@/components/pixel-face';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { LOOKS, SHAPE_BASE_IDS, ShapeRecipe } from '@/lib/recipe';
import { SHAPE_CANVAS } from '@/lib/skeleton';

/**
 * Dev harness for the face skeleton. Not linked from the app: open /pixel-lab
 * directly. The crosshair marks the face anchor, so a face that lands in the
 * same relative spot on every body shape lines up with it in every cell.
 */
const SIZE = 72;

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
            {SHAPE_BASE_IDS.map((base) => (
              <Cell key={base} label={base} recipe={{ source: 'shape', base, top: 'even', hair: null, palette: null }} />
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
                recipe={{ source: 'shape', base: 'squircle', top: look, hair: null, palette: null }}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Cell({ label, recipe }: { label: string; recipe: ShapeRecipe }) {
  return (
    <View style={styles.cell}>
      <View style={{ width: SIZE * SHAPE_CANVAS.w, height: SIZE * SHAPE_CANVAS.h }}>
        <PixelFace recipe={recipe} size={SIZE} showUp="lab" />
        <View style={[styles.guide, styles.guideVertical]} />
        <View style={[styles.guide, styles.guideHorizontal]} />
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
  guide: {
    position: 'absolute',
    backgroundColor: '#00e5ff',
  },
  guideVertical: {
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
  },
  guideHorizontal: {
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
  },
});
