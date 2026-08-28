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

initSentry();
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  return (
    <AppearanceProvider>
      <RootThemeBridge />
    </AppearanceProvider>
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
            <Stack.Screen name="theme-lab" />
            <Stack.Screen name="around-lab" />
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
              <Stack.Screen name="chat" />
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
