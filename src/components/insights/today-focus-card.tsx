import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SkeletonBar } from '@/components/motion';
import { NotificationAskSheet } from '@/components/notification-ask-sheet';
import { Sheen } from '@/components/sheen';
import { ThemedPressable } from '@/components/themed-pressable';
import { TypewriterText } from '@/components/typewriter-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TraitTagRow } from '@/components/trait-tag-row';
import { Spacing } from '@/constants/theme';
import { useDailyInsight } from '@/hooks/use-daily-insight';
import { useTheme } from '@/hooks/use-theme';
import { clearLeans } from '@/lib/daily-line/pick';
import { ideaForTitle, isBankInsightTitle, themeTags } from '@/lib/insight-bank';
import { draftFromPick, mixedAxesFrom, pickIdea, type IdeaDay } from '@/lib/insight-bank/pick';
import { fetchInsightHistory, fetchTodayInsight, saveInsight } from '@/lib/insight/store';
import { cachedFromInsight, saveCachedInsight } from '@/lib/insight/today-insight';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { POLISH_COPY_REVIEWED, SEALED_READ_KICKER, SEALED_READ_LINE } from '@/lib/polish-copy';
import { acceptNotificationAsk, declineNotificationAsk, shouldShowNotificationAsk } from '@/lib/push';
import { homeSageLabel } from '@/lib/sage-copy';
import { controlBorderColor } from '@/lib/theme/chrome';
import { withTimeout } from '@/lib/timeout';
import type { TraitTrack } from '@/lib/trait-stability';

export const INSIGHT_LOAD_LABEL = 'Load insight';
/** How long the tap waits on today's stored row (a plain read, no model). */
const INSIGHT_FETCH_TIMEOUT_MS = 10_000;
/** The history read is a nice-to-have: it must never hold up the insight. */
const INSIGHT_HISTORY_TIMEOUT_MS = 5000;
/** How many past rows (superseded ones included) the picker reads to keep its no-repeat window. */
const INSIGHT_HISTORY_ROWS = 90;
/** Under the sealed card: where today's focus comes from. */
export const INSIGHT_STORED_NOTE = 'Picked from your answers. Not written by AI.';
export const INSIGHT_UNAVAILABLE_COPY = 'Couldn’t load it just now — tap to try again.';
/** The pick worked but writing it down did not. */
export const INSIGHT_SAVE_FAILED_COPY = 'Picked it, but couldn’t save it. Tap to try again.';
/** Shown on an insight that is not today's (it stays up until today's is loaded). */
export const INSIGHT_EARLIER_DAY_COPY = 'From an earlier day. Load insight picks today’s.';
/** After the first 16 answers, before the full profile (D22, A6): an honest label, not a verdict. */
export const INSIGHT_EARLY_READ_COPY = 'Early read: based on your first 16 answers. It gets more accurate as you answer more.';

/**
 * Today's focus on Insights (moved from Home, 2026-10-14). Stored copy from
 * `lib/insight-bank`: the tap picks one Focus · try · watch idea on the device
 * from this account's clear leans and saves it through `insert_daily_insight`.
 * No model call, no quota, no AI consent gate. A TAP, never an effect.
 *
 * `showTryToday` is false on Insights: 🎯 Try this today is the one "try"
 * action there, so the focus card drops its own "try today" line
 * (`focusShowsTryToday`). The stored row still carries it; only the card hides it.
 */
