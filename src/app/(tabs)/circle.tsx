import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircleButton, ComparePanel, failLine, MoreButton, ReportPanel, useTwoTap, type MenuTarget } from '@/components/circle-panels';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { COMPARE_UI } from '@/play/circle-compare';
import {
  CIRCLE_SUPPORT_EMAIL,
  CIRCLE_UI,
  cleanHandle,
  type CircleBlocked,
  type CircleFriend,
  type CircleReportReason,
  type CircleRequest,
  type CircleRequests,
} from '@/play/circle-visits';
import {
  blockCirclePeer,
  cancelCircleRequest,
  fetchCircleBlocked,
  fetchCircleFriends,
  fetchCircleRequests,
  removeCirclePeer,
  reportCirclePeer,
  respondCircleRequest,
  sendCircleRequest,
  unblockCirclePeer,
} from '@/play/circle-visits-store';

type Load = { kind: 'loading' } | { kind: 'ok'; friends: CircleFriend[] } | { kind: 'error' };

/** What the screen shows besides the list (null = the list). */
type Panel =
  | { kind: 'menu'; target: MenuTarget }
  | { kind: 'report'; target: MenuTarget }
  | { kind: 'reported'; target: MenuTarget }
  | { kind: 'compare'; target: MenuTarget }
  | { kind: 'blocked' };

/**
 * Circle — friends, requests, safety tools and chat (chat 1.1; safety tools moved here from the
 * Divecore sheet 2026-10-21, emci). Add by @handle, Requests, a ⋯ menu per friend (Message ·
 * Compare strengths · Report · Block · Remove, Block and Remove take two taps), Blocked, and a fixed
 * support line. The server calls and copy are the ones the Divecore sheet used; visits and gifts stay
 * in Divecore. Nothing here imports game UI.
 */
