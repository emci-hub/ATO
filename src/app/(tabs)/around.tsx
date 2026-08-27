import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { aroundCityBySlug, DEFAULT_AROUND_CITY } from '@/constants/around-cities';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { aroundEmptyCopy, fetchWeekendJson } from '@/lib/around/fetch';
import { ticketLabel } from '@/lib/around/tickets';
import type { AroundLoad, AroundShow, TicketKind } from '@/lib/around/types';

async function openUrl(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

export default function AroundScreen() {
  const { session } = useSession();
  const { me } = useMe(session?.user.id);
  const city = me?.city ?? DEFAULT_AROUND_CITY.slug;
  const [load, setLoad] = useState<AroundLoad | null>(null);

  const reload = useCallback(() => {
    if (!city) {
      setLoad({ status: 'empty', city: '' });
      return;
    }
    setLoad(null);
    fetchWeekendJson(city).then(setLoad);
  }, [city]);

  useEffect(() => {
    reload();
  }, [reload]);

  const label = aroundCityBySlug(city)?.label ?? city;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Around</ThemedText>
          <ThemedText themeColor="textSecondary">
            {me?.city ? label : 'Set your city in Settings — typed, not GPS.'}
          </ThemedText>

          {load == null ? (
            <ThemedText themeColor="textSecondary">Loading this weekend…</ThemedText>
          ) : null}

          {load?.status === 'error' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText>{load.message}</ThemedText>
              <Pressable onPress={reload} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="link">Try again</ThemedText>
              </Pressable>
            </ThemedView>
          ) : null}

          {load?.status === 'empty' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText>{aroundEmptyCopy()}</ThemedText>
            </ThemedView>
          ) : null}

          {load?.status === 'ok'
            ? load.payload.shows.map((show) => <ShowCard key={show.id} show={show} />)
            : null}

          <ThemedText type="small" themeColor="textSecondary" style={styles.attr}>
            Event listings from Edmtrain. Tickets open on Edmtrain, Resident Advisor,
            Shotgun, or DICE — nothing is bought in ATO.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ShowCard({ show }: { show: AroundShow }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary">
        {show.date}
        {show.ages ? ` · ${show.ages}` : ''}
      </ThemedText>
      <ThemedText type="smallBold">{show.name}</ThemedText>
      {show.venueName ? (
        <ThemedText themeColor="textSecondary">{show.venueName}</ThemedText>
      ) : null}
      {show.artists.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {show.artists.join(', ')}
        </ThemedText>
      ) : null}
      <View style={styles.links}>
        {show.links.map((link) => (
          <Pressable
            key={link.url}
            onPress={() => openUrl(link.url)}
            style={({ pressed }) => [
              styles.linkChip,
              { borderColor: theme.border === 'transparent' ? theme.backgroundSelected : theme.border },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{ticketLabel(link.kind as TicketKind)}</ThemedText>
          </Pressable>
        ))}
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
  scroll: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  linkChip: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  attr: {
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