export function TodayFocusCard({
  userId,
  tracks,
  todayYmd,
  todayDay,
  showTryToday,
  early = false,
  onInsightShown,
}: {
  userId: string;
  tracks: readonly TraitTrack[];
  todayYmd: string;
  todayDay: number;
  showTryToday: boolean;
  /** True after set 1 and before the full profile: shows the "Early read" line. */
  early?: boolean;
  /** Told the title of the insight on screen (the collection counts it). */
  onInsightShown?: (title: string) => void;
}) {
  const theme = useTheme();
  const { insight: cachedInsight, reload: reloadInsight } = useDailyInsight(userId);
  // Old AI-written insights are hidden everywhere (emci, 2026-10-07): only a
  // row whose focus is in the stored bank is shown. Nothing is deleted.
  const insight = cachedInsight && isBankInsightTitle(cachedInsight.title) ? cachedInsight : null;
  const generatingForYmd = useRef<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'unavailable' | 'save-failed'>('idle');
  const [askVisible, setAskVisible] = useState(false);
  // The typewriter plays once, for an insight loaded by a tap on this screen.
  const [typedTitle, setTypedTitle] = useState<string | null>(null);
  const shownTitle = insight?.title ?? null;
  useEffect(() => {
    if (shownTitle) onInsightShown?.(shownTitle);
  }, [shownTitle, onInsightShown]);

  // First insight just loaded: offer the one-time notification ask (never on web, never twice).
  const offerNotificationAsk = useCallback(async () => {
    try {
      if (await shouldShowNotificationAsk(1)) setAskVisible(true);
    } catch {
      // The ask is a nicety; never let it break the insight.
    }
  }, []);

  const loadInsight = useCallback(async () => {
    if (insight?.ymd === todayYmd) return;
    // Re-entrancy: a double tap must not save two rows.
    if (generatingForYmd.current === todayYmd) return;
    generatingForYmd.current = todayYmd;
    setState('loading');
    let stage: 'read' | 'save' = 'read';
    try {
      const existing = await withTimeout(fetchTodayInsight(userId, todayYmd), INSIGHT_FETCH_TIMEOUT_MS, 'insight-fetch');
      // An old AI-written row for today is not shown; a fresh pick supersedes it.
      if (existing && isBankInsightTitle(existing.title)) {
        await saveCachedInsight(cachedFromInsight(existing, userId));
        setTypedTitle(existing.title);
        await reloadInsight();
        setState('idle');
        void offerNotificationAsk();
        return;
      }
      // Which ideas this account has already had. Best effort.
      const history: IdeaDay[] = await withTimeout(
        fetchInsightHistory(userId, INSIGHT_HISTORY_ROWS),
        INSIGHT_HISTORY_TIMEOUT_MS,
        'insight-history',
      )
        .then((rows) =>
          rows.flatMap((row) => {
            const match = ideaForTitle(row.title);
            return match ? [{ ymd: row.ymd, ideaId: match.idea.id }] : [];
          }),
        )
        .catch(() => [] as IdeaDay[]);
      const draft = draftFromPick(pickIdea({ userId, ymd: todayYmd, leans: clearLeans(tracks), mixedAxes: mixedAxesFrom(tracks), history }));
      stage = 'save';
      await saveInsight(draft, todayDay, todayYmd);
      await saveCachedInsight({
        userId,
        day: todayDay,
        ymd: todayYmd,
        theme: draft.theme,
        title: draft.title,
        reflection: draft.reflection,
        tryToday: draft.tryToday,
        watchFor: draft.watchFor,
      });
      setTypedTitle(draft.title);
      await reloadInsight();
      setState('idle');
      void offerNotificationAsk();
    } catch (err) {
      console.log('[insights] today focus error:', stage, err);
      setState(stage === 'save' ? 'save-failed' : 'unavailable');
    } finally {
      if (generatingForYmd.current === todayYmd) generatingForYmd.current = null;
    }
  }, [userId, todayYmd, todayDay, insight?.ymd, tracks, reloadInsight, offerNotificationAsk]);
  return (
    <>
      {insight ? (
        <Sheen borderRadius={Spacing.four}>
        <ThemedView type="backgroundElement" style={styles.heroCard} testID="today-focus-card">
          <ThemedText type="code" themeColor="textSecondary">
            {homeSageLabel(theme.id)}
          </ThemedText>
          <TraitTagRow tags={themeTags(insight.theme)} />
          {early ? (
            <ThemedText type="small" themeColor="textSecondary" testID="early-read-line">
              {INSIGHT_EARLY_READ_COPY}
            </ThemedText>
          ) : null}
          {insight.ymd !== todayYmd ? (
            <ThemedText type="small" themeColor="textSecondary">
              {INSIGHT_EARLIER_DAY_COPY}
            </ThemedText>
          ) : null}
          <TypewriterText key={insight.title} text={insight.title} animate={typedTitle === insight.title} style={styles.heroRead} />
          <ThemedText themeColor="textSecondary" style={styles.reflectionText}>
            {insight.reflection}
          </ThemedText>
          <View style={[styles.heroDivider, { backgroundColor: controlBorderColor(theme) }]} />
          {showTryToday ? (
            <View style={styles.doBlock}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                try today
              </ThemedText>
              <ThemedText style={styles.doText}>{insight.tryToday}</ThemedText>
            </View>
          ) : null}
          <View style={styles.doBlock}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
              watch for
            </ThemedText>
            <ThemedText style={styles.doText}>{insight.watchFor}</ThemedText>
          </View>
        </ThemedView>
        </Sheen>
      ) : null}

      {insight?.ymd !== todayYmd ? (
        <ThemedView type="backgroundElement" style={styles.sealedCard}>
          <View pointerEvents="none" style={[styles.sealedCorner, { borderTopColor: theme.backgroundSelected }]} />
          <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
            {SEALED_READ_KICKER}
          </ThemedText>
          {state === 'loading' ? (
            <View style={styles.sealedSkeleton} accessibilityLabel="Loading">
              <SkeletonBar width="90%" />
              <SkeletonBar width="70%" />
              <SkeletonBar width="45%" />
            </View>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.sealedLine}>
              {state === 'unavailable'
                ? INSIGHT_UNAVAILABLE_COPY
                : state === 'save-failed'
                  ? INSIGHT_SAVE_FAILED_COPY
                  : SEALED_READ_LINE}
            </ThemedText>
          )}
          <ThemedPressable
            filled
            accessibilityRole="button"
            accessibilityLabel={INSIGHT_LOAD_LABEL}
            disabled={state === 'loading'}
            onPress={() => {
              void loadInsight();
            }}
            style={[
              styles.sealedButton,
              { borderRadius: theme.cutCorners ? 0 : 999 },
              state === 'loading' && styles.pressed,
            ]}>
            <ThemedText type="smallBold" themeColor="onAccent">
              {state === 'loading' ? 'Loading…' : state === 'unavailable' || state === 'save-failed' ? 'Try again' : INSIGHT_LOAD_LABEL}
            </ThemedText>
          </ThemedPressable>
          <ThemedText type="small" themeColor="textSecondary">
            {INSIGHT_STORED_NOTE}
          </ThemedText>
          {early ? (
            <ThemedText type="small" themeColor="textSecondary">
              {INSIGHT_EARLY_READ_COPY}
            </ThemedText>
          ) : null}
          {!POLISH_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
            <ThemedText type="code" themeColor="textSecondary">
              Draft copy — waiting on emci review.
            </ThemedText>
          ) : null}
        </ThemedView>
      ) : null}

      <NotificationAskSheet
        visible={askVisible}
        onTurnOn={() => {
          setAskVisible(false);
          void acceptNotificationAsk();
        }}
        onNotNow={() => {
          setAskVisible(false);
          void declineNotificationAsk();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  heroRead: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '500',
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    opacity: 0.7,
  },
  doBlock: {
    gap: Spacing.half,
  },
  doText: {
    lineHeight: 24,
  },
  reflectionText: {
    lineHeight: 24,
    paddingTop: Spacing.one,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  sealedCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  sealedCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 36,
    borderLeftWidth: 36,
    borderLeftColor: 'transparent',
  },
  sealedLine: {
    lineHeight: 24,
    paddingRight: Spacing.five,
  },
  sealedSkeleton: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  sealedButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
