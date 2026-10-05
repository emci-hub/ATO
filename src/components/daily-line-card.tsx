import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PixelFace } from '@/components/pixel-face';
import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DAILY_LINE_COPY_REVIEWED } from '@/lib/daily-line/bank';
import { isStarterLine, type LineReaction } from '@/lib/daily-line/pick';
import type { TodayLine } from '@/lib/daily-line/state';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { TAP_MOODS, type TapMood } from '@/lib/kenney/tap-moods';
import type { KenneyRecipe } from '@/lib/kenney/types';
import { controlBorderColor } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';

export const DAILY_LINE_KICKER = 'today';
export const DAILY_LINE_ME_LABEL = 'That’s me';
export const DAILY_LINE_NOT_ME_LABEL = 'Not me';
export const DAILY_LINE_SHARE_LABEL = 'Share';
/** Under a line that was picked for nobody in particular. */
export const DAILY_LINE_STARTER_NOTE =
  'A general one for now. Answer more questions and this starts being about you.';
export const DAILY_LINE_REACTED_NOTE = 'Noted. It shapes the lines you get next.';

/**
 * The first thing on Home: today's written line, a one-tap reaction, and a way
 * to send it to someone. No AI, no network, no consent needed — it shows in
 * every Home state, including before the 50 questions are done.
 */
export function DailyLineCard({
  today,
  me,
  onReact,
  face,
}: {
  today: TodayLine;
  me: SharePerson;
  onReact: (reaction: LineReaction) => void;
  /**
   * The mini guy, who says the line (polish pass, emci 2026-10-05). He gives
   * a thumbs-up on "That's me". Still under Reduce Motion.
   */
  face?: KenneyRecipe;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [sharing, setSharing] = useState(false);
  const border = controlBorderColor(theme);
  const tapMoodRef = useRef<((mood: TapMood) => void) | null>(null);

  function chip(reaction: LineReaction, label: string) {
    const on = today.reaction === reaction;
    return (
      <ThemedPressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        onPress={() => {
          if (reaction === 'me' && !on) tapMoodRef.current?.(TAP_MOODS.thumbsUp);
          onReact(reaction);
        }}
        style={[styles.chip, { borderColor: border }, on && { backgroundColor: theme.text }]}>
        <ThemedText type="smallBold" style={on ? { color: theme.background } : undefined}>
          {label}
        </ThemedText>
      </ThemedPressable>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.topRow}>
        {face ? (
          <View style={styles.face}>
            <PixelFace
              recipe={face}
              size={44}
              showUp={me.show_up}
              animated={!reduceMotion}
              tapMoodRef={tapMoodRef}
              pressable={false}
            />
          </View>
        ) : null}
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          {DAILY_LINE_KICKER}
        </ThemedText>
      </View>
      {!DAILY_LINE_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}

      {/* The line, said by the mini guy: a speech bubble with its tail up
          toward him. */}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: theme.background,
            borderColor: border,
            borderRadius: theme.cutCorners ? 0 : Math.min(theme.radius, 18),
          },
        ]}>
        {face ? (
          <View
            style={[styles.tail, { backgroundColor: theme.background, borderColor: border }]}
          />
        ) : null}
        <ThemedText style={styles.line}>{today.line.text}</ThemedText>
      </View>

      {isStarterLine(today.line) ? (
        <ThemedText type="small" themeColor="textSecondary">
          {DAILY_LINE_STARTER_NOTE}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        {chip('me', DAILY_LINE_ME_LABEL)}
        {chip('not_me', DAILY_LINE_NOT_ME_LABEL)}
        <View style={styles.spacer} />
        {/* An AI-written line has been read by nobody but its owner, so it
            stays in the app: no share image, and no push (lockScreenText). */}
        {today.line.source === 'authored' ? (
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="Share today’s line"
            onPress={() => setSharing(true)}
            style={[styles.chip, { borderColor: border }]}>
            <ThemedText type="smallBold">{DAILY_LINE_SHARE_LABEL}</ThemedText>
          </ThemedPressable>
        ) : null}
      </View>
      {today.reaction ? (
        <ThemedText type="small" themeColor="textSecondary">
          {DAILY_LINE_REACTED_NOTE}
        </ThemedText>
      ) : null}

      <ShareCardSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        me={me}
        content={{ kind: 'line', text: today.line.text }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  face: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bubble: {
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  tail: {
    position: 'absolute',
    top: -7,
    left: 22,
    width: 12,
    height: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  kicker: {
    textTransform: 'uppercase',
  },
  line: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  spacer: {
    flex: 1,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