export default function CircleScreen() {
  const theme = useTheme();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [requests, setRequests] = useState<CircleRequests>({ incoming: [], outgoing: [] });
  const [blocked, setBlocked] = useState<CircleBlocked[]>([]);
  /** People blocked or removed in this sitting stay out of the list even if a reload is older. */
  const [gone, setGone] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const alive = useRef(true);
  const twoTap = useTwoTap();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reloadFriends = useCallback(async () => {
    const res = await fetchCircleFriends();
    if (alive.current) setLoad(res.kind === 'ok' ? { kind: 'ok', friends: res.value } : { kind: 'error' });
  }, []);
  const reloadRequests = useCallback(async () => {
    const res = await fetchCircleRequests();
    if (alive.current && res.kind === 'ok') setRequests(res.value);
  }, []);
  const reloadBlocked = useCallback(async () => {
    const res = await fetchCircleBlocked();
    if (alive.current && res.kind === 'ok') setBlocked(res.value);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadFriends();
      void reloadRequests();
      void reloadBlocked();
    }, [reloadFriends, reloadRequests, reloadBlocked]),
  );
  // A panel can open far down a long list: start it at the top.
  const scroller = useRef<ScrollView>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [panel?.kind]);

  const closePanel = () => {
    twoTap.disarm();
    setPanel(null);
    setPanelNote(null);
  };
  const openMenu = (target: MenuTarget) => {
    twoTap.disarm();
    setPanelNote(null);
    setPanel({ kind: 'menu', target });
  };

  /* ---- add by handle ---- */
  const sendRequest = async () => {
    const handle = cleanHandle(text);
    if (!handle) {
      setNote(CIRCLE_UI.addBadHandle);
      return;
    }
    setWorking(true);
    setNote(null);
    const res = await sendCircleRequest(handle);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok') {
      setNote(failLine(res));
      return;
    }
    if (res.value.kind === 'no') {
      setNote(CIRCLE_UI.addNo[res.value.reason]);
      return;
    }
    setText('');
    setNote(res.value.kind === 'accepted' ? CIRCLE_UI.addAccepted : CIRCLE_UI.addSent);
    void reloadRequests();
    if (res.value.kind === 'accepted') void reloadFriends();
  };

  /* ---- requests ---- */
  const answer = async (r: CircleRequest, accept: boolean) => {
    setWorking(true);
    setNote(null);
    const res = await respondCircleRequest(r.id, accept);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok') {
      setNote(failLine(res));
      return;
    }
    if (!res.value.ok) setNote(CIRCLE_UI.respondNo[res.value.reason]);
    else setNote(accept ? CIRCLE_UI.accepted : CIRCLE_UI.declined);
    void reloadRequests();
    if (accept) void reloadFriends();
  };
  const cancel = async (r: CircleRequest) => {
    setWorking(true);
    setNote(null);
    const res = await cancelCircleRequest(r.id);
    if (!alive.current) return;
    setWorking(false);
    setNote(res.kind === 'ok' ? CIRCLE_UI.canceled : failLine(res));
    void reloadRequests();
  };

  /* ---- block / remove / report / unblock ---- */
  const doBlock = async (peer: string) => {
    setWorking(true);
    const res = await blockCirclePeer(peer);
    if (!alive.current) return;
    setWorking(false);
    closePanel();
    if (res.kind !== 'ok' || !res.value) {
      setNote(res.kind === 'ok' ? CIRCLE_UI.error : failLine(res));
      return;
    }
    setGone((g) => [...g, peer]);
    setNote(CIRCLE_UI.blocked);
    void reloadFriends();
    void reloadRequests();
    void reloadBlocked();
  };
  const doRemove = async (peer: string) => {
    setWorking(true);
    const res = await removeCirclePeer(peer);
    if (!alive.current) return;
    setWorking(false);
    closePanel();
    if (res.kind !== 'ok' || !res.value) {
      setNote(res.kind === 'ok' ? CIRCLE_UI.error : failLine(res));
      return;
    }
    setGone((g) => [...g, peer]);
    setNote(CIRCLE_UI.removed);
    void reloadFriends();
  };
  const doReport = async (target: MenuTarget, reason: CircleReportReason) => {
    setWorking(true);
    setPanelNote(null);
    const res = await reportCirclePeer(target.peer, reason);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok') {
      setPanelNote(failLine(res));
      return;
    }
    if (!res.value.ok) {
      setPanelNote(CIRCLE_UI.reportNo[res.value.reason]);
      return;
    }
    setPanel({ kind: 'reported', target });
  };
  const doUnblock = async (b: CircleBlocked) => {
    setWorking(true);
    const res = await unblockCirclePeer(b.peer);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok' || !res.value) {
      setNote(res.kind === 'ok' ? CIRCLE_UI.error : failLine(res));
      return;
    }
    setNote(CIRCLE_UI.unblocked(b.handle));
    setBlocked((all) => all.filter((x) => x.peer !== b.peer));
    if (blocked.length <= 1) setPanel(null);
    void reloadBlocked();
    void reloadFriends();
  };

  const border = { borderColor: controlBorderColor(theme) };
  const friends = load.kind === 'ok' ? load.friends.filter((f) => !gone.includes(f.peer)) : [];

  /** One two-tap Block button (menu and the "reported" panel). */
  const blockButton = (target: MenuTarget, label: string) => (
    <CircleButton
      label={twoTap.armed === `block:${target.peer}` ? CIRCLE_UI.blockArmed(target.handle) : label}
      accessibilityLabel={`${CIRCLE_UI.block} @${target.handle}`}
      danger
      disabled={working}
      onPress={() => {
        if (twoTap.confirm(`block:${target.peer}`)) void doBlock(target.peer);
      }}
    />
  );

  const body = () => {
    if (panel?.kind === 'menu') {
      const t = panel.target;
      return (
        <View style={styles.stack}>
          <ThemedText type="subtitle">{CIRCLE_UI.menuTitle(t.handle)}</ThemedText>
          {t.canRemove ? (
            <CircleButton
              label={CIRCLE_UI.message}
              accessibilityLabel={`${CIRCLE_UI.message} @${t.handle}`}
              onPress={() => {
                closePanel();
                router.push({ pathname: '/chat', params: { peer: t.peer, handle: t.handle } });
              }}
            />
          ) : null}
          {t.canRemove ? (
            <CircleButton
              label={COMPARE_UI.menu}
              accessibilityLabel={`${COMPARE_UI.menu} @${t.handle}`}
              onPress={() => setPanel({ kind: 'compare', target: t })}
            />
          ) : null}
          <CircleButton label={CIRCLE_UI.report} accessibilityLabel={`${CIRCLE_UI.report} @${t.handle}`} onPress={() => setPanel({ kind: 'report', target: t })} />
          {blockButton(t, CIRCLE_UI.block)}
          <ThemedText themeColor="textSecondary">{CIRCLE_UI.blockQuiet}</ThemedText>
          {t.canRemove ? (
            <CircleButton
              label={twoTap.armed === `remove:${t.peer}` ? CIRCLE_UI.removeArmed(t.handle) : CIRCLE_UI.remove}
              accessibilityLabel={`${CIRCLE_UI.remove} @${t.handle}`}
              disabled={working}
              onPress={() => {
                if (twoTap.confirm(`remove:${t.peer}`)) void doRemove(t.peer);
              }}
            />
          ) : null}
          <CircleButton label={CIRCLE_UI.close} onPress={closePanel} />
        </View>
      );
    }
    if (panel?.kind === 'report') {
      const t = panel.target;
      return <ReportPanel working={working} note={panelNote} onReason={(reason) => void doReport(t, reason)} onBack={() => setPanel({ kind: 'menu', target: t })} />;
    }
    if (panel?.kind === 'compare') {
      const t = panel.target;
      return <ComparePanel peer={t.peer} handle={t.handle} onBack={() => setPanel({ kind: 'menu', target: t })} />;
    }
    if (panel?.kind === 'reported') {
      const t = panel.target;
      return (
        <View style={styles.stack}>
          <ThemedText type="subtitle">{CIRCLE_UI.menuTitle(t.handle)}</ThemedText>
          <ThemedText>{CIRCLE_UI.reported}</ThemedText>
          {blockButton(t, CIRCLE_UI.blockThemToo)}
          <ThemedText themeColor="textSecondary">{CIRCLE_UI.blockQuiet}</ThemedText>
          <CircleButton label={CIRCLE_UI.close} onPress={closePanel} />
        </View>
      );
    }
    if (panel?.kind === 'blocked') {
      return (
        <View style={styles.stack}>
          <ThemedText type="subtitle">{CIRCLE_UI.blockedTitle}</ThemedText>
          {blocked.map((b) => {
            const id = `unblock:${b.peer}`;
            return (
              <ThemedView key={b.peer} type="backgroundElement" style={[styles.row, border]}>
                <ThemedText style={styles.handle}>{`@${b.handle}`}</ThemedText>
                <CircleButton
                  label={twoTap.armed === id ? CIRCLE_UI.unblockArmed : CIRCLE_UI.unblock}
                  accessibilityLabel={`${CIRCLE_UI.unblock} @${b.handle}`}
                  disabled={working}
                  onPress={() => {
                    if (twoTap.confirm(id)) void doUnblock(b);
                  }}
                />
              </ThemedView>
            );
          })}
          <CircleButton label={CIRCLE_UI.back} onPress={closePanel} />
        </View>
      );
    }

    return (
      <View style={styles.stack}>
        <ThemedText type="subtitle">Circle</ThemedText>
        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={CIRCLE_UI.addPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={31}
            returnKeyType="send"
            onSubmitEditing={() => void sendRequest()}
            accessibilityLabel={CIRCLE_UI.addLabel}
            style={[styles.input, border, { color: theme.text }]}
            placeholderTextColor={theme.textSecondary}
          />
          <CircleButton label={CIRCLE_UI.send} onPress={() => void sendRequest()} disabled={working || text.trim().length === 0} />
        </View>
        {note ? <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">{note}</ThemedText> : null}

        {requests.incoming.length + requests.outgoing.length > 0 ? <ThemedText type="smallBold">{CIRCLE_UI.requests}</ThemedText> : null}
        {requests.incoming.map((r) => (
          <ThemedView key={r.id} type="backgroundElement" style={[styles.row, border]}>
            <View style={styles.grow}>
              <ThemedText style={styles.handle}>{`@${r.handle}`}</ThemedText>
              <ThemedText themeColor="textSecondary">{CIRCLE_UI.incomingStatus}</ThemedText>
            </View>
            <CircleButton label={CIRCLE_UI.accept} accessibilityLabel={`${CIRCLE_UI.accept} @${r.handle}`} disabled={working} onPress={() => void answer(r, true)} />
            <CircleButton label={CIRCLE_UI.decline} accessibilityLabel={`${CIRCLE_UI.decline} @${r.handle}`} disabled={working} onPress={() => void answer(r, false)} />
            <MoreButton handle={r.handle} onPress={() => openMenu({ peer: r.peer, handle: r.handle, canRemove: false })} />
          </ThemedView>
        ))}
        {requests.outgoing.map((r) => (
          <ThemedView key={r.id} type="backgroundElement" style={[styles.row, border]}>
            <View style={styles.grow}>
              <ThemedText style={styles.handle}>{`@${r.handle}`}</ThemedText>
              <ThemedText themeColor="textSecondary">{CIRCLE_UI.outgoingStatus}</ThemedText>
            </View>
            <CircleButton label={CIRCLE_UI.cancel} accessibilityLabel={`${CIRCLE_UI.cancel} @${r.handle}`} disabled={working} onPress={() => void cancel(r)} />
          </ThemedView>
        ))}

        {load.kind === 'loading' ? (
          <ActivityIndicator />
        ) : load.kind === 'error' ? (
          <ThemedText themeColor="textSecondary">Could not load your Circle. Leave this tab and come back to try again.</ThemedText>
        ) : friends.length === 0 ? (
          <ThemedText themeColor="textSecondary">Scan a friend to add them to your Circle, or add one by handle.</ThemedText>
        ) : (
          friends.map((f) => (
            <ThemedView key={f.peer} type="backgroundElement" style={[styles.row, border]}>
              <ThemedText style={styles.handle}>{`@${f.handle}`}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Message @${f.handle}`}
                onPress={() => router.push({ pathname: '/chat', params: { peer: f.peer, handle: f.handle } })}
                style={[styles.button, border]}>
                <ThemedText>Message</ThemedText>
              </Pressable>
              <MoreButton handle={f.handle} onPress={() => openMenu({ peer: f.peer, handle: f.handle, canRemove: true })} />
            </ThemedView>
          ))
        )}

        {blocked.length > 0 ? <CircleButton label={CIRCLE_UI.blockedRow(blocked.length)} onPress={() => setPanel({ kind: 'blocked' })} /> : null}

        <Pressable
          onPress={() => void Linking.openURL(`mailto:${CIRCLE_SUPPORT_EMAIL}`).catch(() => undefined)}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={CIRCLE_UI.supportLabel}>
          <ThemedText themeColor="textSecondary">
            {CIRCLE_UI.supportLead} {CIRCLE_SUPPORT_EMAIL}
          </ThemedText>
        </Pressable>
        <ThemedText themeColor="textSecondary">Visits and gifts are in Divecore.</ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView ref={scroller} {...NO_PINCH_ZOOM} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="never">
          {body()}
        </ScrollView>
      </SafeAreaView>
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
  scroll: {
    paddingTop: NAV_PIXEL_HEADER_INSET,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  stack: { gap: Spacing.three },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  grow: { flex: 1 },
  handle: {
    flexShrink: 1,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
