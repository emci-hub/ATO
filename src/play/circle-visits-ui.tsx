/**
 * Circle visits — what you see (hideout roadmap step 6, plan approved by emci 2026-10-15).
 *
 *  - `CircleSheet`: the float-layer card the Hideout rail's Circle button opens (the away card's
 *    shape): one fixed-height, scrolling list of your Circle (handle · status · share switch · Visit),
 *    plus the Circle safety tools (wave104, Apple 1.2): Add by handle, Requests, a ⋯ menu per person
 *    (Report · Block · Remove), a Blocked list and a fixed support line.
 *  - `CircleGiftCard`: a friend's pet left you a gift (a sticker, or a Circle stamp).
 *  - `CircleVisitStrip`: the notice lane while you are in a friend's Hideout ("@name's Hideout").
 * Every box is fixed: loading, empty, error and full lists all keep the same card size. The ⋯ menu,
 * the report list and the blocked list draw INSIDE the card (an overlay of the same size), so no
 * section ever resizes it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import {
  CIRCLE_REPORT_REASON_IDS,
  CIRCLE_SUPPORT_EMAIL,
  CIRCLE_UI,
  circleGiftIsSticker,
  cleanHandle,
  friendStatus,
  type CircleBlocked,
  type CircleFriend,
  type CircleGift,
  type CircleReportReason,
  type CircleRequest,
  type CircleRequests,
} from '@/play/circle-visits';
import { COMPARE_UI, type CircleCompareCard } from '@/play/circle-compare';
import { fetchCompareCard, fetchCompareList, setCompareShare } from '@/play/circle-compare-store';
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
  type CircleCall,
} from '@/play/circle-visits-store';
import { VISITOR_STICKER_ART } from '@/play/daily-visitor-ui';
import { RAIL_ICON_ART } from '@/play/hideout-art';
import { heroName } from '@/play/heroes-data';
import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { sheetCard } from '@/play/sheet-kit';
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
/** A first tap arms a block / remove / unblock; it disarms by itself after this long. */
const ARM_MS = 3000;

function useCloseOnBack(onClose: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
}

/**
 * Two taps before a write (same idea as `useTwoTap` in dev-lab.tsx, kept local: Play never imports
 * from the app folder). `confirm(id)` is false on the first tap (it arms that id) and true on the second.
 */
function useTwoTap(): { armed: string | null; confirm: (id: string) => boolean; disarm: () => void } {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const disarm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setArmed(null);
  }, []);
  const confirm = useCallback(
    (id: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (armed === id) {
        setArmed(null);
        return true;
      }
      setArmed(id);
      timer.current = setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), ARM_MS);
      return false;
    },
    [armed],
  );
  return { armed, confirm, disarm };
}

