/**
 * Dive — push-your-luck (Play step 3, GAME_SPEC §7, §11 screen 2).
 *
 * Renders the whole Dive decision surface off `view.diveRun`:
 * - no run → "Dive · 1 charge" CTA (disabled at 0 charges with an honest note);
 * - run active → the haul as find cards + a "next move" card showing the exact
 *   effective bust % of the next Deeper (§7, already bent by equipped
 *   dive_luck, never hidden) with Surface and Deeper buttons.
 *
 * All mutations go through the callbacks (which live in `play.tsx` and commit
 * through the shared playStore), so this stays a read-only view of store
 * truth. Dive actions are paced against mash via `usePacedAction` — a short
 * "searching…" beat locks the buttons before the result lands, then a cooldown
 * still holds them; the Dev kit's "Skip Dive delays" toggle makes it instant.
 *
 * Copy never uses gamble / casino / jackpot / bet — Dive / Surface / Deeper /
 * bust only (GAME_SPEC §7).
 *
 * v21: a scene (`dive-scene.tsx`) above the cards shows the pet diving; it
 * only reads the shown %, never changes it. Deeper sends the % on screen so
 * the store can refuse a roll whose real odds moved in the meantime.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePacedAction } from '@/play/action-pacing';
import { itemArtSource } from '@/play/art';
import { DiveScene, type DiveSceneEvent } from '@/play/dive-scene';
import { formatMult, getItemDef, type ItemDef, type ItemSlot } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { PET_BRANCH_LABEL, PET_STAGE_LABEL } from '@/play/pet';
import { PlayFrame } from '@/play/play-frame';
import { DIVE_CHARGE_CAP, DIVE_DEEPER_MAX, type PlayView } from '@/play/playStore';

const SLOT_ICONS: Record<ItemSlot, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  weapon: 'sword',
  armor: 'shield-outline',
  cloak: 'hanger',
  trinket: 'star-four-points',
};

/** The pet dive buddy, in one honest line (v20; away + Dive care in v21). */
export function diveBuddyLine(view: PlayView): string {
  const pet = view.pet;
  const st = pet.state;
  if (pet.away) {
    return 'Dive buddy: away on expedition — no bust cut or rescue until it’s back, and these dives don’t count as its care.';
  }
  const form =
    st.stage === 'egg' || st.stage === 'baby'
      ? PET_STAGE_LABEL[st.stage]
      : `${PET_STAGE_LABEL[st.stage]} · ${PET_BRANCH_LABEL[st.branch]}`;
  if (st.stage === 'egg') {
    return `Dive buddy: your pet (${form}) — once it hatches, surfacing gives it +2 mood; from Teen it lowers every bust chance.`;
  }
  const care = 'Surfacing gives it +2 mood, a bust +1.';
  if (pet.bustCutPp <= 0) {
    return `Dive buddy: your pet (${form}). ${care} From Teen it lowers every bust chance.`;
  }
  const rescue =
    pet.rescueKeep > 0
      ? ` · on a bust it saves your best ${pet.rescueKeep === 1 ? 'find' : `${pet.rescueKeep} finds`}`
      : ' · from Adult it saves your best find on a bust';
  const points = `${pet.bustCutPp} ${pet.bustCutPp === 1 ? 'point' : 'points'}`;
  return `Dive buddy: your pet (${form}) · ${points} off every bust chance (already in the odds; never below half the table)${rescue}. ${care} It is never lost.`;
}

