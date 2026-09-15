/**
 * Hero-own sheet (Slice A2) — what the player sees the first time they own a
 * boss Hero (Final band → Archangel, Scout band → Oni).
 *
 * A Hero is two things at once: a sprite set + skill kit you can fight AS, and
 * a tower you can bind. The product lock is EXCLUSIVITY — the same Hero can
 * never be the active Avatar AND a bound tower — so the one moment the player
 * owns one is the right moment to make that choice explicit. The sheet offers
 * it once, then clears the queued offer (`hero_offer` in the save) whichever
 * way the player leaves: Set as Avatar, Bind as tower, or dismiss.
 *
 * Presentational only: it renders the offer and reports the chosen action up
 * (`onSetAvatar` / `onBind` / `onDismiss`). Every rule — ownership, the bind
 * cap, the auto-unbind on Set as Avatar, the refusal when a bound hero is
 * still the Avatar — lives in `playStore`'s setters, so the sheet can never
 * disagree with the save.
 *
 * Set as Avatar takes effect in the SAVE only for now: the board still draws
 * the `unit.avatar` skin role (Corvus art) until the A3 sprite swap, so the
 * sheet says so rather than pretending the board changed.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { NEON } from '@/play/neon-viper';
import { NeonButton, NeonLabel, NeonPanel } from '@/play/neon-ui';
import type { HeroBindReason, HeroOffer, HeroSetReason } from '@/play/playStore';

/** Copy for a refused action (null result = it worked, so no message). */
const SET_AVATAR_REFUSAL: Record<HeroSetReason, string> = {
  unknown_hero: 'That Hero is not in this build.',
  not_owned: 'You do not own that Hero yet.',
};

const BIND_REFUSAL: Record<HeroBindReason, string> = {
  unknown_hero: 'That Hero is not in this build.',
  not_owned: 'You do not own that Hero yet.',
  active_avatar: 'Unequip as Avatar first — a Hero cannot be your Avatar and a tower at once.',
  cap: 'Tower slots are full — unbind a Hero first.',
};

export function HeroOwnSheet({
  offer,
  /** True when this hero is the save's active Avatar hero. */
  isActiveAvatar,
  onSetAvatar,
  onBind,
  onDismiss,
  /** Leave the sheet for the Dress Hero roster (where Hero switching lives).
   * Dismisses the offer in the same step — the choice moves to Dress. */
  onOpenDress,
}: {
  offer: HeroOffer;
  isActiveAvatar: boolean;
  onSetAvatar: () => Promise<HeroSetReason | null>;
  onBind: () => Promise<HeroBindReason | null>;
  onDismiss: () => void;
  onOpenDress: () => void;
}) {
  /** What the player just chose (null = still deciding). Holds both lines, so
   * the eyebrow can never say "bound" over an Avatar confirmation. */
  const [settled, setSettled] = useState<{ eyebrow: string; title: string; body: string } | null>(
    null,
  );
  /** Refusal / note line (null = nothing to say). */
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setAvatar = useCallback(async () => {
    setBusy(true);
    const reason = await onSetAvatar();
    setBusy(false);
    if (reason) {
      setNote(SET_AVATAR_REFUSAL[reason]);
      return;
    }
    setNote(null);
    setSettled({
      eyebrow: 'Avatar set',
      title: `${offer.label} is now your Avatar`,
      body: 'Saved. The board keeps drawing Corvus until the sprite swap lands.',
    });
  }, [offer.label, onSetAvatar]);

  const bind = useCallback(async () => {
    setBusy(true);
    const reason = await onBind();
    setBusy(false);
    if (reason) {
      setNote(BIND_REFUSAL[reason]);
      return;
    }
    setNote(null);
    setSettled({
      eyebrow: 'Hero bound',
      title: `${offer.label} is bound as a tower`,
      body: '★1, on the roster. It takes a pad once its tower def lands.',
    });
  }, [offer.label, onBind]);

  return (
    <View style={styles.backdrop}>
      <NeonPanel style={styles.sheet}>
        <NeonLabel>{settled ? settled.eyebrow : 'Hero owned'}</NeonLabel>
        <ThemedText type="subheading" style={styles.title}>
          {settled ? settled.title : `${offer.label} owned`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {settled
            ? settled.body
            : `${offer.label} joins your roster. Fight as this Hero, or bind it as a tower — not both at once.`}
        </ThemedText>
        {!settled && isActiveAvatar ? (
          <ThemedText type="code" themeColor="emphasis">
            Currently your Avatar
          </ThemedText>
        ) : null}
        {note ? (
          <ThemedText type="code" style={styles.note}>
            {note}
          </ThemedText>
        ) : null}

        {settled ? (
          <NeonButton label="Done" onPress={onDismiss} accessibilityLabel="Close hero sheet" />
        ) : (
          <>
            <NeonButton
              label="Set as Avatar"
              onPress={() => void setAvatar()}
              disabled={busy}
              accessibilityLabel={`Set ${offer.label} as your Avatar`}
            />
            <NeonButton
              label="Bind as tower"
              variant="secondary"
              onPress={() => void bind()}
              disabled={busy}
              accessibilityLabel={`Bind ${offer.label} as a tower`}
            />
            <NeonButton
              label="Open Dress"
              variant="secondary"
              onPress={onOpenDress}
              disabled={busy}
              accessibilityLabel="Open Dress to switch Heroes"
            />
            <NeonButton
              label="Later"
              variant="secondary"
              onPress={onDismiss}
              disabled={busy}
              accessibilityLabel="Dismiss for now"
            />
          </>
        )}
      </NeonPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(4, 7, 14, 0.82)',
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: NEON.panel,
  },
  title: {
    color: NEON.textPrimary,
  },
  note: {
    color: NEON.pink,
  },
});
