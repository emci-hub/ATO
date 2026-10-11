import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Fonts } from '@/constants/theme';
import { NEON } from '@/play/neon-viper';
import { BANNER_MS, type Banner } from '@/play/play-banner-queue';
import { STREET, STREET_FONT, StreetBackdrop, streetUiOn } from '@/play/street-ui';

/**
 * The one floating Play banner (v25, 2026-09-30). Absolute over every Play
 * screen — never inside scrolling content — just below each screen's top bar,
 * so the back button and top icons stay tappable. Slides down, stays
 * ~3s, swipe up to dismiss, tap to go where it points. `play.tsx` keeps the
 * queue; this shows `banner` and calls `onDismiss` / `onTap` once.
 */
const TOP_BAR_H = 52;
const SLIDE_MS = 220;
const SWIPE_UP_PX = 24;

export function PlayBanner({
  banner,
  reduceMotion,
  onDismiss,
  onTap,
}: {
  banner: Banner;
  reduceMotion: boolean;
  onDismiss: (id: number) => void;
  onTap: (banner: Banner) => void;
}) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(reduceMotion ? 0 : -120);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const done = useRef(false);

  // Latest callbacks for the timers / gesture without re-arming them.
  const cb = useRef({ onDismiss, onTap });
  cb.current = { onDismiss, onTap };

  const leave = useMemo(
    () => (then: 'dismiss' | 'tap') => {
      if (done.current) return;
      done.current = true;
      const finish = () => (then === 'tap' ? cb.current.onTap(banner) : cb.current.onDismiss(banner.id));
      if (reduceMotion || then === 'tap') {
        finish();
        return;
      }
      opacity.value = withTiming(0, { duration: SLIDE_MS });
      // Finish even if the slide-out is interrupted, so the queue never stalls.
      y.value = withTiming(-120, { duration: SLIDE_MS }, () => {
        scheduleOnRN(finish);
      });
    },
    [banner, opacity, reduceMotion, y],
  );

  useEffect(() => {
    done.current = false;
    if (!reduceMotion) {
      y.value = withTiming(0, { duration: SLIDE_MS });
      opacity.value = withTiming(1, { duration: SLIDE_MS });
    }
    const t = setTimeout(() => leave('dismiss'), BANNER_MS);
    return () => clearTimeout(t);
  }, [banner.id, leave, opacity, reduceMotion, y]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => !done.current && g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (!done.current && g.dy < 0) y.value = g.dy;
        },
        onPanResponderRelease: (_e, g) => {
          if (done.current) return;
          if (g.dy < -SWIPE_UP_PX) leave('dismiss');
          else y.value = withTiming(0, { duration: 120 });
        },
        onPanResponderTerminate: () => {
          if (!done.current) y.value = withTiming(0, { duration: 120 });
        },
      }),
    [leave, y],
  );

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: y.value }] }));
  // Streetwear art style: the paper sticker toast (mustard tab on the left).
  const street = streetUiOn();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + TOP_BAR_H }]}>
      <Animated.View style={[styles.card, street && styles.streetCard, style]} {...pan.panHandlers}>
        {street ? <StreetBackdrop piece="toast" /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${banner.title}. ${banner.body}`}
          accessibilityHint={banner.target ? 'Opens it' : 'Dismisses the notice'}
          onPress={() => leave(banner.target ? 'tap' : 'dismiss')}
          style={[styles.press, street && styles.streetPress]}>
          <Text style={[styles.title, street && styles.streetTitle]} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={[styles.body, street && styles.streetBody]} numberOfLines={3}>
            {banner.body}
          </Text>
          <View style={[styles.grip, street && styles.streetGrip]} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Streetwear art style.
  streetCard: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0 },
  streetPress: { paddingLeft: 40, paddingRight: 16, paddingTop: 12, paddingBottom: 10 },
  streetTitle: { fontFamily: STREET_FONT.bold, fontSize: 15, color: STREET.ink, textTransform: 'uppercase' },
  streetBody: { color: '#2B2B2E' },
  streetGrip: { backgroundColor: '#2B2B2E', borderRadius: 0 },
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 50, elevation: 50 },
  card: {
    backgroundColor: NEON.panel,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  press: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 2 },
  title: { fontFamily: Fonts.monoBold, fontSize: 14, color: NEON.cyan },
  body: { fontSize: 13, lineHeight: 18, color: NEON.textPrimary },
  grip: {
    alignSelf: 'center',
    marginTop: 6,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: NEON.cyanDim,
  },
});
