/**
 * The app's floating dev button (outside Play) — the same draggable DEV bubble
 * Play uses, mounted once in the root layout. Tap it and the Dev Tools Hub
 * sections for the screen you are on open ON TOP of that screen: Home gets the
 * jump menu, Explore the trait viewer, Questions the jump menu and Start over,
 * You the account tools, Sage the quota / fence / trace.
 * Quota, trace and the fence are one tap away on every screen, and the full
 * Hub (root-only tools included) stays a button at the bottom.
 *
 * The sections ARE the Hub's own components (`app/dev-lab`), not copies, and
 * the per-capability gates are the Hub's (`canSeeHubSection`). Who sees the
 * button at all: `appDevFabVisible` — anyone who has entered the dev PIN this
 * session (the box at the bottom of You — the same PIN and lock as Divecore), plus
 * root, a granted capability or a dev build. Never on /play (it has its own).
 * In a release build it never renders for anyone (`hubAccess` is not 'full').
 */
import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  BandDetailStepper,
  FenceTester,
  JumpThisAccount,
  LocalAccountData,
  QuotaDashboard,
  ResetAiConsent,
  StartOver,
  TraceCapture,
  TraitViewer,
} from '@/app/dev-lab';
import { DailyLineDev } from '@/components/daily-line-dev';
import { IntakeStatus, MiniGuyPanel, NextRoundPreview, TokensToday } from '@/components/dev-hub-panels';
import { DevInspector } from '@/components/dev-inspector';
import { PlayDevFab } from '@/components/play-dev-fab';
import { RunningUpdateLine } from '@/components/running-update-line';
import { ThemedText } from '@/components/themed-text';
import { YouDevTools } from '@/components/you-dev-tools';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { canSeeHubSection, hubAccess, type DevCapability } from '@/lib/dev-access';
import { DEV_TOOLS_AVAILABLE } from '@/lib/dev-mode';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { useDevPinUnlocked } from '@/lib/dev-pin';
import {
  appDevEverywhere,
  appDevFabVisible,
  appDevScreen,
  type AppDevSection,
} from '@/lib/dev-fab-model';
import { useMeContext } from '@/lib/me-context';

/** The Hub capability a section needs (none = anyone who can open the Hub). */
const SECTION_CAPABILITY: Partial<Record<AppDevSection, DevCapability>> = {
  traits: 'traits',
  quota: 'quota',
  fence: 'fence',
  trace: 'trace',
};

export function AppDevFab() {
  const pathname = usePathname();
  const { me, devAccess, devAccessLoading } = useMeContext();
  const { session } = useSession();
  const devUnlocked = useDevAccessUnlocked();
  // The dev PIN (Divecore's lock, shared — lib/dev-pin.ts). This is the normal way in.
  const pinUnlocked = useDevPinUnlocked();
  const [open, setOpen] = useState(false);
  const gate = useMemo(
    () => ({
      // The pre-launch flag alone does NOT open it, so a tester who has not entered
      // the PIN never sees the bubble. The PIN, root, a granted capability or a dev
      // build does.
      isDev: __DEV__ || devUnlocked || pinUnlocked,
      isRoot: devAccess.isRoot,
      capabilities: devAccess.capabilities,
    }),
    [devUnlocked, pinUnlocked, devAccess.isRoot, devAccess.capabilities],
  );
  const visible = appDevFabVisible({
    isAuthed: !!session,
    hasMe: !!me,
    devAccessLoading,
    // 'full' only: a release build has no bubble, whatever is unlocked.
    canSeeHub: hubAccess({ toolsAvailable: DEV_TOOLS_AVAILABLE, ...gate }) === 'full',
    pathname,
  });
  if (!visible) return null;

  const screen = appDevScreen(pathname);
  const allowed = (s: AppDevSection) => {
    const cap = SECTION_CAPABILITY[s];
    return cap ? canSeeHubSection(cap, gate) : true;
  };
  return (
    <PlayDevFab
      // "&& visible" is implied here (we returned above), but a reset that drops
      // `me` unmounts this; start closed again when it comes back.
      open={open}
      onOpenChange={setOpen}
      title={`Dev tools · ${screen?.label ?? 'this screen'}`}
      panel={
        // Keyed by screen so each one opens on its own tools.
        <AppDevPanel
          key={pathname}
          pathname={pathname}
          own={(screen?.sections ?? []).filter(allowed)}
          everywhere={appDevEverywhere(pathname).filter(allowed)}
          timeZone={me?.timezone || 'UTC'}
          userId={me?.id ?? null}
          onClose={() => setOpen(false)}
        />
      }
    />
  );
}

function AppDevPanel({
  pathname,
  own,
  everywhere,
  timeZone,
  userId,
  onClose,
}: {
  pathname: string;
  own: readonly AppDevSection[];
  everywhere: readonly AppDevSection[];
  timeZone: string;
  userId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const [showEverywhere, setShowEverywhere] = useState(own.length === 0);

  const section = (id: AppDevSection): ReactNode => {
    switch (id) {
      case 'quota':
        return <QuotaDashboard key={id} />;
      case 'traits':
        return <TraitViewer key={id} />;
      case 'band-stepper':
        return <BandDetailStepper key={id} />;
      case 'jump':
        return <JumpThisAccount key={id} />;
      case 'start-over':
        return <StartOver key={id} />;
      case 'you-tools':
        return <YouDevTools key={id} timeZone={timeZone} />;
      case 'ai-consent':
        return <ResetAiConsent key={id} />;
      case 'local-data':
        return <LocalAccountData key={id} />;
      case 'fence':
        return <FenceTester key={id} />;
      case 'trace':
        return <TraceCapture key={id} />;
      case 'inspector':
        return <DevInspector key={id} />;
      case 'daily-line':
        return userId ? <DailyLineDev key={id} userId={userId} timeZone={timeZone} /> : null;
      case 'mini-guy':
        return <MiniGuyPanel key={id} />;
      case 'intake-status':
        return <IntakeStatus key={id} />;
      case 'next-round':
        return <NextRoundPreview key={id} />;
      case 'tokens-today':
        return <TokensToday key={id} />;
    }
  };

  const go = (href: '/dev-lab' | '/ai-lab') => {
    onClose();
    router.push(href);
  };

  return (
    <View style={styles.wrap}>
      <ThemedText type="code" themeColor="textSecondary">
        {pathname}
      </ThemedText>
      <RunningUpdateLine />
      {own.length > 0 ? (
        own.map(section)
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No tools are tied to this screen. The ones below work anywhere.
        </ThemedText>
      )}

      {everywhere.length > 0 ? (
        <>
          <Pressable
            onPress={() => setShowEverywhere((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showEverywhere }}
            style={({ pressed }) => [styles.header, { borderColor: theme.textSecondary }, pressed && styles.pressed]}>
            <ThemedText type="smallBold">On every screen</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {showEverywhere ? '⌄' : '›'}
            </ThemedText>
          </Pressable>
          {showEverywhere ? everywhere.map(section) : null}
        </>
      ) : null}

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.button, { borderColor: theme.textSecondary }, pressed && styles.pressed]}
          onPress={() => go('/dev-lab')}
          accessibilityRole="button">
          <ThemedText type="smallBold">Full Dev Tools Hub</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.button, { borderColor: theme.textSecondary }, pressed && styles.pressed]}
          onPress={() => go('/ai-lab')}
          accessibilityRole="button">
          <ThemedText type="smallBold">AI lab</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  pressed: { opacity: 0.75 },
});
