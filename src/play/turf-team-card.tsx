/**
 * Turf team picker (pet team roadmap P5): the leader + 2 helper slots, inside the Turf War Setup
 * sheet body (a scrolling PlaySheet), so no bar or the board ever changes size (fixed regions,
 * pinned by check:fixed-regions). Each pet shows the one status badge (`PetStatusBadge`, P2).
 * Rows wrap and have no fixed height, so Larger Text grows the sheet's scroll, never a region.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import { heroName } from '@/play/heroes-data';
import { PetStatusBadge } from '@/play/pet-status-badge';
import { petStatusView } from '@/play/pet-status-view';
import { PlayFrame } from '@/play/play-frame';
import { TURF_HELPER_SLOTS, type TurfCandidate, type TurfHelperPick } from '@/play/turf-team';
import type { Grade } from '@/play/pet-eggs';

function petLabel(c: { name: string | null; heroId: string }): string {
  const hero = heroName(c.heroId);
  return c.name && c.name !== hero ? `${c.name} (${hero})` : hero;
}

export function TurfTeamCard({
  leaderHeroId,
  leaderFromPet,
  leaderGrade,
  leaderCopies,
  leaderShiny,
  candidates,
  picks,
  movingSlot,
  onPick,
  onMove,
}: {
  leaderHeroId: string;
  leaderFromPet: boolean;
  leaderGrade: Grade | null;
  leaderCopies: number;
  leaderShiny: boolean;
  candidates: readonly TurfCandidate[];
  picks: readonly TurfHelperPick[];
  /** The helper slot waiting for a board tap (moving), or null. */
  movingSlot: number | null;
  /** Put a pet in a slot (uid), or empty it (null). */
  onPick: (slot: number, uid: number | null) => void;
  /** Start moving a slot's helper: the next board tap places it. */
  onMove: (slot: number) => void;
}) {
  const theme = useTheme();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const leaderStatus = leaderFromPet ? petStatusView({ grade: leaderGrade, copies: leaderCopies, shiny: leaderShiny }) : null;
  const border = controlBorderColor(theme);

  return (
    <PlayFrame style={styles.card}>
      <ThemedText type="smallBold">Team</ThemedText>
      <View style={styles.row}>
        <ThemedText type="small" style={styles.grow}>
          Leader · {heroName(leaderHeroId)}
        </ThemedText>
        {leaderStatus ? <PetStatusBadge status={leaderStatus} variant="strip" /> : null}
      </View>
      {/* Slots fill in order: Helper 2 shows once Helper 1 has a pet (so a slot's name and spot always match). */}
      {Array.from({ length: Math.min(TURF_HELPER_SLOTS, picks.length + 1) }, (_, slot) => {
        const pick = picks[slot];
        const pet = pick ? candidates.find((c) => c.uid === pick.uid) ?? null : null;
        const status = pet ? petStatusView({ grade: pet.grade, copies: pet.copies, shiny: pet.shiny }) : null;
        const open = openSlot === slot;
        const taken = new Set(picks.filter((_, i) => i !== slot).map((p) => p.uid));
        const choices = candidates.filter((c) => !taken.has(c.uid));
        return (
          <View key={slot} style={styles.slot}>
            <View style={styles.row}>
              <Pressable
                onPress={() => setOpenSlot(open ? null : slot)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={pet ? `Helper ${slot + 1}: ${petLabel(pet)}. Change` : `Helper ${slot + 1}: empty. Pick a pet`}
                style={({ pressed }) => [styles.grow, pressed && styles.pressed]}>
                <ThemedText type="small">
                  Helper {slot + 1} · {pet ? petLabel(pet) : 'empty — tap to pick'}
                </ThemedText>
              </Pressable>
              {status ? <PetStatusBadge status={status} variant="strip" /> : null}
            </View>
            {pet ? (
              <View style={styles.row}>
                <Pressable
                  onPress={() => onMove(slot)}
                  accessibilityRole="button"
                  accessibilityLabel={`Move helper ${slot + 1} on the board`}
                  style={({ pressed }) => [styles.chip, { borderColor: border }, movingSlot === slot && { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">{movingSlot === slot ? 'Tap the board…' : 'Move'}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onPick(slot, null);
                    setOpenSlot(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove helper ${slot + 1}`}
                  style={({ pressed }) => [styles.chip, { borderColor: border }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">Remove</ThemedText>
                </Pressable>
              </View>
            ) : null}
            {open ? (
              <View style={styles.list}>
                {choices.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Pets from Child stage up can help. Grow one in the Hideout.
                  </ThemedText>
                ) : (
                  choices.map((c) => {
                    const s = petStatusView({ grade: c.grade, copies: c.copies, shiny: c.shiny });
                    const chosen = pet?.uid === c.uid;
                    return (
                      <Pressable
                        key={c.uid}
                        onPress={() => {
                          onPick(slot, c.uid);
                          setOpenSlot(null);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen }}
                        accessibilityLabel={`Pick ${petLabel(c)}${s ? `, ${s.label}` : ''}`}
                        style={({ pressed }) => [
                          styles.row,
                          styles.choice,
                          { borderColor: border },
                          chosen && { backgroundColor: theme.backgroundSelected },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText type="small" style={styles.grow}>
                          {petLabel(c)}
                        </ThemedText>
                        {s ? <PetStatusBadge status={s} variant="strip" /> : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary">
        Helpers stand beside the road and attack on their own. To move one, tap it on the board, then tap
        where it should stand. A boss walking past knocks a helper out until the next wave.
      </ThemedText>
    </PlayFrame>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  slot: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  grow: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  list: { gap: 6 },
  choice: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44 },
  pressed: { opacity: 0.7 },
});
