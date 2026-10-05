/**
 * Divecore Settings (v24, 2026-09-30) — one sheet, opened from the ⚙ on the
 * Command Hub and in the Pet room.
 *
 *   Notifications (hunger, egg hatched / hero revealed, expedition back, dive
 *   charges full), quiet hours, pet bedtime (looks only), pet chatter,
 *   effects (Full / Low), skip reveal animations, reduce motion (follow the
 *   phone or override), when daily limits reset, replay the tutorial, and
 *   Reset Divecore (a summary of exactly what goes, then a double confirm and
 *   typing RESET — the Play save only; settings and the main app are kept).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { setFxQuality, useFxQuality } from '@/play/fx-quality';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { GRADES, heroStars } from '@/play/pet-eggs';
import { askPetReminderPermission, cancelPlayNotices, petNoticesAllowed } from '@/play/pet-reminder';
import { saveSeenStageReset } from '@/play/pet-seen';
import { PLAY_MOTION_LABEL, PLAY_MOTION_MODES, setPlayMotionMode, usePlayMotionMode } from '@/play/play-motion';
import {
  CHATTER_LABEL,
  CHATTER_LEVELS,
  NOTIF_KINDS,
  NOTIF_LABEL,
  nextDailyReset,
  windowLabel,
  type DayWindow,
  type NotifKind,
} from '@/play/play-settings';
import { PlaySheet } from '@/play/play-sheet';
import { resetDivecore, setPlaySettings, type PlayView } from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

type Commit = (transition: PlayTransition) => boolean;

const STEP = 30;

function shift(minute: number, by: number): number {
  return (((minute + by) % 1440) + 1440) % 1440;
}

function WindowRow({ label, value, onChange }: { label: string; value: DayWindow; onChange: (w: DayWindow) => void }) {
  return (
    <View style={styles.windowRow}>
      <Text style={styles.body}>
        {label}: <Text style={styles.strong}>{windowLabel(value)}</Text>
      </Text>
      <View style={styles.chips}>
        <NeonChip label="Start −" onPress={() => onChange({ ...value, from: shift(value.from, -STEP) })} />
        <NeonChip label="Start +" onPress={() => onChange({ ...value, from: shift(value.from, STEP) })} />
        <NeonChip label="End −" onPress={() => onChange({ ...value, to: shift(value.to, -STEP) })} />
        <NeonChip label="End +" onPress={() => onChange({ ...value, to: shift(value.to, STEP) })} />
      </View>
    </View>
  );
}

function timeOf(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function inLabel(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

/** What a reset deletes, with the player's real counts. */
export function resetSummary(view: PlayView): string[] {
  const book = Object.values(view.pet.heroes);
  const pet = view.pet.state;
  const liveRevealed = pet.hero != null && pet.stage !== 'egg' && pet.stage !== 'baby';
  const legendaries =
    view.pet.hall.filter((h) => h.grade === 'legendary').length + (liveRevealed && pet.grade === 'legendary' ? 1 : 0);
  const shards = GRADES.reduce((n, g) => n + view.pet.shards[g], 0);
  const tickets = GRADES.reduce((n, g) => n + view.pet.tickets[g], 0);
  const stars = book.reduce((n, r) => n + heroStars(r.copies), 0);
  const bag = view.inventory.reduce((n, st) => n + st.count, 0);
  return [
    `Your pet, and ${book.filter((r) => r.copies > 0).length} heroes in the Collection (${stars} stars, ${book.reduce((n, r) => n + r.shinies, 0)} shinies, ${legendaries} Legendaries)`,
    `${view.pet.hall.length} Hall entries`,
    `${shards} shards and ${tickets} trade-up tickets`,
    `Journal: ${view.stats.eggs_hatched} eggs hatched, ${view.stats.dives} dives, ${view.stats.days_played} days played`,
    `Divecore TD progress (wave ${view.campaign.wave_in_phase}, ${view.lifetimeWavesCleared} waves cleared), ${view.tokens} tokens, ${view.shells} shells, ${bag} items in the bag, Dive gear and Wardrobe`,
  ];
}

