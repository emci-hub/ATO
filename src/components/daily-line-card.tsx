import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DAILY_LINE_COPY_REVIEWED } from '@/lib/daily-line/bank';
import { isStarterLine, type LineReaction } from '@/lib/daily-line/pick';
import type { TodayLine } from '@/lib/daily-line/state';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { controlBorderColor } from '@/lib/theme/chrome';

export const DAILY_LINE_KICKER = 'today';
export const DAILY_LINE_ME_LABEL = 'That’s me';
export const DAILY_LINE_NOT_ME_LABEL = 'Not me';
export const DAILY_LINE_SHARE_LABEL = 'Share';
/** Under a line that was picked for nobody in particular. */
export const DAILY_LINE_STARTER_NOTE =
  'A general one for now. Answer more questions and this starts being about you.';
export const DAILY_LINE_REACTED_NOTE = 'Noted. It shapes the lines you get next.';

export function streakLabel(streak: number): string | null {
  if (streak < 2) return null;
  return `${streak} days in a row`;
}

/**
 * The first thing on Home: today's written line, a one-tap reaction, and a way
 * to send it to someone. No AI, no network, no consent needed — it shows in
 * every Home state, including before the 50 questions are done.
 */
export function DailyLineCard({
  today,
  me,
  onReact,
}: {
  today: TodayLine;
  me: SharePerson;
  onReact: (reaction: LineReaction) => void;
}) {
  const theme = useTheme();
  const [sharing, setSharing] = useState(false);
  const streak = streakLabel(today.streak);
  const border = controlBorderColor(theme);

  function chip(reaction: LineReaction, label: string) {
    const on = today.reaction === reaction;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        onPress={() => onReact(reaction)}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: border },
          on && { backgroundColor: theme.text },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={on ? { color: theme.background } : undefined}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.topRow}>
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          {DAILY_LINE_KICKER}
        </ThemedText>
        {streak ? (
          <ThemedText type="code" themeColor="textSecondary">
            {streak}
          </ThemedText>
        ) : null}
      </View>
      {!DAILY_LINE_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}

      <ThemedText style={styles.line}>{today.line.text}</ThemedText>

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share today’s line"
            onPress={() => setSharing(true)}
            style={({ pressed }) => [styles.chip, { borderColor: border }, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{DAILY_LINE_SHARE_LABEL}</ThemedText>
          </Pressable>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  pressed: {
    opacity: 0.7,
  },
});
