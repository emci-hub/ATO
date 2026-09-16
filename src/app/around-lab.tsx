import { Redirect } from 'expo-router';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { isAtLeastAge, NIGHT_GOING_AGE_YEARS } from '@/lib/age';
import { aroundEmptyCopy, fetchWeekendJson } from '@/lib/around/fetch';
import { GOING_UNDER_18_MESSAGE, showRequires18 } from '@/lib/around/ages';
import { fetchNight, setGoing, type NightSnapshot } from '@/lib/around/going';
import type { AroundLoad } from '@/lib/around/types';

/** Dev-only fixture — never a real show id. Swap in a real one from the DB to test against live data. */
const DEV_SHOW_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Dev harness: load a city's static weekend.json without a session.
 * Production: blocked.
 */
export default function AroundLabScreen() {
  const [city, setCity] = useState('calgary');
  const [load, setLoad] = useState<AroundLoad | null>(null);
  const { session } = useSession();
  const { me } = useMe(session?.user.id);

  const [goingAges, setGoingAges] = useState<'all-ages' | '18+'>('18+');
  const [snapshot, setSnapshot] = useState<NightSnapshot | null>(null);
  const [goingBusy, setGoingBusy] = useState(false);
  const [goingError, setGoingError] = useState<string | null>(null);

  useEffect(() => {
    if (!PRE_LAUNCH_DEV) return;
    fetchWeekendJson(city).then(setLoad);
  }, [city]);

  if (!PRE_LAUNCH_DEV) {
    return <Redirect href="/" />;
  }

  const agesString = goingAges === '18+' ? '18+' : null;
  const gated = showRequires18(agesString);
  const oldEnough = me?.born_on ? isAtLeastAge(me.born_on, NIGHT_GOING_AGE_YEARS) : false;
  const canGo = !gated || oldEnough;
  // Prefer a real seeded show (fixture city) so the RPC round-trip actually
  // succeeds; the placeholder UUID still proves the call wires up if no
  // fixture show has loaded yet.
  const activeShowId = load?.status === 'ok' ? load.payload.shows[0]?.id ?? DEV_SHOW_ID : DEV_SHOW_ID;

  async function loadNight() {
    setGoingError(null);
    try {
      setSnapshot(await fetchNight(activeShowId));
    } catch (err) {
      setGoingError(err instanceof Error ? err.message : 'fetchNight failed');
    }
  }

  async function toggleGoing() {
    if (goingBusy) return;
    if (gated && !oldEnough) {
      setGoingError(GOING_UNDER_18_MESSAGE);
      return;
    }
    setGoingBusy(true);
    setGoingError(null);
    try {
      setSnapshot(await setGoing(activeShowId, agesString, !(snapshot?.going ?? false)));
    } catch (err) {
      setGoingError(err instanceof Error ? err.message : 'setGoing failed');
    } finally {
      setGoingBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Around lab</ThemedText>
          <ThemedText themeColor="textSecondary">Static JSON only. No live Edmtrain from the phone.</ThemedText>
          <Pressable onPress={() => setCity('calgary')} style={styles.row}>
            <ThemedText type="smallBold">Calgary</ThemedText>
          </Pressable>
          <Pressable onPress={() => setCity('fixture')} style={styles.row}>
            <ThemedText type="smallBold">fixture (seeded test shows)</ThemedText>
          </Pressable>
          <Pressable onPress={() => setCity('nowhere')} style={styles.row}>
            <ThemedText type="smallBold">nowhere (empty)</ThemedText>
          </Pressable>
          {load == null ? <ThemedText themeColor="textSecondary">Loading…</ThemedText> : null}
          {load?.status === 'empty' ? <ThemedText>{aroundEmptyCopy()}</ThemedText> : null}
          {load?.status === 'error' ? <ThemedText>{load.message}</ThemedText> : null}
          {load?.status === 'ok' ? (
            <ThemedText>
              {load.payload.shows.length} show{load.payload.shows.length === 1 ? '' : 's'} · {load.payload.weekendStart}–{load.payload.weekendEnd}
            </ThemedText>
          ) : null}

          <ThemedText type="subtitle">Going / colors / faces</ThemedText>
          <ThemedText themeColor="textSecondary">
            Exercises `night_snapshot` / `set_going` and the same age gate as the real Around
            screen, using your own `me.born_on` ({me?.born_on ?? 'not set'}).
          </ThemedText>
          <Pressable
            onPress={() => setGoingAges(goingAges === '18+' ? 'all-ages' : '18+')}
            style={styles.row}>
            <ThemedText type="smallBold">Show ages: {goingAges}</ThemedText>
          </Pressable>
          <ThemedText themeColor="textSecondary">
            gated={String(gated)} · oldEnough={String(oldEnough)} · canGo={String(canGo)}
          </ThemedText>
          <Pressable onPress={loadNight} style={styles.row}>
            <ThemedText type="smallBold">fetchNight (dev show id)</ThemedText>
          </Pressable>
          <Pressable onPress={() => void toggleGoing()} disabled={goingBusy} style={styles.row}>
            <ThemedText type="smallBold">
              {goingBusy ? '…' : snapshot?.going ? "setGoing(false) — I'm going" : 'setGoing(true) — not going'}
            </ThemedText>
          </Pressable>
          {goingError ? <ThemedText themeColor="textSecondary">{goingError}</ThemedText> : null}
          {snapshot ? (
            <ThemedText themeColor="textSecondary">
              going={String(snapshot.going)} · colors={snapshot.colors.length} · faces={snapshot.faces.length}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four },
  scroll: { gap: Spacing.three, paddingVertical: Spacing.four },
  row: { paddingVertical: Spacing.two },
});
