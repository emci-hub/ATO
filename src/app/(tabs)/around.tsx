import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { PixelFace } from '@/components/pixel-face';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { aroundCityBySlug, DEFAULT_AROUND_CITY } from '@/constants/around-cities';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { NIGHT_GOING_AGE_YEARS, isAtLeastAge } from '@/lib/age';
import { GOING_UNDER_18_MESSAGE, showRequires18 } from '@/lib/around/ages';
import { aroundEmptyCopy, fetchWeekendJson } from '@/lib/around/fetch';
import { fetchNight, setGoing, type NightSnapshot } from '@/lib/around/going';
import { ticketLabel } from '@/lib/around/tickets';
import type { AroundLoad, AroundShow, TicketKind } from '@/lib/around/types';
import { hslForHue } from '@/lib/color';
import { recipeForAccount } from '@/lib/kenney/registry';
import type { Me } from '@/lib/me';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';

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
  const [nights, setNights] = useState<Record<string, NightSnapshot>>({});

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

  useEffect(() => {
    if (load?.status !== 'ok' || !session?.user.id) {
      setNights({});
      return;
    }
    let cancelled = false;
    Promise.all(
      load.payload.shows.map(async (show) => {
        try {
          const night = await fetchNight(show.id);
          return [show.id, night] as const;
        } catch {
          return [show.id, { going: false, colors: [], faces: [] }] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, NightSnapshot> = {};
      for (const [id, night] of rows) next[id] = night;
      setNights(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load, session?.user.id]);

  const label = aroundCityBySlug(city)?.label ?? city;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Around</ThemedText>
            <ThemedText themeColor="textSecondary">
              {me?.city ? label : 'Set your city in Settings — typed, not GPS.'}
            </ThemedText>
          </View>

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
            ? load.payload.shows.map((show) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  me={me}
                  night={nights[show.id]}
                  onNight={(next) => setNights((prev) => ({ ...prev, [show.id]: next }))}
                />
              ))
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

function ShowCard({
  show,
  me,
  night,
  onNight,
}: {
  show: AroundShow;
  me: Me | null | undefined;
  night: NightSnapshot | undefined;
  onNight: (next: NightSnapshot) => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gated = showRequires18(show.ages);
  const oldEnough = me?.born_on ? isAtLeastAge(me.born_on, NIGHT_GOING_AGE_YEARS) : false;
  const canGo = !gated || oldEnough;
  const going = !!night?.going;
  const colors = night?.colors ?? [];
  const faces = night?.faces ?? [];

  async function toggleGoing() {
    if (!me || busy) return;
    if (!canGo && !going) {
      setError(GOING_UNDER_18_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onNight(await setGoing(show.id, show.ages, !going));
    } catch (err) {
      const message = err instanceof Error ? err.message : GOING_UNDER_18_MESSAGE;
      setError(message);
    } finally {
      setBusy(false);
    }
  }

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

      <Pressable
        onPress={toggleGoing}
        disabled={busy || !me || (!canGo && !going)}
        accessibilityRole="button"
        accessibilityState={{ selected: going, disabled: !canGo && !going }}
        style={({ pressed }) => [
          styles.goingChip,
          {
            backgroundColor: going ? theme.backgroundSelected : 'transparent',
            borderColor: controlBorderColor(theme),
          },
          pressed && styles.pressed,
          (busy || !me) && styles.disabled,
        ]}>
        <ThemedText type="smallBold">{going ? "You're going" : "I'm going"}</ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
          {error}
        </ThemedText>
      ) : null}
      {!canGo && !going ? (
        <ThemedText type="small" themeColor="textSecondary">
          {GOING_UNDER_18_MESSAGE}
        </ThemedText>
      ) : null}

      {colors.length > 0 ? (
        <View style={styles.colorRow} accessibilityLabel="Colors on this night">
          {colors.map((hue) => (
            <View
              key={hue}
              accessibilityLabel="A color on this night"
              style={[styles.colorBlob, { backgroundColor: hslForHue(hue) }]}
            />
          ))}
        </View>
      ) : null}

      {faces.length > 0 ? (
        <ScrollView
          {...NO_PINCH_ZOOM}
          horizontal
          contentContainerStyle={styles.faces}
          showsHorizontalScrollIndicator={false}>
          {faces.map((face) => (
            <View key={face.id} style={styles.face}>
              <PixelFace recipe={recipeForAccount(face.id, face.recipe)} size={36} showUp={face.show_up} animated={false} />
              <ThemedText type="code" numberOfLines={1}>
                @{face.handle}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.links}>
        {show.links.map((link) => (
          <Pressable
            key={link.url}
            onPress={() => openUrl(link.url)}
            style={({ pressed }) => [
              styles.linkChip,
              { borderColor: controlBorderColor(theme) },
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
  header: {
    gap: Spacing.half,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  goingChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  colorBlob: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  faces: {
    gap: Spacing.three,
    paddingRight: Spacing.two,
  },
  face: {
    width: 72,
    alignItems: 'center',
    gap: Spacing.one,
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
  disabled: {
    opacity: 0.6,
  },
});
