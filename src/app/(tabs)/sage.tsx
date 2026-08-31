import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConsentCard } from '@/components/ai-consent-card';
import { CrisisCard } from '@/components/crisis-card';
import { ReportSheet } from '@/components/report-sheet';
import { SageEightBall } from '@/components/sage-eight-ball';
import { SageInsightSpend } from '@/components/sage-insight-spend';
import { SageTitleCard } from '@/components/sage-title-card';
import { SageUsageLine } from '@/components/sage-usage';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { useMeContext } from '@/lib/me-context';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useTodayCard } from '@/hooks/use-today-card';
import { checksToHistory, fetchChecks, fetchTalkHistory, type Check } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { logCrisisFlag } from '@/lib/crisis/log';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { aiConsentFor, setAiConsent, type Me } from '@/lib/me';
import { voiceMeFrom } from '@/lib/intake';
import {
  addSageMessage,
  fetchSageMessages,
  peekSageMessages,
  type SageMessage,
} from '@/lib/sage-messages';
import { TALK_COMPOSER_PLACEHOLDER, TALK_EMPTY, TALK_LEDE, TALK_TRY_AGAIN, TALK_WRITING, SAGE_COACH_LABEL } from '@/lib/sage-copy';
import { divergingAxesFromTracks, formatDivergenceNote } from '@/lib/trait-history';
import { settledAxisLabel, settledCount, type TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { QUOTA_EMPTY_MESSAGE } from '@/lib/voice/quota';
import { claimAiCall, logJargonGuard, logPhraseGuard } from '@/lib/voice/quota-server';
import { recordOwnDevTrace } from '@/lib/dev-trace-server';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';
import {
  EXPLORE_EMPTY_CONSENT,
  EXPLORE_EMPTY_CRISIS,
  EXPLORE_EMPTY_DENIED,
  EXPLORE_EMPTY_QUOTA,
  EXPLORE_EMPTY_TRY,
  EXPLORE_LAND_NO,
  EXPLORE_LAND_Q,
  EXPLORE_LAND_YES,
  EXPLORE_NOTED,
} from '@/lib/explore/copy';
import { generateExploreBody } from '@/lib/explore/generate';
import { routeExplore } from '@/lib/explore/route';
import {
  fetchExploreMissNotes,
  fetchLatestExplorePack,
  recordExploreReaction,
  saveExplorePack,
} from '@/lib/explore/store';
import type { ExploreEntryRow, RouteExploreResult } from '@/lib/explore/types';
import { VOICE_CONFIG } from '@/lib/voice/config';
import type { CheckHistory } from '@/lib/voice/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'sage';
  text: string;
  crisis?: boolean;
  /** True when this row is persisted in sage_messages and therefore reportable. */
  reportable?: boolean;
}

const CHIPS = [
  { label: 'today', prompt: 'How\u2019s today looking for me?' },
  { label: 'this week', prompt: 'How\u2019s my week going?' },
  { label: 'something else', prompt: null },
] as const;

const MORE_CHIPS: ReadonlyArray<{ label: string; prompt: string | null; support?: boolean }> = [
  { label: 'why did I skip yesterday?', prompt: 'Why do you think I skipped yesterday?' },
  { label: 'I need support', prompt: null, support: true },
];

let nextMessageId = 1;

/** Native tab bar (~50pt) plus the home-indicator band it sits on (~34pt). */
const COMPOSER_REST_PAD = BottomTabInset + (Platform.OS === 'ios' ? 34 : 0) + Spacing.two;

function keyboardFallbackLift(e: KeyboardEvent): number {
  return Math.max(0, Math.round(e.endCoordinates.height) - BottomTabInset);
}

function syncKeyboardAnimation(e: KeyboardEvent) {
  if (Platform.OS !== 'ios') return;
  LayoutAnimation.configureNext({
    duration: e.duration > 0 ? e.duration : 250,
    update: { type: LayoutAnimation.Types.keyboard },
  });
}

