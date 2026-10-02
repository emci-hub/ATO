/**
 * Dev Tools Hub.
 *
 * Four groups, in the order they get used (2026-10-01, emci):
 *   1. Where this account is — read-only: inspector, raw traits, AI usage.
 *   2. Jump this account    — one menu of states to jump to, and Start over.
 *   3. Test one thing        — single-purpose probes.
 *   4. Admin                 — root only, enforced on the server.
 * A new tool goes in the group that matches what it does, not the screen it
 * happens to test.
 *
 * RELEASE GATE: groups 1-3 exist only while `DEV_TOOLS_AVAILABLE` (lib/dev-mode)
 * is true. In a release build no PIN, password unlock or grant opens them; root
 * still reaches Admin, and nobody else reaches anything (`hubAccess`).
 *
 * Anything here that writes takes two taps (`useTwoTap`), or a typed handle
 * where it cannot be undone.
 */
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DevInspector } from '@/components/dev-inspector';
import { RunningUpdateLine } from '@/components/running-update-line';
import { TracePipelineViewer } from '@/components/trace-pipeline';
import { YouDevTools } from '@/components/you-dev-tools';
import { DailyLineDev } from '@/components/daily-line-dev';
import { CrisisCard } from '@/components/crisis-card';
import { TraitBandDetail } from '@/components/trait-bands-fold';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { DEV_TOOLS_AVAILABLE, PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { useDevPinUnlocked } from '@/lib/dev-pin';
import {
  clearLocalAccountData,
  listAccountScopedKeys,
} from '@/lib/local-account-data';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { checksToHistory, fetchChecks } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { clearCrisisLocalFlag, noteCrisisText } from '@/lib/crisis/local-flag';
import {
  approveAccessRequest,
  denyAccessRequest,
  listPendingAccessRequests,
  type AccessRequest,
} from '@/lib/access-requests';
import {
  GRANTABLE_CAPABILITIES,
  GRANTABLE_DESCRIPTIONS,
  NEVER_GRANTABLE,
  ROOT_ONLY_DESCRIPTIONS,
  canSeeHubSection,
  hubAccess,
  type HubAccess,
} from '@/lib/dev-access';
import {
  deleteProfile,
  listDevAccessGrants,
  pauseProfile,
  saveDevAccessGrants,
  searchMeAccounts,
  unpauseProfile,
  type MeSearchRow,
} from '@/lib/dev-access-server';
import {
  DEV_LAB_AXIS_ORDER,
  DEV_LAB_GAPS,
  buildSimHistory,
  demoTraitState,
} from '@/lib/dev-lab';
import {
  fetchDevTraceSession,
  listOwnDevTraceEvents,
  startDevTrace,
  stopDevTrace,
} from '@/lib/dev-trace-server';
import { TRACE_SECTIONS, type DevTraceEvent, type DevTraceSession } from '@/lib/dev-trace';
import { generateExploreBody } from '@/lib/explore/generate';
import { EXPLORE_OBSERVATIONS_META } from '@/lib/ai/call-sites';
import { routeExplore } from '@/lib/explore/route';
import { withTimeout } from '@/lib/timeout';
import { fetchExploreMissNotes } from '@/lib/explore/store';
import type { RouteExploreResult } from '@/lib/explore/types';
import { voiceMeFrom } from '@/lib/intake';
import { supabase } from '@/lib/supabase';
import { isDirectTraitSource, traitStateFromRow, type TraitSource } from '@/lib/traits';
import { filledTraitBands } from '@/lib/trait-bands';
import { controlBorderColor } from '@/lib/theme/chrome';
import { shouldUseLocalAi } from '@/lib/ai/override';
import { matchingFrameworkTerms } from '@/lib/voice/framework-fence';
import { type SageUsageSnapshot } from '@/lib/voice/quota';
import { claimAiCall, fetchSageUsage, logJargonGuard, logPhraseGuard } from '@/lib/voice/quota-server';
import {
  DEV_INTAKE_STAGES,
  devStageMatching,
  type DevIntakeStageId,
} from '@/lib/dev-intake-stages';
import {
  DEV_TEST_HANDLE,
  DEV_TEST_USER_ID,
  applyDevIntakeStagePreset,
  resetDevTestUserToFreshSignup,
  startOverMyTestData,
} from '@/lib/dev-test-user';
import { bankTotalProgress } from '@/lib/questions/local';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { settledAxisLabel, type TraitTrack } from '@/lib/trait-stability';

const SOURCE_NOTE: Record<TraitSource, string> = {
  self_slider: 'direct — inferred cannot overwrite (historical, no longer written)',
  self_tap: 'direct — tap-form',
  self_confirm: 'direct — Does Sage know you? confirm',
  self_settings: 'direct — Settings edit',
  self_scenario: 'direct — optional-intake 2-axis scenario tap',
  self_grid: 'inferred — 16-grid (historical, no longer written)',
  self_situation: 'inferred — a situation you picked (close-pattern / intake-sweep / questions)',
  self_game: 'inferred — scenario swipe',
};

export default function DevLabScreen() {
  const { devAccess, devAccessLoading } = useMeContext();
  const devUnlocked = useDevAccessUnlocked();
  const pinUnlocked = useDevPinUnlocked();
  if (devAccessLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }
  // ENTRY (2026-10-01, emci): the Hub opens once the dev PIN is entered — the box at
  // the bottom of You, the same PIN and lock as Divecore (lib/dev-pin.ts). Root and
  // granted testers still walk in. The pre-launch flag alone no longer opens it.
  // In a RELEASE build none of that applies: `hubAccess` answers 'admin' for root
  // and 'none' for everyone else, whatever they have unlocked.
  const access = hubAccess({
    toolsAvailable: DEV_TOOLS_AVAILABLE,
    isDev: __DEV__ || devUnlocked || pinUnlocked,
    isRoot: devAccess.isRoot,
    capabilities: devAccess.capabilities,
  });
  if (access === 'none') {
    return <Redirect href="/" />;
  }
  return <DevLab access={access} />;
}

function DevLab({ access }: { access: Exclude<HubAccess, 'none'> }) {
  const { devAccess, me } = useMeContext();
  const devUnlocked = useDevAccessUnlocked();
  const gate = useMemo(
    () => ({
      isDev: PRE_LAUNCH_DEV || devUnlocked,
      isRoot: devAccess.isRoot,
      capabilities: devAccess.capabilities,
    }),
    [devUnlocked, devAccess.isRoot, devAccess.capabilities],
  );
  // 'admin' is a release build: the three testing groups are not rendered at all.
  const tools = access === 'full';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle">Dev Tools Hub</ThemedText>
            <ThemedText themeColor="textSecondary">
              {tools
                ? 'Opens with the dev PIN on You (this session only), or for root and granted testers. Anything that writes takes two taps.'
                : 'Release build: only the root-only Admin tools exist here.'}
            </ThemedText>
            <RunningUpdateLine />
          </View>

          {tools ? (
            <>
              <View style={styles.section}>
                <ThemedText type="smallBold">Where this account is</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Read-only. Nothing in this group changes anything.
                </ThemedText>
                <DevInspector />
                {canSeeHubSection('traits', gate) ? <TraitViewer /> : null}
                {canSeeHubSection('quota', gate) ? <QuotaDashboard /> : null}
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">Jump this account</ThemedText>
                <JumpThisAccount />
                <StartOver />
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">Test one thing</ThemedText>
                <ExploreRegen />
                <BandDetailStepper />
                {canSeeHubSection('fence', gate) ? <FenceTester /> : null}
                {canSeeHubSection('trace', gate) ? <TraceCapture /> : null}
                {me ? <YouDevTools timeZone={me.timezone || 'UTC'} /> : null}
                {me ? <DailyLineDev userId={me.id} timeZone={me.timezone || 'UTC'} /> : null}
                <CrisisCardPreview />
                <CrisisLocalFlagTest />
                <ResetAiConsent />
                <LocalAccountData />
                <ForceTestError message="Dev Lab test error" />
              </View>
            </>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="smallBold">Admin</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Root only, enforced on the server. These act on other people&apos;s accounts.
            </ThemedText>
            {canSeeHubSection('access', gate) ? <AccessReview /> : null}
            {canSeeHubSection('grants', gate) ? <GrantsPanel /> : null}
            {canSeeHubSection('profiles', gate) ? <ProfilesPanel /> : null}
            {tools ? <ResetToFreshSignup /> : null}
            {!devAccess.isRoot ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nothing here for this account.
              </ThemedText>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Two taps before a write. `confirm(id)` answers false on the first tap (and
 * arms that id for 5 seconds) and true on the second. It disarms by itself, so
 * a stale first tap never turns a later single tap into a write.
 */
function useTwoTap(): { armed: string | null; confirm: (id: string) => boolean } {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const confirm = useCallback(
    (id: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (armed === id) {
        setArmed(null);
        return true;
      }
      setArmed(id);
      timer.current = setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), 5000);
      return false;
    },
    [armed],
  );
  return { armed, confirm };
}

function ForceTestError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        throw new Error(message);
      }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: controlBorderColor(theme) },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold">Force test error</ThemedText>
    </Pressable>
  );
}

