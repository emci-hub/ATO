/**
 * Circle visits — what you see (hideout roadmap step 6, plan approved by emci 2026-10-15).
 *
 *  - `CircleSheet`: the float-layer card the Hideout rail's Circle button opens (the away card's
 *    shape): one fixed-height, scrolling list of your Circle (handle · status · share switch · Visit).
 *  - `CircleGiftCard`: a friend's pet left you a gift (a sticker, or a Circle stamp).
 *  - `CircleVisitStrip`: the notice lane while you are in a friend's Hideout ("@name's Hideout").
 * Every box is fixed: loading, empty, error and full lists all keep the same card size.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { CIRCLE_UI, circleGiftIsSticker, friendStatus, type CircleFriend, type CircleGift } from '@/play/circle-visits';
import { VISITOR_STICKER_ART } from '@/play/daily-visitor-ui';
import { RAIL_ICON_ART } from '@/play/hideout-art';
import { heroName } from '@/play/heroes-data';
import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { noticeReduceMotion } from '@/play/notify/notify';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { STREET, STREET_FONT, useStreetFonts } from '@/play/street-ui';

/** What the list shows. */
export type CircleListState =
  | { kind: 'loading' }
  | { kind: 'ok'; friends: CircleFriend[] }
  | { kind: 'signed_out' }
  | { kind: 'off' }
  | { kind: 'error' };

const ROW_H = 56;
const ROW_GAP = 4;
/** Four rows tall, whatever is in it (it scrolls past four). */
const LIST_H = ROW_H * 4 + ROW_GAP * 3;

function useCloseOnBack(onClose: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
}