/**
 * NativeTabs does not resize its child for the software keyboard, and
 * KeyboardAvoidingView is a no-op inside that native controller. Lift is
 * padding on the screen: keyboard height minus the tab inset already in the
 * layout. Do not subtract safe-area bottom — on iOS that inset grows to the
 * keyboard and zeroes the lift (the 5111b78 device miss).
 *
 * measureInWindow runs once while the composer is still at rest. Remeasuring
 * after the pad is applied would read leftover 0 and collapse the lift.
 */
function useKeyboardLift(targetRef: RefObject<View | null>) {
  const [height, setHeight] = useState(0);
  const appliedRef = useRef(false);
  const kbHeightRef = useRef(0);

  useEffect(() => {
    const apply = (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      const kbHeight = Math.round(e.endCoordinates.height);
      if (keyboardTop >= Dimensions.get('window').height - 24) {
        appliedRef.current = false;
        kbHeightRef.current = 0;
        setHeight(0);
        return;
      }

      syncKeyboardAnimation(e);
      const fallback = keyboardFallbackLift(e);

      if (appliedRef.current) {
        if (kbHeight === kbHeightRef.current) return;
        kbHeightRef.current = kbHeight;
        setHeight(fallback);
        return;
      }

      kbHeightRef.current = kbHeight;
      const commit = (next: number) => {
        appliedRef.current = next > 0;
        setHeight(Math.min(kbHeight, next));
      };

      const node = targetRef.current;
      if (!node || typeof node.measureInWindow !== 'function') {
        commit(fallback);
        return;
      }
      node.measureInWindow((_x, y, _w, h) => {
        const overlap = Math.max(0, Math.round(y + h - keyboardTop));
        commit(overlap > 8 ? overlap : fallback);
      });
    };
    const clear = (e: KeyboardEvent) => {
      syncKeyboardAnimation(e);
      appliedRef.current = false;
      kbHeightRef.current = 0;
      setHeight(0);
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', apply),
      Keyboard.addListener('keyboardDidShow', apply),
      Keyboard.addListener('keyboardWillChangeFrame', apply),
      Keyboard.addListener('keyboardWillHide', clear),
      Keyboard.addListener('keyboardDidHide', clear),
    ];

    const visual =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.visualViewport : null;
    const onVisual = () => {
      if (!visual) return;
      const covered = Math.round(window.innerHeight - visual.height - visual.offsetTop);
      setHeight(covered > 48 ? covered : 0);
    };
    visual?.addEventListener('resize', onVisual);
    visual?.addEventListener('scroll', onVisual);

    return () => {
      subs.forEach((sub) => sub.remove());
      visual?.removeEventListener('resize', onVisual);
      visual?.removeEventListener('scroll', onVisual);
    };
  }, [targetRef]);

  const open = height > 0;
  const lift = Platform.OS === 'android' ? 0 : height;
  return { open, lift };
}

function chatFromRows(rows: SageMessage[]): ChatMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    text: row.text,
    reportable: true,
  }));
}

function emptyExploreCopy(kind: RouteExploreResult['kind']): string | null {
  switch (kind) {
    case 'consent-pending':
      return EXPLORE_EMPTY_CONSENT;
    case 'consent-denied':
      return EXPLORE_EMPTY_DENIED;
    case 'crisis':
      return EXPLORE_EMPTY_CRISIS;
    case 'quota':
      return EXPLORE_EMPTY_QUOTA;
    case 'empty':
      return EXPLORE_EMPTY_TRY;
    default:
      return null;
  }
}

