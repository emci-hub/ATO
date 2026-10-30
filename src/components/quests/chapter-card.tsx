import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { EASE_OUT } from '@/lib/motion-tokens';
import { UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_TYPE } from '@/lib/quests/theme';
import { TYPE } from '@/lib/quests/view';

/**
 * The chapter title card: the title types at 40 ms a letter, a cyan rule draws
 * in, 1.2 s in all; tap to skip. Reduce Motion: 600 ms fades. `onDone` fires
 * once, whether the card ran out or was skipped.
 */
export function ChapterCard({ chapter, subtitle, onDone }: { chapter: number; subtitle: string; onDone: () => void }) {
  const rm = useMotionReduced();
  const title = fmt(UI_COPY.chapterTitle, { n: chapter });
  const [chars, setChars] = useState(rm ? title.length : 0);
  const rule = useSharedValue(rm ? 1 : 0);

  useEffect(() => {
    let finished = false;
    const end = () => {
      if (!finished) {
        finished = true;
        onDone();
      }
    };
    if (rm) {
      const t = setTimeout(end, 600 + 400);
      return () => clearTimeout(t);
    }
    const typeMs = title.length * TYPE.chapterCharMs;
    const id = setInterval(() => setChars((c) => Math.min(title.length, c + 1)), TYPE.chapterCharMs);
    const stop = setTimeout(() => clearInterval(id), typeMs + 5);
    rule.value = withDelay(typeMs, withTiming(1, { duration: Math.max(200, TYPE.chapterTotalMs - typeMs), easing: EASE_OUT }));
    const done = setTimeout(end, TYPE.chapterTotalMs);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
      clearTimeout(done);
    };
    // One run per card; a new chapter is a new card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: rule.value }], opacity: rule.value }));

  return (
    <Animated.View
      entering={FadeIn.duration(rm ? 600 : 200)}
      exiting={FadeOut.duration(rm ? 600 : 200)}
      style={styles.cover}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityHint={UI_COPY.tapToFinish}
        onPress={onDone}
        style={styles.fill}
      >
        <View style={styles.center}>
          <Text style={styles.title}>{title.slice(0, chars)}</Text>
          <Animated.View style={[styles.rule, ruleStyle]} />
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,11,22,0.94)', zIndex: 20 },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  title: { ...QT_TYPE.display, color: QT.text, minHeight: 44, textAlign: 'center' },
  rule: { width: 140, height: 3, borderRadius: 2, backgroundColor: QT.cyan },
  sub: { ...QT_TYPE.small, color: QT.sub, textAlign: 'center' },
});
