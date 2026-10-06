/**
 * Dev Tools Hub panels added in the 2026-10-03 reorganisation (emci: "rearrange
 * dev properly", grouped by what you are trying to do — the Hyperion /
 * Android-settings pattern: build info on top, the most-used groups open,
 * everything else folded, risky buttons named for exactly what they touch).
 *
 * Every panel here is read-only or two-tap, writes only this account's own
 * non-trait data (milestone ids), and renders only inside the Hub's `tools`
 * branch (check:release-mode).
 */
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { AXIS_SHORT_NAME, POLE_COPY_REVIEWED } from '@/lib/axis-poles';
import { ROUND_PAYOUTS_PER_DAY, atoTokenBalanceOf } from '@/lib/ato-tokens';
import { fetchAtoTokenEvents, type AtoTokenEvent } from '@/lib/ato-tokens-server';
import { pushBuddyNote } from '@/lib/buddy/notes';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { localYmd } from '@/lib/local-date';
import { forgetCelebratedMilestone } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { MILESTONE_DEFS } from '@/lib/milestones';
import { currentIntakeSet, intakeStage, finishedLegacyIntake } from '@/lib/questions/intake-stage';
import { INTAKE_REVEAL_SEEN_ID } from '@/lib/questions/progressive-unlock';
import { controlBorderColor } from '@/lib/theme/chrome';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { TRAIT_AXES } from '@/lib/traits';

