/**
 * Dev Tools Hub.
 *
 * New dev/test tools for a given screen go in that screen's section
 * (Home, Sage, You, System), not in a shared catch-all.
 */
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RunningUpdateLine } from '@/components/running-update-line';
import { TracePipelineViewer } from '@/components/trace-pipeline';
import { YouDevTools } from '@/components/you-dev-tools';
import { CrisisCard } from '@/components/crisis-card';
import { isRevealOpenedToday } from '@/components/reveal-card';
import { TraitBandDetail } from '@/components/trait-bands-fold';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { useSession } from '@/hooks/use-session';
import { useGrowth } from '@/hooks/use-growth';
import { useTheme } from '@/hooks/use-theme';
import { checkWindowFor, offsetLabel } from '@/lib/check-window';
import { checksToHistory, fetchChecks } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
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
  canSeeDevLab,
  canSeeHubSection,
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
  DEV_LAB_PATTERNS,
  DEV_LAB_STREAKS,
  buildSimHistory,
  demoTraitState,
  simulateGapWindow,
} from '@/lib/dev-lab';
import {
  fetchDevTraceSession,
  listOwnDevTraceEvents,
  startDevTrace,
  stopDevTrace,
} from '@/lib/dev-trace-server';
import { TRACE_SECTIONS, type DevTraceEvent, type DevTraceSession } from '@/lib/dev-trace';
import { generateExploreBody } from '@/lib/explore/generate';
import { routeExplore } from '@/lib/explore/route';
import { fetchExploreMissNotes } from '@/lib/explore/store';
import type { RouteExploreResult } from '@/lib/explore/types';
import { voiceMeFrom } from '@/lib/intake';
import { bankCardForMe } from '@/lib/voice/bank';
import { localYmd, weekdayInZone } from '@/lib/local-date';
import { supabase } from '@/lib/supabase';
import { isDirectTraitSource, traitStateFromRow, type TraitSource } from '@/lib/traits';
import { filledTraitBands } from '@/lib/trait-bands';
import { controlBorderColor } from '@/lib/theme/chrome';
import { shouldUseLocalAi } from '@/lib/ai/override';
import { buildVoiceConfig } from '@/lib/voice/config';
import { matchingFrameworkTerms } from '@/lib/voice/framework-fence';
import { type SageUsageSnapshot } from '@/lib/voice/quota';
import { claimAiCall, fetchSageUsage, logJargonGuard, logPhraseGuard } from '@/lib/voice/quota-server';
import {
  ASK_OVERRIDE_KINDS,
  SLOT_OVERRIDE_KINDS,
  clearAskOverride,
  clearSlotOverride,
  loadStoredAskOverride,
  loadStoredSlotOverride,
  writeAskOverride,
  writeSlotOverride,
} from '@/lib/dev-overrides';
import { routeVoiceCard } from '@/lib/voice/router';
import type { VoiceCardResult, VoiceMe } from '@/lib/voice/types';
import { resolveAsk, type AskPick } from '@/lib/ask';
import { resolveReveal } from '@/lib/reveal';
import { parseSageKnowsState } from '@/lib/sage-knows';
import { resolveTodaySlot, type TodaySlot } from '@/lib/today-slot';
import {
  clearGrowthPreview,
  readGrowthPreview,
  writeGrowthPreview,
} from '@/app/(tabs)/you';

const LAB_ME: VoiceMe = {
  name: 'Riley',
  show_up: 'finishing my resume',
  talk_style: 'even',
  knocks_you_off: 'sleep',
  morning_cue: 'make coffee',
  facts: ['I finish work at four'],
};

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
  if (devAccessLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }
  if (
    !canSeeDevLab({
      isDev: __DEV__,
      isRoot: devAccess.isRoot,
      capabilities: devAccess.capabilities,
    })
  ) {
    return <Redirect href="/" />;
  }
  return <DevLab />;
}

