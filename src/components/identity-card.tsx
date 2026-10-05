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
import { CORE_AXES } from '@/lib/legends64/classify';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import {
  DEFAULT_LEGEND_SKIN,
  LEGENDS64_COPY_REVIEWED,
  LEGEND_SKINS,
  NAME_STYLES_V2_COPY_REVIEWED,
  isThreeWordSkin,
  type LegendSkin,
} from '@/lib/legends64/archetypes';
import {
  SKIN_LABEL,
  identityCompleteFor,
  identityProgressLine,
  identityTitle,
  identityView,
  nextLockedPoles,
  samePoles,
  topTraitPhrases,
} from '@/lib/legends64/identity';
import {
  NAME_STYLES_FREE,
  fetchPaidStyleCount,
  loadIdentityState,
  payForStyleUnlock,
  saveIdentityState,
  type IdentityState,
} from '@/lib/legends64/identity-store';
import { STYLE_ROW_LABEL } from '@/lib/polish-copy';
import { IDENTITY_RECIPE_LABEL, IDENTITY_RECIPE_LEDE, identityRecipe } from '@/lib/shaped-by';
import { controlBorderColor } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';
import { traitShapePoints } from '@/lib/trait-shape';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';
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
  me: SharePerson & { id: string; recipe?: unknown } & Partial<Record<TraitAxis, number | null>>;
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
        const poles = nextLockedPoles(rows, stored.poles);
        const next = samePoles(poles, stored.poles) ? stored : { ...stored, poles };
        if (next !== stored) await saveIdentityState(next);
        if (cancelled) return;
        // The name just filled in, or changed: the mini guy says so, once per name.
        const before = identityView(stored.poles);
        const after = identityView(poles);
        // Only a whole name is announced (three words for a three-word style).
        // Compared by the name itself: a letter that a two-word style doesn't
        // use can lock without anything to announce.
        const wholeNow = identityCompleteFor(after, next.skin);
        const renamed = identityTitle(before, next.skin) !== identityTitle(after, next.skin);
        if (wholeNow && (!identityCompleteFor(before, next.skin) || renamed)) {
          const name = identityTitle(after, next.skin);
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
  }, [me.id, dataEpoch]);

  const view = useMemo(() => identityView(state?.poles ?? {}), [state?.poles]);
  // The three role traits, as the word for the end each one locked to
  // ("Adventurous · Structured · Connected"). Only locked ones show.
  const leanWords = useMemo(
    () =>
      CORE_AXES.flatMap((axis) => {
        const pole = state?.poles?.[axis];
        return pole ? [AXIS_POLE_NAME[axis][pole === 'H' ? 'high' : 'low']] : [];
      }),
    [state?.poles],
  );
  const traits = useMemo(() => (tracks ? topTraitPhrases(tracks) : []), [tracks]);
  const recipe = useMemo(() => identityRecipe(tracks ?? []), [tracks]);

  const update = useCallback(async (next: IdentityState) => {
    setState(next);
    await saveIdentityState(next);
  }, []);

  if (!state || !tracks) return null;

  const title = identityTitle(view, state.skin);
  const progress = identityProgressLine(view, state.skin);
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

      <ThemedText style={styles.title}>{title}</ThemedText>
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
        {LEGEND_SKINS.map((skin) => {
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
              <ThemedText type="smallBold">{identityTitle(view, skin)}</ThemedText>
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
