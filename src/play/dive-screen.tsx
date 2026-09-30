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
 *
 * v22 (Part B): two paths per Deeper (Safer / Richer, each with its exact %),
 * the Lamp preview, the Net note, free dives, shells + the Dive-gear shop,
 * finds of every kind (gear, food, shells, cosmetics), and the "Today" card.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePacedAction } from '@/play/action-pacing';
import { itemArtSource } from '@/play/art';
import {
  DIVE_GEAR,
  DIVE_GEAR_BLURB,
  DIVE_GEAR_COST,
  DIVE_GEAR_LABEL,
  DIVE_PATHS,
  DIVE_PATH_LABEL,
  findKind,
  findName,
  type DiveGear,
  type DivePath,
} from '@/play/dive-loot';
import { DiveScene, type DiveSceneEvent } from '@/play/dive-scene';
import { formatMult, getItemDef, type ItemDef, type ItemSlot } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { PET_BRANCH_LABEL, PET_STAGE_LABEL } from '@/play/pet';
import { cosmeticById } from '@/play/pet-cosmetics';
import { PlayFrame } from '@/play/play-frame';
import { DIVE_CHARGE_CAP, buyDiveGear, type PlayView } from '@/play/playStore';
import { todayPlan } from '@/play/today-plan';
import type { PlayTransition } from '@/play/use-play-store';

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
  if (view.diveRun.active && view.diveRun.free && !pet.away) {
    return 'Free dive: your pet comes along for the fun (+2 mood on a surface, +1 on a bust) — there is nothing to rescue, and it never counts toward the Deep form.';
  }
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

export type DiveSurfaceSummary = { finds: number; shells: number };
export type DiveDeeperResult = 'bust' | 'safe' | 'changed' | null;

