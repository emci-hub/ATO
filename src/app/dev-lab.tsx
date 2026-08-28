import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { offsetLabel } from '@/lib/check-window';
import {
  DEV_LAB_AXIS_ORDER,
  DEV_LAB_GAPS,
  DEV_LAB_PATTERNS,
  DEV_LAB_STREAKS,
  buildSimHistory,
  demoTraitState,
  simulateGapWindow,
} from '@/lib/dev-lab';
import { voiceMeFrom } from '@/lib/intake';
import { localYmd } from '@/lib/local-date';
import { supabase } from '@/lib/supabase';
import { isDirectTraitSource, traitStateFromRow, type TraitSource } from '@/lib/traits';
import { controlBorderColor } from '@/lib/theme/chrome';
import { buildVoiceConfig } from '@/lib/voice/config';
import { matchingFrameworkTerms } from '@/lib/voice/framework-fence';
import { type SageUsageSnapshot } from '@/lib/voice/quota';
import { fetchSageUsage } from '@/lib/voice/quota-server';
import { routeVoiceCard } from '@/lib/voice/router';
import type { VoiceCardResult, VoiceMe } from '@/lib/voice/types';

type HubSection = 'card' | 'traits' | 'quota' | 'fence';

const SECTIONS: { id: HubSection; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'traits', label: 'Traits' },
  { id: 'quota', label: 'Quota' },
  { id: 'fence', label: 'Fence' },
];

const LAB_ME: VoiceMe = {
  name: 'Riley',
  show_up: 'finishing my resume',
  talk_style: 'even',
  knocks_you_off: 'sleep',
  morning_cue: 'make coffee',
  facts: ['I finish work at four'],
};

const SOURCE_NOTE: Record<TraitSource, string> = {
  self_slider: 'direct — inferred cannot overwrite',
  self_tap: 'direct — tap-form',
  self_confirm: 'direct — Does Sage know you? confirm',
  self_settings: 'direct — Settings edit',
  self_grid: 'inferred — 16-grid',
  self_situation: 'inferred — close-pattern / disagreement',
  self_game: 'inferred — scenario swipe',
};

export default function DevLabScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <DevLab />;
}

function DevLab() {
  const [section, setSection] = useState<HubSection>('card');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle">Dev Tools Hub</ThemedText>
            <ThemedText themeColor="textSecondary">
              Dev-only. Same gates as the other labs — not in the production navigator.
            </ThemedText>
          </View>
          <View style={styles.tabs}>
            {SECTIONS.map((tab) => (
              <Chip
                key={tab.id}
                label={tab.label}
                selected={section === tab.id}
                onPress={() => setSection(tab.id)}
              />
            ))}
          </View>
          {section === 'card' ? <CardSimulator /> : null}
          {section === 'traits' ? <TraitViewer /> : null}
          {section === 'quota' ? <QuotaDashboard /> : null}
          {section === 'fence' ? <FenceTester /> : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
        Local generator, consent granted. Streak is check_count (bank below 3). Gap is days
        since the last Check — 7 days leaves 3–6 closed.
      </ThemedText>

      <ThemedText type="code" themeColor="textSecondary">
        streak
      </ThemedText>
      <View style={styles.tabs}>
        {DEV_LAB_STREAKS.map((n) => (
          <Chip key={n} label={String(n)} selected={streak === n} onPress={() => setStreak(n)} />
        ))}
      </View>

      <ThemedText type="code" themeColor="textSecondary">
        recent log / skip
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
        days since last open
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
          window · today is journey day {window.todayDay}
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
      <ThemedText type="code" themeColor="textSecondary">
        {usingDemo ? 'demo · slider-sticky example' : `@${selected}`}
      </ThemedText>
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
              {source ? `${source} — ${SOURCE_NOTE[source]}` : 'no write — skipped or never set'}
            </ThemedText>
            {isDirectTraitSource(source) ? (
              <View style={[styles.sourceMark, { backgroundColor: theme.accentFill }]}>
                <ThemedText type="code" style={{ color: theme.onAccent }}>
                  direct sticky
                </ThemedText>
              </View>
            ) : null}
          </ThemedView>
        );
      })}
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