function ExploreRegen() {
  const theme = useTheme();
  const { session } = useSession();
  const { me } = useMeContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteExploreResult | null>(null);

  async function run() {
    if (!me || !session?.user.id || busy) return;
    setBusy(true);
    setError(null);
    try {
      const flags = await crisisFlagsForWindow(session.user.id, me.timezone);
      const history = checksToHistory(await fetchChecks(session.user.id));
      const next = await withTimeout(routeExplore(
        {
          me: {
            ...voiceMeFrom(me),
            timezone: me.timezone,
            traitTouchedAt: me.trait_touched_at,
          },
          history,
          aiConsent: me.ai_consent,
          crisisToday: flags.crisisToday,
        },
        {
          loadMissNotes: fetchExploreMissNotes,
          claimAiCall: () => claimAiCall('explore'),
          logJargonHit: logJargonGuard,
          logPhraseHit: logPhraseGuard,
          generateBody: (prompt) => generateExploreBody(prompt, EXPLORE_OBSERVATIONS_META),
          useLocal: await shouldUseLocalAi(),
        },
      ), 25_000, 'explore');
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate Explore.');
    } finally {
      setBusy(false);
    }
  }

  const entries = result?.pack?.entries ?? [];

  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary">
        Regenerates Explore without waiting for the weekly cycle. Axes are the
        tagged traits on each observation. Nothing is written to ME.
      </ThemedText>
      <Pressable
        disabled={busy || !me}
        onPress={() => void run()}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: controlBorderColor(theme) },
          pressed && styles.pressed,
          (busy || !me) && { opacity: 0.5 },
        ]}>
        <ThemedText type="smallBold">Force regenerate Explore</ThemedText>
      </Pressable>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {result ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="code" themeColor="textSecondary">
            kind {result.kind}
            {result.trigger ? ` · ${result.trigger}` : ''}
          </ThemedText>
          {entries.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No entries.
            </ThemedText>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.axisRow}>
                <ThemedText>{entry.body}</ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  axis {entry.traits.length > 0 ? entry.traits.join(', ') : '(none)'}
                  {entry.chips.length > 0 ? ` · chips ${entry.chips.join(', ')}` : ''}
                  {entry.signalKind ? ` · signal ${entry.signalKind}` : ''}
                </ThemedText>
              </View>
            ))
          )}
        </ThemedView>
      ) : null}
    </View>
  );
}