function FriendRow({
  f,
  busy,
  onToggle,
  onVisit,
}: {
  f: CircleFriend;
  busy: boolean;
  onToggle: (on: boolean) => void;
  onVisit: () => void;
}) {
  const status = friendStatus(f);
  return (
    <View style={styles.row}>
      <View style={styles.who}>
        <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          @{f.handle}
        </Text>
        <Text style={[styles.status, status === 'sharing' && styles.statusOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {CIRCLE_UI.status[status]}
        </Text>
      </View>
      <Switch
        value={f.mine}
        disabled={busy}
        onValueChange={onToggle}
        accessibilityLabel={CIRCLE_UI.share(f.handle, f.mine)}
        trackColor={{ false: 'rgba(255,255,255,0.18)', true: NEON.cyan }}
        thumbColor={f.mine ? STREET.paper : '#9a9aa6'}
      />
      <Pressable
        onPress={onVisit}
        disabled={!f.allowed || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !f.allowed || busy }}
        accessibilityLabel={`${CIRCLE_UI.visit} @${f.handle}`}
        style={({ pressed }) => [styles.visit, (!f.allowed || busy) && styles.dim, pressed && styles.pressed]}>
        <Text style={styles.visitText} maxFontSizeMultiplier={1.1}>
          {CIRCLE_UI.visit}
        </Text>
      </Pressable>
    </View>
  );
}

export function CircleSheet({
  state,
  busyPeer,
  note,
  top,
  onToggle,
  onVisit,
  onClose,
}: {
  state: CircleListState;
  /** A friend whose switch / visit is in flight (their row is disabled). */
  busyPeer: string | null;
  /** One line under the list (a visit that could not open). Kept as a fixed box. */
  note: string | null;
  top: number;
  onToggle: (f: CircleFriend, on: boolean) => void;
  onVisit: (f: CircleFriend) => void;
  onClose: () => void;
}) {
  useStreetFonts();
  useCloseOnBack(onClose);
  const reduced = noticeReduceMotion();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${CIRCLE_UI.sheetTitle}. ${CIRCLE_UI.sheetNote}`);
  }, []);

  const message =
    state.kind === 'loading'
      ? CIRCLE_UI.loading
      : state.kind === 'signed_out'
        ? CIRCLE_UI.signedOut
        : state.kind === 'off'
          ? CIRCLE_UI.off
          : state.kind === 'error'
            ? CIRCLE_UI.error
            : state.friends.length === 0
              ? CIRCLE_UI.empty
              : null;

  const ms = reduced ? 260 : 200;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.Never)}
        exiting={FadeOut.duration(ms).reduceMotion(ReduceMotion.Never)}
        style={[styles.card, { top }]}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {CIRCLE_UI.sheetTitle}
        </Text>
        <Text style={styles.hint} numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {CIRCLE_UI.sheetNote}
        </Text>
        <View style={styles.list}>
          {message != null || state.kind !== 'ok' ? (
            <Text style={styles.message} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : (
            <ScrollView contentContainerStyle={styles.rows} showsVerticalScrollIndicator={state.friends.length > 4}>
              {state.friends.map((f) => (
                <FriendRow
                  key={f.peer}
                  f={f}
                  busy={busyPeer === f.peer}
                  onToggle={(on) => onToggle(f, on)}
                  onVisit={() => onVisit(f)}
                />
              ))}
            </ScrollView>
          )}
        </View>
        <Text style={[styles.note, note == null && styles.hidden]} numberOfLines={1} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
          {note ?? ' '}
        </Text>
        <NeonButton label={CIRCLE_UI.done} variant="secondary" onPress={onClose} />
      </Animated.View>
    </View>
  );
}

/* --------------------------------------------------------------- gift --- */

export function CircleGiftCard({ gift, top, onClose }: { gift: CircleGift; top: number; onClose: () => void }) {
  useStreetFonts();
  useCloseOnBack(onClose);
  const reduced = noticeReduceMotion();
  const hero = gift.look.heroId;
  const sticker = circleGiftIsSticker(hero);
  const label = sticker ? CIRCLE_UI.giftSticker(heroName(hero)) : CIRCLE_UI.giftStamp;
  const title = CIRCLE_UI.giftTitle(gift.handle);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title}. ${label}. ${CIRCLE_UI.giftLine}`);
  }, [title, label]);
  const src = sticker ? VISITOR_STICKER_ART[hero] : RAIL_ICON_ART.star;
  const ms = reduced ? 260 : 200;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.Never)}
        exiting={FadeOut.duration(ms).reduceMotion(ReduceMotion.Never)}
        style={[styles.card, { top }]}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        <View style={styles.giftRow}>
          <View style={styles.giftArt}>
            {src ? (
              <ExpoImage
                source={src}
                contentFit="contain"
                transition={0}
                style={{ width: sticker ? 96 : 56, height: sticker ? 96 : 56, ...pixelRenderStyle }}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </View>
          <View style={styles.giftText}>
            <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {label}
            </Text>
            <Text style={styles.line} numberOfLines={3} maxFontSizeMultiplier={1.2}>
              {CIRCLE_UI.giftLine}
            </Text>
          </View>
        </View>
        <Text style={[styles.hint, !sticker && styles.hidden]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {CIRCLE_UI.giftHint}
        </Text>
        <NeonButton label={CIRCLE_UI.keep} variant="secondary" onPress={onClose} />
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------- visiting strip --- */

/** The notice lane while visiting: whose Hideout this is, and one status line (fixed, two lines max). */
export function CircleVisitStrip({ handle, note }: { handle: string; note: string | null }) {
  useStreetFonts();
  return (
    <View style={styles.strip} accessibilityLiveRegion="polite">
      <Text style={styles.stripTitle} numberOfLines={1} maxFontSizeMultiplier={1.1}>
        {CIRCLE_UI.visiting(handle)}
      </Text>
      <Text style={styles.stripNote} numberOfLines={1} maxFontSizeMultiplier={1.1}>
        {note ?? CIRCLE_UI.visitingNote}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 12,
    left: 12,
    maxWidth: 360,
    alignSelf: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    backgroundColor: NEON.panel,
  },
  title: { fontFamily: STREET_FONT.bold, fontSize: 16, color: NEON.cyan, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, color: NEON.textMuted },
  list: { height: LIST_H },
  rows: { gap: ROW_GAP },
  message: { fontFamily: STREET_FONT.regular, fontSize: 15, lineHeight: 20, color: NEON.textPrimary, paddingTop: 8 },
  note: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, height: 18, color: STREET.mustard },
  hidden: { opacity: 0 },
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  who: { flex: 1, minWidth: 0 },
  handle: { fontFamily: STREET_FONT.bold, fontSize: 15, lineHeight: 19, color: NEON.textPrimary },
  status: { fontFamily: STREET_FONT.regular, fontSize: 12, lineHeight: 16, color: NEON.textMuted },
  statusOn: { color: NEON.cyan },
  visit: {
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: STREET.mustard,
  },
  visitText: { fontFamily: STREET_FONT.bold, fontSize: 14, color: STREET.mustard },
  dim: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  giftRow: { flexDirection: 'row', gap: 12, alignItems: 'center', height: 96 },
  giftArt: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  giftText: { flex: 1, gap: 4 },
  label: { fontFamily: STREET_FONT.bold, fontSize: 13, lineHeight: 16, color: STREET.mustard },
  line: { fontFamily: STREET_FONT.regular, fontSize: 15, lineHeight: 20, height: 60, color: NEON.textPrimary },
  strip: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(8,9,15,0.72)' },
  stripTitle: { fontFamily: STREET_FONT.bold, fontSize: 14, lineHeight: 17, color: STREET.mustard, textAlign: 'center' },
  stripNote: { fontFamily: STREET_FONT.regular, fontSize: 12, lineHeight: 15, color: STREET.paper, textAlign: 'center' },
});
