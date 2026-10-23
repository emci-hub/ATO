import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { InfoReveal, ShapedByList } from '@/components/info-reveal';
import { PixelFace } from '@/components/pixel-face';
import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TraitShape } from '@/components/trait-shape';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { ATO_TOKEN_NEED_MORE, ATO_TOKEN_PRICE, atoPriceLine } from '@/lib/ato-tokens';
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import { pushBuddyNote } from '@/lib/buddy/notes';
import { recipeForAccount } from '@/lib/kenney/registry';
import { CORE_AXES, MODIFIER_AXES } from '@/lib/legends64/classify';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import {
  archetypeName,
  DEFAULT_LEGEND_SKIN,
  LEGENDS64_COPY_REVIEWED,
  LEGEND_SKINS,
  NAME_STYLES_V2_COPY_REVIEWED,
  isThreeWordSkin,
  type LegendSkin,
} from '@/lib/legends64/archetypes';
import { dedupeTitles } from '@/lib/legends64/title-dedupe';
import {
  SKIN_LABEL,
  identityCompleteFor,
  identityProgressLine,
  identityTitle,
  identityView,
  legendHeadline,
  nextLockedPoles,
  samePoles,
  topTraitPhrases,
} from '@/lib/legends64/identity';
import {
  activeLegendId,
  archivedLegendForms,
  exactLegendId,
  LEGEND_GROWN_OUT_LINE,
  LEGEND_PAST_FORM_LABEL,
  LEGEND_RESTORED_LINE,
  LEGEND_SHARPER_NOTE,
  reconcileLegendForms,
} from '@/lib/legends64/legend-forms';
import {
  NAME_STYLES_FREE,
  fetchPaidStyleCount,
  fetchRemoteLegendHistory,
  loadIdentityState,
  payForStyleUnlock,
  recordLegendForm,
  saveIdentityState,
  type IdentityState,
} from '@/lib/legends64/identity-store';
import { STYLE_ROW_LABEL } from '@/lib/polish-copy';
import { IDENTITY_RECIPE_LABEL, IDENTITY_RECIPE_LEDE, identityRecipe } from '@/lib/shaped-by';
import { controlBorderColor } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';
import { traitShapePoints } from '@/lib/trait-shape';
import { confidenceSummary, type TraitTrack } from '@/lib/trait-stability';
import { traitStateFromRow, type TraitAxis } from '@/lib/traits';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

export const IDENTITY_KICKER = 'your ato';
export const IDENTITY_SHARE_LABEL = 'Share my card';
export const IDENTITY_STYLE_LABEL = 'Name style';
export const IDENTITY_STYLE_CONFIRM = `Tap again to spend ${atoPriceLine('legend_reroll')}.`;
export const IDENTITY_STYLE_ALREADY = 'One new style a day. Come back tomorrow.';
export const IDENTITY_STYLE_FAILED = 'Couldn’t unlock it just now. Try again.';
export const IDENTITY_LOCKED_TITLE = 'Your name locked in';
export const IDENTITY_STYLE_UNLOCKED_TITLE = 'New name style';
export const IDENTITY_STYLE_CREDIT = 'You already paid for a style. Pick one, no charge.';

/**
 * The permanent, shareable half of the content loop: who you are in two or three words,
 * three phrases under it, and an image to send. No model call anywhere.
 */