function TraitViewer() {
  const theme = useTheme();
  const { session } = useSession();
  const { me } = useMeContext();
  const [handles, setHandles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('demo');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('me')
      .select('handle')
      .order('handle')
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          return;
        }
        const next = (data ?? [])
          .map((row) => String(row.handle ?? ''))
          .filter((handle) => handle.length > 0);
        setHandles(next);
        if (me?.handle) setSelected(me.handle);
      });
    return () => {
      cancelled = true;
    };
  }, [me?.handle]);

  const live = useMemo(() => {
    if (selected === 'demo' || !me || me.handle !== selected) return null;
    return traitStateFromRow(me);
  }, [me, selected]);

  const demo = demoTraitState();
  const state = live ?? demo;
  const usingDemo = live == null;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Trait backbone</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        RLS only returns the signed-in ME row. Sign in as a test account to inspect it. Demo
        shows slider-sticky merge: O/C/steadiness stay slider even if a grid also wrote O/C/E/A.
      </ThemedText>
      <View style={styles.tabs}>
        <Chip label="demo" selected={selected === 'demo'} onPress={() => setSelected('demo')} />
        {handles.map((handle) => (
          <Chip
            key={handle}
            label={`@${handle}`}
            selected={selected === handle}
            onPress={() => setSelected(handle)}
          />
        ))}
      </View>
      {!session ? (
        <ThemedText type="small" themeColor="textSecondary">
          Signed out — showing the demo row.
        </ThemedText>
      ) : null}
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {usingDemo ? (
        <ThemedView
          type="backgroundElement"
          style={[
            styles.fixtureBanner,
            { borderColor: theme.accentFill, backgroundColor: theme.backgroundSelected },
          ]}>
          <ThemedText type="smallBold">FIXTURE — not a real account</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {selected !== 'demo' && selected !== me?.handle
              ? `RLS only returns the signed-in row. This is hardcoded demo data, not @${selected}.`
              : 'Hardcoded slider-sticky example. Not live ME.'}
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedText type="code" themeColor="textSecondary">
          @{selected}
        </ThemedText>
      )}
      <View style={usingDemo ? [styles.fixtureList, { borderColor: theme.accentFill }] : undefined}>
        {DEV_LAB_AXIS_ORDER.map((axis) => {
          const value = state.values[axis];
          const source = state.sources[axis];
          return (
            <ThemedView key={axis} type="backgroundElement" style={styles.axisRow}>
              <View style={styles.axisHead}>
                <ThemedText type="smallBold">{axis}</ThemedText>
                <ThemedText type="code">{value == null ? 'null' : value.toFixed(2)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {usingDemo
                  ? `fixture · ${source ? `${source} — ${SOURCE_NOTE[source]}` : 'no write'}`
                  : source
                    ? `${source} — ${SOURCE_NOTE[source]}`
                    : 'no write — skipped or never set'}
              </ThemedText>
              {isDirectTraitSource(source) ? (
                <View style={[styles.sourceMark, { backgroundColor: theme.accentFill }]}>
                  <ThemedText type="code" style={{ color: theme.onAccent }}>
                    {usingDemo ? 'fixture · direct sticky' : 'direct sticky'}
                  </ThemedText>
                </View>
              ) : null}
            </ThemedView>
          );
        })}
      </View>
    </View>
  );
}

