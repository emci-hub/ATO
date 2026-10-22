import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { chatFlag } from '@/lib/chat/chat-filter';
import {
  chatCryptoReady,
  getOrCreateKeyPair,
  openRow,
  sealFor,
  type ChatKeyPair,
} from '@/lib/chat/chat-crypto';
import {
  CHAT_MAX_CHARS,
  CHAT_REPORT_REASON_IDS,
  CHAT_UI,
  latestReportable,
  reportContext,
  type ChatLevel,
  type ChatLine,
  type ChatReportReason,
} from '@/lib/chat/chat-rules';
import {
  ackChatWarning,
  blockFromChat,
  fetchMyChatStatus,
  fetchPeerKey,
  fetchThread,
  publishChatKey,
  reportChatMessage,
  sendSealed,
  type StoredRow,
} from '@/lib/chat/chat-store';
import { supabase } from '@/lib/supabase';

/**
 * Circle chat: one end-to-end encrypted thread with one friend (master plan Step 14, wave108).
 * Opened from the Circle sheet's ⋯ menu → Message (`/chat?peer=<id>&handle=<handle>`).
 * The server stores ciphertext only; reports send the reporter's own copy of the message + 5 before.
 */
type Gate = 'loading' | 'ready' | 'signed_out' | 'need_update' | 'not_friends' | 'error';