/** One 44pt-tall text button used by the in-card panels and the request / blocked rows. */
function SmallButton({
  label,
  onPress,
  accessibilityLabel,
  disabled,
  danger,
  width,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  danger?: boolean;
  width?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.small, danger && styles.smallDanger, width != null && { width }, disabled && styles.dim, pressed && styles.pressed]}>
      <Text style={[styles.smallText, danger && styles.smallTextDanger]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The "⋯" button: a 44 × 44 hit area. */
function MoreButton({ handle, onPress }: { handle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={CIRCLE_UI.more(handle)}
      style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
      <Text style={styles.moreText} maxFontSizeMultiplier={1.1}>
        {CIRCLE_UI.moreGlyph}
      </Text>
    </Pressable>
  );
}

function FriendRow({
  f,
  busy,
  onToggle,
  onVisit,
  onMore,
}: {
  f: CircleFriend;
  busy: boolean;
  onToggle: (on: boolean) => void;
  onVisit: () => void;
  onMore: () => void;
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
      <MoreButton handle={f.handle} onPress={onMore} />
    </View>
  );
}

/** Which in-card panel is open (null = the list). */
type Panel =
  | { kind: 'menu'; peer: string; handle: string; canRemove: boolean }
  | { kind: 'report'; peer: string; handle: string; canRemove: boolean }
  | { kind: 'reported'; peer: string; handle: string }
  | { kind: 'compare'; peer: string; handle: string; canRemove: boolean };

/** The Compare panel's data (wave105). */
type CompareState =
  | { status: 'loading' }
  | { status: 'error'; msg: string }
  | { status: 'ready'; mine: boolean; allowed: boolean; preview: string[]; card: CircleCompareCard | null };

type View2 = 'list' | 'blocked';

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
  const reduced = noticeReduceMotion();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${CIRCLE_UI.sheetTitle}. ${CIRCLE_UI.sheetNote}`);
  }, []);

  // The parent owns the first load; this card keeps its own copy so a block / remove / accept can refresh it.
  const [list, setList] = useState<CircleListState>(state);
  useEffect(() => setList(state), [state]);
  /** People blocked or removed in this sitting stay out of the list even if the parent's copy is older. */
  const [gone, setGone] = useState<string[]>([]);
  const [requests, setRequests] = useState<CircleRequests>({ incoming: [], outgoing: [] });
  const [blocked, setBlocked] = useState<CircleBlocked[]>([]);
  const [view, setView] = useState<View2>('list');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const [localNote, setLocalNote] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const twoTap = useTwoTap();

  const closePanel = useCallback(() => {
    twoTap.disarm();
    setPanel(null);
    setPanelNote(null);
  }, [twoTap]);
  const back = useCallback(() => {
    if (panel) closePanel();
    else if (view === 'blocked') setView('list');
    else onClose();
  }, [panel, view, closePanel, onClose]);
  useCloseOnBack(back);

  const failLine = (res: CircleCall<unknown>): string => (res.kind === 'off' ? CIRCLE_UI.off : res.kind === 'signed_out' ? CIRCLE_UI.signedOut : CIRCLE_UI.error);

  const reloadRequests = useCallback(async () => {
    const res = await fetchCircleRequests();
    if (alive.current && res.kind === 'ok') setRequests(res.value);
  }, []);
  const reloadBlocked = useCallback(async () => {
    const res = await fetchCircleBlocked();
    if (alive.current && res.kind === 'ok') setBlocked(res.value);
  }, []);
  const reloadFriends = useCallback(async () => {
    const res = await fetchCircleFriends();
    if (alive.current && res.kind === 'ok') setList({ kind: 'ok', friends: res.value });
  }, []);
  useEffect(() => {
    void reloadRequests();
    void reloadBlocked();
  }, [reloadRequests, reloadBlocked]);

  const friends = list.kind === 'ok' ? list.friends.filter((f) => !gone.includes(f.peer)) : [];
  const message =
    list.kind === 'loading'
      ? CIRCLE_UI.loading
      : list.kind === 'signed_out'
        ? CIRCLE_UI.signedOut
        : list.kind === 'off'
          ? CIRCLE_UI.off
          : list.kind === 'error'
            ? CIRCLE_UI.error
            : null;

  /* ---- add by handle ---- */
  const sendRequest = async () => {
    const handle = cleanHandle(text);
    if (!handle) {
      setLocalNote(CIRCLE_UI.addBadHandle);
      return;
    }
    setWorking(true);
    setLocalNote(null);
    const res = await sendCircleRequest(handle);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok') {
      setLocalNote(failLine(res));
      return;
    }
    if (res.value.kind === 'no') {
      setLocalNote(CIRCLE_UI.addNo[res.value.reason]);
      return;
    }
    setText('');
    setLocalNote(res.value.kind === 'accepted' ? CIRCLE_UI.addAccepted : CIRCLE_UI.addSent);
    void reloadRequests();
    if (res.value.kind === 'accepted') void reloadFriends();
  };

  /* ---- requests ---- */
  const answer = async (r: CircleRequest, accept: boolean) => {
    setWorking(true);
    setLocalNote(null);
    const res = await respondCircleRequest(r.id, accept);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok') {
      setLocalNote(failLine(res));
      return;
    }
    if (!res.value.ok) setLocalNote(CIRCLE_UI.respondNo[res.value.reason]);
    else setLocalNote(accept ? CIRCLE_UI.accepted : CIRCLE_UI.declined);
    void reloadRequests();
    if (accept) void reloadFriends();
  };
  const cancel = async (r: CircleRequest) => {
    setWorking(true);
    setLocalNote(null);
    const res = await cancelCircleRequest(r.id);
    if (!alive.current) return;
    setWorking(false);
    setLocalNote(res.kind === 'ok' ? CIRCLE_UI.canceled : failLine(res));
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
      setLocalNote(res.kind === 'ok' ? CIRCLE_UI.error : failLine(res));
      return;
    }
    setGone((g) => [...g, peer]);
    setLocalNote(CIRCLE_UI.blocked);
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
      setLocalNote(res.kind === 'ok' ? CIRCLE_UI.error : failLine(res));
      return;
    }
    setGone((g) => [...g, peer]);
    setLocalNote(CIRCLE_UI.removed);
    void reloadFriends();
  };
  const doReport = async (p: { peer: string; handle: string }, reason: CircleReportReason) => {
    setWorking(true);
    setPanelNote(null);
    const res = await reportCirclePeer(p.peer, reason);
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
    setPanel({ kind: 'reported', peer: p.peer, handle: p.handle });
  };
  const doUnblock = async (b: CircleBlocked) => {
    setWorking(true);
    const res = await unblockCirclePeer(b.peer);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok' || !res.value) {
      setLocalNote(res.kind === 'ok' ? CIRCLE_UI.error : failLine(res));
      return;
    }
    setLocalNote(CIRCLE_UI.unblocked(b.handle));
    setBlocked((all) => all.filter((x) => x.peer !== b.peer));
    if (blocked.length <= 1) setView('list');
    void reloadBlocked();
    void reloadFriends();
  };

  /* ---- compare (strengths only, both switches on) ---- */
  const [cmp, setCmp] = useState<CompareState>({ status: 'loading' });
  /** The friend the Compare panel is on now: a slow reply for someone else is dropped. */
  const cmpPeer = useRef<string | null>(null);
  const loadCompare = async (peer: string) => {
    cmpPeer.current = peer;
    const list = await fetchCompareList();
    if (!alive.current || cmpPeer.current !== peer) return;
    if (list.kind !== 'ok') {
      setCmp({ status: 'error', msg: failLine(list) });
      return;
    }
    const f = list.value.friends.find((x) => x.peer === peer);
    let card: CircleCompareCard | null = null;
    if (f?.allowed) {
      const c = await fetchCompareCard(peer);
      if (!alive.current || cmpPeer.current !== peer) return;
      if (c.kind !== 'ok') {
        setCmp({ status: 'error', msg: failLine(c) });
        return;
      }
      if (c.value !== 'not_allowed') card = c.value;
    }
    setCmp({ status: 'ready', mine: f?.mine === true, allowed: f?.allowed === true && card != null, preview: list.value.preview, card });
  };
  const openCompare = (peer: string, handle: string, canRemove: boolean) => {
    twoTap.disarm();
    setPanelNote(null);
    setCmp({ status: 'loading' });
    setPanel({ kind: 'compare', peer, handle, canRemove });
    void loadCompare(peer);
  };
  const flipCompare = async (peer: string, on: boolean) => {
    setWorking(true);
    setPanelNote(null);
    const res = await setCompareShare(peer, on);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok') {
      setPanelNote(failLine(res));
      return;
    }
    void loadCompare(peer);
  };

  const openMenu = (peer: string, handle: string, canRemove: boolean) => {
    twoTap.disarm();
    setPanelNote(null);
    setPanel({ kind: 'menu', peer, handle, canRemove });
  };

  const shownNote = localNote ?? note;
  const ms = reduced ? 260 : 200;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.Never)}
        exiting={FadeOut.duration(ms).reduceMotion(ReduceMotion.Never)}
        style={[styles.card, { top }]}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {view === 'blocked' ? CIRCLE_UI.blockedTitle : CIRCLE_UI.sheetTitle}
        </Text>
        <Text style={styles.hint} numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {CIRCLE_UI.sheetNote}
        </Text>
        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={CIRCLE_UI.addPlaceholder}
            placeholderTextColor={NEON.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={31}
            returnKeyType="send"
            onSubmitEditing={() => void sendRequest()}
            accessibilityLabel={CIRCLE_UI.addLabel}
            style={styles.input}
          />
          <SmallButton label={CIRCLE_UI.send} onPress={() => void sendRequest()} disabled={working || text.trim().length === 0} width={64} />
        </View>
        <View style={styles.list}>
          {message != null ? (
            <Text style={styles.message} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : view === 'blocked' ? (
            <ScrollView contentContainerStyle={styles.rows} showsVerticalScrollIndicator={blocked.length > 4}>
              {blocked.map((b) => {
                const id = `unblock:${b.peer}`;
                return (
                  <View key={b.peer} style={styles.row}>
                    <View style={styles.who}>
                      <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                        @{b.handle}
                      </Text>
                    </View>
                    <SmallButton
                      label={twoTap.armed === id ? CIRCLE_UI.unblockArmed : CIRCLE_UI.unblock}
                      accessibilityLabel={`${CIRCLE_UI.unblock} @${b.handle}`}
                      disabled={working}
                      width={96}
                      onPress={() => {
                        if (twoTap.confirm(id)) void doUnblock(b);
                      }}
                    />
                  </View>
                );
              })}
              <SmallButton label={CIRCLE_UI.back} onPress={() => setView('list')} />
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.rows} showsVerticalScrollIndicator={friends.length + requests.incoming.length + requests.outgoing.length > 3}>
              {requests.incoming.length + requests.outgoing.length > 0 ? (
                <Text style={styles.section} maxFontSizeMultiplier={1.2} accessibilityRole="header">
                  {CIRCLE_UI.requests}
                </Text>
              ) : null}
              {requests.incoming.map((r) => (
                <View key={r.id} style={styles.row}>
                  <View style={styles.who}>
                    <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      @{r.handle}
                    </Text>
                    <Text style={styles.status} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      {CIRCLE_UI.incomingStatus}
                    </Text>
                  </View>
                  <SmallButton label={CIRCLE_UI.accept} accessibilityLabel={`${CIRCLE_UI.accept} @${r.handle}`} disabled={working} width={58} onPress={() => void answer(r, true)} />
                  <SmallButton label={CIRCLE_UI.decline} accessibilityLabel={`${CIRCLE_UI.decline} @${r.handle}`} disabled={working} width={58} onPress={() => void answer(r, false)} />
                  <MoreButton handle={r.handle} onPress={() => openMenu(r.peer, r.handle, false)} />
                </View>
              ))}
              {requests.outgoing.map((r) => (
                <View key={r.id} style={styles.row}>
                  <View style={styles.who}>
                    <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      @{r.handle}
                    </Text>
                    <Text style={styles.status} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      {CIRCLE_UI.outgoingStatus}
                    </Text>
                  </View>
                  <SmallButton label={CIRCLE_UI.cancel} accessibilityLabel={`${CIRCLE_UI.cancel} @${r.handle}`} disabled={working} width={72} onPress={() => void cancel(r)} />
                </View>
              ))}
              {friends.length === 0 ? (
                <Text style={styles.message} maxFontSizeMultiplier={1.2}>
                  {CIRCLE_UI.empty}
                </Text>
              ) : (
                friends.map((f) => (
                  <FriendRow
                    key={f.peer}
                    f={f}
                    busy={busyPeer === f.peer}
                    onToggle={(on) => onToggle(f, on)}
                    onVisit={() => onVisit(f)}
                    onMore={() => openMenu(f.peer, f.handle, true)}
                  />
                ))
              )}
              {blocked.length > 0 ? (
                <SmallButton label={CIRCLE_UI.blockedRow(blocked.length)} onPress={() => setView('blocked')} />
              ) : null}
            </ScrollView>
          )}
        </View>
        <Text style={[styles.note, shownNote == null && styles.hidden]} numberOfLines={1} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
          {shownNote ?? ' '}
        </Text>
        <Pressable
          onPress={() => void Linking.openURL(`mailto:${CIRCLE_SUPPORT_EMAIL}`).catch(() => undefined)}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={CIRCLE_UI.supportLabel}
          style={styles.support}>
          <Text style={styles.supportText} numberOfLines={1} maxFontSizeMultiplier={1.1}>
            {CIRCLE_UI.supportLead} <Text style={styles.supportLink}>{CIRCLE_SUPPORT_EMAIL}</Text>
          </Text>
        </Pressable>
        <NeonButton label={CIRCLE_UI.done} variant="secondary" onPress={onClose} />

        {panel ? (
          <View style={styles.panel} accessibilityViewIsModal>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {panel.kind === 'report' ? CIRCLE_UI.reportTitle : panel.kind === 'compare' ? COMPARE_UI.title(panel.handle) : CIRCLE_UI.menuTitle(panel.handle)}
            </Text>
            {panel.kind === 'menu' ? (
              <>
                {panel.canRemove ? (
                  <SmallButton label={COMPARE_UI.menu} accessibilityLabel={`${COMPARE_UI.menu} @${panel.handle}`} onPress={() => openCompare(panel.peer, panel.handle, panel.canRemove)} />
                ) : null}
                <SmallButton label={CIRCLE_UI.report} accessibilityLabel={`${CIRCLE_UI.report} @${panel.handle}`} onPress={() => setPanel({ ...panel, kind: 'report' })} />
                <SmallButton
                  label={twoTap.armed === `block:${panel.peer}` ? CIRCLE_UI.blockArmed(panel.handle) : CIRCLE_UI.block}
                  accessibilityLabel={`${CIRCLE_UI.block} @${panel.handle}`}
                  danger
                  disabled={working}
                  onPress={() => {
                    if (twoTap.confirm(`block:${panel.peer}`)) void doBlock(panel.peer);
                  }}
                />
                <Text style={styles.hint} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {CIRCLE_UI.blockQuiet}
                </Text>
                {panel.canRemove ? (
                  <SmallButton
                    label={twoTap.armed === `remove:${panel.peer}` ? CIRCLE_UI.removeArmed(panel.handle) : CIRCLE_UI.remove}
                    accessibilityLabel={`${CIRCLE_UI.remove} @${panel.handle}`}
                    disabled={working}
                    onPress={() => {
                      if (twoTap.confirm(`remove:${panel.peer}`)) void doRemove(panel.peer);
                    }}
                  />
                ) : null}
                <View style={styles.panelFill} />
                <NeonButton label={CIRCLE_UI.close} variant="secondary" onPress={closePanel} />
              </>
            ) : panel.kind === 'report' ? (
              <>
                {CIRCLE_REPORT_REASON_IDS.map((reason) => (
                  <SmallButton
                    key={reason}
                    label={CIRCLE_UI.reportReasons[reason]}
                    disabled={working}
                    onPress={() => void doReport(panel, reason)}
                  />
                ))}
                <Text style={[styles.note, panelNote == null && styles.hidden]} numberOfLines={1} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
                  {panelNote ?? ' '}
                </Text>
                <View style={styles.panelFill} />
                <NeonButton label={CIRCLE_UI.back} variant="secondary" onPress={() => setPanel({ kind: 'menu', peer: panel.peer, handle: panel.handle, canRemove: panel.canRemove })} />
              </>
            ) : panel.kind === 'compare' ? (
              <>
                <ScrollView style={styles.panelFill} contentContainerStyle={styles.rows} showsVerticalScrollIndicator>
                  <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
                    {COMPARE_UI.consent}
                  </Text>
                  {cmp.status === 'loading' ? (
                    <Text style={styles.message} maxFontSizeMultiplier={1.2}>
                      {COMPARE_UI.loading}
                    </Text>
                  ) : cmp.status === 'error' ? (
                    <Text style={styles.message} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
                      {cmp.msg}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.section} maxFontSizeMultiplier={1.2} accessibilityRole="header">
                        {COMPARE_UI.previewFor(panel.handle)}
                      </Text>
                      <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
                        {cmp.preview.length > 0 ? cmp.preview.map((p) => `· ${p}`).join('\n') : COMPARE_UI.previewNone}
                      </Text>
                      <View style={styles.row}>
                        <View style={styles.who}>
                          <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                            {cmp.mine ? COMPARE_UI.switchOn : COMPARE_UI.switchOff}
                          </Text>
                          {cmp.mine && !cmp.allowed ? (
                            <Text style={styles.status} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                              {COMPARE_UI.waiting(panel.handle)}
                            </Text>
                          ) : null}
                        </View>
                        <Switch
                          value={cmp.mine}
                          disabled={working}
                          onValueChange={(on) => void flipCompare(panel.peer, on)}
                          accessibilityLabel={COMPARE_UI.switchLabel(panel.handle, cmp.mine)}
                          trackColor={{ false: 'rgba(255,255,255,0.18)', true: NEON.cyan }}
                          thumbColor={cmp.mine ? STREET.paper : '#9a9aa6'}
                        />
                      </View>
                      {cmp.allowed && cmp.card ? (
                        <>
                          <Text style={styles.section} maxFontSizeMultiplier={1.2} accessibilityRole="header">
                            {COMPARE_UI.sharedTitle}
                          </Text>
                          <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
                            {cmp.card.shared.length > 0 ? cmp.card.shared.map((p) => `· ${p}`).join('\n') : COMPARE_UI.sharedNone}
                          </Text>
                          <Text style={styles.section} maxFontSizeMultiplier={1.2} accessibilityRole="header">
                            {COMPARE_UI.theirsTitle(panel.handle)}
                          </Text>
                          <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
                            {cmp.card.theirs.length > 0 ? cmp.card.theirs.map((p) => `· ${p}`).join('\n') : COMPARE_UI.theirsNone}
                          </Text>
                        </>
                      ) : null}
                    </>
                  )}
                  <Text style={[styles.note, panelNote == null && styles.hidden]} numberOfLines={1} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
                    {panelNote ?? ' '}
                  </Text>
                </ScrollView>
                <NeonButton label={CIRCLE_UI.back} variant="secondary" onPress={() => setPanel({ kind: 'menu', peer: panel.peer, handle: panel.handle, canRemove: panel.canRemove })} />
              </>
            ) : (
              <>
                <Text style={styles.message} maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite">
                  {CIRCLE_UI.reported}
                </Text>
                <SmallButton
                  label={twoTap.armed === `block:${panel.peer}` ? CIRCLE_UI.blockArmed(panel.handle) : CIRCLE_UI.blockThemToo}
                  accessibilityLabel={`${CIRCLE_UI.block} @${panel.handle}`}
                  danger
                  disabled={working}
                  onPress={() => {
                    if (twoTap.confirm(`block:${panel.peer}`)) void doBlock(panel.peer);
                  }}
                />
                <Text style={styles.hint} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {CIRCLE_UI.blockQuiet}
                </Text>
                <View style={styles.panelFill} />
                <NeonButton label={CIRCLE_UI.close} variant="secondary" onPress={closePanel} />
              </>
            )}
          </View>
        ) : null}
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
    ...sheetCard,
  },
  title: { fontFamily: STREET_FONT.bold, fontSize: 16, color: NEON.cyan, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, color: NEON.textMuted },
  list: { height: LIST_H },
  rows: { gap: ROW_GAP },
  message: { fontFamily: STREET_FONT.regular, fontSize: 15, lineHeight: 20, color: NEON.textPrimary, paddingTop: 8 },
  note: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, height: 18, color: STREET.mustard },
  hidden: { opacity: 0 },
  section: { fontFamily: STREET_FONT.bold, fontSize: 13, lineHeight: 18, color: STREET.mustard, textTransform: 'uppercase', letterSpacing: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44 },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    fontFamily: STREET_FONT.regular,
    fontSize: 15,
    color: NEON.textPrimary,
  },
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  moreText: { fontFamily: STREET_FONT.bold, fontSize: 22, lineHeight: 26, color: NEON.textPrimary },
  small: {
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: STREET.mustard,
  },
  smallDanger: { borderColor: '#ff5d6c' },
  smallText: { fontFamily: STREET_FONT.bold, fontSize: 14, color: STREET.mustard },
  smallTextDanger: { color: '#ff5d6c' },
  support: { height: 18, justifyContent: 'center' },
  supportText: { fontFamily: STREET_FONT.regular, fontSize: 12, lineHeight: 16, color: NEON.textMuted },
  supportLink: { color: NEON.cyan, textDecorationLine: 'underline' },
  panel: {
    ...StyleSheet.absoluteFillObject,
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: STREET.ink,
  },
  panelFill: { flex: 1 },
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