export function IdentityCard({
  me,
  onUpdated,
}: {
  me: SharePerson & { id: string; recipe?: unknown; trait_sources?: unknown } & Partial<Record<TraitAxis, number | null>>;
  onUpdated?: () => void | Promise<void>;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [stylesOpen, setStylesOpen] = useState(false);
  const faceRecipe = useMemo(() => recipeForAccount(me.id, me.recipe), [me.id, me.recipe]);
  const dataEpoch = useAccountDataEpoch();
  const [tracks, setTracks] = useState<TraitTrack[] | null>(null);
  const [state, setState] = useState<IdentityState | null>(null);
  const [paidCount, setPaidCount] = useState(0);
  const [confirming, setConfirming] = useState<LegendSkin | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTraitTracks(me.id), loadIdentityState(me.id)])
      .then(async ([rows, stored]) => {
        if (cancelled) return;
        const sources = traitStateFromRow({ trait_sources: me.trait_sources }).sources;
        const now = new Date();
        const localMigrated = stored.legendHistory.migrated;
        // Another phone may already have archived the old name. Don't do it again.
        const remote = localMigrated ? null : await fetchRemoteLegendHistory();
        if (cancelled) return;
        const history = remote?.migrated ? remote : stored.legendHistory;
        // The scoring migration classifies once with no previous letter.
        // After that, hysteresis holds a letter until it clearly crosses.
        const poles = nextLockedPoles(rows, localMigrated ? stored.poles : {}, now, sources);
        const reconciled = reconcileLegendForms({
          history,
          previousPoles: stored.poles,
          nextPoles: poles,
          nowIso: now.toISOString(),
        });
        const headline = legendHeadline(rows, poles, stored.skin, stored.pickedCode, sources);
        // The pick is a display choice. It is not passed to the history.
        const pickedStillFits =
          !stored.pickedCode || headline.choices.some((choice) => choice.code === stored.pickedCode) || headline.kind === 'exact';
        const pickedCode = pickedStillFits ? stored.pickedCode : null;
        const active = activeLegendId(reconciled.history);
        const reveal =
          reconciled.event?.kind === 'restored'
            ? { kind: 'restored' as const, legendId: reconciled.event.legendId }
            : stored.reveal?.legendId === active
              ? stored.reveal
              : null;
        const next: IdentityState = {
          ...stored,
          poles,
          pickedCode,
          legendHistory: reconciled.history,
          reveal,
        };
        const changed =
          !samePoles(poles, stored.poles) ||
          pickedCode !== (stored.pickedCode ?? null) ||
          !localMigrated ||
          remote?.migrated === true ||
          JSON.stringify(reconciled.history) !== JSON.stringify(stored.legendHistory) ||
          JSON.stringify(reveal) !== JSON.stringify(stored.reveal);
        if (changed) await saveIdentityState(next);
        if (!localMigrated) {
          const archive = reconciled.event?.kind === 'sharper' ? reconciled.event.legendId : null;
          await recordLegendForm(exactLegendId(poles), remote?.migrated ? null : archive);
        } else {
          const current = exactLegendId(poles);
          if (current && current !== exactLegendId(stored.poles)) await recordLegendForm(current, null);
        }
        if (cancelled) return;
        // The name just filled in, or changed: the mini guy says so, once per name.
        // A scoring migration and a restore have their own lines on the card.
        const before = identityView(stored.poles);
        const after = identityView(poles);
        const wholeNow = identityCompleteFor(after, next.skin);
        const renamed = identityTitle(before, next.skin) !== identityTitle(after, next.skin);
        if (
          reconciled.event?.kind !== 'sharper' &&
          reconciled.event?.kind !== 'restored' &&
          wholeNow &&
          (!identityCompleteFor(before, next.skin) || renamed)
        ) {
          const name = legendHeadline(rows, poles, next.skin, pickedCode, sources).title;
          pushBuddyNote({ id: `identity:${name}`, title: IDENTITY_LOCKED_TITLE, body: name, loud: true });
        }
        setTracks(rows);
        setState(next);
      })
      .catch((err) => {
        console.log('[identity] load error:', err);
      });
    fetchPaidStyleCount()
      .then((count) => {
        if (!cancelled) setPaidCount(count);
      })
      .catch((err) => {
        console.log('[identity] paid style count error:', err);
      });
    return () => {
      cancelled = true;
    };
    // dataEpoch: a dev jump rewrote the account under this tab.
  }, [me.id, me.trait_sources, dataEpoch]);

  const sources = useMemo(
    () => traitStateFromRow({ trait_sources: me.trait_sources }).sources,
    [me.trait_sources],
  );
  const view = useMemo(() => identityView(state?.poles ?? {}), [state?.poles]);
  // The three role traits, as the word for the end each one locked to
  // ("Adventurous · Structured · Connected"). Only a real high or low shows.
  const leanWords = useMemo(
    () =>
      CORE_AXES.flatMap((axis) => {
        const pole = state?.poles?.[axis];
        if (pole !== 'H' && pole !== 'L') return [];
        return [AXIS_POLE_NAME[axis][pole === 'H' ? 'high' : 'low']];
      }),
    [state?.poles],
  );
  const traits = useMemo(() => (tracks ? topTraitPhrases(tracks) : []), [tracks]);
  const recipe = useMemo(() => identityRecipe(tracks ?? [], sources), [tracks, sources]);
  const styleOptions = useMemo(
    () =>
      dedupeTitles(
        LEGEND_SKINS.map((skin) => ({
          skin,
          title: tracks
            ? legendHeadline(tracks, state?.poles ?? {}, skin, state?.pickedCode, sources).title
            : identityTitle(view, skin),
        })),
      ),
    [tracks, state?.poles, state?.pickedCode, sources, view],
  );

  const update = useCallback(async (next: IdentityState) => {
    setState(next);
    await saveIdentityState(next);
  }, []);

  if (!state || !tracks) return null;

  const headline = legendHeadline(tracks, state.poles, state.skin, state.pickedCode, sources);
  const title = headline.title;
  const progress = headline.kind === 'balanced' || headline.kind === 'choice' ? null : identityProgressLine(view, state.skin);
  const confidence = confidenceSummary(tracks, [...CORE_AXES, ...MODIFIER_AXES]);
  const credits = Math.max(0, paidCount - state.unlocked.length);
  const border = controlBorderColor(theme);

  async function pickStyle(skin: LegendSkin) {
    if (!state || busy) return;
    setNote(null);
    const owned = NAME_STYLES_FREE || skin === DEFAULT_LEGEND_SKIN || state.unlocked.includes(skin);
    if (owned) {
      setConfirming(null);
      await update({ ...state, skin });
      return;
    }
    if (credits > 0) {
      await update({ ...state, skin, unlocked: [...state.unlocked, skin] });
      return;
    }
    if (confirming !== skin) {
      setConfirming(skin);
      setNote(IDENTITY_STYLE_CONFIRM);
      return;
    }
    setConfirming(null);
    setBusy(true);
    const outcome = await payForStyleUnlock();
    if (outcome === 'unlocked') {
      setPaidCount((n) => n + 1);
      await update({ ...state, skin, unlocked: [...state.unlocked, skin] });
      pushBuddyNote({
        id: `style:${skin}`,
        title: IDENTITY_STYLE_UNLOCKED_TITLE,
        body: `${SKIN_LABEL[skin]}: ${identityTitle(view, skin)}`,
        loud: true,
      });
      void onUpdated?.(); // refresh the token balance
    } else if (outcome === 'not_enough') {
      setNote(ATO_TOKEN_NEED_MORE);
    } else if (outcome === 'already_today') {
      setNote(IDENTITY_STYLE_ALREADY);
    } else {
      setNote(IDENTITY_STYLE_FAILED);
    }
    setBusy(false);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {/* The hero band: your shape as the emblem, the mini guy beside it. */}
      <View
        style={[
          styles.band,
          {
            borderTopLeftRadius: theme.cutCorners ? 0 : theme.radius,
            borderTopRightRadius: theme.cutCorners ? 0 : theme.radius,
          },
        ]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="identityBand" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={theme.accentSecondary} stopOpacity={0.18} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#identityBand)" />
        </Svg>
        <View style={styles.bandFace}>
          <PixelFace recipe={faceRecipe} size={40} showUp={me.show_up} animated={!reduceMotion} />
        </View>
      </View>
      <View
        style={[
          styles.emblem,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            borderRadius: theme.cutCorners ? 0 : 999,
          },
        ]}>
        <TraitShape points={traitShapePoints(me, tracks)} size={60} animate={!reduceMotion} />
      </View>
      <View style={styles.body}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {IDENTITY_KICKER}
      </ThemedText>
      {!(LEGENDS64_COPY_REVIEWED && NAME_STYLES_V2_COPY_REVIEWED) && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}

      <ThemedText style={styles.title} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
        {title}
      </ThemedText>
      {headline.flavour ? (
        <ThemedText type="small" themeColor="textSecondary">
          {headline.flavour}
        </ThemedText>
      ) : null}
      {confidence ? (
        <ThemedText type="code" themeColor="textSecondary">
          {confidence}
        </ThemedText>
      ) : null}
      {state.reveal?.kind === 'restored' ? (
        <ThemedText type="small">{LEGEND_RESTORED_LINE}</ThemedText>
      ) : null}
      {archivedLegendForms(state.legendHistory).length > 0 ? (
        <View style={styles.past}>
          <ThemedText type="code" themeColor="textSecondary">
            {LEGEND_SHARPER_NOTE}
          </ThemedText>
          <ThemedText type="smallBold">{LEGEND_PAST_FORM_LABEL}</ThemedText>
          {archivedLegendForms(state.legendHistory).map((form) => (
            <ThemedText key={form.legendId} type="small" themeColor="textSecondary">
              {archetypeName(form.legendId, state.skin) ?? form.legendId}. {LEGEND_GROWN_OUT_LINE}
            </ThemedText>
          ))}
        </View>
      ) : null}
      {headline.choices.length >= 2 && headline.kind !== 'exact' ? (
        <View style={styles.styles}>
          {headline.choices.map((choice) => {
            const selected = state.pickedCode === choice.code;
            return (
              <ThemedPressable
                key={choice.code}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={choice.title}
                onPress={() => {
                  // Display only. The tap is not a collected legend.
                  void update({ ...state, pickedCode: selected ? null : choice.code });
                }}
                style={[
                  styles.choice,
                  {
                    borderColor: selected ? theme.accent : border,
                    borderRadius: theme.cutCorners ? 0 : theme.radius,
                  },
                ]}>
                <ThemedText type="smallBold">{choice.title}</ThemedText>
              </ThemedPressable>
            );
          })}
        </View>
      ) : null}
      {progress ? (
        <ThemedText type="small" themeColor="textSecondary">
          {progress}
        </ThemedText>
      ) : null}

      {leanWords.length > 0 ? (
        <View style={styles.styles}>
          {leanWords.map((word) => (
            <View
              key={word}
              style={[styles.leanChip, { borderColor: border, borderRadius: theme.cutCorners ? 0 : 999 }]}>
              <ThemedText type="smallBold">{word}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {/* Which traits make the name, and which are still forming. One tap away. */}
      <InfoReveal label={IDENTITY_RECIPE_LABEL}>
        {traits.length > 0 ? (
          <View style={styles.traits}>
            {traits.map((trait) => (
              <ThemedText key={trait} type="small" themeColor="textSecondary">
                {trait}
              </ThemedText>
            ))}
          </View>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {IDENTITY_RECIPE_LEDE}
        </ThemedText>
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          describing word
        </ThemedText>
        <ShapedByList rows={recipe.first} />
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          role
        </ThemedText>
        <ShapedByList rows={recipe.second} />
        {isThreeWordSkin(state.skin) ? (
          <>
            <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
              extra word
            </ThemedText>
            <ShapedByList rows={recipe.third} />
          </>
        ) : null}
      </InfoReveal>

      <View style={styles.styleRow}>
        <ThemedPressable
          accessibilityRole="button"
          accessibilityLabel={`${IDENTITY_STYLE_LABEL}: ${SKIN_LABEL[state.skin]}`}
          onPress={() => setStylesOpen(true)}
          hitSlop={6}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {STYLE_ROW_LABEL}: {SKIN_LABEL[state.skin]} ›
          </ThemedText>
        </ThemedPressable>
        {identityCompleteFor(view, state.skin) ? (
          <ThemedPressable
            filled
            accessibilityRole="button"
            accessibilityLabel={IDENTITY_SHARE_LABEL}
            onPress={() => setSharing(true)}
            style={[styles.share, { borderRadius: theme.cutCorners ? 0 : 999 }]}>
            <ThemedText type="smallBold" themeColor="onAccent">
              {IDENTITY_SHARE_LABEL}
            </ThemedText>
          </ThemedPressable>
        ) : null}
      </View>
      </View>

      {/* Name styles in a sheet: each chip shows your name in that style. */}
      <Modal visible={stylesOpen} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setStylesOpen(false)}>
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setStylesOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <ThemedView
          type="backgroundElement"
          style={[
            styles.sheet,
            {
              borderTopLeftRadius: theme.cutCorners ? 0 : Spacing.four,
              borderTopRightRadius: theme.cutCorners ? 0 : Spacing.four,
            },
          ]}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {IDENTITY_STYLE_LABEL}
      </ThemedText>
      {/* Nine styles: the list scrolls on a small phone. */}
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
        {styleOptions.map(({ skin, title: styleTitle }) => {
          const owned = NAME_STYLES_FREE || skin === DEFAULT_LEGEND_SKIN || state.unlocked.includes(skin);
          const on = state.skin === skin;
          return (
            <Pressable
              key={skin}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: busy }}
              accessibilityLabel={
                owned ? `${SKIN_LABEL[skin]} name style` : `${SKIN_LABEL[skin]} name style, locked`
              }
              disabled={busy}
              onPress={() => {
                void pickStyle(skin);
              }}
              style={({ pressed }) => [
                styles.chip,
                styles.sheetChip,
                { borderColor: on ? theme.accent : border },
                on && { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="code" themeColor="textSecondary">
                {owned ? SKIN_LABEL[skin] : `${SKIN_LABEL[skin]} · ${ATO_TOKEN_PRICE.legend_reroll}`}
              </ThemedText>
              <ThemedText type="smallBold">{styleTitle}</ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {credits > 0 && !NAME_STYLES_FREE ? (
        <ThemedText type="small" themeColor="textSecondary">
          {IDENTITY_STYLE_CREDIT}
        </ThemedText>
      ) : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}

      <ThemedPressable
        accessibilityRole="button"
        onPress={() => setStylesOpen(false)}
        style={[styles.sheetDone, { borderColor: border, borderRadius: theme.cutCorners ? 0 : 999 }]}>
        <ThemedText type="smallBold">Done</ThemedText>
      </ThemedPressable>
        </ThemedView>
      </Modal>

      <ShareCardSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        me={me}
        content={{ kind: 'identity', title, traits, shape: traitShapePoints(me, tracks) }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: 0,
  },
  band: {
    height: 78,
    overflow: 'hidden',
  },
  emblem: {
    position: 'absolute',
    left: Spacing.four,
    top: 42,
    zIndex: 1,
    width: 72,
    height: 72,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandFace: {
    position: 'absolute',
    right: Spacing.four,
    top: Spacing.three,
  },
  body: {
    padding: Spacing.four,
    paddingTop: 36 + Spacing.two,
    gap: Spacing.two,
  },
  leanChip: {
    borderWidth: 1,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  choice: {
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  sheetScroll: {
    maxHeight: 440,
  },
  sheetList: {
    gap: Spacing.two,
  },
  sheetChip: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  sheetDone: {
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  past: {
    gap: Spacing.half,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
  },
  traits: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  styles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  share: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
