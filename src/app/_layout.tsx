import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PushRuntime } from '@/components/push-runtime';
import { useTheme } from '@/hooks/use-theme';
import { MeProvider, useMeContext } from '@/lib/me-context';
import { initSentry, Sentry } from '@/lib/sentry';
import { useSession } from '@/hooks/use-session';

initSentry();
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <MeProvider>
        <RootNavigator />
      </MeProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const { me, loading: meLoading } = useMeContext();

  const isAuthed = !!session;
  const hasMe = !!me;
  const resolving = sessionLoading || (isAuthed && meLoading);

  return (
    <>
      <AnimatedSplashOverlay />
      {resolving ? (
        <View style={[styles.blank, { backgroundColor: theme.background }]} />
      ) : (
        <>
          {isAuthed && hasMe ? <PushRuntime /> : null}
          <Stack screenOptions={{ headerShown: false }}>
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