function NotedAck({
  bump,
  reduceMotion,
  onFill,
}: {
  bump: number;
  reduceMotion: boolean;
  onFill: boolean;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    if (reduceMotion) {
      const hide = setTimeout(() => {
        opacity.value = 0;
      }, 900);
      return () => clearTimeout(hide);
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 700 }),
    );
  }, [bump, reduceMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.noted, fade]}>
      <ThemedText
        type="small"
        themeColor={onFill ? undefined : 'textSecondary'}
        style={onFill ? { color: theme.onAccent } : undefined}>
        {EXPLORE_NOTED}
      </ThemedText>
    </Animated.View>
  );
}

function SageExploreObservations({
  me,
  history,
  crisisToday,
}: {
  me: Me;
  history: CheckHistory[];
  crisisToday: boolean;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [result, setResult] = useState<RouteExploreResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noted, setNoted] = useState<{
    entryId: string;
    landed: boolean;
    bump: number;
  } | null>(null);

  const load = useCallback(async () => {
    const next = await routeExplore(
      {
        me: {
          ...voiceMeFrom(me),
          timezone: me.timezone,
          traitTouchedAt: me.trait_touched_at,
        },
        history,
        aiConsent: me.ai_consent,
        crisisToday,
      },
      {
        loadLatestPack: fetchLatestExplorePack,
        savePack: saveExplorePack,
        loadMissNotes: fetchExploreMissNotes,
        claimAiCall: () => claimAiCall('explore'),
        logJargonHit: logJargonGuard,
        logPhraseHit: logPhraseGuard,
        generateBody: generateExploreBody,
        useLocal: VOICE_CONFIG.provider === 'local' || !VOICE_CONFIG.geminiApiKey,
        recordTrace: recordOwnDevTrace,
      },
    );
    setResult(next);
  }, [me, history, crisisToday]);

  useEffect(() => {
    let cancelled = false;
    void load().catch((err) => {
      console.log('[explore] route error:', err);
      if (!cancelled) setResult({ kind: 'empty', pack: null });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function react(entry: ExploreEntryRow, landed: boolean) {
    if (busyId || entry.id.startsWith('local-')) return;
    setNoted({ entryId: entry.id, landed, bump: Date.now() });
    setBusyId(entry.id);
    try {
      await recordExploreReaction(entry.id, landed);
      setResult((current) => {
        if (!current?.pack) return current;
        return {
          ...current,
          pack: {
            ...current.pack,
            entries: current.pack.entries.map((row) =>
              row.id === entry.id ? { ...row, landed } : row,
            ),
          },
        };
      });
    } catch (err) {
      console.log('[explore] reaction error:', err);
    } finally {
      setBusyId(null);
    }
  }

  const message = result ? emptyExploreCopy(result.kind) : null;
  const entries = result?.pack?.entries ?? [];
  if (!message && entries.length === 0) return null;

  return (
    <View style={styles.exploreBlock}>
      {message ? (
        <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.bubbleText}>{message}</ThemedText>
        </View>
      ) : null}
      {entries.map((entry) => (
        <View key={entry.id} style={styles.exploreEntry}>
          <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.bubbleText}>{entry.body}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {EXPLORE_LAND_Q}
          </ThemedText>
          <View style={styles.exploreActions}>
            <View style={styles.actionSlot}>
              <ThemedPressable
                filled={entry.landed === true}
                onPress={() => void react(entry, true)}
                disabled={busyId !== null}
                style={[styles.exploreYes, busyId !== null && styles.disabled]}>
                <ThemedText
                  type="smallBold"
                  style={entry.landed === true ? { color: theme.onAccent } : undefined}
                  themeColor={entry.landed === true ? undefined : 'textSecondary'}>
                  {EXPLORE_LAND_YES}
                </ThemedText>
              </ThemedPressable>
              {noted?.entryId === entry.id && noted.landed === true ? (
                <NotedAck
                  bump={noted.bump}
                  reduceMotion={reduceMotion}
                  onFill={entry.landed === true}
                />
              ) : null}
            </View>
            <View style={styles.actionSlot}>
              <ThemedPressable
                onPress={() => void react(entry, false)}
                disabled={busyId !== null}
                style={[
                  styles.exploreNo,
                  { borderColor: controlBorderColor(theme) },
                  entry.landed === false && styles.missed,
                  busyId !== null && styles.disabled,
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {EXPLORE_LAND_NO}
                </ThemedText>
              </ThemedPressable>
              {noted?.entryId === entry.id && noted.landed === false ? (
                <NotedAck bump={noted.bump} reduceMotion={reduceMotion} onFill={false} />
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SageScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe } = useMeContext();
  const { card: todayCard } = useTodayCard();
  const composerRef = useRef<View>(null);
  const { open: keyboardOpen, lift: keyboardLift } = useKeyboardLift(composerRef);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!keyboardOpen) return;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [keyboardOpen]);

  const cachedRows = userId ? peekSageMessages(userId) : null;
  const [checks, setChecks] = useState<Check[]>([]);
  const [exploreChecks, setExploreChecks] = useState<Check[]>([]);
  const [crisisToday, setCrisisToday] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [talkReady, setTalkReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    cachedRows ? chatFromRows(cachedRows) : [],
  );
  const [historyReady, setHistoryReady] = useState(cachedRows != null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'send' | 'consent' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaEmpty, setQuotaEmpty] = useState(false);
  const [usageRevision, setUsageRevision] = useState(0);
  const [showSupport, setShowSupport] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState<ChatMessage | null>(null);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);

  // History is the paint-critical fetch. Talk context (count + last 5 Checks)
  // starts in parallel so a first send is ready, but it no longer pulls every
  // all-time Check row the way Home still needs to.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const peeked = peekSageMessages(userId);
    if (peeked) {
      setMessages(chatFromRows(peeked));
      setHistoryReady(true);
    } else {
      setHistoryReady(false);
    }
    setTalkReady(false);

    fetchSageMessages(userId)
      .then((rows) => {
        if (cancelled) return;
        setMessages(chatFromRows(rows));
        setHistoryReady(true);
      })
      .catch((err) => {
        console.log('[talk] fetchSageMessages error:', err);
        if (!cancelled) setHistoryReady(true);
      });

    fetchTalkHistory(userId)
      .then((next) => {
        if (cancelled) return;
        setChecks(next.checks);
        setCheckCount(next.checkCount);
        setTalkReady(true);
      })
      .catch((err) => {
        console.log('[talk] fetchTalkHistory error:', err);
        if (!cancelled) setTalkReady(true);
      });

    fetchChecks(userId)
      .then((rows) => {
        if (cancelled) return;
        setExploreChecks(rows);
      })
      .catch((err) => {
        console.log('[explore] fetchChecks error:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTraitTracks(userId)
      .then((rows) => {
        if (cancelled) return;
        setTracks(rows);
        setTracksReady(true);
      })
      .catch((err) => {
        console.log('[sage] tracks error:', err);
        if (!cancelled) setTracksReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me?.updated_at]);

  useEffect(() => {
    if (!userId || !me) return;
    let cancelled = false;
    crisisFlagsForWindow(userId, me.timezone)
      .then((flags) => {
        if (cancelled) return;
        setCrisisToday(flags.crisisToday);
      })
      .catch((err) => {
        console.log('[explore] crisis flags error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me?.timezone]);

  useEffect(() => {
    if (!keyboardOpen) return;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [keyboardOpen, messages.length]);

  const consent = me ? aiConsentFor(me) : 'pending';

  async function saveConsent(value: boolean) {
    if (!userId || !me || busy) return;
    setBusy('consent');
    setError(null);
    try {
      await setAiConsent(userId, value);
      await refreshMe();
    } catch (err) {
      console.log('[talk] setAiConsent error:', err);
      setError('Couldn\u2019t save your choice. Try again.');
    } finally {
      setBusy(null);
    }
  }

  function addLocal(message: Omit<ChatMessage, 'id'>) {
    setMessages((prev) => [...prev, { ...message, id: `m${nextMessageId++}` }]);
  }

  /** Appends a row and, when persistence succeeds, swaps it in so reports get a real id. */
  async function persistAndSwap(localId: string, role: 'user' | 'sage', text: string) {
    try {
      const row = await addSageMessage(role, text);
      setMessages((prev) =>
        prev.map((m) => (m.id === localId ? { id: row.id, role, text: row.text, reportable: true } : m)),
      );
    } catch (err) {
      console.log('[talk] addSageMessage error:', err);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!me || !userId || busy || trimmed.length === 0) return;
    setBusy('send');
    setError(null);
    setQuotaEmpty(false);
    const localUserId = `m${nextMessageId++}`;
    let priorTurns: Array<{ role: 'user' | 'sage'; text: string }> = [];
    setMessages((prev) => {
      priorTurns = prev
        .filter((row) => !row.crisis && row.text.trim().length > 0)
        .slice(-6)
        .map((row) => ({ role: row.role, text: row.text }));
      return [...prev, { id: localUserId, role: 'user', text: trimmed }];
    });
    setInput('');
    // Persist the user's line immediately so it gets a reportable id.
    void persistAndSwap(localUserId, 'user', trimmed);

    try {
      const [{ routeTalkReply }, talk, trackRows] = await Promise.all([
        import('@/lib/voice/talk'),
        talkReady
          ? Promise.resolve({ checks, checkCount })
          : fetchTalkHistory(userId).then((next) => {
              setChecks(next.checks);
              setCheckCount(next.checkCount);
              setTalkReady(true);
              return next;
            }),
        tracksReady ? Promise.resolve(tracks) : fetchTraitTracks(userId).catch(() => []),
      ]);
      const result = await routeTalkReply(
        {
          me: voiceMeFrom(me),
          message: trimmed,
          checkCount: talk.checkCount,
          history: checksToHistory(talk.checks),
          todayCard: todayCard
            ? { read: todayCard.read, do: todayCard.do }
            : null,
          recentTurns: priorTurns,
          aiConsent: me.ai_consent,
          userId,
          answeredCount: settledCount(trackRows),
          divergenceNote: formatDivergenceNote(divergingAxesFromTracks(trackRows)),
        },
        { logCrisisFlag: (id) => logCrisisFlag(id), claimAiCall, logJargonHit: logJargonGuard, recordTrace: recordOwnDevTrace },
      );

      if (result.kind === 'crisis') {
        // No confirmation step — the static card shows automatically.
        // CRISIS HARD RULE: no gesture. Hands stay hidden — never celebrated,
        // never acknowledged with a pose. No exception. The static card is not
        // a Sage response and is not persisted/reportable.
        addLocal({ role: 'sage', text: '', crisis: true });
      } else if (result.kind === 'quota') {
        setQuotaEmpty(true);
        setUsageRevision((n) => n + 1);
      } else if (result.kind === 'empty') {
        setError(TALK_TRY_AGAIN);
        setUsageRevision((n) => n + 1);
      } else if (result.kind === 'reply' && result.reply) {
        const reply = result.reply;
        const localSageId = `m${nextMessageId++}`;
        setMessages((prev) => [...prev, { id: localSageId, role: 'sage', text: reply }]);
        void persistAndSwap(localSageId, 'sage', reply);
        triggerGesture('talkReply');
        setUsageRevision((n) => n + 1);
      }
    } catch (err) {
      console.log('[talk] routeTalkReply error:', err);
      setError(TALK_TRY_AGAIN);
    } finally {
      setBusy(null);
    }
  }

  function dismissCrisis(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  function onChip(prompt: string | null, isSupport?: boolean) {
    if (isSupport) {
      setShowSupport(true);
      setMoreOpen(false);
      return;
    }
    if (prompt) send(prompt);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.flex,
            { backgroundColor: theme.background, paddingBottom: keyboardLift },
          ]}>
          <View style={styles.header}>
          <View>
            <ThemedText type="subtitle">{SAGE_COACH_LABEL}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lede}>
              {TALK_LEDE}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => setShowSupport(true)}
            hitSlop={12}
            accessibilityLabel="Open support card"
            style={({ pressed }) => [styles.supportButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons
              name="lifebuoy"
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.chatColumn}>
          <ScrollView
            ref={scrollRef}
            {...NO_PINCH_ZOOM}
            style={[styles.thread, { backgroundColor: theme.background }]}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => {
              if (consent === 'granted') {
                scrollRef.current?.scrollToEnd({ animated: keyboardOpen });
              }
            }}>
            <View style={styles.sageToys}>
              <SageEightBall />
              {me ? <SageUsageLine revision={usageRevision} /> : null}
              {me ? (
                <SageTitleCard me={me} tracks={tracks} tracksReady={tracksReady} />
              ) : null}
              {me ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {settledAxisLabel(tracks)}
                </ThemedText>
              ) : null}
              {me ? (
                <SageInsightSpend
                  me={me}
                  settled={settledCount(tracks)}
                  onUpdated={() => refreshMe()}
                />
              ) : null}
            </View>

            {me ? (
              <SageExploreObservations
                me={me}
                history={checksToHistory(exploreChecks)}
                crisisToday={crisisToday}
              />
            ) : null}

            {!me ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText themeColor="textSecondary">Loading…</ThemedText>
              </ThemedView>
            ) : consent === 'denied' ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="smallBold">Talk is off</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  You chose to keep Sage off AI, so Sage can&apos;t reply here. Your daily
                  cards keep working.
                </ThemedText>
              </ThemedView>
            ) : (
              <>
                {quotaEmpty ? (
                  <ThemedView type="backgroundElement" style={styles.emptyCard}>
                    <ThemedText type="smallBold">That&apos;s all for today</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.centerText}>
                      {QUOTA_EMPTY_MESSAGE}
                    </ThemedText>
                  </ThemedView>
                ) : null}
                {!historyReady && messages.length === 0 && !quotaEmpty ? (
                  <ThemedView type="backgroundElement" style={styles.emptyCard}>
                    <ThemedText themeColor="textSecondary">Loading…</ThemedText>
                  </ThemedView>
                ) : messages.length === 0 && !quotaEmpty ? (
                  <ThemedView type="backgroundElement" style={styles.emptyCard}>
                    <ThemedText themeColor="textSecondary" style={styles.centerText}>
                      {TALK_EMPTY}
                    </ThemedText>
                  </ThemedView>
                ) : (
                  messages.map((message) =>
                    message.role === 'user' ? (
                      <View key={message.id} style={[styles.bubble, styles.userBubble, { backgroundColor: theme.accentFill }]}>
                        <ThemedText style={[styles.bubbleText, { color: theme.onAccent }]}>
                          {message.text}
                        </ThemedText>
                      </View>
                    ) : message.crisis ? (
                      <View key={message.id} style={styles.crisisBubble}>
                        <CrisisCard onDismiss={() => dismissCrisis(message.id)} />
                      </View>
                    ) : (
                      <Pressable
                        key={message.id}
                        onLongPress={() => message.reportable && setReportMessage(message)}
                        delayLongPress={250}
                        style={({ pressed }) => [
                          styles.bubble,
                          { backgroundColor: theme.backgroundElement },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText style={styles.bubbleText}>{message.text}</ThemedText>
                      </Pressable>
                    ),
                  )
                )}
                {busy === 'send' ? (
                  <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {TALK_WRITING}
                    </ThemedText>
                  </View>
                ) : null}
                {error ? (
                  <ThemedText type="smallBold" style={[styles.error, { color: '#E5484D' }]}>
                    {error}
                  </ThemedText>
                ) : null}
              </>
            )}
          </ScrollView>

          {me && consent === 'granted' ? (
            <View
              ref={composerRef}
              collapsable={false}
              style={[
                styles.composer,
                {
                  backgroundColor: theme.background,
                  paddingBottom: keyboardOpen ? Spacing.two : COMPOSER_REST_PAD,
                },
              ]}>
              <ScrollView
                {...NO_PINCH_ZOOM}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}>
                {CHIPS.map((chip) => (
                  <Pressable
                    key={chip.label}
                    disabled={busy !== null}
                    onPress={() => (chip.prompt ? onChip(chip.prompt) : setMoreOpen((open) => !open))}
                    style={({ pressed }) => [
                      styles.chip,
                      { borderColor: controlBorderColor(theme) },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {chip.label}
                    </ThemedText>
                  </Pressable>
                ))}
                {moreOpen
                  ? MORE_CHIPS.map((chip) => (
                      <Pressable
                        key={chip.label}
                        disabled={busy !== null}
                        onPress={() => onChip(chip.prompt, chip.support)}
                        style={({ pressed }) => [
                          styles.chip,
                          { borderColor: controlBorderColor(theme) },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {chip.label}
                        </ThemedText>
                      </Pressable>
                    ))
                  : null}
              </ScrollView>

              <View style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={TALK_COMPOSER_PLACEHOLDER}
                  placeholderTextColor={theme.textSecondary}
                  editable={busy === null}
                  onSubmitEditing={() => send(input)}
                  returnKeyType="send"
                  multiline
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      scrollRef.current?.scrollToEnd({ animated: true });
                    });
                  }}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundSelected },
                  ]}
                />
                <Pressable
                  onPress={() => send(input)}
                  disabled={busy !== null || input.trim().length === 0}
                  style={({ pressed }) => [
                    styles.sendButton,
                    { backgroundColor: theme.accentFill },
                    pressed && styles.pressed,
                    (busy !== null || input.trim().length === 0) && styles.disabled,
                  ]}>
                  <MaterialCommunityIcons name="send" size={18} color={theme.onAccent} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={Boolean(me) && consent === 'pending'}
        transparent
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <AiConsentCard
              context="talk"
              busy={busy === 'consent'}
              onGrant={() => saveConsent(true)}
              onDeny={() => saveConsent(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSupport}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupport(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <CrisisCard onDismiss={() => setShowSupport(false)} />
            <Pressable
              onPress={() => setShowSupport(false)}
              style={({ pressed }) => [
                styles.closeButton,
                { borderColor: controlBorderColor(theme) },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Floor requirement: a Sage response can be reported too. */}
      <ReportSheet
        visible={reportMessage !== null}
        target={
          reportMessage ? { kind: 'message', messageId: reportMessage.id } : { kind: 'user', userId: userId ?? '' }
        }
        title="Report this Sage reply"
        onClose={() => setReportMessage(null)}
      />
    </ThemedView>
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
  flex: {
    flex: 1,
  },
  chatColumn: {
    flex: 1,
    minHeight: 0,
  },
  thread: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  lede: {
    paddingTop: Spacing.half,
  },
  sageToys: {
    gap: Spacing.one,
    paddingBottom: Spacing.one,
  },
  exploreBlock: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  exploreEntry: {
    gap: Spacing.two,
  },
  exploreActions: {
    gap: Spacing.two,
    maxWidth: '85%',
  },
  exploreYes: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  exploreNo: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  actionSlot: {
    position: 'relative',
  },
  noted: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  missed: {
    opacity: 0.85,
  },
  supportButton: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  emptyCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  messages: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingBottom: Spacing.two,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  bubbleText: {
    lineHeight: 22,
  },
  crisisBubble: {
    alignSelf: 'stretch',
  },
  error: {
    alignSelf: 'center',
  },
  composer: {
    flexShrink: 0,
    zIndex: 2,
    elevation: 4,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.one,
    paddingRight: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth - Spacing.five,
    gap: Spacing.three,
  },
  closeButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
  },
});
