import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useState } from 'react';
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

import { AiConsentCard } from '@/components/ai-consent-card';
import { CrisisCard } from '@/components/crisis-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { checksToHistory, fetchChecks, type Check } from '@/lib/checks';
import { logCrisisFlag } from '@/lib/crisis/log';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { aiConsentFor, setAiConsent } from '@/lib/me';
import { routeTalkReply } from '@/lib/voice/talk';
import { routeVoiceCard } from '@/lib/voice/router';

interface ChatMessage {
  id: string;
  role: 'user' | 'sage';
  text: string;
  crisis?: boolean;
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

export default function SageScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe } = useMe(userId);

  const [checks, setChecks] = useState<Check[]>([]);
  const [todayCard, setTodayCard] = useState<{ read: string; do: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'send' | 'consent' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const reloadChecks = useCallback(async () => {
    if (!userId) return;
    try {
      setChecks(await fetchChecks(userId));
    } catch (err) {
      console.log('[talk] fetchChecks error:', err);
    }
  }, [userId]);

  useEffect(() => {
    reloadChecks();
  }, [reloadChecks]);

  // Load today's card for context (Talk replies can reference it).
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    routeVoiceCard({
      me: {
        name: me.name,
        show_up: me.show_up,
        talk_style: me.talk_style,
        knocks_you_off: me.knocks_you_off,
        morning_cue: me.morning_cue,
      },
      checkCount: checks.length,
      history: checksToHistory(checks),
      aiConsent: me.ai_consent,
    })
      .then((result) => {
        if (!cancelled && result.card) {
          setTodayCard(result.card);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me, checks]);

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

  function addMessage(message: Omit<ChatMessage, 'id'>) {
    setMessages((prev) => [...prev, { ...message, id: `m${nextMessageId++}` }]);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!me || !userId || busy || trimmed.length === 0) return;
    setBusy('send');
    setError(null);
    addMessage({ role: 'user', text: trimmed });
    setInput('');

    try {
      const result = await routeTalkReply(
        {
          me: {
            name: me.name,
            show_up: me.show_up,
            talk_style: me.talk_style,
            knocks_you_off: me.knocks_you_off,
            morning_cue: me.morning_cue,
          },
          message: trimmed,
          checkCount: checks.length,
          history: checksToHistory(checks),
          todayCard,
          aiConsent: me.ai_consent,
          userId,
        },
        { logCrisisFlag: (id) => logCrisisFlag(id) },
      );

      if (result.kind === 'crisis') {
        // No confirmation step — the static card shows automatically.
        // CRISIS HARD RULE: no gesture. Hands stay hidden — never celebrated,
        // never acknowledged with a pose. No exception.
        addMessage({ role: 'sage', text: '', crisis: true });
      } else if (result.kind === 'reply' && result.reply) {
        addMessage({ role: 'sage', text: result.reply });
        triggerGesture('talkReply');
      }
    } catch (err) {
      console.log('[talk] routeTalkReply error:', err);
      setError('Sage couldn\u2019t reply. Try again.');
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

  const canChat = me != null && consent === 'granted';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <ThemedText type="subtitle">Sage</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lede}>
              Talk it out. Sage listens, then replies.
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

        {!me ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          </ThemedView>
        ) : consent === 'pending' ? (
          <AiConsentCard
            context="talk"
            busy={busy === 'consent'}
            onGrant={() => saveConsent(true)}
            onDeny={() => saveConsent(false)}
          />
        ) : consent === 'denied' ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="smallBold">Talk is off</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              You chose to keep Sage off AI, so Sage can&apos;t reply here. Your daily
              cards keep working.
            </ThemedText>
          </ThemedView>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}>
            <ScrollView
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled">
              {messages.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    Say hi, or tap a chip to get started. Sage stays on your side.
                  </ThemedText>
                </ThemedView>
              ) : (
                messages.map((message) =>
                  message.role === 'user' ? (
                    <View key={message.id} style={[styles.bubble, styles.userBubble]}>
                      <ThemedText style={[styles.bubbleText, styles.userBubbleText]}>
                        {message.text}
                      </ThemedText>
                    </View>
                  ) : message.crisis ? (
                    <View key={message.id} style={styles.crisisBubble}>
                      <CrisisCard onDismiss={() => dismissCrisis(message.id)} />
                    </View>
                  ) : (
                    <View
                      key={message.id}
                      style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText style={styles.bubbleText}>{message.text}</ThemedText>
                    </View>
                  ),
                )
              )}
              {busy === 'send' ? (
                <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Sage is writing…
                  </ThemedText>
                </View>
              ) : null}
              {error ? (
                <ThemedText type="small" style={[styles.error, { color: '#E5484D' }]}>
                  {error}
                </ThemedText>
              ) : null}
            </ScrollView>

            <View style={styles.composer}>
              <ScrollView
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
                      { borderColor: theme.backgroundSelected },
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
                          { borderColor: theme.backgroundSelected },
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
                  placeholder="Ask Sage anything…"
                  placeholderTextColor={theme.textSecondary}
                  editable={busy === null}
                  onSubmitEditing={() => send(input)}
                  returnKeyType="send"
                  multiline
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
                    { backgroundColor: '#3c87f7' },
                    pressed && styles.pressed,
                    (busy !== null || input.trim().length === 0) && styles.disabled,
                  ]}>
                  <MaterialCommunityIcons name="send" size={18} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

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
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Close
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  lede: {
    paddingTop: Spacing.half,
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
    paddingBottom: BottomTabInset + Spacing.three,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3c87f7',
  },
  userBubbleText: {
    color: '#ffffff',
  },
  bubbleText: {
    lineHeight: 22,
  },
  crisisBubble: {
    alignSelf: 'stretch',
  },
  error: {
    alignSelf: 'center',
    fontWeight: 600,
  },
  composer: {
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
    alignSelf: 'center',
    padding: Spacing.two,
  },
});