export function DiveScreen({
  view,
  skipDelays,
  reduceMotion,
  onSpendCharge,
  onFreeDive,
  onSurface,
  onDeeper,
  onBackToGrove,
  commit,
}: {
  view: PlayView;
  /** Dev kit only — resolve every action instantly (no beat, no cooldown). */
  skipDelays: boolean;
  reduceMotion: boolean;
  onSpendCharge: () => Promise<boolean>;
  /** v22 — a free dive (no charges left). */
  onFreeDive: () => Promise<boolean>;
  onSurface: () => Promise<DiveSurfaceSummary | null>;
  /** `shownPct` = the bust % on screen for that path when Deeper was pressed. */
  onDeeper: (path: DivePath, shownPct: number | null) => Promise<DiveDeeperResult>;
  onBackToGrove: () => void;
  /** v22 — Dive-gear purchases go straight through the store. */
  commit: (transition: PlayTransition) => boolean;
}) {
  const theme = useTheme();
  const charges = view.dive.current;
  const run = view.diveRun;
  const canSpend = !run.active && charges >= 1;
  const today = todayPlan(view);

  // -- Pacing (shared with Merge: beat → resolve → cooldown; skip in dev) ----
  const { act, busy, splashCopy, showSplash } = usePacedAction(skipDelays);

  // -- Scene events: the scene plays the rise (with the count-up) or the
  // bust pop-up once, straight from the action's own result.
  const [sceneEvent, setSceneEvent] = useState<DiveSceneEvent>(null);
  const bump = (event: Omit<NonNullable<DiveSceneEvent>, 'key'>) =>
    setSceneEvent((prev) => ({ ...event, key: (prev?.key ?? 0) + 1 }));
  const startWith = (label: string, start: () => Promise<boolean>) =>
    act(label, async () => {
      const ok = await start();
      if (ok) setSceneEvent(null);
      return ok;
    });
  const pressDeeper = (path: DivePath) => {
    const shown = run.bustPct ? run.bustPct[path] : null;
    act('Going deeper…', async () => {
      const result = await onDeeper(path, shown);
      if (result === 'bust') bump({ kind: 'bust', finds: 0, shells: 0 });
      return result != null;
    });
  };
  const pressSurface = () => {
    act('Heading up…', async () => {
      const summary = await onSurface();
      if (summary) bump({ kind: 'surface', finds: summary.finds, shells: summary.shells });
      return summary != null;
    });
  };
  const [gearNote, setGearNote] = useState<string | null>(null);
  const buyGear = (gear: DiveGear) => {
    let note = '';
    commit((doc) => {
      const res = buyDiveGear(doc, gear);
      note = res.result.ok
        ? `${DIVE_GEAR_LABEL[gear]} is yours — for good.`
        : res.result.reason === 'shells'
          ? `Not enough shells yet (${DIVE_GEAR_COST[gear]} needed).`
          : res.result.reason === 'diving'
            ? 'Finish this dive first — new gear starts on your next dive.'
            : 'Already owned.';
      return res.result.ok ? res.doc : null;
    });
    setGearNote(note);
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
        Dive for finds with your pet. Surface banks the haul — Deeper risks it for more.
      </ThemedText>

      <DiveScene
        pet={view.pet.state}
        wear={view.pet.wear}
        eggColor={ELEMENT_COLOR[view.legendElement]}
        depth={run.active ? run.deepers : 0}
        bustPct={run.active ? run.bustPctNext : null}
        away={run.petAway}
        shells={view.shells}
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
        <View style={styles.statRow}>
          <ThemedText type="smallBold">Shells</ThemedText>
          <ThemedText type="subheading" themeColor="emphasis">
            {view.shells}
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
              {run.free ? 'Free dive · ' : ''}Haul so far{' '}
              {run.deepers > 0 ? `· ${run.deepers}/${run.maxDeepers} deep` : '· first find'}
            </ThemedText>
            {run.free ? (
              <ThemedText type="small" themeColor="textSecondary">
                A free dive keeps no gear, food or cosmetics — these are sightings for the Logbook.
                Surfacing now pays {run.freeShellsNow ?? 0} shells.
              </ThemedText>
            ) : null}
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
                {run.canDeeper && run.bustPct ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Deeper adds another find to this haul — pick a path. Safer: {run.bustPct.safe}% to
                      lose it all, finds from one level up. Richer: {run.bustPct.rich}% to lose it all,
                      finds from one level down. Surface keeps every find.
                    </ThemedText>
                    {run.preview ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Lamp: Safer holds {findName(run.preview.safe)} · Richer holds{' '}
                        {findName(run.preview.rich)}.
                      </ThemedText>
                    ) : null}
                    <View style={styles.buttonRow}>
                      {DIVE_PATHS.map((path) => (
                        <Pressable
                          key={path}
                          onPress={() => pressDeeper(path)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel={`Deeper, ${DIVE_PATH_LABEL[path]}, ${run.bustPct?.[path]} percent to lose the haul`}
                          accessibilityState={{ disabled: busy }}
                          style={({ pressed }) => [
                            styles.button,
                            styles.rowButton,
                            { backgroundColor: theme.backgroundSelected },
                            pressed && !busy && styles.pressed,
                            busy && styles.disabled,
                          ]}>
                          <ThemedText type="smallBold">
                            {DIVE_PATH_LABEL[path]} · {run.bustPct?.[path]}%
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Max depth — this haul has reached its last Deeper. Surface to keep it.
                  </ThemedText>
                )}
                {run.netOn && !run.free ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Net: surfacing now adds one more find.
                  </ThemedText>
                ) : null}
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
                A dive starts with a single find in the Shallows. Each Deeper adds another and the bust
                chance climbs — 18%, 28%, 40%, 55%{view.diveGear.oxygen ? ', then 65% with Oxygen' : ''}
                — 8 points lower on the Safer path, 8 higher on the Richer one. Deeper levels hold more
                Powers, and the only rings and auras. Surface any time to keep what you have.
              </ThemedText>
              {canSpend ? (
                <Pressable
                  onPress={() => startWith('Searching…', onSpendCharge)}
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
                  onPress={() => startWith('Searching…', onFreeDive)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.backgroundSelected },
                    pressed && !busy && styles.pressed,
                    busy && styles.disabled,
                  ]}>
                  <ThemedText type="smallBold">Free dive · shells + mood</ThemedText>
                </Pressable>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {canSpend
                  ? 'Charges refill every ~10 minutes, and a Research claim can grant one too.'
                  : `No charges — a free dive keeps no gear, food or cosmetics, only shells (the first 10 a day pay full; ${view.freeDivesToday} so far) and mood.`}
              </ThemedText>
            </>
          )}
        </PlayFrame>
      )}

      <PlayFrame style={styles.card}>
        <ThemedText type="smallBold">Dive gear · bought with shells, yours for good</ThemedText>
        {DIVE_GEAR.map((gear) => {
          const owned = view.diveGear[gear];
          const cost = DIVE_GEAR_COST[gear];
          const affordable = view.shells >= cost;
          return (
            <View key={gear} style={styles.gearRow}>
              <View style={styles.findText}>
                <ThemedText type="smallBold">{DIVE_GEAR_LABEL[gear]}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {DIVE_GEAR_BLURB[gear]}
                </ThemedText>
              </View>
              {owned ? (
                <ThemedText type="smallBold" themeColor="emphasis">
                  Owned
                </ThemedText>
              ) : run.active ? (
                <ThemedText type="small" themeColor="textSecondary">
                  After this dive
                </ThemedText>
              ) : (
                <Pressable
                  onPress={() => buyGear(gear)}
                  disabled={!affordable}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !affordable }}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: affordable ? theme.accentFill : theme.backgroundSelected },
                    pressed && affordable && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={affordable ? { color: theme.onAccent } : undefined}>
                    {cost} shells
                  </ThemedText>
                </Pressable>
              )}
            </View>
          );
        })}
        {gearNote ? (
          <ThemedText type="small" themeColor="textSecondary">
            {gearNote}
          </ThemedText>
        ) : null}
      </PlayFrame>

      <PlayFrame style={styles.card}>
        <ThemedText type="smallBold">Today · one minute</ThemedText>
        {[today.td, today.pet, today.both, today.goal].map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </PlayFrame>
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

const KIND_ICONS: Record<'food' | 'shells' | 'cosmetic', ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  food: 'fish',
  shells: 'circle-multiple',
  cosmetic: 'palette',
};

