import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/action-menu';
import { ReportSheet } from '@/components/report-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import {
  deleteMessageForMe,
  fetchThreadMessages,
  getOrCreateThread,
  sendChatMessage,
  type ChatMessage,
} from '@/lib/chat';
import { addFact } from '@/lib/me';
import type { PeerMe } from '@/lib/circle';
import {
  blockUser,
  fetchMyBlocks,
  fetchMyMutes,
  muteUser,
  unblockUser,
  unmuteUser,
  type BlockRow,
  type MuteRow,
} from '@/lib/moderation';
import { supabase } from '@/lib/supabase';

type ReportTargetState = { kind: 'user' } | { kind: 'message'; messageId: string } | null;

/**
 * Chat. Opens only from a Circle card (router.push with `peer`), never from a
 * standalone inbox. One thread per Circle connection. TLS/RLS on the wire and
 * in the DB; no homemade crypto; history stays.
 *
 * Blocking is symmetric for sending and asymmetric for rendering: when you
 * block someone, their lines stop rendering for you (server + client) and
 * neither party can send. Muting is local to you — your own view only, the
 * other person is never notified. "Teach Sage this" is the ONLY path that
 * moves a chat line into Sage's knowledge (`me.facts`), one fact at a time.
 */
export default function ChatScreen() {
  const theme = useTheme();
  const { peer } = useLocalSearchParams<{ peer: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const [peerMe, setPeerMe] = useState<PeerMe | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [mutes, setMutes] = useState<MuteRow[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [messageMenu, setMessageMenu] = useState<ChatMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTargetState>(null);
  const [teachTarget, setTeachTarget] = useState<ChatMessage | null>(null);
  const [fact, setFact] = useState('');
  const [teachBusy, setTeachBusy] = useState(false);
  const [teachDone, setTeachDone] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const reloadMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      setMessages(await fetchThreadMessages(threadId));
    } catch (err) {
      console.log('[chat] fetchThreadMessages error:', err);
    }
  }, [threadId]);

  // Resolve the peer's profile + thread, then load history.
  useEffect(() => {
    if (!peer || !userId) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('peer_profile', { p_user_id: peer });
        if (error) throw error;
        const row = (data ?? [])[0] as PeerMe | undefined;
        if (!cancelled && row) setPeerMe(row);
      } catch {
        // Peer profile is non-fatal; the header just shows a placeholder.
      }
    })();

    getOrCreateThread(peer)
      .then((id) => {
        if (cancelled) return;
        setThreadId(id);
        return fetchThreadMessages(id).then((rows) => {
          if (!cancelled) setMessages(rows);
        });
      })
      .catch((err) => {
        console.log('[chat] thread error:', err);
        if (!cancelled) setError('Couldn\u2019t open this thread. Are you still connected?');
      });

    return () => {
      cancelled = true;
    };
  }, [peer, userId]);

  // Moderation state for this peer. Fetched on mount AND on focus, because a
  // block/mute decided in another screen (or by the peer mid-session) should
  // reflect immediately when the thread regains focus.
  const reloadModeration = useCallback(async () => {
    if (!peer) return;
    try {
      const [b, m] = await Promise.all([fetchMyBlocks(), fetchMyMutes()]);
      setBlocks(b);
      setMutes(m);
    } catch {
      // Non-fatal — menus just show default labels.
    }
  }, [peer]);

  useEffect(() => {
    reloadModeration();
  }, [reloadModeration]);

  useFocusEffect(
    useCallback(() => {
      reloadModeration();
    }, [reloadModeration]),
  );

  // Realtime: new lines stream in. Server-side RLS already applies the
  // delete-for-me + block-hiding filters, so a refetch is always consistent.
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        () => {
          reloadMessages().catch(() => {});
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, reloadMessages]);

  const iBlockedPeer = blocks.some((b) => b.blocked_by === userId && b.blocked_user === peer);
  const peerBlockedMe = blocks.some((b) => b.blocked_by === peer && b.blocked_user === userId);
  const iMutedPeer = mutes.some((m) => m.muter === userId && m.muted_user === peer);
  const canSend = !iBlockedPeer && !peerBlockedMe && !!threadId && !busy;

  // Server already hides blocked lines; also hide muted lines for the muter.
  const visibleMessages = messages.filter((m) => {
    if (m.sender_id === peer && (iBlockedPeer || iMutedPeer)) return false;
    return true;
  });

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || !threadId || !canSend) return;
    setBusy(true);
    setError(null);
    try {
      const row = await sendChatMessage(threadId, trimmed);
      // Realtime INSERT triggers a full refetch that may resolve before or
      // after this append; dedupe by id so the bubble never duplicates.
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      setInput('');
    } catch (err) {
      console.log('[chat] send error:', err);
      setError('Couldn\u2019t send. The other person may have blocked you or left.');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMessage(message: ChatMessage) {
    try {
      await deleteMessageForMe(message.id);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      console.log('[chat] delete error:', err);
    }
  }

  function openTeach(message: ChatMessage) {
    setTeachTarget(message);
    setFact(message.text);
    setTeachDone(false);
  }

  async function saveFact() {
    const trimmed = fact.trim();
    if (!trimmed || !userId || teachBusy) return;
    setTeachBusy(true);
    try {
      await addFact(userId, trimmed);
      setTeachDone(true);
    } catch (err) {
      console.log('[chat] addFact error:', err);
      const message = err instanceof Error ? err.message : '';
      setError(message.startsWith('That line names a type') ? message : 'Couldn\u2019t save that fact. Try again.');
    } finally {
      setTeachBusy(false);
    }
  }

  const peerName = peerMe?.name ?? '…';
  const peerHandle = peerMe?.handle ? `@${peerMe.handle}` : '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/circle'))}
            hitSlop={12}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ‹ Back
            </ThemedText>
          </Pressable>
          <View style={styles.headerIdentity}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {peerName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {peerHandle}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => setHeaderMenuOpen(true)}
            hitSlop={12}
            accessibilityLabel="More options"
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.moreDots}>
              ···
            </ThemedText>
          </Pressable>
        </View>

        {error ? (
            <ThemedText type="smallBold" style={[styles.error, { color: '#E5484D' }]}>
            {error}
          </ThemedText>
        ) : null}

        {iBlockedPeer ? (
          <ThemedView type="backgroundElement" style={styles.banner}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              You blocked {peerName}. Their messages are hidden and messaging is off.
            </ThemedText>
          </ThemedView>
        ) : peerBlockedMe ? (
          <ThemedView type="backgroundElement" style={styles.banner}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              You can&apos;t send messages to {peerName} right now.
            </ThemedText>
          </ThemedView>
        ) : iMutedPeer ? (
          <ThemedView type="backgroundElement" style={styles.banner}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              You muted {peerName}. Their messages are hidden for you.
            </ThemedText>
          </ThemedView>
        ) : null}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {visibleMessages.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  No messages yet. Say hi.
                </ThemedText>
              </ThemedView>
            ) : (
              visibleMessages.map((message) => (
                <Pressable
                  key={message.id}
                  onLongPress={() => setMessageMenu(message)}
                  delayLongPress={250}
                  style={({ pressed }) => [
                    styles.bubble,
                    message.sender_id === userId
                      ? styles.myBubble
                      : { backgroundColor: theme.backgroundElement },
                    pressed && styles.bubblePressed,
                  ]}>
                  <ThemedText
                    style={
                      message.sender_id === userId ? styles.myBubbleText : styles.theirBubbleText
                    }>
                    {message.text}
                  </ThemedText>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={canSend ? 'Message…' : 'Messaging is off'}
              placeholderTextColor={theme.textSecondary}
              editable={canSend}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
            />
            <Pressable
              onPress={send}
              disabled={!canSend || input.trim().length === 0}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: '#3c87f7' },
                pressed && styles.pressed,
                (!canSend || input.trim().length === 0) && styles.disabled,
              ]}>
              <ThemedText type="smallBold" style={styles.sendText}>
                Send
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Header overflow: mute / block / report user. */}
      <ActionMenu
        visible={headerMenuOpen}
        title={peerName}
        options={[
          {
            label: iMutedPeer ? 'Unmute' : 'Mute',
            onPress: () => {
              const op = iMutedPeer ? unmuteUser(peer) : muteUser(peer);
              op.catch(() => {}).then(() => fetchMyMutes().then(setMutes).catch(() => {}));
            },
          },
          {
            label: iBlockedPeer ? 'Unblock' : 'Block',
            destructive: !iBlockedPeer,
            onPress: () => {
              const op = iBlockedPeer ? unblockUser(peer) : blockUser(peer);
              op.catch(() => {}).then(() => fetchMyBlocks().then(setBlocks).catch(() => {}));
            },
          },
          { label: 'Report user', onPress: () => setReportTarget({ kind: 'user' }) },
        ]}
        onClose={() => setHeaderMenuOpen(false)}
      />

      {/* Long-press on a line. */}
      <ActionMenu
        visible={messageMenu !== null}
        title={messageMenu?.text}
        options={[
          { label: 'Teach Sage this', onPress: () => messageMenu && openTeach(messageMenu) },
          ...(messageMenu && messageMenu.sender_id !== userId
            ? [
                {
                  label: 'Report message',
                  onPress: () =>
                    messageMenu && setReportTarget({ kind: 'message', messageId: messageMenu.id }),
                },
              ]
            : []),
          ...(messageMenu && messageMenu.sender_id === userId
            ? [
                {
                  label: 'Delete for me',
                  destructive: true,
                  onPress: () => messageMenu && onDeleteMessage(messageMenu),
                },
              ]
            : []),
        ]}
        onClose={() => setMessageMenu(null)}
      />

      {/* Report sheet (user or message). */}
      <ReportSheet
        visible={reportTarget !== null}
        target={
          reportTarget?.kind === 'message'
            ? { kind: 'message', messageId: reportTarget.messageId }
            : { kind: 'user', userId: peer }
        }
        title={reportTarget?.kind === 'user' ? `Report ${peerName}` : undefined}
        onClose={() => setReportTarget(null)}
      />

      {/* Teach Sage this — the one explicit path from chat into me.facts. */}
      <Modal
        visible={teachTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeTeach}>
        <Pressable style={styles.modalBackdrop} onPress={closeTeach}>
          <Pressable style={styles.modalCardWrap} onPress={() => {}}>
            <ThemedView type="backgroundElement" style={styles.modalCard}>
              {teachDone ? (
                <View style={styles.modalCenter}>
                  <ThemedText type="smallBold">Saved to Sage</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                    Saved as one fact. Sage is a coach — it only learns from these taps.
                  </ThemedText>
                  <Pressable
                    onPress={closeTeach}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: '#3c87f7' },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={styles.primaryText}>
                      Done
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.modalCenter}>
                  <ThemedText type="smallBold">Teach Sage this</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                    Exactly one fact, in your words. Sage is a coach, and only learns from these taps.
                  </ThemedText>
                  <TextInput
                    value={fact}
                    onChangeText={setFact}
                    multiline
                    editable={!teachBusy}
                    placeholder="The fact…"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.factInput,
                      { color: theme.text, backgroundColor: theme.backgroundSelected },
                    ]}
                  />
                  <View style={styles.modalRow}>
                    <Pressable
                      onPress={closeTeach}
                      disabled={teachBusy}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: controlBorderColor(theme) },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        Cancel
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={saveFact}
                      disabled={teachBusy || fact.trim().length === 0}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: '#3c87f7' },
                        pressed && styles.pressed,
                        (teachBusy || fact.trim().length === 0) && styles.disabled,
                      ]}>
                      <ThemedText type="smallBold" style={styles.primaryText}>
                        {teachBusy ? 'Saving…' : 'Save'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );

  function closeTeach() {
    setTeachTarget(null);
    setTeachBusy(false);
  }
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  backButton: {
    paddingVertical: Spacing.one,
    paddingRight: Spacing.one,
  },
  headerIdentity: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  headerButton: {
    padding: Spacing.one,
  },
  moreDots: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 1,
  },
  banner: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  error: {
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
  messages: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingBottom: Spacing.three,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3c87f7',
  },
  myBubbleText: {
    color: '#ffffff',
    lineHeight: 22,
  },
  theirBubbleText: {
    lineHeight: 22,
  },
  bubblePressed: {
    opacity: 0.7,
  },
  emptyCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
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
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  sendText: {
    color: '#ffffff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCardWrap: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth - Spacing.five,
  },
  modalCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalCenter: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  factInput: {
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  modalRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryButton: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
