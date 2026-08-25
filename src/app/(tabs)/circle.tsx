import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PixelFace } from '@/components/pixel-face';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCircleContext } from '@/lib/circle-context';
import { useTheme } from '@/hooks/use-theme';
import { fetchPeerState, type PeerState } from '@/lib/circle';
import { normalizeRecipe } from '@/lib/kenney/registry';

/**
 * Circle. Appears only after a scan/paste connected two accounts. Each card
 * surfaces what is ALREADY on the other person's me row and checks — their
 * real pixel and their honest current check. Nothing is synthesized, and no
 * chat inbox lives here (that's Stage 7).
 */
export default function CircleScreen() {
  const theme = useTheme();
  const { connections, loading, refresh, unfriend } = useCircleContext();
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Circle</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
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
            renderItem={({ item }) => <PeerCard peer={item} onUnfriend={unfriend} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function PeerCard({
  peer,
  onUnfriend,
}: {
  peer: PeerState;
  onUnfriend: (peerId: string) => Promise<void>;
}) {
  const theme = useTheme();
  const { me, checks } = peer;
  const recipe = normalizeRecipe(me.recipe);
  const latest = checks[checks.length - 1];
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <View style={styles.honestCard}>
        {latest ? (
          <>
            <View style={styles.honestHeader}>
              <ThemedText type="smallBold">Their latest check</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Day {latest.day} · {latest.status === 'done' ? 'showed up' : 'skipped'}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.readText}>
              {latest.read_text}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.doText}>
              {latest.do_text}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {me.name} hasn&apos;t done a check yet.
          </ThemedText>
        )}
      </View>

      {confirming ? (
        <ThemedView type="backgroundElement" style={[styles.confirmBox, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.confirmText}>
            Unfriend {me.name}? You&apos;ll need to scan their QR again to reconnect.
          </ThemedText>
          {error ? (
            <ThemedText type="small" style={[styles.errorText, { color: '#E5484D' }]}>
              {error}
            </ThemedText>
          ) : null}
          <View style={styles.confirmActions}>
            <Pressable
              disabled={working}
              onPress={() => setConfirming(false)}
              style={({ pressed }) => [
                styles.confirmButton,
                { borderColor: theme.backgroundSelected },
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
            { borderColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={[styles.unfriendText, { color: '#E5484D' }]}>
            Unfriend
          </ThemedText>
        </Pressable>
      )}
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
  lede: {
    lineHeight: 18,
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardIdentity: {
    flex: 1,
    gap: Spacing.half,
  },
  nameText: {
    fontSize: 17,
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
  unfriendLink: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  unfriendText: {
    fontSize: 13,
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