/** One find in the haul: gear (icon, name, kind/rarity, Power mults), or
 * food / shells / a cosmetic (v22). */
function FindRow({ id, index }: { id: string; index: number }) {
  const theme = useTheme();
  const kind = findKind(id);
  if (kind === 'food' || kind === 'shells' || kind === 'cosmetic') {
    const cos = kind === 'cosmetic' ? cosmeticById(id) : undefined;
    const badgeArt = cos?.itemId ? itemArtSource(getItemDef(cos.itemId)?.core.art ?? '') : undefined;
    const sub =
      kind === 'food'
        ? 'Pet food · goes to the pantry'
        : kind === 'shells'
          ? 'Shells · for Dive gear'
          : `Pet cosmetic · ${cos?.slot ?? ''}`;
    return (
      <View style={styles.findRow}>
        <View style={[styles.findIcon, { backgroundColor: theme.backgroundSelected }]}>
          {badgeArt ? (
            <Image source={badgeArt} contentFit="contain" style={styles.findIconArt} />
          ) : (
            <MaterialCommunityIcons
              name={KIND_ICONS[kind]}
              size={18}
              color={cos?.color ?? (cos?.element ? ELEMENT_COLOR[cos.element] : theme.accent)}
            />
          )}
        </View>
        <View style={styles.findText}>
          <ThemedText type="smallBold">{findName(id)}</ThemedText>
          <ThemedText type="code" themeColor="textSecondary">
            {sub}
          </ThemedText>
        </View>
      </View>
    );
  }
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
  gearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
