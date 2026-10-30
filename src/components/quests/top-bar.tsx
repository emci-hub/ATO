import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/motion-tokens';
import { UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_RADIUS, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';

/**
 * Floating pills over the stage: close, chapter progress, Rewind count (and a
 * "For fun" note when nothing will be saved). Every pill is at least 44 pt
 * tall; meaning is in the words, not only the colour.
 */
export function TopBar({
  chapter,
  chapters,
  rewindsLeft,
  onClose,
  onRewind,
  fun,
}: {
  chapter: number;
  chapters: number;
  /** 0 or 1 for the current chapter. */
  rewindsLeft: number;
  onClose: () => void;
  /** Omitted when a Rewind is not possible here (the ending, the Said screen). */
  onRewind?: () => void;
  fun: boolean;
}) {
  const insets = useSafeAreaInsets();
  const canRewind = !!onRewind && rewindsLeft > 0;
  const progress = fmt(UI_COPY.chapterOf, { n: chapter, total: chapters });
  return (
    <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={UI_COPY.close}
        accessibilityHint={UI_COPY.closeHint}
        hitSlop={4}
        onPress={() => {
          haptic.press();
          onClose();
        }}
        style={({ pressed }) => [styles.pill, styles.round, pressed && styles.pressed]}
      >
        <Text style={styles.x}>✕</Text>
      </Pressable>

      <View style={styles.middle} pointerEvents="none">
        <View style={[styles.pill, styles.progress]} accessible accessibilityLabel={progress}>
          <View style={styles.dots}>
            {Array.from({ length: chapters }, (_, i) => (
              <View key={i} style={[styles.dot, i + 1 <= chapter && styles.dotOn]} />
            ))}
          </View>
          <Text style={styles.small}>{progress}</Text>
        </View>
        {fun ? (
          <View style={[styles.pill, styles.funPill]} accessible accessibilityLabel={UI_COPY.funPill}>
            <Text style={styles.small}>{UI_COPY.funPill}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fmt(UI_COPY.rewindCount, { n: rewindsLeft })}
        accessibilityHint={canRewind ? UI_COPY.rewindHint : UI_COPY.rewindNone}
        accessibilityState={{ disabled: !canRewind }}
        disabled={!canRewind}
        hitSlop={4}
        onPress={() => {
          haptic.press();
          onRewind?.();
        }}
        style={({ pressed }) => [styles.pill, styles.rewind, !canRewind && styles.dim, pressed && styles.pressed]}
      >
        <Text style={styles.rewindIcon}>↺</Text>
        <Text style={styles.count}>{rewindsLeft}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: QT_SPACE.gutter,
  },
  pill: {
    minHeight: 44,
    borderRadius: QT_RADIUS.pill,
    backgroundColor: QT.glassFill,
    borderWidth: 1,
    borderColor: QT.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  round: { width: 44 },
  progress: { paddingHorizontal: 14, gap: 8 },
  funPill: { paddingHorizontal: 12, marginTop: 6, minHeight: 32 },
  middle: { alignItems: 'center', flexShrink: 1 },
  rewind: { minWidth: 64, paddingHorizontal: 12, gap: 6 },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  x: { color: QT.text, fontSize: 16, fontWeight: '700' },
  small: { ...QT_TYPE.small, color: QT.text },
  rewindIcon: { color: QT.cyan, fontSize: 18, fontWeight: '700' },
  count: { ...QT_TYPE.number, color: QT.text, fontSize: 18 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { backgroundColor: QT.cyan },
});