function BandDetailStepper() {
  const { me } = useMeContext();
  const bands = me ? filledTraitBands(me) : [];
  const [index, setIndex] = useState(0);
  const safeIndex = bands.length === 0 ? 0 : Math.min(index, bands.length - 1);
  const band = bands[safeIndex] ?? null;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Band detail</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Steps through filled bands on this account and opens the same detail as You.
        Read-only. Does not write trait values.
      </ThemedText>
      {band ? (
        <>
          <ThemedText type="code" themeColor="textSecondary">
            {safeIndex + 1} of {bands.length}
          </ThemedText>
          <View style={styles.tabs}>
            <Chip
              label="previous"
              selected={false}
              onPress={() => setIndex(Math.max(0, safeIndex - 1))}
            />
            <Chip
              label="next"
              selected={false}
              onPress={() => setIndex(Math.min(bands.length - 1, safeIndex + 1))}
            />
          </View>
          <ThemedView type="backgroundElement" style={styles.card}>
            <TraitBandDetail band={band} />
          </ThemedView>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No filled bands on this account.
        </ThemedText>
      )}
    </View>
  );
}

/**
 * "Jump this account": one menu of states, pick ONE. Each is a one-shot write,
 * not a status — the only status is the "You are here" line, and the stage the
 * account currently matches is highlighted.
 *
 * Every jump takes two taps on every account (it overwrites trait scores and
 * answer counts). `applyDevIntakeStagePreset` clears the device's answer stamps
 * and bumps the account-data epoch, which is what reloads this panel's tracks
 * and the mounted tabs.
 */