function DevLab() {
  const { devAccess, me } = useMeContext();
  const gate = useMemo(
    () => ({
      isDev: __DEV__,
      isRoot: devAccess.isRoot,
      capabilities: devAccess.capabilities,
    }),
    [devAccess.isRoot, devAccess.capabilities],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle">Dev Tools Hub</ThemedText>
            <ThemedText themeColor="textSecondary">
              Root and granted testers in TestFlight. Local __DEV__ always opens it.
              Access, grants, and profile pause/delete stay root-only.
            </ThemedText>
            <RunningUpdateLine />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Home</ThemedText>
            {canSeeHubSection('card', gate) ? (
              <>
                <HomeOverrides />
                <CardSimulator />
              </>
            ) : null}
            <ForceTestError message="Dev Lab test error — Home" />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Sage</ThemedText>
            {canSeeHubSection('quota', gate) ? <QuotaDashboard /> : null}
            <ExploreRegen />
            <ForceTestError message="Dev Lab test error — Sage" />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">You</ThemedText>
            {canSeeHubSection('traits', gate) ? <TraitViewer /> : null}
            <GrowthPreview />
            <BandDetailStepper />
            <ForceTestError message="Dev Lab test error — You" />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">System</ThemedText>
            {canSeeHubSection('fence', gate) ? <FenceTester /> : null}
            {canSeeHubSection('trace', gate) ? <TraceCapture /> : null}
            {canSeeHubSection('access', gate) ? <AccessReview /> : null}
            {canSeeHubSection('grants', gate) ? <GrantsPanel /> : null}
            {canSeeHubSection('profiles', gate) ? <ProfilesPanel /> : null}
            {me ? <YouDevTools timeZone={me.timezone || 'UTC'} /> : null}
            <ResetAiConsent />
            {__DEV__ ? <CrisisCardPreview /> : null}
            <ForceTestError message="Dev Lab test error — System" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
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
      const next = await routeExplore(
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
          generateBody: generateExploreBody,
          useLocal: await shouldUseLocalAi(),
        },
      );
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

function HomeOverrides() {
  const [slot, setSlot] = useState<TodaySlot['kind'] | 'off'>('off');
  const [ask, setAsk] = useState<AskPick['kind'] | 'off'>('off');

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadStoredSlotOverride(), loadStoredAskOverride()]).then(([nextSlot, nextAsk]) => {
      if (cancelled) return;
      setSlot(nextSlot ?? 'off');
      setAsk(nextAsk ?? 'off');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pickSlot(kind: TodaySlot['kind'] | 'off') {
    if (kind === 'off') await clearSlotOverride();
    else await writeSlotOverride(kind);
    setSlot(kind);
  }

  async function pickAsk(kind: AskPick['kind'] | 'off') {
    if (kind === 'off') await clearAskOverride();
    else await writeAskOverride(kind);
    setAsk(kind);
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Today slot override</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Forces the Home slot on the next boxes. Off is live resolve. Production never honours
        this key.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        stored: {slot}
      </ThemedText>
      <View style={styles.tabs}>
        {(['off', ...SLOT_OVERRIDE_KINDS] as const).map((kind) => (
          <Chip key={kind} label={kind} selected={slot === kind} onPress={() => void pickSlot(kind)} />
        ))}
      </View>
      <Chip label="clear override" selected={false} onPress={() => void pickSlot('off')} />
      {slot === 'off' ? <SlotReadout /> : null}

      <ThemedText type="smallBold">Ask kind override</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Forces which ask body the sheet would show. Off is live resolveAsk. Production never
        honours this key.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        stored: {ask}
      </ThemedText>
      <View style={styles.tabs}>
        {(['off', ...ASK_OVERRIDE_KINDS] as const).map((kind) => (
          <Chip key={kind} label={kind} selected={ask === kind} onPress={() => void pickAsk(kind)} />
        ))}
      </View>
      <Chip label="clear override" selected={false} onPress={() => void pickAsk('off')} />
    </View>
  );
}

function SlotReadout() {
  const { me } = useMeContext();
  const { session } = useSession();
  const { state: growth } = useGrowth();
  const userId = session?.user.id;
  const [lines, setLines] = useState<string>('…');

  useEffect(() => {
    if (!me || !userId) {
      setLines('No signed-in account.');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const checks = await fetchChecks(userId);
        const flags = await crisisFlagsForWindow(userId, me.timezone);
        const window = checkWindowFor(
          me,
          checks.map((check) => check.day),
        );
        const missedCheck = window.open.some((slot) => slot.offset > 0);
        const noteAvailable =
          resolveReveal({
            checks,
            facts: me.facts ?? [],
            checkCount: growth.checkCount,
            factCount: growth.factCount,
            timeZone: me.timezone || 'UTC',
            crisisToday: flags.crisisToday,
            crisisYesterday: flags.crisisYesterday,
          }) !== null;
        const noteOpenedToday = await isRevealOpenedToday(userId, me.timezone || 'UTC');
        const traits = traitStateFromRow(me);
        const askPending =
          resolveAsk({
            values: traits.values,
            touched: traits.touched,
            knows: parseSageKnowsState(me.sage_knows),
            knocksYouOff: me.knocks_you_off ?? '',
            facts: me.facts ?? [],
            history: checksToHistory(checks),
            now: new Date(),
            timeZone: me.timezone || 'UTC',
          }) !== null;
        const isSunday = weekdayInZone(new Date(), me.timezone || 'UTC') === 0;
        const input = {
          crisisActive: flags.crisisToday,
          missedCheck,
          noteAvailable,
          noteOpenedToday,
          askPending,
          isSunday,
        };
        const kind = resolveTodaySlot(input).kind;
        const pastDay3 = window.todayDay > 3;
        const consentNotTrue = me.ai_consent !== true;
        const noBankCard = bankCardForMe(window.todayDay, voiceMeFrom(me)) === null;
        const honestEmpty = pastDay3 && consentNotTrue && noBankCard;
        if (cancelled) return;
        setLines(
          [
            `crisisActive: ${input.crisisActive}`,
            `missedCheck: ${input.missedCheck}`,
            `noteAvailable: ${input.noteAvailable}`,
            `noteOpenedToday: ${input.noteOpenedToday}`,
            `askPending: ${input.askPending}`,
            `isSunday: ${input.isSunday}`,
            `kind: ${kind}`,
            `pastDay3: ${pastDay3}`,
            `consentNotTrue: ${consentNotTrue}`,
            `noBankCard: ${noBankCard}`,
            `honestEmpty: ${honestEmpty}`,
          ].join('\n'),
        );
      } catch (err) {
        if (!cancelled) {
          setLines(err instanceof Error ? err.message : 'Could not resolve today slot.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, userId, growth.checkCount, growth.factCount]);

  return (
    <>
      <ThemedText type="smallBold">Today slot inputs</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Live resolveTodaySlot for this account. Shown when the override is off.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {lines}
      </ThemedText>
    </>
  );
}

function CardSimulator() {
  const { me } = useMeContext();
  const [streak, setStreak] = useState<(typeof DEV_LAB_STREAKS)[number]>(4);
  const [patternId, setPatternId] = useState(DEV_LAB_PATTERNS[0].id);
  const [gap, setGap] = useState<(typeof DEV_LAB_GAPS)[number]>(7);
  const [result, setResult] = useState<VoiceCardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pattern = DEV_LAB_PATTERNS.find((row) => row.id === patternId) ?? DEV_LAB_PATTERNS[0];
  const history = useMemo(
    () => buildSimHistory(streak, pattern.cells),
    [streak, pattern],
  );
  const todayYmd = localYmd(new Date(), me?.timezone?.trim() || 'UTC');
  const window = simulateGapWindow({
    checkCount: history.length,
    gapDays: gap,
    todayYmd,
  });

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    const config = buildVoiceConfig({ MODEL_PROVIDER: 'local' });
    const voiceMe = me ? voiceMeFrom(me) : LAB_ME;
    routeVoiceCard(
      {
        me: voiceMe,
        checkCount: history.length,
        history,
        day: window.todayDay,
        aiConsent: true,
      },
      { config, isDev: true },
    )
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not route a card.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [history, window.todayDay, me]);

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Card simulator</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Local generator, consent granted. Use this to preview a Read/Do/Nudge without
        spending a real quota. Streak below 3 uses the written bank, not the generator.
      </ThemedText>

      <ThemedText type="code" themeColor="textSecondary">
        streak — Checks already logged (journey length)
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Not a consecutive-days streak. 0–2 stay on the Day 1–3 bank; 3+ generate.
      </ThemedText>
      <View style={styles.tabs}>
        {DEV_LAB_STREAKS.map((n) => (
          <Chip key={n} label={String(n)} selected={streak === n} onPress={() => setStreak(n)} />
        ))}
      </View>

      <ThemedText type="code" themeColor="textSecondary">
        recent log / skip — last few days of the fake history
      </ThemedText>
      <View style={styles.tabs}>
        {DEV_LAB_PATTERNS.map((row) => (
          <Chip
            key={row.id}
            label={row.label}
            selected={patternId === row.id}
            onPress={() => setPatternId(row.id)}
          />
        ))}
      </View>

      <ThemedText type="code" themeColor="textSecondary">
        gap — calendar days since the last Check
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        1–2 still leave yesterday (and 2-days-ago) loggable. 7 closes days 3–6; only
        today and the 2-day window stay open.
      </ThemedText>
      <View style={styles.tabs}>
        {DEV_LAB_GAPS.map((n) => (
          <Chip
            key={n}
            label={n === 7 ? '7 (3+ closed)' : `${n} day${n === 1 ? '' : 's'}`}
            selected={gap === n}
            onPress={() => setGap(n)}
          />
        ))}
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="code" themeColor="textSecondary">
          window — days that can still take a Check
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Journey day {window.todayDay} is today&apos;s number since signup day 1, not a
          streak count.
        </ThemedText>
        <ThemedText type="small">
          Open: {window.open.length === 0 ? 'none' : window.open.map((slot) => offsetLabel(slot.offset)).join(', ')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Closed beyond 2-day window:{' '}
          {window.closedMissed.length === 0
            ? 'none'
            : window.closedMissed.map((slot) => `${offsetLabel(slot.offset)} (day ${slot.day})`).join(', ')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Recent: {history.map((row) => (row.status === 'done' ? 'D' : 'S')).join(' ') || '(none)'}
        </ThemedText>
      </ThemedView>

      {busy ? (
        <ThemedText themeColor="textSecondary">Routing…</ThemedText>
      ) : error ? (
        <ThemedText type="smallBold">{error}</ThemedText>
      ) : result ? (
        <>
          <CardBlock
            kicker={`read · ${result.source} · ${result.tone}${result.dev?.fromBankFile ? ' · bank' : ''}`}
            body={result.card?.read ?? '(dropped — nothing shown)'}
          />
          <CardBlock kicker="do" body={result.card?.do ?? '—'} />
          <CardBlock
            kicker="nudge"
            body={result.nudge ?? 'none — no skip pattern, knock-in-text, or safe fact'}
          />
          {result.dropped.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              dropped: {result.dropped.join(', ')}
            </ThemedText>
          ) : null}
        </>
      ) : null}

      {window.open
        .filter((slot) => slot.offset > 0)
        .map((slot) => (
          <ThemedView key={slot.ymd} type="backgroundElement" style={styles.card}>
            <ThemedText type="code" themeColor="textSecondary">
              catch-up still open · day {slot.day} · {offsetLabel(slot.offset)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Home would still offer a Check for this day.
            </ThemedText>
          </ThemedView>
        ))}
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

function GrowthPreview() {
  const theme = useTheme();
  const [checkCount, setCheckCount] = useState('7');
  const [factCount, setFactCount] = useState('1');
  const [stored, setStored] = useState<{ checkCount: number; factCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readGrowthPreview().then((next) => {
      if (cancelled) return;
      setStored(next);
      if (next) {
        setCheckCount(String(next.checkCount));
        setFactCount(String(next.factCount));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function apply() {
    const next = {
      checkCount: Math.max(0, Number.parseInt(checkCount, 10) || 0),
      factCount: Math.max(0, Number.parseInt(factCount, 10) || 0),
    };
    await writeGrowthPreview(next);
    setStored(next);
  }

  async function off() {
    await clearGrowthPreview();
    setStored(null);
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Growth preview</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Forces check_count and fact count on You for MilestoneBadges and QuestGrowthBars.
        Preview-only. Does not write Checks or facts.
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        stored: {stored ? `check_count ${stored.checkCount} · fact count ${stored.factCount}` : 'off'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        check_count
      </ThemedText>
      <TextInput
        value={checkCount}
        onChangeText={setCheckCount}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          styles.searchInput,
          { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
        ]}
      />
      <ThemedText type="small" themeColor="textSecondary">
        fact count
      </ThemedText>
      <TextInput
        value={factCount}
        onChangeText={setFactCount}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          styles.searchInput,
          { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
        ]}
      />
      <View style={styles.tabs}>
        <Chip label="apply preview" selected={stored != null} onPress={() => void apply()} />
        <Chip label="off" selected={stored == null} onPress={() => void off()} />
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

function ResetAiConsent() {
  const { me, refresh } = useMeContext();
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stored =
    me?.ai_consent === true ? 'true' : me?.ai_consent === false ? 'false' : 'null';

  async function reset() {
    const userId = session?.user.id;
    if (!userId || busy) return;
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
        label={busy ? 'resetting…' : 'reset to null'}
        selected={false}
        onPress={() => void reset()}
      />
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
        Paste generated Read / Do / Nudge / a Teach-Sage fact. Same matcher the router uses.
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
        Capture your own next Dawn, Talk, and Explore generations as an ordered
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
      <TracePipelineViewer events={events} selectedId={sectionId} onSelect={setSectionId} />
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

  async function save() {
    if (!selected || busy) return;
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
              Save grants
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
              <ThemedText type="small">Pause</ThemedText>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void unpause()}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: controlBorderColor(theme) },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">Unpause</ThemedText>
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
                  {busyId === row.id ? '…' : 'Approve'}
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
                  Deny
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        ))
      )}
    </View>
  );
}

function CardBlock({ kicker, body }: { kicker: string; body: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary">
        {kicker}
      </ThemedText>
      <ThemedText>{body}</ThemedText>
    </ThemedView>
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