export function DiveScreen({
  view,
  skipDelays,
  reduceMotion,
  onSpendCharge,
  onSurface,
  onDeeper,
  onBackToGrove,
}: {
  view: PlayView;
  /** Dev kit only — resolve every action instantly (no beat, no cooldown). */
  skipDelays: boolean;
  reduceMotion: boolean;
  onSpendCharge: () => Promise<boolean>;
  onSurface: () => Promise<boolean>;
  /** `shownPct` = the bust % on screen when Deeper was pressed. */
  onDeeper: (shownPct: number | null) => Promise<boolean>;
  onBackToGrove: () => void;
}) {
  const theme = useTheme();
  const charges = view.dive.current;
  const run = view.diveRun;
  const canSpend = !run.active && charges >= 1;

  // -- Pacing (shared with Merge: beat → resolve → cooldown; skip in dev) ----
  const { act, busy, splashCopy, showSplash } = usePacedAction(skipDelays);

  // -- Scene events (v21): a run that ends after a Deeper press busted; after
  // a Surface press it was banked. The scene plays the pop-up / rise once.
  const lastPressRef = useRef<'deeper' | 'surface' | null>(null);
  const wasActiveRef = useRef(run.active);
  const [sceneEvent, setSceneEvent] = useState<DiveSceneEvent>(null);
  useEffect(() => {
    if (wasActiveRef.current && !run.active && lastPressRef.current) {
      const kind = lastPressRef.current === 'deeper' ? 'bust' : 'surface';
      setSceneEvent((prev) => ({ kind, key: (prev?.key ?? 0) + 1 }));
    }
    if (!wasActiveRef.current && run.active) setSceneEvent(null);
    wasActiveRef.current = run.active;
  }, [run.active]);
  const pressDeeper = () => {
    const shown = run.bustPctNext;
    lastPressRef.current = 'deeper';
    act('Going deeper…', () => onDeeper(shown));
  };
  const pressSurface = () => {
    lastPressRef.current = 'surface';
    act('Heading up…', onSurface);
  };

  return (
    <>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBackToGrove}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ‹ Divecore
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText type="subtitle">Dive</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        Push your luck for finds. Surface banks the haul — Deeper risks it.
      </ThemedText>

      <DiveScene
        pet={view.pet.state}
        eggColor={ELEMENT_COLOR[view.legendElement]}
        depth={run.active ? run.deepers : 0}
        bustPct={run.active ? run.bustPctNext : null}
        away={run.petAway}
        event={sceneEvent}
        reduceMotion={reduceMotion}
      />

      <PlayFrame style={styles.card}>
        <View style={styles.statRow}>
          <ThemedText type="smallBold">Dive charges</ThemedText>
          <ThemedText type="subheading" themeColor="emphasis">
            {chargeText(view)}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {diveBuddyLine(view)}
        </ThemedText>
      </PlayFrame>

      {run.active ? (
        <>
          <PlayFrame style={styles.card}>
            <ThemedText type="smallBold">
              Haul so far {run.deepers > 0 ? `· ${run.deepers}/${DIVE_DEEPER_MAX} deep` : '· first find'}
            </ThemedText>
            {run.haul.map((id, index) => (
              <FindRow key={`${id}-${index}`} id={id} index={index} />
            ))}
          </PlayFrame>

          <PlayFrame style={styles.card}>
            {showSplash ? (
              <SplashRow label={splashCopy ?? 'Searching…'} showSpinner={!reduceMotion} />
            ) : (
              <>
                <ThemedText type="smallBold">Next move</ThemedText>
                {run.canDeeper && run.bustPctNext != null ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Deeper adds another find to this haul — {run.bustPctNext}% to lose it all.
                      Surface keeps every find and banks it to your bag.
                    </ThemedText>
                    <View style={styles.buttonRow}>
                      <Pressable
                        onPress={pressDeeper}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: busy }}
                        style={({ pressed }) => [
                          styles.button,
                          styles.rowButton,
                          { backgroundColor: theme.backgroundSelected },
                          pressed && !busy && styles.pressed,
                          busy && styles.disabled,
                        ]}>
                        <ThemedText type="smallBold">Deeper</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={pressSurface}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: busy }}
                        style={({ pressed }) => [
                          styles.button,
                          styles.rowButtonPrimary,
                          { backgroundColor: theme.accentFill },
                          pressed && !busy && styles.pressed,
                          busy && styles.disabled,
                        ]}>
                        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                          Surface
                        </ThemedText>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Max depth — this haul has reached its last Deeper. Surface to keep it.
                    </ThemedText>
                    <Pressable
                      onPress={pressSurface}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy }}
                      style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: theme.accentFill },
                        pressed && !busy && styles.pressed,
                        busy && styles.disabled,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                        Surface
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </PlayFrame>
        </>
      ) : (
        <PlayFrame style={styles.card}>
          {showSplash ? (
            <SplashRow label={splashCopy ?? 'Searching…'} showSpinner={!reduceMotion} />
          ) : (
            <>
              <ThemedText type="smallBold">One charge, one find</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                A dive starts with a single find. Each Deeper adds another, and the
                bust chance climbs with it — 18%, then 28%, 40%, up to 55%. Surface
                any time to keep what you have.
              </ThemedText>
              {canSpend ? (
                <Pressable
                  onPress={() => act('Searching…', onSpendCharge)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.accentFill },
                    pressed && !busy && styles.pressed,
                    busy && styles.disabled,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                    Dive · 1 charge
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  disabled
                  accessibilityRole="button"
                  accessibilityState={{ disabled: true }}
                  style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    No dive charges
                  </ThemedText>
                </Pressable>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                Charges refill every ~10 minutes, and a Research claim can grant one too.
              </ThemedText>
            </>
          )}
        </PlayFrame>
      )}
    </>
  );
}

