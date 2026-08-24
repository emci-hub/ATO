import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PixelFace } from '@/components/pixel-face';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCircle } from '@/hooks/use-circle';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchPeerState, type PeerState } from '@/lib/circle';
import { normalizeRecipe } from '@/lib/recipe';

/**
 * Circle. Appears only after a scan/paste connected two accounts. Each card
 * surfaces what is ALREADY on the other person's me row and checks — their
 * real pixel and their honest current check. Nothing is synthesized, and no
 * chat inbox lives here (that's Stage 7).
 */
export default function CircleScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { connections, loading, refresh } = useCircle(userId);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPeers = useCallback(async () => {
    if (!userId || connections.length === 0) {
      setPeers([]);
      return;
    }
    const states = await Promise.all(connections.map((c) => fetchPeerState(c.peer_id)));
    setPeers(states.filter((state): state is PeerState => state != null));
  }, [userId, connections]);

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
            renderItem={({ item }) => <PeerCard peer={item} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function PeerCard({ peer }: { peer: PeerState }) {
  const { me, checks } = peer;
  const recipe = normalizeRecipe(me.recipe);
  const latest = checks[checks.length - 1];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardTop}>
        <PixelFace recipe={recipe} size={72} showUp={me.show_up} />
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
});