function JumpThisAccount() {
  const { me, refresh, devAccess } = useMeContext();
  const epoch = useAccountDataEpoch();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [busy, setBusy] = useState<DevIntakeStageId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const twoTap = useTwoTap();
  const meId = me?.id;

  useEffect(() => {
    if (!meId) return;
    let active = true;
    fetchTraitTracks(meId)
      .then((rows) => {
        if (active) setTracks(rows);
      })
      .catch(() => {
        if (active) setTracks([]);
      });
    return () => {
      active = false;
    };
  }, [meId, epoch]);

  if (!PRE_LAUNCH_DEV || !me) return null;

  const progress = bankTotalProgress(tracks);
  const here = devStageMatching(tracks);

  async function jump(stage: DevIntakeStageId) {
    if (busy) return;
    if (!twoTap.confirm(stage)) return;
    setBusy(stage);
    setError(null);
    try {
      await applyDevIntakeStagePreset(stage, { topUpHistory: devAccess.isRoot });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not jump to that stage.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Pick ONE to jump this account to</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Each tap replaces the last. It overwrites the trait scores and answer counts on
        {me.handle ? ` @${me.handle}` : ' this account'} with preset ones (not yours), so every
        jump takes a second tap. Saved rounds, tokens and written text stay as they are —
        Start over clears those. On a root account a jump also fills in answer history, so
        the first +21 can be tested.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        You are here: {progress.answered} of {progress.total} answered · {settledAxisLabel(tracks)}
      </ThemedText>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {DEV_INTAKE_STAGES.map((stage) => (
        <View key={stage.stage}>
          <Chip
            label={
              busy === stage.stage
                ? 'jumping…'
                : twoTap.armed === stage.stage
                  ? `Tap again to jump — ${stage.label}`
                  : here === stage.stage
                    ? `${stage.label} · you are here`
                    : stage.label
            }
            selected={here === stage.stage}
            onPress={() => void jump(stage.stage)}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {stage.hint}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/**
 * "Start over": the ONE reset in the Hub. It replaced a trait-only zero jump
 * and a full clear that also zeroed tokens. The server does it
 * (`start_over_my_test_data`,
 * wave76): root only, own account only, invite-only phase. Keeps the account
 * and the token balance. Always two taps; it cannot be undone.
 */
function StartOver() {
  const { me, refresh, devAccess } = useMeContext();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const twoTap = useTwoTap();

  if (!PRE_LAUNCH_DEV || !me) return null;

  async function startOver() {
    if (busy) return;
    if (!twoTap.confirm('start-over')) return;
    setBusy(true);
    setNote(null);
    try {
      await startOverMyTestData();
      await refresh();
      setNote('Done. This account is at 0 of 50. Your token balance is unchanged.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not start this account over.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Start over</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Root only. Clears this account&apos;s answers, trait scores, saved rounds, answer
        history, insight, category reads and story, and the record of the first +21 so it can
        be earned again. Keeps your profile and your token balance. Cannot be undone.
      </ThemedText>
      {devAccess.isRoot ? (
        <Chip
          label={
            busy
              ? 'clearing…'
              : twoTap.armed === 'start-over'
                ? 'Tap again to clear this account’s answers'
                : 'Start over (0 of 50)'
          }
          selected={false}
          onPress={() => void startOver()}
        />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          This account is not root, so Start over is not available on it.
        </ThemedText>
      )}
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
    </View>
  );
}

/**
 * Reset the dev-test account all the way back to before onboarding (wave66
 * reset_dev_test_user RPC) — unlike "Start over", this actually deletes the me
 * row, so the real "Introduce yourself" screen renders again. It is the only
 * way to re-test that form, which is why Start over did not replace it. Same two guards as every other dev-test-user action;
 * requires typing the handle to confirm since it's destructive to this
 * account's data (auth.users/the session are untouched either way).
 */
function ResetToFreshSignup() {
  const theme = useTheme();
  const { me, refresh } = useMeContext();
  const isDevUser = !!me && me.id === DEV_TEST_USER_ID;
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!PRE_LAUNCH_DEV || !isDevUser) return null;

  async function reset() {
    if (busy || confirm !== DEV_TEST_HANDLE) return;
    setBusy(true);
    setError(null);
    try {
      await resetDevTestUserToFreshSignup();
      setConfirm('');
      setDone(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset this account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Re-run the sign-up form (@{DEV_TEST_HANDLE} only)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Deletes the @{DEV_TEST_HANDLE} me row (traits, history, checks,
        questions, tokens — everything scoped to this account) but keeps the
        Supabase auth user and this session signed in, so the app routes
        straight into the real &quot;Introduce yourself&quot; onboarding
        screen. Irreversible for this account&apos;s data. Type{' '}
        {DEV_TEST_HANDLE} to confirm.
      </ThemedText>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {done ? (
        <ThemedText type="small" themeColor="textSecondary">
          Done — this account has no profile now.
        </ThemedText>
      ) : null}
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder={DEV_TEST_HANDLE}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          styles.searchInput,
          { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
        ]}
      />
      <Pressable
        disabled={busy || confirm !== DEV_TEST_HANDLE}
        onPress={() => void reset()}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: controlBorderColor(theme) },
          (busy || confirm !== DEV_TEST_HANDLE) && { opacity: 0.4 },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="small">{busy ? 'resetting…' : 'Delete this profile and re-run sign-up'}</ThemedText>
      </Pressable>
    </View>
  );
}

function ResetAiConsent() {
  const { me, refresh } = useMeContext();
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const twoTap = useTwoTap();
  const stored =
    me?.ai_consent === true ? 'true' : me?.ai_consent === false ? 'false' : 'null';

  async function reset() {
    const userId = session?.user.id;
    if (!userId || busy) return;
    if (!twoTap.confirm('consent')) return;
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('me')
        .update({ ai_consent: null })
        .eq('id', userId);
      if (updateError) throw updateError;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset ai_consent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Reset AI consent</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Sets ai_consent to null on this account so the interstitial asks again.
        Does not write a real consent choice and does not need a fresh account.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        stored: {stored}
      </ThemedText>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      <Chip
        label={busy ? 'resetting…' : twoTap.armed === 'consent' ? 'Tap again to reset AI consent' : 'reset to null'}
        selected={false}
        onPress={() => void reset()}
      />
    </View>
  );
}

/**
 * What this account has written to THIS DEVICE, and a button to erase it.
 *
 * The manual-verification hook for the 2026-09-15 cross-account bug: deleting
 * an account cleared the auth session and nothing else, so a new signup on the
 * same device read the previous account's keys back. The fix runs inside
 * `clearLocalSession` and on sign-out, where nothing is observable — so this
 * panel is the only way to SEE whether the device is actually clean, before a
 * delete and after the next signup, without another blind investigation.
 *
 * Deliberately lists keys, never values: the point is which state survives, and
 * some of these hold generated personal content.
 */
function LocalAccountData() {
  const [keys, setKeys] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const twoTap = useTwoTap();

  const load = useCallback(async () => {
    setKeys(await listAccountScopedKeys());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function wipe() {
    if (busy) return;
    if (!twoTap.confirm('wipe')) return;
    setBusy(true);
    setNote(null);
    try {
      const removed = await clearLocalAccountData();
      setNote(
        removed.length === 0
          ? 'Nothing to remove — device was already clean.'
          : `Removed ${removed.length} key${removed.length === 1 ? '' : 's'}.`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Local account data</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Every `ato.*` key on this device that belongs to the ACCOUNT rather than
        the phone. These are what a deleted-then-recreated account used to
        inherit. Device preferences (theme, crisis region, push prefs, auth) are
        excluded by design and are not listed here. Wiping touches this device
        only — it deletes nothing on the server.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {keys === null
          ? 'reading…'
          : keys.length === 0
            ? '(none — clean)'
            : keys.join('\n')}
      </ThemedText>
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
      <Chip label="refresh" selected={false} onPress={() => void load()} />
      <Chip
        label={busy ? 'wiping…' : twoTap.armed === 'wipe' ? 'Tap again to wipe this device’s account data' : 'wipe local account data'}
        selected={false}
        onPress={() => void wipe()}
      />
    </View>
  );
}

/** Dev test for the on-device crisis signal: flag today / clear, then open Home. */
function CrisisLocalFlagTest() {
  const [note, setNote] = useState<string | null>(null);
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Crisis card on Home (local signal)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Runs a test phrase through the same keyword check typed text goes through, and marks
        today on this phone only. Open Home to see the static card. Clear to remove it.
      </ThemedText>
      <Chip
        label="Flag today (test phrase)"
        selected={false}
        onPress={() => {
          void noteCrisisText('I want to kill myself').then((hit) =>
            setNote(hit ? 'Flagged for today. Open Home.' : 'The keyword check did not match.'),
          );
        }}
      />
      <Chip
        label="Clear the local flag"
        selected={false}
        onPress={() => {
          void clearCrisisLocalFlag().then(() => setNote('Cleared. Reopen Home.'));
        }}
      />
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
    </View>
  );
}

function CrisisCardPreview() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Preview crisis card</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Renders CrisisCard inline. Does not run detection and does not write a flag.
      </ThemedText>
      <Chip
        label="Preview crisis card."
        selected={open}
        onPress={() => setOpen(true)}
      />
      {open ? <CrisisCard onDismiss={() => setOpen(false)} /> : null}
    </View>
  );
}

function QuotaDashboard() {
  const theme = useTheme();
  const { session } = useSession();
  const { me } = useMeContext();
  const [snap, setSnap] = useState<SageUsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (session?.user.id) {
          const next = await fetchSageUsage();
          if (!cancelled) setSnap(next);
          return;
        }
        const { data, error: configError } = await supabase
          .from('app_config')
          .select('ai_daily_cap, ai_monthly_cap')
          .eq('id', 1)
          .single();
        if (configError) throw configError;
        if (!cancelled) {
          setSnap({
            daily: 0,
            dailyCap: Number(data?.ai_daily_cap) || 20,
            monthly: 0,
            monthlyCap: Number(data?.ai_monthly_cap) || 200,
            byType: {},
            questionsDaily: 0,
            questionsCap: 3,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not read usage.');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const dailyLeft = snap ? Math.max(0, snap.dailyCap - snap.daily) : 0;
  const monthlyLeft = snap ? Math.max(0, snap.monthlyCap - snap.monthly) : 0;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Quota / usage</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Real ai_usage for the signed-in account. Caps from app_config (20/day, 200/month). Other
        handles are not readable through this client.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {me?.handle ? `@${me.handle}` : 'signed out · caps only'}
      </ThemedText>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {snap ? (
        <>
          <UsageMeter
            label="today"
            used={snap.daily}
            cap={snap.dailyCap}
            remaining={dailyLeft}
            fill={theme.accentFill}
          />
          <UsageMeter
            label="this month"
            used={snap.monthly}
            cap={snap.monthlyCap}
            remaining={monthlyLeft}
            fill={theme.accentFill}
          />
          <UsageMeter
            label="questions today"
            used={snap.questionsDaily}
            cap={snap.questionsCap}
            remaining={Math.max(0, snap.questionsCap - snap.questionsDaily)}
            fill={theme.accentTertiary ?? theme.accentFill}
          />
          {snap.byType.sage != null || snap.byType.explore != null ? (
            <ThemedText type="small" themeColor="textSecondary">
              Surfaces today: Sage {snap.byType.sage ?? 0}, Explore {snap.byType.explore ?? 0},
              questions {snap.questionsDaily}
            </ThemedText>
          ) : null}
        </>
      ) : (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      )}
    </View>
  );
}

function FenceTester() {
  const theme = useTheme();
  const [text, setText] = useState('Your INFJ side is showing.');
  const hits = matchingFrameworkTerms(text);

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Framework-echo fence</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Paste any generated text (an insight, a category read, a question). Same matcher the
        generators use.
      </ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Paste generated text…"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
        ]}
      />
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">{hits.length > 0 ? 'Would block' : 'Would allow'}</ThemedText>
        {hits.length > 0 ? (
          <ThemedText type="small">
            matched: {hits.join(', ')}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No banned term. filterCard can still drop this for other reasons (vague-do, repeat).
          </ThemedText>
        )}
      </ThemedView>
    </View>
  );
}

function TraceCapture() {
  const theme = useTheme();
  const [session, setSession] = useState<DevTraceSession | null>(null);
  const [events, setEvents] = useState<DevTraceEvent[]>([]);
  const [sectionId, setSectionId] = useState<string>(TRACE_SECTIONS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [nextSession, nextEvents] = await Promise.all([
        fetchDevTraceSession(),
        listOwnDevTraceEvents(),
      ]);
      setSession(nextSession);
      setEvents(nextEvents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load traces.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (session?.active) await stopDevTrace();
      else await startDevTrace();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not toggle capture.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Trace / debug</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Capture your own next Dawn and Explore generations as an ordered
        pipeline — context, model, guards, output. 30 minutes or 20
        interactions, then off. Rows delete after 7 days. Never another account.
      </ThemedText>
      <Pressable
        disabled={busy}
        onPress={() => void toggle()}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: controlBorderColor(theme) },
          session?.active && { backgroundColor: theme.accentFill },
          pressed && styles.pressed,
        ]}>
        <ThemedText
          type="small"
          style={session?.active ? { color: theme.onAccent } : undefined}
          themeColor={session?.active ? undefined : 'text'}>
          {busy ? '…' : session?.active ? 'Capture on — tap to stop' : 'Capture my next interactions'}
        </ThemedText>
      </Pressable>
      {session?.active ? (
        <ThemedText type="code" themeColor="textSecondary">
          {session.remaining} left · until {session.expiresAt ?? '—'}
        </ThemedText>
      ) : null}
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      <TracePipelineViewer
        events={events}
        selectedId={sectionId}
        onSelect={setSectionId}
        // Talk is a placeholder screen, so there is nothing to capture from it.
        sections={TRACE_SECTIONS.filter((row) => row.id !== 'talk')}
      />
    </View>
  );
}

function GrantsPanel() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<MeSearchRow[]>([]);
  const [selected, setSelected] = useState<MeSearchRow | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const twoTap = useTwoTap();

  async function lookup() {
    setBusy(true);
    setNote(null);
    try {
      const next = await searchMeAccounts(query);
      setHits(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
      setHits([]);
    } finally {
      setBusy(false);
    }
  }

  async function pick(row: MeSearchRow) {
    setSelected(row);
    setNote(null);
    try {
      const grants = await listDevAccessGrants(row.handle);
      const next: Record<string, boolean> = {};
      for (const cap of GRANTABLE_CAPABILITIES) next[cap] = grants.some((g) => g.capability === cap);
      setChecked(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load grants.');
    }
  }

  const grantsKey = selected
    ? `grants:${selected.handle}:${GRANTABLE_CAPABILITIES.filter((cap) => checked[cap]).join(',')}`
    : '';

  async function save() {
    if (!selected || busy) return;
    // Keyed on the chosen set too: changing a box between the taps re-arms.
    if (!twoTap.confirm(grantsKey)) return;
    setBusy(true);
    try {
      const caps = GRANTABLE_CAPABILITIES.filter((cap) => checked[cap]);
      await saveDevAccessGrants(selected.handle, caps);
      setNote(`Saved @${selected.handle}`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Grant capabilities</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Root only. Tester must already have a ME row. Pause, delete, and access
        review cannot be granted — those stay on this account.
      </ThemedText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search handle…"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          styles.searchInput,
          { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
        ]}
      />
      <Pressable
        disabled={busy}
        onPress={() => void lookup()}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: controlBorderColor(theme), backgroundColor: theme.accentFill },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="small" style={{ color: theme.onAccent }}>
          {busy ? '…' : 'Look up'}
        </ThemedText>
      </Pressable>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
      <View style={styles.tabs}>
        {hits.map((row) => (
          <Chip
            key={row.id}
            label={`@${row.handle}`}
            selected={selected?.id === row.id}
            onPress={() => void pick(row)}
          />
        ))}
      </View>
      {selected ? (
        <>
          {GRANTABLE_CAPABILITIES.map((cap) => (
            <Pressable
              key={cap}
              onPress={() => setChecked((prev) => ({ ...prev, [cap]: !prev[cap] }))}
              style={({ pressed }) => [styles.axisRow, { borderWidth: 1, borderColor: controlBorderColor(theme) }, pressed && styles.pressed]}>
              <ThemedText type="smallBold">
                {checked[cap] ? '☑' : '☐'} {cap}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {GRANTABLE_DESCRIPTIONS[cap]}
              </ThemedText>
            </Pressable>
          ))}
          {NEVER_GRANTABLE.map((action) => (
            <ThemedView key={action} type="backgroundElement" style={styles.axisRow}>
              <ThemedText type="smallBold">{action} — root only</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {ROOT_ONLY_DESCRIPTIONS[action]} Never grantable.
              </ThemedText>
            </ThemedView>
          ))}
          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: controlBorderColor(theme), backgroundColor: theme.accentFill },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="small" style={{ color: theme.onAccent }}>
              {selected && twoTap.armed === grantsKey
                ? `Tap again to save grants for @${selected.handle}`
                : 'Save grants'}
            </ThemedText>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function ProfilesPanel() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<MeSearchRow[]>([]);
  const [selected, setSelected] = useState<MeSearchRow | null>(null);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const twoTap = useTwoTap();

  async function lookup() {
    setBusy(true);
    setNote(null);
    try {
      const next = await searchMeAccounts(query);
      setHits(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
      setHits([]);
    } finally {
      setBusy(false);
    }
  }

  async function refreshSelected(handle: string) {
    const next = await searchMeAccounts(handle);
    const match = next.find((row) => row.handle === handle) ?? null;
    setSelected(match);
    setHits(next);
  }

  async function pause() {
    if (!selected || busy) return;
    // One tap used to pause another person and everyone they referred.
    if (!twoTap.confirm(`pause:${selected.handle}`)) return;
    setBusy(true);
    try {
      await pauseProfile(selected.handle);
      setNote(`Paused @${selected.handle} (and referral descendants).`);
      await refreshSelected(selected.handle);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pause failed.');
    } finally {
      setBusy(false);
    }
  }

  async function unpause() {
    if (!selected || busy) return;
    if (!twoTap.confirm(`unpause:${selected.handle}`)) return;
    setBusy(true);
    try {
      await unpauseProfile(selected.handle);
      setNote(`Unpaused @${selected.handle}.`);
      await refreshSelected(selected.handle);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unpause failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await deleteProfile(selected.handle, confirm);
      setNote(`Deleted @${selected.handle}.`);
      setSelected(null);
      setConfirm('');
      setHits([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Pause / delete</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Root only. Pause first (reversible, same as pause_branch). Delete is a
        separate hard cascade — type the handle to confirm. Not grantable.
      </ThemedText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search handle…"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          styles.searchInput,
          { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
        ]}
      />
      <Pressable
        disabled={busy}
        onPress={() => void lookup()}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: controlBorderColor(theme), backgroundColor: theme.accentFill },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="small" style={{ color: theme.onAccent }}>
          {busy ? '…' : 'Look up'}
        </ThemedText>
      </Pressable>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
      <View style={styles.tabs}>
        {hits.map((row) => (
          <Chip
            key={row.id}
            label={`@${row.handle}${row.paused ? ' · paused' : ''}`}
            selected={selected?.id === row.id}
            onPress={() => {
              setSelected(row);
              setConfirm('');
            }}
          />
        ))}
      </View>
      {selected ? (
        <>
          <ThemedText type="smallBold">
            @{selected.handle} {selected.paused ? '(paused)' : ''}
          </ThemedText>
          <View style={styles.tabs}>
            <Pressable
              disabled={busy}
              onPress={() => void pause()}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: controlBorderColor(theme) },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">
                {twoTap.armed === `pause:${selected.handle}`
                  ? `Tap again to pause @${selected.handle} and their referrals`
                  : 'Pause'}
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void unpause()}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: controlBorderColor(theme) },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">
                {twoTap.armed === `unpause:${selected.handle}` ? `Tap again to unpause @${selected.handle}` : 'Unpause'}
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Type {selected.handle} to confirm hard delete.
          </ThemedText>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              styles.searchInput,
              { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
            ]}
          />
          <Pressable
            disabled={busy || confirm !== selected.handle}
            onPress={() => void remove()}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: controlBorderColor(theme) },
              (busy || confirm !== selected.handle) && { opacity: 0.4 },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="small">Delete</ThemedText>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function AccessReview() {
  const theme = useTheme();
  const { session } = useSession();
  const { me } = useMeContext();
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const twoTap = useTwoTap();

  async function load() {
    try {
      const next = await listPendingAccessRequests();
      setRows(next);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load requests.';
      setError(message === 'not_allowed' ? 'Root only — sign in as emci.' : message);
      setRows([]);
    }
  }

  useEffect(() => {
    if (!session?.user.id) return;
    void load();
  }, [session?.user.id]);

  async function act(id: string, action: 'approve' | 'deny') {
    if (busyId) return;
    // Approve emails a real person a code; deny is silent and final.
    if (!twoTap.confirm(`${action}:${id}`)) return;
    setBusyId(id);
    setNote(null);
    try {
      const result = action === 'approve' ? await approveAccessRequest(id) : await denyAccessRequest(id);
      if (action === 'approve') {
        const mailed = result.emailed ? 'emailed' : result.email_error ?? 'code generated, email did not send';
        setNote(`${result.email} — ${result.invite_code ?? 'no code'} · ${mailed}`);
      } else {
        setNote(`${result.email} denied — no email sent.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Access requests</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Pending landing-page emails. Approve emails a single-use code owned by root. Deny is silent.
        Root only — not Founder, not a public Admin screen.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {me?.handle ? `@${me.handle}` : 'signed out'}
      </ThemedText>
      {!session ? (
        <ThemedText type="small" themeColor="textSecondary">
          Sign in as emci to review.
        </ThemedText>
      ) : null}
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
      {rows.length === 0 && !error ? (
        <ThemedText type="small" themeColor="textSecondary">
          No pending requests.
        </ThemedText>
      ) : (
        rows.map((row) => (
          <ThemedView key={row.id} type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{row.email}</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">
              {row.requested_at}
            </ThemedText>
            <View style={styles.tabs}>
              <Pressable
                disabled={busyId != null}
                onPress={() => void act(row.id, 'approve')}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: controlBorderColor(theme), backgroundColor: theme.accentFill },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="small" style={{ color: theme.onAccent }}>
                  {busyId === row.id ? '…' : twoTap.armed === `approve:${row.id}` ? 'Tap again to approve and email' : 'Approve'}
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={busyId != null}
                onPress={() => void act(row.id, 'deny')}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {twoTap.armed === `deny:${row.id}` ? 'Tap again to deny' : 'Deny'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        ))
      )}
    </View>
  );
}

function UsageMeter({
  label,
  used,
  cap,
  remaining,
  fill,
}: {
  label: string;
  used: number;
  cap: number;
  remaining: number;
  fill: string;
}) {
  const pct = cap > 0 ? Math.min(1, used / cap) : 0;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">
        {used} of {cap} · {remaining} left
      </ThemedText>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: fill }]} />
      </View>
    </ThemedView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: controlBorderColor(theme) },
        selected && { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
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
  scrollContent: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.half,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  chip: {
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  axisRow: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  fixtureBanner: {
    borderRadius: Spacing.three,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  fixtureList: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  axisHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceMark: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  input: {
    minHeight: 120,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  searchInput: {
    minHeight: 44,
    textAlignVertical: 'center',
  },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(128,128,128,0.25)',
    overflow: 'hidden',
  },
  meterFill: {
    height: 8,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.8,
  },
});

/* The floating dev button (components/app-dev-fab.tsx) shows these same sections
 * on the screen they test. Exported in one place so the declarations above keep
 * their plain `function Name()` form (several check scripts slice on it). */
export {
  ExploreRegen,
  TraitViewer,
  BandDetailStepper,
  JumpThisAccount,
  StartOver,
  ResetAiConsent,
  LocalAccountData,
  QuotaDashboard,
  FenceTester,
  TraceCapture,
};