/** Small "searching…" beat row — spinner when motion is fine, copy alone when not. */
function SplashRow({ label, showSpinner }: { label: string; showSpinner: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.splashRow}>
      {showSpinner ? <ActivityIndicator size="small" color={theme.accent} /> : null}
      <ThemedText type="smallBold">{label}</ThemedText>
    </View>
  );
}

/** One find in the haul: icon, name, kind/rarity, and Power mult lines. */
function FindRow({ id, index }: { id: string; index: number }) {
  const theme = useTheme();
  const def = getItemDef(id);
  if (!def) {
    return (
      <View style={styles.findRow}>
        <ThemedText type="code" themeColor="textSecondary">
          #{index + 1}
        </ThemedText>
        <View style={styles.findText}>
          <ThemedText type="smallBold">Unknown find</ThemedText>
        </View>
      </View>
    );
  }
  const mults = [def.mult_a, def.mult_b].filter(
    (mult): mult is NonNullable<ItemDef['mult_a']> => mult != null,
  );
  return (
    <View style={styles.findRow}>
      <View style={[styles.findIcon, { backgroundColor: theme.backgroundSelected }]}>
        {itemArtSource(def.core.art) ? (
          <Image source={itemArtSource(def.core.art)} contentFit="contain" style={styles.findIconArt} />
        ) : (
          <MaterialCommunityIcons name={SLOT_ICONS[def.core.slot]} size={18} color={theme.accent} />
        )}
      </View>
      <View style={styles.findText}>
        <ThemedText type="smallBold">{def.core.name}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {capitalize(def.core.rarity)} {capitalize(def.core.kind)}
          {mults.length > 0 ? ` · ${mults.map(formatMult).join(' · ')}` : ''}
        </ThemedText>
      </View>
    </View>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** "7/10" or "7/10 · +1 ~12m" — same charge line the Grove row shows. */
function chargeText(view: PlayView): string {
  const dive = view.dive;
  const base = `${dive.current}/${DIVE_CHARGE_CAP}`;
  if (dive.full || dive.nextChargeAt == null) return base;
  const minutes = Math.max(1, Math.ceil((dive.nextChargeAt - Date.now()) / 60_000));
  return `${base} · +1 ~${minutes}m`;
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lede: {
    marginTop: -Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  findRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  findIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findIconArt: {
    width: 22,
    height: 22,
  },
  findText: {
    flex: 1,
    gap: Spacing.half,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowButton: {
    flex: 1,
  },
  rowButtonPrimary: {
    flex: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  splashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
