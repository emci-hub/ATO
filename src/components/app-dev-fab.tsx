/**
 * The app's floating dev button (outside Play) — the same draggable DEV bubble
 * Play uses, mounted once in the root layout. Tap it and the Dev Tools Hub
 * sections for the screen you are on open ON TOP of that screen: Home gets the
 * slot / ask overrides, Explore the trait viewer, Questions the intake presets,
 * You the growth preview and account tools, Sage the quota / fence / trace.
 * Quota, trace and the fence are one tap away on every screen, and the full
 * Hub (root-only tools included) stays a button at the bottom.
 *
 * The sections ARE the Hub's own components (`app/dev-lab`), not copies, and
 * the per-capability gates are the Hub's (`canSeeHubSection`). Who sees the
 * button at all: `appDevFabVisible` — root, a granted capability, a dev build or
 * the session unlock (NOT every invited tester), and never on /play.
 */
import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  BandDetailStepper,
  ExploreRegen,
  FenceTester,
  GrowthPreview,
  HandleCollisionCheck,
  HomeOverrides,
  IntakeStagePresets,
  LocalAccountData,
  QuotaDashboard,
  ResetAiConsent,
  ResetToFreshSignup,
  TraceCapture,
  TraitViewer,
} from '@/app/dev-lab';
import { DevInspector } from '@/components/dev-inspector';
import { PlayDevFab } from '@/components/play-dev-fab';
import { RunningUpdateLine } from '@/components/running-update-line';
import { ThemedText } from '@/components/themed-text';
import { YouDevTools } from '@/components/you-dev-tools';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { canSeeDevLab, canSeeHubSection, type DevCapability } from '@/lib/dev-access';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import {
  appDevEverywhere,
  appDevFabVisible,
  appDevScreen,
  type AppDevSection,
} from '@/lib/dev-fab-model';
import { useMeContext } from '@/lib/me-context';

/** The Hub capability a section needs (none = anyone who can open the Hub). */
const SECTION_CAPABILITY: Partial<Record<AppDevSection, DevCapability>> = {
  'home-overrides': 'card',
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
  const [open, setOpen] = useState(false);
  const gate = useMemo(
    () => ({
      // Same as Home's Hub row: the pre-launch flag alone does NOT open it, so an invited
      // tester never sees the bubble. Root, a granted capability, a dev build, or
      // the session unlock does.
      isDev: __DEV__ || devUnlocked,
      isRoot: devAccess.isRoot,
      capabilities: devAccess.capabilities,
    }),
    [devUnlocked, devAccess.isRoot, devAccess.capabilities],
  );
  const visible = appDevFabVisible({
    isAuthed: !!session,
    hasMe: !!me,
    devAccessLoading,
    canSeeHub: canSeeDevLab(gate),
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
  onClose,
}: {
  pathname: string;
  own: readonly AppDevSection[];
  everywhere: readonly AppDevSection[];
  timeZone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const [showEverywhere, setShowEverywhere] = useState(own.length === 0);

  const section = (id: AppDevSection): ReactNode => {
    switch (id) {
      case 'home-overrides':
        return <HomeOverrides key={id} />;
      case 'quota':
        return <QuotaDashboard key={id} />;
      case 'explore-regen':
        return <ExploreRegen key={id} />;
      case 'traits':
        return <TraitViewer key={id} />;
      case 'band-stepper':
        return <BandDetailStepper key={id} />;
      case 'intake-presets':
        return <IntakeStagePresets key={id} />;
      case 'fresh-signup':
        return <ResetToFreshSignup key={id} />;
      case 'handle-check':
        return <HandleCollisionCheck key={id} />;
      case 'growth':
        return <GrowthPreview key={id} />;
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
