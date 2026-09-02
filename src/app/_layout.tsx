import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PushRuntime } from '@/components/push-runtime';
import { useTheme } from '@/hooks/use-theme';
import { CrisisRegionProvider } from '@/lib/crisis/region-context';
import { AppearanceProvider, useAppearance } from '@/lib/theme/context';
import { navigationTheme } from '@/lib/theme/navigation';
import { MeProvider, useMeContext } from '@/lib/me-context';
import { initSentry, Sentry } from '@/lib/sentry';
import { useSession } from '@/hooks/use-session';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';

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
        <CrisisRegionProvider>
          <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
        </CrisisRegionProvider>
      </MeProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const { me, loading: meLoading } = useMeContext();
  const { ready: appearanceReady } = useAppearance();

  const isAuthed = !!session;
  const hasMe = !!me;
  const resolving = sessionLoading || (isAuthed && meLoading) || !appearanceReady;

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

            <Stack.Protected guard={isAuthed && !hasMe}>
              <Stack.Screen name="onboarding" />
            </Stack.Protected>

            <Stack.Protected guard={isAuthed && hasMe}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="dawn" />
              <Stack.Screen name="week" />
              <Stack.Screen name="questions" />
              <Stack.Screen name="chat" />
              <Stack.Screen name="dev-lab" />
              <Stack.Screen name="ai-lab" />
            </Stack.Protected>

            <Stack.Protected guard={PRE_LAUNCH_DEV}>
              <Stack.Screen name="theme-lab" />
              <Stack.Screen name="around-lab" />
              <Stack.Screen name="talk-lab" />
              <Stack.Screen name="pixel-lab" />
              <Stack.Screen name="crisis-lab" />
              <Stack.Screen name="voice-lab" />
            </Stack.Protected>
          </Stack>
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
