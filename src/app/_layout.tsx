import { PreviewBanner } from '@/components/preview-banner';
import { UpdateReadyBanner } from '@/components/update-ready-banner';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppDevFab } from '@/components/app-dev-fab';
import { PushRuntime } from '@/components/push-runtime';
import { useTheme } from '@/hooks/use-theme';
import { AppearanceProvider, useAppearance } from '@/lib/theme/context';
import { navigationTheme } from '@/lib/theme/navigation';
import { MeProvider, useMeContext } from '@/lib/me-context';
import { initSentry, Sentry } from '@/lib/sentry';
import { useSession } from '@/hooks/use-session';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { getLocalAgeEntry, localAgeEntryFor, resolveAgeGate, subscribeLocalAgeEntry } from '@/lib/age';

initSentry();
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppearanceProvider>
        <RootThemeBridge />
      </AppearanceProvider>
    </GestureHandlerRootView>
  );
}

function RootThemeBridge() {
  const theme = useTheme();

  return (
    <ThemeProvider value={navigationTheme(theme)}>
      <MeProvider>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
      </MeProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const { me, loading: meLoading } = useMeContext();
  const { ready: appearanceReady } = useAppearance();
  // Load display (Rajdhani) + HUD mono (Space Mono) before the navigator
  // paints, so no screen renders with a fallback face and then swaps. A font
  // load error still releases the UI rather than hanging on the blank view.
  const [fontsLoaded, fontError] = useFonts({
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  // This app session's under-18 entry from /confirm-age (memory only, never sent).
  useSyncExternalStore(subscribeLocalAgeEntry, getLocalAgeEntry, getLocalAgeEntry);

  const isAuthed = !!session;
  const meRow = !!me;
  // Age gate (emci 2026-10-20, docs/under18-access.md): worked out from born_on
  // on the phone's date at every render, never stored. Unknown birthday →
  // confirm-age; under 18 → under-18; 18+ → the app. PRE_LAUNCH_DEV does not
  // bypass it. Nothing is deleted or written by the gate.
  const ageGate = isAuthed && meRow ? resolveAgeGate(me?.born_on, localAgeEntryFor(me?.id)).state : 'open';
  const ageConfirm = ageGate === 'confirm';
  const ageBlocked = ageGate === 'blocked';
  const ageGated = ageConfirm || ageBlocked;
  // hasMe = "the app shell may open": a me row AND the age gate is open.
  const hasMe = meRow && !ageGated;
  const fontsReady = fontsLoaded || !!fontError;
  const resolving =
    sessionLoading || (isAuthed && meLoading) || !appearanceReady || !fontsReady;

  return (
    <>
      <AnimatedSplashOverlay />
      {resolving ? (
        <View style={[styles.blank, { backgroundColor: theme.background }]} />
      ) : (
        <>
          {isAuthed && hasMe ? <PushRuntime /> : null}
          <Stack screenOptions={{ headerShown: false }}>
            {/*
              First available screen is the cold-start route. Theme/talk/pixel
              labs stay behind __DEV__. /dev-lab is on the authed stack so
              TestFlight root + granted testers can open it; the screen still
              Redirects anyone else.
            */}
            <Stack.Protected guard={!isAuthed}>
              <Stack.Screen name="auth" />
            </Stack.Protected>

            <Stack.Protected guard={isAuthed && !meRow}>
              <Stack.Screen name="onboarding" />
            </Stack.Protected>

            {/* No usable birthday: confirm it once. No tabs, AI, push, Circle, Divecore. */}
            <Stack.Protected guard={ageConfirm}>
              <Stack.Screen name="confirm-age" />
            </Stack.Protected>

            {/* Under 18 today: this screen only. No tabs, AI, push, Circle, Divecore. */}
            <Stack.Protected guard={ageBlocked}>
              <Stack.Screen name="under-18" />
            </Stack.Protected>

            <Stack.Protected guard={isAuthed && hasMe}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="week" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="roll" />
              <Stack.Screen name="quest/index" />
              <Stack.Screen name="quest/[id]" />
              <Stack.Screen name="chat" />
              <Stack.Screen name="dev-lab" />
            </Stack.Protected>

            {/* Outer guard: labs and Play (Divecore) never open to an age-gated account. */}
            <Stack.Protected guard={!ageGated}>
              {/* Play (Divecore) is on in every build (launch flip, emci 2026-10-20); pinned by check:release-mode. */}
              <Stack.Screen name="play" />
              <Stack.Protected guard={PRE_LAUNCH_DEV}>
                {/* Dev age-gate preview: synthetic fixtures only, no account read or write. */}
                <Stack.Screen name="age-gate-lab" />
                <Stack.Screen name="theme-lab" />
                <Stack.Screen name="around-lab" />
                <Stack.Screen name="pixel-lab" />
                <Stack.Screen name="profile-card-lab" />
              </Stack.Protected>
            </Stack.Protected>
          </Stack>
          {/* Floating dev button over every app screen; gated inside (the Hub's
              rule) and hidden on /play, which has its own. Not while age-gated. */}
          {ageGated ? null : <AppDevFab />}
          {/* Dev "Preview as new user": a red bar over every screen while it is on. */}
          <PreviewBanner />
          {/* A downloaded OTA update only runs after a restart: offer it with one tap. */}
          <UpdateReadyBanner />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
  },
});

export default Sentry.wrap(RootLayout);
