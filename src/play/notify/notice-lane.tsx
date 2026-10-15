/**
 * The NoticeLane (Divecore Phase 2, 2026-10-14) — the one place a Play notice shows.
 *
 * GameScreen draws it in its fixed notice region on every game screen (Hideout, Turf War, Dive,
 * pet games, list screens), so it sits under the top bar by LAYOUT (no measured or hard-coded top)
 * and can never resize a region or push the stage. When the queue has a notice for the top-most
 * lane it shows that, one line; otherwise the screen's own idle line (pet strip, swipe hint, coach
 * or paused line, the Dive caption). Tap = go to its target, or close it.
 * Reduce Motion = a gentle 200 ms fade with a 2 px drift — never instant, never still.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { mountLane, noticeReduceMotion, tapNotice, useNotices } from '@/play/notify/notify';
import { noticeAnnouncement, type Notice, type NoticeKind } from '@/play/notify/queue';
import { SPACE } from '@/play/stage-frame';
import { STREET, STREET_FONT, StreetBackdrop, useStreetFonts } from '@/play/street-ui';

const FADE_MS = 220;
const DRIFT_PX = 8;
const REDUCED_FADE_MS = 200;
const REDUCED_DRIFT_PX = 2;

function enter(drift: number, ms: number): EntryExitAnimationFunction {
  return () => {
    'worklet';
    const cfg = { duration: ms, reduceMotion: ReduceMotion.Never };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: -drift }] },
      animations: { opacity: withTiming(1, cfg), transform: [{ translateY: withTiming(0, cfg) }] },
    };
  };
}

function leave(ms: number): EntryExitAnimationFunction {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 1 },
      animations: { opacity: withTiming(0, { duration: ms, reduceMotion: ReduceMotion.Never }) },
    };
  };
}

/** Title colour per kind: errors in tag red, the rest in ink (the mustard tab is the art's). */
const TITLE_COLOR: Record<NoticeKind, string> = {
  celebrate: STREET.ink,
  notify: STREET.ink,
  error: STREET.red,
};
const KIND_MARK: Record<NoticeKind, string> = { celebrate: '★ ', notify: '', error: '! ' };

export function NoticeLane({ height, idle }: { height: number; idle?: ReactNode }) {
  const { queue, topLane } = useNotices();
  // Pixelify for the title on every screen (Dive and the pet games don't load it themselves).
  useStreetFonts();
  const [laneId, setLaneId] = useState<number | null>(null);
  useEffect(() => {
    const lane = mountLane();
    setLaneId(lane.id);
    return lane.unmount;
  }, []);
  const shown: Notice | null = laneId != null && topLane === laneId ? queue.showing : null;

  useEffect(() => {
    // iOS ignores live regions, so it is told; Android reads the live region (not both).
    if (shown && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(noticeAnnouncement(shown));
    // Announce once per notice (a ×N bump re-reads through the live region).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.id]);

  const reduced = noticeReduceMotion();
  const ms = reduced ? REDUCED_FADE_MS : FADE_MS;
  const drift = reduced ? REDUCED_DRIFT_PX : DRIFT_PX;
  const thin = height < 40;

  return (
    <View style={[styles.lane, { height }]}>
      {shown ? (
        <Animated.View key={`n${shown.id}`} entering={enter(drift, ms)} exiting={leave(ms)} style={styles.fill}>
          <Pressable
            onPress={() => tapNotice(shown)}
            accessibilityRole="button"
            accessibilityLabel={noticeAnnouncement(shown)}
            accessibilityHint={shown.target ? 'Opens it' : 'Closes the notice'}
            accessibilityLiveRegion="polite"
            style={[styles.card, { marginVertical: thin ? 0 : SPACE.xs }]}>
            <StreetBackdrop piece="toast" />
            <Text style={styles.line} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              <Text style={[styles.title, { color: TITLE_COLOR[shown.kind] }]}>
                {KIND_MARK[shown.kind]}
                {shown.title}
                {shown.count > 1 ? ` ×${shown.count}` : ''}
              </Text>
              {shown.body ? <Text style={styles.body}>{`  ${shown.body}`}</Text> : null}
            </Text>
            {shown.target ? (
              <Text style={styles.go} maxFontSizeMultiplier={1.2}>
                ›
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : idle != null ? (
        <Animated.View key="idle" entering={enter(0, ms)} style={styles.fill} accessibilityLiveRegion="polite">
          {idle}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lane: { overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACE.s,
    paddingLeft: 32,
    paddingRight: SPACE.m,
  },
  line: { flex: 1, color: STREET.asphalt },
  title: { fontFamily: STREET_FONT.bold, fontSize: 14, textTransform: 'uppercase' },
  body: { fontSize: 13, color: STREET.asphalt },
  go: { fontFamily: STREET_FONT.bold, fontSize: 18, color: STREET.ink, marginLeft: SPACE.s },
});
