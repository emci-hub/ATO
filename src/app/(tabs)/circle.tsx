import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/action-menu';
import { PixelFace } from '@/components/pixel-face';
import { ReportSheet } from '@/components/report-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCircleContext } from '@/lib/circle-context';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchPeerState, type PeerState } from '@/lib/circle';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { recipeForAccount } from '@/lib/kenney/registry';
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

/**
 * Circle. Appears only after a scan/paste connected two accounts. Each card
 * surfaces what is ALREADY on the other person's me row and checks — their
 * real pixel and their honest current check. Nothing is synthesized.
 *
 * Tapping a card opens the one thread for that connection (Stage 7 chat). The
 * overflow menu holds mute (local to you, silent), block (both directions),
 * and report user; unfriend stays at the bottom of the card.
 */
export default function CircleScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { connections, loading, refresh, unfriend } = useCircleContext();
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [mutes, setMutes] = useState<MuteRow[]>([]);

  const reloadModeration = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([fetchMyBlocks(), fetchMyMutes()]);
      setBlocks(b);
      setMutes(m);
    } catch {
      // Non-fatal — the menus just show default labels.
    }
  }, []);

  useEffect(() => {
    reloadModeration();
  }, [reloadModeration, userId]);

  const loadPeers = useCallback(async () => {
    if (connections.length === 0) {
      setPeers([]);
      return;
    }
    const states = await Promise.all(connections.map((c) => fetchPeerState(c.peer_id)));
    setPeers(states.filter((state): state is PeerState => state != null));
  }, [connections]);

  useEffect(() => {
    loadPeers().catch(() => {});
  }, [loadPeers]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
      await loadPeers();
      await reloadModeration();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Circle</ThemedText>
          <ThemedText themeColor="textSecondary">
            People who scanned your ATO. Their honest card, their real face.
          </ThemedText>
        </View>

        {connections.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="smallBold">Circle is empty</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Scan a friend&apos;s QR on the You tab (or paste their link). One scan
              opens Circle for both of you.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            {...NO_PINCH_ZOOM}
            data={peers}
            keyExtractor={(item) => item.me.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing || loading}
                onRefresh={onRefresh}
                tintColor={theme.textSecondary}
              />
            }
            ListEmptyComponent={
              loading ? null : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Loading your circle…
                </ThemedText>
              )
            }
            renderItem={({ item }) => (
              <PeerCard
                peer={item}
                blocks={blocks}
                mutes={mutes}
                onUnfriend={unfriend}
                onModerationChanged={reloadModeration}
              />
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function PeerCard({
  peer,
  blocks,
  mutes,
  onUnfriend,
  onModerationChanged,
}: {
  peer: PeerState;
  blocks: BlockRow[];
  mutes: MuteRow[];
  onUnfriend: (peerId: string) => Promise<void>;
  onModerationChanged: () => Promise<void>;
}) {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, checks } = peer;
  const recipe = recipeForAccount(me.id, me.recipe);
  const latest = checks[checks.length - 1];
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const iBlockedPeer = blocks.some((b) => b.blocked_by === userId && b.blocked_user === me.id);
  const iMutedPeer = mutes.some((m) => m.muter === userId && m.muted_user === me.id);

  function openChat() {
    router.push({ pathname: '/chat', params: { peer: me.id } });
  }

  async function runModeration(op: () => Promise<void>) {
    setWorking(true);
    try {
      await op();
      await onModerationChanged();
    } catch (err) {
      console.log('[circle] moderation error:', err);
    } finally {
      setWorking(false);
    }
  }

  async function unfriend() {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await onUnfriend(me.id);
      // on success the connection is gone — the tab (and this card) disappear.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\u2019t unfriend. Try again.');
      setConfirming(false);
      setWorking(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTop}>
          <PixelFace recipe={recipe} size={72} showUp={me.show_up} animated={false} />
          <View style={styles.cardIdentity}>
            <ThemedText type="smallBold" style={styles.nameText}>
              {me.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              @{me.handle}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {me.show_up}
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={12}
          accessibilityLabel={`More options for ${me.name}`}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.moreDots}>
            ···
          </ThemedText>
        </Pressable>
      </View>

      <Pressable onPress={openChat} style={({ pressed }) => [pressed && styles.pressed]}>
        <ThemedView style={styles.honestCard}>
          {latest ? (
            <>
              <View style={styles.honestHeader}>
                <ThemedText type="smallBold">Their latest check</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Day {latest.day} · {latest.status === 'done' ? 'showed up' : 'skipped'}
                </ThemedText>
              </View>
              {latest.read_text ? (
                <ThemedText type="small" style={styles.readText}>
                  {latest.read_text}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.readText}>
                  Outcome kept. The Read for this day has rolled off.
                </ThemedText>
              )}
              {latest.do_text ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.doText}>
                  {latest.do_text}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {me.name} hasn&apos;t done a check yet.
            </ThemedText>
          )}
        </ThemedView>
        <ThemedText type="smallBold" style={styles.chatLinkText}>
          Message {me.name.split(' ')[0]} ›
        </ThemedText>
      </Pressable>

      {confirming ? (
        <ThemedView type="backgroundElement" style={[styles.confirmBox, { borderColor: controlBorderColor(theme) }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.confirmText}>
            Unfriend {me.name}? You&apos;ll need to scan their QR again to reconnect.
          </ThemedText>
          {error ? (
            <ThemedText type="smallBold" style={[styles.errorText, { color: '#E5484D' }]}>
              {error}
            </ThemedText>
          ) : null}
          <View style={styles.confirmActions}>
            <Pressable
              disabled={working}
              onPress={() => setConfirming(false)}
              style={({ pressed }) => [
                styles.confirmButton,
                { borderColor: controlBorderColor(theme) },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Keep
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={working}
              onPress={unfriend}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: '#E5484D' },
                pressed && styles.pressed,
                working && styles.disabled,
              ]}>
              <ThemedText type="smallBold" style={styles.unfriendConfirmText}>
                {working ? 'Unfriending…' : 'Unfriend'}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      ) : (
        <Pressable
          onPress={() => setConfirming(true)}
          style={({ pressed }) => [
            styles.unfriendLink,
            { borderColor: controlBorderColor(theme) },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
            Unfriend
          </ThemedText>
        </Pressable>
      )}

      {/* Overflow menu: chat, mute (local), block (both ways), report user. */}
      <ActionMenu
        visible={menuOpen}
        title={me.name}
        options={[
          { label: 'Message', onPress: openChat },
          {
            label: iMutedPeer ? 'Unmute' : 'Mute',
            onPress: () =>
              runModeration(() => (iMutedPeer ? unmuteUser(me.id) : muteUser(me.id))),
          },
          {
            label: iBlockedPeer ? 'Unblock' : 'Block',
            destructive: !iBlockedPeer,
            onPress: () =>
              runModeration(() => (iBlockedPeer ? unblockUser(me.id) : blockUser(me.id))),
          },
          { label: 'Report user', onPress: () => setReportOpen(true) },
        ]}
        onClose={() => setMenuOpen(false)}
      />

      <ReportSheet
        visible={reportOpen}
        target={{ kind: 'user', userId: me.id }}
        title={`Report ${me.name}`}
        onClose={() => setReportOpen(false)}
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
  header: {
    gap: Spacing.half,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
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
  listContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardTop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardIdentity: {
    flex: 1,
    gap: Spacing.half,
  },
  nameText: {
    fontSize: 18,
  },
  moreButton: {
    padding: Spacing.one,
  },
  moreDots: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 1,
  },
  honestCard: {
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: Spacing.three,
    gap: Spacing.one,
  },
  honestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  readText: {
    lineHeight: 20,
  },
  doText: {
    lineHeight: 18,
  },
  chatLinkText: {
    color: '#3c87f7',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  unfriendLink: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  confirmBox: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  confirmText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  confirmButton: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  unfriendConfirmText: {
    color: '#ffffff',
  },
  errorText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