export default function ChatScreen() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const params = useLocalSearchParams<{ peer?: string; handle?: string }>();
  const peer = typeof params.peer === 'string' ? params.peer : '';
  const handle = typeof params.handle === 'string' ? params.handle : '';

  const [gate, setGate] = useState<Gate>('loading');
  const [keys, setKeys] = useState<ChatKeyPair | null>(null);
  const [peerKey, setPeerKey] = useState<string | null>(null);
  const [level, setLevel] = useState<ChatLevel>('none');
  const [unseenWarning, setUnseenWarning] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [armedFlagged, setArmedFlagged] = useState(false);
  const [blockArmed, setBlockArmed] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState<ChatLine | null>(null);
  /** True when the header Report button opened the sheet (reports the latest message). */
  const [reportingLatest, setReportingLatest] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const listRef = useRef<FlatList<ChatLine>>(null);
  /** False while older pages load, so the list keeps its place instead of jumping to the newest line. */
  const stickToEnd = useRef(true);

  // Block is two taps; the first one wears off (same idea as useTwoTap in dev-lab).
  useEffect(() => {
    if (!blockArmed) return;
    const t = setTimeout(() => setBlockArmed(false), 4000);
    return () => clearTimeout(t);
  }, [blockArmed]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const decrypt = useCallback(async (rows: StoredRow[], kp: ChatKeyPair): Promise<ChatLine[]> => {
    const out: ChatLine[] = [];
    for (const r of rows) out.push({ id: r.id, mine: r.mine, text: await openRow(r, kp), at: r.at });
    return out;
  }, []);

  const merge = useCallback((incoming: ChatLine[]) => {
    setLines((prev) => {
      const seen = new Set(prev.map((l) => l.id));
      const next = [...prev, ...incoming.filter((l) => !seen.has(l.id))];
      return next.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    });
  }, []);

  const refreshLatest = useCallback(
    async (kp: ChatKeyPair) => {
      const res = await fetchThread(peer, null);
      if (!alive.current || res.kind !== 'ok') return;
      stickToEnd.current = true;
      merge(await decrypt(res.value, kp));
    },
    [peer, merge, decrypt],
  );

  // Open: native crypto → my key → my status → their key → the newest 50.
  useEffect(() => {
    if (!userId) {
      setGate(sessionLoading ? 'loading' : 'signed_out');
      return;
    }
    if (!peer) {
      setGate('not_friends');
      return;
    }
    let cancelled = false;
    (async () => {
      if (!(await chatCryptoReady())) return !cancelled && setGate('need_update');
      const kp = await getOrCreateKeyPair(userId);
      if (!kp) return !cancelled && setGate('error'); // the Keychain refused, not an old app
      const pub = await publishChatKey(kp.publicKey);
      if (pub.kind === 'signed_out') return !cancelled && setGate('signed_out');
      if (pub.kind !== 'ok') return !cancelled && setGate('error');
      const [status, theirs, thread] = await Promise.all([fetchMyChatStatus(), fetchPeerKey(peer), fetchThread(peer, null)]);
      if (cancelled) return;
      if (theirs.kind !== 'ok' || thread.kind !== 'ok') return setGate('error');
      if (!theirs.value.ok) return setGate('not_friends');
      if (status.kind === 'ok') {
        setLevel(status.value.level);
        setUnseenWarning(status.value.unseenWarning);
      }
      setKeys(kp);
      setPeerKey(theirs.value.key);
      setHasOlder(thread.value.length >= 50);
      setLines(await decrypt(thread.value, kp));
      if (!cancelled) setGate('ready');
    })();
    return () => {
      cancelled = true;
    };
    // Only a new account or friend re-opens the thread (a token refresh must not drop loaded pages).
  }, [userId, peer, sessionLoading, decrypt]);

  // New messages to me: Realtime is only the ping; the text comes through chat_thread (block-checked).
  useEffect(() => {
    if (gate !== 'ready' || !userId || !keys) return;
    const channel = supabase
      .channel(`chat:${userId}:${peer}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { sender_id?: string } | undefined;
          if (row?.sender_id === peer) void refreshLatest(keys);
        },
      );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gate, userId, peer, keys, refreshLatest]);

  const loadOlder = async () => {
    if (!keys || lines.length === 0) return;
    stickToEnd.current = false;
    const res = await fetchThread(peer, lines[0]!.at);
    if (!alive.current || res.kind !== 'ok') return;
    setHasOlder(res.value.length >= 50);
    merge(await decrypt(res.value, keys));
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !keys || busy) return;
    if (text.length > CHAT_MAX_CHARS) return;
    if (chatFlag(text) && !armedFlagged) {
      setArmedFlagged(true);
      setNote(CHAT_UI.flaggedOut);
      return;
    }
    setBusy(true);
    setNote(null);
    let key = peerKey;
    if (!key) {
      // They may have opened chat since this screen loaded.
      const theirs = await fetchPeerKey(peer);
      if (!alive.current) return;
      key = theirs.kind === 'ok' && theirs.value.ok ? theirs.value.key : null;
      if (!key) {
        setNote(CHAT_UI.noPeerKey(handle));
        setBusy(false);
        return;
      }
      setPeerKey(key);
    }
    stickToEnd.current = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      const sealed = await sealFor(text, key, keys);
      if (!sealed) break;
      const res = await sendSealed(peer, { ...sealed, senderKey: keys.publicKey, recipientKey: key });
      if (!alive.current) return;
      if (res.kind === 'ok' && res.value.ok) {
        merge([{ id: res.value.id, mine: true, text, at: res.value.at }]);
        setDraft('');
        setArmedFlagged(false);
        setBusy(false);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        return;
      }
      if (res.kind === 'ok' && res.value.ok === false && res.value.reason === 'key_changed' && attempt === 0) {
        // Their phone (or mine) made a new key: fetch theirs again and re-seal once.
        await publishChatKey(keys.publicKey);
        const theirs = await fetchPeerKey(peer);
        if (theirs.kind === 'ok' && theirs.value.ok && theirs.value.key) {
          key = theirs.value.key;
          setPeerKey(key);
          continue;
        }
        setNote(CHAT_UI.keyChanged);
        break;
      }
      if (res.kind === 'ok' && res.value.ok === false) {
        const why = res.value.reason;
        if (why === 'chat_off') setLevel('chat_off');
        setNote(
          why === 'rate_limited' ? CHAT_UI.rateLimited : why === 'not_friends' ? CHAT_UI.notFriends : why === 'chat_off' ? CHAT_UI.chatOff : why === 'key_changed' ? CHAT_UI.keyChanged : CHAT_UI.error,
        );
      } else {
        setNote(res.kind === 'signed_out' ? CHAT_UI.signedOut : CHAT_UI.error);
      }
      break;
    }
    if (alive.current) setBusy(false);
  };

  const doReport = async (line: ChatLine, reason: ChatReportReason) => {
    const context = reportContext(lines, line.id);
    if (!context) return;
    setBusy(true);
    const res = await reportChatMessage(peer, reason, line.id, context);
    if (!alive.current) return;
    setBusy(false);
    setReporting(null);
    setReportingLatest(false);
    setNote(
      res.kind !== 'ok' ? CHAT_UI.error : res.value.ok ? CHAT_UI.reported : res.value.reason === 'rate_limited' ? CHAT_UI.rateLimited : CHAT_UI.error,
    );
  };

  const doBlock = async () => {
    if (!blockArmed) {
      setBlockArmed(true);
      return;
    }
    setBusy(true);
    const res = await blockFromChat(peer);
    if (!alive.current) return;
    setBusy(false);
    setBlockArmed(false);
    if (res.kind === 'ok' && res.value) {
      setLines([]);
      setGate('not_friends');
      setNote(CHAT_UI.blocked);
    } else {
      setNote(CHAT_UI.error);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  const border = { borderColor: theme.backgroundSelected };
  const over = draft.trim().length - CHAT_MAX_CHARS;
  const chatOff = level === 'chat_off' || level === 'banned';
  const canType = gate === 'ready' && !chatOff;

  const gateLine =
    gate === 'loading'
      ? CHAT_UI.loading
      : gate === 'signed_out'
        ? CHAT_UI.signedOut
        : gate === 'need_update'
          ? CHAT_UI.needUpdate
          : gate === 'not_friends'
            ? CHAT_UI.notFriends
            : gate === 'error'
              ? CHAT_UI.error
              : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.header, border]}>
            <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={CHAT_UI.back} hitSlop={12} style={styles.headerBtn}>
              <ThemedText type="smallBold">{CHAT_UI.back}</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" numberOfLines={1} accessibilityRole="header" style={styles.headerTitle}>
              {CHAT_UI.title(handle)}
            </ThemedText>
            {/* Hidden while Block is armed so the longer "tap again" text fits on a 375 pt phone. */}
            {gate === 'ready' && !blockArmed ? (
              <Pressable
                onPress={() => {
                  const latest = latestReportable(lines);
                  if (!latest) {
                    setNote(CHAT_UI.reportNothing);
                    return;
                  }
                  setReportingLatest(true);
                  setReporting(latest);
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={CHAT_UI.reportLabel(handle)}
                hitSlop={12}
                style={styles.headerBtn}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {CHAT_UI.report}
                </ThemedText>
              </Pressable>
            ) : null}
            {gate === 'ready' ? (
              <Pressable
                onPress={() => void doBlock()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${CHAT_UI.block} @${handle}`}
                hitSlop={12}
                style={styles.headerBtn}>
                <ThemedText type="smallBold" style={styles.danger} numberOfLines={1}>
                  {blockArmed ? CHAT_UI.blockArmed(handle) : CHAT_UI.block}
                </ThemedText>
              </Pressable>
            ) : (
              <View style={styles.headerBtn} />
            )}
          </View>

          {gateLine ? (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {note ?? gateLine}
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.privacy}>
                {CHAT_UI.privacyLine}
              </ThemedText>
              {unseenWarning ? (
                <View style={[styles.banner, border]}>
                  <ThemedText type="small" style={styles.fill}>
                    {CHAT_UI.warned}
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      setUnseenWarning(false);
                      void ackChatWarning();
                    }}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <ThemedText type="smallBold">{CHAT_UI.warnedOk}</ThemedText>
                  </Pressable>
                </View>
              ) : null}
              <FlatList
                ref={listRef}
                style={styles.fill}
                contentContainerStyle={styles.list}
                data={lines}
                keyExtractor={(l) => l.id}
                onContentSizeChange={() => {
                  if (stickToEnd.current) listRef.current?.scrollToEnd({ animated: false });
                }}
                ListHeaderComponent={
                  hasOlder ? (
                    <Pressable onPress={() => void loadOlder()} accessibilityRole="button" style={styles.older}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {CHAT_UI.loadOlder}
                      </ThemedText>
                    </Pressable>
                  ) : null
                }
                ListEmptyComponent={
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    {peerKey ? CHAT_UI.empty : CHAT_UI.noPeerKey(handle)}
                  </ThemedText>
                }
                renderItem={({ item }) => {
                  const hidden = !item.mine && item.text != null && chatFlag(item.text) != null && !revealed.has(item.id);
                  const shown = item.text == null ? CHAT_UI.cantOpen : hidden ? CHAT_UI.hiddenIn : item.text;
                  return (
                    <Pressable
                      onPress={hidden ? () => setRevealed((s) => new Set(s).add(item.id)) : undefined}
                      onLongPress={
                        !item.mine && item.text != null
                          ? () => {
                              setReportingLatest(false);
                              setReporting(item);
                            }
                          : undefined
                      }
                      accessibilityHint={!item.mine && item.text != null ? CHAT_UI.report : undefined}
                      style={[
                        styles.bubble,
                        item.mine ? styles.mine : styles.theirs,
                        { backgroundColor: item.mine ? theme.backgroundSelected : theme.backgroundElement },
                      ]}>
                      <ThemedText
                        style={item.text == null || hidden ? styles.muted : undefined}
                        themeColor={item.text == null || hidden ? 'textSecondary' : undefined}>
                        {shown}
                      </ThemedText>
                    </Pressable>
                  );
                }}
              />

              {reporting ? (
                <View style={[styles.sheet, border, { backgroundColor: theme.background }]} accessibilityViewIsModal>
                  <ThemedText type="smallBold" accessibilityRole="header">
                    {reportingLatest ? CHAT_UI.reportLatestTitle : CHAT_UI.reportTitle}
                  </ThemedText>
                  {reportingLatest ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                      {CHAT_UI.reportEarlierHint}
                    </ThemedText>
                  ) : null}
                  {CHAT_REPORT_REASON_IDS.map((reason) => (
                    <Pressable
                      key={reason}
                      disabled={busy}
                      onPress={() => void doReport(reporting, reason)}
                      accessibilityRole="button"
                      style={[styles.sheetRow, border]}>
                      <ThemedText>{CHAT_UI.reportReasons[reason]}</ThemedText>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => {
                      setReporting(null);
                      setReportingLatest(false);
                    }}
                    accessibilityRole="button"
                    style={styles.sheetRow}>
                    <ThemedText type="smallBold">{CHAT_UI.cancel}</ThemedText>
                  </Pressable>
                </View>
              ) : null}

              <ThemedText type="small" themeColor="textSecondary" style={styles.note} accessibilityLiveRegion="polite" numberOfLines={2}>
                {chatOff ? CHAT_UI.chatOff : over > 0 ? CHAT_UI.tooLong(over) : (note ?? ' ')}
              </ThemedText>
              <View style={[styles.inputRow, border]}>
                <TextInput
                  value={draft}
                  onChangeText={(t) => {
                    setDraft(t);
                    if (armedFlagged) setArmedFlagged(false);
                  }}
                  editable={canType && !busy}
                  placeholder={CHAT_UI.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  accessibilityLabel={CHAT_UI.inputLabel}
                  multiline
                  maxLength={CHAT_MAX_CHARS + 200}
                  style={[styles.input, { color: theme.text }]}
                />
                <Pressable
                  onPress={() => void send()}
                  disabled={!canType || busy || !draft.trim() || over > 0}
                  accessibilityRole="button"
                  accessibilityLabel={CHAT_UI.send}
                  hitSlop={8}
                  style={styles.sendBtn}>
                  <ThemedText type="smallBold" themeColor={!canType || !draft.trim() || over > 0 ? 'textSecondary' : undefined}>
                    {armedFlagged ? CHAT_UI.sendFlagged : CHAT_UI.send}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  headerBtn: { minWidth: 44, minHeight: 44, flexShrink: 1, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  danger: { color: '#d9534f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  centerText: { textAlign: 'center', padding: Spacing.four },
  privacy: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    margin: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
  },
  list: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 },
  older: { alignSelf: 'center', padding: Spacing.two },
  bubble: { maxWidth: '82%', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 14 },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  muted: { fontStyle: 'italic' },
  sheet: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    gap: Spacing.one,
  },
  sheetRow: { minHeight: 44, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  note: { paddingHorizontal: Spacing.four, minHeight: 36 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontSize: 16, paddingVertical: Spacing.two },
  sendBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
