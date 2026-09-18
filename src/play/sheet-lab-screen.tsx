/**
 * Sheet Lab (dev-only) — the sprite-sheet spike's proof screen.
 *
 * Left column: the sprite as it is drawn TODAY, one PNG per frame.
 * Right column: the SAME frames cropped out of one packed sheet.
 * They run off the same frame index, so any drift — wrong crop, blur, a frame
 * off by one, feet sitting differently — reads as a difference between the two
 * columns rather than something you have to remember.
 *
 * Opened from the Play dev kit (Misc → Sheet Lab), which is `PRE_LAUNCH_DEV`
 * only, so this can never render in a production build.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Svg, Image as SvgImage } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { PLAY_ART } from '@/play/generated-play-assets';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { SheetSprite, sheetFrame } from '@/play/sheet-sprite';

/** The spike hero. Its per-frame art is still bundled, so both paths can draw. */
const HERO = 'archangel';
/** Frame advance, ms — fast enough to make a stutter or a bad frame obvious. */
const TICK_MS = 90;
/** Board-units box both columns draw into (the board is a 0..100 viewBox). */
const BOX = 100;

type Row = {
  sheetKey: string;
  clip: string;
  dir: string;
  /** Frame keys inside the sheet, e.g. 'east/frame_000'. */
  frames: string[];
  /** Matching per-frame PLAY_ART keys for the same frames, when present. */
  legacy: (string | undefined)[];
};

/** Pair every packed frame with the per-frame key it was packed from. */
function buildRows(): Row[] {
  const rows: Row[] = [];
  for (const [sheetKey, sheet] of Object.entries(PLAY_SHEETS)) {
    const clip = sheetKey.split('/').pop() ?? sheetKey;
    const byDir = new Map<string, string[]>();
    for (const frameKey of Object.keys(sheet.frames)) {
      // A rotation strip is one frame per facing and plays as a single turn, so
      // it stays one row; an animation splits into a row per direction.
      const dir = frameKey.includes('/') ? frameKey.split('/')[0] : 'turn';
      byDir.set(dir, [...(byDir.get(dir) ?? []), frameKey]);
    }
    for (const [dir, frames] of byDir) {
      // Packed order is playback order (frames in sequence, facings in compass
      // order) — sorting here is what made the rotation strip jump around.
      const sorted = frames;
      rows.push({
        sheetKey,
        clip,
        dir,
        frames: sorted,
        legacy: sorted.map((frameKey) => {
          // Per-frame keys keep the hash-stripped clip folder name, e.g.
          // skins/cast/heroes/archangel/animations/Hover_Idle/east/frame_000 —
          // except the static rotations, which sit in their own folder with no
          // `animations/` segment (skins/.../rotations/east).
          const key =
            clip === 'rotations'
              ? `skins/cast/heroes/${HERO}/rotations/${frameKey}`
              : `skins/cast/heroes/${HERO}/animations/${clip}/${frameKey}`;
          return PLAY_ART[key] ? key : undefined;
        }),
      });
    }
  }
  return rows.sort((a, b) => `${a.clip}${a.dir}`.localeCompare(`${b.clip}${b.dir}`));
}

export function SheetLabScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const rows = useMemo(buildRows, []);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  if (!PRE_LAUNCH_DEV) return null;

  const packedFrames = rows.reduce((n, r) => n + r.frames.length, 0);
  const sheetCount = Object.keys(PLAY_SHEETS).length;

  return (
    <View style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subheading">Sheet Lab — {HERO}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {packedFrames} frames packed into {sheetCount} sheets. Left is today&apos;s
          art (one file per frame), right is the same frame cropped from a sheet.
          They should be identical.
        </ThemedText>

        <View style={styles.controls}>
          <Pressable
            onPress={() => setPlaying((p) => !p)}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause animation' : 'Play animation'}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{playing ? 'Pause' : 'Play'}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setTick((t) => t + 1)}
            accessibilityRole="button"
            accessibilityLabel="Step one frame"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">Step</ThemedText>
          </Pressable>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Back
            </ThemedText>
          </Pressable>
        </View>

        {rows.map((row) => {
          const index = tick % row.frames.length;
          const frameKey = row.frames[index];
          const frame = sheetFrame(row.sheetKey, frameKey);
          const legacyKey = row.legacy[index];
          const legacySource = legacyKey ? PLAY_ART[legacyKey] : undefined;
          return (
            <ThemedView
              key={`${row.sheetKey}-${row.dir}`}
              type="backgroundElement"
              style={styles.card}>
              <ThemedText type="smallBold">
                {row.clip} · {row.dir}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                frame {index + 1}/{row.frames.length}
              </ThemedText>
              <View style={styles.stage}>
                <View style={styles.cell}>
                  <ThemedText type="small" themeColor="textSecondary">
                    per-frame
                  </ThemedText>
                  <Svg width={110} height={110} viewBox={`0 0 ${BOX} ${BOX}`}>
                    {legacySource ? (
                      <SvgImage
                        href={legacySource}
                        x={0}
                        y={0}
                        width={BOX}
                        height={BOX}
                        preserveAspectRatio="none"
                      />
                    ) : null}
                  </Svg>
                </View>
                <View style={styles.cell}>
                  <ThemedText type="small" themeColor="textSecondary">
                    from sheet
                  </ThemedText>
                  <Svg width={110} height={110} viewBox={`0 0 ${BOX} ${BOX}`}>
                    {frame ? <SheetSprite frame={frame} x={0} y={0} size={BOX} /> : null}
                  </Svg>
                </View>
              </View>
            </ThemedView>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  controls: { flexDirection: 'row', gap: Spacing.two },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.one },
  stage: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.two },
  cell: { alignItems: 'center', gap: Spacing.one },
});