export function DivecoreSettingsSheet({
  open,
  onClose,
  view,
  commit,
  reduceMotion,
  onReplayTutorial,
  onOpenGuide,
}: {
  open: boolean;
  onClose: () => void;
  view: PlayView;
  commit: Commit;
  reduceMotion: boolean;
  onReplayTutorial: () => void;
  /** v26 — open the Guide (Pet → Info → Guide). */
  onOpenGuide?: () => void;
}) {
  const settings = view.settings;
  const fx = useFxQuality();
  const motion = usePlayMotionMode();
  const [permNote, setPermNote] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'idle' | 'summary' | 'confirm' | 'type'>('idle');
  const [typed, setTyped] = useState('');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!open) {
      setResetStep('idle');
      setTyped('');
      return;
    }
    let alive = true;
    void petNoticesAllowed().then((ok) => {
      if (alive) setAllowed(ok);
    });
    return () => {
      alive = false;
    };
  }, [open]);
  const anyOn = NOTIF_KINDS.some((k) => settings.notif[k]);

  const toggle = async (kind: NotifKind) => {
    const on = !settings.notif[kind];
    if (on) {
      const granted = await askPetReminderPermission();
      setAllowed(granted);
      setPermNote(granted ? null : 'Notifications are off for ATO — turn them on in your phone’s Settings to get these.');
    }
    commit((doc) => setPlaySettings(doc, { notif: { ...doc.play_settings.notif, [kind]: on } }));
  };

  const reset = () => {
    commit((doc, now) => resetDivecore(doc, now));
    void cancelPlayNotices();
    void saveSeenStageReset();
    setResetStep('idle');
    setTyped('');
    onClose();
  };

  const nextReset = nextDailyReset(Date.now());

  return (
    <PlaySheet open={open} title="Divecore settings" onClose={onClose} reduceMotion={reduceMotion}>
      <NeonLabel>Notifications</NeonLabel>
      {NOTIF_KINDS.map((kind) => (
        <NeonChip
          key={kind}
          label={`${NOTIF_LABEL[kind]} · ${settings.notif[kind] ? 'On' : 'Off'}`}
          selected={settings.notif[kind]}
          onPress={() => void toggle(kind)}
        />
      ))}
      <Text style={styles.body}>
        “Charges full” only comes after you’ve used every charge, at most once every 6 hours.
      </Text>
      {permNote ? <Text style={styles.note}>{permNote}</Text> : null}
      {anyOn && allowed === false && !permNote ? (
        <>
          <Text style={styles.note}>Notifications are off for ATO, so these can’t arrive yet.</Text>
          <NeonChip
            label="Allow notifications"
            onPress={() => {
              void askPetReminderPermission().then((ok) => {
                setAllowed(ok);
                if (!ok) setPermNote('Turn notifications on for ATO in your phone’s Settings.');
              });
            }}
          />
        </>
      ) : null}
      <WindowRow
        label="Quiet hours (no notifications — they wait until it ends)"
        value={settings.quiet}
        onChange={(w) => commit((doc) => setPlaySettings(doc, { quiet: w }))}
      />

      <NeonLabel>Your pet</NeonLabel>
      <WindowRow
        label="Bedtime (it sleeps and shows Sleepy — looks only)"
        value={settings.bedtime}
        onChange={(w) => commit((doc) => setPlaySettings(doc, { bedtime: w }))}
      />
      <Text style={styles.body}>Chatter — how often it talks on its own (tapping it always works):</Text>
      <View style={styles.chips}>
        {CHATTER_LEVELS.map((c) => (
          <NeonChip
            key={c}
            label={CHATTER_LABEL[c]}
            selected={settings.chatter === c}
            onPress={() => commit((doc) => setPlaySettings(doc, { chatter: c }))}
          />
        ))}
      </View>

      <NeonLabel>Look and feel</NeonLabel>
      <Text style={styles.body}>Effects (Low stills the auras, card shine and Dive extras on slower phones):</Text>
      <View style={styles.chips}>
        <NeonChip label="Full" selected={fx === 'full'} onPress={() => setFxQuality('full')} />
        <NeonChip label="Low" selected={fx !== 'full'} onPress={() => setFxQuality('minimal')} />
      </View>
      <NeonChip
        label={`Skip reveal animations · ${settings.skipReveals ? 'On' : 'Off'}`}
        selected={settings.skipReveals}
        onPress={() => commit((doc) => setPlaySettings(doc, { skipReveals: !doc.play_settings.skipReveals }))}
      />
      <Text style={styles.body}>Reduce motion:</Text>
      <View style={styles.chips}>
        {PLAY_MOTION_MODES.map((m) => (
          <NeonChip key={m} label={PLAY_MOTION_LABEL[m]} selected={motion === m} onPress={() => setPlayMotionMode(m)} />
        ))}
      </View>

      <NeonLabel>Daily limits</NeonLabel>
      <Text style={styles.body}>
        Mini-game tokens, the expedition and full-pay free dives reset at midnight your time — next at{' '}
        {timeOf(nextReset)} (in {inLabel(nextReset - Date.now())}).
      </Text>

      <NeonLabel>Help</NeonLabel>
      {onOpenGuide ? (
        <NeonButton
          label="Open the Guide"
          onPress={() => {
            onClose();
            onOpenGuide();
          }}
        />
      ) : null}
      <NeonButton
        label="Replay tips"
        variant="secondary"
        onPress={() => {
          onClose();
          onReplayTutorial();
        }}
      />

      <NeonLabel>Reset Divecore</NeonLabel>
      {resetStep === 'idle' ? (
        <NeonButton label="Reset Divecore progress…" variant="secondary" onPress={() => setResetStep('summary')} />
      ) : (
        <View style={styles.resetBox}>
          <Text style={styles.strong}>This deletes, for good:</Text>
          {resetSummary(view).map((line) => (
            <Text key={line} style={styles.body}>
              • {line}
            </Text>
          ))}
          <Text style={styles.body}>
            Kept: these settings, and all of your main ATO app data (profile, cards, Circle) — only Divecore is reset.
          </Text>
          {resetStep === 'summary' ? (
            <View style={styles.chips}>
              <NeonChip label="Cancel" onPress={() => setResetStep('idle')} />
              <NeonChip label="I understand — continue" onPress={() => setResetStep('confirm')} />
            </View>
          ) : resetStep === 'confirm' ? (
            <View style={styles.chips}>
              <NeonChip label="Cancel" onPress={() => setResetStep('idle')} />
              <NeonChip label="Yes, reset Divecore" onPress={() => setResetStep('type')} />
            </View>
          ) : (
            <>
              <Text style={styles.body}>Type RESET to confirm.</Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                accessibilityLabel="Type RESET to confirm"
                placeholder="RESET"
                placeholderTextColor={NEON.textMuted}
              />
              <View style={styles.chips}>
                <NeonChip
                  label="Cancel"
                  onPress={() => {
                    setResetStep('idle');
                    setTyped('');
                  }}
                />
                <NeonButton
                  label="Reset now"
                  variant="danger"
                  disabled={typed.trim() !== 'RESET'}
                  onPress={reset}
                />
              </View>
            </>
          )}
        </View>
      )}
    </PlaySheet>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  strong: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.textPrimary },
  note: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.pink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  windowRow: { gap: 6 },
  resetBox: { gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: NEON.pink },
  input: {
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: Fonts.monoBold,
    color: NEON.textPrimary,
  },
});
