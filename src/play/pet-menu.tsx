/**
 * Pet ⋯ menu (v24, 2026-09-30) — everything you do TO the pet, in one place:
 *
 *   View card · Name your pet (12 characters, a small word filter) · Change
 *   egg (only while it's still an egg — double confirm, back to the picker,
 *   the next egg gets a fresh seed; nothing from the old seed was ever rolled
 *   or shown, and a spent ticket is refunded) · Use a trade-up ticket (Egg or
 *   Baby, before the roll) · Release (Child+) / Rebirth (God), same rules and
 *   double confirms as before. v27: Open the Den · Use a Shine Stone.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { ReleasePanel } from '@/play/pet-egg-sheets';
import { GRADES, gradeTag, petShownName, type Grade } from '@/play/pet-eggs';
import { PET_NAME_MAX, checkPetName } from '@/play/play-settings';
import { applyTicketDoc, changeEggDoc, rebirthPetDoc, renamePetDoc, type PlayView } from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

type Commit = (transition: PlayTransition) => boolean;

const ARM_LAPSE_MS = 3500;

export function useArm(): [boolean, () => boolean, () => void] {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), ARM_LAPSE_MS);
    return () => clearTimeout(id);
  }, [armed]);
  /** First press arms (false); the second, within 3.5s, confirms (true). */
  const press = () => {
    if (!armed) {
      setArmed(true);
      return false;
    }
    setArmed(false);
    return true;
  };
  return [armed, press, () => setArmed(false)];
}

const NAME_REASON = {
  empty: 'Type a name first.',
  long: `Up to ${PET_NAME_MAX} characters.`,
  chars: 'Letters, numbers, spaces, - and ’ only.',
  word: 'Let’s pick a different name.',
} as const;

export function PetMenuBody({
  view,
  commit,
  onViewCard,
  onOpenDen,
  onOpenStone,
  onOpenPrism,
}: {
  view: PlayView;
  commit: Commit;
  onViewCard: () => void;
  /** v27 — the Den (every pet you keep). */
  onOpenDen: () => void;
  /** v27 — the Shine Stone sheet, this pet picked. */
  onOpenStone: () => void;
  /** v28 — the Prism Stone sheet, this pet picked. */
  onOpenPrism: () => void;
}) {
  const pv = view.pet;
  const pet = pv.state;
  const revealed = pet.hero != null && pet.stage !== 'egg' && pet.stage !== 'baby';
  const [draft, setDraft] = useState(pet.name ?? '');
  const [nameNote, setNameNote] = useState<string | null>(null);
  useEffect(() => {
    setDraft(pet.name ?? '');
  }, [pet.name, pet.egg]);
  const [changeArmed, pressChange] = useArm();
  const [rebirthArmed, pressRebirth] = useArm();

  const saveName = () => {
    const checked = checkPetName(draft);
    if (!checked.ok) {
      setNameNote(NAME_REASON[checked.reason]);
      return;
    }
    const ok = commit((doc, now) => renamePetDoc(doc, now, checked.name));
    setNameNote(ok ? `Say hi to ${checked.name}!` : 'Pick an egg first.');
  };

  const tickets = GRADES.filter((g): g is Exclude<Grade, 'common'> => g !== 'common' && pv.tickets[g] > 0);
  const canTicket = pet.egg != null && pet.hero == null && pet.ticket == null && (pet.stage === 'egg' || pet.stage === 'baby');

  return (
    <>
      {revealed ? <NeonButton label="View card" onPress={onViewCard} /> : null}
      <NeonButton label={`Open the Den · ${pv.den.used}/${pv.den.slots}`} variant="secondary" onPress={onOpenDen} />
      {revealed && !pet.shiny ? (
        <NeonButton label={`Use a Shine Stone · ${pv.stones.held} held`} variant="secondary" onPress={onOpenStone} />
      ) : null}
      {revealed && !pet.shiny ? (
        <NeonButton label={`Use a Prism Stone · ${pv.stones.prism} held`} variant="secondary" onPress={onOpenPrism} />
      ) : null}

      {pet.egg != null || pet.hero != null ? (
        <>
          <NeonLabel>Name</NeonLabel>
          <Text style={styles.body}>
            Now: {petShownName(pet)}. Up to {PET_NAME_MAX} characters — shown on its card, in the Hall, its bubbles and
            notifications.
          </Text>
          <TextInput
            value={draft}
            onChangeText={(t) => {
              setDraft(t.slice(0, PET_NAME_MAX + 4));
              setNameNote(null);
            }}
            maxLength={PET_NAME_MAX}
            placeholder={petShownName({ ...pet, name: null })}
            placeholderTextColor={NEON.textMuted}
            style={styles.input}
            accessibilityLabel="Pet name"
            autoCorrect={false}
          />
          <View style={styles.chips}>
            <NeonChip label="Save name" onPress={saveName} />
            {pet.name ? (
              <NeonChip
                label="Use the default"
                onPress={() => {
                  commit((doc, now) => renamePetDoc(doc, now, null));
                  setDraft('');
                  setNameNote(null);
                }}
              />
            ) : null}
          </View>
          {nameNote ? <Text style={styles.note}>{nameNote}</Text> : null}
        </>
      ) : null}

      {pet.stage === 'egg' && pet.egg != null ? (
        <>
          <NeonLabel>Change egg</NeonLabel>
          <Text style={styles.body}>
            Back to the egg picker. Warmth and care start over and the next egg gets a fresh roll — nothing has been
            decided yet, so nothing is lost.{pet.ticket ? ' Your ticket comes back.' : ''}
          </Text>
          <NeonButton
            label={changeArmed ? 'Tap again · change egg' : 'Change egg'}
            variant={changeArmed ? 'danger' : 'secondary'}
            onPress={() => {
              if (pressChange()) commit((doc, now) => changeEggDoc(doc, now));
            }}
          />
        </>
      ) : null}

      {canTicket ? (
        <>
          <NeonLabel>Trade-up ticket</NeonLabel>
          {tickets.length === 0 ? (
            <Text style={styles.body}>No tickets yet — 5 shards of a grade trade up for one (Info → Book).</Text>
          ) : (
            <>
              <Text style={styles.body}>Guarantee a grade for this pet (its roll happens at Child):</Text>
              <View style={styles.chips}>
                {tickets.map((g) => (
                  <NeonChip
                    key={g}
                    label={`Use a ${gradeTag(g)}+ ticket ×${pv.tickets[g]}`}
                    onPress={() => commit((doc, now) => applyTicketDoc(doc, now, g))}
                  />
                ))}
              </View>
            </>
          )}
        </>
      ) : pet.ticket && !revealed ? (
        <Text style={styles.body}>Ticket on this egg: {gradeTag(pet.ticket)} or better.</Text>
      ) : null}

      <ReleasePanel view={view} commit={commit} />

      {pet.stage === 'god' ? (
        <>
          <NeonLabel>Rebirth</NeonLabel>
          <Text style={styles.body}>
            Retire this God to the Hall, keep +2% TD damage for good (up to +10%), leave a shard and pick a new egg.
            Optional — your God can stay as long as you like.
          </Text>
          {pv.away ? (
            <Text style={styles.body}>It’s away on an expedition — rebirth once it’s back.</Text>
          ) : (
            <NeonButton
              label={rebirthArmed ? 'Tap again · retire to the Hall' : 'Rebirth into a new egg'}
              variant={rebirthArmed ? 'danger' : 'primary'}
              onPress={() => {
                if (pressRebirth()) commit((doc, now) => rebirthPetDoc(doc, now));
              }}
            />
          )}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  note: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.cyan },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
