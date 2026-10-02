import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InfoReveal, ShapedByList } from '@/components/info-reveal';
import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { ATO_TOKEN_NEED_MORE, ATO_TOKEN_PRICE, atoPriceLine } from '@/lib/ato-tokens';
import { pushBuddyNote } from '@/lib/buddy/notes';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import {
  DEFAULT_LEGEND_SKIN,
  LEGENDS64_COPY_REVIEWED,
  LEGEND_SKINS,
  type LegendSkin,
} from '@/lib/legends64/archetypes';
import {
  SKIN_LABEL,
  identityProgressLine,
  identityTitle,
  identityView,
  nextLockedPoles,
  samePoles,
  topTraitPhrases,
} from '@/lib/legends64/identity';
import {
  fetchPaidStyleCount,
  loadIdentityState,
  payForStyleUnlock,
  saveIdentityState,
  type IdentityState,
} from '@/lib/legends64/identity-store';
import { IDENTITY_RECIPE_LABEL, IDENTITY_RECIPE_LEDE, identityRecipe } from '@/lib/shaped-by';
import { controlBorderColor } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';
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
 * The permanent, shareable half of the content loop: who you are in two words,
 * three phrases under it, and an image to send. No model call anywhere.
 */
export function IdentityCard({
  me,
  onUpdated,
}: {
  me: SharePerson & { id: string };
  onUpdated?: () => void | Promise<void>;
}) {
  const theme = useTheme();
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
        if (after.complete && (!before.complete || !samePoles(poles, stored.poles))) {
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
  const traits = useMemo(() => (tracks ? topTraitPhrases(tracks) : []), [tracks]);
  const recipe = useMemo(() => identityRecipe(tracks ?? []), [tracks]);

  const update = useCallback(async (next: IdentityState) => {
    setState(next);
    await saveIdentityState(next);
  }, []);

  if (!state || !tracks) return null;

  const title = identityTitle(view, state.skin);
  const progress = identityProgressLine(view);
  const credits = Math.max(0, paidCount - state.unlocked.length);
  const border = controlBorderColor(theme);

  async function pickStyle(skin: LegendSkin) {
    if (!state || busy) return;
    setNote(null);
    const owned = skin === DEFAULT_LEGEND_SKIN || state.unlocked.includes(skin);
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
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {IDENTITY_KICKER}
      </ThemedText>
      {!LEGENDS64_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
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

      {traits.length > 0 ? (
        <View style={styles.traits}>
          {traits.map((trait) => (
            <ThemedText key={trait} themeColor="textSecondary">
              {trait}
            </ThemedText>
          ))}
        </View>
      ) : null}

      {/* Which traits make the name, and which are still forming. One tap away. */}
      <InfoReveal label={IDENTITY_RECIPE_LABEL}>
        <ThemedText type="small" themeColor="textSecondary">
          {IDENTITY_RECIPE_LEDE}
        </ThemedText>
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          first word
        </ThemedText>
        <ShapedByList rows={recipe.first} />
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          second word
        </ThemedText>
        <ShapedByList rows={recipe.second} />
      </InfoReveal>

      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {IDENTITY_STYLE_LABEL}
      </ThemedText>
      <View style={styles.styles}>
        {LEGEND_SKINS.map((skin) => {
          const owned = skin === DEFAULT_LEGEND_SKIN || state.unlocked.includes(skin);
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
                { borderColor: border },
                on && { backgroundColor: theme.text },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={on ? { color: theme.background } : undefined}>
                {owned ? SKIN_LABEL[skin] : `${SKIN_LABEL[skin]} · ${ATO_TOKEN_PRICE.legend_reroll}`}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {credits > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {IDENTITY_STYLE_CREDIT}
        </ThemedText>
      ) : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}

      {view.complete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={IDENTITY_SHARE_LABEL}
          onPress={() => setSharing(true)}
          style={({ pressed }) => [styles.share, { borderColor: border }, pressed && styles.pressed]}>
          <ThemedText type="smallBold">{IDENTITY_SHARE_LABEL}</ThemedText>
        </Pressable>
      ) : null}

      <ShareCardSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        me={me}
        content={{ kind: 'identity', title, traits }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
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
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