import { BUDDY_COPY_REVIEWED } from '@/lib/buddy/idle';
import { CATEGORY_COPY_REVIEWED } from '@/lib/categories';
import { QUESTION_VOICE_COPY_REVIEWED } from '@/lib/questions/bank';
import { BANK_COPY_REVIEWED, BANK_STAGE_LABEL, type BankProgress } from '@/lib/questions/bank-sets';
import { devFillBank, fetchBankProgress } from '@/lib/questions/bank-sets-server';
import { BANK_PER_TRAIT } from '@/lib/questions/bank/index';
import { CATEGORY_BAND_COPY_REVIEWED } from '@/lib/category-bands';
import { CATEGORY_STATEMENTS_COPY_REVIEWED } from '@/lib/category-statements/generate-statements';
import { CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';
import { DAILY_LINE_COPY_REVIEWED } from '@/lib/daily-line/bank';
import { DAILY_INSIGHT_COPY_REVIEWED } from '@/lib/insight/generate-insight';
import { LEGENDS64_COPY_REVIEWED, NAME_STYLES_V2_COPY_REVIEWED } from '@/lib/legends64/archetypes';
import { DAILY_PICK_COPY_REVIEWED } from '@/lib/daily-pick/bank';
import { POLISH_COPY_REVIEWED } from '@/lib/polish-copy';
import { PROFILE_FILL_COPY_REVIEWED } from '@/lib/profile-fill';
import { CATEGORY_READ_COPY_REVIEWED } from '@/lib/rolls/category-read';
import { STORY_COPY_REVIEWED } from '@/lib/sage-story';
import { TITLE_COPY_REVIEWED } from '@/lib/sage-title';
import { STAGED_INTAKE_COPY_REVIEWED } from '@/lib/questions/staged-intake-copy';

/* -------------------------------------------------------------------------
 * Shell
 * ---------------------------------------------------------------------- */

/** One Hub group: a title, how many tools it holds, folded or open. */
export function HubSection({
  title,
  hint,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.section, { borderColor: controlBorderColor(theme) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${count} tools`}
        onPress={() => setOpen((v) => !v)}
        style={styles.sectionHead}>
        <ThemedText type="smallBold">
          {open ? '▾' : '▸'} {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {count}
        </ThemedText>
      </Pressable>
      {open && hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: controlBorderColor(theme) },
        (pressed || disabled) && styles.dim,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function useTwoTapLocal(): { armed: string | null; confirm: (id: string) => boolean } {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const confirm = useCallback(
    (id: string) => {
      if (armed === id) {
        setArmed(null);
        return true;
      }
      setArmed(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(null), 5000);
      return false;
    },
    [armed],
  );
  return { armed, confirm };
}

/** This account's trait tracks, reloaded when a dev write moves the epoch. */
function useMyTracks(): { tracks: TraitTrack[]; ready: boolean } {
  const { me } = useMeContext();
  const epoch = useAccountDataEpoch();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [ready, setReady] = useState(false);
  const meId = me?.id;
  useEffect(() => {
    if (!meId) {
      setReady(true);
      return;
    }
    let active = true;
    fetchTraitTracks(meId)
      .then((rows) => {
        if (active) setTracks(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [meId, epoch, me?.updated_at]);
  return { tracks, ready };
}

/* -------------------------------------------------------------------------
 * 1. This build
 * ---------------------------------------------------------------------- */

/** Who and what this is, at a glance. Tap the id to copy it. */
export function BuildStrip() {
  const { me, devAccess } = useMeContext();
  const [copied, setCopied] = useState(false);
  return (
    <View style={styles.block}>
      <ThemedText type="code" themeColor="textSecondary">
        @{me?.handle ?? '—'} · root {devAccess.isRoot ? 'yes' : 'no'} · pre-launch dev{' '}
        {PRE_LAUNCH_DEV ? 'on' : 'off'} · {__DEV__ ? 'dev build' : 'release build'}
      </ThemedText>
      {me ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy my user id"
          onPress={() => {
            void Clipboard.setStringAsync(me.id).then(() => setCopied(true));
          }}>
          <ThemedText type="code" themeColor="textSecondary">
            id {me.id} {copied ? '· copied' : '· tap to copy'}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------
 * 2. My account
 * ---------------------------------------------------------------------- */

/** Which intake set this account is on, and each trait's answer count. */
export function IntakeStatus() {
  const { tracks, ready } = useMyTracks();
  if (!ready) return <ThemedText type="small" themeColor="textSecondary">Loading…</ThemedText>;
  const set = currentIntakeSet(tracks);
  const stage = intakeStage(tracks);
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Where I am in the intake</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {set
          ? `Set ${set.set} of 3 — ${set.answered} of ${set.size} answered in this set.`
          : 'All 48 done (every trait has 3).'}
        {finishedLegacyIntake(tracks) && stage < 3 ? ' Finished the old 50: everything stays open.' : ''}
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {TRAIT_AXES.map((axis) => `${AXIS_SHORT_NAME[axis]} ${trackFor(tracks, axis, 'report')?.answerCount ?? 0}`).join(' · ')}
      </ThemedText>
    </View>
  );
}

/** What the next round of 16 would ask, per trait — read-only, no AI call. */
export function NextRoundPreview() {
  const [progress, setProgress] = useState<BankProgress | null>(null);
  useEffect(() => {
    fetchBankProgress()
      .then(setProgress)
      .catch(() => setProgress(null));
  }, []);
  if (!progress) return null;
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">
        Next set: {progress.currentSet ?? 'none, all 25 done'} · {BANK_STAGE_LABEL[progress.stage]}
      </ThemedText>
      {TRAIT_AXES.map((axis) => (
        <ThemedText key={axis} type="code" themeColor="textSecondary">
          {AXIS_SHORT_NAME[axis]} {progress.answeredByAxis[axis]}/{BANK_PER_TRAIT}
        </ThemedText>
      ))}
    </View>
  );
}

/** Balance, round payouts used today (of the cap), and the last 10 entries. */
export function TokensToday() {
  const { me } = useMeContext();
  const epoch = useAccountDataEpoch();
  const [events, setEvents] = useState<AtoTokenEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchAtoTokenEvents(30)
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not read tokens.');
      });
    return () => {
      active = false;
    };
  }, [epoch, me?.updated_at]);
  if (!me) return null;
  const tz = me.timezone || 'UTC';
  const today = localYmd(new Date(), tz);
  const roundsToday = (events ?? []).filter(
    (row) => row.reason === 'ongoing_round_complete' && localYmd(new Date(row.created_at), tz) === today,
  ).length;
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Tokens today</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Balance {atoTokenBalanceOf(me)} · round payouts today {roundsToday} of {ROUND_PAYOUTS_PER_DAY}
      </ThemedText>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {(events ?? []).slice(0, 10).map((row) => (
        <ThemedText key={row.id} type="code" themeColor="textSecondary">
          {row.delta > 0 ? `+${row.delta}` : row.delta} {row.reason} · {new Date(row.created_at).toLocaleString()}
        </ThemedText>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------
 * 4. Content
 * ---------------------------------------------------------------------- */

/** Make the mini guy talk: one note that pops up, one that waits for a tap. */
export function MiniGuyPanel() {
  const [note, setNote] = useState<string | null>(null);
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Mini guy: say something</ThemedText>
      <Button
        label="Make him say something"
        onPress={() => {
          const stamp = Date.now();
          pushBuddyNote({ id: `dev:loud:${stamp}`, title: 'Test note', body: 'This one pops up by itself.', loud: true });
          pushBuddyNote({ id: `dev:quiet:${stamp}`, title: 'This one waited for a tap.', body: '', loud: false });
          setNote('Sent two notes. Close the Hub: one shows by itself, then a dot. Tap him for the second.');
        }}
      />
      {note ? <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText> : null}
    </View>
  );
}

/** Which milestones this account has had, and a two-tap "say it again". */
export function MilestonesPanel() {
  const { me, refresh } = useMeContext();
  const twoTap = useTwoTapLocal();
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;
  const celebrated = new Set(me.celebrated_milestone_ids ?? []);
  const rows = [
    ...MILESTONE_DEFS.filter((def) => !def.id.startsWith('axis_complete_')).map((def) => ({ id: def.id, title: def.title })),
    { id: INTAKE_REVEAL_SEEN_ID, title: 'Full-profile reveal card seen' },
  ];
  async function forget(id: string) {
    if (!me || !twoTap.confirm(id)) return;
    setError(null);
    try {
      await forgetCelebratedMilestone(me.id, id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset that milestone.');
    }
  }
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Mini guy milestones</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        ✓ = already said. Tap a said one twice to forget it, so it fires again the next time it is crossed. Per-trait
        milestones are silent and not listed.
      </ThemedText>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {rows.map((row) => {
        const said = celebrated.has(row.id);
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            disabled={!said}
            onPress={() => void forget(row.id)}>
            <ThemedText type="code" themeColor={said ? undefined : 'textSecondary'}>
              {said ? '✓' : '·'} {row.title}
              {twoTap.armed === row.id ? ' — tap again to forget' : ''}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Question bank (wave85): where this account is in the 25 sets, and a
 * two-tap jump that answers every remaining question on THIS account with a
 * random option (server `dev_fill_bank`, pre-launch only) so the after-25
 * Change answers / Start Fresh view can be tested without 400 taps. No AI.
 */
export function QuestionBankPanel() {
  const twoTap = useTwoTapLocal();
  const [progress, setProgress] = useState<BankProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProgress(await fetchBankProgress());
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function fill() {
    if (busy || !twoTap.confirm('bank-fill')) return;
    setBusy(true);
    setNote(null);
    try {
      const n = await devFillBank();
      setNote(`Answered ${n} question${n === 1 ? '' : 's'} at random. Reopen Questions to see the finish view.`);
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Question bank</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {progress ? `${progress.completedSets} of 25 sets done · ${BANK_STAGE_LABEL[progress.stage]}` : 'Loading…'}
      </ThemedText>
      <Button
        label={busy ? 'Answering…' : twoTap.armed === 'bank-fill' ? 'Tap again: answers every remaining question on this account' : 'Jump to all 25 sets done'}
        onPress={() => void fill()}
        disabled={busy}
      />
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
    </View>
  );
}

const COPY_FLAGS: readonly { name: string; reviewed: boolean }[] = [
  { name: 'Staged intake (sets, round cap, mixed trait)', reviewed: STAGED_INTAKE_COPY_REVIEWED },
  { name: 'Daily insight (AI)', reviewed: DAILY_INSIGHT_COPY_REVIEWED },
  { name: 'Category statements (AI)', reviewed: CATEGORY_STATEMENTS_COPY_REVIEWED },
  { name: 'Category read (rolls)', reviewed: CATEGORY_READ_COPY_REVIEWED },
  { name: 'Story', reviewed: STORY_COPY_REVIEWED },
  { name: 'Sage title', reviewed: TITLE_COPY_REVIEWED },
  { name: 'Daily lines', reviewed: DAILY_LINE_COPY_REVIEWED },
  { name: 'Today’s Pick (64 daily questions)', reviewed: DAILY_PICK_COPY_REVIEWED },
  { name: 'Mini guy idle lines', reviewed: BUDDY_COPY_REVIEWED },
  { name: 'Trait ends (poles)', reviewed: POLE_COPY_REVIEWED },
  { name: 'Categories', reviewed: CATEGORY_COPY_REVIEWED },
  { name: 'Category bands', reviewed: CATEGORY_BAND_COPY_REVIEWED },
  { name: 'Concept explainers', reviewed: CONCEPT_COPY_REVIEWED },
  { name: 'Archetype names', reviewed: LEGENDS64_COPY_REVIEWED },
  { name: 'Name styles v2 (Primal Genius, High Fantasy, Corporate Realist, Oxymoron)', reviewed: NAME_STYLES_V2_COPY_REVIEWED },
  { name: 'Profile fill', reviewed: PROFILE_FILL_COPY_REVIEWED },
  { name: 'Polish pass (shape, week, set done, sealed read)', reviewed: POLISH_COPY_REVIEWED },
  { name: 'Question bank in the moment voice (48 intake + 22 round)', reviewed: QUESTION_VOICE_COPY_REVIEWED },
  { name: 'Fixed question bank (352 new questions, set and finish screens)', reviewed: BANK_COPY_REVIEWED },
];

/** What ships as draft: every *_COPY_REVIEWED flag, drafts first. */
export function DraftCopyList() {
  const rows = [...COPY_FLAGS].sort((a, b) => Number(a.reviewed) - Number(b.reviewed));
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Draft copy (what ships unreviewed)</ThemedText>
      {rows.map((row) => (
        <ThemedText key={row.name} type="code" themeColor={row.reviewed ? 'textSecondary' : undefined}>
          {row.reviewed ? 'reviewed' : 'DRAFT   '} {row.name}
        </ThemedText>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------
 * 5. This phone
 * ---------------------------------------------------------------------- */

/** Reload now, or check for a newer update and reload into it. */
export function AppReloadPanel() {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function checkAndReload() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      if (!Updates.isEnabled) {
        setNote('Updates are off in this build (local dev).');
        return;
      }
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setNote('Already on the newest update.');
        return;
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not check for an update.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Reload</ThemedText>
      <View style={styles.row}>
        <Button label="Reload app" onPress={() => void Updates.reloadAsync().catch(() => setNote('Reload is not available here.'))} />
        <Button label={busy ? 'Checking…' : 'Check for update now'} disabled={busy} onPress={() => void checkAndReload()} />
      </View>
      {note ? <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText> : null}
    </View>
  );
}

/** Notification permission and how many reminders are scheduled on this phone. */
export function PushStatus() {
  const [status, setStatus] = useState<string>('…');
  const [scheduled, setScheduled] = useState<number | null>(null);
  const load = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then((p) => setStatus(p.status))
      .catch(() => setStatus('unknown'));
    Notifications.getAllScheduledNotificationsAsync()
      .then((rows) => setScheduled(rows.length))
      .catch(() => setScheduled(null));
  }, []);
  useEffect(load, [load]);
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Notifications on this phone</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Permission: {status} · scheduled: {scheduled ?? '—'}
      </ThemedText>
      <Button label="Refresh" onPress={load} />
    </View>
  );
}

/* -------------------------------------------------------------------------
 * 6. Labs
 * ---------------------------------------------------------------------- */

const LABS: readonly { label: string; href: Href; note: string }[] = [
  { label: 'AI lab', href: '/ai-lab', note: 'switch the AI provider' },
  { label: 'Crisis lab', href: '/crisis-lab', note: 'the static crisis card' },
  { label: 'Theme lab', href: '/theme-lab', note: 'appearance modes' },
  { label: 'Pixel lab', href: '/pixel-lab', note: 'sprites' },
  { label: 'Profile cards lab', href: '/profile-card-lab', note: 'Change answers + card binder, sample data' },
  { label: 'Around lab', href: '/around-lab', note: 'Around / city' },
  { label: 'Play (Divecore)', href: '/play', note: 'the game' },
];

export function LabsList() {
  return (
    <View style={styles.block}>
      {LABS.map((lab) => (
        <Button key={lab.label} label={`${lab.label} — ${lab.note}`} onPress={() => router.push(lab.href)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  sectionBody: {
    gap: Spacing.three,
  },
  block: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignSelf: 'flex-start',
  },
  dim: {
    opacity: 0.6,
  },
});
